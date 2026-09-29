import { createClient } from '@supabase/supabase-js';
import { env } from '../config.js';

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

// Tool che modificano dati o stampano: richiedono conferma manuale da Telegram
export const WRITE_TOOLS = new Set(['add_item_to_table', 'close_table', 'print_order', 'set_availability']);

type Tavolo = { id: string; nome: string; status: string; clienti: number; sala: string };
type Prodotto = { id: string; nome: string; prezzo: number; categoria: string; disponibile: boolean };
type CartItem = {
  nome: string; quantity: number; prezzo_unitario: number; categoria: string; portata: string;
  modifiche: { aggiunte: string[]; rimozioni: string[]; note: string };
};

// ---------------------------------------------------------------------------
// Cache menu/tavoli (evita una query per ogni messaggio)
// ---------------------------------------------------------------------------
const CACHE_TTL_MS = 30_000;
let cache: { at: number; tavoli: Tavolo[]; prodotti: Prodotto[] } | null = null;

async function getCatalog() {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache;
  const [t, p] = await Promise.all([
    supabase.from('tavoli').select('id, nome, status, clienti, sala'),
    supabase.from('prodotti').select('id, nome, prezzo, categoria, disponibile'),
  ]);
  if (t.error) throw new Error(`Errore lettura tavoli: ${t.error.message}`);
  if (p.error) throw new Error(`Errore lettura menu: ${p.error.message}`);
  cache = { at: Date.now(), tavoli: t.data as Tavolo[], prodotti: p.data as Prodotto[] };
  return cache;
}

const invalidateCatalog = () => { cache = null; };

// ---------------------------------------------------------------------------
// Risoluzione nomi: il modello piccolo sbaglia spesso i nomi esatti,
// quindi li abbiniamo qui (fuzzy) e l'utente conferma il risultato.
// ---------------------------------------------------------------------------
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

function levenshtein(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}

async function resolveTable(input: string | number): Promise<Tavolo> {
  const key = norm(String(input)).replace(/^tavolo /, '');
  const { tavoli } = await getCatalog();
  const table = tavoli.find(t => norm(t.nome).replace(/^tavolo /, '') === key);
  if (!table) throw new Error(`Tavolo "${input}" non trovato`);
  return table;
}

export function productScore(query: string, nome: string): number {
  const q = norm(query), n = norm(nome);
  if (q === n) return 1;
  const nTokens = n.split(' ');
  const qTokens = q.split(' ');
  // Tolleranza di 1 lettera per parole lunghe (pizze/pizza, margherite/margherita)
  const matched = qTokens.filter(qt => nTokens.some(nt =>
    nt.startsWith(qt) || levenshtein(qt, nt) <= (qt.length > 4 ? 1 : 0))).length;
  const tokenScore = matched / qTokens.length;
  const sim = 1 - levenshtein(q, n) / Math.max(q.length, n.length);
  return 0.7 * tokenScore + 0.3 * sim;
}

async function resolveProduct(query: string): Promise<Prodotto> {
  const { prodotti } = await getCatalog();
  const ranked = prodotti
    .map(p => ({ p, score: productScore(query, p.nome) }))
    .sort((a, b) => b.score - a.score);
  const [best, second] = ranked;
  if (!best || best.score < 0.5) {
    const near = ranked.filter(r => r.score >= 0.3).slice(0, 3).map(r => r.p.nome);
    throw new Error(`"${query}" non trovato nel menu` + (near.length ? `. Forse: ${near.join(', ')}?` : ''));
  }
  if (best.score < 1 && second && best.score - second.score < 0.05) {
    const options = ranked.filter(r => best.score - r.score < 0.05).slice(0, 4).map(r => r.p.nome);
    throw new Error(`"${query}" è ambiguo, intendi: ${options.join(', ')}?`);
  }
  return best.p;
}

