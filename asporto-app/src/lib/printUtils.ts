import type { CustomizedItem } from '../types/entities';
import { PORTATE } from '../types/entities';

const CATEGORIES_NO_KITCHEN = ['Bevande', 'Caffè e Liquori', 'Servizio'];
const VARIANT_NOISE = ['Pizze Bianca', 'Pizze Rosse', 'Pizze', 'Impasto'];

function cleanText(text: string): string {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function truncate(text: string, max = 30): string {
  const value = cleanText(text);
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

function groupByPortata(items: CustomizedItem[]) {
  const grouped = new Map<string, CustomizedItem[]>();
  for (const item of items) {
    const key = item.portata || '1';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(item);
  }
  return [...grouped.entries()].sort(([a], [b]) => parseInt(a, 10) - parseInt(b, 10));
}

export function printKitchen(items: CustomizedItem[], tableName: string) {
  const foodItems = items.filter(i => !CATEGORIES_NO_KITCHEN.includes(i.categoria));
  const sorted = groupByPortata(foodItems);
  const now = new Date().toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Comanda cucina</title>
<style>
  @page { margin: 3mm; size: 80mm auto; }
  body { font-family: 'Arial Black', Arial, Helvetica, sans-serif; font-size: 17px; margin: 0; padding: 0; width: 80mm; color: #000; }
  .top { margin-bottom: 6px; }
  .header { display: flex; justify-content: space-between; gap: 4px; align-items: flex-start; margin-bottom: 2px; }
  .title { font-size: 20px; font-weight: 700; line-height: 1; }
  .meta { font-size: 13px; font-weight: 700; line-height: 1.25; }
  .group { margin-top: 6px; padding-top: 5px; border-top: 1px solid #000; page-break-inside: avoid; }
  .group:first-of-type { border-top: 0; padding-top: 0; margin-top: 0; }
  .group-label { font-size: 15px; font-weight: 700; text-transform: uppercase; margin: 0 0 4px; }
  .item { margin-bottom: 5px; }
  .item-line { display: flex; gap: 4px; align-items: flex-start; }
  .qty { font-weight: 700; min-width: 18px; font-size: 17px; }
  .name { font-weight: 700; flex: 1; word-break: break-word; font-size: 17px; }
  .mod { font-size: 15px; font-weight: 700; line-height: 1.2; margin-left: 18px; word-break: break-word; }
</style></head><body>
  <div class="top">
    <div class="header">
      <div class="title">${truncate(tableName, 18)}</div>
      <div class="meta">${now}</div>
    </div>
  </div>`;

  sorted.forEach(([portata, items]) => {
    const portataInfo = PORTATE.find(p => p.value === portata);
    html += `<div class="group">`;
    if (portataInfo) html += `<div class="group-label">${portataInfo.label}</div>`;
    for (const item of items) {
      html += `<div class="item"><div class="item-line"><div class="qty">${item.quantity}x</div><div class="name">${truncate(item.nome.toUpperCase(), 28)}</div></div>`;
      const extras = item.addedIngredients.filter(a => !VARIANT_NOISE.includes(a.nome));
      if (extras.length > 0) html += `<div class="mod">+ ${truncate(extras.map(a => a.nome).join(', '), 48)}</div>`;
      if (item.removedIngredients.length > 0) html += `<div class="mod">- ${truncate(item.removedIngredients.join(', '), 48)}</div>`;
      if (item.notes) html += `<div class="mod">NOTE: ${truncate(item.notes, 50)}</div>`;
      html += `</div>`;
    }
    html += `</div>`;
  });

  html += `</body></html>`;
  openPrintWindow(html);
}

export function printFullReceipt(items: CustomizedItem[], tableName: string, total: number) {
  const now = new Date().toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Conto</title>
<style>
  @page { margin: 4mm; size: 80mm auto; }
  body { font-family: 'Arial Black', Arial, Helvetica, sans-serif; font-size: 16px; margin: 0; padding: 0; width: 80mm; color: #000; }
  .title { font-size: 25px; font-weight: 700; text-align: center; margin: 0 0 4px; }
  .meta { text-align: center; font-size: 13px; font-weight: 700; margin-bottom: 8px; }
  .item { margin-bottom: 5px; padding-bottom: 4px; border-bottom: 1px dotted #000; }
  .item-line { display: flex; gap: 4px; align-items: flex-start; }
  .qty { font-weight: 700; min-width: 18px; font-size: 17px; }
  .name { font-weight: 700; flex: 1; word-break: break-word; font-size: 17px; }
  .price { font-weight: 700; white-space: nowrap; font-size: 17px; }
  .mod { font-size: 15px; font-weight: 700; line-height: 1.2; margin-left: 18px; word-break: break-word; }
  .total { display: flex; justify-content: space-between; font-size: 21px; font-weight: 700; margin-top: 8px; padding-top: 6px; border-top: 1px solid #000; }
  .footer { text-align: center; font-size: 12px; font-weight: 700; margin-top: 6px; }
</style></head><body>
  <div class="title">CONTO</div>
  <div class="meta">${truncate(tableName, 24)} · ${now}</div>`;

  for (const item of items) {
    const itemTotal = item.prezzo * item.quantity + item.addedIngredients.reduce((s, a) => s + a.prezzo, 0);
    html += `<div class="item"><div class="item-line"><div class="qty">${item.quantity}x</div><div class="name">${truncate(item.nome.toUpperCase(), 28)}</div><div class="price">€${itemTotal.toFixed(2)}</div></div>`;
    const extras = item.addedIngredients.filter(a => !VARIANT_NOISE.includes(a.nome));
    if (extras.length > 0) html += `<div class="mod">+ ${truncate(extras.map(a => a.nome).join(', '), 48)}</div>`;
    if (item.removedIngredients.length > 0) html += `<div class="mod">- ${truncate(item.removedIngredients.join(', '), 48)}</div>`;
    if (item.notes) html += `<div class="mod">NOTE: ${truncate(item.notes, 50)}</div>`;
    html += `</div>`;
  }

  html += `<div class="total"><span>TOTALE</span><span>€${total.toFixed(2)}</span></div>`;
  html += `<div class="footer">Grazie e arrivederci!</div></body></html>`;
  openPrintWindow(html);
}

function openPrintWindow(html: string) {
  const w = window.open('', '_blank', 'width=420,height=700,scrollbars=yes');
  if (!w) {
    alert('Aprire il popup per stampare.');
    return;
  }
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => {
    w.print();
  }, 300);
}
