import { useEffect, useState } from 'react';
import { supabase, IS_DEMO_MODE } from '../lib/supabase';
import { MOCK_ORDERS } from '../lib/MockData';
import type { Order } from '../types/entities';
import { X, Clock, CheckCircle2 } from 'lucide-react';

interface Props {
  tableName: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function OrderHistoryModal({ tableName, isOpen, onClose }: Props) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      setLoading(true);
      if (IS_DEMO_MODE) {
        setOrders(MOCK_ORDERS.filter(o => o.nome_cliente === tableName));
        setLoading(false);
        return;
      }
      const sb = supabase;
      if (!sb) { setLoading(false); return; }
      const { data } = await sb
        .from('ordini')
        .select('*')
        .eq('nome_cliente', tableName)
        .order('created_at', { ascending: false })
        .limit(20);
      if (data) setOrders(data);
      setLoading(false);
    })();
  }, [isOpen, tableName]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-surface border border-surface-light w-full max-w-lg rounded-[40px] shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
        <div className="shrink-0 p-6 pb-4 border-b border-white/5 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black italic uppercase text-white">Storico Ordini</h2>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">{tableName}</p>
          </div>
          <button onClick={onClose} className="p-2 bg-charcoal rounded-xl text-gray-400 hover:text-white transition-all">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {loading ? (
            <p className="text-center text-gray-500 text-sm py-10">Caricamento...</p>
          ) : orders.length === 0 ? (
            <p className="text-center text-gray-500 text-sm py-10">Nessun ordine trovato</p>
          ) : orders.map(order => {
            const itemCount = (order.carrello || []).reduce((s, i) => s + (i.quantity || 1), 0);
            const total = (order.carrello || []).reduce((s, i) => s + (i.prezzo_unitario || 0) * (i.quantity || 1), 0);
            return (
              <div key={order.id} className="bg-charcoal border border-surface-light rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {order.status === 'COMPLETATO' ? (
                      <CheckCircle2 size={14} className="text-emerald-400" />
                    ) : (
                      <Clock size={14} className="text-amber-400" />
                    )}
                    <span className={`text-[10px] font-black uppercase tracking-widest ${order.status === 'COMPLETATO' ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {order.status}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-gray-500">
                    {new Date(order.created_at).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-xs font-bold text-white">{itemCount} piatto{(itemCount !== 1) ? 'i' : ''}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">
                      {(order.carrello || []).map(i => i.nome).join(', ')}
                    </p>
                  </div>
                  <p className="text-sm font-black text-white">€{total.toFixed(2)}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="shrink-0 p-6 pt-4 border-t border-white/5">
          <button onClick={onClose} className="w-full py-3 rounded-2xl bg-charcoal border border-surface-light text-white font-bold text-sm hover:bg-surface-light transition-all">
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}
