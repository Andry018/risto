import { useEffect, useState } from 'react';
import { supabase, type Order, type Product } from '../lib/supabase';
import { CheckCircle, Clock, LayoutGrid, List, ToggleLeft, ToggleRight, ChefHat, Bell } from 'lucide-react';

export default function AdminView() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeTab, setActiveTab] = useState<'orders' | 'menu'>('orders');

  useEffect(() => {
    fetchOrders();
    fetchProducts();

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

  const markAsReady = async (id: string) => {
    await supabase.from('ordini').update({ status: 'COMPLETATO' }).eq('id', id);
  };

  const toggleAvailability = async (id: string, currentStatus: boolean) => {
    await supabase.from('prodotti').update({ disponibile: !currentStatus }).eq('id', id);
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
            <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
              <header className="mb-8">
                <h2 className="text-3xl font-bold text-white mb-2">Disponibilità Rapida</h2>
                <p className="text-slate-400">Esaurito un ingrediente? Spegni il prodotto in tempo reale.</p>
              </header>

              <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-xl overflow-hidden">
                <div className="p-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {products.map(product => (
                      <div key={product.id} className="group flex items-center justify-between p-4 bg-slate-800/40 rounded-2xl border border-slate-700/50 hover:bg-slate-800 transition-colors">
                        <div>
                          <h3 className="font-medium text-white group-hover:text-fuchsia-400 transition-colors">{product.nome}</h3>
                          <div className="flex items-center gap-2 mt-1">
                             <span className="text-xs text-slate-500 bg-slate-950 px-2 py-0.5 rounded-full">{product.categoria}</span>
                             <span className="text-sm font-semibold text-slate-400">€{product.prezzo.toFixed(2)}</span>
                          </div>
                        </div>
                        <button 
                          onClick={() => toggleAvailability(product.id, product.disponibile)}
                          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all duration-300 ease-out ${
                            product.disponibile 
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20" 
                            : "bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 shadow-[0_0_15px_rgba(244,63,94,0.15)]"
                          }`}
                        >
                          {product.disponibile ? <ToggleRight size={22} className="text-emerald-500" /> : <ToggleLeft size={22} className="text-rose-500" />}
                          {product.disponibile ? 'ON' : 'OFF'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
