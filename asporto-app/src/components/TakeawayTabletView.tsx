import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase, type Product, type Ingredient, type Order } from '../lib/supabase';
import { capacityUtils, CAPACITY_CONFIG } from '../lib/CapacityUtils';
import { 
  Plus, 
  Minus, 
  Search, 
  Save, 
  Clock, 
  User, 
  Trash2, 
  X, 
  AlertCircle, 
  Edit3,
  LayoutDashboard,
  Utensils,
  ShoppingCart,
  Eye
} from 'lucide-react';

type CustomizedItem = Product & {
  quantity: number;
  addedIngredients: { nome: string, prezzo: number }[];
  removedIngredients: string[];
  notes: string;
  uniqueId: string;
};

export default function TakeawayTabletView() {
  const [products, setProducts] = useState<Product[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [cart, setCart] = useState<CustomizedItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [pickupTime, setPickupTime] = useState(''); // This will now represent the selected slot
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [ingSearch, setIngSearch] = useState('');
  
  // Modals state
  const [editingItem, setEditingItem] = useState<CustomizedItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  useEffect(() => {
    fetchData();
    const productsSub = supabase.channel('products-sync').on('postgres_changes', { event: '*', schema: 'public', table: 'prodotti' }, () => fetchData()).subscribe();
    const ordersSub = supabase.channel('orders-sync').on('postgres_changes', { event: '*', schema: 'public', table: 'ordini' }, () => fetchOrders()).subscribe();
    
    return () => { 
      supabase.removeChannel(productsSub); 
      supabase.removeChannel(ordersSub);
    };
  }, []);

  async function fetchData() {
    const [{ data: pData }, { data: iData }] = await Promise.all([
      supabase.from('prodotti').select('*').order('categoria', { ascending: true }).order('nome', { ascending: true }),
      supabase.from('ingredienti').select('*').order('nome', { ascending: true })
    ]);
    if (pData) setProducts(pData);
    if (iData) setIngredients(iData);
    fetchOrders();
  }

  async function fetchOrders() {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase.from('ordini').select('*').gte('created_at', today);
    if (data) setAllOrders(data);
  }

  const loadMap = useMemo(() => capacityUtils.calculateLoadMap(allOrders), [allOrders]);
  const availableSlots = useMemo(() => capacityUtils.generateSlots(), []);

  const addToCartDirectly = (product: Product) => {
    const newItem: CustomizedItem = {
      ...product,
      quantity: 1,
      addedIngredients: [],
      removedIngredients: [],
      notes: '',
      uniqueId: Math.random().toString(36).substr(2, 9)
    };
    setCart(prev => [...prev, newItem]);
  };

  const openCustomization = (product: Product) => {
    setEditingItem({
      ...product,
      quantity: 1,
      addedIngredients: [],
      removedIngredients: [],
      notes: '',
      uniqueId: Math.random().toString(36).substr(2, 9)
    });
    setIsModalOpen(true);
  };

  const editCartItem = (item: CustomizedItem) => {
    setEditingItem({ ...item });
    setIsModalOpen(true);
  };

  const saveCustomization = () => {
    if (!editingItem) return;
    setCart(prev => {
      const existingIdx = prev.findIndex(i => i.uniqueId === editingItem.uniqueId);
      if (existingIdx > -1) {
        const newCart = [...prev];
        newCart[existingIdx] = editingItem;
        return newCart;
      }
      return [...prev, editingItem];
    });
    setIsModalOpen(false);
    setEditingItem(null);
  };

  const removeFromCart = (uniqueId: string) => {
    setCart(prev => prev.filter(i => i.uniqueId !== uniqueId));
  };

  const calculateItemPrice = (item: CustomizedItem) => {
    const extrasPrice = item.addedIngredients.reduce((sum, ing) => sum + ing.prezzo, 0);
    return (item.prezzo + extrasPrice) * item.quantity;
  };

  const total = cart.reduce((sum, item) => sum + calculateItemPrice(item), 0);
  const currentPizzasInCart = cart.reduce((sum, item) => {
    const isPizza = item.nome?.toLowerCase().includes('pizza') || item.categoria?.toLowerCase().includes('pizze');
    return isPizza ? sum + item.quantity : sum;
  }, 0);

  const getSlotStatus = (slot: string) => {
    const load = loadMap[slot] || 0;
    const futureLoad = pickupTime === slot ? load + currentPizzasInCart : load;
    
    if (futureLoad >= CAPACITY_CONFIG.MAX_PIZZAS_PER_SLOT) return 'FULL';
    if (futureLoad >= CAPACITY_CONFIG.MAX_PIZZAS_PER_SLOT * 0.8) return 'WARNING';
    return 'OK';
  };

  const submitOrder = async () => {
    if (!customerName || cart.length === 0 || !pickupTime) {
      alert('Inserisci Nome, Orario e almeno un prodotto');
      return;
    }

    const { error } = await supabase.from('ordini').insert([{
      nome_cliente: customerName.toUpperCase(),
      orario_ritiro: pickupTime,
      totale: total,
      status: 'IN_ATTESA',
      carrello: cart.map(i => ({
        nome: i.nome,
        quantity: i.quantity,
        prezzo_unitario: i.prezzo + i.addedIngredients.reduce((s, a) => s + a.prezzo, 0),
        modifiche: {
          aggiunte: i.addedIngredients.map(a => a.nome),
          rimozioni: i.removedIngredients,
          note: i.notes
        }
      }))
    }]);

    if (!error) {
      alert('Ordine Salvato con successo!');
      setCart([]);
      setCustomerName('');
      setPickupTime('');
    }
  };

  const categories = Array.from(new Set(products.map(p => p.categoria)));
  const filteredProducts = products.filter(p => 
    (!activeCategory || p.categoria === activeCategory) &&
    (!searchQuery || p.nome.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="h-screen bg-charcoal flex overflow-hidden font-sans">
      
      {/* Left: Menu (70%) */}
      <main className="flex-1 flex flex-col min-w-0 p-8 border-r border-surface-light">
        <header className="mb-10 flex justify-between items-center">
          <div className="flex items-center gap-6">
            <Link to="/" className="p-3 bg-surface border border-surface-light rounded-2xl text-gray-500 hover:text-white transition-all shadow-xl active:scale-90">
              <LayoutDashboard size={24} />
            </Link>
            <div>
               <h1 className="text-4xl font-black text-white tracking-tight uppercase italic">Nuovo <span className="text-gold">Asporto</span></h1>
               <p className="text-xs font-black text-gray-500 tracking-widest uppercase mt-1">Tablet Mode • Terminal 01</p>
            </div>
          </div>

          <div className="relative w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
            <input 
              type="text" 
              placeholder="Cerca pizza o bevanda..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-surface border border-surface-light rounded-2xl py-3 pl-12 pr-4 text-white font-bold outline-none focus:border-gold transition-all"
            />
          </div>
        </header>

        {/* Categories */}
        <div className="flex gap-2 overflow-x-auto pb-4 hide-scrollbar mb-6">
          <button 
            onClick={() => setActiveCategory(null)}
            className={`px-6 py-2.5 rounded-xl font-black text-xs tracking-widest transition-all border ${!activeCategory ? 'bg-gold border-gold text-black' : 'bg-surface border-surface-light text-gray-500 hover:text-white'}`}
          >
            TUTTI
          </button>
          {categories.map(cat => (
            <button 
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-6 py-2.5 rounded-xl font-black text-xs tracking-widest transition-all border whitespace-nowrap ${activeCategory === cat ? 'bg-gold border-gold text-black' : 'bg-surface border-surface-light text-gray-500'}`}
            >
              {cat.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-12">
          {filteredProducts.map(p => (
            <div
              key={p.id}
              className={`bg-surface border rounded-[32px] flex flex-col justify-between text-left transition-all group relative overflow-hidden h-40 ${p.disponibile ? 'border-surface-light' : 'opacity-40 grayscale pointer-events-none'}`}
            >
              {/* Direct Add Search Area */}
              <button 
                onClick={() => addToCartDirectly(p)}
                className="absolute inset-0 z-0 p-6 flex flex-col justify-between active:scale-[0.98] transition-transform"
              >
                <div>
                  <h3 className="font-black text-xl text-white leading-tight mb-2 group-hover:text-gold transition-colors">{p.nome}</h3>
                  <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-2 py-0.5 bg-charcoal rounded-full border border-surface-light">{p.categoria}</span>
                </div>
                <div className="flex justify-between items-end">
                  <span className="text-2xl font-black text-white italic">€{p.prezzo.toFixed(2)}</span>
                  <div className="p-3 bg-charcoal rounded-2xl text-gold border border-surface-light group-hover:bg-gold group-hover:text-black transition-all">
                    <Plus size={20} />
                  </div>
                </div>
              </button>
              
              {/* Customization Button - Always visible for Tablet */}
              <button 
                onClick={(e) => { e.stopPropagation(); openCustomization(p); }}
                className="absolute top-4 right-4 z-10 p-3 bg-surface-light border border-surface-light rounded-2xl text-gold shadow-lg active:scale-90 transition-all hover:bg-surface-light-hover"
                title="Personalizza"
              >
                <Edit3 size={18} />
              </button>
            </div>
          ))}
        </div>
      </main>

      {/* Right: Checkout Sidebar (30%) */}
      <aside className="w-[480px] bg-surface flex flex-col shadow-2xl relative">
        <header className="p-8 border-b border-surface-light bg-surface-light/20">
          <h2 className="text-xl font-black italic uppercase tracking-tighter text-white mb-6 flex items-center gap-3">
             <Utensils size={24} className="text-gold" /> Ordine Attuale
          </h2>
          
          <div className="space-y-6">
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
              <input 
                type="text" 
                placeholder="NOME CLIENTE"
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                className="w-full bg-charcoal border border-surface-light rounded-2xl py-4 pl-12 text-gold font-black uppercase placeholder:opacity-30 outline-none focus:border-gold/40"
              />
            </div>
            
            {/* Slot Picker */}
            <div>
              <div className="flex justify-between items-center mb-3 px-1">
                 <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                    <Clock size={12} /> Seleziona Orario (15 min)
                 </span>
                 {pickupTime && (
                   <span className="text-[10px] font-bold text-gold bg-gold/10 px-2 py-0.5 rounded">
                     {loadMap[pickupTime] || 0}/{CAPACITY_CONFIG.MAX_PIZZAS_PER_SLOT} Pizze occ.
                   </span>
                 )}
              </div>
              <div className="grid grid-cols-4 gap-2 max-h-32 overflow-y-auto pr-1 custom-scrollbar">
                  {availableSlots.map(slot => {
                    const status = getSlotStatus(slot);
                    const isSelected = pickupTime === slot;
                    return (
                      <button
                        key={slot}
                        onClick={() => setPickupTime(slot)}
                        className={`py-2 rounded-xl text-[10px] font-black border transition-all ${
                          isSelected 
                            ? 'bg-gold border-gold text-black shadow-lg shadow-gold/20' 
                            : status === 'FULL'
                              ? 'bg-red-500/10 border-red-500/20 text-red-500/50 cursor-not-allowed'
                              : status === 'WARNING'
                                ? 'bg-amber-500/10 border-amber-500/40 text-amber-500 hover:bg-amber-500/20'
                                : 'bg-charcoal border-surface-light text-gray-500 hover:text-white hover:border-surface-light-hover'
                        }`}
                      >
                        {slot}
                      </button>
                    )
                  })}
              </div>
            </div>
          </div>
        </header>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-600 opacity-50">
              <ShoppingCart size={48} className="mb-4" />
              <p className="font-black uppercase text-[10px] tracking-widest">Scegli qualcosa dal menu</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.uniqueId} className="bg-charcoal/50 border border-surface-light rounded-[28px] p-5 relative group border-l-4 border-l-gold">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-black text-lg text-white leading-none">{item.nome}</h3>
                    <div className="mt-2 space-y-1">
                      {item.addedIngredients.map(a => <span key={a.nome} className="inline-block text-[10px] font-bold text-emerald-400 mr-2 bg-emerald-500/10 px-2 py-0.5 rounded">+{a.nome}</span>)}
                      {item.removedIngredients.map(r => <span key={r} className="inline-block text-[10px] font-bold text-red-400 mr-2 bg-red-500/10 px-2 py-0.5 rounded">NO {r}</span>)}
                      {item.notes && <p className="text-[10px] text-amber-500 italic mt-1 font-bold">* {item.notes}</p>}
                    </div>
                  </div>
                  <button onClick={() => removeFromCart(item.uniqueId)} className="p-2 text-gray-600 hover:text-red-500 transition-colors">
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="flex justify-between items-center pt-3 border-t border-surface-light">
                  <div className="flex items-center gap-3">
                     <button onClick={() => editCartItem(item)} className="text-[10px] font-black uppercase text-gray-500 hover:text-white flex items-center gap-1">
                        <Edit3 size={12} /> MODIFICA
                     </button>
                  </div>
                  <div className="flex items-center gap-2">
                     <span className="text-gray-500 font-bold text-xs">x{item.quantity}</span>
                     <span className="text-white font-black">€{calculateItemPrice(item).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Total & Submit */}
        <div className="p-8 border-t border-surface-light bg-surface-light/10">
          <div className="flex justify-between items-end mb-6">
            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Totale</span>
            <span className="text-5xl font-black text-white italic tracking-tighter">€<span className="text-gold">{total.toFixed(2)}</span></span>
          </div>

          <div className="flex gap-4">
             <button 
              onClick={() => setIsPreviewOpen(true)}
              disabled={cart.length === 0}
              className="p-5 bg-charcoal hover:bg-surface-light border border-surface-light rounded-3xl text-gray-400 hover:text-white transition-all disabled:opacity-30"
              title="Vedi Anteprima Comanda"
             >
                <Eye size={24} />
             </button>
             <button 
              onClick={submitOrder}
              disabled={cart.length === 0 || !pickupTime}
              className="flex-1 bg-gold hover:bg-gold-hover text-black py-6 rounded-3xl font-black text-xl uppercase tracking-tighter shadow-2xl shadow-gold/20 flex items-center justify-center gap-3 transition-all active:scale-95 disabled:grayscale disabled:opacity-50"
             >
              SALVA ORDINE <Save size={24} />
             </button>
          </div>
        </div>
      </aside>

      {/* Customization Modal */}
      {isModalOpen && editingItem && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl animate-in zoom-in duration-200">
          <div className="bg-surface border border-surface-light w-full max-w-2xl rounded-[40px] shadow-[0_0_100px_rgba(0,0,0,0.5)] overflow-hidden">
             
             {/* Modal Header */}
             <div className="p-10 border-b border-surface-light flex justify-between items-center">
                 <div>
                    <h2 className="text-4xl font-black italic uppercase tracking-tighter text-white">Personalizza <span className="text-gold">{editingItem.nome}</span></h2>
                    <p className="text-xs font-black text-gray-500 uppercase tracking-[0.3em] mt-1">Prezzo Base: €{editingItem.prezzo.toFixed(2)}</p>
                 </div>
                 <button onClick={() => setIsModalOpen(false)} className="p-3 bg-charcoal rounded-full text-gray-500 hover:text-white transition-colors">
                    <X size={24} />
                 </button>
             </div>

             <div className="p-10 max-h-[70vh] overflow-y-auto custom-scrollbar space-y-12">
                
                {/* 1. Rimozioni */}
                <section>
                    <h3 className="text-xs font-black text-gray-500 tracking-widest uppercase mb-6 flex items-center gap-2">
                        <Minus size={14} className="text-red-500" /> Togli ingredienti
                    </h3>
                    <div className="flex flex-wrap gap-2">
                        {editingItem.ingredienti?.map(ing => {
                           const isRemoved = editingItem.removedIngredients.includes(ing);
                           return (
                             <button
                                key={ing}
                                onClick={() => {
                                  if (isRemoved) setEditingItem({...editingItem, removedIngredients: editingItem.removedIngredients.filter(r => r !== ing)});
                                  else setEditingItem({...editingItem, removedIngredients: [...editingItem.removedIngredients, ing]});
                                }}
                                className={`px-4 py-3 rounded-2xl font-bold text-xs border transition-all ${isRemoved ? 'bg-red-500 border-red-500 text-white' : 'bg-charcoal border-surface-light text-gray-400'}`}
                             >
                                {isRemoved ? `NO ${ing.toUpperCase()}` : ing.toUpperCase()}
                             </button>
                           )
                        })}
                    </div>
                </section>

                {/* 2. Aggiunte */}
                <section>
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xs font-black text-gray-500 tracking-widest uppercase flex items-center gap-2">
                            <Plus size={14} className="text-emerald-500" /> Aggiungi extra
                        </h3>
                        <div className="relative w-48">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" size={12} />
                            <input 
                                type="text"
                                placeholder="Cerca extra..."
                                value={ingSearch}
                                onChange={e => setIngSearch(e.target.value)}
                                className="w-full bg-charcoal border border-surface-light rounded-xl py-2 pl-8 pr-3 text-[10px] font-bold text-white outline-none focus:border-gold/40"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                        {ingredients
                          .filter(i => i.disponibile && i.nome.toLowerCase().includes(ingSearch.toLowerCase()))
                          .map(ing => {
                           const isAdded = editingItem.addedIngredients.some(a => a.nome === ing.nome);
                           return (
                             <button
                                key={ing.id}
                                onClick={() => {
                                  if (isAdded) setEditingItem({...editingItem, addedIngredients: editingItem.addedIngredients.filter(a => a.nome !== ing.nome)});
                                  else setEditingItem({...editingItem, addedIngredients: [...editingItem.addedIngredients, { nome: ing.nome, prezzo: 1.5 }]});
                                }}
                                className={`p-4 rounded-2xl font-bold text-xs border transition-all text-left flex flex-col gap-2 ${isAdded ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400' : 'bg-charcoal border-surface-light text-gray-500 hover:border-surface-light-hover'}`}
                             >
                                <span className={isAdded ? 'text-emerald-400' : 'text-gray-400'}>{ing.nome.toUpperCase()}</span>
                                <span className="text-[10px] opacity-70">+ €1.50</span>
                             </button>
                           )
                        })}
                    </div>
                </section>

                {/* 3. Note e Opzioni */}
                <section>
                    <h3 className="text-xs font-black text-gray-500 tracking-widest uppercase mb-6 flex items-center gap-2">
                        <AlertCircle size={14} className="text-gold" /> Richieste Speciali
                    </h3>
                    <div className="flex flex-wrap gap-2 mb-4">
                        {['Senza Glutine', 'Senza Lattosio', 'Rosè (poco sugo)', 'Bianca', 'Rossa'].map(note => (
                           <button 
                            key={note}
                            onClick={() => setEditingItem({...editingItem, notes: editingItem.notes === note ? '' : note})}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase border transition-all ${editingItem.notes === note ? 'bg-gold border-gold text-black' : 'bg-charcoal border-surface-light text-gray-500 hover:text-white'}`}
                           >
                            {note}
                           </button>
                        ))}
                    </div>
                    <textarea 
                        rows={3}
                        placeholder="Altre note..."
                        value={editingItem.notes}
                        onChange={e => setEditingItem({...editingItem, notes: e.target.value})}
                        className="w-full bg-charcoal border border-surface-light rounded-3xl p-6 text-white font-medium outline-none focus:border-gold transition-all"
                    />
                </section>

                {/* 4. Quantità */}
                <section className="flex items-center justify-between bg-charcoal border border-surface-light p-6 rounded-[28px]">
                    <span className="text-sm font-black uppercase text-gray-400 tracking-widest">Quantità</span>
                    <div className="flex items-center gap-6">
                        <button onClick={() => setEditingItem({...editingItem, quantity: Math.max(1, editingItem.quantity - 1)})} className="p-3 bg-surface rounded-2xl text-gold border border-surface-light active:scale-90"><Minus size={20} /></button>
                        <span className="text-4xl font-black italic w-12 text-center">{editingItem.quantity}</span>
                        <button onClick={() => setEditingItem({...editingItem, quantity: editingItem.quantity + 1})} className="p-3 bg-surface rounded-2xl text-gold border border-surface-light active:scale-90"><Plus size={20} /></button>
                    </div>
                </section>
             </div>

             {/* Modal Footer */}
             <div className="p-10 border-t border-surface-light bg-surface-light/10 flex justify-between items-center">
                 <div>
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Parziale Riga</p>
                    <p className="text-4xl font-black italic">€<span className="text-white">{calculateItemPrice(editingItem).toFixed(2)}</span></p>
                 </div>
                 <button onClick={saveCustomization} className="bg-emerald-500 hover:bg-emerald-600 text-black px-12 py-5 rounded-3xl font-black text-lg shadow-xl shadow-emerald-500/20 active:scale-95">
                    AGGIUNGI ALL'ORDINE
                 </button>
             </div>
          </div>
        </div>
      )}

      {/* Print Preview Modal - Kitchen Style */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
           <div className="bg-white text-black w-full max-w-sm rounded-sm p-10 font-mono shadow-[0_0_50px_rgba(255,255,255,0.1)] relative">
              <button 
                onClick={() => setIsPreviewOpen(false)}
                className="absolute -top-12 right-0 text-white flex items-center gap-2 uppercase font-black text-xs tracking-widest"
              >
                Chiudi <X size={18} />
              </button>

              <div className="mb-6 bg-black text-white p-6 rounded-sm text-center">
                 <p className="text-xs font-bold uppercase tracking-[0.3em] opacity-70 mb-2">ORDINE PER</p>
                 <p className="text-3xl font-black uppercase tracking-tighter">{customerName || 'N/A'}</p>
              </div>

              <div className="flex justify-between items-center mb-8 px-2 border-b-2 border-black pb-4">
                 <div>
                    <p className="text-[10px] font-bold text-gray-500 uppercase">ORARIO RITIRO</p>
                    <p className="text-2xl font-black">{pickupTime}</p>
                 </div>
                 <div className="text-right">
                    <p className="text-[10px] font-bold text-gray-500 uppercase">TOT. PIATTI</p>
                    <p className="text-2xl font-black">{cart.length}</p>
                 </div>
              </div>

              <div className="space-y-6 mb-10">
                 {cart.map((item, idx) => (
                    <div key={idx} className="border-b-2 border-dashed border-gray-200 pb-4">
                       <div className="flex justify-between font-black text-lg leading-tight uppercase">
                          <span>{item.quantity}x {item.nome}</span>
                       </div>
                       <ul className="text-xs font-black ml-4 mt-2 space-y-1">
                          {item.removedIngredients.map(r => <li key={r} className="text-gray-400 line-through">- NO {r.toUpperCase()}</li>)}
                          {item.addedIngredients.map(a => <li key={a.nome} className="text-black bg-gray-100 px-1 inline-block">+ {a.nome.toUpperCase()}</li>)}
                          {item.notes && <li className="text-black underline decoration-2 mt-1 decoration-gold/50 flex items-start gap-2 pt-1 border-t border-gray-100 uppercase font-black break-words"><span>NOTE:</span> {item.notes.toUpperCase()}</li>}
                       </ul>
                    </div>
                 ))}
              </div>

              <div className="pt-4 border-t-2 border-dashed border-black text-center opacity-40">
                 <p className="text-[10px] font-bold uppercase tracking-[0.3em]">{new Date().toLocaleString('it-IT')}</p>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
