import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * I conti al tavolo usano `ordini.nome_cliente === tavoli.nome`.
 * Quando un ordine passa a COMPLETATO, se esiste un tavolo con quel nome lo liberiamo.
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

  await client
    .from('tavoli')
    .update({ status: 'LIBERO', clienti: 0 })
    .eq('id', tavolo.id);
}

/** Completa l'ordine e, se era legato a un tavolo in sala, libera il tavolo. */
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
