export const PRINT_AGENT_URL = (import.meta.env.VITE_PRINT_AGENT_URL as string)?.trim() || 'http://127.0.0.1:8787';
export const PRINTER_IP = (import.meta.env.VITE_PRINTER_IP as string)?.trim() || '';
export const PRINTER_PORT = Number(import.meta.env.VITE_PRINTER_PORT) || 9100;
