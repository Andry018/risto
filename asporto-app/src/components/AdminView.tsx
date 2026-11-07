import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { requireManagerPin, getCurrentUser } from '../lib/staffAuth';
import { supabase, IS_DEMO_MODE } from '../lib/supabase';
import type { Product, Ingredient } from '../types/entities';
import { MOCK_PRODUCTS, MOCK_INGREDIENTS } from '../lib/MockData';
import { getCategoryOrder, saveCategoryOrder } from '../lib/categoryUtils';
import { List, ChefHat, LayoutDashboard, Plus, Minus, SlidersHorizontal, ShieldCheck, Menu, X, Receipt, type LucideIcon } from 'lucide-react';
import { useConfirm } from './ConfirmModal';
import { useToast } from './Toast';
import ProductFormModal from './ProductFormModal';
import HaccpView from './HaccpView';
import CassaFiscaleTab from './admin/CassaFiscaleTab';
import MenuTab from './admin/MenuTab';
import IngredientsTab from './admin/IngredientsTab';
import RemovalsTab from './admin/RemovalsTab';
import VariantsTab from './admin/VariantsTab';
import IngredientFormModal from './admin/IngredientFormModal';

type KitchenTab = 'menu' | 'ingredients' | 'removals' | 'variants' | 'haccp' | 'cassa';

const NAV_GROUPS: { title: string; items: { tab: KitchenTab; label: string; hint: string; Icon: LucideIcon }[] }[] = [
  {
    title: 'Menu',
    items: [
      { tab: 'menu', label: 'Disponibilità Menu', hint: 'Piatti ed esauriti', Icon: List },
      { tab: 'ingredients', label: 'Aggiunte', hint: 'Extra e prezzi', Icon: Plus },
      { tab: 'removals', label: 'Rimozioni', hint: 'Sconti ingredienti', Icon: Minus },
      { tab: 'variants', label: 'Varianti', hint: 'Opzioni dei piatti', Icon: SlidersHorizontal },
    ],
  },
  {
    title: 'Strumenti',
    items: [
      { tab: 'haccp', label: 'HACCP Etichette', hint: 'Lotti e stampa', Icon: ShieldCheck },
      { tab: 'cassa', label: 'Cassa Fiscale', hint: 'Chiusure e pagamenti', Icon: Receipt },
    ],
  },
];

function KitchenBrand() {
  return (
    <div className="flex items-center gap-3">
      <div className="bg-gold p-2.5 rounded-2xl shadow-lg shadow-gold/20">
        <ChefHat size={24} className="text-black" />
      </div>
      <div className="leading-tight">
        <h1 className="text-xl font-black tracking-tight text-white">Kitchen<span className="text-gold">Hub</span></h1>
        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-gray-500">Il Girasole</p>
      </div>
    </div>
  );
}

function HomeLink({ onNavigateHome, onDone }: { onNavigateHome?: () => void; onDone?: () => void }) {
  const cls = 'w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-charcoal border border-surface-light text-gray-300 hover:text-white hover:border-gold/30 transition-all font-semibold text-sm';
  if (onNavigateHome) {
    return (
      <button onClick={() => { onDone?.(); onNavigateHome(); }} className={cls}>
        <LayoutDashboard size={18} className="text-gold" /> Dashboard
      </button>
    );
  }
  return (
    <Link to="/" onClick={onDone} className={cls}>
      <LayoutDashboard size={18} className="text-gold" /> Dashboard
    </Link>
  );
}