async function openOrder(tableName: string) {
  const { data, error } = await supabase
    .from('ordini')
    .select('id, carrello, totale, created_at')
    .eq('nome_cliente', tableName)
    .eq('status', 'IN_ATTESA')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Errore lettura ordine: ${error.message}`);
  return data as { id: string; carrello: CartItem[]; totale: number; created_at: string } | null;
}

const toLocalISODate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// ---------------------------------------------------------------------------
// Anteprima: risolve tavoli/piatti SENZA scrivere nulla.
// Restituisce il testo da mostrare all'utente e gli argomenti già risolti.
// ---------------------------------------------------------------------------
export type PreparedAction = { tool: string; args: any; summary: string };

export async function prepareAction(name: string, args: any): Promise<PreparedAction> {
  switch (name) {
    case 'add_item_to_table': {
      const table = await resolveTable(args.table_id);
      const items = [];
      for (const it of args.items ?? []) {
        const p = await resolveProduct(it.name);
        if (!p.disponibile) throw new Error(`${p.nome} non disponibile`);
        items.push({ nome: p.nome, quantity: Math.max(1, Math.round(Number(it.quantity) || 1)), course: it.course });
      }
      if (!items.length) throw new Error('Nessun piatto indicato');
      return {
        tool: name,
        args: { table_id: table.id, items },
        summary: `➕ ${table.nome}:\n` + items.map(i => `• ${i.quantity}× ${i.nome}`).join('\n'),
      };
    }
    case 'close_table': {
      const table = await resolveTable(args.table_id);
      const order = await openOrder(table.nome);
      const tot = order ? ` (totale €${Number(order.totale).toFixed(2)})` : ' (nessun ordine aperto)';
      return { tool: name, args: { table_id: table.id }, summary: `🧾 Chiudere il conto di ${table.nome}${tot}?` };
    }
    case 'print_order': {
      const table = await resolveTable(args.table_id);
      const type = args.type === 'sala' ? 'sala' : 'kitchen';
      return {
        tool: name,
        args: { table_id: table.id, type },
        summary: `🖨️ Stampare comanda ${type === 'kitchen' ? 'cucina' : 'sala'} per ${table.nome}?`,
      };
    }
    case 'set_availability': {
      const p = await resolveProduct(args.name);
      const available = args.available === true || args.available === 'true';
      return {
        tool: name,
        args: { product_id: p.id, available },
        summary: `${available ? '✅' : '🚫'} Segnare "${p.nome}" come ${available ? 'disponibile' : 'NON disponibile'}?`,
      };
    }
    default:
      throw new Error(`Tool sconosciuto: ${name}`);
  }
}

// ---------------------------------------------------------------------------
// Esecuzione
// ---------------------------------------------------------------------------

/** Tool di sola lettura, chiamati direttamente dall'LLM */
export async function executeReadTool(name: string, args: any): Promise<any> {
  switch (name) {
    case 'get_table_status': return getTableStatus(args);
    case 'get_daily_report': return dailyReport();
    default: throw new Error(`Tool sconosciuto: ${name}`);
  }
}

/** Tool di scrittura, eseguiti SOLO dopo conferma con argomenti già risolti da prepareAction */
export async function executeConfirmed({ tool, args }: PreparedAction): Promise<string> {
  switch (tool) {
    case 'add_item_to_table': return addItems(args);
    case 'close_table': return closeTable(args);
    case 'print_order': return printOrder(args);
    case 'set_availability': return setAvailability(args);
    default: throw new Error(`Tool sconosciuto: ${tool}`);
  }
}

async function tableById(id: string): Promise<Tavolo> {
  const { tavoli } = await getCatalog();
  const t = tavoli.find(x => x.id === id);
  if (!t) throw new Error('Tavolo non più esistente');
  return t;
}

async function addItems({ table_id, items }: { table_id: string; items: Array<{ nome: string; quantity: number; course?: string }> }) {
  const table = await tableById(table_id);
  const { prodotti } = await getCatalog();
  const order = await openOrder(table.nome);
  const carrello: CartItem[] = order?.carrello ?? [];

  for (const item of items) {
    const p = prodotti.find(x => x.nome === item.nome);
    if (!p) throw new Error(`${item.nome} non più nel menu`);
    carrello.push({
      nome: p.nome,
      quantity: item.quantity,
      prezzo_unitario: Number(p.prezzo),
      categoria: p.categoria,
      portata: ['1', '2', '3', '4', '5'].includes(String(item.course)) ? String(item.course) : '1',
      modifiche: { aggiunte: [], rimozioni: [], note: '' },
    });
  }
  const totale = carrello.reduce((s, i) => s + i.prezzo_unitario * i.quantity, 0);

  if (order) {
    const { error } = await supabase.from('ordini').update({ carrello, totale }).eq('id', order.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from('ordini').insert({
      id: crypto.randomUUID(),
      nome_cliente: table.nome,
      status: 'IN_ATTESA',
      carrello,
      totale,
      orario_ritiro: new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
    });
    if (error) throw new Error(error.message);
    await supabase.from('tavoli').update({ status: 'OCCUPATO' }).eq('id', table.id);
    invalidateCatalog();
  }
  return `✅ Aggiunto a ${table.nome}. Totale conto: €${totale.toFixed(2)}`;
}

async function closeTable({ table_id }: { table_id: string }) {
  const table = await tableById(table_id);
  const r1 = await supabase.from('ordini').update({ status: 'COMPLETATO' }).eq('nome_cliente', table.nome).eq('status', 'IN_ATTESA');
  if (r1.error) throw new Error(r1.error.message);
  const r2 = await supabase.from('tavoli').update({ status: 'LIBERO', clienti: 0 }).eq('id', table.id);
  if (r2.error) throw new Error(r2.error.message);
  invalidateCatalog();
  return `✅ Conto chiuso, ${table.nome} liberato`;
}

async function printOrder({ table_id, type }: { table_id: string; type: 'kitchen' | 'sala' }) {
  const table = await tableById(table_id);
  const order = await openOrder(table.nome);
  if (!order) throw new Error(`Nessun ordine aperto per ${table.nome}`);

  const salaCats = ['Bevande', 'Dolce', 'Dolci', 'Caffè e Liquori'];
  const targetItems = order.carrello.filter(i => salaCats.includes(i.categoria ?? '') === (type === 'sala'));
  if (targetItems.length === 0) return `Nessun piatto da stampare (${type === 'kitchen' ? 'cucina' : 'sala'})`;

  const res = await fetch(`${env.PRINT_AGENT_URL}/print`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      kind: type,
      tableName: table.nome,
      items: targetItems.map(i => ({
        nome: i.nome,
        quantity: i.quantity,
        addedIngredients: i.modifiche?.aggiunte ?? [],
        removedIngredients: i.modifiche?.rimozioni ?? [],
        notes: i.modifiche?.note ?? '',
      })),
    }),
  });
  if (!res.ok) throw new Error(`Print agent error: ${res.status}`);
  return `✅ Comanda ${type === 'kitchen' ? 'cucina' : 'sala'} inviata per ${table.nome}`;
}

async function setAvailability({ product_id, available }: { product_id: string; available: boolean }) {
  const { data, error } = await supabase
    .from('prodotti').update({ disponibile: available }).eq('id', product_id).select('nome').single();
  if (error) throw new Error(error.message);
  invalidateCatalog();
  return `✅ ${data.nome} ora ${available ? 'disponibile' : 'NON disponibile'}`;
}

async function getTableStatus({ table_id }: { table_id: string }) {
  const table = await resolveTable(table_id);
  const order = await openOrder(table.nome);
  return {
    tavolo: table.nome, stato: table.status, coperti: table.clienti, sala: table.sala,
    ordine: order
      ? { piatti: order.carrello.map(i => `${i.quantity}× ${i.nome}`), totale: order.totale, dalle: order.created_at }
      : null,
  };
}

async function dailyReport() {
  const today = toLocalISODate();
  const start = new Date(`${today}T00:00:00`).toISOString(); // mezzanotte locale → UTC
  const { data: orders, error } = await supabase
    .from('ordini')
    .select('totale, carrello')
    .eq('status', 'COMPLETATO')
    .gte('created_at', start);
  if (error) throw new Error(error.message);

  const total = orders?.reduce((s, o) => s + (Number(o.totale) || 0), 0) ?? 0;
  const count = orders?.length ?? 0;
  return { data: today, ordini: count, incasso: `€${total.toFixed(2)}` };
}
