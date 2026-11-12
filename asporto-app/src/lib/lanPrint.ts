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

  if (res.status === 202) {
    // Comanda non stampata ma tenuta dal print agent nella lista "Comande non stampate"
    const data = await res.json().catch(() => ({})) as { error?: string; auto?: boolean };
    notifyPendingPrintsChanged();
    throw new PrintQueuedError(data.error || 'Stampante non pronta', data.auto !== false);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let msg = text;
    try { msg = (JSON.parse(text) as { error?: string }).error || text; } catch { /* testo semplice */ }
    throw new Error(msg || `Print agent error (${res.status})`);
  }
}

/**
 * La comanda non è uscita ma il print agent l'ha messa nella lista "Comande non stampate".
 * `auto` = si ristampa da sola appena la stampante è pronta (l'errore è avvenuto prima di stampare);
 * altrimenti va ristampata a mano dalla lista. In entrambi i casi NON va ristampata con il tasto Stampa
 * (uscirebbe due volte).
 */
export class PrintQueuedError extends Error {
  readonly auto: boolean;
  constructor(message: string, auto: boolean) {
    super(message);
    this.name = 'PrintQueuedError';
    this.auto = auto;
  }
}

export function isPrintQueued(error: unknown): error is PrintQueuedError {
  return error instanceof PrintQueuedError;
}

export const PENDING_PRINTS_EVENT = 'risto:pending-prints-changed';

function notifyPendingPrintsChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(PENDING_PRINTS_EVENT));
}

/** Messaggio leggibile per il toast di errore stampa (codici di rete tradotti). */
export function printErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? '');
  const base = /ECONNREFUSED|EHOSTUNREACH|ENETUNREACH|ETIMEDOUT|connect timeout|Socket timeout/i.test(raw)
    ? 'Stampante non raggiungibile: controlla che sia accesa e collegata alla rete.'
    : raw || 'Controlla print agent, IP stampante e rete LAN.';
  if (isPrintQueued(error)) {
    return `${base.replace(/\s*(Poi )?ristampa\.?$/i, '').trim()} ${error.auto
      ? 'La comanda è in attesa ed esce da sola appena la stampante è pronta.'
      : "La comanda è nella lista 'Comande non stampate': ristampala da lì."}`;
  }
  return base;
}

/**
 * Avviso per una comanda salvata ma non stampata. Se è in lista d'attesa non si dice "ristampa"
 * (uscirebbe doppia): esce da sola o si ristampa dalla lista.
 */
export function comandaNotPrintedToast(failed: string[], reason: unknown, saved: string) {
  const what = failed.join(' e ');
  if (isPrintQueued(reason)) {
    return {
      type: 'warning' as const,
      title: `${saved}, comanda ${what} in attesa di stampa`,
      message: printErrorMessage(reason),
      duration: 15000,
    };
  }
  return {
    type: 'error' as const,
    title: `${saved}, comanda ${what} NON stampata`,
    message: `${printErrorMessage(reason)} Poi ristampa con il tasto Stampa.`,
    duration: 15000,
  };
}

/** Riga della lista "Comande non stampate" del print agent. */
export interface PendingPrint {
  id: string;
  createdAt: string;
  kind: 'kitchen' | 'sala' | string;
  label: string;
  reason: string;
  attempts: number;
  /** Si ristampa da sola appena la stampante è pronta */
  auto: boolean;
  items: string[];
}

export async function fetchPendingPrints(agentUrl: string): Promise<PendingPrint[]> {
  const res = await fetch(`${normalizeAgentUrl(agentUrl)}/pending`, { signal: AbortSignal.timeout(5000), cache: 'no-store' });
  if (!res.ok) throw new Error(`Print agent error (${res.status})`);
  const data = await res.json() as { jobs?: PendingPrint[] };
  return data.jobs ?? [];
}

export async function retryPendingPrint(agentUrl: string, id: string): Promise<void> {
  const res = await fetch(`${normalizeAgentUrl(agentUrl)}/pending/${encodeURIComponent(id)}/retry`, { method: 'POST', signal: AbortSignal.timeout(PRINT_REQUEST_TIMEOUT_MS) });
  const data = await res.json().catch(() => ({})) as { ok?: boolean; error?: string };
  notifyPendingPrintsChanged();
  if (!res.ok || !data.ok) throw new Error(data.error || `Print agent error (${res.status})`);
}

export async function deletePendingPrint(agentUrl: string, id: string): Promise<void> {
  const res = await fetch(`${normalizeAgentUrl(agentUrl)}/pending/${encodeURIComponent(id)}/delete`, { method: 'POST', signal: AbortSignal.timeout(5000) });
  notifyPendingPrintsChanged();
  if (!res.ok) throw new Error(`Print agent error (${res.status})`);
}
