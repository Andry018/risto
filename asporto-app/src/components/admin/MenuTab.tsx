import { Plus, Edit2, Trash2, ToggleLeft, ToggleRight, Search, X } from 'lucide-react';
import type { Product } from '../../types/entities';
import CategoryFilterBar from '../CategoryFilterBar';

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
}

export default function MenuTab({
  products, allCategories, menuCategory, onMenuCategoryChange, menuSearch, onMenuSearchChange,
  canEditMenu, onNewProduct, onEditProduct, onDeleteProduct, onToggleAvailability,
  onCategoryRename, onCategoryDelete, onCategoryMoveUp, onCategoryMoveDown, onCategoryAdd,
}: MenuTabProps) {
  const productCard = (product: Product) => (
    <div key={product.id} className={`group relative ${'bg-surface border-surface-light hover:border-gold/30'} border rounded-2xl p-5 transition-all`}>
      <div className="flex justify-between items-start mb-4">
        <div>
          <h4 className={`font-bold text-white ${'group-hover:text-gold'} transition-colors uppercase text-sm`}>{product.nome}</h4>
          <p className={`${'text-gold'} font-black mt-1`}>€{product.prezzo.toFixed(2)}</p>
          {product.ingredienti.length > 0 && (
            <p className={`text-[10px] ${'text-gray-500'} mt-1.5`}>{product.ingredienti.join(', ')}</p>
          )}
        </div>
        {canEditMenu && (
        <div className="flex gap-2">
          <button onClick={() => onEditProduct(product)} className={`p-2 ${'bg-charcoal text-gray-500 hover:text-white'} rounded-lg`}><Edit2 size={16} /></button>
          <button onClick={() => onDeleteProduct(product.id)} className={`p-2 ${'bg-charcoal'} rounded-lg text-rose-500/50 hover:text-rose-500`}><Trash2 size={16} /></button>
        </div>
        )}
      </div>
      <div className={`flex items-center justify-between pt-4 border-t ${'border-surface-light/50'}`}>
        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${product.disponibile ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
          {product.disponibile ? 'Disponibile' : 'Esaurito'}
        </span>
        <button onClick={() => onToggleAvailability(product.id, product.disponibile)}
          className={`p-2.5 rounded-md transition-colors ${product.disponibile ? 'text-emerald-500' : 'text-slate-600'}`}>
          {product.disponibile ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
        </button>
      </div>
    </div>
  );

  return (
    <div className={`max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500`}>
      <header className="mb-8 flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">Gestione Menu</h2>
          <p className={'text-gray-500'}>Aggiungi o modifica i piatti della giornata.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <div className="relative w-full sm:w-64">
            <Search className={`absolute left-4 top-1/2 -translate-y-1/2 ${'text-gray-500'}`} size={18} />
            <input
              type="text"
              placeholder="Cerca piatto..."
              value={menuSearch}
              onChange={e => onMenuSearchChange(e.target.value)}
              className={`w-full ${'bg-charcoal border-surface-light focus:border-gold'} border rounded-2xl py-3 pl-12 pr-12 text-white font-bold outline-none transition-all text-sm`}
            />
            {menuSearch && (
              <button
                onClick={() => onMenuSearchChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-lg bg-surface border border-surface-light text-gray-400 hover:text-white active:scale-90 transition-all cursor-pointer"
                aria-label="Cancella ricerca"
              >
                <X size={14} />
              </button>
            )}
          </div>
          {canEditMenu && (
            <button
                onClick={onNewProduct}
                className={`${'bg-gold text-black'} font-bold py-3 px-6 rounded-2xl flex items-center gap-2 transition-all`}
            >
                <Plus size={20} /> Nuovo Piatto
            </button>
          )}
        </div>
      </header>

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

      <div className="space-y-12">
        {allCategories.filter(cat => !menuCategory || cat === menuCategory).map(cat => {
          const filteredProducts = products.filter(p =>
            p.categoria === cat &&
            p.nome.toLowerCase().includes(menuSearch.toLowerCase())
          );

          if (filteredProducts.length === 0 && menuSearch) return null;

          return (
            <section key={cat}>
              <h3 className={`text-sm font-black ${'text-gray-500'} uppercase tracking-[0.3em] mb-6 flex items-center gap-3`}>
                  <div className={`h-px ${'bg-surface-light'} flex-1`}></div>
                  {cat}
                  <div className={`h-px ${'bg-surface-light'} flex-1`}></div>
              </h3>
              {filteredProducts.some(p => p.sottocategoria) ? (
                (() => {
                  const subcats = [...new Set(filteredProducts.map(p => p.sottocategoria || 'Altro'))];
                  return subcats.map(sub => {
                    const subProducts = filteredProducts.filter(p => (p.sottocategoria || 'Altro') === sub);
                    return (
                      <div key={sub} className="mb-6">
                        <h4 className={`text-[10px] font-black ${'text-gray-500'} uppercase tracking-[0.3em] mb-4 ml-1`}>{sub}</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {subProducts.map(productCard)}
                        </div>
                      </div>
                    );
                  });
                })()
              ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredProducts.map(productCard)}
              </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
