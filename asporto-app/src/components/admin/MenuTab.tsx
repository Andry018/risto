import { useState } from 'react';
import { Plus, Edit2, Trash2, EyeOff } from 'lucide-react';
import type { Product } from '../../types/entities';
import CategoryFilterBar from '../CategoryFilterBar';
import { TabHeader, SearchField, AvailabilitySwitch, StatChip, EmptyState } from './kitchenUi';

interface MenuTabProps {
  products: Product[];
  allCategories: string[];
  menuCategory: string | null;
  onMenuCategoryChange: (cat: string | null) => void;
  menuSearch: string;
  onMenuSearchChange: (s: string) => void;
  canEditMenu: boolean;
  onNewProduct: () => void;
  onEditProduct: (product: Product) => void;
  onDeleteProduct: (id: string) => void;
  onToggleAvailability: (id: string, current: boolean) => void;
  onCategoryRename: (oldName: string, newName: string) => void;
  onCategoryDelete: (cat: string) => void;
  onCategoryMoveUp: (cat: string) => void;
  onCategoryMoveDown: (cat: string) => void;
  onCategoryAdd: (name: string) => void;
  onMarkAllUnavailable: () => void;
}

type AvailFilter = 'all' | 'on' | 'off';

function ProductRow({ product, canEditMenu, onEdit, onDelete, onToggle }: {
  product: Product;
  canEditMenu: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}) {
  const off = !product.disponibile;
  return (
    <div
      className={`group relative flex items-center gap-4 rounded-2xl border pl-5 pr-4 py-4 transition-all overflow-hidden ${
        off
          ? 'bg-rose-500/[0.04] border-rose-500/25'
          : 'bg-surface border-surface-light hover:border-gold/30'
      }`}
    >
      <span className={`absolute left-0 top-0 bottom-0 w-1 ${off ? 'bg-rose-500' : 'bg-emerald-500/70'}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h4 className={`font-bold uppercase text-sm leading-tight ${off ? 'text-gray-400 line-through decoration-rose-500/60' : 'text-white'}`}>
            {product.nome}
          </h4>
          {off && (
            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-400">
              Esaurito
            </span>
          )}
        </div>
        {product.ingredienti.length > 0 && (
          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{product.ingredienti.join(', ')}</p>
        )}
        <div className="flex items-center gap-3 mt-2">
          <span className="text-gold font-black text-sm tabular-nums">€{product.prezzo.toFixed(2)}</span>
          {canEditMenu && (
            <div className="flex gap-1">
              <button onClick={onEdit} aria-label={`Modifica ${product.nome}`} className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-charcoal transition-colors">
                <Edit2 size={14} />
              </button>
              <button onClick={onDelete} aria-label={`Elimina ${product.nome}`} className="p-1.5 rounded-lg text-rose-500/60 hover:text-rose-400 hover:bg-charcoal transition-colors">
                <Trash2 size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
      <AvailabilitySwitch on={product.disponibile} onToggle={onToggle} label={product.nome} />
    </div>
  );
}

export default function MenuTab({
  products, allCategories, menuCategory, onMenuCategoryChange, menuSearch, onMenuSearchChange,
  canEditMenu, onNewProduct, onEditProduct, onDeleteProduct, onToggleAvailability,
  onCategoryRename, onCategoryDelete, onCategoryMoveUp, onCategoryMoveDown, onCategoryAdd,
  onMarkAllUnavailable,
}: MenuTabProps) {
  const [availFilter, setAvailFilter] = useState<AvailFilter>('all');
  const search = menuSearch.trim().toLowerCase();

  const inScope = products.filter(p => !menuCategory || p.categoria === menuCategory);
  const onCount = inScope.filter(p => p.disponibile).length;
  const offCount = inScope.length - onCount;

  const matches = (p: Product) =>
    p.nome.toLowerCase().includes(search) &&
    (availFilter === 'all' || (availFilter === 'on' ? p.disponibile : !p.disponibile));

  const renderGrid = (list: Product[]) => (
    <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-3">
      {list.map(product => (
        <ProductRow
          key={product.id}
          product={product}
          canEditMenu={canEditMenu}
          onEdit={() => onEditProduct(product)}
          onDelete={() => onDeleteProduct(product.id)}
          onToggle={() => onToggleAvailability(product.id, product.disponibile)}
        />
      ))}
    </div>
  );

  const sections = allCategories
    .filter(cat => !menuCategory || cat === menuCategory)
    .map(cat => ({ cat, list: products.filter(p => p.categoria === cat && matches(p)) }))
    .filter(s => s.list.length > 0 || (!search && availFilter === 'all'));

  return (
    <div className="max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <TabHeader eyebrow="Cucina" title="Disponibilità Menu" subtitle="Tocca l'interruttore per segnare un piatto come esaurito.">
        <SearchField value={menuSearch} onChange={onMenuSearchChange} placeholder="Cerca piatto..." />
        {canEditMenu && (
          <button
            onClick={onNewProduct}
            className="bg-gold hover:bg-gold-hover text-black font-black py-3 px-5 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 whitespace-nowrap"
          >
            <Plus size={18} /> Nuovo Piatto
          </button>
        )}
      </TabHeader>

      <div className="flex flex-wrap items-center gap-2 mb-5">
        <StatChip value={inScope.length} label="Tutti" tone="neutral" active={availFilter === 'all'} onClick={() => setAvailFilter('all')} />
        <StatChip value={onCount} label="Disponibili" tone="ok" active={availFilter === 'on'} onClick={() => setAvailFilter(f => f === 'on' ? 'all' : 'on')} />
        <StatChip value={offCount} label="Esauriti" tone="off" active={availFilter === 'off'} onClick={() => setAvailFilter(f => f === 'off' ? 'all' : 'off')} />
        <button
          onClick={onMarkAllUnavailable}
          className="sm:ml-auto bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 font-bold py-2.5 px-4 rounded-2xl flex items-center gap-2 transition-all active:scale-95 whitespace-nowrap text-sm"
          title="Segna tutto esaurito (escluse bevande)"
        >
          <EyeOff size={16} /> Tutto Esaurito
        </button>
      </div>

      <CategoryFilterBar
        readOnly={!canEditMenu}
        allCategories={allCategories}
        activeCategory={menuCategory}
        onCategoryChange={onMenuCategoryChange}
        onCategoryRename={onCategoryRename}
        onCategoryDelete={onCategoryDelete}
        onCategoryMoveUp={onCategoryMoveUp}
        onCategoryMoveDown={onCategoryMoveDown}
        onCategoryAdd={onCategoryAdd}
      />

      {sections.length === 0 ? (
        <EmptyState text={availFilter === 'off' ? 'Nessun piatto esaurito' : 'Nessun piatto trovato'} />
      ) : (
        <div className="space-y-10">
          {sections.map(({ cat, list }) => {
            const catOff = list.filter(p => !p.disponibile).length;
            const hasSubcats = list.some(p => p.sottocategoria);
            return (
              <section key={cat}>
                <div className="sticky top-0 z-10 -mx-1 px-1 py-2 mb-3 bg-charcoal/95 backdrop-blur flex items-center gap-3">
                  <h3 className="text-sm font-black text-white uppercase tracking-[0.2em]">{cat}</h3>
                  <span className="text-xs font-bold text-gray-500 tabular-nums">{list.length}</span>
                  {catOff > 0 && (
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-400">{catOff} esauriti</span>
                  )}
                  <div className="h-px bg-surface-light flex-1" />
                </div>
                {list.length === 0 ? (
                  <p className="text-sm text-gray-600 px-1">Nessun piatto in questa categoria.</p>
                ) : hasSubcats ? (
                  [...new Set(list.map(p => p.sottocategoria || 'Altro'))].map(sub => (
                    <div key={sub} className="mb-6 last:mb-0">
                      <h4 className="text-[11px] font-black text-gray-500 uppercase tracking-[0.2em] mb-3 ml-1">{sub}</h4>
                      {renderGrid(list.filter(p => (p.sottocategoria || 'Altro') === sub))}
                    </div>
                  ))
                ) : (
                  renderGrid(list)
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
