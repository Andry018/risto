import type { CustomizedItem } from '../types/app';

const CATEGORIES_NO_KITCHEN = ['Bevande', 'Caffè e Liquori', 'Servizio'];

export function printKitchen(items: CustomizedItem[], tableName: string) {
  const foodItems = items.filter(i => !CATEGORIES_NO_KITCHEN.includes(i.categoria));
  const grouped = new Map<string, CustomizedItem[]>();
  for (const item of foodItems) {
    const key = item.portata || '1';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(item);
  }
  const sorted = Array.from(grouped.entries()).sort(([a], [b]) => parseInt(a) - parseInt(b));

  const now = new Date().toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Comanda Cucina</title>
<style>
  @page { margin: 8mm; size: 80mm auto; }
  body { font-family: 'Courier New', monospace; font-size: 12px; margin: 0; padding: 0; width: 72mm; }
  h1 { font-size: 16px; text-align: center; margin: 0 0 4px; padding-bottom: 4px; border-bottom: 2px dashed #000; }
  .info { text-align: center; font-size: 11px; margin-bottom: 8px; }
  .group { margin-bottom: 12px; page-break-inside: avoid; }
  .group h2 { font-size: 13px; margin: 0 0 4px; padding: 2px 4px; background: #eee; }
  .item { padding: 2px 0; border-bottom: 1px dotted #ccc; }
  .item-row { display: flex; justify-content: space-between; }
  .qty { font-weight: bold; }
  .name { flex: 1; padding-left: 4px; }
  .mod { font-size: 10px; color: #555; padding-left: 14px; }
  .footer { text-align: center; font-size: 10px; margin-top: 8px; padding-top: 4px; border-top: 1px dashed #000; }
</style></head><body>
  <h1>★ COMANDA CUCINA ★</h1>
  <div class="info"><strong>${tableName}</strong> &mdash; ${now}</div>`;

  for (const [key, items] of sorted) {
    const portataLabel = key === '1' ? '1ª USCITA' : key === '2' ? '2ª USCITA' : key === '3' ? '3ª USCITA' : key === '4' ? '4ª USCITA' : key === '5' ? '5ª USCITA' : 'ALTRO';
    html += `<div class="group"><h2>${portataLabel}</h2>`;
    for (const item of items) {
      html += `<div class="item"><div class="item-row"><span class="qty">x${item.quantity}</span><span class="name">${item.nome.toUpperCase()}</span></div>`;
      if (item.addedIngredients.length > 0) html += `<div class="mod">+ ${item.addedIngredients.map(a => a.nome).join(', ')}</div>`;
      if (item.removedIngredients.length > 0) html += `<div class="mod">- ${item.removedIngredients.join(', ')}</div>`;
      if (item.notes) html += `<div class="mod">NOTE: ${item.notes}</div>`;
      html += `</div>`;
    }
    html += `</div>`;
  }

  html += `<div class="footer">--- FINE COMANDI ---</div></body></html>`;
  openPrintWindow(html);
}

export function printFullReceipt(items: CustomizedItem[], tableName: string, total: number) {
  const now = new Date().toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Conto</title>
<style>
  @page { margin: 8mm; size: 80mm auto; }
  body { font-family: 'Courier New', monospace; font-size: 12px; margin: 0; padding: 0; width: 72mm; }
  h1 { font-size: 16px; text-align: center; margin: 0 0 4px; padding-bottom: 4px; border-bottom: 2px dashed #000; }
  .info { text-align: center; font-size: 11px; margin-bottom: 8px; }
  .item { padding: 3px 0; border-bottom: 1px dotted #ccc; }
  .item-row { display: flex; justify-content: space-between; }
  .qty { font-weight: bold; }
  .name { flex: 1; padding-left: 4px; }
  .price { text-align: right; white-space: nowrap; }
  .mod { font-size: 10px; color: #555; padding-left: 14px; }
  .total { display: flex; justify-content: space-between; font-size: 16px; font-weight: bold; margin-top: 8px; padding-top: 4px; border-top: 2px solid #000; }
  .footer { text-align: center; font-size: 10px; margin-top: 8px; padding-top: 4px; border-top: 1px dashed #000; }
</style></head><body>
  <h1>CONTO</h1>
  <div class="info"><strong>${tableName}</strong> &mdash; ${now}</div>`;

  for (const item of items) {
    const itemTotal = item.prezzo * item.quantity + item.addedIngredients.reduce((s, a) => s + a.prezzo, 0);
    html += `<div class="item"><div class="item-row"><span class="qty">x${item.quantity}</span><span class="name">${item.nome.toUpperCase()}</span><span class="price">€${itemTotal.toFixed(2)}</span></div>`;
    if (item.addedIngredients.length > 0) html += `<div class="mod">+ ${item.addedIngredients.map(a => a.nome).join(', ')}</div>`;
    if (item.removedIngredients.length > 0) html += `<div class="mod">- ${item.removedIngredients.join(', ')}</div>`;
    if (item.notes) html += `<div class="mod">NOTE: ${item.notes}</div>`;
    html += `</div>`;
  }

  html += `<div class="total"><span>TOTALE</span><span>€${total.toFixed(2)}</span></div>`;
  html += `<div class="footer">Grazie e arrivederci!</div></body></html>`;
  openPrintWindow(html);
}

function openPrintWindow(html: string) {
  const w = window.open('', '_blank', 'width=400,height=600,scrollbars=yes');
  if (!w) { alert('Aprire il popup per stampare.'); return; }
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); }, 300);
}
