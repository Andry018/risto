import { useEffect, useState } from 'react';
import { supabase, IS_DEMO_MODE } from '../lib/supabase';
import type { Order } from '../types/entities';
import { MOCK_ORDERS } from '../lib/MockData';

export function useOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchOrders() {
    if (IS_DEMO_MODE) {
      setOrders(MOCK_ORDERS);
      setLoading(false);
      return;
    }
    if (!supabase) { setLoading(false); return; }
    const { data } = await supabase.from('ordini').select('*').order('created_at', { ascending: false });
    if (data) setOrders(data);
    setLoading(false);
  }

  useEffect(() => {
    void fetchOrders();
    if (!supabase) return;
    const sb = supabase;
    const channel = sb.channel('public:ordini-hook')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ordini' }, () => void fetchOrders())
      .subscribe();
    return () => { sb.removeChannel(channel); };
  }, []);

  return { orders, loading, refetch: fetchOrders };
}
