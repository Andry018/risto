import { useEffect } from 'react';
import { supabase, IS_DEMO_MODE } from '../lib/supabase';

/**
 * Sottoscrive a cambiamenti Realtime su una tabella ed esegue il callback.
 * Se demo mode o supabase non disponibile, non fa nulla.
 */
export function useRealtimeChannel(table: string, callback: () => void, deps: unknown[] = []) {
  useEffect(() => {
    if (IS_DEMO_MODE || !supabase) return;
    const sb = supabase;
    const channelName = `realtime:${table}:${Math.random().toString(36).slice(2, 8)}`;
    const channel = sb.channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table }, () => callback())
      .subscribe();
    return () => { sb.removeChannel(channel); };
  }, deps);
}
