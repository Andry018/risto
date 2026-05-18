import type { CustomizedItem } from '../types/entities';
import { PORTATE } from '../types/entities';
import { X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  customerName: string;
  pickupTime: string;
  items: CustomizedItem[];
  variant?: 'kitchen' | 'receipt';
}

const PORTATA_ORDER = ['0', '1', '2', '3', '4', 'B', 'D', 'C'];

function portataLabel(key: string): string {
  const p = PORTATE.find(p => p.value === key);
  return p?.label || key;
}

export default function ReceiptPreview({ isOpen, onClose, customerName, pickupTime, items, variant = 'kitchen' }: Props) {
  if (!isOpen) return null;

  const filteredItems = items.filter(i => i.nome !== 'COPERTO');
  const grouped = new Map<string, CustomizedItem[]>();
  for (const item of filteredItems) {
    const pk = item.portata || '0';
    if (!grouped.has(pk)) grouped.set(pk, []);
    grouped.get(pk)!.push(item);
  }
  const sortedGroups = [...grouped.entries()].sort(
    (a, b) => PORTATA_ORDER.indexOf(a[0]) - PORTATA_ORDER.indexOf(b[0])
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white text-black w-full max-w-sm rounded-sm p-6 font-mono shadow-[0_0_50px_rgba(255,255,255,0.1)] relative max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute -top-12 right-0 text-white flex items-center gap-2 uppercase font-black text-xs tracking-widest">
          Chiudi <X size={18} />
        </button>

        <div className="mb-4 bg-black text-white p-4 rounded-sm text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-70 mb-1">{variant === 'kitchen' ? 'COMMESSA IN CUCINA' : 'RICEVUTA'}</p>
          <p className="text-2xl font-black uppercase tracking-tighter">{customerName || 'N/A'}</p>
        </div>

        <div className="text-center mb-5 border-b-2 border-black pb-3">
          <p className="text-[10px] font-bold text-gray-500 uppercase">ORARIO USCITA</p>
          <p className="text-xl font-black">{pickupTime || '--:--'}</p>
        </div>

        <div className="space-y-5">
          {sortedGroups.map(([portata, groupItems]) => (
            <div key={portata}>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2 border-b border-dashed border-gray-200 pb-1">
                {portataLabel(portata)}
              </p>
              <div className="space-y-3">
                {groupItems.map((item, idx) => (
                  <div key={idx}>
                    <p className="font-black text-sm uppercase">{item.quantity}x {item.nome}</p>
                    {item.removedIngredients.length > 0 && item.removedIngredients.map((r, ri) => (
                      <p key={ri} className="text-[10px] font-bold text-gray-400 line-through ml-3">- NO {r.toUpperCase()}</p>
                    ))}
                    {item.addedIngredients.length > 0 && item.addedIngredients.map((a, ai) => (
                      <p key={ai} className="text-[10px] font-bold text-black ml-3">+ 1 {a.nome.toUpperCase()}</p>
                    ))}
                    {item.notes && (
                      <p className="text-[10px] font-bold italic ml-3 mt-0.5">※ {item.notes.toUpperCase()}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {filteredItems.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-8">Nessun piatto da preparare</p>
        )}

        <div className="text-center mt-6 pt-4 border-t-2 border-black">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-40">
            {new Date().toLocaleString('it-IT')}
          </p>
        </div>
      </div>
    </div>
  );
}
