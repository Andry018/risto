import { useMemo, useRef, useState } from 'react';
import type { Product, CustomizedItem, Portata, Ingredient } from '../types/entities';
import { Search, SlidersHorizontal, Plus, Minus, Sandwich, UtensilsCrossed, X } from 'lucide-react';

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
  /** toglie un pezzo del prodotto (correzione di un tocco di troppo) */
  onRemoveOne?: (productId: string) => void;
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
  { value: '1', label: '1ª', on: 'bg-rose-500 text-white border-rose-500', off: 'text-rose-300 border-rose-500/30' },
  { value: '2', label: '2ª', on: 'bg-sky-500 text-white border-sky-500', off: 'text-sky-300 border-sky-500/30' },
  { value: '3', label: '3ª', on: 'bg-amber-500 text-black border-amber-500', off: 'text-amber-300 border-amber-500/30' },
  { value: '4', label: '4ª', on: 'bg-emerald-500 text-black border-emerald-500', off: 'text-emerald-300 border-emerald-500/30' },
  { value: '5', label: '5ª', on: 'bg-fuchsia-500 text-white border-fuchsia-500', off: 'text-fuchsia-300 border-fuchsia-500/30' },
] as const;

/** Etichetta di gruppo per un prodotto (Pizze Rosse/Bianche/Speciali → "Pizze"). */
function groupLabel(categoria: string): string {
  return CATEGORY_DEFS.find(d => d.match.includes(categoria))?.label ?? categoria;
}

