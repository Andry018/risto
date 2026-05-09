import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase, type Product, type Ingredient, type OrderCarrelloItem, IS_DEMO_MODE } from '../lib/supabase';
import { newUniqueId } from '../lib/id';
import { MOCK_PRODUCTS, MOCK_INGREDIENTS, MOCK_TABLES } from '../lib/MockData';
import { ShoppingCart, Plus, Minus, Trash2, Search, CheckCircle, Calculator, AlertTriangle, Save, WifiOff, LayoutDashboard, Edit3, X, AlertCircle, Users } from 'lucide-react';
import { syncManager } from '../lib/OfflineSync';

type CustomizedItem = Product & {
  quantity: number;
  addedIngredients: { nome: string, prezzo: number }[];
  removedIngredients: string[];
  notes: string;
  uniqueId: string;
};

export default function POSView({ tableId: propTableId, tableName: propTableName, onOrderFinished }: { tableId?: string, tableName?: string, onOrderFinished?: () => void }) {
  const [searchParams] = useSearchParams();
  const tableId = propTableId || searchParams.get('tableId');
  const tableName = propTableName || searchParams.get('tableName');

  const [products, setProducts] = useState<Product[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [cart, setCart] = useState<CustomizedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [isSplitModalOpen, setIsSplitModalOpen] = useState(false);
  const [splitType, setSplitType] = useState<'NONE' | 'EQUAL' | 'GUESTS' | 'CUSTOM'>('NONE');
  const [customSplitCount, setCustomSplitCount] = useState(2);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
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

  async function fetchProducts() {
    if (IS_DEMO_MODE) {
      setProducts(MOCK_PRODUCTS);
      setLoading(false);
      return;
    }
    try {
      if (!supabase) {
        setProducts(MOCK_PRODUCTS);
        return;
      }
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
    if (IS_DEMO_MODE || !supabase) {
      setIngredients(MOCK_INGREDIENTS);
      return;
    }
    const { data } = await supabase.from('ingredienti').select('*');
    if (data) setIngredients(data);
  }

  async function fetchExistingOrder() {
    if (IS_DEMO_MODE) {
      const mockTable = MOCK_TABLES.find(t => t.id === tableId || t.nome === tableName);
      if (mockTable && mockTable.clienti > 0) {
        const copertoProd = MOCK_PRODUCTS.find(p => p.nome === 'COPERTO');
        if (copertoProd) {
          setCart([{
            ...copertoProd,
            quantity: mockTable.clienti,
            addedIngredients: [],
            removedIngredients: [],
            notes: '',
            uniqueId: 'initial-coperto'
          }]);
        }
      }
      return;
    }
    if (!supabase) return;
    const { data: order } = await supabase
      .from('ordini')
      .select('*')
      .eq('nome_cliente', tableName)
      .eq('status', 'IN_ATTESA')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (order) {
      setActiveOrderId(order.id);
      const mappedCart = (order.carrello || []).map((item: OrderCarrelloItem) => {
        const product = products.find(p => p.nome === item.nome);
        return {
          ...(product || { id: newUniqueId(), nome: item.nome, prezzo: item.prezzo_unitario ?? 0, categoria: 'Generale', disponibile: true, ingredienti: [] }),
          quantity: item.quantity,
          addedIngredients: item.modifiche?.aggiunte?.map((name: string) => {
            const ing = ingredients.find(i => i.nome === name);
            return { nome: name, prezzo: ing?.prezzo || 0 };
          }) || [],
          removedIngredients: item.modifiche?.rimozioni || [],
          notes: item.modifiche?.note || '',
          uniqueId: newUniqueId()
        };
      });
      setCart(mappedCart);
    } else if (tableId) {
      const { data: table } = await supabase.from('tavoli').select('clienti').eq('id', tableId).single();
      if (table && table.clienti > 0) {
        const { data: prods } = await supabase.from('prodotti').select('*').eq('nome', 'COPERTO').maybeSingle();
        const copertoProd = prods || MOCK_PRODUCTS.find(p => p.nome === 'COPERTO');
        
        if (copertoProd) {
          setCart([{
            ...copertoProd,
            quantity: table.clienti,
            addedIngredients: [],
            removedIngredients: [],
            notes: '',
            uniqueId: 'initial-coperto'
          }]);
        }
      }
    }
  }

  useEffect(() => {
    void fetchProducts();
    void fetchIngredients();

    if (!supabase) return;
    const sb = supabase;

    const productsChannel = sb
      .channel('public:prodotti')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prodotti' }, () => void fetchProducts())
      .subscribe();
    const ingredientsChannel = sb
      .channel('public:ingredienti')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ingredienti' }, () => void fetchIngredients())
      .subscribe();
    return () => { 
      sb.removeChannel(productsChannel); 
      sb.removeChannel(ingredientsChannel);
    };
  }, []);

  useEffect(() => {
    if (tableId && products.length > 0) {
      void fetchExistingOrder();
    }
  }, [tableId, products.length]);

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
        uniqueId: newUniqueId()
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
      uniqueId: newUniqueId()
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

  const handleFinishOrder = async () => {
    if (cart.length === 0) return;

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
        nome_cliente: tableName || 'POS',
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
                  <h2 className="text-sm text-gray-400 font-bold tracking-widest uppercase italic">Comanda & Conto</h2>
                  {pendingSyncCount > 0 && (
                    <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-500 text-white text-[8px] font-black rounded uppercase animate-pulse">
                      <WifiOff size={8} /> Sincronizzazione in corso ({pendingSyncCount})
                    </span>
                  )}
                </div>
                <h1 className="text-4xl font-black text-white mt-1">POS <span className="text-gold italic">TERMINAL</span></h1>
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
                <div
                  key={product.id}
                  onClick={() => isTrulyAvailable && addToCart(product)}
                  className={`bg-surface border p-5 rounded-[24px] flex flex-col justify-between text-left transition-all active:scale-95 group shadow-xl h-44 relative overflow-hidden cursor-pointer ${
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
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isTrulyAvailable) openCustomization(product);
                        }}
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
                </div>
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

          <div className="flex justify-between items-end mb-8">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-[.3em]">Totale</span>
            <span className="text-6xl font-black text-white italic tracking-tighter leading-none">€<span className="text-gold">{total.toFixed(2)}</span></span>
          </div>

          {orderSuccess ? (
            <div className="w-full bg-emerald-500 text-black font-black text-xl py-6 rounded-3xl flex items-center justify-center gap-3 animate-in zoom-in">
              <CheckCircle size={24} /> OPERAZIONE COMPLETATA!
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <button
                onClick={() => setIsSplitModalOpen(true)}
                disabled={cart.length === 0}
                className="w-full bg-surface hover:bg-white/5 text-gold font-black text-xs py-4 rounded-2xl border border-dashed border-gold/30 mb-2 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <Users size={16} /> DIVISIONE CONTO
              </button>
              
              {tableId && (
                <button
                  onClick={handleUpdateBill}
                  disabled={cart.length === 0}
                  className="w-full bg-surface-light hover:bg-white/10 text-white font-black text-lg py-4 rounded-2xl border border-surface-light transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  Salva solo Comanda <Save size={20} />
                </button>
              )}
              <button
                onClick={handleFinishOrder}
                disabled={cart.length === 0}
                className="w-full bg-gold hover:bg-gold-hover text-black font-black text-2xl py-6 rounded-3xl shadow-2xl shadow-gold/20 transition-all active:scale-95 flex items-center justify-center gap-4 disabled:opacity-50 disabled:grayscale"
              >
                Chiudi Conto <CheckCircle size={28} />
              </button>
            </div>
          )}
        </div>
      </aside>

    </div>
      {/* Payment Split Modal */}
      {isSplitModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-surface border border-surface-light w-full max-w-xl rounded-[40px] shadow-2xl overflow-hidden p-10">
            <div className="flex justify-between items-center mb-10">
              <div>
                <h2 className="text-4xl font-black italic uppercase text-white tracking-tighter">Divisione <span className="text-gold">Conto</span></h2>
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mt-1">Seleziona come dividere il totale di €{total.toFixed(2)}</p>
              </div>
              <button onClick={() => setIsSplitModalOpen(false)} className="p-4 bg-charcoal rounded-2xl text-gray-500 hover:text-white border border-surface-light"><X size={24} /></button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-10">
              <button 
                onClick={() => setSplitType('EQUAL')}
                className={`p-6 rounded-3xl border-2 flex flex-col items-center gap-4 transition-all ${splitType === 'EQUAL' ? 'bg-gold/10 border-gold text-gold shadow-xl' : 'bg-charcoal border-surface-light text-gray-500'}`}
              >
                <div className="w-12 h-12 rounded-2xl bg-surface flex items-center justify-center text-xl font-black italic">1/2</div>
                <div className="text-center">
                  <div className="text-xs font-black uppercase tracking-widest">In due</div>
                  <div className="text-[10px] opacity-60 mt-1">€{(total / 2).toFixed(2)} a testa</div>
                </div>
              </button>

              <button 
                onClick={() => setSplitType('GUESTS')}
                className={`p-6 rounded-3xl border-2 flex flex-col items-center gap-4 transition-all ${splitType === 'GUESTS' ? 'bg-gold/10 border-gold text-gold shadow-xl' : 'bg-charcoal border-surface-light text-gray-500'}`}
              >
                <Users size={32} />
                <div className="text-center">
                  <div className="text-xs font-black uppercase tracking-widest">Per Coperti</div>
                  <div className="text-[10px] opacity-60 mt-1">Diviso {MOCK_TABLES.find(t => t.id === tableId)?.clienti || 1} persone</div>
                </div>
              </button>

              <div className={`col-span-2 p-6 rounded-3xl border-2 flex items-center justify-between transition-all ${splitType === 'CUSTOM' ? 'bg-gold/10 border-gold text-gold shadow-xl' : 'bg-charcoal border-surface-light text-gray-500'}`}>
                <div className="flex items-center gap-4">
                  <button onClick={() => setSplitType('CUSTOM')} className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black ${splitType === 'CUSTOM' ? 'bg-gold text-black' : 'bg-surface'}`}>N</button>
                  <div>
                    <div className="text-xs font-black uppercase tracking-widest">Dividi per numero...</div>
                    {splitType === 'CUSTOM' && <div className="text-[10px] opacity-60 mt-1">€{(total / customSplitCount).toFixed(2)} a testa</div>}
                  </div>
                </div>
                {splitType === 'CUSTOM' && (
                  <div className="flex items-center gap-4 bg-charcoal p-2 rounded-2xl border border-surface-light">
                    <button onClick={() => setCustomSplitCount(Math.max(1, customSplitCount - 1))} className="p-2 text-gold"><Minus size={16} /></button>
                    <span className="text-xl font-black italic text-white w-8 text-center">{customSplitCount}</span>
                    <button onClick={() => setCustomSplitCount(customSplitCount + 1)} className="p-2 text-gold"><Plus size={16} /></button>
                  </div>
                )}
              </div>
            </div>

            <button 
              onClick={() => {
                const parts = splitType === 'EQUAL' ? 2 : splitType === 'GUESTS' ? (MOCK_TABLES.find(t => t.id === tableId)?.clienti || 1) : customSplitCount;
                alert(`SIMULAZIONE: Avvio pagamento diviso in ${parts} quote da €${(total / parts).toFixed(2)} ciascuna.`);
                handleFinishOrder();
                setIsSplitModalOpen(false);
              }}
              disabled={splitType === 'NONE'}
              className="w-full bg-gold hover:bg-gold-hover text-black font-black py-6 rounded-3xl text-xl shadow-2xl shadow-gold/20 active:scale-95 transition-all disabled:opacity-30"
            >
              PROCEDI AL PAGAMENTO DIVISO
            </button>
          </div>
        </div>
      )}
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
                            {['Rosè', 'Bianca', 'Rossa', 'Cottura ++', 'Senza Glutine', 'Senza Lattosio'].map(note => {
                               const isActive = editingItem.notes.includes(note);
                               return (
                                 <button 
                                  key={note}
                                  onClick={() => {
                                    let newNotes = editingItem.notes;
                                    let newAdded = [...editingItem.addedIngredients];
                                    
                                    const pricedVariants: Record<string, number> = {
                                      'Senza Glutine': 5.0,
                                      'Senza Lattosio': 1.5
                                    };

                                    if (isActive) {
                                      newNotes = newNotes.replace(note, '').replace(/,\s*,/g, ',').replace(/^,\s*/, '').replace(/,\s*$/, '').trim();
                                      if (pricedVariants[note]) {
                                        newAdded = newAdded.filter(a => a.nome !== note);
                                      }
                                    } else {
                                      newNotes = newNotes ? `${newNotes}, ${note}` : note;
                                      if (pricedVariants[note]) {
                                        newAdded.push({ nome: note, prezzo: pricedVariants[note] });
                                      }
                                    }
                                    setEditingItem({...editingItem, notes: newNotes, addedIngredients: newAdded});
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
