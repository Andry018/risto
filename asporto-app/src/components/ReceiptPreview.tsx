import { type CustomizedItem, type Ingredient } from '../lib/supabase';
import { calculateItemPrice } from '../lib/priceUtils';
import { X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  customerName: string;
  pickupTime: string;
  items: CustomizedItem[];
  ingredients: Ingredient[];
  total: number;
  scontoTipo?: 'percentuale' | 'fisso';
  scontoValore?: number;
}

export default function ReceiptPreview({ isOpen, onClose, customerName, pickupTime, items, ingredients, total, scontoTipo, scontoValore }: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white text-black w-full max-w-sm rounded-sm p-8 font-mono shadow-[0_0_50px_rgba(255,255,255,0.1)] relative">
        <button onClick={onClose} className="absolute -top-12 right-0 text-white flex items-center gap-2 uppercase font-black text-xs tracking-widest">
          Chiudi <X size={18} />
        </button>

        <div className="mb-6 bg-black text-white p-6 rounded-sm text-center">
          <p className="text-xs font-bold uppercase tracking-[0.3em] opacity-70 mb-2">COMANDA / RICEVUTA</p>
          <p className="text-3xl font-black uppercase tracking-tighter">{customerName || 'N/A'}</p>
        </div>

        <div className="flex justify-between items-center mb-6 px-2 border-b-2 border-black pb-4">
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase">ORARIO</p>
            <p className="text-2xl font-black">{pickupTime || '--:--'}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold text-gray-500 uppercase">TOT. PIATTI</p>
            <p className="text-2xl font-black">{items.length}</p>
          </div>
        </div>

        <div className="space-y-4 mb-8">
          {items.map((item, idx) => (
            <div key={idx} className="border-b-2 border-dashed border-gray-200 pb-3">
              <div className="flex justify-between font-black text-sm leading-tight uppercase">
                <span>{item.quantity}x {item.nome}</span>
                <span>€{calculateItemPrice(item, ingredients).toFixed(2)}</span>
              </div>
              {item.removedIngredients.length > 0 && (
                <div className="text-[10px] font-bold text-gray-400 line-through ml-4 mt-1">
                  - NO {item.removedIngredients.join(', ').toUpperCase()}
                </div>
              )}
              {item.addedIngredients.length > 0 && (
                <div className="text-[10px] font-bold text-black ml-4 mt-1">
                  + {item.addedIngredients.map(a => a.nome.toUpperCase()).join(', ')}
                </div>
              )}
              {item.notes && (
                <div className="text-[10px] font-bold text-black ml-4 mt-1 border-t border-gray-100 pt-1">
                  NOTE: {item.notes.toUpperCase()}
                </div>
              )}
            </div>
          ))}
        </div>

        {scontoTipo && scontoValore && scontoValore > 0 && (
          <div className="border-t border-gray-200 pt-3 mb-3">
            <div className="flex justify-between items-center text-sm font-bold mb-1">
              <span className="text-gray-600">Subtotale</span>
              <span>
                €{(scontoTipo === 'percentuale'
                  ? (total / (1 - scontoValore / 100))
                  : (total + scontoValore)
                ).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm font-bold text-red-600">
              <span>Sconto {scontoTipo === 'percentuale' ? `${scontoValore}%` : ''}</span>
              <span>-€{(scontoTipo === 'percentuale'
                ? (total / (1 - scontoValore / 100)) * (scontoValore / 100)
                : scontoValore
              ).toFixed(2)}</span>
            </div>
          </div>
        )}

        <div className="border-t-2 border-black pt-4 mb-4">
          <div className="flex justify-between items-center text-xl font-black">
            <span>TOTALE</span>
            <span>€{total.toFixed(2)}</span>
          </div>
        </div>

        <div className="text-center opacity-40">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em]">{new Date().toLocaleString('it-IT')}</p>
        </div>
      </div>
    </div>
  );
}
