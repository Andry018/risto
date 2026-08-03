import { getSetting, SETTINGS_KEYS } from './appSettings';

const ENV_AGENT_URL = (import.meta.env.VITE_PRINT_AGENT_URL as string)?.trim() || 'http://127.0.0.1:8787';
const ENV_PRINTER_IP = (import.meta.env.VITE_PRINTER_IP as string)?.trim() || '';
const ENV_PRINTER_PORT = Number(import.meta.env.VITE_PRINTER_PORT) || 9100;

export function getPrintAgentUrl(): string {
  return getSetting(SETTINGS_KEYS.printAgentUrl, ENV_AGENT_URL).trim();
}

export function getPrinterIp(): string {
  return getSetting(SETTINGS_KEYS.printerIp, ENV_PRINTER_IP).trim();
}

export function getPrinterPort(): number {
  const raw = getSetting(SETTINGS_KEYS.printerPort, String(ENV_PRINTER_PORT));
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : ENV_PRINTER_PORT;
}
