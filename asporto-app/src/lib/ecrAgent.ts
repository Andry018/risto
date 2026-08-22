/**
 * Client per l'ECR Agent locale (PAX A35 / Nexi ECR17).
 * Chiamato da POSView e CardPaymentModal per avviare pagamenti carta.
 */

const getEcrUrl = (): string =>
  localStorage.getItem('ecr_agent_url') || 'http://localhost:8788';

export interface PaymentResult {
  ok: boolean;
  txId: string;
  amount: number;
  amountCents?: number;
  authCode?: string;
  responseCode?: string;
  description?: string;
  partNumber?: number;
  totalParts?: number;
  completedAt?: string;
  error?: string;
}

export interface TerminalStatus {
  ok: boolean;
  busy?: boolean;
  paxHost?: string;
  paxPort?: number;
  error?: string;
}

/**
 * Avvia un pagamento carta sul terminale PAX A35.
 * Attende la risposta del terminale (il cliente presenta la carta).
 */
export async function payWithCard(
  amount: number,
  opts?: {
    partNumber?: number;
    totalParts?: number;
    description?: string;
  }
): Promise<PaymentResult> {
  const res = await fetch(`${getEcrUrl()}/pay`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount, ...opts }),
  });

  const data = await res.json() as PaymentResult;
  return data;
}

/**
 * Verifica che l'ECR agent sia raggiungibile e il terminale connesso.
 */
export async function getTerminalStatus(): Promise<TerminalStatus> {
  try {
    const res = await fetch(`${getEcrUrl()}/status`, {
      signal: AbortSignal.timeout(5000),
    });
    return await res.json() as TerminalStatus;
  } catch {
    return { ok: false, error: 'ECR agent non raggiungibile su ' + getEcrUrl() };
  }
}

/**
 * Verifica solo che l'agent HTTP sia attivo (senza contattare il terminale).
 */
export async function pingEcrAgent(): Promise<boolean> {
  try {
    const res = await fetch(`${getEcrUrl()}/health`, {
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export interface FiscalReceiptItem {
  nome: string;
  prezzo: number;
  quantita: number;
  iva?: string; // aliquota IVA in % (es. "10", "22")
}

/**
 * Stampa lo scontrino fiscale sulla cassa Custom Big Plus RT.
 * Chiamato dopo un pagamento carta approvato.
 */
export async function printFiscalReceipt(opts: {
  items: FiscalReceiptItem[];
  total: number;
  payment: 'carta' | 'contanti';
  authCode?: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${getEcrUrl()}/print-receipt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(opts),
      signal: AbortSignal.timeout(30000),
    });
    return await res.json() as { ok: boolean; error?: string };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Errore stampa scontrino' };
  }
}
