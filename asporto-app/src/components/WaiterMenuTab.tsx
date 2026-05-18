import type { Product, CustomizedItem, Portata } from '../types/entities';
import { PORTATE } from '../types/entities';
import { Search, Edit3, Plus, Sandwich } from 'lucide-react';

interface Props {
  products: Product[];
  cart: CustomizedItem[];
  searchQuery: string;
  activeCategory: string | null;
  currentPortata: Portata;
  onSearchChange: (q: string) => void;
  onCategoryChange: (cat: string | null) => void;
  onPortataChange: (p: Portata) => void;
  onAddToCart: (product: Product) => void;
  onOpenCustomization: (product: Product) => void;
  onOpenPaninoBuilder?: () => void;
}

const CATEGORY_DEFS: { label: string; match: string[] }[] = [
  { label: 'Antipasti', match: ['Antipasto', 'Antipasti'] },
  { label: 'Primi', match: ['Primo', 'Primi'] },
  { label: 'Secondi', match: ['Secondo', 'Secondi'] },
  { label: 'Contorni', match: ['Contorni'] },
  { label: 'Fritti', match: ['Fritti'] },
  { label: 'Pizze', match: ['Pizze Rosse', 'Pizze Bianche', 'Pizze Speciali'] },
  { label: 'Bevande', match: ['Bevande'] },
  { label: 'Dolci', match: ['Dolce', 'Dolci'] },
  { label: 'Caffè e Liquori', match: ['Caffè e Liquori'] },
  { label: 'Servizio', match: ['Servizio'] },
];

const CATEGORY_ORDER = ['Antipasti', 'Primi', 'Secondi', 'Contorni', 'Fritti', 'Pizze', 'Bevande', 'Dolci', 'Caffè e Liquori', 'Servizio'];

export default function WaiterMenuTab({ products, cart, searchQuery, activeCategory, currentPortata, onSearchChange, onCategoryChange, onPortataChange, onAddToCart, onOpenCustomization, onOpenPaninoBuilder }: Props) {
  const filtered = products.filter(p => {
    const q = searchQuery.toLowerCase();
    if (q && !p.nome.toLowerCase().includes(q)) return false;
    if (activeCategory) {
      const def = CATEGORY_DEFS.find(d => d.label === activeCategory);
      if (def) return def.match.includes(p.categoria);
      return p.categoria === activeCategory;
    }
    return true;
  });

  const coveredCats = new Set(CATEGORY_DEFS.flatMap(d => d.match));
  const extraCats = Array.from(new Set(products.map(p => p.categoria)))
    .filter(c => !coveredCats.has(c) && c !== 'EXTRA')
    .sort((a, b) => {
      const ai = CATEGORY_ORDER.indexOf(a);
      const bi = CATEGORY_ORDER.indexOf(b);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });
  const categories = [...CATEGORY_DEFS, ...extraCats.map(c => ({ label: c, match: [c] }))]
    .filter(def => def.match.some(c => products.some(p => p.categoria === c)));

  const cartCount = (id: string) => cart.filter(c => c.id === id).reduce((s, c) => s + c.quantity, 0);

  return (
    <>
      {/* Portata + Panino in un'unica riga */}
      <div className="flex items-center gap-1.5 overflow-x-auto px-3 pt-2 pb-1.5 hide-scrollbar shrink-0">
        {PORTATE.map(p => {
          const isActive = currentPortata === p.value;
          return (
            <button
              key={p.value}
              onClick={() => onPortataChange(p.value)}
              className={`shrink-0 px-3 py-2 rounded-xl font-black text-xs uppercase tracking-widest border-2 transition-all active:scale-95 ${
                isActive
                  ? `${p.color} border-current shadow-lg`
                  : 'bg-charcoal border-surface-light text-gray-500 hover:text-white'
              }`}
            >
              {p.label.substring(0, 2).trim()}
            </button>
          );
        })}
        {onOpenPaninoBuilder && (
          <button
            onClick={onOpenPaninoBuilder}
            className="shrink-0 ml-auto px-3 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest border-2 border-dashed border-gold/30 text-gold/80 hover:text-gold hover:border-gold/60 active:scale-95 transition-all flex items-center gap-1"
          >
            <Sandwich size={14} /> PANINO
          </button>
        )}
      </div>

      {/* Search + Category compatti */}
      <div className="px-3 pb-2 bg-charcoal space-y-2 shrink-0">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
          <input type="text" placeholder="Cerca..." value={searchQuery} onChange={e => onSearchChange(e.target.value)} className="w-full bg-surface border border-surface-light rounded-xl py-2.5 pl-10 text-white font-bold outline-none focus:border-gold transition-all text-sm" />
        </div>
        <div className="flex gap-1.5 overflow-x-auto hide-scrollbar">
          {categories.map(def => (
            <button key={def.label} onClick={() => onCategoryChange(activeCategory === def.label ? null : def.label)} className={`shrink-0 px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest border transition-all ${activeCategory === def.label ? 'bg-gold border-gold text-black' : 'bg-surface border-surface-light text-gray-500'}`}>{def.label}</button>
          ))}
        </div>
      </div>

      {/* Product grid */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 pb-32">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-gray-500 italic text-lg">Nessun prodotto trovato</div>
        ) : (
          filtered.map(product => {
            const isAvailable = product.disponibile;
            const count = cartCount(product.id);

            return (
              <div
                key={product.id}
                className={`bg-surface border rounded-2xl p-4 flex items-center gap-3 transition-all ${
                  isAvailable ? 'border-surface-light active:bg-surface-light/30' : 'border-red-500/20 opacity-50'
                }`}
              >
                {/* Tap area for quick add */}
                <div
                  className="flex-1 min-w-0"
                  onClick={() => isAvailable && onAddToCart(product)}
                >
                  <div className="flex items-center gap-2">
                    <h3 className={`font-bold text-xl leading-tight ${isAvailable ? 'text-white' : 'text-gray-500 line-through'}`}>
                      {product.nome}
                    </h3>
                    {count > 0 && (
                      <span className="shrink-0 bg-gold/20 text-gold text-xs font-black px-3 py-0.5 rounded-full border border-gold/30">
                        x{count}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-lg font-black text-gold">€{product.prezzo.toFixed(2)}</span>
                    <span className="text-[10px] font-black text-gray-600 uppercase">{product.categoria}</span>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => onOpenCustomization(product)}
                    className="w-12 h-12 bg-charcoal text-gray-400 hover:text-gold rounded-xl flex items-center justify-center border border-surface-light active:scale-90"
                  >
                    <Edit3 size={20} />
                  </button>
                  <button
                    onClick={() => isAvailable && onAddToCart(product)}
                    className="w-16 h-16 bg-gold text-black rounded-xl flex items-center justify-center shadow-xl active:scale-90 disabled:opacity-30"
                    disabled={!isAvailable}
                  >
                    <Plus size={30} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
