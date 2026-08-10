import { X, Save } from 'lucide-react';
import type { Ingredient } from '../../types/entities';

interface IngredientFormModalProps {
  isOpen: boolean;
  editingIngredient: Partial<Ingredient> | null;
  newIngredient: Partial<Ingredient>;
  priceDraft: string;
  onClose: () => void;
  onEditingIngredientChange: (ing: Partial<Ingredient>) => void;
  onNewIngredientChange: (ing: Partial<Ingredient>) => void;
  onPriceDraftChange: (v: string) => void;
  onSave: () => void;
}

export default function IngredientFormModal({
  isOpen, editingIngredient, newIngredient, priceDraft, onClose,
  onEditingIngredientChange, onNewIngredientChange, onPriceDraftChange, onSave,
}: IngredientFormModalProps) {
  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-6 ${'bg-black/80'} backdrop-blur-md animate-in fade-in duration-200`}>
        <div className={`${'bg-surface border-surface-light'} border w-full max-w-lg rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200`}>
            <div className={`p-8 border-b ${'border-surface-light bg-surface-light/20'} flex justify-between items-center`}>
                <h3 className="text-2xl font-bold text-white italic uppercase tracking-tighter">
                    {editingIngredient ? 'Modifica' : 'Nuova'} <span className={'text-gold'}>Aggiunta</span>
                </h3>
                <button onClick={onClose} className={`p-2 ${'text-gray-500 hover:text-white'}`}><X size={24} /></button>
            </div>

            <div className="p-8 space-y-6">
                <div>
                    <label className={`block text-xs font-black ${'text-gray-500'} uppercase mb-2`}>Nome Aggiunta</label>
                    <input
                      type="text"
                      value={editingIngredient ? editingIngredient.nome : newIngredient.nome}
                      onChange={e => editingIngredient ? onEditingIngredientChange({ ...editingIngredient, nome: e.target.value }) : onNewIngredientChange({ ...newIngredient, nome: e.target.value })}
                      className={`w-full ${'bg-charcoal border-surface-light focus:border-gold'} border rounded-xl py-3 px-4 text-white outline-none`}
                      placeholder="Esempio: Mozzarella di Bufala"
                    />
                </div>

                <div>
                     <label className={`block text-xs font-black ${'text-gray-500'} uppercase mb-2`}>Prezzo Extra (€)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={priceDraft}
                      onChange={e => onPriceDraftChange(e.target.value)}
                      onBlur={e => {
                        const raw = e.target.value.replace(',', '.');
                        const val = parseFloat(raw);
                        if (!isNaN(val) && val >= 0) {
                          if (editingIngredient) onEditingIngredientChange({ ...editingIngredient, prezzo: val }); else onNewIngredientChange({ ...newIngredient, prezzo: val });
                          onPriceDraftChange(String(val));
                        } else {
                          onPriceDraftChange(String(editingIngredient?.prezzo ?? newIngredient.prezzo ?? 1.5));
                        }
                      }}
                      className={`w-full ${'bg-charcoal border-surface-light focus:border-gold'} border rounded-xl py-3 px-4 text-white outline-none`}
                    />
                </div>
            </div>

            <div className={`p-8 ${'bg-surface-light/20 border-surface-light'} border-t flex flex-col gap-3`}>
                <button
                  onClick={onSave}
                  className={`w-full ${'bg-gold text-black'} font-bold py-4 rounded-xl flex items-center justify-center gap-2`}
                >
                  <Save size={20} /> Salva Aggiunta
                </button>
            </div>
        </div>
    </div>
  );
}
