import type { CustomizedItem } from '../types/entities';

type KitchenPrintJob = {
  kind: 'kitchen';
  tableName: string;
  orderTime?: string;
  items: CustomizedItem[];
  printerIp?: string;
  printerPort?: number;
};

type ReceiptPrintJob = {
  kind: 'receipt';
  tableName: string;
  total: number;
  items: CustomizedItem[];
  printerIp?: string;
  printerPort?: number;
};

type PrintJob = KitchenPrintJob | ReceiptPrintJob;

function normalizeAgentUrl(agentUrl: string): string {
  const trimmed = agentUrl.trim();
  if (!trimmed) return 'http://127.0.0.1:8787';
  return trimmed.replace(/\/+$/, '');
}

export async function printKitchenViaAgent(items: CustomizedItem[], tableName: string, agentUrl: string, printerIp?: string, printerPort?: number, orderTime?: string): Promise<void> {
  await sendPrintJob({
    kind: 'kitchen',
    tableName,
    orderTime,
    items,
    printerIp,
    printerPort,
  }, agentUrl);
}

export async function printReceiptViaAgent(items: CustomizedItem[], tableName: string, total: number, agentUrl: string, printerIp?: string, printerPort?: number): Promise<void> {
  await sendPrintJob({
    kind: 'receipt',
    tableName,
    items,
    total,
    printerIp,
    printerPort,
  }, agentUrl);
}

async function sendPrintJob(job: PrintJob, agentUrl: string): Promise<void> {
  const url = `${normalizeAgentUrl(agentUrl)}/print`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(job),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Print agent error (${res.status})`);
  }
}