function ProductRow({ product, count, flash, onAdd, onRemoveOne, onCustomize }: {
  product: Product;
  count: number;
  flash: boolean;
  onAdd: () => void;
  onRemoveOne?: () => void;
  onCustomize: () => void;
}) {
  return (
    <div
      className={`rounded-2xl border p-3 flex items-center gap-3 transition-colors duration-300 ${
        flash ? 'bg-gold/20 border-gold/60' : count > 0 ? 'bg-surface border-gold/30' : 'bg-surface border-surface-light'
      }`}
    >
      <button type="button" onClick={onAdd} className="flex-1 min-w-0 text-left active:opacity-70">
        <span className="block font-bold text-[17px] leading-snug text-white">{product.nome}</span>
        <span className="flex items-center gap-2 mt-0.5">
          <span className="text-[15px] font-black text-gold tabular-nums">€{product.prezzo.toFixed(2)}</span>
          {product.ingredienti?.length > 0 && (
            <span className="text-xs text-gray-400 truncate">{product.ingredienti.join(', ')}</span>
          )}
        </span>
      </button>

      <button
        type="button"
        onClick={onCustomize}
        aria-label={`Modifica ${product.nome}`}
        className="w-11 h-11 shrink-0 rounded-xl bg-charcoal border border-surface-light text-gray-400 flex items-center justify-center active:scale-90"
      >
        <SlidersHorizontal size={18} />
      </button>

      <div className={`shrink-0 flex items-center rounded-2xl ${count > 0 ? 'bg-charcoal border border-gold/40' : ''}`}>
        {count > 0 && onRemoveOne && (
          <>
            <button
              type="button"
              onClick={onRemoveOne}
              aria-label={`Togli un ${product.nome}`}
              className="w-11 h-14 flex items-center justify-center text-gray-300 active:scale-90"
            >
              <Minus size={20} />
            </button>
            <span className="min-w-7 text-center font-black text-lg text-gold tabular-nums">{count}</span>
          </>
        )}
        <button
          type="button"
          onClick={onAdd}
          aria-label={`Aggiungi ${product.nome}`}
          className="w-14 h-14 rounded-2xl bg-gold text-black flex items-center justify-center shadow-lg shadow-gold/10 active:scale-90 transition-transform"
        >
          <Plus size={28} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}

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
  onRemoveOne,
  onOpenCustomization,
  onOpenPaninoBuilder,
  onOpenCustomItem,
}: Props) {
  const [flashId, setFlashId] = useState<string | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const add = (product: Product) => {
    onAddToCart(product);
    // riscontro visivo: la riga si illumina un attimo
    setFlashId(product.id);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlashId(null), 350);
  };

  const filtered = useMemo(() => products.filter(p => {
    const q = searchQuery.trim().toLowerCase();
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

  /** Senza filtro né ricerca: lista divisa per categoria, nell'ordine del menu. */
  const groups = useMemo(() => {
    if (activeCategory || searchQuery.trim()) return [{ label: null as string | null, items: filtered }];
    const byLabel = new Map<string, Product[]>();
    for (const p of filtered) {
      const l = groupLabel(p.categoria);
      if (!byLabel.has(l)) byLabel.set(l, []);
      byLabel.get(l)!.push(p);
    }
    const order = categories.map(c => c.label);
    return [...byLabel.entries()]
      .sort(([a], [b]) => (order.indexOf(a) === -1 ? 999 : order.indexOf(a)) - (order.indexOf(b) === -1 ? 999 : order.indexOf(b)))
      .map(([label, items]) => ({ label: label as string | null, items }));
  }, [filtered, activeCategory, searchQuery, categories]);

  const countById = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of cart) m.set(c.id, (m.get(c.id) || 0) + c.quantity);
    return m;
  }, [cart]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-charcoal">
      {/* Uscita: un tocco per scegliere in quale uscita vanno i piatti che aggiungi */}
      <div className="px-3 pt-1 pb-2 shrink-0 flex items-center gap-2">
        <span className="text-xs font-bold text-gray-400 shrink-0">Uscita</span>
        <div className="flex gap-1.5 flex-1">
          {PORTATA_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onPortataChange(opt.value)}
              aria-pressed={currentPortata === opt.value}
              className={`flex-1 h-10 rounded-xl border font-black text-sm transition-all active:scale-95 ${currentPortata === opt.value ? opt.on : `bg-surface ${opt.off}`}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-3 pb-2 space-y-2 shrink-0 border-b border-surface-light/70">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="search"
              placeholder="Cerca piatto…"
              value={searchQuery}
              onChange={e => onSearchChange(e.target.value)}
              className="w-full bg-surface border border-surface-light rounded-xl py-2.5 pl-10 pr-10 text-white font-semibold outline-none focus:border-gold transition-colors text-[15px] [&::-webkit-search-cancel-button]:hidden"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-lg bg-charcoal text-gray-400 active:scale-90"
                aria-label="Cancella ricerca"
              >
                <X size={14} />
              </button>
            )}
          </div>
          {onOpenPaninoBuilder && (
            <button
              onClick={onOpenPaninoBuilder}
              aria-label="Componi panino"
              className="shrink-0 w-11 rounded-xl border border-gold/30 text-gold bg-gold/5 flex items-center justify-center active:scale-95"
            >
              <Sandwich size={18} />
            </button>
          )}
          {onOpenCustomItem && (
            <button
              onClick={onOpenCustomItem}
              aria-label="Piatto personalizzato"
              className="shrink-0 w-11 rounded-xl border border-emerald-400/30 text-emerald-300 bg-emerald-500/5 flex items-center justify-center active:scale-95"
            >
              <UtensilsCrossed size={18} />
            </button>
          )}
        </div>

        <div className="flex gap-1.5 overflow-x-auto hide-scrollbar -mx-3 px-3">
          {categories.map(def => (
            <button
              key={def.label}
              onClick={() => onCategoryChange(activeCategory === def.label ? null : def.label)}
              aria-pressed={activeCategory === def.label}
              className={`shrink-0 px-3.5 py-2 rounded-full font-bold text-[13px] border transition-colors ${
                activeCategory === def.label
                  ? 'bg-gold border-gold text-black'
                  : 'bg-surface border-surface-light text-gray-300'
              }`}
            >
              {def.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pt-2 pb-32">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <p className="font-bold">Nessun piatto trovato</p>
            <p className="text-sm mt-1">Controlla la ricerca o il filtro</p>
          </div>
        ) : (
          groups.map(group => (
            <section key={group.label ?? 'tutti'} className="mb-4">
              {group.label && (
                <h3 className="sticky top-0 z-10 -mx-3 px-4 py-1.5 bg-charcoal/95 backdrop-blur text-xs font-black uppercase tracking-wider text-gray-400">
                  {group.label}
                </h3>
              )}
              <div className="space-y-2">
                {group.items.map(product => (
                  <ProductRow
                    key={product.id}
                    product={product}
                    count={countById.get(product.id) || 0}
                    flash={flashId === product.id}
                    onAdd={() => add(product)}
                    onRemoveOne={onRemoveOne ? () => onRemoveOne(product.id) : undefined}
                    onCustomize={() => onOpenCustomization(product)}
                  />
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
