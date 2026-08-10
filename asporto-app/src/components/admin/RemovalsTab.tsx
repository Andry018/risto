import { Search, X } from 'lucide-react';
import type { Ingredient } from '../../types/entities';

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
  return (
    <div className="max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="mb-8 flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">Gestione Rimozioni</h2>
          <p className={'text-gray-500'}>Imposta lo sconto per la rimozione di ogni ingrediente.</p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className={`absolute left-4 top-1/2 -translate-y-1/2 ${'text-gray-500'}`} size={18} />
          <input
            type="text"
            placeholder="Cerca ingrediente..."
            value={ingredientSearch}
            onChange={e => onIngredientSearchChange(e.target.value)}
            className={`w-full ${'bg-charcoal border-surface-light focus:border-gold'} border rounded-2xl py-3 pl-12 pr-12 text-white font-bold outline-none transition-all text-sm`}
          />
          {ingredientSearch && (
            <button
              onClick={() => onIngredientSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-lg bg-surface border border-surface-light text-gray-400 hover:text-white active:scale-90 transition-all cursor-pointer"
              aria-label="Cancella ricerca"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {ingredients
            .filter(ing => ing.nome.toLowerCase().includes(ingredientSearch.toLowerCase()))
            .map(ing => (
            <div key={ing.id} className={`group relative ${'bg-surface border-surface-light hover:border-gold/30'} border rounded-2xl p-5 transition-all`}>
               <div className="flex justify-between items-start mb-4">
                  <div>
                      <h4 className={`font-bold text-white ${'group-hover:text-gold'} transition-colors uppercase text-sm`}>{ing.nome}</h4>
                      <p className="text-rose-400 font-black mt-1">-€{(ing.prezzo_rimozione || 0).toFixed(2)}</p>
                  </div>
               </div>

               <div className={`flex items-center justify-between pt-4 border-t ${'border-surface-light/50'}`}>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-black ${'text-gray-500'} uppercase`}>Riduzione</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={priceDrafts[ing.id] ?? (ing.prezzo_rimozione ?? 0).toFixed(2)}
                      onChange={e => canEditMenu && onPriceChange(ing.id, e.target.value)}
                      readOnly={!canEditMenu}
                      onBlur={e => canEditMenu && onPriceBlur(ing.id, e.target.value)}
                      className={`w-20 ${'bg-charcoal border-surface-light focus:border-gold'} border rounded-lg py-1.5 px-2 text-white font-bold text-xs text-center outline-none transition-all ${!canEditMenu ? 'opacity-60 cursor-not-allowed' : ''}`}
                    />
                    <span className={`text-[10px] font-black ${'text-gray-500'}`}>€</span>
                  </div>
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${ing.disponibile ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                      {ing.disponibile ? 'Disponibile' : 'Esaurito'}
                  </span>
               </div>
            </div>
          ))}
      </div>
    </div>
  );
}
