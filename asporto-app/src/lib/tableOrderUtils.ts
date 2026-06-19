import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Completa tutti gli ordini IN_ATTESA per un dato nome cliente/tavolo.
 */
async function completeOrdersForTableName(
  client: SupabaseClient,
  nomeCliente: string
): Promise<void> {
  await client
    .from('ordini')
    .update({ status: 'COMPLETATO' })
    .eq('nome_cliente', nomeCliente)
    .eq('status', 'IN_ATTESA');
}

/**
 * Libera il tavolo e completa tutti gli ordini IN_ATTESA associati.
 * I conti al tavolo usano `ordini.nome_cliente === tavoli.nome`.
 */
export async function releaseTableIfMatchesOrderName(
  client: SupabaseClient,
  nomeCliente: string
): Promise<void> {
  const trimmed = nomeCliente?.trim();
  if (!trimmed) return;

  const { data: tavolo } = await client
    .from('tavoli')
    .select('id')
    .eq('nome', trimmed)
    .maybeSingle();

  if (!tavolo) return;

  await Promise.all([
    client.from('tavoli').update({ status: 'LIBERO', clienti: 0 }).eq('id', tavolo.id),
    completeOrdersForTableName(client, trimmed),
  ]);
}

/** Completa l'ordine e, se era legato a un tavolo in sala, libera il tavolo e completa gli altri ordini per quel tavolo. */
export async function completeKitchenOrder(
  client: SupabaseClient,
  orderId: string
): Promise<void> {
  const { data: order } = await client
    .from('ordini')
    .select('nome_cliente')
    .eq('id', orderId)
    .maybeSingle();

  if (!order) return;

  await client.from('ordini').update({ status: 'COMPLETATO' }).eq('id', orderId);
  await releaseTableIfMatchesOrderName(client, order.nome_cliente);
}

/**
 * Helper per liberare un tavolo via ID — completa anche tutti gli ordini IN_ATTESA.
 * Versione per chiamate dirette (non OfflineSync) come TableMapView, ReportsView.
 */
export async function freeTableById(
  client: SupabaseClient,
  tableId: string
): Promise<{ nome: string } | null> {
  const { data: tavolo } = await client
    .from('tavoli')
    .select('nome')
    .eq('id', tableId)
    .maybeSingle();
  if (!tavolo) return null;

  await Promise.all([
    client.from('tavoli').update({ status: 'LIBERO', clienti: 0 }).eq('id', tableId),
    completeOrdersForTableName(client, tavolo.nome),
  ]);
  return tavolo;
}
