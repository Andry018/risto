import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getCurrentUser, getDefaultRouteForRole } from '../lib/staffAuth';
import { supabase, type Product, type Ingredient, IS_DEMO_MODE } from '../lib/supabase';
import { MOCK_PRODUCTS, MOCK_INGREDIENTS } from '../lib/MockData';
import { List, ToggleLeft, ToggleRight, ChefHat, LayoutDashboard, Plus, Minus, Edit2, Trash2, X, Save, Search } from 'lucide-react';

export default function AdminView() {
  const navigate = useNavigate();
  useEffect(() => {
    const user = getCurrentUser();
    if (user && !['kitchen', 'admin'].includes(user.role)) {
      navigate(getDefaultRouteForRole(user.role), { replace: true });
    }
  }, []);
  const [products, setProducts] = useState<Product[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [activeTab, setActiveTab] = useState<'menu' | 'ingredients' | 'removals'>('menu');
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
  const [menuSearch, setMenuSearch] = useState('');
  const [menuCategory, setMenuCategory] = useState<string | null>(null);
  const [showNewCatInput, setShowNewCatInput] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [extraCategories, setExtraCategories] = useState<string[]>([]);
  const menuCategories = [...new Set(products.map(p => p.categoria).filter(Boolean))].sort((a, b) => {
    const order = ['Antipasti', 'Primi', 'Secondi', 'Contorni', 'Pizze Rosse', 'Pizze Bianche', 'Pizze Speciali', 'Fritti', 'Bevande', 'Caffè e Liquori', 'Dolci', 'EXTRA', 'Servizio'];
    return order.indexOf(a) - order.indexOf(b);
  });
  const allCategories = [...new Set([...menuCategories, ...extraCategories])];
  const [ingredientSearch, setIngredientSearch] = useState('');
  const [isIngredientsModalOpen, setIsIngredientsModalOpen] = useState(false);

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

  return (
    <div className="min-h-screen bg-slate-900 text-slate-300 font-sans selection:bg-indigo-500/30">
      
      {/* Sidebar / Topnav layout */}
      <div className="flex flex-col md:flex-row h-screen overflow-hidden">
        
        {/* Modern Sidebar Nav */}
        <aside className="w-full md:w-72 bg-slate-950 border-r border-slate-800/60 p-6 flex flex-col z-20 shadow-2xl">
          <div className="flex items-center gap-3 mb-12">
            <div className="bg-gradient-to-br from-indigo-500 to-fuchsia-600 p-2.5 rounded-xl shadow-lg shadow-indigo-500/20">
              <ChefHat size={28} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Kitchen<span className="text-indigo-400">Hub</span></h1>
          </div>

          <nav className="space-y-3 flex-1">
            <Link 
              to="/" 
              className="w-full flex items-center gap-3 p-4 rounded-xl text-slate-400 hover:bg-slate-900 hover:text-white transition-all duration-300"
            >
              <LayoutDashboard size={20} />
              Dashboard Principale
            </Link>
            <div className="h-px bg-slate-800/50 my-2" />
            <button 
              onClick={() => setActiveTab('menu')} 
              className={`w-full flex items-center justify-between p-4 rounded-xl transition-all duration-300 ${
                activeTab === 'menu' 
                ? 'bg-slate-800/80 text-white shadow-md border border-slate-700/50' 
                : 'text-slate-400 hover:bg-slate-900 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3 font-medium">
               <List size={20} className={activeTab === 'menu' ? 'text-fuchsia-400' : ''} />
                Disponibilità Menu
              </div>
            </button>
            <button 
              onClick={() => setActiveTab('ingredients')} 
              className={`w-full flex items-center justify-between p-4 rounded-xl transition-all duration-300 ${
                activeTab === 'ingredients' 
                ? 'bg-slate-800/80 text-white shadow-md border border-slate-700/50' 
                : 'text-slate-400 hover:bg-slate-900 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3 font-medium">
                <Plus size={20} className={activeTab === 'ingredients' ? 'text-emerald-400' : ''} />
                Gestione Aggiunte
              </div>
            </button>
            <button 
              onClick={() => setActiveTab('removals')} 
              className={`w-full flex items-center justify-between p-4 rounded-xl transition-all duration-300 ${
                activeTab === 'removals' 
                ? 'bg-slate-800/80 text-white shadow-md border border-slate-700/50' 
                : 'text-slate-400 hover:bg-slate-900 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3 font-medium">
                <Minus size={20} className={activeTab === 'removals' ? 'text-rose-400' : ''} />
                Gestione Rimozioni
              </div>
            </button>
          </nav>
          
          <div className="mt-auto p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-3">
             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping absolute"></div>
             <div className="w-2 h-2 rounded-full bg-emerald-500 relative"></div>
             <span className="text-emerald-400 text-sm font-medium">Sistema Online</span>
          </div>
        </aside>

        {/* Dashboard Content */}
        <main className="flex-1 p-6 md:p-10 overflow-y-auto bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-800 via-slate-900 to-slate-950">
          
          {activeTab === 'menu' && (
            <div className="max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
              <header className="mb-8 flex justify-between items-center">
                <div>
                  <h2 className="text-3xl font-bold text-white mb-2">Gestione Menu</h2>
                  <p className="text-slate-400">Aggiungi o modifica i piatti della giornata.</p>
                </div>
                <div className="flex gap-4">
                  <div className="relative w-64">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                    <input 
                      type="text" 
                      placeholder="Cerca piatto..."
                      value={menuSearch}
                      onChange={e => setMenuSearch(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-3 pl-12 pr-4 text-white font-bold outline-none focus:border-indigo-500 transition-all text-sm"
                    />
                  </div>
                  <button 
                      onClick={() => { setEditingProduct(null); setNewProduct(prev => ({ ...prev, categoria: menuCategory || prev.categoria })); setIsModalOpen(true); }}
                      className="bg-indigo-500 hover:bg-indigo-400 text-white font-bold py-3 px-6 rounded-2xl flex items-center gap-2 transition-all shadow-lg shadow-indigo-500/20"
                  >
                      <Plus size={20} /> Nuovo Piatto
                  </button>
                </div>
              </header>

              {/* Category filter bar */}
              <div className="flex gap-2 overflow-x-auto pb-4 mb-6 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900">
                <button
                  onClick={() => setMenuCategory(null)}
                  className={`shrink-0 px-4 py-2 rounded-xl font-bold text-sm transition-all ${
                    !menuCategory
                      ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  Tutte
                </button>
                {allCategories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setMenuCategory(menuCategory === cat ? null : cat)}
                    className={`shrink-0 px-4 py-2 rounded-xl font-bold text-sm transition-all ${
                      menuCategory === cat
                        ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {cat}
                  </button>
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
                            setExtraCategories(prev => [...prev, name]);
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
                      className="w-40 bg-slate-950 border border-indigo-500/50 rounded-xl py-2 px-3 text-white text-sm outline-none focus:border-indigo-500"
                      autoFocus
                    />
                    <button
                      onClick={() => {
                        if (newCatName.trim()) {
                          const name = newCatName.trim();
                          if (!allCategories.includes(name)) {
                            setExtraCategories(prev => [...prev, name]);
                          }
                          setNewProduct({ ...newProduct, categoria: name });
                          setMenuCategory(name);
                          setShowNewCatInput(false);
                          setNewCatName('');
                        }
                      }}
                      className="p-2 bg-indigo-500 rounded-lg text-white"
                    >
                      <Plus size={16} />
                    </button>
                    <button
                      onClick={() => { setShowNewCatInput(false); setNewCatName(''); }}
                      className="p-2 bg-slate-800 rounded-lg text-slate-400 hover:text-white"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowNewCatInput(true)}
                    className="shrink-0 px-3 py-2 rounded-xl font-bold text-sm bg-slate-800 text-slate-500 hover:text-white hover:bg-slate-700 transition-all"
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
                      <h3 className="text-sm font-black text-slate-500 uppercase tracking-[0.3em] mb-6 flex items-center gap-3">
                          <div className="h-px bg-slate-800 flex-1"></div>
                          {cat}
                          <div className="h-px bg-slate-800 flex-1"></div>
                      </h3>
                      {filteredProducts.some(p => p.sottocategoria) ? (
                        (() => {
                          const subcats = [...new Set(filteredProducts.map(p => p.sottocategoria || 'Altro'))];
                          return subcats.map(sub => {
                            const subProducts = filteredProducts.filter(p => (p.sottocategoria || 'Altro') === sub);
                            return (
                              <div key={sub} className="mb-6">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4 ml-1">{sub}</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                  {subProducts.map(product => (
                                    <div key={product.id} className="group relative bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-all">
                                      <div className="flex justify-between items-start mb-4">
                                        <div>
                                          <h4 className="font-bold text-white group-hover:text-indigo-400 transition-colors uppercase text-sm">{product.nome}</h4>
                                          <p className="text-indigo-400 font-black mt-1">€{product.prezzo.toFixed(2)}</p>
                                          {product.ingredienti.length > 0 && (
                                            <p className="text-[9px] text-slate-500 mt-1.5">{product.ingredienti.join(', ')}</p>
                                          )}
                                        </div>
                                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                          <button onClick={() => { setEditingProduct(product); setIsModalOpen(true); }} className="p-2 bg-slate-800 rounded-lg text-slate-400 hover:text-white"><Edit2 size={16} /></button>
                                          <button onClick={() => deleteProduct(product.id)} className="p-2 bg-slate-800 rounded-lg text-rose-500/50 hover:text-rose-500"><Trash2 size={16} /></button>
                                        </div>
                                      </div>
                                      <div className="flex items-center justify-between pt-4 border-t border-slate-800/50">
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
                            <div key={product.id} className="group relative bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-all">
                               <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h4 className="font-bold text-white group-hover:text-indigo-400 transition-colors uppercase text-sm">{product.nome}</h4>
                                    <p className="text-indigo-400 font-black mt-1">€{product.prezzo.toFixed(2)}</p>
                                    {product.ingredienti.length > 0 && (
                                      <p className="text-[9px] text-slate-500 mt-1.5">{product.ingredienti.join(', ')}</p>
                                    )}
                                </div>
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => { setEditingProduct(product); setIsModalOpen(true); }} className="p-2 bg-slate-800 rounded-lg text-slate-400 hover:text-white"><Edit2 size={16} /></button>
                                    <button onClick={() => deleteProduct(product.id)} className="p-2 bg-slate-800 rounded-lg text-rose-500/50 hover:text-rose-500"><Trash2 size={16} /></button>
                                </div>
                             </div>
                             
                             <div className="flex items-center justify-between pt-4 border-t border-slate-800/50">
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
                  <p className="text-slate-400">Modifica i prezzi e la disponibilità degli ingredienti extra.</p>
                </div>
                <div className="flex gap-4">
                  <div className="relative w-64">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                    <input 
                      type="text" 
                      placeholder="Cerca aggiunta..."
                      value={ingredientSearch}
                      onChange={e => setIngredientSearch(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-3 pl-12 pr-4 text-white font-bold outline-none focus:border-emerald-500 transition-all text-sm"
                    />
                  </div>
                  <button 
                      onClick={() => { setEditingIngredient(null); setIsIngredientsModalOpen(true); }}
                      className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3 px-6 rounded-2xl flex items-center gap-2 transition-all shadow-lg shadow-emerald-500/20"
                  >
                      <Plus size={20} /> Nuova Aggiunta
                  </button>
                </div>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {ingredients
                    .filter(ing => ing.nome.toLowerCase().includes(ingredientSearch.toLowerCase()))
                    .map(ing => (
                    <div key={ing.id} className="group relative bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-all">
                       <div className="flex justify-between items-start mb-4">
                          <div>
                              <h4 className="font-bold text-white group-hover:text-emerald-400 transition-colors uppercase text-sm">{ing.nome}</h4>
                              <p className="text-emerald-400 font-black mt-1">€{(ing.prezzo || 0).toFixed(2)}</p>
                          </div>
                          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => { setEditingIngredient(ing); setIsIngredientsModalOpen(true); }} className="p-2 bg-slate-800 rounded-lg text-slate-400 hover:text-white"><Edit2 size={16} /></button>
                              <button onClick={() => deleteIngredient(ing.id)} className="p-2 bg-slate-800 rounded-lg text-rose-500/50 hover:text-rose-500"><Trash2 size={16} /></button>
                          </div>
                       </div>
                       
                       <div className="flex items-center justify-between pt-4 border-t border-slate-800/50">
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
                  ))}
              </div>
            </div>
          )}

          {activeTab === 'removals' && (
            <div className="max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
              <header className="mb-8 flex justify-between items-center">
                <div>
                  <h2 className="text-3xl font-bold text-white mb-2">Gestione Rimozioni</h2>
                  <p className="text-slate-400">Imposta lo sconto per la rimozione di ogni ingrediente.</p>
                </div>
                <div className="relative w-64">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                  <input 
                    type="text" 
                    placeholder="Cerca ingrediente..."
                    value={ingredientSearch}
                    onChange={e => setIngredientSearch(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-3 pl-12 pr-4 text-white font-bold outline-none focus:border-rose-500 transition-all text-sm"
                  />
                </div>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {ingredients
                    .filter(ing => ing.nome.toLowerCase().includes(ingredientSearch.toLowerCase()))
                    .map(ing => (
                    <div key={ing.id} className="group relative bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-all">
                       <div className="flex justify-between items-start mb-4">
                          <div>
                              <h4 className="font-bold text-white group-hover:text-rose-400 transition-colors uppercase text-sm">{ing.nome}</h4>
                              <p className="text-rose-400 font-black mt-1">-€{(ing.prezzo_rimozione || 0).toFixed(2)}</p>
                          </div>
                       </div>
                       
                       <div className="flex items-center justify-between pt-4 border-t border-slate-800/50">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-slate-500 uppercase">Riduzione</span>
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
                              className="w-20 bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-2 text-white font-bold text-xs text-center outline-none focus:border-rose-500 transition-all"
                            />
                            <span className="text-[10px] font-black text-slate-500">€</span>
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

          {/* New/Edit Product Modal */}
          {isModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
                  <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                      <div className="p-8 border-b border-slate-800 flex justify-between items-center bg-slate-800/20">
                          <h3 className="text-2xl font-bold text-white italic uppercase tracking-tighter">
                              {editingProduct ? 'Modifica' : 'Nuovo'} <span className="text-indigo-400">Piatto</span>
                          </h3>
                          <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-500 hover:text-white"><X size={24} /></button>
                      </div>
                      
                      <div className="p-8 space-y-6">
                          <div>
                              <label className="block text-xs font-black text-slate-500 uppercase mb-2">Nome Piatto</label>
                              <input 
                                type="text" 
                                value={editingProduct ? editingProduct.nome : newProduct.nome}
                                onChange={e => editingProduct ? setEditingProduct({...editingProduct, nome: e.target.value}) : setNewProduct({...newProduct, nome: e.target.value})}
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-white focus:border-indigo-500 outline-none"
                                placeholder="Esempio: Linguine allo Scoglio"
                              />
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                              <div>
                                  <label className="block text-xs font-black text-slate-500 uppercase mb-2">Prezzo (€)</label>
                                    <input 
                                      type="text"
                                      inputMode="decimal"
                                      value={productPriceDraft}
                                      onChange={e => setProductPriceDraft(e.target.value)}
                                      onBlur={e => {
                                        const raw = e.target.value.replace(',', '.');
                                        const val = parseFloat(raw);
                                        if (!isNaN(val) && val >= 0) {
                                          editingProduct ? setEditingProduct({...editingProduct, prezzo: val}) : setNewProduct({...newProduct, prezzo: val});
                                          setProductPriceDraft(String(val));
                                        } else {
                                          setProductPriceDraft(String(editingProduct?.prezzo ?? newProduct.prezzo ?? 0));
                                        }
                                      }}
                                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-white focus:border-indigo-500 outline-none"
                                    />
                              </div>
                              <div>
                                  <label className="block text-xs font-black text-slate-500 uppercase mb-2">Categoria</label>
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
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-white focus:border-indigo-500 outline-none appearance-none"
                                  >
                                      {allCategories.map(c => (
                                          <option key={c} value={c}>{c}</option>
                                      ))}
                                  </select>
                              </div>
                          </div>

                          {['Bevande', 'Caffè e Liquori'].includes(editingProduct ? editingProduct.categoria ?? '' : newProduct.categoria ?? '') && (
                            <div>
                              <label className="block text-xs font-black text-slate-500 uppercase mb-2">Sotto-Categoria</label>
                              <select
                                value={editingProduct ? editingProduct.sottocategoria || '' : newProduct.sottocategoria || ''}
                                onChange={e => {
                                  const sub = e.target.value;
                                  editingProduct ? setEditingProduct({...editingProduct, sottocategoria: sub}) : setNewProduct({...newProduct, sottocategoria: sub});
                                }}
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-white focus:border-indigo-500 outline-none appearance-none"
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
                              <label className="block text-xs font-black text-slate-500 uppercase mb-2">Ingredienti (separati da virgola)</label>
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
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-white focus:border-indigo-500 outline-none h-24"
                                placeholder="Pomodoro, Mozzarella, Basilico..."
                              />
                          </div>

                      </div>

                      <div className="p-8 bg-slate-800/20 border-t border-slate-800 flex flex-col gap-3">
                          <button 
                            onClick={handleSaveProduct}
                            className="w-full bg-indigo-500 hover:bg-indigo-400 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20"
                          >
                            <Save size={20} /> Salva Modifiche
                          </button>
                      </div>
                  </div>
              </div>
          )}

          {/* New/Edit Ingredient Modal */}
          {isIngredientsModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
                  <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                      <div className="p-8 border-b border-slate-800 flex justify-between items-center bg-slate-800/20">
                          <h3 className="text-2xl font-bold text-white italic uppercase tracking-tighter">
                              {editingIngredient ? 'Modifica' : 'Nuova'} <span className="text-emerald-400">Aggiunta</span>
                          </h3>
                          <button onClick={() => setIsIngredientsModalOpen(false)} className="p-2 text-slate-500 hover:text-white"><X size={24} /></button>
                      </div>
                      
                      <div className="p-8 space-y-6">
                          <div>
                              <label className="block text-xs font-black text-slate-500 uppercase mb-2">Nome Aggiunta</label>
                              <input 
                                type="text" 
                                value={editingIngredient ? editingIngredient.nome : newIngredient.nome}
                                onChange={e => editingIngredient ? setEditingIngredient({...editingIngredient, nome: e.target.value}) : setNewIngredient({...newIngredient, nome: e.target.value})}
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-white focus:border-emerald-500 outline-none"
                                placeholder="Esempio: Mozzarella di Bufala"
                              />
                          </div>

                          <div>
                               <label className="block text-xs font-black text-slate-500 uppercase mb-2">Prezzo Extra (€)</label>
                              <input 
                                type="text"
                                inputMode="decimal"
                                value={ingredientPriceDraft}
                                onChange={e => setIngredientPriceDraft(e.target.value)}
                                onBlur={e => {
                                  const raw = e.target.value.replace(',', '.');
                                  const val = parseFloat(raw);
                                  if (!isNaN(val) && val >= 0) {
                                    editingIngredient ? setEditingIngredient({...editingIngredient, prezzo: val}) : setNewIngredient({...newIngredient, prezzo: val});
                                    setIngredientPriceDraft(String(val));
                                  } else {
                                    setIngredientPriceDraft(String(editingIngredient?.prezzo ?? newIngredient.prezzo ?? 1.5));
                                  }
                                }}
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-white focus:border-emerald-500 outline-none"
                              />
                          </div>
                      </div>

                      <div className="p-8 bg-slate-800/20 border-t border-slate-800 flex flex-col gap-3">
                          <button 
                            onClick={handleSaveIngredient}
                            className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
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
