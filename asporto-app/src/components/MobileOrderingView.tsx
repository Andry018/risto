import { useEffect, useState } from 'react';
import { supabase, type Product } from '../lib/supabase';
import { Plus, Minus, Wifi, Battery, Signal } from 'lucide-react';

type CartItem = Product & { quantity: number; portata: number };

export default function MobileOrderingView() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activePortata, setActivePortata] = useState<number>(2);

  useEffect(() => {
    fetchProducts();
    const channel = supabase
      .channel('public:prodotti')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'prodotti' }, (payload: any) => {
        setProducts(current => current.map(p => p.id === payload.new.id ? { ...p, disponibile: payload.new.disponibile } : p));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  async function fetchProducts() {
    const { data } = await supabase.from('prodotti').select('*').eq('disponibile', true).order('nome', { ascending: true });
    if (data) setProducts(data);
  }

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id && item.portata === activePortata);
      if (existing) {
        return prev.map(item => item.id === product.id && item.portata === activePortata ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { ...product, quantity: 1, portata: activePortata }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === productId && item.portata === activePortata);
      if (existing && existing.quantity > 1) {
        return prev.map(item => item.id === productId && item.portata === activePortata ? { ...item, quantity: item.quantity - 1 } : item);
      }
      return prev.filter(item => !(item.id === productId && item.portata === activePortata));
    });
  };

  const currentCartTotal = cart.reduce((sum, item) => sum + (item.prezzo * item.quantity), 0);
  const displayedProducts = products.filter(p => cart.some(c => c.id === p.id && c.portata === activePortata) || true); // Showing all available for the active portata

  const submitOrder = async () => {
    if (cart.length === 0) return;
    await supabase.from('ordini').insert([{
      nome_cliente: 'TAVOLO 4',
      orario_ritiro: new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
      totale: currentCartTotal,
      status: 'IN_ATTESA',
      carrello: cart
    }]);
    setCart([]);
    alert('Ordine inviato con successo!');
  };

  return (
    <div className="min-h-screen bg-charcoal text-white font-sans flex flex-col max-w-md mx-auto relative border-x border-surface">
      
      {/* Simulated Status Bar */}
      <div className="flex justify-between items-center px-4 py-2 text-xs text-gray-300">
        <span>08:32</span>
        <div className="flex items-center gap-1.5">
          <Signal size={12} strokeWidth={2.5} />
          <Wifi size={12} strokeWidth={2.5} />
          <Battery size={12} strokeWidth={2.5} />
        </div>
      </div>

      <div className="px-5 pt-2 pb-6 flex-1 overflow-y-auto hide-scrollbar">
        {/* Header */}
        <h1 className="text-4xl font-bold text-white tracking-widest mb-6">TAVOLO 4</h1>

        {/* Portata Tabs */}
        <div className="flex gap-2 mb-8 overflow-x-auto hide-scrollbar">
          {[1, 2, 3].map(num => (
            <button 
              key={num}
              onClick={() => setActivePortata(num)}
              className={`flex-1 py-3 px-2 rounded-lg font-bold text-sm tracking-wider whitespace-nowrap transition-colors ${
                activePortata === num 
                ? 'bg-gold text-black border-none' 
                : 'bg-transparent text-gray-300 border border-gray-600'
              } shadow-lg transition-transform active:scale-95`}
            >
              PORTATA {num}
            </button>
          ))}
        </div>

        {/* Items List */}
        <div className="space-y-4">
          {displayedProducts.map(product => {
            const cartItem = cart.find(c => c.id === product.id && c.portata === activePortata);
            const quantity = cartItem?.quantity || 0;
            
            return (
              <div key={product.id} className="bg-surface rounded-xl p-4 flex items-center justify-between border border-surface-light">
                <div>
                  <h3 className="text-lg font-bold text-white tracking-tight">{product.nome}</h3>
                  <p className="text-gray-300 font-medium">€{product.prezzo.toFixed(2)}</p>
                </div>
                
                <div className="flex items-center gap-4 bg-charcoal rounded-xl border border-surface-light p-1">
                  <button 
                    onClick={() => quantity > 0 && removeFromCart(product.id)}
                    className="w-12 h-12 flex items-center justify-center bg-surface hover:bg-gold hover:text-black rounded-lg transition-colors text-gold"
                  >
                    <Minus size={24} />
                  </button>
                  <span className="w-6 text-center text-xl font-bold text-white">{quantity}</span>
                  <button 
                    onClick={() => addToCart(product)}
                    className="w-12 h-12 flex items-center justify-center bg-surface hover:bg-gold hover:text-black rounded-lg transition-colors text-gold"
                  >
                    <Plus size={24} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Summary & CTA */}
      <div className="bg-surface border-t border-surface-light p-5 pb-8 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.5)] z-10 sticky bottom-0">
        <div className="flex justify-between items-center mb-6 px-2">
          <span className="text-gray-300 font-bold tracking-widest text-sm uppercase">Il tuo totale</span>
          <span className="text-4xl font-black text-gold">€{currentCartTotal.toFixed(2)}</span>
        </div>
        
        <button 
          onClick={submitOrder}
          disabled={cart.length === 0}
          className="w-full bg-gold hover:bg-gold-hover disabled:opacity-50 disabled:bg-gray-700 text-charcoal font-black tracking-widest py-5 rounded-xl text-lg transition-colors"
        >
          INVIA ORDINE
        </button>
      </div>
      
    </div>
  );
}
