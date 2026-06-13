import { useEffect, useState } from 'react';
import { supabase, IS_DEMO_MODE } from '../lib/supabase';
import type { Tavolo } from '../types/entities';
import { MOCK_TABLES } from '../lib/MockData';

export function useTables() {
  const [tables, setTables] = useState<Tavolo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchTables() {
    setError(null);
    if (IS_DEMO_MODE) {
      setTables(MOCK_TABLES);
      setLoading(false);
      return;
    }
    if (!supabase) { setLoading(false); return; }
    const { data, error: err } = await supabase.from('tavoli').select('*').order('nome', { ascending: true });
    if (err) {
      setError(err.message);
    } else if (data) {
      setTables(data);
    }
    setLoading(false);
  }

  useEffect(() => {
    void fetchTables();
    if (!supabase) return;
    const sb = supabase;
    const channel = sb.channel('public:tavoli-hook')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tavoli' }, () => void fetchTables())
      .subscribe();
    return () => { sb.removeChannel(channel); };
  }, []);

  return { tables, loading, error, refetch: fetchTables };
}
