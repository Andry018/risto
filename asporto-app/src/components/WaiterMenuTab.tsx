import { useMemo } from 'react';
import type { Product, CustomizedItem, Portata, Ingredient } from '../types/entities';
import { Search, Edit3, Plus, Minus, Sandwich, UtensilsCrossed, X } from 'lucide-react';

interface Props {
  products: Product[];
  ingredients?: Ingredient[];
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
  onOpenCustomItem?: () => void;
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
const PORTATA_OPTIONS = [
  { value: '1', label: '1ª', color: 'text-rose-400 border-rose-500/30 bg-rose-500/10' },
  { value: '2', label: '2ª', color: 'text-sky-400 border-sky-500/30 bg-sky-500/10' },
  { value: '3', label: '3ª', color: 'text-amber-400 border-amber-500/30 bg-amber-500/10' },
  { value: '4', label: '4ª', color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' },
  { value: '5', label: '5ª', color: 'text-fuchsia-400 border-fuchsia-500/30 bg-fuchsia-500/10' },
] as const;

export default function WaiterMenuTab({
  products,
  ingredients = [],
  cart,
  searchQuery,
  activeCategory,
  currentPortata,
  onSearchChange,
  onCategoryChange,
  onPortataChange,
  onAddToCart,
  onOpenCustomization,
  onOpenPaninoBuilder,
  onOpenCustomItem,
}: Props) {
  const filtered = useMemo(() => products.filter(p => {
    const q = searchQuery.toLowerCase();
    if (q && !p.nome.toLowerCase().includes(q)) return false;

    if (activeCategory) {
      const def = CATEGORY_DEFS.find(d => d.label === activeCategory);
      if (def) {
        if (!def.match.includes(p.categoria)) return false;
      } else if (p.categoria !== activeCategory) {
        return false;
      }
    }

    const missingIngredients = (p.ingredienti || []).filter(ingName => {
      const ingredient = ingredients.find(i => i.nome.toLowerCase() === ingName.toLowerCase());
      return ingredient && !ingredient.disponibile;
    });

    return p.disponibile && missingIngredients.length === 0;
  }), [products, ingredients, searchQuery, activeCategory]);

  const categories = useMemo(() => {
    const coveredCats = new Set(CATEGORY_DEFS.flatMap(d => d.match));
    const extraCats = Array.from(new Set(products.map(p => p.categoria)))
      .filter(c => !coveredCats.has(c) && c !== 'EXTRA')
      .sort((a, b) => {
        const ai = CATEGORY_ORDER.indexOf(a);
        const bi = CATEGORY_ORDER.indexOf(b);
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      });
    return [...CATEGORY_DEFS, ...extraCats.map(c => ({ label: c, match: [c] }))]
      .filter(def => def.match.some(c => products.some(p => p.categoria === c && p.disponibile)));
  }, [products]);

  const cartCount = (id: string) => cart.filter(c => c.id === id).reduce((s, c) => s + c.quantity, 0);
  const activePortataMeta = PORTATA_OPTIONS.find(p => p.value === currentPortata) ?? PORTATA_OPTIONS[0];

  return (
    <div className="flex h-full min-h-0 flex-col bg-gradient-to-b from-charcoal via-charcoal to-surface">
      <div className="px-3 pt-3 pb-2 shrink-0 border-b border-surface-light/70 bg-surface/40 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.35em] text-gray-500">Waiter menu</p>
            <h3 className="text-lg font-black italic uppercase text-white leading-none mt-1">Selezione rapida</h3>
          </div>
          {onOpenPaninoBuilder && (
            <button
              onClick={onOpenPaninoBuilder}
              className="shrink-0 px-3 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest border border-dashed border-gold/30 text-gold/80 hover:text-gold hover:border-gold/60 active:scale-95 transition-all flex items-center gap-1.5 bg-gold/5"
            >
              <Sandwich size={14} /> PANINO
            </button>
          )}
          {onOpenCustomItem && (
            <button
              onClick={onOpenCustomItem}
              className="shrink-0 px-3 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest border border-dashed border-emerald-400/30 text-emerald-400/90 hover:text-emerald-300 hover:border-emerald-400/60 active:scale-95 transition-all flex items-center gap-1.5 bg-emerald-500/5"
            >
              <UtensilsCrossed size={14} /> PERSONALIZZATO
            </button>
          )}
        </div>

        <div className="mt-3 flex items-center gap-3">
          <span className="text-[10px] font-black uppercase tracking-[0.35em] text-gray-500">Portata</span>
          <div className="flex items-center gap-1 bg-charcoal border border-surface-light rounded-2xl p-1">
            <button
              type="button"
              onClick={() => {
                const idx = PORTATA_OPTIONS.findIndex(p => p.value === currentPortata);
                onPortataChange(PORTATA_OPTIONS[Math.max(idx - 1, 0)].value);
              }}
              disabled={currentPortata === PORTATA_OPTIONS[0].value}
              className="w-11 h-11 rounded-xl flex items-center justify-center text-gray-400 hover:text-white active:scale-90 transition-all disabled:opacity-20 disabled:pointer-events-none"
            >
              <Minus size={18} />
            </button>
            <span className={`min-w-[64px] text-center px-2 py-2 rounded-xl border text-sm font-black tracking-wider ${activePortataMeta.color} border-current`}>
              {activePortataMeta.label}
            </span>
            <button
              type="button"
              onClick={() => {
                const idx = PORTATA_OPTIONS.findIndex(p => p.value === currentPortata);
                onPortataChange(PORTATA_OPTIONS[Math.min(idx + 1, PORTATA_OPTIONS.length - 1)].value);
              }}
              disabled={currentPortata === PORTATA_OPTIONS[PORTATA_OPTIONS.length - 1].value}
              className="w-11 h-11 rounded-xl flex items-center justify-center text-gray-400 hover:text-white active:scale-90 transition-all disabled:opacity-20 disabled:pointer-events-none"
            >
              <Plus size={18} />
            </button>
          </div>
        </div>
      </div>

      <div className="px-3 py-3 space-y-2 shrink-0 bg-charcoal border-b border-surface-light/70">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
          <input
            type="text"
            placeholder="Cerca piatto..."
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            className="w-full bg-surface border border-surface-light rounded-2xl py-3 pl-10 pr-12 text-white font-bold outline-none focus:border-gold transition-all text-sm shadow-inner"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-lg bg-charcoal border border-surface-light text-gray-400 hover:text-white active:scale-90 transition-all cursor-pointer"
              aria-label="Cancella ricerca"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex gap-1.5 overflow-x-auto hide-scrollbar pb-1">
          {categories.map(def => (
            <button
              key={def.label}
              onClick={() => onCategoryChange(activeCategory === def.label ? null : def.label)}
              className={`shrink-0 px-4 py-2.5 rounded-2xl font-black text-[10px] uppercase tracking-[0.22em] border transition-all ${
                activeCategory === def.label
                  ? 'bg-gold border-gold text-black shadow-lg shadow-gold/20'
                  : 'bg-surface border-surface-light text-gray-500'
              }`}
            >
              {def.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3 pb-32">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-gray-500">
            <p className="italic text-lg">Nessun prodotto trovato</p>
            <p className="text-[10px] uppercase tracking-[0.3em] mt-2 text-gray-600">Controlla filtro o disponibilità</p>
          </div>
        ) : (
          filtered.map(product => {
            const count = cartCount(product.id);

            return (
              <div
                key={product.id}
                className="bg-gradient-to-br from-surface to-charcoal border border-surface-light rounded-[24px] p-4 flex items-center gap-3 transition-all shadow-lg shadow-black/10 active:scale-[0.99]"
              >
                <div className="flex-1 min-w-0" onClick={() => onAddToCart(product)}>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-xl leading-tight text-white">{product.nome}</h3>
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

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => onOpenCustomization(product)}
                    className="w-12 h-12 bg-charcoal text-gray-400 hover:text-gold rounded-xl flex items-center justify-center border border-surface-light active:scale-90"
                  >
                    <Edit3 size={20} />
                  </button>
                  <button
                    onClick={() => onAddToCart(product)}
                    className="w-16 h-16 bg-gold text-black rounded-2xl flex items-center justify-center shadow-xl active:scale-90"
                  >
                    <Plus size={30} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
