import type { Ingredient } from '../../types/entities';
import { TabHeader, SearchField, EmptyState, priceInputClass } from './kitchenUi';

interface RemovalsTabProps {
  ingredients: Ingredient[];
  ingredientSearch: string;
  onIngredientSearchChange: (s: string) => void;
  priceDrafts: Record<string, string>;
  onPriceChange: (id: string, value: string) => void;
  onPriceBlur: (id: string, value: string) => void;
  canEditMenu: boolean;
}

export default function RemovalsTab({
  ingredients, ingredientSearch, onIngredientSearchChange, priceDrafts, onPriceChange, onPriceBlur, canEditMenu,
}: RemovalsTabProps) {
  const search = ingredientSearch.trim().toLowerCase();
  const list = ingredients.filter(ing => ing.nome.toLowerCase().includes(search));

  return (
    <div className="max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <TabHeader eyebrow="Cucina" title="Rimozioni" subtitle="Sconto applicato quando un ingrediente viene tolto dal piatto.">
        <SearchField value={ingredientSearch} onChange={onIngredientSearchChange} placeholder="Cerca ingrediente..." />
      </TabHeader>

      {list.length === 0 ? (
        <EmptyState text="Nessun ingrediente trovato" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-3">
          {list.map(ing => (
            <div key={ing.id} className="flex items-center gap-4 rounded-2xl border bg-surface border-surface-light hover:border-gold/30 px-5 py-4 transition-all">
              <div className="flex-1 min-w-0">
                <h4 className="font-bold uppercase text-sm text-white truncate">{ing.nome}</h4>
                <span className={`inline-block mt-1.5 text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${ing.disponibile ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/15 text-rose-400'}`}>
                  {ing.disponibile ? 'Disponibile' : 'Esaurito'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-rose-400 font-black text-sm">−€</span>
                <input
                  type="text"
                  inputMode="decimal"
                  aria-label={`Sconto rimozione ${ing.nome}`}
                  value={priceDrafts[ing.id] ?? (ing.prezzo_rimozione ?? 0).toFixed(2)}
                  onChange={e => canEditMenu && onPriceChange(ing.id, e.target.value)}
                  readOnly={!canEditMenu}
                  onBlur={e => canEditMenu && onPriceBlur(ing.id, e.target.value)}
                  className={`${priceInputClass} text-white ${!canEditMenu ? 'opacity-60 cursor-not-allowed' : ''}`}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
