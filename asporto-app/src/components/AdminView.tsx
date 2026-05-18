import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getCurrentUser, getDefaultRouteForRole } from '../lib/staffAuth';
import { supabase, IS_DEMO_MODE } from '../lib/supabase';
import type { Product, Ingredient } from '../types/entities';
import { ALLERGEN_META } from '../types/entities';
import { MOCK_PRODUCTS, MOCK_INGREDIENTS } from '../lib/MockData';
import { getProductVariants, saveProductVariants, type ProductVariant } from '../lib/productVariants';
import { getCategoryOrder, saveCategoryOrder } from '../lib/categoryUtils';
import { List, ToggleLeft, ToggleRight, ChefHat, LayoutDashboard, Plus, Minus, Edit2, Edit3, Trash2, X, Save, Search, Upload, SlidersHorizontal, ChevronUp, ChevronDown } from 'lucide-react';

interface AdminViewProps {
  onNavigateHome?: () => void;
}

export default function AdminView({ onNavigateHome }: AdminViewProps = {}) {
  const navigate = useNavigate();
  useEffect(() => {
    const user = getCurrentUser();
    if (user && !['kitchen', 'admin'].includes(user.role)) {
      navigate(getDefaultRouteForRole(user.role), { replace: true });
    }
  }, []);
  const [products, setProducts] = useState<Product[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [activeTab, setActiveTab] = useState<'menu' | 'ingredients' | 'removals' | 'variants'>('menu');
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
  const [showNewCatInput, setShowNewCatInput] = useState(false);
  const [newCatName, setNewCatName] = useState('');
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
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editCategoryDraft, setEditCategoryDraft] = useState('');
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
  const [variants, setVariants] = useState<ProductVariant[]>(() => getProductVariants());
  const [variantEditingId, setVariantEditingId] = useState<string | null>(null);
  const [variantEditDraft, setVariantEditDraft] = useState<Partial<ProductVariant>>({});
  const [variantCategoryFilter, setVariantCategoryFilter] = useState<string | null>(null);

  useEffect(() => {
    if (isModalOpen) {
      const val = editingProduct?.prezzo ?? newProduct.prezzo ?? 0;
      setProductPriceDraft(String(val));
    }
  }, [isModalOpen]);

  const persistVariants = (newVariants: ProductVariant[]) => {
    setVariants(newVariants);
    saveProductVariants(newVariants);
  };

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
    await supabase.from('prodotti').update({ disponibile: !currentStatus }).eq('id', id);
  };

  const toggleIngredientAvailability = async (id: string, currentStatus: boolean) => {
    setIngredients(prev => prev.map(i => i.id === id ? { ...i, disponibile: !currentStatus } : i));
    if (!supabase) return;
    await supabase.from('ingredienti').update({ disponibile: !currentStatus }).eq('id', id);
    fetchIngredients();
  };

  const handleSaveProduct = async () => {
    if (!supabase) return;
    const productData = editingProduct || newProduct;
    if (!productData.nome || productData.prezzo === undefined || productData.prezzo === null) return;

    if (editingProduct && editingProduct.id) {
        await supabase.from('prodotti').update(productData).eq('id', editingProduct.id);
    } else {
        await supabase.from('prodotti').insert([productData]);
    }
    
    setIsModalOpen(false);
    setEditingProduct(null);
    setNewProduct({ nome: '', prezzo: 0, categoria: 'Antipasti', sottocategoria: '', disponibile: true, ingredienti: [] });
    fetchProducts();
  };

  const handleSaveIngredient = async () => {
    if (!supabase) return;
    const ingData = editingIngredient || newIngredient;
    if (!ingData.nome) return;

    if (editingIngredient && editingIngredient.id) {
        await supabase.from('ingredienti').update(ingData).eq('id', editingIngredient.id);
    } else {
        await supabase.from('ingredienti').insert([ingData]);
    }
    
    setIsIngredientsModalOpen(false);
    setEditingIngredient(null);
    setNewIngredient({ nome: '', prezzo: 1.5, prezzo_rimozione: 0, disponibile: true });
    fetchIngredients();
  };

  const deleteIngredient = async (id: string) => {
    if (!supabase) return;
    if (confirm('Sei sicuro di voler eliminare questa aggiunta?')) {
        await supabase.from('ingredienti').delete().eq('id', id);
        fetchIngredients();
    }
  };

  const deleteProduct = async (id: string) => {
    if (!supabase) return;
    if (confirm('Sei sicuro di voler eliminare questo prodotto?')) {
        await supabase.from('prodotti').delete().eq('id', id);
        fetchProducts();
    }
  };

  const isEmbedded = onNavigateHome !== undefined;

  return (
    <div className={`min-h-screen ${isEmbedded ? 'bg-charcoal text-gray-300' : 'bg-slate-900 text-slate-300'} font-sans ${isEmbedded ? '' : 'selection:bg-indigo-500/30'}`}>
      
      {/* Sidebar / Topnav layout */}
      <div className="flex flex-col md:flex-row h-screen overflow-hidden">
        
        {/* Modern Sidebar Nav */}
        <aside className={`w-full md:w-72 ${isEmbedded ? 'bg-surface border-r border-surface-light' : 'bg-slate-950 border-r border-slate-800/60'} p-6 flex flex-col z-20 shadow-2xl`}>
          <div className="flex items-center gap-3 mb-12">
            <div className={`${isEmbedded ? 'bg-gold' : 'bg-gradient-to-br from-indigo-500 to-fuchsia-600'} p-2.5 rounded-xl ${isEmbedded ? '' : 'shadow-lg shadow-indigo-500/20'}`}>
              <ChefHat size={28} className={isEmbedded ? 'text-black' : 'text-white'} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Kitchen<span className={isEmbedded ? 'text-gold' : 'text-indigo-400'}>Hub</span></h1>
          </div>

          <nav className="space-y-3 flex-1">
            {onNavigateHome ? (
              <button
                onClick={onNavigateHome}
                className="w-full flex items-center gap-3 p-4 rounded-xl text-gray-500 hover:bg-charcoal hover:text-white transition-all duration-300"
              >
                <LayoutDashboard size={20} />
                Dashboard Principale
              </button>
            ) : (
              <Link
                to="/"
                className="w-full flex items-center gap-3 p-4 rounded-xl text-slate-400 hover:bg-slate-900 hover:text-white transition-all duration-300"
              >
                <LayoutDashboard size={20} />
                Dashboard Principale
              </Link>
            )}
            <div className={`h-px ${isEmbedded ? 'bg-surface-light/50' : 'bg-slate-800/50'} my-2`} />
            <button 
              onClick={() => setActiveTab('menu')} 
              className={`w-full flex items-center justify-between p-4 rounded-xl transition-all duration-300 ${
                activeTab === 'menu' 
                  ? isEmbedded
                    ? 'bg-charcoal text-gold shadow-md border border-surface-light'
                    : 'bg-slate-800/80 text-white shadow-md border border-slate-700/50'
                  : isEmbedded
                    ? 'text-gray-500 hover:bg-charcoal hover:text-white'
                    : 'text-slate-400 hover:bg-slate-900 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3 font-medium">
               <List size={20} className={activeTab === 'menu' ? (isEmbedded ? 'text-gold' : 'text-fuchsia-400') : ''} />
                Disponibilità Menu
              </div>
            </button>
            <button 
              onClick={() => setActiveTab('ingredients')} 
              className={`w-full flex items-center justify-between p-4 rounded-xl transition-all duration-300 ${
                activeTab === 'ingredients' 
                  ? isEmbedded
                    ? 'bg-charcoal text-gold shadow-md border border-surface-light'
                    : 'bg-slate-800/80 text-white shadow-md border border-slate-700/50'
                  : isEmbedded
                    ? 'text-gray-500 hover:bg-charcoal hover:text-white'
                    : 'text-slate-400 hover:bg-slate-900 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3 font-medium">
                <Plus size={20} className={activeTab === 'ingredients' ? (isEmbedded ? 'text-gold' : 'text-emerald-400') : ''} />
                Gestione Aggiunte
              </div>
            </button>
            <button 
              onClick={() => setActiveTab('removals')} 
              className={`w-full flex items-center justify-between p-4 rounded-xl transition-all duration-300 ${
                activeTab === 'removals' 
                  ? isEmbedded
                    ? 'bg-charcoal text-gold shadow-md border border-surface-light'
                    : 'bg-slate-800/80 text-white shadow-md border border-slate-700/50'
                  : isEmbedded
                    ? 'text-gray-500 hover:bg-charcoal hover:text-white'
                    : 'text-slate-400 hover:bg-slate-900 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3 font-medium">
                <Minus size={20} className={activeTab === 'removals' ? (isEmbedded ? 'text-gold' : 'text-rose-400') : ''} />
                Gestione Rimozioni
              </div>
            </button>
            <button 
              onClick={() => setActiveTab('variants')} 
              className={`w-full flex items-center justify-between p-4 rounded-xl transition-all duration-300 ${
                activeTab === 'variants' 
                  ? isEmbedded
                    ? 'bg-charcoal text-gold shadow-md border border-surface-light'
                    : 'bg-slate-800/80 text-white shadow-md border border-slate-700/50'
                  : isEmbedded
                    ? 'text-gray-500 hover:bg-charcoal hover:text-white'
                    : 'text-slate-400 hover:bg-slate-900 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3 font-medium">
                <SlidersHorizontal size={20} className={activeTab === 'variants' ? (isEmbedded ? 'text-gold' : 'text-sky-400') : ''} />
                Gestione Varianti
              </div>
            </button>
          </nav>
          
          <div className={`mt-auto p-4 ${isEmbedded ? 'bg-gold/10 border-gold/20' : 'bg-emerald-500/10 border-emerald-500/20'} border rounded-xl flex items-center gap-3`}>
             <div className={`w-2 h-2 rounded-full ${isEmbedded ? 'bg-gold' : 'bg-emerald-500'} animate-ping absolute`}></div>
             <div className={`w-2 h-2 rounded-full ${isEmbedded ? 'bg-gold' : 'bg-emerald-500'} relative`}></div>
             <span className={`${isEmbedded ? 'text-gold' : 'text-emerald-400'} text-sm font-medium`}>Sistema Online</span>
          </div>
        </aside>

        {/* Dashboard Content */}
        <main className={`flex-1 p-6 md:p-10 overflow-y-auto ${isEmbedded ? 'bg-charcoal' : 'bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-800 via-slate-900 to-slate-950'}`}>
          
          {activeTab === 'menu' && (
            <div className={`max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500`}>
              <header className="mb-8 flex justify-between items-center">
                <div>
                  <h2 className="text-3xl font-bold text-white mb-2">Gestione Menu</h2>
                  <p className={isEmbedded ? 'text-gray-500' : 'text-slate-400'}>Aggiungi o modifica i piatti della giornata.</p>
                </div>
                <div className="flex gap-4">
                  <div className="relative w-64">
                    <Search className={`absolute left-4 top-1/2 -translate-y-1/2 ${isEmbedded ? 'text-gray-500' : 'text-slate-500'}`} size={18} />
                    <input 
                      type="text" 
                      placeholder="Cerca piatto..."
                      value={menuSearch}
                      onChange={e => setMenuSearch(e.target.value)}
                      className={`w-full ${isEmbedded ? 'bg-charcoal border-surface-light focus:border-gold' : 'bg-slate-950 border-slate-800 focus:border-indigo-500'} border rounded-2xl py-3 pl-12 pr-4 text-white font-bold outline-none transition-all text-sm`}
                    />
                  </div>
                  <button 
                      onClick={() => { setEditingProduct(null); setNewProduct(prev => ({ ...prev, categoria: menuCategory || prev.categoria })); setIsModalOpen(true); }}
                      className={`${isEmbedded ? 'bg-gold text-black' : 'bg-indigo-500 hover:bg-indigo-400 text-white shadow-lg shadow-indigo-500/20'} font-bold py-3 px-6 rounded-2xl flex items-center gap-2 transition-all`}
                  >
                      <Plus size={20} /> Nuovo Piatto
                  </button>
                </div>
              </header>

              {/* Category filter bar */}
              <div className={`flex gap-2 overflow-x-auto pb-4 mb-6 ${isEmbedded ? '' : 'scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900'}`}>
                <button
                  onClick={() => setMenuCategory(null)}
                  className={`shrink-0 px-4 py-2 rounded-xl font-bold text-sm transition-all ${
                    !menuCategory
                      ? isEmbedded
                        ? 'bg-gold text-black'
                        : 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                      : isEmbedded
                        ? 'bg-surface text-gray-500 hover:text-white'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  Tutte
                </button>
                {allCategories.map(cat => (
                  <div key={cat} className="shrink-0 relative group">
                    <button
                      onClick={() => setMenuCategory(menuCategory === cat ? null : cat)}
                      className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${
                        menuCategory === cat
                          ? isEmbedded
                            ? 'bg-gold text-black'
                            : 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                          : isEmbedded
                            ? 'bg-surface text-gray-500 hover:text-white'
                            : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {editingCategory === cat ? (
                        <input
                          type="text"
                          value={editCategoryDraft}
                          onChange={e => setEditCategoryDraft(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && editCategoryDraft.trim() && editCategoryDraft.trim() !== cat) {
                              const newName = editCategoryDraft.trim();
                              const newOrder = categoryOrder.map(c => c === cat ? newName : c);
                              setCategoryOrderState(newOrder);
                              saveCategoryOrder(newOrder);
                              if (extraCategories.includes(cat)) {
                                persistExtraCat(extraCategories.map(c => c === cat ? newName : c));
                              }
                              setEditingCategory(null);
                            }
                            if (e.key === 'Escape') setEditingCategory(null);
                          }}
                          onBlur={() => setEditingCategory(null)}
                          className="w-20 bg-transparent text-white border-b border-current outline-none text-sm"
                          autoFocus
                          onClick={e => e.stopPropagation()}
                        />
                      ) : (
                        cat
                      )}
                    </button>
                    {editingCategory !== cat && (
                      <div className="inline-flex ml-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={e => { e.stopPropagation(); setEditingCategory(cat); setEditCategoryDraft(cat); }}
                          className={`p-1 rounded ${isEmbedded ? 'hover:bg-charcoal text-gray-400' : 'hover:bg-slate-700 text-slate-500'} transition-all`}
                          title="Rinomina"
                        >
                          <Edit3 size={12} />
                        </button>
                        {(extraCategories.includes(cat) || !getCategoryOrder().includes(cat)) && (
                          <button
                            onClick={e => { e.stopPropagation(); persistExtraCat(extraCategories.filter(c => c !== cat)); }}
                            className={`p-1 rounded ${isEmbedded ? 'hover:bg-charcoal text-gray-400' : 'hover:bg-slate-700 text-slate-500'} transition-all`}
                            title="Elimina"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                        <button
                          onClick={e => { e.stopPropagation(); const idx = allCategories.indexOf(cat); if (idx > 0) { const newOrder = [...allCategories]; [newOrder[idx-1], newOrder[idx]] = [newOrder[idx], newOrder[idx-1]]; setCategoryOrderState(newOrder); saveCategoryOrder(newOrder); } }}
                          className={`p-1 rounded ${isEmbedded ? 'hover:bg-charcoal text-gray-400' : 'hover:bg-slate-700 text-slate-500'} transition-all`}
                          title="Sposta su"
                        >
                          <ChevronUp size={12} />
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); const idx = allCategories.indexOf(cat); if (idx < allCategories.length - 1) { const newOrder = [...allCategories]; [newOrder[idx], newOrder[idx+1]] = [newOrder[idx+1], newOrder[idx]]; setCategoryOrderState(newOrder); saveCategoryOrder(newOrder); } }}
                          className={`p-1 rounded ${isEmbedded ? 'hover:bg-charcoal text-gray-400' : 'hover:bg-slate-700 text-slate-500'} transition-all`}
                          title="Sposta giù"
                        >
                          <ChevronDown size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {showNewCatInput ? (
                  <div className="shrink-0 flex items-center gap-1">
                    <input
                      type="text"
                      value={newCatName}
                      onChange={e => setNewCatName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && newCatName.trim()) {
                          const name = newCatName.trim();
                          if (!allCategories.includes(name)) {
                            persistExtraCat([...extraCategories, name]);
                          }
                          setNewProduct({ ...newProduct, categoria: name });
                          setMenuCategory(name);
                          setShowNewCatInput(false);
                          setNewCatName('');
                        }
                        if (e.key === 'Escape') {
                          setShowNewCatInput(false);
                          setNewCatName('');
                        }
                      }}
                      placeholder="Nome categoria..."
                      className={`w-40 ${isEmbedded ? 'bg-charcoal border-gold/50 focus:border-gold' : 'bg-slate-950 border-indigo-500/50 focus:border-indigo-500'} border rounded-xl py-2 px-3 text-white text-sm outline-none`}
                      autoFocus
                    />
                    <button
                      onClick={() => {
                        if (newCatName.trim()) {
                          const name = newCatName.trim();
                          if (!allCategories.includes(name)) {
                            persistExtraCat([...extraCategories, name]);
                          }
                          setNewProduct({ ...newProduct, categoria: name });
                          setMenuCategory(name);
                          setShowNewCatInput(false);
                          setNewCatName('');
                        }
                      }}
                      className={`p-2 ${isEmbedded ? 'bg-gold text-black' : 'bg-indigo-500'} rounded-lg text-white`}
                    >
                      <Plus size={16} />
                    </button>
                    <button
                      onClick={() => { setShowNewCatInput(false); setNewCatName(''); }}
                      className={`p-2 ${isEmbedded ? 'bg-surface' : 'bg-slate-800'} rounded-lg ${isEmbedded ? 'text-gray-500 hover:text-white' : 'text-slate-400 hover:text-white'}`}
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowNewCatInput(true)}
                    className={`shrink-0 px-3 py-2 rounded-xl font-bold text-sm ${isEmbedded ? 'bg-surface text-gray-500 hover:bg-charcoal hover:text-white' : 'bg-slate-800 text-slate-500 hover:text-white hover:bg-slate-700'} transition-all`}
                    title="Aggiungi categoria"
                  >
                    <Plus size={18} />
                  </button>
                )}
              </div>

              <div className="space-y-12">
                {allCategories.filter(cat => !menuCategory || cat === menuCategory).map(cat => {
                  const filteredProducts = products.filter(p => 
                    p.categoria === cat && 
                    p.nome.toLowerCase().includes(menuSearch.toLowerCase())
                  );
                  
                  if (filteredProducts.length === 0 && menuSearch) return null;

                  return (
                    <section key={cat}>
                      <h3 className={`text-sm font-black ${isEmbedded ? 'text-gray-500' : 'text-slate-500'} uppercase tracking-[0.3em] mb-6 flex items-center gap-3`}>
                          <div className={`h-px ${isEmbedded ? 'bg-surface-light' : 'bg-slate-800'} flex-1`}></div>
                          {cat}
                          <div className={`h-px ${isEmbedded ? 'bg-surface-light' : 'bg-slate-800'} flex-1`}></div>
                      </h3>
                      {filteredProducts.some(p => p.sottocategoria) ? (
                        (() => {
                          const subcats = [...new Set(filteredProducts.map(p => p.sottocategoria || 'Altro'))];
                          return subcats.map(sub => {
                            const subProducts = filteredProducts.filter(p => (p.sottocategoria || 'Altro') === sub);
                            return (
                              <div key={sub} className="mb-6">
                                <h4 className={`text-[10px] font-black ${isEmbedded ? 'text-gray-500' : 'text-slate-400'} uppercase tracking-[0.3em] mb-4 ml-1`}>{sub}</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                  {subProducts.map(product => (
                                    <div key={product.id} className={`group relative ${isEmbedded ? 'bg-surface border-surface-light hover:border-gold/30' : 'bg-slate-900 border-slate-800 hover:border-slate-700'} border rounded-2xl p-5 transition-all`}>
                                      <div className="flex justify-between items-start mb-4">
                                        <div>
                                          <h4 className={`font-bold text-white ${isEmbedded ? 'group-hover:text-gold' : 'group-hover:text-indigo-400'} transition-colors uppercase text-sm`}>{product.nome}</h4>
                                          <p className={`${isEmbedded ? 'text-gold' : 'text-indigo-400'} font-black mt-1`}>€{product.prezzo.toFixed(2)}</p>
                                          {product.ingredienti.length > 0 && (
                                            <p className={`text-[9px] ${isEmbedded ? 'text-gray-500' : 'text-slate-500'} mt-1.5`}>{product.ingredienti.join(', ')}</p>
                                          )}
                                        </div>
                                        <div className="flex gap-2">
                                          <button onClick={() => { setEditingProduct(product); setIsModalOpen(true); }} className={`p-2 ${isEmbedded ? 'bg-charcoal text-gray-500 hover:text-white' : 'bg-slate-800 text-slate-400 hover:text-white'} rounded-lg`}><Edit2 size={16} /></button>
                                          <button onClick={() => deleteProduct(product.id)} className={`p-2 ${isEmbedded ? 'bg-charcoal' : 'bg-slate-800'} rounded-lg text-rose-500/50 hover:text-rose-500`}><Trash2 size={16} /></button>
                                        </div>
                                      </div>
                                      <div className={`flex items-center justify-between pt-4 border-t ${isEmbedded ? 'border-surface-light/50' : 'border-slate-800/50'}`}>
                                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${product.disponibile ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                                          {product.disponibile ? 'Disponibile' : 'Esaurito'}
                                        </span>
                                        <button onClick={() => toggleAvailability(product.id, product.disponibile)}
                                          className={`p-1 rounded-md transition-colors ${product.disponibile ? 'text-emerald-500' : 'text-slate-600'}`}>
                                          {product.disponibile ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          });
                        })()
                      ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {filteredProducts.map(product => (
                            <div key={product.id} className={`group relative ${isEmbedded ? 'bg-surface border-surface-light hover:border-gold/30' : 'bg-slate-900 border-slate-800 hover:border-slate-700'} border rounded-2xl p-5 transition-all`}>
                               <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h4 className={`font-bold text-white ${isEmbedded ? 'group-hover:text-gold' : 'group-hover:text-indigo-400'} transition-colors uppercase text-sm`}>{product.nome}</h4>
                                    <p className={`${isEmbedded ? 'text-gold' : 'text-indigo-400'} font-black mt-1`}>€{product.prezzo.toFixed(2)}</p>
                                    {product.ingredienti.length > 0 && (
                                      <p className={`text-[9px] ${isEmbedded ? 'text-gray-500' : 'text-slate-500'} mt-1.5`}>{product.ingredienti.join(', ')}</p>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => { setEditingProduct(product); setIsModalOpen(true); }} className={`p-2 ${isEmbedded ? 'bg-charcoal text-gray-500 hover:text-white' : 'bg-slate-800 text-slate-400 hover:text-white'} rounded-lg`}><Edit2 size={16} /></button>
                                    <button onClick={() => deleteProduct(product.id)} className={`p-2 ${isEmbedded ? 'bg-charcoal' : 'bg-slate-800'} rounded-lg text-rose-500/50 hover:text-rose-500`}><Trash2 size={16} /></button>
                                </div>
                             </div>
                             
                             <div className={`flex items-center justify-between pt-4 border-t ${isEmbedded ? 'border-surface-light/50' : 'border-slate-800/50'}`}>
                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${product.disponibile ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                                    {product.disponibile ? 'Disponibile' : 'Esaurito'}
                                </span>
                                <button 
                                    onClick={() => toggleAvailability(product.id, product.disponibile)}
                                    className={`p-1 rounded-md transition-colors ${product.disponibile ? 'text-emerald-500' : 'text-slate-600'}`}
                                >
                                    {product.disponibile ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                                </button>
                             </div>
                          </div>
                        ))}
                    </div>
                      )}
                    </section>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'ingredients' && (
            <div className="max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
              <header className="mb-8 flex justify-between items-center">
                <div>
                  <h2 className="text-3xl font-bold text-white mb-2">Gestione Aggiunte</h2>
                  <p className={isEmbedded ? 'text-gray-500' : 'text-slate-400'}>Modifica i prezzi e la disponibilità degli ingredienti extra.</p>
                </div>
                <div className="flex gap-4">
                  <div className="relative w-64">
                    <Search className={`absolute left-4 top-1/2 -translate-y-1/2 ${isEmbedded ? 'text-gray-500' : 'text-slate-500'}`} size={18} />
                    <input 
                      type="text" 
                      placeholder="Cerca aggiunta..."
                      value={ingredientSearch}
                      onChange={e => setIngredientSearch(e.target.value)}
                      className={`w-full ${isEmbedded ? 'bg-charcoal border-surface-light focus:border-gold' : 'bg-slate-950 border-slate-800 focus:border-emerald-500'} border rounded-2xl py-3 pl-12 pr-4 text-white font-bold outline-none transition-all text-sm`}
                    />
                  </div>
                  <button 
                      onClick={() => { setEditingIngredient(null); setIsIngredientsModalOpen(true); }}
                      className={`${isEmbedded ? 'bg-gold text-black' : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20'} font-bold py-3 px-6 rounded-2xl flex items-center gap-2 transition-all`}
                  >
                      <Plus size={20} /> Nuova Aggiunta
                  </button>
                </div>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {ingredients
                    .filter(ing => ing.nome.toLowerCase().includes(ingredientSearch.toLowerCase()))
                    .map(ing => (
                    <div key={ing.id} className={`group relative ${isEmbedded ? 'bg-surface border-surface-light hover:border-gold/30' : 'bg-slate-900 border-slate-800 hover:border-slate-700'} border rounded-2xl p-5 transition-all`}>
                       <div className="flex justify-between items-start mb-4">
                          <div>
                              <h4 className={`font-bold text-white ${isEmbedded ? 'group-hover:text-gold' : 'group-hover:text-emerald-400'} transition-colors uppercase text-sm`}>{ing.nome}</h4>
                          </div>
                          <div className="flex gap-2">
                              <button onClick={() => { setEditingIngredient(ing); setIsIngredientsModalOpen(true); }} className={`p-2 ${isEmbedded ? 'bg-charcoal text-gray-500 hover:text-white' : 'bg-slate-800 text-slate-400 hover:text-white'} rounded-lg`}><Edit2 size={16} /></button>
                              <button onClick={() => deleteIngredient(ing.id)} className={`p-2 ${isEmbedded ? 'bg-charcoal' : 'bg-slate-800'} rounded-lg text-rose-500/50 hover:text-rose-500`}><Trash2 size={16} /></button>
                          </div>
                       </div>
                       
                       <div className={`flex items-center justify-between pt-4 border-t ${isEmbedded ? 'border-surface-light/50' : 'border-slate-800/50'}`}>
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-black ${isEmbedded ? 'text-gray-500' : 'text-slate-500'} uppercase`}>Prezzo</span>
                            <input 
                              type="text"
                              inputMode="decimal"
                              value={additionPriceDrafts[ing.id] ?? (ing.prezzo ?? 0).toFixed(2)}
                              onChange={e => setAdditionPriceDrafts(prev => ({ ...prev, [ing.id]: e.target.value }))}
                              onBlur={e => {
                                const raw = e.target.value.replace(',', '.');
                                const val = parseFloat(raw);
                                if (!isNaN(val) && val >= 0) {
                                  supabase?.from('ingredienti').update({ prezzo: val }).eq('id', ing.id).then(() => fetchIngredients());
                                  setAdditionPriceDrafts(prev => ({ ...prev, [ing.id]: val.toFixed(2) }));
                                } else {
                                  setAdditionPriceDrafts(prev => ({ ...prev, [ing.id]: (ing.prezzo ?? 0).toFixed(2) }));
                                }
                              }}
                              className={`w-20 ${isEmbedded ? 'bg-charcoal border-surface-light focus:border-gold text-gold' : 'bg-slate-950 border-slate-800 focus:border-emerald-500 text-emerald-400'} border rounded-lg py-1.5 px-2 font-bold text-xs text-center outline-none transition-all`}
                            />
                            <span className={`text-[10px] font-black ${isEmbedded ? 'text-gray-500' : 'text-slate-500'}`}>€</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${ing.disponibile ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                                {ing.disponibile ? 'Disponibile' : 'Esaurito'}
                            </span>
                            <button 
                                onClick={() => toggleIngredientAvailability(ing.id, ing.disponibile)}
                                className={`p-1 rounded-md transition-colors ${ing.disponibile ? 'text-emerald-500' : 'text-slate-600'}`}
                            >
                                {ing.disponibile ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                            </button>
                          </div>
                       </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {activeTab === 'removals' && (
            <div className="max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
              <header className="mb-8 flex justify-between items-center">
                <div>
                  <h2 className="text-3xl font-bold text-white mb-2">Gestione Rimozioni</h2>
                  <p className={isEmbedded ? 'text-gray-500' : 'text-slate-400'}>Imposta lo sconto per la rimozione di ogni ingrediente.</p>
                </div>
                <div className="relative w-64">
                  <Search className={`absolute left-4 top-1/2 -translate-y-1/2 ${isEmbedded ? 'text-gray-500' : 'text-slate-500'}`} size={18} />
                  <input 
                    type="text" 
                    placeholder="Cerca ingrediente..."
                    value={ingredientSearch}
                    onChange={e => setIngredientSearch(e.target.value)}
                    className={`w-full ${isEmbedded ? 'bg-charcoal border-surface-light focus:border-gold' : 'bg-slate-950 border-slate-800 focus:border-rose-500'} border rounded-2xl py-3 pl-12 pr-4 text-white font-bold outline-none transition-all text-sm`}
                  />
                </div>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {ingredients
                    .filter(ing => ing.nome.toLowerCase().includes(ingredientSearch.toLowerCase()))
                    .map(ing => (
                    <div key={ing.id} className={`group relative ${isEmbedded ? 'bg-surface border-surface-light hover:border-gold/30' : 'bg-slate-900 border-slate-800 hover:border-slate-700'} border rounded-2xl p-5 transition-all`}>
                       <div className="flex justify-between items-start mb-4">
                          <div>
                              <h4 className={`font-bold text-white ${isEmbedded ? 'group-hover:text-gold' : 'group-hover:text-rose-400'} transition-colors uppercase text-sm`}>{ing.nome}</h4>
                              <p className="text-rose-400 font-black mt-1">-€{(ing.prezzo_rimozione || 0).toFixed(2)}</p>
                          </div>
                       </div>
                       
                       <div className={`flex items-center justify-between pt-4 border-t ${isEmbedded ? 'border-surface-light/50' : 'border-slate-800/50'}`}>
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-black ${isEmbedded ? 'text-gray-500' : 'text-slate-500'} uppercase`}>Riduzione</span>
                            <input 
                              type="text"
                              inputMode="decimal"
                              value={removalPriceDrafts[ing.id] ?? (ing.prezzo_rimozione ?? 0).toFixed(2)}
                              onChange={e => setRemovalPriceDrafts(prev => ({ ...prev, [ing.id]: e.target.value }))}
                              onBlur={e => {
                                const raw = e.target.value.replace(',', '.');
                                const val = parseFloat(raw);
                                if (!isNaN(val) && val >= 0) {
                                  supabase?.from('ingredienti').update({ prezzo_rimozione: val }).eq('id', ing.id).then(() => fetchIngredients());
                                  setRemovalPriceDrafts(prev => ({ ...prev, [ing.id]: val.toFixed(2) }));
                                } else {
                                  setRemovalPriceDrafts(prev => ({ ...prev, [ing.id]: (ing.prezzo_rimozione ?? 0).toFixed(2) }));
                                }
                              }}
                              className={`w-20 ${isEmbedded ? 'bg-charcoal border-surface-light focus:border-gold' : 'bg-slate-950 border-slate-800 focus:border-rose-500'} border rounded-lg py-1.5 px-2 text-white font-bold text-xs text-center outline-none transition-all`}
                            />
                            <span className={`text-[10px] font-black ${isEmbedded ? 'text-gray-500' : 'text-slate-500'}`}>€</span>
                          </div>
                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${ing.disponibile ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                              {ing.disponibile ? 'Disponibile' : 'Esaurito'}
                          </span>
                       </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {activeTab === 'variants' && (
            <div className={`max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500`}>
              <header className="mb-8 flex justify-between items-center">
                <div>
                  <h2 className="text-3xl font-bold text-white mb-2">Gestione Varianti</h2>
                  <p className={isEmbedded ? 'text-gray-500' : 'text-slate-400'}>Modifica le varianti rapide per ogni categoria di piatti.</p>
                </div>
                <div className="flex gap-3">
                  <select
                    value={variantCategoryFilter || ''}
                    onChange={e => setVariantCategoryFilter(e.target.value || null)}
                    className={`${isEmbedded ? 'bg-charcoal border-surface-light focus:border-gold' : 'bg-slate-950 border-slate-800 focus:border-sky-500'} border rounded-xl py-2.5 px-4 text-white font-bold text-sm outline-none transition-all`}
                  >
                    <option value="">Tutte le categorie</option>
                    <option value="Pizze">Pizze</option>
                    <option value="Antipasti">Antipasti</option>
                    <option value="Primi">Primi</option>
                    <option value="Secondi">Secondi</option>
                    <option value="Contorni">Contorni</option>
                  </select>
                  <button
                    onClick={() => {
                      const newV: ProductVariant = {
                        id: `v_${Date.now()}`,
                        label: '',
                        price: 0,
                        categories: variantCategoryFilter || 'Antipasti',
                        section: 'EXTRA',
                        style: 'gold',
                        stackable: false,
                        order: variants.length + 1,
                      };
                      persistVariants([...variants, newV]);
                      setVariantEditingId(newV.id);
                      setVariantEditDraft(newV);
                    }}
                    className={`${isEmbedded ? 'bg-gold text-black' : 'bg-sky-500 hover:bg-sky-400 text-white shadow-lg shadow-sky-500/20'} font-bold py-2.5 px-5 rounded-2xl flex items-center gap-2 transition-all`}
                  >
                    <Plus size={18} /> Nuova Variante
                  </button>
                </div>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {variants
                  .filter(v => !variantCategoryFilter || v.categories.includes(variantCategoryFilter))
                  .map(v => {
                    const isEditing = variantEditingId === v.id;
                    return (
                      <div key={v.id} className={`group relative ${isEmbedded ? 'bg-surface border-surface-light hover:border-gold/30' : 'bg-slate-900 border-slate-800 hover:border-sky-700'} border rounded-2xl p-5 transition-all ${isEditing ? (isEmbedded ? 'ring-2 ring-gold/40 border-gold/30' : 'ring-2 ring-sky-400/40 border-sky-500/30') : ''}`}>
                        {isEditing ? (
                          <div className="space-y-3">
                            <input
                              type="text"
                              value={variantEditDraft.label ?? ''}
                              onChange={e => setVariantEditDraft(prev => ({ ...prev, label: e.target.value }))}
                              placeholder="Nome variante"
                              className={`w-full ${isEmbedded ? 'bg-charcoal border-surface-light focus:border-gold' : 'bg-slate-950 border-slate-800 focus:border-sky-500'} border rounded-xl py-2 px-3 text-white font-bold text-sm outline-none transition-all`}
                            />
                            <div className="flex gap-2">
                              <div className="flex-1">
                                <label className={`text-[9px] font-black ${isEmbedded ? 'text-gray-500' : 'text-slate-500'} uppercase mb-1 block`}>Prezzo</label>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={variantEditDraft.price ?? 0}
                                  onChange={e => {
                                    const raw = e.target.value.replace(',', '.');
                                    const val = parseFloat(raw);
                                    setVariantEditDraft(prev => ({ ...prev, price: isNaN(val) ? 0 : val }));
                                  }}
                                  className={`w-full ${isEmbedded ? 'bg-charcoal border-surface-light focus:border-gold' : 'bg-slate-950 border-slate-800 focus:border-sky-500'} border rounded-lg py-1.5 px-2 text-white font-bold text-xs text-center outline-none transition-all`}
                                />
                              </div>
                              <div className="flex-1">
                                <label className={`text-[9px] font-black ${isEmbedded ? 'text-gray-500' : 'text-slate-500'} uppercase mb-1 block`}>Ordine</label>
                                <input
                                  type="number"
                                  value={variantEditDraft.order ?? 0}
                                  onChange={e => setVariantEditDraft(prev => ({ ...prev, order: parseInt(e.target.value) || 0 }))}
                                  className={`w-full ${isEmbedded ? 'bg-charcoal border-surface-light focus:border-gold' : 'bg-slate-950 border-slate-800 focus:border-sky-500'} border rounded-lg py-1.5 px-2 text-white font-bold text-xs text-center outline-none transition-all`}
                                />
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <div className="flex-1">
                                <label className={`text-[9px] font-black ${isEmbedded ? 'text-gray-500' : 'text-slate-500'} uppercase mb-1 block`}>Sezione</label>
                                <select
                                  value={variantEditDraft.section ?? 'EXTRA'}
                                  onChange={e => setVariantEditDraft(prev => ({ ...prev, section: e.target.value }))}
                                  className={`w-full ${isEmbedded ? 'bg-charcoal border-surface-light focus:border-gold' : 'bg-slate-950 border-slate-800 focus:border-sky-500'} border rounded-lg py-1.5 px-2 text-white font-bold text-xs outline-none transition-all`}
                                >
                                  <option value="VARIANTI RAPIDE">VARIANTI RAPIDE</option>
                                  <option value="MODIFICHE">MODIFICHE</option>
                                  <option value="COTTURA">COTTURA</option>
                                  <option value="GLASSA / CONDIMENTI">GLASSA / CONDIMENTI</option>
                                  <option value="PREPARAZIONE">PREPARAZIONE</option>
                                  <option value="EXTRA">EXTRA</option>
                                  <option value="CONDIMENTI">CONDIMENTI</option>
                                </select>
                              </div>
                              <div className="flex-1">
                                <label className={`text-[9px] font-black ${isEmbedded ? 'text-gray-500' : 'text-slate-500'} uppercase mb-1 block`}>Stile</label>
                                <select
                                  value={variantEditDraft.style ?? 'gold'}
                                  onChange={e => setVariantEditDraft(prev => ({ ...prev, style: e.target.value as 'gold' | 'emerald' | 'rose' }))}
                                  className={`w-full ${isEmbedded ? 'bg-charcoal border-surface-light focus:border-gold' : 'bg-slate-950 border-slate-800 focus:border-sky-500'} border rounded-lg py-1.5 px-2 text-white font-bold text-xs outline-none transition-all`}
                                >
                                  <option value="gold">Gold</option>
                                  <option value="emerald">Emerald</option>
                                  <option value="rose">Rose</option>
                                </select>
                              </div>
                            </div>
                            <div className="flex gap-3">
                              <div className="flex-1">
                                <label className={`text-[9px] font-black ${isEmbedded ? 'text-gray-500' : 'text-slate-500'} uppercase mb-1 block`}>Categorie</label>
                                <input
                                  type="text"
                                  value={variantEditDraft.categories ?? ''}
                                  onChange={e => setVariantEditDraft(prev => ({ ...prev, categories: e.target.value }))}
                                  placeholder="es: Pizze Rosse,Antipasti"
                                  className={`w-full ${isEmbedded ? 'bg-charcoal border-surface-light focus:border-gold' : 'bg-slate-950 border-slate-800 focus:border-sky-500'} border rounded-lg py-1.5 px-2 text-white font-bold text-xs outline-none transition-all`}
                                />
                              </div>
                              <div className="flex items-end pb-1">
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <span className={`text-[9px] font-black ${isEmbedded ? 'text-gray-500' : 'text-slate-500'} uppercase`}>Stackable</span>
                                  <input
                                    type="checkbox"
                                    checked={variantEditDraft.stackable ?? false}
                                    onChange={e => setVariantEditDraft(prev => ({ ...prev, stackable: e.target.checked }))}
                                    className="w-4 h-4 rounded accent-emerald-500"
                                  />
                                </label>
                              </div>
                            </div>
                            <div className="flex gap-2 pt-2">
                              <button
                                onClick={() => {
                                  if (variantEditDraft.label?.trim()) {
                                    persistVariants(variants.map(x => x.id === v.id ? { ...v, ...variantEditDraft } as ProductVariant : x));
                                    setVariantEditingId(null);
                                    setVariantEditDraft({});
                                  }
                                }}
                                className={`flex-1 ${isEmbedded ? 'bg-emerald-500 text-black' : 'bg-emerald-500 hover:bg-emerald-400 text-white'} font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1 transition-all`}
                              >
                                <Save size={14} /> Salva
                              </button>
                              <button
                                onClick={() => {
                                  if (!v.label) {
                                    persistVariants(variants.filter(x => x.id !== v.id));
                                  }
                                  setVariantEditingId(null);
                                  setVariantEditDraft({});
                                }}
                                className={`flex-1 ${isEmbedded ? 'bg-charcoal border border-surface-light text-gray-500' : 'bg-slate-800 border border-slate-700 text-slate-400'} font-bold py-2 rounded-xl text-xs transition-all`}
                              >
                                Annulla
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex justify-between items-start mb-3">
                              <div>
                                <h4 className={`font-bold text-white ${isEmbedded ? 'group-hover:text-gold' : 'group-hover:text-sky-400'} transition-colors uppercase text-sm`}>{v.label || '(senza nome)'}</h4>
                                <p className="text-xs text-gray-500 mt-0.5 font-medium">{v.categories}</p>
                              </div>
                              <div className="flex gap-1">
                                <button
                                  onClick={() => { setVariantEditingId(v.id); setVariantEditDraft({ ...v }); }}
                                  className={`p-1.5 rounded-lg ${isEmbedded ? 'hover:bg-charcoal text-gray-500 hover:text-gold' : 'hover:bg-slate-800 text-slate-500 hover:text-sky-400'} transition-all`}
                                >
                                  <Edit2 size={14} />
                                </button>
                                <button
                                  onClick={() => persistVariants(variants.filter(x => x.id !== v.id))}
                                  className={`p-1.5 rounded-lg ${isEmbedded ? 'hover:bg-charcoal text-gray-500 hover:text-red-400' : 'hover:bg-slate-800 text-slate-500 hover:text-red-400'} transition-all`}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${v.style === 'gold' ? 'bg-gold/10 text-gold' : v.style === 'emerald' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                                {v.section}
                              </span>
                              {v.price > 0 && (
                                <span className="text-[10px] font-black text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">+€{v.price.toFixed(2)}</span>
                              )}
                              {v.stackable && (
                                <span className="text-[10px] font-black text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full">Stackable</span>
                              )}
                              <span className="text-[10px] text-gray-600 font-bold px-2 py-0.5">ord. {v.order}</span>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
              </div>

              <div className="mt-8 flex justify-center">
                <button
                  onClick={() => {
                    persistVariants(getProductVariants());
                    setVariantEditingId(null);
                    setVariantEditDraft({});
                  }}
                  className={`${isEmbedded ? 'text-gray-500 hover:text-red-400 border-surface-light hover:border-red-400/30' : 'text-slate-500 hover:text-red-400 border-slate-800 hover:border-red-400/30'} border rounded-xl py-2 px-6 text-xs font-bold transition-all`}
                >
                  Ripristina varianti predefinite
                </button>
              </div>
            </div>
          )}

          {/* New/Edit Product Modal */}
          {isModalOpen && (
              <div className={`fixed inset-0 z-50 flex items-center justify-center p-6 ${isEmbedded ? 'bg-black/80' : 'bg-slate-950/80'} backdrop-blur-md animate-in fade-in duration-200`}>
                  <div className={`${isEmbedded ? 'bg-surface border-surface-light' : 'bg-slate-900 border-slate-800'} border w-full max-w-lg rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200`}>
                      <div className={`p-8 border-b ${isEmbedded ? 'border-surface-light bg-surface-light/20' : 'border-slate-800 bg-slate-800/20'} flex justify-between items-center`}>
                          <h3 className="text-2xl font-bold text-white italic uppercase tracking-tighter">
                              {editingProduct ? 'Modifica' : 'Nuovo'} <span className={isEmbedded ? 'text-gold' : 'text-indigo-400'}>Piatto</span>
                          </h3>
                          <button onClick={() => setIsModalOpen(false)} className={`p-2 ${isEmbedded ? 'text-gray-500 hover:text-white' : 'text-slate-500 hover:text-white'}`}><X size={24} /></button>
                      </div>
                      
                      <div className="p-8 space-y-6">
                          <div>
                              <label className={`block text-xs font-black ${isEmbedded ? 'text-gray-500' : 'text-slate-500'} uppercase mb-2`}>Nome Piatto</label>
                              <input 
                                type="text" 
                                value={editingProduct ? editingProduct.nome : newProduct.nome}
                                onChange={e => editingProduct ? setEditingProduct({...editingProduct, nome: e.target.value}) : setNewProduct({...newProduct, nome: e.target.value})}
                                className={`w-full ${isEmbedded ? 'bg-charcoal border-surface-light focus:border-gold' : 'bg-slate-950 border-slate-800 focus:border-indigo-500'} border rounded-xl py-3 px-4 text-white outline-none`}
                                placeholder="Esempio: Linguine allo Scoglio"
                              />
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                              <div>
                                  <label className={`block text-xs font-black ${isEmbedded ? 'text-gray-500' : 'text-slate-500'} uppercase mb-2`}>Prezzo (€)</label>
                                    <input 
                                      type="text"
                                      inputMode="decimal"
                                      value={productPriceDraft}
                                      onChange={e => setProductPriceDraft(e.target.value)}
                                      onBlur={e => {
                                        const raw = e.target.value.replace(',', '.');
                                        const val = parseFloat(raw);
                                        if (!isNaN(val) && val >= 0) {
                                          if (editingProduct) setEditingProduct({...editingProduct, prezzo: val}); else setNewProduct({...newProduct, prezzo: val});
                                          setProductPriceDraft(String(val));
                                        } else {
                                          setProductPriceDraft(String(editingProduct?.prezzo ?? newProduct.prezzo ?? 0));
                                        }
                                      }}
                                      className={`w-full ${isEmbedded ? 'bg-charcoal border-surface-light focus:border-gold' : 'bg-slate-950 border-slate-800 focus:border-indigo-500'} border rounded-xl py-3 px-4 text-white outline-none`}
                                    />
                              </div>
                              <div>
                                  <label className={`block text-xs font-black ${isEmbedded ? 'text-gray-500' : 'text-slate-500'} uppercase mb-2`}>Categoria</label>
                                  <select 
                                    value={editingProduct ? editingProduct.categoria : newProduct.categoria}
                                    onChange={e => {
                                      const cat = e.target.value;
                                      const hasSub = cat === 'Bevande' || cat === 'Caffè e Liquori';
                                      if (editingProduct) {
                                        setEditingProduct({...editingProduct, categoria: cat, sottocategoria: hasSub ? editingProduct.sottocategoria || '' : ''});
                                      } else {
                                        setNewProduct({...newProduct, categoria: cat, sottocategoria: hasSub ? newProduct.sottocategoria || '' : ''});
                                      }
                                    }}
                                    className={`w-full ${isEmbedded ? 'bg-charcoal border-surface-light focus:border-gold' : 'bg-slate-950 border-slate-800 focus:border-indigo-500'} border rounded-xl py-3 px-4 text-white outline-none appearance-none`}
                                  >
                                      {allCategories.map(c => (
                                          <option key={c} value={c}>{c}</option>
                                      ))}
                                  </select>
                              </div>
                          </div>

                          {['Bevande', 'Caffè e Liquori'].includes(editingProduct ? editingProduct.categoria ?? '' : newProduct.categoria ?? '') && (
                            <div>
                              <label className={`block text-xs font-black ${isEmbedded ? 'text-gray-500' : 'text-slate-500'} uppercase mb-2`}>Sotto-Categoria</label>
                              <select
                                value={editingProduct ? editingProduct.sottocategoria || '' : newProduct.sottocategoria || ''}
                                onChange={e => {
                                  const sub = e.target.value;
                                  if (editingProduct) setEditingProduct({...editingProduct, sottocategoria: sub}); else setNewProduct({...newProduct, sottocategoria: sub});
                                }}
                                className={`w-full ${isEmbedded ? 'bg-charcoal border-surface-light focus:border-gold' : 'bg-slate-950 border-slate-800 focus:border-indigo-500'} border rounded-xl py-3 px-4 text-white outline-none appearance-none`}
                              >
                                <option value="">Nessuna</option>
                                {(editingProduct ? editingProduct.categoria : newProduct.categoria) === 'Bevande' ? (
                                  <>
                                    <option value="Acqua">Acqua</option>
                                    <option value="Bibite">Bibite</option>
                                    <option value="Vini della Casa">Vini della Casa</option>
                                    <option value="Birra alla Spina">Birra alla Spina</option>
                                    <option value="Birra in Vetro">Birra in Vetro</option>
                                    <option value="Senza Glutine">Senza Glutine</option>
                                    <option value="Analcolica">Analcolica</option>
                                    <option value="Vini Bottiglia">Vini Bottiglia</option>
                                  </>
                                ) : (
                                  <>
                                    <option value="Caffè">Caffè</option>
                                    <option value="Amari e Liquori">Amari e Liquori</option>
                                  </>
                                )}
                              </select>
                            </div>
                          )}

                          <div>
                              <label className={`block text-xs font-black ${isEmbedded ? 'text-gray-500' : 'text-slate-500'} uppercase mb-2`}>Immagine</label>
                              <div className="flex items-center gap-4">
                                {(editingProduct?.immagine || newProduct.immagine) ? (
                                  <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-surface-light">
                                    <img src={editingProduct?.immagine || newProduct.immagine} alt="" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                    <button
                                      onClick={() => {
                                        if (editingProduct) setEditingProduct({...editingProduct, immagine: undefined});
                                        else setNewProduct({...newProduct, immagine: undefined});
                                      }}
                                      className="absolute top-0.5 right-0.5 p-0.5 bg-red-500/80 rounded-full text-white"
                                    ><X size={12} /></button>
                                  </div>
                                ) : null}
                                <div className="flex flex-col gap-2">
                                  <label className={`cursor-pointer flex items-center gap-2 px-4 py-2 rounded-xl ${isEmbedded ? 'bg-charcoal border-surface-light' : 'bg-slate-950 border-slate-800'} border text-xs font-black ${isEmbedded ? 'text-gray-400 hover:text-white' : 'text-slate-400 hover:text-white'} transition-all`}>
                                    <Upload size={16} />
                                    Carica Foto
                                    <input type="file" accept="image/*" className="hidden" onChange={async e => {
                                      const file = e.target.files?.[0];
                                      if (!file || !supabase) return;
                                      const ext = file.name.split('.').pop();
                                      const fileName = `product_${Date.now()}.${ext}`;
                                      const { error } = await supabase.storage.from('product_images').upload(fileName, file);
                                      if (error) { alert('Errore upload: ' + error.message); return; }
                                      const { data: { publicUrl } } = supabase.storage.from('product_images').getPublicUrl(fileName);
                                      if (editingProduct) setEditingProduct({...editingProduct, immagine: publicUrl});
                                      else setNewProduct({...newProduct, immagine: publicUrl});
                                    }} />
                                  </label>
                                  <input
                                    type="text"
                                    placeholder="Oppure incolla un link..."
                                    value={editingProduct?.immagine || newProduct.immagine || ''}
                                    onChange={e => {
                                      const url = e.target.value.trim();
                                      if (editingProduct) setEditingProduct({...editingProduct, immagine: url || undefined});
                                      else setNewProduct({...newProduct, immagine: url || undefined});
                                    }}
                                    className={`w-full ${isEmbedded ? 'bg-charcoal border-surface-light focus:border-gold' : 'bg-slate-950 border-slate-800 focus:border-indigo-500'} border rounded-xl py-2 px-3 text-white text-[11px] outline-none placeholder:text-gray-600`}
                                  />
                                </div>
                              </div>
                          </div>

                          <div>
                              <label className={`block text-xs font-black ${isEmbedded ? 'text-gray-500' : 'text-slate-500'} uppercase mb-2`}>Allergeni</label>
                              <div className="flex flex-wrap gap-1.5">
                                {ALLERGEN_META.map(({ label, icon, color, bg }) => {
                                  const currentList = (editingProduct?.allergeni || newProduct.allergeni || []);
                                  const isSelected = currentList.includes(label);
                                  return (
                                    <button
                                      key={label}
                                      onClick={() => {
                                        const updated = isSelected ? currentList.filter(a => a !== label) : [...currentList, label];
                                        if (editingProduct) setEditingProduct({...editingProduct, allergeni: updated});
                                        else setNewProduct({...newProduct, allergeni: updated});
                                      }}
                                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${
                                        isSelected
                                          ? 'border-current shadow-sm'
                                          : 'border-transparent opacity-50 hover:opacity-80'
                                      }`}
                                      style={{ color, backgroundColor: isSelected ? bg : 'transparent' }}
                                    >
                                      <span className="text-xs">{icon}</span>
                                      {label}
                                    </button>
                                  );
                                })}
                              </div>
                          </div>

                          <div>
                              <label className={`block text-xs font-black ${isEmbedded ? 'text-gray-500' : 'text-slate-500'} uppercase mb-2`}>Ingredienti (separati da virgola)</label>
                              <textarea 
                                value={editingProduct ? editingProduct.ingredienti?.join(', ') : newProduct.ingredienti?.join(', ')}
                                onChange={e => {
                                    const ings = e.target.value.split(',').map(i => i.trim()).filter(i => i !== '');
                                    if (editingProduct) {
                                      setEditingProduct({ ...editingProduct, ingredienti: ings });
                                    } else {
                                      setNewProduct({ ...newProduct, ingredienti: ings });
                                    }
                                }}
                                className={`w-full ${isEmbedded ? 'bg-charcoal border-surface-light focus:border-gold' : 'bg-slate-950 border-slate-800 focus:border-indigo-500'} border rounded-xl py-3 px-4 text-white outline-none h-24`}
                                placeholder="Pomodoro, Mozzarella, Basilico..."
                              />
                          </div>

                      </div>

                      <div className={`p-8 ${isEmbedded ? 'bg-surface-light/20 border-surface-light' : 'bg-slate-800/20 border-slate-800'} border-t flex flex-col gap-3`}>
                          <button 
                            onClick={handleSaveProduct}
                            className={`w-full ${isEmbedded ? 'bg-gold text-black' : 'bg-indigo-500 hover:bg-indigo-400 text-white shadow-lg shadow-indigo-500/20'} font-bold py-4 rounded-xl flex items-center justify-center gap-2`}
                          >
                            <Save size={20} /> Salva Modifiche
                          </button>
                      </div>
                  </div>
              </div>
          )}

          {/* New/Edit Ingredient Modal */}
          {isIngredientsModalOpen && (
              <div className={`fixed inset-0 z-50 flex items-center justify-center p-6 ${isEmbedded ? 'bg-black/80' : 'bg-slate-950/80'} backdrop-blur-md animate-in fade-in duration-200`}>
                  <div className={`${isEmbedded ? 'bg-surface border-surface-light' : 'bg-slate-900 border-slate-800'} border w-full max-w-lg rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200`}>
                      <div className={`p-8 border-b ${isEmbedded ? 'border-surface-light bg-surface-light/20' : 'border-slate-800 bg-slate-800/20'} flex justify-between items-center`}>
                          <h3 className="text-2xl font-bold text-white italic uppercase tracking-tighter">
                              {editingIngredient ? 'Modifica' : 'Nuova'} <span className={isEmbedded ? 'text-gold' : 'text-emerald-400'}>Aggiunta</span>
                          </h3>
                          <button onClick={() => setIsIngredientsModalOpen(false)} className={`p-2 ${isEmbedded ? 'text-gray-500 hover:text-white' : 'text-slate-500 hover:text-white'}`}><X size={24} /></button>
                      </div>
                      
                      <div className="p-8 space-y-6">
                          <div>
                              <label className={`block text-xs font-black ${isEmbedded ? 'text-gray-500' : 'text-slate-500'} uppercase mb-2`}>Nome Aggiunta</label>
                              <input 
                                type="text" 
                                value={editingIngredient ? editingIngredient.nome : newIngredient.nome}
                                onChange={e => editingIngredient ? setEditingIngredient({...editingIngredient, nome: e.target.value}) : setNewIngredient({...newIngredient, nome: e.target.value})}
                                className={`w-full ${isEmbedded ? 'bg-charcoal border-surface-light focus:border-gold' : 'bg-slate-950 border-slate-800 focus:border-emerald-500'} border rounded-xl py-3 px-4 text-white outline-none`}
                                placeholder="Esempio: Mozzarella di Bufala"
                              />
                          </div>

                          <div>
                               <label className={`block text-xs font-black ${isEmbedded ? 'text-gray-500' : 'text-slate-500'} uppercase mb-2`}>Prezzo Extra (€)</label>
                              <input 
                                type="text"
                                inputMode="decimal"
                                value={ingredientPriceDraft}
                                onChange={e => setIngredientPriceDraft(e.target.value)}
                                onBlur={e => {
                                  const raw = e.target.value.replace(',', '.');
                                  const val = parseFloat(raw);
                                  if (!isNaN(val) && val >= 0) {
                                    if (editingIngredient) setEditingIngredient({...editingIngredient, prezzo: val}); else setNewIngredient({...newIngredient, prezzo: val});
                                    setIngredientPriceDraft(String(val));
                                  } else {
                                    setIngredientPriceDraft(String(editingIngredient?.prezzo ?? newIngredient.prezzo ?? 1.5));
                                  }
                                }}
                                className={`w-full ${isEmbedded ? 'bg-charcoal border-surface-light focus:border-gold' : 'bg-slate-950 border-slate-800 focus:border-emerald-500'} border rounded-xl py-3 px-4 text-white outline-none`}
                              />
                          </div>
                      </div>

                      <div className={`p-8 ${isEmbedded ? 'bg-surface-light/20 border-surface-light' : 'bg-slate-800/20 border-slate-800'} border-t flex flex-col gap-3`}>
                          <button 
                            onClick={handleSaveIngredient}
                            className={`w-full ${isEmbedded ? 'bg-gold text-black' : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20'} font-bold py-4 rounded-xl flex items-center justify-center gap-2`}
                          >
                            <Save size={20} /> Salva Aggiunta
                          </button>
                      </div>
                  </div>
              </div>
          )}
        </main>
      </div>
    </div>
  );
}
