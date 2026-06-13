import { useEffect, useState } from 'react';
import { supabase, IS_DEMO_MODE } from '../lib/supabase';
import type { Ingredient } from '../types/entities';
import { MOCK_INGREDIENTS } from '../lib/MockData';

export function useIngredients() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchIngredients() {
    setError(null);
    if (IS_DEMO_MODE) {
      setIngredients(MOCK_INGREDIENTS);
      setLoading(false);
      return;
    }
    if (!supabase) { setLoading(false); return; }
    const { data, error: err } = await supabase.from('ingredienti').select('*').order('nome', { ascending: true });
    if (err) {
      setError(err.message);
    } else if (data) {
      setIngredients(data);
    }
    setLoading(false);
  }

  useEffect(() => {
    void fetchIngredients();
    if (!supabase) return;
    const sb = supabase;
    const channel = sb.channel('public:ingredienti-hook')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ingredienti' }, () => void fetchIngredients())
      .subscribe();
    return () => { sb.removeChannel(channel); };
  }, []);

  return { ingredients, loading, error, refetch: fetchIngredients };
}
