import { Plus, Edit2, Trash2 } from 'lucide-react';
import type { Ingredient } from '../../types/entities';
import { TabHeader, SearchField, AvailabilitySwitch, StatChip, EmptyState, priceInputClass } from './kitchenUi';

interface IngredientsTabProps {
  ingredients: Ingredient[];
  ingredientSearch: string;
  onIngredientSearchChange: (s: string) => void;
  canEditMenu: boolean;
  onNew: () => void;
  onEdit: (ing: Ingredient) => void;
  onDelete: (id: string) => void;
  onToggleAvailability: (id: string, current: boolean) => void;
  priceDrafts: Record<string, string>;
  onPriceChange: (id: string, value: string) => void;
  onPriceBlur: (id: string, value: string) => void;
}

export default function IngredientsTab({
  ingredients, ingredientSearch, onIngredientSearchChange, canEditMenu,
  onNew, onEdit, onDelete, onToggleAvailability, priceDrafts, onPriceChange, onPriceBlur,
}: IngredientsTabProps) {
  const search = ingredientSearch.trim().toLowerCase();
  const list = ingredients.filter(ing => ing.nome.toLowerCase().includes(search));
  const offCount = ingredients.filter(i => !i.disponibile).length;

  return (
    <div className="max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <TabHeader eyebrow="Cucina" title="Aggiunte" subtitle="Prezzo e disponibilità degli ingredienti extra.">
        <SearchField value={ingredientSearch} onChange={onIngredientSearchChange} placeholder="Cerca aggiunta..." />
        {canEditMenu && (
          <button
            onClick={onNew}
            className="bg-gold hover:bg-gold-hover text-black font-black py-3 px-5 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 whitespace-nowrap"
          >
            <Plus size={18} /> Nuova Aggiunta
          </button>
        )}
      </TabHeader>

      <div className="flex flex-wrap gap-2 mb-5">
        <StatChip value={ingredients.length} label="Aggiunte" tone="neutral" />
        <StatChip value={offCount} label="Esaurite" tone="off" />
      </div>

      {list.length === 0 ? (
        <EmptyState text="Nessuna aggiunta trovata" />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-3">
          {list.map(ing => {
            const off = !ing.disponibile;
            return (
              <div
                key={ing.id}
                className={`relative flex items-center gap-4 rounded-2xl border pl-5 pr-4 py-4 overflow-hidden transition-all ${
                  off ? 'bg-rose-500/[0.04] border-rose-500/25' : 'bg-surface border-surface-light hover:border-gold/30'
                }`}
              >
                <span className={`absolute left-0 top-0 bottom-0 w-1 ${off ? 'bg-rose-500' : 'bg-emerald-500/70'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className={`font-bold uppercase text-sm truncate ${off ? 'text-gray-400 line-through decoration-rose-500/60' : 'text-white'}`}>{ing.nome}</h4>
                    {canEditMenu && (
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => onEdit(ing)} aria-label={`Modifica ${ing.nome}`} className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-charcoal transition-colors"><Edit2 size={14} /></button>
                        <button onClick={() => onDelete(ing.id)} aria-label={`Elimina ${ing.nome}`} className="p-1.5 rounded-lg text-rose-500/60 hover:text-rose-400 hover:bg-charcoal transition-colors"><Trash2 size={14} /></button>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Prezzo €</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      aria-label={`Prezzo ${ing.nome}`}
                      value={priceDrafts[ing.id] ?? (ing.prezzo ?? 0).toFixed(2)}
                      onChange={e => canEditMenu && onPriceChange(ing.id, e.target.value)}
                      readOnly={!canEditMenu}
                      onBlur={e => canEditMenu && onPriceBlur(ing.id, e.target.value)}
                      className={`${priceInputClass} text-gold ${!canEditMenu ? 'opacity-60 cursor-not-allowed' : ''}`}
                    />
                  </div>
                </div>
                <AvailabilitySwitch on={ing.disponibile} onToggle={() => onToggleAvailability(ing.id, ing.disponibile)} label={ing.nome} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
