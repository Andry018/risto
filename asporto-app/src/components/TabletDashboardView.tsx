import { useEffect, useState } from 'react';
import { supabase, type Order, type Product, type Ingredient } from '../lib/supabase';
import SyncStatusIndicator from './SyncStatusIndicator';

import { LayoutDashboard, BookOpen, CheckCircle2, Map as MapIcon, Save, Calculator, Plus, Calendar } from 'lucide-react';
import TableMapView from './TableMapView';
import POSView from './POSView';
import ReservationsView from './ReservationsView';

export default function TabletDashboardView() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [activeView, setActiveView] = useState<'POS' | 'ORDINI' | 'MAPPA' | 'MENU' | 'PRENOTAZIONI'>('MAPPA');
  const [menuTab, setMenuTab] = useState<'PRODOTTI' | 'INGREDIENTI'>('INGREDIENTI');
  const [selectedTable, setSelectedTable] = useState<{ id: string, nome: string } | null>(null);

  useEffect(() => {
    fetchOrders();
    fetchProducts();
    fetchIngredients();
    const ordersChannel = supabase.channel('public:ordini')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ordini' }, () => fetchOrders()).subscribe();
    const productsChannel = supabase.channel('public:prodotti')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prodotti' }, () => fetchProducts()).subscribe();
    const ingredientsChannel = supabase.channel('public:ingredienti')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ingredienti' }, () => fetchIngredients()).subscribe();
    return () => { 
      supabase.removeChannel(ordersChannel); 
      supabase.removeChannel(productsChannel); 
      supabase.removeChannel(ingredientsChannel);
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

  const toggleProductAvailability = async (id: string, currentStatus: boolean) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, disponibile: !currentStatus } : p));
    const { error } = await supabase.from('prodotti').update({ disponibile: !currentStatus }).eq('id', id);
    if (error) fetchProducts();
  };

  const toggleIngredientAvailability = async (id: string, currentStatus: boolean) => {
    setIngredients(prev => prev.map(i => i.id === id ? { ...i, disponibile: !currentStatus } : i));
    const { error } = await supabase.from('ingredienti').update({ disponibile: !currentStatus }).eq('id', id);
    if (error) fetchIngredients();
  };

  const updateProductPrice = async (id: string, newPrice: number) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, prezzo: newPrice } : p));
    await supabase.from('prodotti').update({ prezzo: newPrice }).eq('id', id);
  };

  const updateIngredientPrice = async (id: string, newPrice: number) => {
    setIngredients(prev => prev.map(i => i.id === id ? { ...i, prezzo: newPrice } : i));
    await supabase.from('ingredienti').update({ prezzo: newPrice }).eq('id', id);
  };

  return (
    <div className="min-h-screen bg-charcoal text-white flex">
      
      {/* Sidebar */}
      <aside className="w-24 bg-gold flex flex-col items-center py-8 gap-10 rounded-r-[40px] shadow-[10px_0_30px_rgba(0,0,0,0.3)] z-20">
        <button 
          onClick={() => { setActiveView('POS'); setSelectedTable(null); }}
          className={`p-4 rounded-2xl transition-all hover:scale-110 ${activeView === 'POS' ? 'bg-charcoal text-gold shadow-2xl scale-110' : 'text-black hover:bg-black/10'}`}
        >
          <Calculator size={28} strokeWidth={3} />
        </button>

        <button 
          onClick={() => { setActiveView('ORDINI'); setSelectedTable(null); }}
          className={`p-4 rounded-2xl transition-all hover:scale-110 ${activeView === 'ORDINI' ? 'bg-charcoal text-gold shadow-2xl scale-110' : 'text-black hover:bg-black/10'}`}
        >
          <LayoutDashboard size={28} strokeWidth={3} />
        </button>
        
        <button 
          onClick={() => { setActiveView('MAPPA'); setSelectedTable(null); }}
          className={`p-4 rounded-2xl transition-all hover:scale-110 ${activeView === 'MAPPA' ? 'bg-charcoal text-gold shadow-2xl scale-110' : 'text-black hover:bg-black/10'}`}
        >
          <MapIcon size={28} strokeWidth={3} />
        </button>

        <button 
          onClick={() => { setActiveView('PRENOTAZIONI'); setSelectedTable(null); }}
          className={`p-4 rounded-2xl transition-all hover:scale-110 ${activeView === 'PRENOTAZIONI' ? 'bg-charcoal text-gold shadow-2xl scale-110' : 'text-black hover:bg-black/10'}`}
        >
          <Calendar size={28} strokeWidth={3} />
        </button>

        <button 
          onClick={() => { setActiveView('MENU'); setSelectedTable(null); }}
          className={`p-4 rounded-2xl transition-all hover:scale-110 ${activeView === 'MENU' ? 'bg-charcoal text-gold shadow-2xl scale-110' : 'text-black hover:bg-black/10'}`}
        >
          <BookOpen size={28} strokeWidth={3} />
        </button>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {selectedTable && activeView === 'ORDINI' ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="bg-surface p-4 border-b border-surface-light flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-black font-black">
                  {selectedTable.nome.match(/\d+/)?.[0] || 'T'}
                </div>
                <h2 className="text-xl font-black text-white italic uppercase">{selectedTable.nome}</h2>
                <SyncStatusIndicator />
              </div>
              <button 
                onClick={() => setSelectedTable(null)}
                className="px-6 py-2 bg-charcoal border border-surface-light rounded-xl font-black text-[10px] tracking-widest text-gray-500 hover:text-white"
              >
                TORNA ALLA MAPPA
              </button>
            </div>
            <POSView 
              tableId={selectedTable.id} 
              tableName={selectedTable.nome} 
              onOrderFinished={() => {
                setSelectedTable(null);
                setActiveView('MAPPA');
              }} 
            />
          </div>
        ) : activeView === 'POS' ? (
          <POSView />
        ) : activeView === 'MAPPA' ? (
          <TableMapView onSelectTable={(id, nome) => {
            setSelectedTable({ id, nome });
            setActiveView('ORDINI');
          }} />
        ) : activeView === 'PRENOTAZIONI' ? (
          <ReservationsView />
        ) : activeView === 'MENU' ? (
          <div className="flex-1 flex flex-col p-8 overflow-hidden bg-charcoal">
            <header className="flex justify-between items-center mb-8 bg-surface p-4 rounded-3xl border border-surface-light shadow-2xl">
              <div>
                <h2 className="text-sm text-gold font-black tracking-widest uppercase italic">Configurazione</h2>
                <h1 className="text-3xl font-black text-white uppercase italic">Gestione Menù</h1>
              </div>
              <div className="flex gap-2 bg-charcoal p-1.5 rounded-2xl border border-surface-light">
                <button 
                  onClick={() => setMenuTab('PRODOTTI')}
                  className={`px-4 py-2 rounded-xl font-black text-xs ${menuTab === 'PRODOTTI' ? 'bg-gold text-black' : 'text-gray-500'}`}
                >
                  PRODOTTI
                </button>
                <button 
                  onClick={() => setMenuTab('INGREDIENTI')}
                  className={`px-4 py-2 rounded-xl font-black text-xs ${menuTab === 'INGREDIENTI' ? 'bg-gold text-black' : 'text-gray-500'}`}
                >
                  INGREDIENTI
                </button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
              {menuTab === 'PRODOTTI' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {products.map(product => (
                    <div key={product.id} className="flex items-center justify-between p-6 bg-surface border border-surface-light rounded-3xl">
                      <div>
                        <h3 className={`font-bold text-xl ${product.disponibile ? 'text-white' : 'text-gray-500 line-through'}`}>{product.nome}</h3>
                        <div className="flex items-center gap-3">
                           <p className="text-gray-500 text-[10px] font-bold uppercase">{product.categoria}</p>
                           <button 
                             onClick={() => {
                               const p = prompt('Nuovo prezzo per ' + product.nome, product.prezzo?.toString() || '0');
                               if (p) updateProductPrice(product.id, parseFloat(p));
                             }}
                             className="text-gold text-xs font-black bg-gold/10 px-2 py-0.5 rounded border border-gold/20 hover:bg-gold hover:text-black transition-all"
                           >
                             €{typeof product.prezzo === 'number' ? product.prezzo.toFixed(2) : '0.00'}
                           </button>
                         </div>
                      </div>
                      <button 
                        onClick={() => toggleProductAvailability(product.id, product.disponibile)}
                        className={`relative w-14 h-8 rounded-full border-2 ${product.disponibile ? 'bg-gold border-gold/20' : 'bg-charcoal border-surface-light'}`}
                      >
                        <div className={`absolute left-0.5 top-0.5 bg-white w-6 h-6 rounded-full transition-transform ${product.disponibile ? 'translate-x-6' : 'translate-x-0'}`}></div>
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-6">
                  {ingredients.map(ing => (
                    <div key={ing.id} className={`p-6 bg-surface border rounded-3xl transition-all ${ing.disponibile ? 'border-surface-light' : 'border-red-500/30'}`}>
                      <div className="flex justify-between items-start mb-4">
                        <div className={`p-3 rounded-2xl ${ing.disponibile ? 'bg-charcoal text-gold' : 'bg-red-500 text-white'}`}>
                          <Plus size={24} className={ing.disponibile ? '' : 'rotate-45'} />
                        </div>
                        <button 
                          onClick={() => toggleIngredientAvailability(ing.id, ing.disponibile)}
                          className={`relative w-14 h-8 rounded-full border-2 ${ing.disponibile ? 'bg-emerald-500 border-emerald-500/20' : 'bg-charcoal border-surface-light'}`}
                        >
                          <div className={`absolute left-1 top-1 bg-white w-5 h-5 rounded-full transition-transform ${ing.disponibile ? 'translate-x-6' : 'translate-x-0'}`}></div>
                        </button>
                      </div>
                      <h3 className={`font-black text-xl uppercase ${ing.disponibile ? 'text-white' : 'text-red-500'}`}>{ing.nome}</h3>
                      <button 
                         onClick={() => {
                           const p = prompt('Nuovo prezzo per extra ' + ing.nome, ing.prezzo?.toString() || '0');
                           if (p) updateIngredientPrice(ing.id, parseFloat(p));
                         }}
                         className="text-gold text-[10px] font-black mt-1"
                       >
                         Extra: €{typeof ing.prezzo === 'number' ? ing.prezzo.toFixed(2) : '0.00'}
                       </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col h-full bg-charcoal">
            <header className="h-20 bg-surface border-b border-surface-light flex justify-between items-center px-8">
              <h1 className="text-xl font-bold tracking-widest text-white uppercase italic">Gestione Ordini</h1>
            </header>
            <div className="flex-1 overflow-y-auto p-8 grid grid-cols-1 xl:grid-cols-2 gap-6 pb-12">
              {orders.map(order => (
                <div key={order.id} className="bg-surface border border-surface-light rounded-2xl flex flex-col overflow-hidden shadow-xl">
                  <div className="p-5 border-b border-surface-light flex justify-between items-center bg-surface-light/30">
                    <div>
                      <span className="text-[10px] font-black text-gold uppercase tracking-[.3em] mb-1">{order.nome_cliente.startsWith('TAV') ? 'Servizio al Tavolo' : 'Ordine Asporto'}</span>
                      <h3 className="text-2xl font-black text-white italic">{order.nome_cliente}</h3>
                    </div>
                    <span className="text-gray-400 font-bold bg-charcoal/50 px-3 py-1 rounded-lg text-sm">{order.orario_ritiro}</span>
                  </div>
                  <div className="p-6 flex-1">
                    <ul className="space-y-4">
                      {order.carrello?.map((item: any, idx: number) => (
                        <li key={idx} className="flex items-start gap-4 p-3 rounded-2xl bg-charcoal/40">
                          <CheckCircle2 size={26} className={order.status === 'COMPLETATO' ? 'text-emerald-400' : 'text-gray-500'} />
                          <div>
                            <p className={`font-black text-xl ${order.status === 'COMPLETATO' ? 'text-emerald-400/50 line-through' : 'text-white'}`}>{item.quantity}x {item.nome}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="p-4 bg-charcoal border-t border-surface-light">
                    {order.status === 'IN_ATTESA' ? (
                      <button onClick={() => markAsReady(order.id)} className="w-full bg-gold hover:bg-gold-hover text-black font-black py-4 rounded-xl flex items-center justify-center gap-2">
                        <Save size={20} /> SEGNA COME COMPLETATO
                      </button>
                    ) : (
                      <div className="w-full bg-surface-light/30 text-emerald-400/50 font-black py-4 rounded-xl flex items-center justify-center gap-2">
                        <CheckCircle2 size={20} /> COMPLETATO
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>


    </div>
  );
}