function KitchenNav({ activeTab, badges, onSelect }: {
  activeTab: KitchenTab;
  badges: Partial<Record<KitchenTab, number>>;
  onSelect: (tab: KitchenTab) => void;
}) {
  return (
    <nav className="flex flex-col gap-6">
      {NAV_GROUPS.map(group => (
        <div key={group.title}>
          <p className="px-3 mb-2 text-[10px] font-black uppercase tracking-[0.25em] text-gray-500">{group.title}</p>
          <div className="flex flex-col gap-1">
            {group.items.map(({ tab, label, hint, Icon }) => {
              const active = activeTab === tab;
              const badge = badges[tab] ?? 0;
              return (
                <button
                  key={tab}
                  onClick={() => onSelect(tab)}
                  aria-current={active ? 'page' : undefined}
                  className={`relative w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-left transition-all ${
                    active ? 'bg-gold/10 text-white' : 'text-gray-400 hover:bg-charcoal hover:text-white'
                  }`}
                >
                  {active && <span className="absolute left-0 top-2 bottom-2 w-1 rounded-full bg-gold" />}
                  <span className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${active ? 'bg-gold text-black' : 'bg-charcoal text-gray-400'}`}>
                    <Icon size={18} />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-bold truncate">{label}</span>
                    <span className="block text-[11px] text-gray-500 truncate">{hint}</span>
                  </span>
                  {badge > 0 && (
                    <span className="shrink-0 min-w-6 h-6 px-1.5 rounded-full bg-rose-500/15 text-rose-400 text-[11px] font-black flex items-center justify-center tabular-nums" title="Esauriti">
                      {badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

function SidebarFooter({ userName, outOfStock }: { userName?: string; outOfStock: number }) {
  return (
    <div className="m-4 p-4 rounded-2xl bg-charcoal border border-surface-light">
      <div className="flex items-center gap-2">
        <span className="relative flex w-2 h-2">
          <span className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-60" />
          <span className="relative w-2 h-2 rounded-full bg-emerald-500" />
        </span>
        <span className="text-xs font-bold text-emerald-400">Sistema online</span>
      </div>
      {userName && <p className="text-sm font-bold text-white mt-2 truncate">{userName}</p>}
      <p className="text-xs text-gray-500 mt-0.5">
        {outOfStock > 0 ? `${outOfStock} piatt${outOfStock === 1 ? 'o' : 'i'} esaurit${outOfStock === 1 ? 'o' : 'i'}` : 'Tutto il menu disponibile'}
      </p>
    </div>
  );
}

interface AdminViewProps {
  onNavigateHome?: () => void;
}

export default function AdminView({ onNavigateHome }: AdminViewProps = {}) {
  const { confirm } = useConfirm();
  const { addToast } = useToast();
  /** Il ruolo kitchen può solo togliere/rimettere disponibilità: niente aggiunta, modifica o eliminazione di piatti/aggiunte/varianti. */
  const canEditMenu = getCurrentUser()?.role !== 'kitchen';
  const [searchParams, setSearchParams] = useSearchParams();
  const [menuOpen, setMenuOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);

  const tabFromUrl = searchParams.get('tab') as 'menu' | 'ingredients' | 'removals' | 'variants' | 'haccp' | 'cassa' | null;
  const validTabs = ['menu', 'ingredients', 'removals', 'variants', 'haccp', 'cassa'] as const;
  const [activeTab, setActiveTab] = useState<'menu' | 'ingredients' | 'removals' | 'variants' | 'haccp' | 'cassa'>(
    tabFromUrl && validTabs.includes(tabFromUrl) ? tabFromUrl : 'menu'
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [newProduct, setNewProduct] = useState<Partial<Product>>({
    nome: '',
    prezzo: 0,
    categoria: 'Antipasti',
    sottocategoria: '',
    disponibile: true,
    ingredienti: []
  });
  const [editingIngredient, setEditingIngredient] = useState<Partial<Ingredient> | null>(null);
  const [newIngredient, setNewIngredient] = useState<Partial<Ingredient>>({
    nome: '',
    prezzo: 1.5,
    prezzo_rimozione: 0,
    disponibile: true
  });

  const [productPriceDraft, setProductPriceDraft] = useState('0');
  const [ingredientPriceDraft, setIngredientPriceDraft] = useState('1.5');
  const [removalPriceDrafts, setRemovalPriceDrafts] = useState<Record<string, string>>({});
  const [additionPriceDrafts, setAdditionPriceDrafts] = useState<Record<string, string>>({});
  const [menuSearch, setMenuSearch] = useState('');
  const CATEGORY_STORAGE_KEY = 'risto_extra_categories';
  const [menuCategory, setMenuCategory] = useState<string | null>(null);
  const [extraCategories, setExtraCategories] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(CATEGORY_STORAGE_KEY) || '[]'); } catch { return []; }
  });
  const persistExtraCat = (cats: string[]) => {
    setExtraCategories(cats);
    localStorage.setItem(CATEGORY_STORAGE_KEY, JSON.stringify(cats));
    const currentOrder = getCategoryOrder();
    const menuCats = [...new Set(products.map(p => p.categoria).filter(Boolean))];
    const keep = new Set([...menuCats, ...cats, 'EXTRA']);
    const newOrder = currentOrder.filter(c => keep.has(c));
    cats.forEach(c => { if (!newOrder.includes(c)) newOrder.push(c); });
    setCategoryOrderState(newOrder);
    saveCategoryOrder(newOrder);
  };
  const [categoryOrder, setCategoryOrderState] = useState<string[]>(() => {
    const order = getCategoryOrder();
    // Ensure all products' categories are in the order
    const prodCats = [...new Set(products.map(p => p.categoria).filter(Boolean))];
    const missing = prodCats.filter(c => !order.includes(c));
    if (missing.length > 0) {
      const merged = [...order, ...missing];
      saveCategoryOrder(merged);
      return merged;
    }
    return order;
  });
  const menuCategories = [...new Set(products.map(p => p.categoria).filter(Boolean))];
  // Use categoryOrder for sorting, then append any extras not in the order
  const allCategories = (() => {
    const cats = [...new Set([...menuCategories, ...extraCategories])];
    const ordered = categoryOrder.filter(c => cats.includes(c));
    const unordered = cats.filter(c => !ordered.includes(c));
    // Move EXTRA to the very end
    const extraIdx = unordered.indexOf('EXTRA');
    if (extraIdx > -1) { unordered.splice(extraIdx, 1); unordered.push('EXTRA'); }
    return [...ordered, ...unordered.sort()];
  })();
  const [ingredientSearch, setIngredientSearch] = useState('');
  const [isIngredientsModalOpen, setIsIngredientsModalOpen] = useState(false);

  useEffect(() => {
    setSearchParams({ tab: activeTab }, { replace: true });
  }, [activeTab]);

  useEffect(() => {
    const urlTab = searchParams.get('tab') as 'menu' | 'ingredients' | 'removals' | 'variants' | 'cassa' | null;
    if (urlTab && validTabs.includes(urlTab) && urlTab !== activeTab) {
      setActiveTab(urlTab);
    }
  }, [searchParams]);

  useEffect(() => {
    if (isModalOpen) {
      const val = editingProduct?.prezzo ?? newProduct.prezzo ?? 0;
      setProductPriceDraft(String(val));
    }
  }, [isModalOpen]);

  useEffect(() => {
    if (isIngredientsModalOpen) {
      const val = editingIngredient?.prezzo ?? newIngredient.prezzo ?? 1.5;
      setIngredientPriceDraft(String(val));
    }
  }, [isIngredientsModalOpen]);

  async function fetchProducts() {
    if (!supabase) return;
    const { data } = await supabase.from('prodotti').select('*').order('categoria', { ascending: true }).order('nome', { ascending: true });
    if (data) setProducts(data);
  }

  async function fetchIngredients() {
    if (!supabase) return;
    const { data } = await supabase.from('ingredienti').select('*').order('nome', { ascending: true });
    if (data) setIngredients(data);
  }

  useEffect(() => {
    if (IS_DEMO_MODE) {
      setProducts(MOCK_PRODUCTS);
      setIngredients(MOCK_INGREDIENTS);
      return;
    }
    if (!supabase) return;
    const sb = supabase;
    void fetchProducts();
    void fetchIngredients();

    const productsChannel = sb
      .channel('public:prodotti-admin')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'prodotti' }, (payload: { new: Record<string, unknown> }) => {
        const row = payload.new as Pick<Product, 'id' | 'disponibile'>;
        setProducts(current => current.map(p => p.id === row.id ? { ...p, disponibile: row.disponibile } : p));
      })
      .subscribe();

    const ingredientsChannel = sb
      .channel('public:ingredienti-admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ingredienti' }, () => void fetchIngredients())
      .subscribe();

    return () => {
      sb.removeChannel(productsChannel);
      sb.removeChannel(ingredientsChannel);
    };
  }, []);

  const toggleAvailability = async (id: string, currentStatus: boolean) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, disponibile: !currentStatus } : p));
    if (!supabase) return;
    const { error } = await supabase.from('prodotti').update({ disponibile: !currentStatus }).eq('id', id);
    if (error) {
      addToast({ type: 'error', title: 'Errore', message: 'Impossibile aggiornare la disponibilità del prodotto.' });
      fetchProducts();
    }
  };

  const DRINK_CATEGORIES = ['Bevande', 'Caffè e Liquori'];

  const markAllUnavailableExceptDrinks = async () => {
    if (!supabase) return;
    const toDisable = products.filter(p => !DRINK_CATEGORIES.includes(p.categoria) && p.disponibile);
    if (toDisable.length === 0) {
      addToast({ type: 'success', title: 'Già fatto', message: 'Tutti i piatti sono già non disponibili.' });
      return;
    }
    setProducts(prev => prev.map(p => DRINK_CATEGORIES.includes(p.categoria) ? p : { ...p, disponibile: false }));
    const ids = toDisable.map(p => p.id);
    const { error } = await supabase.from('prodotti').update({ disponibile: false }).in('id', ids);
    if (error) {
      addToast({ type: 'error', title: 'Errore', message: 'Impossibile aggiornare la disponibilità.' });
      fetchProducts();
    } else {
      addToast({ type: 'success', title: 'Fatto', message: `${toDisable.length} piatti impostati come non disponibili.` });
    }
  };

  const toggleIngredientAvailability = async (id: string, currentStatus: boolean) => {
    setIngredients(prev => prev.map(i => i.id === id ? { ...i, disponibile: !currentStatus } : i));
    if (!supabase) return;
    const { error } = await supabase.from('ingredienti').update({ disponibile: !currentStatus }).eq('id', id);
    if (error) addToast({ type: 'error', title: 'Errore', message: 'Impossibile aggiornare la disponibilità dell\'ingrediente.' });
    fetchIngredients();
  };

  const handleSaveProduct = async () => {
    if (!supabase || !canEditMenu) return;
    const productData = editingProduct || newProduct;
    if (!productData.nome || productData.prezzo === undefined || productData.prezzo === null) return;

    const { error } = editingProduct && editingProduct.id
      ? await supabase.from('prodotti').update(productData).eq('id', editingProduct.id)
      : await supabase.from('prodotti').insert([productData]);

    if (error) {
      addToast({ type: 'error', title: 'Errore', message: 'Salvataggio prodotto fallito. Riprova.' });
      return;
    }

    setIsModalOpen(false);
    setEditingProduct(null);
    setNewProduct({ nome: '', prezzo: 0, categoria: 'Antipasti', sottocategoria: '', disponibile: true, ingredienti: [] });
    fetchProducts();
  };

  const handleSaveIngredient = async () => {
    if (!supabase || !canEditMenu) return;
    const ingData = editingIngredient || newIngredient;
    if (!ingData.nome) return;

    const { error } = editingIngredient && editingIngredient.id
      ? await supabase.from('ingredienti').update(ingData).eq('id', editingIngredient.id)
      : await supabase.from('ingredienti').insert([ingData]);

    if (error) {
      addToast({ type: 'error', title: 'Errore', message: 'Salvataggio ingrediente fallito. Riprova.' });
      return;
    }

    setIsIngredientsModalOpen(false);
    setEditingIngredient(null);
    setNewIngredient({ nome: '', prezzo: 1.5, prezzo_rimozione: 0, disponibile: true });
    fetchIngredients();
  };

  const deleteIngredient = async (id: string) => {
    if (!supabase || !canEditMenu) return;
    if (!(await requireManagerPin('eliminare una aggiunta'))) return;
    const ok = await confirm({ title: 'Elimina aggiunta', message: 'Sei sicuro di voler eliminare questa aggiunta?', destructive: true });
    if (ok) {
        await supabase.from('ingredienti').delete().eq('id', id);
        fetchIngredients();
    }
  };

  const deleteProduct = async (id: string) => {
    if (!supabase || !canEditMenu) return;
    if (!(await requireManagerPin('eliminare un prodotto'))) return;
    const ok = await confirm({ title: 'Elimina prodotto', message: 'Sei sicuro di voler eliminare questo prodotto?', destructive: true });
    if (ok) {
        await supabase.from('prodotti').delete().eq('id', id);
        fetchProducts();
    }
  };

  const handleAdditionPriceChange = (id: string, value: string) => {
    setAdditionPriceDrafts(prev => ({ ...prev, [id]: value }));
  };

  const handleAdditionPriceBlur = (id: string, value: string) => {
    const ing = ingredients.find(i => i.id === id);
    const raw = value.replace(',', '.');
    const val = parseFloat(raw);
    if (!isNaN(val) && val >= 0) {
      supabase?.from('ingredienti').update({ prezzo: val }).eq('id', id).then(() => fetchIngredients());
      setAdditionPriceDrafts(prev => ({ ...prev, [id]: val.toFixed(2) }));
    } else {
      setAdditionPriceDrafts(prev => ({ ...prev, [id]: (ing?.prezzo ?? 0).toFixed(2) }));
    }
  };

  const handleRemovalPriceChange = (id: string, value: string) => {
    setRemovalPriceDrafts(prev => ({ ...prev, [id]: value }));
  };

  const handleRemovalPriceBlur = (id: string, value: string) => {
    const ing = ingredients.find(i => i.id === id);
    const raw = value.replace(',', '.');
    const val = parseFloat(raw);
    if (!isNaN(val) && val >= 0) {
      supabase?.from('ingredienti').update({ prezzo_rimozione: val }).eq('id', id).then(() => fetchIngredients());
      setRemovalPriceDrafts(prev => ({ ...prev, [id]: val.toFixed(2) }));
    } else {
      setRemovalPriceDrafts(prev => ({ ...prev, [id]: (ing?.prezzo_rimozione ?? 0).toFixed(2) }));
    }
  };

  const isEmbedded = true;
  const currentUser = getCurrentUser();
  const outOfStock = products.filter(p => !p.disponibile).length;
  const badges: Partial<Record<KitchenTab, number>> = {
    menu: outOfStock,
    ingredients: ingredients.filter(i => !i.disponibile).length,
  };
  const activeLabel = NAV_GROUPS.flatMap(g => g.items).find(i => i.tab === activeTab)?.label ?? '';

  return (
    <div className="min-h-screen bg-charcoal text-gray-300 font-sans">
      <div className="flex flex-col md:flex-row h-dvh overflow-hidden">

        {/* Sidebar (desktop/tablet) */}
        <aside className="hidden md:flex w-72 shrink-0 bg-surface border-r border-surface-light flex-col z-20">
          <div className="px-6 pt-6 pb-5">
            <KitchenBrand />
          </div>
          <div className="px-4">
            <HomeLink onNavigateHome={onNavigateHome} />
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-4">
            <KitchenNav activeTab={activeTab} badges={badges} onSelect={setActiveTab} />
          </div>
          <SidebarFooter userName={currentUser?.name} outOfStock={outOfStock} />
        </aside>

        {/* Top bar (mobile) */}
        <header className="md:hidden flex items-center justify-between gap-3 px-4 py-3 bg-surface border-b border-surface-light z-20">
          <button
            onClick={() => setMenuOpen(true)}
            aria-label="Apri menu"
            className="p-2.5 rounded-xl bg-charcoal text-gray-300 hover:text-white transition-colors"
          >
            <Menu size={22} />
          </button>
          <div className="flex-1 min-w-0 text-center">
            <p className="text-[10px] font-black text-gold uppercase tracking-[0.25em]">KitchenHub</p>
            <p className="text-sm font-black text-white truncate">{activeLabel}</p>
          </div>
          <div className="w-11 flex justify-end">
            {outOfStock > 0 && (
              <span className="min-w-7 h-7 px-2 rounded-full bg-rose-500/15 text-rose-400 text-xs font-black flex items-center justify-center tabular-nums" title="Piatti esauriti">
                {outOfStock}
              </span>
            )}
          </div>
        </header>

        {/* Mobile drawer */}
        {menuOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setMenuOpen(false)} />
            <div className="absolute left-0 top-0 bottom-0 w-80 max-w-[85vw] bg-surface flex flex-col shadow-2xl animate-in slide-in-from-left duration-200">
              <div className="flex items-center justify-between px-5 pt-5 pb-4">
                <KitchenBrand />
                <button onClick={() => setMenuOpen(false)} aria-label="Chiudi menu" className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-charcoal">
                  <X size={20} />
                </button>
              </div>
              <div className="px-4">
                <HomeLink onNavigateHome={onNavigateHome} onDone={() => setMenuOpen(false)} />
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-4">
                <KitchenNav activeTab={activeTab} badges={badges} onSelect={tab => { setActiveTab(tab); setMenuOpen(false); }} />
              </div>
              <SidebarFooter userName={currentUser?.name} outOfStock={outOfStock} />
            </div>
          </div>
        )}

        {/* Dashboard Content */}
        <main className="flex-1 px-4 py-5 md:px-10 md:py-8 overflow-y-auto bg-charcoal">

          {activeTab === 'menu' && (
            <MenuTab
              products={products}
              allCategories={allCategories}
              menuCategory={menuCategory}
              onMenuCategoryChange={setMenuCategory}
              menuSearch={menuSearch}
              onMenuSearchChange={setMenuSearch}
              canEditMenu={canEditMenu}
              onNewProduct={() => { setEditingProduct(null); setNewProduct(prev => ({ ...prev, categoria: menuCategory || prev.categoria })); setIsModalOpen(true); }}
              onEditProduct={(product) => { setEditingProduct(product); setIsModalOpen(true); }}
              onDeleteProduct={deleteProduct}
              onToggleAvailability={toggleAvailability}
              onMarkAllUnavailable={markAllUnavailableExceptDrinks}
              onCategoryRename={(oldName, newName) => {
                const newOrder = categoryOrder.map(c => c === oldName ? newName : c);
                setCategoryOrderState(newOrder);
                saveCategoryOrder(newOrder);
                if (extraCategories.includes(oldName)) {
                  persistExtraCat(extraCategories.map(c => c === oldName ? newName : c));
                }
              }}
              onCategoryDelete={(cat) => persistExtraCat(extraCategories.filter(c => c !== cat))}
              onCategoryMoveUp={(cat) => {
                const idx = allCategories.indexOf(cat);
                if (idx > 0) { const newOrder = [...allCategories]; [newOrder[idx-1], newOrder[idx]] = [newOrder[idx], newOrder[idx-1]]; setCategoryOrderState(newOrder); saveCategoryOrder(newOrder); }
              }}
              onCategoryMoveDown={(cat) => {
                const idx = allCategories.indexOf(cat);
                if (idx < allCategories.length - 1) { const newOrder = [...allCategories]; [newOrder[idx], newOrder[idx+1]] = [newOrder[idx+1], newOrder[idx]]; setCategoryOrderState(newOrder); saveCategoryOrder(newOrder); }
              }}
              onCategoryAdd={(name) => {
                if (!allCategories.includes(name)) {
                  persistExtraCat([...extraCategories, name]);
                }
                setNewProduct({ ...newProduct, categoria: name });
                setMenuCategory(name);
              }}
            />
          )}

          {activeTab === 'ingredients' && (
            <IngredientsTab
              ingredients={ingredients}
              ingredientSearch={ingredientSearch}
              onIngredientSearchChange={setIngredientSearch}
              canEditMenu={canEditMenu}
              onNew={() => { setEditingIngredient(null); setIsIngredientsModalOpen(true); }}
              onEdit={(ing) => { setEditingIngredient(ing); setIsIngredientsModalOpen(true); }}
              onDelete={deleteIngredient}
              onToggleAvailability={toggleIngredientAvailability}
              priceDrafts={additionPriceDrafts}
              onPriceChange={handleAdditionPriceChange}
              onPriceBlur={handleAdditionPriceBlur}
            />
          )}

          {activeTab === 'removals' && (
            <RemovalsTab
              ingredients={ingredients}
              ingredientSearch={ingredientSearch}
              onIngredientSearchChange={setIngredientSearch}
              priceDrafts={removalPriceDrafts}
              onPriceChange={handleRemovalPriceChange}
              onPriceBlur={handleRemovalPriceBlur}
              canEditMenu={canEditMenu}
            />
          )}

          {activeTab === 'variants' && (
            <VariantsTab allCategories={allCategories} canEditMenu={canEditMenu} />
          )}

          {activeTab === 'haccp' && (
            <div className="max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
              <HaccpView isEmbedded={isEmbedded} />
            </div>
          )}

          {activeTab === 'cassa' && (
            <CassaFiscaleTab />
          )}

          <ProductFormModal
            isOpen={isModalOpen}
            editingProduct={editingProduct}
            newProduct={newProduct}
            productPriceDraft={productPriceDraft}
            allCategories={allCategories}
            onClose={() => setIsModalOpen(false)}
            onEditingProductChange={setEditingProduct}
            onNewProductChange={setNewProduct}
            onPriceDraftChange={setProductPriceDraft}
            onSave={handleSaveProduct}
          />

          <IngredientFormModal
            isOpen={isIngredientsModalOpen}
            editingIngredient={editingIngredient}
            newIngredient={newIngredient}
            priceDraft={ingredientPriceDraft}
            onClose={() => setIsIngredientsModalOpen(false)}
            onEditingIngredientChange={setEditingIngredient}
            onNewIngredientChange={setNewIngredient}
            onPriceDraftChange={setIngredientPriceDraft}
            onSave={handleSaveIngredient}
          />
        </main>
      </div>
    </div>
  );
}
