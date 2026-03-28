import { useEffect, useState } from 'react';
import { supabase, type Product, type Ingredient } from '../lib/supabase';
import { ShoppingCart, Plus, Minus, Trash2, Search, CheckCircle, Calculator, CreditCard, AlertTriangle, Save, WifiOff } from 'lucide-react';
import { syncManager } from '../lib/OfflineSync';

type CartItem = Product & { quantity: number };

export default function POSView({ tableId, tableName, onOrderFinished }: { tableId?: string, tableName?: string, onOrderFinished?: () => void }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD'>('CASH');
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [testMode, setTestMode] = useState(false);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);

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
    const { data } = await supabase.from('ingredienti').select('*');
    if (data) setIngredients(data);
  }

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === productId);
      if (existing && existing.quantity > 1) {
        return prev.map(item => item.id === productId ? { ...item, quantity: item.quantity - 1 } : item);
      }
      return prev.filter(item => item.id !== productId);
    });
  };

  const clearCart = () => setCart([]);

  const total = cart.reduce((sum, item) => sum + (item.prezzo * item.quantity), 0);

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
        carrello: cart
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
        carrello: cart
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
    <div className="flex-1 flex h-full bg-charcoal text-white overflow-hidden p-8 gap-8">
      
      {/* Left Column: Menu */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="mb-8 flex flex-col gap-6">
          <div className="flex justify-between items-center">
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
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all ${
                      isTrulyAvailable 
                        ? 'bg-charcoal border-surface-light text-gold group-hover:bg-gold group-hover:text-black' 
                        : 'bg-red-500/10 border-red-500/20 text-red-500'
                    }`}>
                      {isTrulyAvailable ? <Plus size={20} /> : <AlertTriangle size={20} />}
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
      <aside className="w-[450px] bg-surface flex flex-col rounded-[40px] border border-surface-light shadow-2xl relative overflow-hidden">
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
              <div key={item.id} className="bg-charcoal/50 border border-surface-light rounded-2xl p-4 flex items-center justify-between group">
                <div className="flex-1 min-w-0 pr-4">
                  <p className="font-bold text-white truncate leading-none mb-1">{item.nome}</p>
                  <p className="text-gold font-black text-sm">€{(item.prezzo * item.quantity).toFixed(2)}</p>
                </div>
                <div className="flex items-center gap-2 bg-surface p-1 rounded-xl border border-surface-light shadow-lg">
                  <button onClick={() => removeFromCart(item.id)} className="w-8 h-8 flex items-center justify-center bg-charcoal hover:bg-gold/20 hover:text-gold rounded-lg text-gray-500 transition-all active:scale-90"><Minus size={14} /></button>
                  <span className="w-6 text-center font-black text-white">{item.quantity}</span>
                  <button onClick={() => addToCart(item)} className="w-8 h-8 flex items-center justify-center bg-charcoal hover:bg-gold/20 hover:text-gold rounded-lg text-gray-500 transition-all active:scale-90"><Plus size={14} /></button>
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
  );
}
