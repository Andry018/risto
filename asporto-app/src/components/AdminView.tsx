import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { requireManagerPin, getCurrentUser } from '../lib/staffAuth';
import { supabase, IS_DEMO_MODE } from '../lib/supabase';
import type { Product, Ingredient } from '../types/entities';
import { MOCK_PRODUCTS, MOCK_INGREDIENTS } from '../lib/MockData';
import { getCategoryOrder, saveCategoryOrder } from '../lib/categoryUtils';
import { List, ChefHat, LayoutDashboard, Plus, Minus, SlidersHorizontal, ShieldCheck, Menu, X, Receipt } from 'lucide-react';
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
      .channel('public:prodotti')
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

  return (
    <div className={`min-h-screen ${'bg-charcoal text-gray-300'} font-sans ${''}`}>

      {/* Sidebar / Topnav layout */}
      <div className="flex flex-col md:flex-row h-dvh overflow-hidden">

        {/* Modern Sidebar Nav */}
        <aside className={`w-full md:w-72 bg-surface md:border-r border-b md:border-b-0 border-surface-light px-4 py-3 md:p-6 flex flex-col z-20 shadow-2xl`}>
          <div className="flex items-center justify-between gap-3 mb-0 md:mb-12">
            <div className="flex items-center gap-3">
              <div className={`${'bg-gold'} p-2.5 rounded-xl ${''}`}>
                <ChefHat size={28} className={'text-black'} />
              </div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">Kitchen<span className={'text-gold'}>Hub</span></h1>
            </div>
            <button
              onClick={() => setMenuOpen(true)}
              className="md:hidden p-2 rounded-xl bg-charcoal text-gray-400 hover:text-white transition-colors"
            >
              <Menu size={22} />
            </button>
          </div>

          <nav className="hidden md:flex md:flex-col gap-1 md:flex-1">
            {onNavigateHome ? (
              <button
                onClick={onNavigateHome}
                className="shrink-0 md:w-full flex items-center gap-3 p-3 md:p-4 rounded-xl text-gray-500 hover:bg-charcoal hover:text-white transition-all duration-300"
              >
                <LayoutDashboard size={20} />
                <span className="whitespace-nowrap">Dashboard Principale</span>
              </button>
            ) : (
              <Link
                to="/"
                className="shrink-0 md:w-full flex items-center gap-3 p-3 md:p-4 rounded-xl text-gray-500 hover:bg-charcoal hover:text-white transition-all duration-300"
              >
                <LayoutDashboard size={20} />
                <span className="whitespace-nowrap">Dashboard Principale</span>
              </Link>
            )}
            <div className="hidden md:block h-px bg-surface-light/50 my-2" />
            <button
              onClick={() => setActiveTab('menu')}
              className={`shrink-0 md:w-full flex items-center justify-between p-3 md:p-4 rounded-xl transition-all duration-300 ${
                activeTab === 'menu'
                  ? 'bg-charcoal text-gold shadow-md border border-surface-light'
                  : 'text-gray-500 hover:bg-charcoal hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3 font-medium">
               <List size={20} className={activeTab === 'menu' ? 'text-gold' : ''} />
                <span className="whitespace-nowrap">Disponibilità Menu</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('ingredients')}
              className={`shrink-0 md:w-full flex items-center justify-between p-3 md:p-4 rounded-xl transition-all duration-300 ${
                activeTab === 'ingredients'
                  ? 'bg-charcoal text-gold shadow-md border border-surface-light'
                  : 'text-gray-500 hover:bg-charcoal hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3 font-medium">
                <Plus size={20} className={activeTab === 'ingredients' ? 'text-gold' : ''} />
                <span className="whitespace-nowrap">Gestione Aggiunte</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('removals')}
              className={`shrink-0 md:w-full flex items-center justify-between p-3 md:p-4 rounded-xl transition-all duration-300 ${
                activeTab === 'removals'
                  ? 'bg-charcoal text-gold shadow-md border border-surface-light'
                  : 'text-gray-500 hover:bg-charcoal hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3 font-medium">
                <Minus size={20} className={activeTab === 'removals' ? 'text-gold' : ''} />
                <span className="whitespace-nowrap">Gestione Rimozioni</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('variants')}
              className={`shrink-0 md:w-full flex items-center justify-between p-3 md:p-4 rounded-xl transition-all duration-300 ${
                activeTab === 'variants'
                  ? 'bg-charcoal text-gold shadow-md border border-surface-light'
                  : 'text-gray-500 hover:bg-charcoal hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3 font-medium">
                <SlidersHorizontal size={20} className={activeTab === 'variants' ? 'text-gold' : ''} />
                <span className="whitespace-nowrap">Gestione Varianti</span>
              </div>
            </button>
            <div className="hidden md:block h-px bg-surface-light/50 my-2" />
            <button
              onClick={() => setActiveTab('haccp')}
              className={`shrink-0 md:w-full flex items-center justify-between p-3 md:p-4 rounded-xl transition-all duration-300 ${
                activeTab === 'haccp'
                  ? 'bg-charcoal text-gold shadow-md border border-surface-light'
                  : 'text-gray-500 hover:bg-charcoal hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3 font-medium">
                <ShieldCheck size={20} className={activeTab === 'haccp' ? 'text-gold' : ''} />
                <span className="whitespace-nowrap">HACCP Etichette</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('cassa')}
              className={`shrink-0 md:w-full flex items-center justify-between p-3 md:p-4 rounded-xl transition-all duration-300 ${
                activeTab === 'cassa'
                  ? 'bg-charcoal text-gold shadow-md border border-surface-light'
                  : 'text-gray-500 hover:bg-charcoal hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3 font-medium">
                <Receipt size={20} className={activeTab === 'cassa' ? 'text-gold' : ''} />
                <span className="whitespace-nowrap">Cassa Fiscale</span>
              </div>
            </button>
          </nav>

          <div className={`mt-auto hidden md:flex p-4 ${'bg-gold/10 border-gold/20'} border rounded-xl items-center gap-3`}>
             <div className={`w-2 h-2 rounded-full ${'bg-gold'} animate-ping absolute`}></div>
             <div className={`w-2 h-2 rounded-full ${'bg-gold'} relative`}></div>
             <span className={`${'text-gold'} text-sm font-medium`}>Sistema Online</span>
          </div>
        </aside>

        {/* Mobile drawer */}
        {menuOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setMenuOpen(false)} />
            <div className="absolute left-0 top-0 bottom-0 w-72 bg-surface flex flex-col p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="bg-gold p-2.5 rounded-xl"><ChefHat size={24} className="text-black" /></div>
                  <h1 className="text-xl font-bold text-white">Kitchen<span className="text-gold">Hub</span></h1>
                </div>
                <button onClick={() => setMenuOpen(false)} className="p-2 text-gray-400 hover:text-white">
                  <X size={20} />
                </button>
              </div>
              <div className="flex flex-col gap-1 flex-1">
                {onNavigateHome ? (
                  <button onClick={() => { setMenuOpen(false); onNavigateHome(); }} className="w-full flex items-center gap-3 p-4 rounded-xl text-gray-500 hover:bg-charcoal hover:text-white transition-all">
                    <LayoutDashboard size={20} /> Dashboard
                  </button>
                ) : (
                  <a href="/" className="w-full flex items-center gap-3 p-4 rounded-xl text-gray-500 hover:bg-charcoal hover:text-white transition-all" onClick={() => setMenuOpen(false)}>
                    <LayoutDashboard size={20} /> Dashboard
                  </a>
                )}
                <div className="h-px bg-surface-light/50 my-1" />
                {([
                  ['menu', 'Disponibilità Menu', List],
                  ['ingredients', 'Gestione Aggiunte', Plus],
                  ['removals', 'Gestione Rimozioni', Minus],
                  ['variants', 'Gestione Varianti', SlidersHorizontal],
                ] as const).map(([tab, label, Icon]) => (
                  <button
                    key={tab}
                    onClick={() => { setActiveTab(tab); setMenuOpen(false); }}
                    className={`w-full flex items-center gap-3 p-4 rounded-xl transition-all ${activeTab === tab ? 'bg-charcoal text-gold border border-surface-light' : 'text-gray-500 hover:bg-charcoal hover:text-white'}`}
                  >
                    <Icon size={20} className={activeTab === tab ? 'text-gold' : ''} />
                    <span className="font-medium">{label}</span>
                  </button>
                ))}
                <div className="h-px bg-surface-light/50 my-1" />
                <button
                  onClick={() => { setActiveTab('haccp'); setMenuOpen(false); }}
                  className={`w-full flex items-center gap-3 p-4 rounded-xl transition-all ${activeTab === 'haccp' ? 'bg-charcoal text-gold border border-surface-light' : 'text-gray-500 hover:bg-charcoal hover:text-white'}`}
                >
                  <ShieldCheck size={20} className={activeTab === 'haccp' ? 'text-gold' : ''} />
                  <span className="font-medium">HACCP Etichette</span>
                </button>
                <button
                  onClick={() => { setActiveTab('cassa'); setMenuOpen(false); }}
                  className={`w-full flex items-center gap-3 p-4 rounded-xl transition-all ${activeTab === 'cassa' ? 'bg-charcoal text-gold border border-surface-light' : 'text-gray-500 hover:bg-charcoal hover:text-white'}`}
                >
                  <Receipt size={20} className={activeTab === 'cassa' ? 'text-gold' : ''} />
                  <span className="font-medium">Cassa Fiscale</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Dashboard Content */}
        <main className={`flex-1 p-4 md:p-10 overflow-y-auto ${'bg-charcoal'}`}>

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
