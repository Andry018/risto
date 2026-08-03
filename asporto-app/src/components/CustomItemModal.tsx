import { useState } from 'react';
import { X, Plus } from 'lucide-react';
import type { CustomizedItem, Portata } from '../types/entities';
import { newUniqueId } from '../lib/id';

interface Props {
  isOpen: boolean;
  currentPortata: Portata;
  onClose: () => void;
  onSave: (item: CustomizedItem) => void;
}

export default function CustomItemModal({ isOpen, currentPortata, onClose, onSave }: Props) {
  const [nome, setNome] = useState('');
  const [prezzo, setPrezzo] = useState('');

  if (!isOpen) return null;

  const handleSave = () => {
    const name = nome.trim();
    const price = parseFloat(prezzo.replace(',', '.'));
    if (!name || isNaN(price) || price < 0) return;
    onSave({
      id: `custom_${Date.now()}`,
      nome: name.toUpperCase(),
      prezzo: price,
      categoria: 'Personalizzato',
      disponibile: true,
      ingredienti: [],
      quantity: 1,
      addedIngredients: [],
      removedIngredients: [],
      notes: '',
      uniqueId: newUniqueId(),
      portata: currentPortata,
    });
    setNome('');
    setPrezzo('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[135] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl animate-in zoom-in duration-200">
      <div className="bg-surface border border-surface-light w-full max-w-sm rounded-[32px] shadow-2xl overflow-hidden">
        <div className="p-5">
          <div className="flex justify-between items-center mb-5">
            <div>
              <h2 className="text-lg font-black italic uppercase tracking-tighter text-white">Item <span className="text-gold">Personalizzato</span></h2>
              <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mt-0.5">
                Portata {currentPortata}ª attiva
              </p>
            </div>
            <button onClick={onClose} className="p-2 bg-charcoal rounded-xl text-gray-500 hover:text-white border border-surface-light">
              <X size={18} />
            </button>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">Nome</label>
              <input
                type="text"
                autoFocus
                placeholder="es. Tagliere del giorno"
                value={nome}
                onChange={e => setNome(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
                className="w-full bg-charcoal border border-surface-light rounded-xl p-3.5 text-base text-white font-bold outline-none focus:border-gold transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">Prezzo (€)</label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="es. 8.50"
                value={prezzo}
                onChange={e => setPrezzo(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
                className="w-full bg-charcoal border border-surface-light rounded-xl p-3.5 text-base text-white font-bold outline-none focus:border-gold transition-all"
              />
            </div>
          </div>
        </div>

        <div className="p-5 bg-charcoal/60 border-t border-surface-light">
          <button
            onClick={handleSave}
            disabled={!nome.trim() || isNaN(parseFloat(prezzo.replace(',', '.'))) || parseFloat(prezzo.replace(',', '.')) < 0}
            className="w-full bg-gold text-black font-black py-3.5 rounded-xl flex items-center justify-center gap-2 text-sm disabled:opacity-30 active:scale-[0.98] transition-all"
          >
            <Plus size={18} /> Aggiungi al conto
          </button>
        </div>
      </div>
    </div>
  );
}
