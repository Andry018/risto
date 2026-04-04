import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase, type Product, type Ingredient, type Tavolo } from '../lib/supabase';
import { Plus, Minus, Search, Save, CreditCard, Users, ChevronLeft, AlertTriangle, WifiOff, LayoutDashboard } from 'lucide-react';
import { syncManager } from '../lib/OfflineSync';

type CartItem = Product & { quantity: number };

export default function WaiterMobileView() {
  const [tables, setTables] = useState<Tavolo[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedTable, setSelectedTable] = useState<Tavolo | null>(null);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [testMode, setTestMode] = useState(false);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);

  useEffect(() => {
    const handleSyncChange = () => setPendingSyncCount(syncManager.getPendingCount());
    window.addEventListener('sync-status-changed', handleSyncChange);
    return () => window.removeEventListener('sync-status-changed', handleSyncChange);
  }, []);

  useEffect(() => {
    fetchInitialData();
    const tablesChannel = supabase.channel('public:tavoli').on('postgres_changes', { event: '*', schema: 'public', table: 'tavoli' }, () => fetchTables()).subscribe();
    return () => { supabase.removeChannel(tablesChannel); };
  }, []);

  async function fetchInitialData() {
    await Promise.all([fetchTables(), fetchProducts(), fetchIngredients()]);
    setLoading(false);
  }

  async function fetchTables() {
    const { data } = await supabase.from('tavoli').select('*').order('nome', { ascending: true });
    if (data) setTables(data);
  }

  async function fetchProducts() {
    const { data } = await supabase.from('prodotti').select('*').order('nome', { ascending: true });
    if (data) setProducts(data);
  }

  async function fetchIngredients() {
    const { data } = await supabase.from('ingredienti').select('*');
    if (data) setIngredients(data);
  }

  const selectTable = async (table: Tavolo) => {
    setSelectedTable(table);
    setCart([]);
    setActiveOrderId(null);

    // Fetch existing order
    const { data } = await supabase
      .from('ordini')
      .select('*')
      .eq('nome_cliente', table.nome)
      .eq('status', 'IN_ATTESA')
      .maybeSingle();
    
    if (data) {
      setActiveOrderId(data.id);
      setCart(data.carrello || []);
    }
  };

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === productId);
      if (existing && existing.quantity > 1) return prev.map(item => item.id === productId ? { ...item, quantity: item.quantity - 1 } : item);
      return prev.filter(item => item.id !== productId);
    });
  };

  const total = cart.reduce((sum, item) => sum + (item.prezzo * item.quantity), 0);

  const saveOrder = async (isClosing: boolean = false, isCard: boolean = false) => {
    if (!selectedTable || cart.length === 0) return;
    try {
      if (isCard && !testMode) {
        // Handle SumUp redirect (placeholder if needed, or already handled by PWA)
        // For now, mobile view just marks as paid if in test mode
      }

      const orderData = {
        nome_cliente: selectedTable.nome,
        orario_ritiro: new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
        totale: total,
        status: (isClosing ? 'COMPLETATO' : 'IN_ATTESA') as 'COMPLETATO' | 'IN_ATTESA',
        carrello: cart
      };

      if (activeOrderId) {
        await syncManager.pushOrder({ ...orderData, id: activeOrderId });
      } else {
        await syncManager.pushOrder(orderData);
        await syncManager.pushTableUpdate(selectedTable.id, { status: 'OCCUPATO' });
      }

      if (isClosing) {
        await syncManager.pushTableUpdate(selectedTable.id, { status: 'LIBERO', clienti: 0 });
        setSelectedTable(null);
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (e) {
      alert('Errore nel salvataggio');
    }
  };

  if (loading) return <div className="min-h-screen bg-charcoal flex items-center justify-center text-gold">Caricamento...</div>;

  return (
    <div className="min-h-screen bg-charcoal text-white font-sans flex flex-col max-w-md mx-auto relative border-x border-surface">
      
      {!selectedTable ? (
        <div className="p-6 space-y-6 overflow-y-auto">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-black italic text-gold uppercase tracking-tighter">Sala & Tavoli</h1>
            <Link to="/" className="p-2 bg-surface rounded-xl text-gray-500 hover:text-white transition-colors">
              <LayoutDashboard size={20} />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {tables.map(table => (
              <button 
                key={table.id}
                onClick={() => selectTable(table)}
                className={`p-6 rounded-3xl border-2 flex flex-col items-center gap-2 transition-all active:scale-95 ${
                  table.status === 'LIBERO' ? 'bg-surface border-surface-light text-gray-500' : 'bg-emerald-500/10 border-emerald-500 text-emerald-400 font-bold'
                }`}
              >
                <div className="text-2xl font-black">{table.nome.match(/\d+/)?.[0] || 'T'}</div>
                <div className="text-[10px] uppercase font-black tracking-widest opacity-60">{table.status}</div>
                <div className="flex items-center gap-1 text-xs"><Users size={10} /> {table.clienti}</div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header Mobile */}
          <div className="p-4 bg-surface border-b border-surface-light flex items-center justify-between sticky top-0 z-20">
            <button onClick={() => setSelectedTable(null)} className="p-2 bg-charcoal rounded-xl text-gray-400"><ChevronLeft /></button>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black italic uppercase text-white">{selectedTable.nome}</h2>
              {pendingSyncCount > 0 && <WifiOff size={14} className="text-blue-500 animate-pulse" />}
            </div>
            <div className="w-10 h-10 bg-gold rounded-xl flex items-center justify-center text-black font-black">
               €{total.toFixed(0)}
            </div>
          </div>

          {/* Search & Products */}
          <div className="p-4 bg-charcoal">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
              <input 
                type="text" 
                placeholder="Cerca prodotto..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-surface border border-surface-light rounded-2xl py-3 pl-12 text-white font-bold outline-none"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-40">
            {products
              .filter(p => !searchQuery || p.nome.toLowerCase().includes(searchQuery.toLowerCase()))
              .map(product => {
                const missing = product.ingredienti?.filter(ingName => {
                  const ingredient = ingredients.find(i => i.nome === ingName);
                  return ingredient && !ingredient.disponibile;
                }) || [];
                const available = product.disponibile && missing.length === 0;
                const cartItem = cart.find(c => c.id === product.id);

                return (
                  <div key={product.id} className={`p-4 rounded-2xl border flex items-center justify-between transition-all ${available ? 'bg-surface border-surface-light' : 'bg-red-500/5 border-red-500/20 opacity-60'}`}>
                    <div className="flex-1 pr-4">
                      <h3 className={`font-bold ${available ? 'text-white' : 'text-gray-500 line-through'}`}>{product.nome}</h3>
                      <p className="text-[10px] uppercase font-black text-gray-500">{available ? product.categoria : `MANCA: ${missing.join(', ')}`}</p>
                    </div>
                    {available ? (
                      <div className="flex items-center gap-3">
                        {cartItem && (
                          <button onClick={() => removeFromCart(product.id)} className="w-10 h-10 bg-charcoal text-gold rounded-xl flex items-center justify-center"><Minus size={18} /></button>
                        )}
                        {cartItem && <span className="w-4 text-center font-bold">{cartItem.quantity}</span>}
                        <button onClick={() => addToCart(product)} className="w-10 h-10 bg-gold text-black rounded-xl flex items-center justify-center shadow-lg"><Plus size={18} /></button>
                      </div>
                    ) : (
                      <AlertTriangle size={18} className="text-red-500" />
                    )}
                  </div>
                );
              })}
          </div>

          {/* Bottom Bar */}
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-surface border-t border-surface-light rounded-t-[40px] shadow-2xl z-30">
            <div className="flex justify-between items-center mb-4 px-2">
              <span className="text-sm font-black text-gray-400 uppercase tracking-widest">Totale</span>
              <span className="text-3xl font-black text-gold">€{total.toFixed(2)}</span>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => saveOrder(false)}
                disabled={cart.length === 0}
                className="flex-[2] bg-surface-light hover:bg-white/10 text-white font-black py-4 rounded-2xl border border-white/10 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {success ? 'SALVATO!' : 'AGGIORNA'} <Save size={18} />
              </button>
              <button 
                onClick={() => saveOrder(true, true)}
                disabled={cart.length === 0}
                className="flex-[3] bg-gold hover:bg-gold-hover text-black font-black py-4 rounded-2xl shadow-xl flex items-center justify-center gap-2 disabled:opacity-50"
              >
                PAGA & CHIUDI <CreditCard size={18} />
              </button>
            </div>
            {testMode && (
               <div className="mt-2 text-center">
                 <span className="text-[10px] font-black uppercase text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded">MODALITÀ TEST ATTIVA</span>
               </div>
            )}
            <button 
              onClick={() => setTestMode(!testMode)}
              className="w-full text-center text-[10px] text-gray-500 mt-2 underline"
            >
              {testMode ? 'Disattiva Test Mode' : 'Attiva Test Mode'}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
