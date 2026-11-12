import type { CustomizedItem } from '../types/entities';
import { PANINO_COMPOSTO_ID } from './paninoConfig';

type KitchenPrintJob = {
  kind: 'kitchen';
  tableName: string;
  orderTime?: string;
  items: CustomizedItem[];
  allergieNote?: string;
  /** Asporto: sul foglio cucina vanno anche bevande e dolci (tutto su un foglio). */
  allItems?: boolean;
  printerIp?: string;
  printerPort?: number;
};

type ReceiptPrintJob = {
  kind: 'receipt';
  tableName: string;
  total: number;
  subtotal?: number;
  discount?: number;
  discountLabel?: string;
  items: (CustomizedItem & { lineTotal?: number })[];
  printerIp?: string;
  printerPort?: number;
};

type SalaPrintJob = {
  kind: 'sala';
  tableName: string;
  items: CustomizedItem[];
  printerIp?: string;
  printerPort?: number;
};

export type HaccpLabelData = {
  kind: 'haccp_label';
  nome_prodotto: string;
  ingredienti: string;
  allergeni: string;
  data_scadenza: string;
  data_preparazione?: string;
  lotto?: string;
  conservazione?: string;
  printerIp?: string;
  printerPort?: number;
};

type QuickLabelData = {
  kind: 'quick_label';
  nome: string;
  printerIp?: string;
  printerPort?: number;
};

type PreContoJob = {
  kind: 'pre_conto';
  tableName: string;
  covers?: number;
  total: number;
  items: {
    nome: string;
    quantity: number;
    prezzo: number;
    addedIngredients: { nome: string; prezzo: number }[];
    removedIngredients: string[];
    notes: string;
    lineTotal?: number;
    removalDiscount?: number;
  }[];
  printerIp?: string;
  printerPort?: number;
};

type PrintJob = KitchenPrintJob | ReceiptPrintJob | SalaPrintJob | HaccpLabelData | QuickLabelData | PreContoJob;

function normalizeAgentUrl(agentUrl: string): string {
  const trimmed = agentUrl.trim();
  if (!trimmed) return 'http://127.0.0.1:8787';
  return trimmed.replace(/\/+$/, '');
}

export async function printKitchenViaAgent(items: CustomizedItem[], tableName: string, agentUrl: string, printerIp?: string, printerPort?: number, orderTime?: string, allergieNote?: string, allItems?: boolean): Promise<void> {
  await sendPrintJob({
    kind: 'kitchen',
    tableName,
    orderTime,
    items,
    allergieNote,
    ...(allItems ? { allItems: true } : {}),
    printerIp,
    printerPort,
  }, agentUrl);
}

export async function printReceiptViaAgent(
  items: CustomizedItem[],
  tableName: string,
  total: number,
  agentUrl: string,
  printerIp?: string,
  printerPort?: number,
  extra?: { lineTotals?: number[]; subtotal?: number; discount?: number; discountLabel?: string },
): Promise<void> {
  await sendPrintJob({
    kind: 'receipt',
    tableName,
    total,
    subtotal: extra?.subtotal,
    discount: extra?.discount,
    discountLabel: extra?.discountLabel,
    items: items.map((i, idx) => (extra?.lineTotals ? { ...i, lineTotal: extra.lineTotals[idx] } : i)),
    printerIp,
    printerPort,
  }, agentUrl);
}

export async function printSalaViaAgent(items: CustomizedItem[], tableName: string, agentUrl: string, printerIp?: string, printerPort?: number): Promise<void> {
  await sendPrintJob({
    kind: 'sala',
    tableName,
    items,
    printerIp,
    printerPort,
  }, agentUrl);
}

export async function printPreContoViaAgent(items: CustomizedItem[], tableName: string, total: number, agentUrl: string, printerIp?: string, printerPort?: number, covers?: number, removalDiscounts?: number[]): Promise<void> {
  await sendPrintJob({
    kind: 'pre_conto',
    tableName,
    covers,
    total,
    items: items.map((i, idx) => ({
      nome: i.nome,
      quantity: i.quantity,
      prezzo: i.prezzo,
      addedIngredients: i.addedIngredients,
      removedIngredients: i.removedIngredients,
      notes: i.id === PANINO_COMPOSTO_ID ? '' : i.notes, // panino composto: solo il nome (vedi hidePaninoDetails)
      lineTotal: undefined,
      removalDiscount: removalDiscounts?.[idx],
    })),
    printerIp,
    printerPort,
  }, agentUrl);
}

export async function printLabelViaAgent(data: HaccpLabelData, agentUrl: string): Promise<void> {
  await sendPrintJob(data, agentUrl);
}

export async function printQuickLabelViaAgent(nome: string, agentUrl: string): Promise<void> {
  await sendPrintJob({ kind: 'quick_label', nome }, agentUrl);
}

/** Più dei nuovi tentativi lato agent (~5 s) + timeout socket (15 s): oltre, la richiesta è persa. */
const PRINT_REQUEST_TIMEOUT_MS = 30_000;

/**
 * Il panino composto ha la sua scheda cartacea, compilata dal cliente e consegnata in cucina:
 * sui fogli non va l'elenco degli ingredienti (resta nell'app per il prezzo). In comanda esce
 * "VEDI SCHEDA", su conto e pre-conto solo il nome.
 */
export function hidePaninoDetails<T extends PrintJob>(job: T): T {
  if (!('items' in job) || !Array.isArray(job.items)) return job;
  return {
    ...job,
    items: job.items.map(i => (i as { id?: string }).id === PANINO_COMPOSTO_ID
      ? { ...i, notes: job.kind === 'kitchen' ? 'VEDI SCHEDA' : undefined }
      : i),
  };
}

async function sendPrintJob(rawJob: PrintJob, agentUrl: string): Promise<void> {
  const job = hidePaninoDetails(rawJob);
  const url = `${normalizeAgentUrl(agentUrl)}/print`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PRINT_REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(job),
      signal: ctrl.signal,
    });
  } catch (e) {
    if (ctrl.signal.aborted) throw new Error('La stampante non ha risposto in tempo.');
    throw new Error('Print agent non raggiungibile (rete o server).', { cause: e });
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let msg = text;
    try { msg = (JSON.parse(text) as { error?: string }).error || text; } catch { /* testo semplice */ }
    throw new Error(msg || `Print agent error (${res.status})`);
  }
}

/** Messaggio leggibile per il toast di errore stampa (codici di rete tradotti). */
export function printErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? '');
  if (/ECONNREFUSED|EHOSTUNREACH|ENETUNREACH|ETIMEDOUT|connect timeout|Socket timeout/i.test(raw)) {
    return 'Stampante non raggiungibile: controlla che sia accesa e collegata alla rete.';
  }
  return raw || 'Controlla print agent, IP stampante e rete LAN.';
}
