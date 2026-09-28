import { createClient } from '@supabase/supabase-js';
import { env } from '../config.js';

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

export async function executeTool(name: string, args: any): Promise<any> {
  switch (name) {
    case 'add_item_to_table': return addItem(args);
    case 'close_table': return closeTable(args);
    case 'print_order': return printOrder(args);
    case 'set_availability': return setAvailability(args);
    case 'get_table_status': return getTableStatus(args);
    case 'get_daily_report': return dailyReport(args);
    default: throw new Error(`Tool sconosciuto: ${name}`);
  }
}

async function addItem({ table_id, items }: { table_id: string; items: Array<{name: string; quantity: number; course?: string}> }) {
  const { data: table } = await supabase.from('tavoli').select('nome').eq('id', table_id).single();
  if (!table) throw new Error(`Tavolo ${table_id} non trovato`);
  
  const { data: order } = await supabase
    .from('ordini')
    .select('*')
    .eq('nome_cliente', table.nome)
    .eq('status', 'IN_ATTESA')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  let carrello = order?.carrello || [];
  let orderId = order?.id;
  
  for (const item of items) {
    const { data: product } = await supabase
      .from('prodotti')
      .select('*')
      .ilike('nome', item.name)
      .maybeSingle();
    
    if (!product) throw new Error(`Piatto "${item.name}" non trovato nel menu`);
    if (!product.disponibile) throw new Error(`${item.name} non disponibile`);
    
    carrello.push({
      nome: product.nome,
      quantity: item.quantity,
      prezzo_unitario: product.prezzo,
      portata: item.course || '1',
      modifiche: { aggiunte: [], rimozioni: [], note: '' }
    });
  }
  
  const totale = carrello.reduce((s: number, i: {prezzo_unitario: number; quantity: number}) => s + i.prezzo_unitario * i.quantity, 0);
  
  if (orderId) {
    await supabase.from('ordini').update({ carrello, totale }).eq('id', orderId);
  } else {
    const { data: newOrder } = await supabase.from('ordini').insert({
      nome_cliente: table.nome,
      status: 'IN_ATTESA',
      carrello,
      totale,
      orario_ritiro: new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
    }).select().single();
    orderId = newOrder?.id;
    await supabase.from('tavoli').update({ status: 'OCCUPATO' }).eq('id', table_id);
  }
  
  return { ok: true, orderId, items: items.length, message: `${items.length} piatti aggiunti al ${table.nome}` };
}

async function closeTable({ table_id }: { table_id: string }) {
  const { data: table } = await supabase.from('tavoli').select('nome').eq('id', table_id).single();
  if (!table) throw new Error(`Tavolo ${table_id} non trovato`);
  
  await supabase.from('ordini').update({ status: 'COMPLETATO' }).eq('nome_cliente', table.nome).eq('status', 'IN_ATTESA');
  await supabase.from('tavoli').update({ status: 'LIBERO', clienti: 0 }).eq('id', table_id);
  
  return { ok: true, message: `Conto chiuso, ${table.nome} liberato` };
}

async function printOrder({ table_id, type }: { table_id: string; type: 'kitchen' | 'sala' }) {
  const { data: table } = await supabase.from('tavoli').select('nome').eq('id', table_id).single();
  if (!table) throw new Error(`Tavolo ${table_id} non trovato`);
  
  const { data: order } = await supabase
    .from('ordini')
    .select('carrello')
    .eq('nome_cliente', table.nome)
    .eq('status', 'IN_ATTESA')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  if (!order) throw new Error('Nessun ordine aperto per questo tavolo');
  
  const salaCats = ['Bevande', 'Dolce', 'Dolci', 'Caffè e Liquori'];
  const items = order.carrello;
  const targetItems = type === 'kitchen' 
    ? items.filter((i: any) => !salaCats.includes(i.modifiche?.categoria || ''))
    : items.filter((i: any) => salaCats.includes(i.modifiche?.categoria || ''));
  
  if (targetItems.length === 0) return { ok: true, message: `Nessun piatto per ${type}` };
  
  const res = await fetch(`${env.PRINT_AGENT_URL}/print`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      kind: type === 'kitchen' ? 'kitchen' : 'sala',
      tableName: table.nome,
      items: targetItems.map((i: any) => ({
        nome: i.nome,
        quantity: i.quantity,
        addedIngredients: [],
        removedIngredients: [],
        notes: ''
      }))
    })
  });
  
  if (!res.ok) throw new Error(`Print agent error: ${res.status}`);
  
  return { ok: true, message: `Comanda ${type} inviata per ${table.nome}` };
}

async function setAvailability({ name, available }: { name: string; available: boolean }) {
  const { data: product } = await supabase
    .from('prodotti')
    .update({ disponibile: available })
    .ilike('nome', name)
    .select()
    .maybeSingle();
  
  if (!product) throw new Error(`Piatto "${name}" non trovato`);
  
  return { ok: true, message: `${name} ora ${available ? 'disponibile' : 'non disponibile'}` };
}

async function getTableStatus({ table_id }: { table_id: string }) {
  const { data: table } = await supabase.from('tavoli').select('*').eq('id', table_id).single();
  if (!table) throw new Error(`Tavolo ${table_id} non trovato`);
  
  const { data: order } = await supabase
    .from('ordini')
    .select('carrello, totale, created_at')
    .eq('nome_cliente', table.nome)
    .eq('status', 'IN_ATTESA')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  return {
    table: { id: table.id, nome: table.nome, status: table.status, clienti: table.clienti, sala: table.sala },
    order: order ? { items: order.carrello.length, totale: order.totale, since: order.created_at } : null
  };
}

async function dailyReport(_args: Record<string, never>) {
  const today = new Date().toISOString().split('T')[0];
  const { data: orders } = await supabase
    .from('ordini')
    .select('totale, carrello, created_at')
    .eq('status', 'COMPLETATO')
    .gte('created_at', `${today}T00:00:00`);
  
  const total = orders?.reduce((s: number, o: {totale?: number}) => s + (o.totale || 0), 0) || 0;
  const count = orders?.length || 0;
  const items = orders?.flatMap(o => o.carrello || []).length || 0;
  
  return {
    date: today,
    totalRevenue: total,
    totalOrders: count,
    totalItems: items,
    message: `Oggi: ${count} ordini, ${items} piatti, €${total.toFixed(2)} incasso`
  };
}

export { addItem, closeTable, printOrder, setAvailability, getTableStatus, dailyReport };