import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase, type Order, type Product, type Ingredient, IS_DEMO_MODE } from '../lib/supabase';
import { MOCK_PRODUCTS, MOCK_INGREDIENTS, MOCK_ORDERS } from '../lib/MockData';
import { CheckCircle, Clock, LayoutGrid, List, ToggleLeft, ToggleRight, ChefHat, Bell, LayoutDashboard, Plus, Edit2, Trash2, X, Save, Search } from 'lucide-react';

export default function AdminView() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [activeTab, setActiveTab] = useState<'orders' | 'menu' | 'ingredients'>('orders');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [newProduct, setNewProduct] = useState<Partial<Product>>({
    nome: '',
    prezzo: 0,
    categoria: 'Antipasti',
    disponibile: true,
    ingredienti: []
  });
  const [editingIngredient, setEditingIngredient] = useState<Partial<Ingredient> | null>(null);
  const [newIngredient, setNewIngredient] = useState<Partial<Ingredient>>({
    nome: '',
    prezzo: 1.5,
    disponibile: true
  });

  const [menuSearch, setMenuSearch] = useState('');
  const [ingredientSearch, setIngredientSearch] = useState('');

  useEffect(() => {
    if (IS_DEMO_MODE) {
      setOrders(MOCK_ORDERS);
      setProducts(MOCK_PRODUCTS);
      setIngredients(MOCK_INGREDIENTS);
      return;
    }
    fetchOrders();
    fetchProducts();
    fetchIngredients();

    const ordersChannel = supabase
      .channel('public:ordini')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ordini' }, (payload) => {
        setOrders(current => [payload.new as Order, ...current]);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'ordini' }, (payload) => {
        setOrders(current => current.map(o => o.id === payload.new.id ? payload.new as Order : o));
      })
      .subscribe();

    const productsChannel = supabase
      .channel('public:prodotti')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'prodotti' }, (payload) => {
        setProducts(current => current.map(p => p.id === payload.new.id ? { ...p, disponibile: payload.new.disponibile } : p));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(productsChannel);
    };
  }, []);

  async function fetchOrders() {
    const { data } = await supabase.from('ordini').select('*').order('created_at', { ascending: false });
    if (data) setOrders(data);
  }

  async function fetchProducts() {
    const { data } = await supabase.from('prodotti').select('*').order('categoria', { ascending: true }).order('nome', { ascending: true });
    if (data) setProducts(data);
  }
  
  async function fetchIngredients() {
    const { data } = await supabase.from('ingredienti').select('*').order('nome', { ascending: true });
    if (data) setIngredients(data);
  }

  const markAsReady = async (id: string) => {
    await supabase.from('ordini').update({ status: 'COMPLETATO' }).eq('id', id);
  };

  const toggleAvailability = async (id: string, currentStatus: boolean) => {
    await supabase.from('prodotti').update({ disponibile: !currentStatus }).eq('id', id);
  };

  const toggleIngredientAvailability = async (id: string, currentStatus: boolean) => {
    await supabase.from('ingredienti').update({ disponibile: !currentStatus }).eq('id', id);
    fetchIngredients();
  };

  const handleSaveProduct = async () => {
    const productData = editingProduct || newProduct;
    if (!productData.nome || !productData.prezzo) return;

    if (editingProduct && editingProduct.id) {
        await supabase.from('prodotti').update(productData).eq('id', editingProduct.id);
    } else {
        await supabase.from('prodotti').insert([productData]);
    }
    
    setIsModalOpen(false);
    setEditingProduct(null);
    setNewProduct({ nome: '', prezzo: 0, categoria: 'Antipasti', disponibile: true, ingredienti: [] });
    fetchProducts();
  };

  const handleSaveIngredient = async () => {
    const ingData = editingIngredient || newIngredient;
    if (!ingData.nome) return;

    if (editingIngredient && editingIngredient.id) {
        await supabase.from('ingredienti').update(ingData).eq('id', editingIngredient.id);
    } else {
        await supabase.from('ingredienti').insert([ingData]);
    }
    
    setIsIngredientsModalOpen(false);
    setEditingIngredient(null);
    setNewIngredient({ nome: '', prezzo: 1.5, disponibile: true });
    fetchIngredients();
  };

  const deleteIngredient = async (id: string) => {
    if (confirm('Sei sicuro di voler eliminare questa aggiunta?')) {
        await supabase.from('ingredienti').delete().eq('id', id);
        fetchIngredients();
    }
  };

  const [isIngredientsModalOpen, setIsIngredientsModalOpen] = useState(false);

  const deleteProduct = async (id: string) => {
    if (confirm('Sei sicuro di voler eliminare questo prodotto?')) {
        await supabase.from('prodotti').delete().eq('id', id);
        fetchProducts();
    }
  };

  const pendingOrders = orders.filter(o => o.status === 'IN_ATTESA').length;

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
              onClick={() => setActiveTab('orders')} 
              className={`w-full flex items-center justify-between p-4 rounded-xl transition-all duration-300 ${
                activeTab === 'orders' 
                ? 'bg-slate-800/80 text-white shadow-md border border-slate-700/50' 
                : 'text-slate-400 hover:bg-slate-900 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3 font-medium">
                <LayoutGrid size={20} className={activeTab === 'orders' ? 'text-indigo-400' : ''} />
                Gestione Ordini
              </div>
              {pendingOrders > 0 && (
                <span className="bg-rose-500 text-white text-xs font-bold px-2 py-1 rounded-full animate-pulse shadow-[0_0_10px_rgba(244,63,94,0.4)]">
                  {pendingOrders}
                </span>
              )}
            </button>
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
          </nav>
          
          <div className="mt-auto p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-3">
             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping absolute"></div>
             <div className="w-2 h-2 rounded-full bg-emerald-500 relative"></div>
             <span className="text-emerald-400 text-sm font-medium">Sistema Online</span>
          </div>
        </aside>

        {/* Dashboard Content */}
        <main className="flex-1 p-6 md:p-10 overflow-y-auto bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-800 via-slate-900 to-slate-950">
          
          {activeTab === 'orders' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <header className="flex justify-between items-end mb-8">
                <div>
                  <h2 className="text-3xl font-bold text-white mb-2">Code Ordini</h2>
                  <p className="text-slate-400">Gestisci le preparazioni in tempo reale.</p>
                </div>
              </header>

              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {orders.length === 0 && (
                  <div className="col-span-full py-20 flex flex-col items-center justify-center border-2 border-dashed border-slate-800 rounded-3xl backdrop-blur-sm bg-slate-900/50">
                     <Bell size={48} className="text-slate-700 mb-4" />
                     <p className="text-xl font-medium text-slate-500">In attesa del prossimo ordine...</p>
                  </div>
                )}
                
                {orders.map(order => (
                  <div 
                    key={order.id} 
                    className={`relative bg-slate-900 rounded-2xl border transition-all duration-300 flex flex-col ${
                      order.status === 'IN_ATTESA' 
                      ? 'border-indigo-500/30 shadow-[0_0_30px_rgba(99,102,241,0.05)] hover:border-indigo-500/60' 
                      : 'border-emerald-500/20 opacity-60 grayscale hover:grayscale-0'
                    }`}
                  >
                    {order.status === 'IN_ATTESA' && (
                       <div className="absolute -top-3 -right-3 w-6 h-6 bg-indigo-500 rounded-full border-4 border-slate-900 shadow-lg"></div>
                    )}
                    
                    <div className="p-5 border-b border-slate-800 bg-slate-800/30 rounded-t-2xl flex justify-between items-center">
                      <div>
                        <h3 className="font-bold text-xl text-white">{order.nome_cliente}</h3>
                        <p className="text-sm text-indigo-300 flex items-center gap-1.5 mt-1 font-medium bg-indigo-500/10 w-fit px-2.5 py-1 rounded-md">
                          <Clock size={14} /> {order.orario_ritiro}
                        </p>
                      </div>
                      <span className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider ${
                        order.status === 'IN_ATTESA' 
                        ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30' 
                        : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      }`}>
                        {order.status === 'IN_ATTESA' ? 'In Coda' : 'Completato'}
                      </span>
                    </div>
                    
                    <div className="p-6 flex-1 flex flex-col">
                      <ul className="space-y-3 mb-6 flex-1">
                        {order.carrello.map((item: any, idx: number) => (
                          <li key={idx} className="flex justify-between items-center text-slate-300 bg-slate-800/50 rounded-lg px-3 py-2 border border-slate-700/50">
                            <span className="font-medium text-white line-clamp-1">{item.nome}</span>
                            <span className="font-bold text-indigo-300 bg-indigo-500/20 px-2 py-0.5 rounded text-sm">x{item.quantity}</span>
                          </li>
                        ))}
                      </ul>
                      
                      <div className="flex justify-between items-center py-4 border-t border-slate-800 mb-4">
                        <span className="text-slate-500 font-medium">Totale Da Incassare</span>
                        <span className="font-bold text-2xl text-white">€{order.totale.toFixed(2)}</span>
                      </div>
                      
                      {order.status === 'IN_ATTESA' ? (
                        <button 
                          onClick={() => markAsReady(order.id)}
                          className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all duration-300 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 transform hover:-translate-y-0.5"
                        >
                          <CheckCircle size={20} /> Segna Pronto per Ritiro
                        </button>
                      ) : (
                        <button disabled className="w-full border border-slate-700/50 text-slate-500 font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 bg-slate-800/30">
                          Ritiro Effettuato
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

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
                      onClick={() => { setEditingProduct(null); setIsModalOpen(true); }}
                      className="bg-indigo-500 hover:bg-indigo-400 text-white font-bold py-3 px-6 rounded-2xl flex items-center gap-2 transition-all shadow-lg shadow-indigo-500/20"
                  >
                      <Plus size={20} /> Nuovo Piatto
                  </button>
                </div>
              </header>

              <div className="space-y-12">
                {['Antipasti', 'Primi', 'Secondi', 'Contorni', 'Pizze Speciali', 'Pizze Rosse', 'Pizze Bianche', 'Fritti'].map(cat => {
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
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {filteredProducts.map(product => (
                            <div key={product.id} className="group relative bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-all">
                               <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h4 className="font-bold text-white group-hover:text-indigo-400 transition-colors uppercase text-sm">{product.nome}</h4>
                                    <p className="text-indigo-400 font-black mt-1">€{product.prezzo.toFixed(2)}</p>
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
                                    type="number" 
                                    step="0.5"
                                    value={editingProduct ? editingProduct.prezzo : newProduct.prezzo}
                                    onChange={e => editingProduct ? setEditingProduct({...editingProduct, prezzo: parseFloat(e.target.value)}) : setNewProduct({...newProduct, prezzo: parseFloat(e.target.value)})}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-white focus:border-indigo-500 outline-none"
                                  />
                              </div>
                              <div>
                                  <label className="block text-xs font-black text-slate-500 uppercase mb-2">Categoria</label>
                                  <select 
                                    value={editingProduct ? editingProduct.categoria : newProduct.categoria}
                                    onChange={e => editingProduct ? setEditingProduct({...editingProduct, categoria: e.target.value}) : setNewProduct({...newProduct, categoria: e.target.value})}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-white focus:border-indigo-500 outline-none appearance-none"
                                  >
                                      {['Antipasti', 'Primi', 'Secondi', 'Contorni', 'Pizze Rosse', 'Pizze Bianche', 'Pizze Speciali', 'Fritti', 'Bibite'].map(c => (
                                          <option key={c} value={c}>{c}</option>
                                      ))}
                                  </select>
                              </div>
                          </div>

                          <div>
                              <label className="block text-xs font-black text-slate-500 uppercase mb-2">Ingredienti (separati da virgola)</label>
                              <textarea 
                                value={editingProduct ? editingProduct.ingredienti?.join(', ') : newProduct.ingredienti?.join(', ')}
                                onChange={e => {
                                    const ings = e.target.value.split(',').map(i => i.trim()).filter(i => i !== '');
                                    editingProduct ? setEditingProduct({...editingProduct, ingredienti: ings}) : setNewProduct({...newProduct, ingredienti: ings});
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
                                type="number" 
                                step="0.5"
                                value={editingIngredient ? editingIngredient.prezzo : newIngredient.prezzo}
                               onChange={e => editingIngredient ? setEditingIngredient({...editingIngredient, prezzo: parseFloat(e.target.value) || 0}) : setNewIngredient({...newIngredient, prezzo: parseFloat(e.target.value) || 0})}
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
