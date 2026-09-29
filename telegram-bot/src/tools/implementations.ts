import { createClient } from '@supabase/supabase-js';
import { env } from '../config.js';
import { toLocalISODate, parseDay, parseTime, formatDay } from './dates.js';

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

// Tool che modificano dati o stampano: richiedono conferma manuale da Telegram
export const WRITE_TOOLS = new Set([
  'add_item_to_table', 'close_table', 'print_order', 'set_availability', 'set_price',
  'add_reservation', 'cancel_reservation', 'stock_movement', 'set_shift',
]);

type Tavolo = { id: string; nome: string; status: string; clienti: number; sala: string };
type Prodotto = { id: string; nome: string; prezzo: number; categoria: string; disponibile: boolean; ingredienti: string[] | null };
type Ingrediente = { id: string; nome: string; prezzo: number; prezzo_rimozione: number; disponibile: boolean };
type CartItem = {
  nome: string; quantity: number; prezzo_unitario: number; categoria: string; portata: string;
  modifiche: { aggiunte: string[]; rimozioni: string[]; note: string };
};

// ---------------------------------------------------------------------------
// Cache menu/tavoli (evita una query per ogni messaggio)
// ---------------------------------------------------------------------------
const CACHE_TTL_MS = 30_000;
let cache: { at: number; tavoli: Tavolo[]; prodotti: Prodotto[]; ingredienti: Ingrediente[] } | null = null;

