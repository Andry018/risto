import { useEffect, useState } from 'react';
import { supabase, type Product, IS_DEMO_MODE } from '../lib/supabase';
import { MOCK_PRODUCTS } from '../lib/MockData';

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchProducts() {
    if (IS_DEMO_MODE) {
      setProducts(MOCK_PRODUCTS);
      setLoading(false);
      return;
    }
    if (!supabase) { setLoading(false); return; }
    const { data } = await supabase.from('prodotti').select('*').order('categoria', { ascending: true }).order('nome', { ascending: true });
    if (data) setProducts(data);
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

  return { products, loading, refetch: fetchProducts };
}
