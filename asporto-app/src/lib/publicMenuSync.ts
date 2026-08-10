import { supabase } from './supabase';
import type { Product } from '../types/entities';

export async function publishMenu(publishUrl: string, publishSecret: string): Promise<{ ok: boolean; message: string }> {
  if (!publishUrl.trim()) return { ok: false, message: 'URL di pubblicazione non configurato.' };
  if (!publishSecret.trim()) return { ok: false, message: 'Chiave di pubblicazione non configurata.' };
  if (!supabase) return { ok: false, message: 'Database non disponibile.' };

  const { data, error } = await supabase.from('prodotti').select('*');
  if (error) return { ok: false, message: `Errore lettura menu: ${error.message}` };

  const prodotti = (data as Product[]) || [];

  try {
    const res = await fetch(publishUrl.trim(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-publish-secret': publishSecret.trim(),
      },
      body: JSON.stringify({ prodotti }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, message: body?.error || `Errore HTTP ${res.status}` };
    return { ok: true, message: `Menu pubblicato: ${body?.count ?? '?'} piatti online.` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Errore di rete durante la pubblicazione.' };
  }
}
