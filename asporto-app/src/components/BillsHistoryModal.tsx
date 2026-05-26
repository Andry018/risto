import { useEffect, useState } from 'react';
import { X, Receipt, Clock } from 'lucide-react';
import { supabase, IS_DEMO_MODE } from '../lib/supabase';
import type { Order } from '../types/entities';
import { MOCK_ORDERS } from '../lib/MockData';

type Props = {
  open: boolean;
  onClose: () => void;
  variant: 'day' | 'table' | 'suspended';
  /** Richiesto se variant === 'table' */
  tableName?: string | null;
  onSelect?: (order: Order) => void;
};

function startOfTodayISO(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export default function BillsHistoryModal({ open, onClose, variant, tableName, onSelect }: Props) {
  const [rows, setRows] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;

    async function load() {
      if (IS_DEMO_MODE) {
        // In demo mode, load suspended bills from MOCK_ORDERS
        const mockPending = MOCK_ORDERS.filter(o => o.status === 'IN_ATTESA');
        setRows(mockPending);
        return;
      }
      if (!supabase) {
        setRows([]);
        return;
      }
      setLoading(true);
      try {
        if (variant === 'suspended') {
          const { data } = await supabase
            .from('ordini')
            .select('*')
            .eq('status', 'IN_ATTESA')
            .order('created_at', { ascending: false });
          setRows((data as Order[]) || []);
        } else if (variant === 'day') {
          const { data } = await supabase
            .from('ordini')
            .select('*')
            .gte('created_at', startOfTodayISO())
            .in('status', ['COMPLETATO', 'IN_ATTESA'])
            .order('created_at', { ascending: false });
          setRows((data as Order[]) || []);
        } else {
          const name = tableName?.trim();
          if (!name) {
            setRows([]);
            return;
          }
          const { data } = await supabase
            .from('ordini')
            .select('*')
            .eq('nome_cliente', name)
            .in('status', ['COMPLETATO', 'IN_ATTESA'])
            .order('created_at', { ascending: false })
            .limit(80);
          setRows((data as Order[]) || []);
        }
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [open, variant, tableName]);

  if (!open) return null;

  const title =
    variant === 'day' ? (
      <>
        Conti di <span className="text-gold">oggi</span>
      </>
    ) : variant === 'table' ? (
      <>
        Storico <span className="text-gold">{tableName || 'tavolo'}</span>
      </>
    ) : (
      <>
        Conti in <span className="text-gold">sospeso</span>
      </>
    );

  const description =
    variant === 'day'
      ? 'Ordini registrati da mezzanotte (ora locale server)'
      : variant === 'table'
      ? 'Ultimi conti associati al nome tavolo'
      : 'Tutti i conti aperti e messi in sospeso (in attesa di pagamento)';

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6 bg-black/90 backdrop-blur-xl animate-in fade-in duration-200">
      <div className="bg-surface border border-surface-light w-full max-w-2xl rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[min(90dvh,900px)] animate-in zoom-in-95 duration-200">
        <div className="p-6 sm:p-8 border-b border-surface-light flex justify-between items-start gap-4 bg-surface-light/5 shrink-0">
          <div>
            <h2 className="text-2xl sm:text-3xl font-black italic uppercase tracking-tighter text-white flex items-center gap-3">
              <Receipt className="text-gold shrink-0" size={28} />
              {title}
            </h2>
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mt-2">
              {description}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-3 bg-charcoal rounded-2xl text-gray-500 hover:text-white border border-surface-light shrink-0 cursor-pointer"
            aria-label="Chiudi"
          >
            <X size={22} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-10 h-10 border-4 border-gold border-t-transparent rounded-full animate-spin" />
            </div>
          ) : rows.length === 0 ? (
            <p className="text-center text-gray-500 font-bold py-12 text-sm">Nessun conto trovato.</p>
          ) : (
            <ul className="space-y-3">
              {rows.map((o) => (
                <li
                  key={o.id}
                  className="bg-charcoal/80 border border-surface-light rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                          o.status === 'COMPLETATO' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                        }`}
                      >
                        {o.status === 'IN_ATTESA' ? 'IN SOSPESO' : o.status}
                      </span>
                      <span className="text-white font-black truncate">{o.nome_cliente}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-gray-500 font-bold mt-1">
                      <Clock size={12} />
                      {new Date(o.created_at).toLocaleString('it-IT', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {o.orario_ritiro ? ` · ${o.orario_ritiro}` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 ml-auto sm:ml-0 shrink-0">
                    <div className="text-right">
                      <p className="text-2xl font-black text-gold italic">€{Number(o.totale).toFixed(2)}</p>
                      <p className="text-[9px] font-black text-gray-600 uppercase">
                        {(o.carrello?.length ?? 0)} voci
                      </p>
                    </div>
                    {o.status === 'IN_ATTESA' && onSelect && (
                      <button
                        onClick={() => onSelect(o)}
                        className="px-4 py-2 bg-gold hover:bg-gold-hover text-black font-black text-xs rounded-xl transition active:scale-95 cursor-pointer uppercase tracking-wider"
                      >
                        Riprendi
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
