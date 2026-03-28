import React, { useEffect, useState } from 'react';
import { supabase, type Product } from '../lib/supabase';
import { ShoppingCart, Plus, Minus, Clock, User, CheckCircle, ChevronRight, X, Utensils } from 'lucide-react';

type CartItem = Product & { quantity: number };

export default function CustomerView() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [customerName, setCustomerName] = useState('');
  const [pickupTime, setPickupTime] = useState('');
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    // SEO & Title
    document.title = 'Ordina Online | Ristorante Premium';
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute('content', 'Ordina i tuoi piatti preferiti per l\'asporto. Qualità premium direttamente a casa tua.');

    fetchProducts();
    
    const channel = supabase
      .channel('public:prodotti')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'prodotti' }, (payload) => {
        setProducts(current => 
          current.map(p => p.id === payload.new.id ? { ...p, disponibile: payload.new.disponibile } : p)
        );
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchProducts() {
    try {
      const { data, error } = await supabase
        .from('prodotti')
        .select('*')
        .eq('disponibile', true)
        .order('categoria', { ascending: true })
        .order('nome', { ascending: true });
        
      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
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

  const total = cart.reduce((sum, item) => sum + (item.prezzo * item.quantity), 0);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0 || !customerName || !pickupTime) return;

    try {
      const { error } = await supabase.from('ordini').insert([{
        nome_cliente: customerName,
        orario_ritiro: pickupTime,
        totale: total,
        status: 'IN_ATTESA',
        carrello: cart
      }]);

      if (error) throw error;
      
      setOrderSuccess(true);
      setCart([]);
      setCustomerName('');
      setPickupTime('');
      setIsSidebarOpen(false);
      
      setTimeout(() => setOrderSuccess(false), 5000);
    } catch (error) {
      console.error('Error submitting order:', error);
      alert("Errore durante l'invio dell'ordine. Riprova.");
    }
  };

  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  const groupedProducts = products.reduce((acc, product) => {
    if (!acc[product.categoria]) acc[product.categoria] = [];
    acc[product.categoria].push(product);
    return acc;
  }, {} as Record<string, Product[]>);

  // Initialize expanded state once products are loaded
  useEffect(() => {
    if (Object.keys(groupedProducts).length > 0 && Object.keys(expandedCategories).length === 0) {
      const initial: Record<string, boolean> = {};
      Object.keys(groupedProducts).forEach(cat => {
        initial[cat] = true; // All expanded by default for better visibility initially
      });
      setExpandedCategories(initial);
    }
  }, [groupedProducts]);

  if (loading) return (
    <div className="flex justify-center items-center h-screen bg-charcoal">
      <div className="relative w-20 h-20 animate-spin">
         <div className="absolute inset-0 border-t-4 border-l-4 border-gold rounded-full opacity-70"></div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-charcoal flex relative overflow-hidden text-white font-sans selection:bg-gold selection:text-black">
      
      {/* Premium Decorative Accents */}
      <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-gold/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-gold/5 blur-[120px] pointer-events-none" />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-y-auto z-10 custom-scrollbar relative px-6 md:px-12 py-8">
        
        <header className="flex justify-between items-center mb-12">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gold rounded-2xl flex items-center justify-center text-black shadow-lg shadow-gold/20">
              <Utensils size={32} />
            </div>
            <div>
              <h1 className="text-3xl md:text-5xl font-black tracking-tighter text-white">
                RISTO<span className="text-gold">PREMIUM</span>
              </h1>
              <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px] mt-1">Esperienza Culinaria Takeaway</p>
            </div>
          </div>
          
          {/* Cart Floating Button (Mobile) */}
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="md:hidden relative p-4 bg-surface rounded-2xl border border-surface-light text-gold shadow-2xl active:scale-95 transition-all"
          >
            <ShoppingCart size={24} />
            {cart.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-gold text-black text-[10px] font-black w-6 h-6 rounded-full flex items-center justify-center border-2 border-charcoal">
                {cart.reduce((s, i) => s + i.quantity, 0)}
              </span>
            )}
          </button>
        </header>

        {orderSuccess && (
          <div className="mb-12 p-8 bg-gold rounded-3xl text-black shadow-2xl flex flex-col items-center animate-in fade-in zoom-in slide-in-from-top-4 duration-500">
            <CheckCircle size={64} className="mb-4" />
            <h3 className="text-3xl font-black tracking-tighter mb-2 uppercase italic leading-none">Ordine Inviato!</h3>
            <p className="font-bold opacity-80 uppercase tracking-widest text-xs">Preparazione in corso...</p>
          </div>
        )}

        {/* Product Menu */}
        <div className="space-y-12 pb-32 md:pb-12">
          {Object.entries(groupedProducts).map(([categoria, items]) => (
            <div key={categoria} className="space-y-6">
              <button 
                onClick={() => toggleCategory(categoria)}
                className="w-full flex items-center gap-6 group"
              >
                <div className={`p-2 rounded-lg bg-surface border transition-all ${expandedCategories[categoria] ? 'border-gold text-gold rotate-0' : 'border-surface-light text-gray-500 -rotate-90'}`}>
                  <ChevronRight size={24} />
                </div>
                <h2 className="text-2xl font-black text-white uppercase tracking-tight group-hover:text-gold transition-colors">
                  {categoria}
                </h2>
                <div className="flex-1 h-px bg-surface-light group-hover:bg-gold/20 transition-colors" />
                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{items.length} PRODOTTI</span>
              </button>

              {expandedCategories[categoria] && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-in fade-in slide-in-from-top-4 duration-500">
                {items.map(product => (
                  <div 
                    key={product.id} 
                    className="group bg-surface border border-surface-light p-6 rounded-[32px] flex flex-col justify-between hover:border-gold/40 transition-all duration-500 hover:shadow-2xl hover:shadow-black/50"
                  >
                    <div>
                      <div className="flex justify-between items-start mb-4">
                        <h3 className="text-xl font-bold text-white group-hover:text-gold transition-colors">{product.nome}</h3>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Prezzo</span>
                        <p className="text-2xl font-black text-white">€{product.prezzo.toFixed(2)}</p>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => addToCart(product)}
                      className="mt-8 w-full bg-charcoal hover:bg-gold hover:text-black py-4 px-6 rounded-2xl flex items-center justify-between font-black uppercase text-sm tracking-widest transition-all duration-300 border border-surface-light active:scale-95 group/btn shadow-md"
                    >
                      Aggiungi 
                      <div className="w-8 h-8 rounded-lg bg-surface border border-surface-light flex items-center justify-center group-hover/btn:bg-black/10 group-hover/btn:border-black/20">
                        <Plus size={18} />
                      </div>
                    </button>
                  </div>
                ))}
              </div>
            )}
            </div>
          ))}
        </div>
      </div>

      {/* Cart Sidebar */}
      <div className={`
        fixed inset-y-0 right-0 z-50 w-full md:w-[450px] lg:w-[500px]
        md:relative transform ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
        transition-transform duration-700 ease-[cubic-bezier(0.23,1,0.32,1)]
      `}>
        {/* Mobile Backdrop */}
        {isSidebarOpen && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md -z-10 md:hidden" onClick={() => setIsSidebarOpen(false)} />
        )}
        
        <div className="h-full bg-surface border-l border-surface-light shadow-[-50px_0_100px_rgba(0,0,0,0.5)] flex flex-col p-8 lg:p-12 relative overflow-hidden">
          
          {/* Sidebar Decor */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-gold/5 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2" />
          
          <header className="flex items-center justify-between mb-12 relative z-10">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-charcoal rounded-2xl flex items-center justify-center text-gold border border-surface-light shadow-xl">
                <ShoppingCart size={24} />
              </div>
              <h2 className="text-2xl font-black tracking-tight text-white uppercase italic">IL TUO <span className="text-gold underline decoration-2 underline-offset-4">ORDINE</span></h2>
            </div>
            <button 
              className="md:hidden p-3 bg-charcoal border border-surface-light rounded-full text-gold active:scale-90 transition-all"
              onClick={() => setIsSidebarOpen(false)}
            >
              <X size={24} />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar relative z-10">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-600">
                <div className="w-24 h-24 bg-charcoal border border-surface-light rounded-[40px] flex items-center justify-center mb-6 shadow-inner">
                  <ShoppingCart size={40} className="text-surface-light" />
                </div>
                <p className="font-black uppercase tracking-widest text-[10px]">Il tuo carrello è vuoto</p>
              </div>
            ) : (
              <div className="space-y-6">
                {cart.map(item => (
                  <div key={item.id} className="group flex items-center gap-6 p-6 bg-charcoal/50 border border-surface-light rounded-[32px] hover:border-gold/30 transition-all">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-white text-lg truncate leading-none mb-2">{item.nome}</p>
                      <p className="text-gold font-black tracking-tighter">€{(item.prezzo * item.quantity).toFixed(2)}</p>
                    </div>
                    <div className="flex items-center gap-2 bg-surface p-1.5 rounded-2xl border border-surface-light shadow-lg">
                      <button 
                        onClick={() => removeFromCart(item.id)} 
                        className="w-10 h-10 flex items-center justify-center bg-charcoal hover:bg-red-500/20 hover:text-red-500 rounded-xl text-gray-500 transition-all shadow-sm active:scale-90"
                      >
                        <Minus size={16} />
                      </button>
                      <span className="w-8 text-center font-black text-lg text-white">{item.quantity}</span>
                      <button 
                        onClick={() => addToCart(item)} 
                        className="w-10 h-10 flex items-center justify-center bg-charcoal hover:bg-gold/20 hover:text-gold rounded-xl text-gray-500 transition-all shadow-sm active:scale-90"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Checkout Logic */}
          {cart.length > 0 && (
            <div className="mt-12 pt-10 border-t border-surface-light relative z-10">
              <div className="flex justify-between items-end mb-10">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-[.3em]">Totale Ordine</span>
                <span className="text-5xl font-black text-white italic tracking-tighter leading-none">€{total.toFixed(2)}</span>
              </div>
              
              <form onSubmit={handleCheckout} className="space-y-6">
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none text-gray-500 group-focus-within:text-gold transition-colors">
                    <User size={20} />
                  </div>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    className="block w-full pl-14 pr-6 py-5 bg-charcoal border border-surface-light rounded-2xl focus:border-gold text-white font-bold outline-none transition-all placeholder:text-gray-600 placeholder:font-bold placeholder:uppercase placeholder:text-[10px] placeholder:tracking-widest"
                    placeholder="Il tuo nome (es. Mario Rossi)"
                  />
                </div>
                
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none text-gray-500 group-focus-within:text-gold transition-colors">
                    <Clock size={20} />
                  </div>
                  <input
                    type="time"
                    required
                    value={pickupTime}
                    onChange={e => setPickupTime(e.target.value)}
                    className="block w-full pl-14 pr-6 py-5 bg-charcoal border border-surface-light rounded-2xl focus:border-gold text-white font-bold outline-none transition-all color-scheme-dark"
                  />
                </div>
                
                <button
                  type="submit"
                  className="w-full bg-gold hover:bg-gold-hover text-black font-black text-xl py-6 rounded-3xl shadow-2xl shadow-gold/10 transition-all active:scale-95 flex items-center justify-center gap-3 mt-4"
                >
                  CONFERMA ORDINE <ChevronRight size={24} />
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
      
    </div>
  );
}