async function getCatalog() {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache;
  const [t, p, i] = await Promise.all([
    supabase.from('tavoli').select('id, nome, status, clienti, sala'),
    supabase.from('prodotti').select('id, nome, prezzo, categoria, disponibile, ingredienti'),
    supabase.from('ingredienti').select('id, nome, prezzo, prezzo_rimozione, disponibile'),
  ]);
  if (t.error) throw new Error(`Errore lettura tavoli: ${t.error.message}`);
  if (p.error) throw new Error(`Errore lettura menu: ${p.error.message}`);
  if (i.error) throw new Error(`Errore lettura ingredienti: ${i.error.message}`);
  cache = { at: Date.now(), tavoli: t.data as Tavolo[], prodotti: p.data as Prodotto[], ingredienti: i.data as Ingrediente[] };
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

/** Abbina `query` al nome più simile in `list`; errore se assente o ambiguo */
function matchByName<T extends { nome: string }>(list: T[], query: string, where: string): T {
  const ranked = list
    .map(p => ({ p, score: productScore(query, p.nome) }))
    .sort((a, b) => b.score - a.score);
  const [best, second] = ranked;
  if (!best || best.score < 0.5) {
    const near = ranked.filter(r => r.score >= 0.3).slice(0, 3).map(r => r.p.nome);
    throw new Error(`"${query}" non trovato ${where}` + (near.length ? `. Forse: ${near.join(', ')}?` : ''));
  }
  if (best.score < 1 && second && best.score - second.score < 0.05) {
    const options = ranked.filter(r => best.score - r.score < 0.05).slice(0, 4).map(r => r.p.nome);
    throw new Error(`"${query}" è ambiguo, intendi: ${options.join(', ')}?`);
  }
  return best.p;
}

async function resolveProduct(query: string): Promise<Prodotto> {
  return matchByName((await getCatalog()).prodotti, query, 'nel menu');
}

const asStringList = (v: unknown): string[] =>
  (Array.isArray(v) ? v : typeof v === 'string' && v ? [v] : []).map(String).map(x => x.trim()).filter(Boolean);

/** Risolve aggiunte/rimozioni sugli ingredienti del DB e calcola il prezzo unitario come fa il POS */
export function resolveModifiche(p: Prodotto, ingredienti: Ingrediente[], raw: { add?: unknown; remove?: unknown; note?: unknown }) {
  const note: string[] = raw.note ? [String(raw.note).trim()] : [];

  const aggiunte = asStringList(raw.add).map(q => {
    const ing = matchByName(ingredienti, q, 'tra gli ingredienti');
    if (!ing.disponibile) throw new Error(`${ing.nome} non disponibile`);
    return ing;
  });

  // Rimozioni: solo ingredienti del piatto (come nel POS), così lo sconto rimozione è corretto.
  // Il resto finisce nelle note ("senza X") invece di bloccare l'ordine.
  const propri = ingredienti.filter(i => (p.ingredienti ?? []).some(n => n.toLowerCase() === i.nome.toLowerCase()));
  const rimozioni: Ingrediente[] = [];
  for (const q of asStringList(raw.remove)) {
    try { rimozioni.push(matchByName(propri, q, `in ${p.nome}`)); }
    catch { note.push(`senza ${q}`); }
  }

  const prezzo = Math.max(0, Number(p.prezzo)
    + aggiunte.reduce((s, a) => s + Number(a.prezzo || 0), 0)
    - rimozioni.reduce((s, r) => s + Number(r.prezzo_rimozione || 0), 0));

  return {
    prezzo,
    modifiche: { aggiunte: aggiunte.map(a => a.nome), rimozioni: rimozioni.map(r => r.nome), note: note.filter(Boolean).join(', ') },
  };
}

export function describeModifiche(m: CartItem['modifiche']): string {
  const parts = [
    ...m.aggiunte.map(a => `+${a}`),
    ...m.rimozioni.map(r => `–${r}`),
    ...(m.note ? [`📝 ${m.note}`] : []),
  ];
  return parts.length ? ` (${parts.join(', ')})` : '';
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


// ---------------------------------------------------------------------------
// Anteprima: risolve tavoli/piatti SENZA scrivere nulla.
// Restituisce il testo da mostrare all'utente e gli argomenti già risolti.
// ---------------------------------------------------------------------------
export type PreparedAction = { tool: string; args: any; summary: string };

export async function prepareAction(name: string, args: any): Promise<PreparedAction> {
  switch (name) {
    case 'add_item_to_table': {
      const table = await resolveTable(args.table_id);
      const { ingredienti } = await getCatalog();
      const items: CartItem[] = [];
      for (const it of args.items ?? []) {
        const p = await resolveProduct(it.name);
        if (!p.disponibile) throw new Error(`${p.nome} non disponibile`);
        const { prezzo, modifiche } = resolveModifiche(p, ingredienti, it);
        items.push({
          nome: p.nome,
          quantity: Math.max(1, Math.round(Number(it.quantity) || 1)),
          prezzo_unitario: prezzo,
          categoria: p.categoria,
          portata: ['1', '2', '3', '4', '5'].includes(String(it.course)) ? String(it.course) : '1',
          modifiche,
        });
      }
      if (!items.length) throw new Error('Nessun piatto indicato');
      const lines = items.map(i => `• ${i.quantity}× ${i.nome}${describeModifiche(i.modifiche)} — €${(i.prezzo_unitario * i.quantity).toFixed(2)}`);
      return {
        tool: name,
        args: { table_id: table.id, items },
        summary: `➕ ${table.nome}:\n` + lines.join('\n'),
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
      // Piatto o ingrediente: a parità di nome vince l'ingrediente ("finita la porchetta" = è finita la materia prima)
      const { prodotti, ingredienti } = await getCatalog();
      const target = matchByName([
        ...ingredienti.map(i => ({ nome: i.nome, id: i.id, table: 'ingredienti' as const })),
        ...prodotti.map(p => ({ nome: p.nome, id: p.id, table: 'prodotti' as const })),
      ], String(args.name ?? ''), 'nel menu né tra gli ingredienti');
      const available = args.available === true || args.available === 'true';
      const kind = target.table === 'ingredienti' ? 'ingrediente' : 'piatto';
      return {
        tool: name,
        args: { table: target.table, id: target.id, available },
        summary: `${available ? '✅' : '🚫'} Segnare ${kind} "${target.nome}" come ${available ? 'disponibile' : 'NON disponibile'}?`,
      };
    }
    case 'set_price': {
      const p = await resolveProduct(String(args.name ?? ''));
      const price = Math.round(Number(String(args.price).replace(',', '.')) * 100) / 100;
      if (!(price > 0) || price > 1000) throw new Error(`Prezzo non valido: ${args.price}`);
      return {
        tool: name,
        args: { product_id: p.id, price },
        summary: `💶 ${p.nome}: €${Number(p.prezzo).toFixed(2)} → €${price.toFixed(2)}?`,
      };
    }
    case 'stock_movement': {
      const art = await resolveArticolo(String(args.name ?? ''));
      const tipo = args.type === 'scarico' ? 'scarico' : 'carico';
      const qty = Number(String(args.quantity).replace(',', '.'));
      if (!(qty > 0)) throw new Error('Quantità non valida');
      const after = Number(art.quantita) + (tipo === 'carico' ? qty : -qty);
      if (after < 0) throw new Error(`Giacenza insufficiente: ${art.nome} ha ${art.quantita} ${art.unita_misura}`);
      const note = args.note ? String(args.note).trim() : '';
      return {
        tool: name,
        args: { articolo_id: art.id, tipo, quantita: qty, nota: note },
        summary: `📦 ${tipo === 'carico' ? 'Carico' : 'Scarico'} ${qty} ${art.unita_misura} di ${art.nome}\n` +
          `Giacenza: ${art.quantita} → ${after} ${art.unita_misura}` + (note ? `\n📝 ${note}` : ''),
      };
    }
    case 'set_shift': {
      const user = await resolveStaff(String(args.name ?? ''));
      const day = parseDay(args.date);
      const turno = args.shift === 'pranzo' ? 'pranzo' : 'sera';
      const on = !(args.on === false || args.on === 'false');
      return {
        tool: name,
        args: { user_id: user.id, data: toLocalISODate(day), turno, on },
        summary: `👤 ${on ? 'Mettere' : 'Togliere'} ${user.name} ${on ? 'in' : 'dal'} turno ${turno} ${formatDay(day)}?`,
      };
    }
    case 'add_reservation': {
      const nome = String(args.name ?? '').trim();
      if (!nome) throw new Error('Manca il nome del cliente');
      const persone = Math.round(Number(args.people));
      if (!(persone >= 1)) throw new Error('Manca il numero di persone');
      const day = parseDay(args.date);
      if (toLocalISODate(day) < toLocalISODate()) throw new Error('La data è nel passato');
      const ora = parseTime(args.time);
      const table = args.table_id ? await resolveTable(args.table_id) : null;
      const telefono = args.phone ? String(args.phone).replace(/[^\d+]/g, '') : null;
      const note = args.note ? String(args.note).trim() : '';
      const data = toLocalISODate(day);

      // Avviso se il tavolo ha già una prenotazione quel giorno
      let warning = '';
      if (table) {
        const { data: same } = await supabase.from('prenotazioni').select('nome, ora')
          .eq('tavolo_id', table.id).eq('data', data).eq('status', 'CONFERMATA');
        if (same?.length) warning = `\n⚠️ ${table.nome} è già prenotato quel giorno: ` + same.map(r => `${r.nome} ${String(r.ora).slice(0, 5)}`).join(', ');
      }
      return {
        tool: name,
        args: { nome, data, ora, persone, telefono, note, tavolo_id: table?.id ?? null },
        summary: `📅 Nuova prenotazione:\n• ${nome}, ${persone} pers.\n• ${formatDay(day)} alle ${ora}` +
          (table ? `\n• ${table.nome}` : '') + (telefono ? `\n• ☎️ ${telefono}` : '') + (note ? `\n• 📝 ${note}` : '') + warning,
      };
    }
    case 'cancel_reservation': {
      const r = await findReservation(String(args.name ?? ''), args.date);
      return {
        tool: name,
        args: { id: r.id, tavolo_id: r.tavolo_id, data: r.data },
        summary: `🗑️ Annullare la prenotazione di ${r.nome} (${r.persone} pers.) ${formatDay(parseDay(r.data))} alle ${String(r.ora).slice(0, 5)}?`,
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
    case 'get_daily_report': return dailyReport(args);
    case 'get_reservations': return getReservations(args);
    case 'get_stock': return getStock(args);
    case 'get_shifts': return getShifts(args);
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
    case 'add_reservation': return addReservation(args);
    case 'cancel_reservation': return cancelReservation(args);
    case 'set_price': return setPrice(args);
    case 'stock_movement': return stockMovement(args);
    case 'set_shift': return setShift(args);
    default: throw new Error(`Tool sconosciuto: ${tool}`);
  }
}

// ---------------------------------------------------------------------------
// Prenotazioni
// ---------------------------------------------------------------------------
type Prenotazione = { id: string; nome: string; data: string; ora: string; persone: number; telefono: string | null; tavolo_id: string | null; status: string; note: string | null };

async function findReservation(nome: string, date?: string): Promise<Prenotazione> {
  if (!nome.trim()) throw new Error('Manca il nome della prenotazione');
  let q = supabase.from('prenotazioni').select('*').eq('status', 'CONFERMATA').order('data').order('ora');
  q = date ? q.eq('data', toLocalISODate(parseDay(date))) : q.gte('data', toLocalISODate());
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const list = (data ?? []) as Prenotazione[];
  if (!list.length) throw new Error(date ? 'Nessuna prenotazione quel giorno' : 'Nessuna prenotazione futura');
  // Con più prenotazioni allo stesso nome prende la più vicina (lista ordinata per data/ora)
  const best = matchByName(list, nome, 'tra le prenotazioni');
  return list.find(r => norm(r.nome) === norm(best.nome)) ?? best;
}

async function getReservations(args: { date?: string }) {
  const day = parseDay(args.date);
  const { data, error } = await supabase.from('prenotazioni').select('*')
    .eq('data', toLocalISODate(day)).neq('status', 'ANNULLATA').order('ora');
  if (error) throw new Error(error.message);
  const { tavoli } = await getCatalog();
  const list = (data ?? []) as Prenotazione[];
  return {
    giorno: formatDay(day),
    prenotazioni: list.length,
    coperti: list.reduce((s, r) => s + (r.persone || 0), 0),
    elenco: list.map(r => ({
      ora: String(r.ora).slice(0, 5), nome: r.nome, persone: r.persone,
      tavolo: tavoli.find(t => t.id === r.tavolo_id)?.nome ?? null,
      arrivata: r.status === 'ARRIVATA', note: r.note || undefined,
    })),
  };
}

async function addReservation(a: { nome: string; data: string; ora: string; persone: number; telefono: string | null; note: string; tavolo_id: string | null }) {
  const { error } = await supabase.from('prenotazioni').insert({
    id: crypto.randomUUID(), nome: a.nome, data: a.data, ora: a.ora, persone: a.persone,
    telefono: a.telefono, note: a.note, tavolo_id: a.tavolo_id, status: 'CONFERMATA',
  });
  if (error) throw new Error(error.message);
  // Come TableMapView: il tavolo diventa PRENOTATO solo se la prenotazione è per oggi (e il tavolo è libero)
  if (a.tavolo_id && a.data === toLocalISODate()) {
    await supabase.from('tavoli').update({ status: 'PRENOTATO', clienti: a.persone }).eq('id', a.tavolo_id).eq('status', 'LIBERO');
    invalidateCatalog();
  }
  return `✅ Prenotazione salvata: ${a.nome}, ${a.persone} pers., ${formatDay(parseDay(a.data))} alle ${a.ora}`;
}

async function cancelReservation({ id, tavolo_id, data }: { id: string; tavolo_id: string | null; data: string }) {
  const { error } = await supabase.from('prenotazioni').update({ status: 'ANNULLATA' }).eq('id', id);
  if (error) throw new Error(error.message);
  if (tavolo_id && data === toLocalISODate()) {
    await supabase.from('tavoli').update({ status: 'LIBERO', clienti: 0 }).eq('id', tavolo_id).eq('status', 'PRENOTATO');
    invalidateCatalog();
  }
  return '✅ Prenotazione annullata';
}

async function tableById(id: string): Promise<Tavolo> {
  const { tavoli } = await getCatalog();
  const t = tavoli.find(x => x.id === id);
  if (!t) throw new Error('Tavolo non più esistente');
  return t;
}

async function addItems({ table_id, items }: { table_id: string; items: CartItem[] }) {
  const table = await tableById(table_id);
  const order = await openOrder(table.nome);
  // Righe già risolte e prezzate in prepareAction (quello che l'utente ha confermato)
  const carrello: CartItem[] = [...(order?.carrello ?? []), ...items];
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

  // Le righe inserite dal POS non salvano la categoria: la ricaviamo dal menu
  const { prodotti } = await getCatalog();
  const categoria = (i: CartItem) => i.categoria ?? prodotti.find(p => p.nome.toLowerCase() === i.nome.toLowerCase())?.categoria ?? '';
  const salaCats = ['Bevande', 'Dolce', 'Dolci', 'Caffè e Liquori'];
  const targetItems = order.carrello.filter(i => salaCats.includes(categoria(i)) === (type === 'sala'));
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

async function setAvailability({ table, id, available }: { table: 'prodotti' | 'ingredienti'; id: string; available: boolean }) {
  const { data, error } = await supabase
    .from(table).update({ disponibile: available }).eq('id', id).select('nome').single();
  if (error) throw new Error(error.message);
  invalidateCatalog();
  return `✅ ${data.nome} ora ${available ? 'disponibile' : 'NON disponibile'}`;
}

async function setPrice({ product_id, price }: { product_id: string; price: number }) {
  const { data, error } = await supabase
    .from('prodotti').update({ prezzo: price }).eq('id', product_id).select('nome').single();
  if (error) throw new Error(error.message);
  invalidateCatalog();
  return `✅ ${data.nome} ora costa €${price.toFixed(2)}`;
}

async function getTableStatus({ table_id }: { table_id?: string }) {
  if (!table_id || !String(table_id).trim()) {
    invalidateCatalog(); // stato tavoli sempre aggiornato
    const { tavoli } = await getCatalog();
    const byStatus = (st: string) => tavoli.filter(t => t.status === st).map(t => t.nome).sort((a, b) => a.localeCompare(b, 'it', { numeric: true }));
    const occupati = byStatus('OCCUPATO');
    return {
      totale_tavoli: tavoli.length,
      occupati, prenotati: byStatus('PRENOTATO'), liberi: byStatus('LIBERO').length,
      coperti_in_sala: tavoli.filter(t => t.status === 'OCCUPATO').reduce((s, t) => s + (t.clienti || 0), 0),
    };
  }
  const table = await resolveTable(table_id);
  const order = await openOrder(table.nome);
  return {
    tavolo: table.nome, stato: table.status, coperti: table.clienti, sala: table.sala,
    ordine: order
      ? { piatti: order.carrello.map(i => `${i.quantity}× ${i.nome}`), totale: order.totale, dalle: order.created_at }
      : null,
  };
}

async function dailyReport(args: { date?: string } = {}) {
  const day = parseDay(args.date);
  const next = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
  const { data: orders, error } = await supabase
    .from('ordini')
    .select('totale, carrello')
    .eq('status', 'COMPLETATO')
    .gte('created_at', day.toISOString())   // mezzanotte locale → UTC
    .lt('created_at', next.toISOString());
  if (error) throw new Error(error.message);

  const total = orders?.reduce((s, o) => s + (Number(o.totale) || 0), 0) ?? 0;
  const sold = new Map<string, number>();
  for (const o of orders ?? []) for (const i of (o.carrello ?? []) as CartItem[]) sold.set(i.nome, (sold.get(i.nome) ?? 0) + (i.quantity || 0));
  const top = [...sold].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([nome, q]) => `${q}× ${nome}`);
  return { giorno: formatDay(day), conti_chiusi: orders?.length ?? 0, incasso: `€${total.toFixed(2)}`, piu_venduti: top };
}

// ---------------------------------------------------------------------------
// Magazzino
// ---------------------------------------------------------------------------
type Articolo = { id: string; nome: string; categoria: string; unita_misura: string; quantita: number; soglia_minima: number };

async function fetchArticoli(): Promise<Articolo[]> {
  const { data, error } = await supabase.from('magazzino_articoli')
    .select('id, nome, categoria, unita_misura, quantita, soglia_minima').order('nome');
  if (error) throw new Error(error.message);
  return (data ?? []).map(a => ({ ...a, quantita: Number(a.quantita), soglia_minima: Number(a.soglia_minima) })) as Articolo[];
}

async function resolveArticolo(nome: string): Promise<Articolo> {
  return matchByName(await fetchArticoli(), nome, 'in magazzino');
}

async function getStock({ name }: { name?: string }) {
  if (name && name.trim()) {
    const a = await resolveArticolo(name);
    return { articolo: a.nome, giacenza: `${a.quantita} ${a.unita_misura}`, soglia_minima: a.soglia_minima, sotto_scorta: a.quantita <= a.soglia_minima };
  }
  const low = (await fetchArticoli()).filter(a => a.soglia_minima > 0 && a.quantita <= a.soglia_minima);
  return { sotto_scorta: low.length, articoli: low.map(a => `${a.nome}: ${a.quantita}/${a.soglia_minima} ${a.unita_misura}`) };
}

async function stockMovement(a: { articolo_id: string; tipo: 'carico' | 'scarico'; quantita: number; nota: string }) {
  // Stessa RPC usata dalla MagazzinoView (aggiorna giacenza + storico movimenti in modo atomico)
  const { error } = await supabase.rpc('magazzino_registra_movimento', {
    p_articolo_id: a.articolo_id, p_tipo: a.tipo, p_quantita: a.quantita, p_nota: a.nota, p_operatore: 'Telegram',
  });
  if (error) throw new Error(error.message);
  return `✅ ${a.tipo === 'carico' ? 'Carico' : 'Scarico'} registrato`;
}

// ---------------------------------------------------------------------------
// Turni
// ---------------------------------------------------------------------------
type Staff = { id: string; name: string; role: string };

async function fetchStaff(): Promise<Staff[]> {
  const { data, error } = await supabase.from('staff_users').select('id, name, role');
  if (error) throw new Error(error.message);
  return (data ?? []) as Staff[];
}

async function resolveStaff(nome: string): Promise<Staff> {
  const staff = await fetchStaff();
  return matchByName(staff.map(s => ({ ...s, nome: s.name })), nome, 'tra il personale');
}

async function getShifts({ date }: { date?: string }) {
  const day = parseDay(date);
  const [staff, turni] = await Promise.all([
    fetchStaff(),
    supabase.from('turni').select('user_id, turno').eq('data', toLocalISODate(day)),
  ]);
  if (turni.error) throw new Error(turni.error.message);
  const who = (t: string) => (turni.data ?? []).filter(r => r.turno === t)
    .map(r => staff.find(s => s.id === r.user_id)?.name ?? '?');
  return { giorno: formatDay(day), pranzo: who('pranzo'), sera: who('sera') };
}

async function setShift({ user_id, data, turno, on }: { user_id: string; data: string; turno: string; on: boolean }) {
  const { error } = on
    ? await supabase.from('turni').upsert({ user_id, data, turno })
    : await supabase.from('turni').delete().eq('user_id', user_id).eq('data', data).eq('turno', turno);
  if (error) throw new Error(error.message);
  return on ? '✅ Turno assegnato' : '✅ Turno rimosso';
}
