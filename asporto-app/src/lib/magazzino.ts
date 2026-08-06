import { supabase, IS_DEMO_MODE } from './supabase';
import type { MagazzinoArticolo, MagazzinoMovimento } from '../types/entities';

export interface FornitoreOption {
  id: string;
  nome: string;
}

export async function fetchArticoli(): Promise<MagazzinoArticolo[]> {
  if (IS_DEMO_MODE || !supabase) return [];
  const { data, error } = await supabase.from('magazzino_articoli').select('*').order('categoria').order('nome');
  if (error) {
    if (import.meta.env.DEV) console.error('Fetch articoli magazzino error:', error);
    return [];
  }
  return data as MagazzinoArticolo[];
}

export async function fetchFornitoriOptions(): Promise<FornitoreOption[]> {
  if (IS_DEMO_MODE || !supabase) return [];
  const { data, error } = await supabase.from('haccp_fornitori').select('id, nome').order('nome');
  if (error) {
    if (import.meta.env.DEV) console.error('Fetch fornitori error:', error);
    return [];
  }
  return data as FornitoreOption[];
}

export async function addArticolo(articolo: {
  nome: string;
  categoria: string;
  unita_misura: string;
  quantita: number;
  soglia_minima: number;
  costo_unitario?: number;
  fornitore_id?: string | null;
  note?: string;
}): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from('magazzino_articoli').insert([articolo]);
  if (error) {
    if (import.meta.env.DEV) console.error('Add articolo magazzino error:', error);
    return false;
  }
  return true;
}

export async function updateArticolo(id: string, updates: Partial<MagazzinoArticolo>): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from('magazzino_articoli').update(updates).eq('id', id);
  if (error) {
    if (import.meta.env.DEV) console.error('Update articolo magazzino error:', error);
    return false;
  }
  return true;
}

export async function deleteArticolo(id: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from('magazzino_articoli').delete().eq('id', id);
  if (error) {
    if (import.meta.env.DEV) console.error('Delete articolo magazzino error:', error);
    return false;
  }
  return true;
}

/** Registra un carico/scarico e aggiorna la quantità corrente in un'unica transazione lato DB. */
export async function registraMovimento(
  articoloId: string,
  tipo: 'carico' | 'scarico',
  quantita: number,
  nota = '',
  operatore = ''
): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.rpc('magazzino_registra_movimento', {
    p_articolo_id: articoloId,
    p_tipo: tipo,
    p_quantita: quantita,
    p_nota: nota,
    p_operatore: operatore,
  });
  if (error) {
    if (import.meta.env.DEV) console.error('Registra movimento magazzino error:', error);
    return false;
  }
  return true;
}

export async function fetchMovimentiRecenti(limit = 30): Promise<MagazzinoMovimento[]> {
  if (IS_DEMO_MODE || !supabase) return [];
  const { data, error } = await supabase
    .from('magazzino_movimenti')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    if (import.meta.env.DEV) console.error('Fetch movimenti magazzino error:', error);
    return [];
  }
  return data as MagazzinoMovimento[];
}
