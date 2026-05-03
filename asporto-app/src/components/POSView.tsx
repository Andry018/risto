import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase, type Product, type Ingredient, IS_DEMO_MODE } from '../lib/supabase';
import { MOCK_PRODUCTS, MOCK_INGREDIENTS } from '../lib/MockData';
import { ShoppingCart, Plus, Minus, Trash2, Search, CheckCircle, Calculator, CreditCard, AlertTriangle, Save, WifiOff, LayoutDashboard, Edit3, X, AlertCircle } from 'lucide-react';
import { syncManager } from '../lib/OfflineSync';

type CustomizedItem = Product & {
  quantity: number;
  addedIngredients: { nome: string, prezzo: number }[];
  removedIngredients: string[];
  notes: string;
  uniqueId: string;
};

export default function POSView({ tableId, tableName, onOrderFinished }: { tableId?: string, tableName?: string, onOrderFinished?: () => void }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [cart, setCart] = useState<CustomizedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD'>('CASH');
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [testMode, setTestMode] = useState(false);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  
  // Customization state
  const [editingItem, setEditingItem] = useState<CustomizedItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [ingSearch, setIngSearch] = useState('');

  useEffect(() => {
    const handleSyncChange = () => setPendingSyncCount(syncManager.getPendingCount());
    window.addEventListener('sync-status-changed', handleSyncChange);
    return () => window.removeEventListener('sync-status-changed', handleSyncChange);
  }, []);

  const SUMUP_AFFILIATE_KEY = import.meta.env.VITE_SUMUP_AFFILIATE_KEY || "YOUR_AFFILIATE_KEY";

  useEffect(() => {
    fetchProducts();
    fetchIngredients();
    if (tableId) {
      fetchExistingOrder();
    }

    const productsChannel = supabase
      .channel('public:prodotti')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prodotti' }, () => fetchProducts())
      .subscribe();
    const ingredientsChannel = supabase
      .channel('public:ingredienti')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ingredienti' }, () => fetchIngredients())
      .subscribe();
    return () => { 
      supabase.removeChannel(productsChannel); 
      supabase.removeChannel(ingredientsChannel);
    };
  }, [tableId]);

  async function fetchExistingOrder() {
    if (IS_DEMO_MODE) return;
    const { data } = await supabase
      .from('ordini')
      .select('*')
      .eq('nome_cliente', tableName)
      .eq('status', 'IN_ATTESA')
      .maybeSingle();
    
    if (data) {
      setActiveOrderId(data.id);
      setCart(data.carrello || []);
    }
  }

  async function fetchProducts() {
    if (IS_DEMO_MODE) {
      setProducts(MOCK_PRODUCTS);
      setLoading(false);
      return;
    }
    try {
      const { data } = await supabase
        .from('prodotti')
        .select('*')
        .order('categoria', { ascending: true })
        .order('nome', { ascending: true });
      if (data) setProducts(data);
    } finally {
      setLoading(false);
    }
  }

  async function fetchIngredients() {
    if (IS_DEMO_MODE) {
      setIngredients(MOCK_INGREDIENTS);
      return;
    }
    const { data } = await supabase.from('ingredienti').select('*');
    if (data) setIngredients(data);
  }

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existingIdx = prev.findIndex(item => 
        item.id === product.id && 
        item.addedIngredients.length === 0 && 
        item.removedIngredients.length === 0 && 
        !item.notes
      );

      if (existingIdx > -1) {
        const newCart = [...prev];
        newCart[existingIdx] = {
          ...newCart[existingIdx],
          quantity: newCart[existingIdx].quantity + 1
        };
        return newCart;
      }

      const newItem: CustomizedItem = {
        ...product,
        quantity: 1,
        addedIngredients: [],
        removedIngredients: [],
        notes: '',
        uniqueId: Math.random().toString(36).substr(2, 9)
      };
      return [...prev, newItem];
    });
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
    setCart(prev => {
      const existing = prev.find(item => item.uniqueId === uniqueId);
      if (existing && existing.quantity > 1) {
        return prev.map(item => item.uniqueId === uniqueId ? { ...item, quantity: item.quantity - 1 } : item);
      }
      return prev.filter(item => item.uniqueId !== uniqueId);
    });
  };

  const removeEntireItem = (uniqueId: string) => {
    setCart(prev => prev.filter(item => item.uniqueId !== uniqueId));
  };

  const clearCart = () => setCart([]);

  const calculateItemPrice = (item: CustomizedItem) => {
    const extrasPrice = item.addedIngredients.reduce((sum, ing) => sum + ing.prezzo, 0);
    return (item.prezzo + extrasPrice) * item.quantity;
  };

  const total = cart.reduce((sum, item) => sum + calculateItemPrice(item), 0);

  const handleSumUpPayment = () => {
    const amount = total.toFixed(2);
    const currency = "EUR";
    const title = "Ordine RistoPremium";
    const foreignTxId = `POS-${Date.now()}`;
    const callbackUrl = window.location.href;

    const sumupUrl = `sumupmerchant://pay/1.0?amount=${amount}&currency=${currency}&affiliate-key=${SUMUP_AFFILIATE_KEY}&title=${encodeURIComponent(title)}&foreign-tx-id=${foreignTxId}&callbacksuccess=${encodeURIComponent(callbackUrl)}&callbackfail=${encodeURIComponent(callbackUrl)}`;
    
    window.location.href = sumupUrl;
  };

  const handleFinishOrder = async () => {
    if (cart.length === 0) return;

    if (paymentMethod === 'CARD') {
      if (testMode) {
        setOrderSuccess(true);
        // Simulate delay
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        handleSumUpPayment();
      }
    }

    try {
      const orderData = {
        nome_cliente: tableName || 'POS VENDITA',
        orario_ritiro: new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
        totale: total,
        status: 'COMPLETATO' as const,
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
      };

      if (activeOrderId) {
        await syncManager.pushOrder({ ...orderData, id: activeOrderId });
      } else {
        await syncManager.pushOrder(orderData);
      }

      if (tableId) {
        await syncManager.pushTableUpdate(tableId, { status: 'LIBERO', clienti: 0 });
      }

      setOrderSuccess(true);
      setCart([]);
      setTimeout(() => {
        setOrderSuccess(false);
        if (onOrderFinished) onOrderFinished();
      }, 2000);
    } catch (error) {
      console.error('Error submitting POS order:', error);
      alert('Errore durante la chiusura dell\'ordine.');
    }
  };

  const handleUpdateBill = async () => {
    if (cart.length === 0 || !tableId) return;
    try {
      const orderData = {
        nome_cliente: tableName,
        orario_ritiro: new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
        totale: total,
        status: 'IN_ATTESA' as const,
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
      };

      if (activeOrderId) {
        await syncManager.pushOrder({ ...orderData, id: activeOrderId });
      } else {
        // For new orders, we still need an ID to update later
        // But the syncManager handles the insert. 
        // For simplicity in offline mode, we push as INSERT.
        await syncManager.pushOrder(orderData);
        await syncManager.pushTableUpdate(tableId, { status: 'OCCUPATO' });
      }
      
      setOrderSuccess(true);
      setTimeout(() => setOrderSuccess(false), 2000);
    } catch (error) {
      console.error('Error updating bill:', error);
      alert('Errore durante l\'aggiornamento del conto.');
    }
  };

  const categories = Array.from(new Set(products.map(p => p.categoria)));
  const filteredProducts = products.filter(p => 
    (activeCategory ? p.categoria === activeCategory : true) &&
    (searchQuery ? p.nome.toLowerCase().includes(searchQuery.toLowerCase()) : true)
  );

  if (loading) return <div className="flex-1 flex justify-center items-center bg-charcoal"><div className="w-12 h-12 border-4 border-gold border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <>
      <div className="h-screen flex bg-charcoal text-white overflow-hidden">
      
      {/* Left Column: Menu */}
      <div className="flex-1 flex flex-col min-w-0 p-8">
        <header className="mb-8 flex flex-col gap-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-6">
              <Link to="/" className="p-3 bg-surface border border-surface-light rounded-2xl text-gray-500 hover:text-white transition-all shadow-xl">
                 <LayoutDashboard size={24} />
              </Link>
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-sm text-gray-400 font-bold tracking-widest uppercase italic">Smart Checkout</h2>
                  {testMode && <span className="px-2 py-0.5 bg-amber-500 text-black text-[8px] font-black rounded uppercase">Test Mode Attivo</span>}
                  {pendingSyncCount > 0 && (
                    <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-500 text-white text-[8px] font-black rounded uppercase animate-pulse">
                      <WifiOff size={8} /> Sincronizzazione in corso ({pendingSyncCount})
                    </span>
                  )}
                </div>
                <h1 className="text-4xl font-black text-white mt-1">POS <span className="text-gold italic">TERMINAL</span></h1>
                <button 
                  onClick={() => setTestMode(!testMode)}
                  className="text-[10px] text-gray-500 hover:text-white underline mt-1"
                >
                  {testMode ? 'Disattiva Test Mode' : 'Attiva Test Mode'}
                </button>
              </div>
            </div>
            
            {/* Search Bar */}
            <div className="relative w-72">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input 
                type="text" 
                placeholder="Cerca prodotto..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-surface border border-surface-light rounded-2xl py-3 pl-12 pr-4 text-white font-bold outline-none focus:border-gold transition-all"
              />
            </div>
          </div>

          {/* Categories Selector */}
          <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
            <button 
              onClick={() => setActiveCategory(null)}
              className={`px-6 py-2.5 rounded-xl font-black text-xs tracking-widest transition-all border ${!activeCategory ? 'bg-gold border-gold text-black shadow-lg shadow-gold/20' : 'bg-surface border-surface-light text-gray-500 hover:text-white'}`}
            >
              TUTTI
            </button>
            {categories.map(cat => (
              <button 
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-6 py-2.5 rounded-xl font-black text-xs tracking-widest transition-all border whitespace-nowrap ${activeCategory === cat ? 'bg-gold border-gold text-black shadow-lg shadow-gold/20' : 'bg-surface border-surface-light text-gray-500 hover:text-white'}`}
              >
                {cat.toUpperCase()}
              </button>
            ))}
          </div>
        </header>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar pb-12">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 xxl:grid-cols-5 gap-4">
            {filteredProducts.map(product => {
              const missingIngredients = product.ingredienti?.filter(ingName => {
                const ingredient = ingredients.find(i => i.nome === ingName);
                return ingredient && !ingredient.disponibile;
              }) || [];

              const isTrulyAvailable = product.disponibile && missingIngredients.length === 0;

              return (
                <button
                  key={product.id}
                  onClick={() => isTrulyAvailable && addToCart(product)}
                  className={`bg-surface border p-5 rounded-[24px] flex flex-col justify-between text-left transition-all active:scale-95 group shadow-xl h-44 relative overflow-hidden ${
                    isTrulyAvailable ? 'border-surface-light hover:border-gold/40' : 'border-red-500/20 grayscale opacity-60 cursor-not-allowed'
                  }`}
                >
                  <div>
                    <h3 className={`font-bold text-lg leading-tight transition-colors ${isTrulyAvailable ? 'group-hover:text-gold' : 'text-gray-500 line-through'}`}>{product.nome}</h3>
                    <p className={`text-[10px] font-black uppercase tracking-widest mt-1 ${isTrulyAvailable ? 'text-gray-500' : 'text-red-500'}`}>
                      {isTrulyAvailable ? product.categoria : `MANCA: ${missingIngredients.join(', ')}`}
                    </p>
                  </div>
                  <div className="flex justify-between items-end">
                    <span className={`text-xl font-black ${isTrulyAvailable ? 'text-white' : 'text-gray-500'}`}>€{product.prezzo.toFixed(2)}</span>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={(e) => { e.stopPropagation(); isTrulyAvailable && openCustomization(product); }}
                        className={`p-2 rounded-xl border transition-all active:scale-95 ${
                          isTrulyAvailable 
                            ? 'bg-charcoal border-surface-light text-gold hover:bg-surface-light' 
                            : 'opacity-50'
                        }`}
                      >
                        <Edit3 size={16} />
                      </button>
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all ${
                        isTrulyAvailable 
                          ? 'bg-charcoal border-surface-light text-gold group-hover:bg-gold group-hover:text-black' 
                          : 'bg-red-500/10 border-red-500/20 text-red-500'
                      }`}>
                        {isTrulyAvailable ? <Plus size={20} /> : <AlertTriangle size={20} />}
                      </div>
                    </div>
                  </div>
                  {!isTrulyAvailable && (
                    <div className="absolute top-2 right-2">
                       <span className="bg-red-500 text-white text-[8px] font-black px-2 py-0.5 rounded-full shadow-lg">ESAURITO</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right Column: Calculator/Cart */}
      <aside className="w-[450px] bg-surface flex flex-col border-l border-surface-light shadow-2xl relative overflow-hidden">
        {/* Decor */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-gold/5 blur-3xl pointer-events-none" />

        <header className="p-8 border-b border-surface-light flex justify-between items-center bg-surface-light/20 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-charcoal rounded-2xl flex items-center justify-center text-gold border border-surface-light shadow-xl">
              <Calculator size={24} />
            </div>
            <h2 className="text-xl font-black text-white uppercase italic">SCONTRINO</h2>
          </div>
          <button 
            onClick={clearCart}
            className="p-3 bg-charcoal border border-surface-light rounded-2xl text-gray-500 hover:text-red-500 hover:border-red-500/20 transition-all active:scale-90"
            title="Svuota carrello"
          >
            <Trash2 size={20} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar relative z-10">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-600 opacity-50">
              <ShoppingCart size={64} className="mb-4" />
              <p className="font-black uppercase tracking-widest text-[10px]">Aggiungi prodotti</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.uniqueId} className="bg-charcoal/50 border border-surface-light rounded-2xl p-4 flex flex-col group border-l-4 border-l-gold">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex-1 min-w-0 pr-4">
                    <p className="font-bold text-white truncate leading-none mb-1">{item.nome}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {item.addedIngredients.map(a => <span key={a.nome} className="text-[8px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">+{a.nome}</span>)}
                      {item.removedIngredients.map(r => <span key={r} className="text-[8px] font-bold text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">NO {r}</span>)}
                      {item.notes && <p className="text-[8px] text-amber-500 italic w-full font-bold">* {item.notes}</p>}
                    </div>
                  </div>
                  <button onClick={() => removeEntireItem(item.uniqueId)} className="p-2 text-gray-600 hover:text-red-500 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-surface-light/50">
                  <button onClick={() => editCartItem(item)} className="text-[9px] font-black uppercase text-gray-500 hover:text-white flex items-center gap-1">
                    <Edit3 size={10} /> MODIFICA
                  </button>
                  <div className="flex items-center gap-2 bg-surface p-1 rounded-xl border border-surface-light shadow-lg scale-90">
                    <button onClick={() => removeFromCart(item.uniqueId)} className="w-8 h-8 flex items-center justify-center bg-charcoal hover:bg-gold/20 hover:text-gold rounded-lg text-gray-500 transition-all active:scale-90"><Minus size={14} /></button>
                    <span className="w-6 text-center font-black text-white">{item.quantity}</span>
                    <button onClick={() => addToCart(item)} className="w-8 h-8 flex items-center justify-center bg-charcoal hover:bg-gold/20 hover:text-gold rounded-lg text-gray-500 transition-all active:scale-90"><Plus size={14} /></button>
                  </div>
                  <p className="text-white font-black text-sm">€{calculateItemPrice(item).toFixed(2)}</p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Total & Checkout */}
        <div className="p-8 border-t border-surface-light bg-surface-light/10 relative z-10">
          
          {/* Payment Method Selector */}
          <div className="flex gap-4 mb-8">
            <button 
              onClick={() => setPaymentMethod('CASH')}
              className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${paymentMethod === 'CASH' ? 'bg-gold/10 border-gold text-gold shadow-lg shadow-gold/10' : 'bg-charcoal border-surface-light text-gray-500 hover:text-white'}`}
            >
              <div className="text-sm font-black uppercase tracking-widest">Contanti</div>
            </button>
            <button 
              onClick={() => setPaymentMethod('CARD')}
              className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${paymentMethod === 'CARD' ? 'bg-gold/10 border-gold text-gold shadow-lg shadow-gold/10' : 'bg-charcoal border-surface-light text-gray-500 hover:text-white'}`}
            >
              <div className="text-sm font-black uppercase tracking-widest">Carta (SumUp)</div>
            </button>
          </div>

          <div className="flex justify-between items-end mb-8">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-[.3em]">Totale</span>
            <span className="text-6xl font-black text-white italic tracking-tighter leading-none">€<span className="text-gold">{total.toFixed(2)}</span></span>
          </div>

          {orderSuccess ? (
            <div className="w-full bg-emerald-500 text-black font-black text-xl py-6 rounded-3xl flex items-center justify-center gap-3 animate-in zoom-in">
              <CheckCircle size={24} /> {paymentMethod === 'CARD' ? 'TRANSAZIONE AVVIATA' : 'OPERAZIONE COMPLETATA!'}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {tableId && (
                <button
                  onClick={handleUpdateBill}
                  disabled={cart.length === 0}
                  className="w-full bg-surface-light hover:bg-white/10 text-white font-black text-lg py-4 rounded-2xl border border-surface-light transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  Aggiorna Scontrino <Save size={20} />
                </button>
              )}
              <button
                onClick={handleFinishOrder}
                disabled={cart.length === 0}
                className="w-full bg-gold hover:bg-gold-hover text-black font-black text-2xl py-6 rounded-3xl shadow-2xl shadow-gold/20 transition-all active:scale-95 flex items-center justify-center gap-4 disabled:opacity-50 disabled:grayscale"
              >
                {paymentMethod === 'CARD' ? 'Paga con SumUp' : 'Paga e Chiudi'} <CreditCard size={28} />
              </button>
            </div>
          )}
        </div>
      </aside>

    </div>
      {/* Customization Modal */}
      {isModalOpen && editingItem && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl animate-in zoom-in duration-200">
          <div className="bg-surface border border-surface-light w-full max-w-5xl rounded-[40px] shadow-[0_0_100px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col max-h-[90vh]">
             
             {/* Modal Header */}
             <div className="p-8 border-b border-surface-light flex justify-between items-center bg-surface-light/5">
                 <div>
                    <h2 className="text-3xl font-black italic uppercase tracking-tighter text-white">Personalizza <span className="text-gold">{editingItem.nome}</span></h2>
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] mt-1">Configurazione Ingredienti e Varianti</p>
                 </div>
                 <div className="flex items-center gap-6">
                    <div className="text-right">
                       <p className="text-[10px] font-black text-gray-500 uppercase">Prezzo Piatto</p>
                       <p className="text-2xl font-black text-white italic">€{calculateItemPrice(editingItem).toFixed(2)}</p>
                    </div>
                    <button onClick={() => setIsModalOpen(false)} className="p-4 bg-charcoal rounded-2xl text-gray-500 hover:text-white transition-colors border border-surface-light">
                       <X size={24} />
                    </button>
                 </div>
             </div>

             <div className="flex-1 overflow-hidden flex">
                {/* Left Side: Removals & Options (40%) */}
                <div className="w-[40%] border-r border-surface-light p-8 overflow-y-auto custom-scrollbar space-y-10">
                    <section>
                        <h3 className="text-[10px] font-black text-gray-500 tracking-widest uppercase mb-6 flex items-center gap-2">
                            <Minus size={14} className="text-red-500" /> Togli ingredienti
                        </h3>
                        <div className="grid grid-cols-2 gap-2">
                            {editingItem.ingredienti?.map(ing => {
                               const isRemoved = editingItem.removedIngredients.includes(ing);
                               return (
                                 <button
                                    key={ing}
                                    onClick={() => {
                                      if (isRemoved) setEditingItem({...editingItem, removedIngredients: editingItem.removedIngredients.filter(r => r !== ing)});
                                      else setEditingItem({...editingItem, removedIngredients: [...editingItem.removedIngredients, ing]});
                                    }}
                                    className={`px-4 py-3 rounded-2xl font-bold text-[10px] border transition-all text-center ${isRemoved ? 'bg-red-500 border-red-500 text-white shadow-lg shadow-red-500/20' : 'bg-charcoal border-surface-light text-gray-400 hover:border-surface-light-hover'}`}
                                 >
                                    {isRemoved ? `NO ${ing.toUpperCase()}` : ing.toUpperCase()}
                                 </button>
                               )
                            })}
                        </div>
                    </section>

                    <section>
                        <h3 className="text-[10px] font-black text-gray-500 tracking-widest uppercase mb-6 flex items-center gap-2">
                            <AlertCircle size={14} className="text-gold" /> Varianti Rapide
                        </h3>
                        <div className="grid grid-cols-2 gap-2">
                            {['Senza Glutine', 'Senza Lattosio', 'Rosè', 'Bianca', 'Rossa', 'Cottura ++'].map(note => {
                               const isActive = editingItem.notes.includes(note);
                               return (
                                 <button 
                                  key={note}
                                  onClick={() => {
                                    let newNotes = editingItem.notes;
                                    if (isActive) {
                                      // Remove the note and clean up extra spaces/commas
                                      newNotes = newNotes.replace(note, '').replace(/,\s*,/g, ',').replace(/^,\s*/, '').replace(/,\s*$/, '').trim();
                                    } else {
                                      // Add the note
                                      newNotes = newNotes ? `${newNotes}, ${note}` : note;
                                    }
                                    setEditingItem({...editingItem, notes: newNotes});
                                  }}
                                  className={`px-4 py-3 rounded-xl text-[10px] font-black uppercase border transition-all ${isActive ? 'bg-gold border-gold text-black shadow-lg shadow-gold/20' : 'bg-charcoal border-surface-light text-gray-500 hover:text-white'}`}
                                 >
                                  {note}
                                 </button>
                               );
                            })}
                        </div>
                    </section>

                    <section>
                        <h3 className="text-[10px] font-black text-gray-500 tracking-widest uppercase mb-4">Note Libere</h3>
                        <textarea 
                            rows={2}
                            placeholder="Altre note..."
                            value={editingItem.notes}
                            onChange={e => setEditingItem({...editingItem, notes: e.target.value})}
                            className="w-full bg-charcoal border border-surface-light rounded-2xl p-4 text-white text-xs font-medium outline-none focus:border-gold transition-all"
                        />
                    </section>
                </div>

                {/* Right Side: Additions (60%) */}
                <div className="flex-1 bg-charcoal/30 p-8 overflow-y-auto custom-scrollbar">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-[10px] font-black text-gray-500 tracking-widest uppercase flex items-center gap-2">
                            <Plus size={14} className="text-emerald-500" /> Aggiungi ingredienti extra
                        </h3>
                        <div className="relative w-64">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" size={14} />
                            <input 
                                type="text"
                                placeholder="Cerca aggiunta..."
                                value={ingSearch}
                                onChange={e => setIngSearch(e.target.value)}
                                className="w-full bg-charcoal border border-surface-light rounded-xl py-3 pl-12 pr-4 text-xs font-bold text-white outline-none focus:border-gold"
                            />
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                        {ingredients
                          .filter(i => i.disponibile && i.nome.toLowerCase().includes(ingSearch.toLowerCase()))
                          .map(ing => {
                           const isAdded = editingItem.addedIngredients.some(a => a.nome === ing.nome);
                           return (
                             <button
                                key={ing.id}
                                onClick={() => {
                                  if (isAdded) setEditingItem({...editingItem, addedIngredients: editingItem.addedIngredients.filter(a => a.nome !== ing.nome)});
                                  else setEditingItem({...editingItem, addedIngredients: [...editingItem.addedIngredients, { nome: ing.nome, prezzo: ing.prezzo || 1.5 }]});
                                }}
                                className={`p-4 rounded-2xl font-bold text-[10px] border transition-all text-left flex flex-col gap-1 ${isAdded ? 'bg-emerald-500 border-emerald-500 text-black shadow-lg shadow-emerald-500/20' : 'bg-charcoal border-surface-light text-gray-500 hover:border-surface-light-hover'}`}
                             >
                                <span className={isAdded ? 'text-black' : 'text-white'}>{ing.nome.toUpperCase()}</span>
                                <span className={isAdded ? 'text-black/60 font-black' : 'text-emerald-500 font-black'}>+ €{(ing.prezzo || 1.5).toFixed(2)}</span>
                             </button>
                           )
                        })}
                    </div>
                </div>
             </div>

             {/* Modal Footer */}
             <div className="p-8 border-t border-surface-light bg-surface-light/5 flex justify-between items-center">
                 <div className="flex items-center gap-8 bg-charcoal p-4 rounded-3xl border border-surface-light">
                    <span className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Quantità Riga</span>
                    <div className="flex items-center gap-6">
                        <button onClick={() => setEditingItem({...editingItem, quantity: Math.max(1, editingItem.quantity - 1)})} className="p-2 bg-surface rounded-xl text-gold border border-surface-light active:scale-90"><Minus size={18} /></button>
                        <span className="text-3xl font-black italic w-8 text-center">{editingItem.quantity}</span>
                        <button onClick={() => setEditingItem({...editingItem, quantity: editingItem.quantity + 1})} className="p-2 bg-surface rounded-xl text-gold border border-surface-light active:scale-90"><Plus size={18} /></button>
                    </div>
                 </div>
                 
                 <div className="flex items-center gap-6">
                    <div className="text-right">
                        <p className="text-[10px] font-black text-gray-500 uppercase">Totale Riga</p>
                        <p className="text-4xl font-black italic text-white text-right">€{calculateItemPrice(editingItem).toFixed(2)}</p>
                    </div>
                    <button onClick={saveCustomization} className="bg-emerald-500 hover:bg-emerald-600 text-black px-12 py-6 rounded-[32px] font-black text-xl shadow-xl shadow-emerald-500/20 active:scale-95 transition-all">
                        CONFERMA E AGGIUNGI
                    </button>
                 </div>
             </div>
          </div>
        </div>
      )}
    </>
  );
}
