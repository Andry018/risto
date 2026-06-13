import { useEffect, useState } from 'react';
import { supabase, IS_DEMO_MODE } from '../lib/supabase';
import type { Product } from '../types/entities';
import { MOCK_PRODUCTS } from '../lib/MockData';

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchProducts() {
    setError(null);
    if (IS_DEMO_MODE) {
      setProducts(MOCK_PRODUCTS);
      setLoading(false);
      return;
    }
    if (!supabase) { setLoading(false); return; }
    const { data, error: err } = await supabase.from('prodotti').select('*').order('categoria', { ascending: true }).order('nome', { ascending: true });
    if (err) {
      setError(err.message);
    } else if (data) {
      setProducts(data);
    }
    setLoading(false);
  }

  useEffect(() => {
    void fetchProducts();
    if (!supabase) return;
    const sb = supabase;
    const channel = sb.channel('public:prodotti-hook')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prodotti' }, () => void fetchProducts())
      .subscribe();
    return () => { sb.removeChannel(channel); };
  }, []);

  return { products, loading, error, refetch: fetchProducts };
}
