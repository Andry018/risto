import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase, type Product, type Ingredient, type Tavolo, IS_DEMO_MODE, toggleDemoMode } from '../lib/supabase';
import { MOCK_PRODUCTS, MOCK_INGREDIENTS, MOCK_TABLES } from '../lib/MockData';
import { Plus, Minus, Search, Save, CreditCard, Users, ChevronLeft, AlertTriangle, WifiOff, LayoutDashboard, Edit3, X } from 'lucide-react';
import { syncManager } from '../lib/OfflineSync';

type CustomizedItem = Product & {
  quantity: number;
  addedIngredients: { nome: string, prezzo: number }[];
  removedIngredients: string[];
  notes: string;
  uniqueId: string;
};

export default function WaiterMobileView() {
  const [tables, setTables] = useState<Tavolo[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [cart, setCart] = useState<CustomizedItem[]>([]);
  const [selectedTable, setSelectedTable] = useState<Tavolo | null>(null);
  const [activeRoom, setActiveRoom] = useState<string>('Principale');
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
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
    if (IS_DEMO_MODE) {
      setTables(MOCK_TABLES);
      return;
    }
    const { data } = await supabase.from('tavoli').select('*').order('nome', { ascending: true });
    if (data) setTables(data);
  }

  async function fetchProducts() {
    if (IS_DEMO_MODE) {
      setProducts(MOCK_PRODUCTS);
      return;
    }
    const { data } = await supabase.from('prodotti').select('*').order('nome', { ascending: true });
    if (data) setProducts(data);
  }

  async function fetchIngredients() {
    if (IS_DEMO_MODE) {
      setIngredients(MOCK_INGREDIENTS);
      return;
    }
    const { data } = await supabase.from('ingredienti').select('*');
    if (data) setIngredients(data);
  }

  const selectTable = async (table: Tavolo) => {
    setSelectedTable(table);
    setCart([]);
    setActiveOrderId(null);

    if (IS_DEMO_MODE) return;

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

  const total = cart.reduce((sum, item) => sum + (item.prezzo * item.quantity), 0);

  const saveOrder = async (isClosing: boolean = false) => {
    if (!selectedTable || cart.length === 0) return;
    
    if (IS_DEMO_MODE) {
      alert('SIMULAZIONE: Comanda inviata al sistema (Modalità Demo)');
      setCart([]);
      setSelectedTable(null);
      return;
    }

    try {
      const orderData = {
        nome_cliente: selectedTable.nome,
        orario_ritiro: new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
        totale: total,
        status: (isClosing ? 'COMPLETATO' : 'IN_ATTESA') as 'COMPLETATO' | 'IN_ATTESA',
        carrello: cart.map(item => ({
          nome: item.nome,
          quantity: item.quantity,
          prezzo_unitario: item.prezzo + item.addedIngredients.reduce((s, a) => s + a.prezzo, 0),
          modifiche: {
            aggiunte: item.addedIngredients.map(a => a.nome),
            rimozioni: item.removedIngredients,
            note: item.notes
          }
        }))
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
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-6 pb-2 space-y-4">
            <div className="flex justify-between items-center">
              <h1 className="text-3xl font-black italic text-gold uppercase tracking-tighter">Sala & Tavoli</h1>
              <Link to="/" className="p-2 bg-surface rounded-xl text-gray-500 hover:text-white transition-colors">
                <LayoutDashboard size={20} />
              </Link>
            </div>
            
            {/* Room Slider */}
            <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
              {['Principale', 'Verde', 'Rotonda'].map(room => (
                <button
                  key={room}
                  onClick={() => setActiveRoom(room)}
                  className={`px-6 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest border transition-all whitespace-nowrap ${
                    activeRoom === room ? 'bg-gold border-gold text-black' : 'bg-surface border-surface-light text-gray-500'
                  }`}
                >
                  {room}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 pt-2 grid grid-cols-2 gap-4">
            {tables
              .filter(t => {
                const sala = (t.sala || 'Principale').toUpperCase();
                const active = activeRoom.toUpperCase();
                const normalizedSala = sala === 'SALA' ? 'PRINCIPALE' : sala;
                const normalizedActive = active === 'SALA' ? 'PRINCIPALE' : active;
                return normalizedSala === normalizedActive;
              })
              .map(table => (
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

                return (
                  <div key={product.id} className={`p-4 rounded-2xl border flex items-center justify-between transition-all ${available ? 'bg-surface border-surface-light' : 'bg-red-500/5 border-red-500/20 opacity-60'}`}>
                    <div className="flex-1 pr-4">
                      <h3 className={`font-bold ${available ? 'text-white' : 'text-gray-500 line-through'}`}>{product.nome}</h3>
                      <p className="text-[10px] uppercase font-black text-gray-500">{available ? product.categoria : `MANCA: ${missing.join(', ')}`}</p>
                    </div>
                    {available ? (
                      <div className="flex items-center gap-2">
                         {cart.filter(c => c.id === product.id).map(c => (
                           <div key={c.uniqueId} className="flex flex-col items-center">
                              <span className="text-[8px] font-bold text-gold">x{c.quantity}</span>
                              <button onClick={() => removeFromCart(c.uniqueId)} className="p-1 text-red-500/50 hover:text-red-500"><X size={10} /></button>
                           </div>
                         ))}
                        <button 
                          onClick={() => openCustomization(product)}
                          className="w-10 h-10 bg-charcoal text-gold rounded-xl flex items-center justify-center border border-surface-light active:scale-90"
                        >
                          <Edit3 size={18} />
                        </button>
                        <button 
                          onClick={() => {
                            addToCart(product);
                          }} 
                          className="w-10 h-10 bg-gold text-black rounded-xl flex items-center justify-center shadow-lg active:scale-90"
                        >
                          <Plus size={18} />
                        </button>
                      </div>
                    ) : (
                      <AlertTriangle size={18} className="text-red-500" />
                    )}
                  </div>
                );
              })}
          </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
               {cart.map(item => (
                 <div key={item.uniqueId} className="bg-surface p-4 rounded-2xl border border-surface-light flex justify-between items-center">
                    <div className="flex-1">
                      <h4 className="font-bold text-sm text-white">{item.nome} x{item.quantity}</h4>
                      <p className="text-[10px] text-gray-500">
                        {item.addedIngredients.length > 0 && `+${item.addedIngredients.map(a => a.nome).join(', ')} `}
                        {item.removedIngredients.length > 0 && `NO ${item.removedIngredients.join(', ')} `}
                        {item.notes}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => editCartItem(item)} className="p-2 text-gray-500"><Edit3 size={14} /></button>
                      <span className="font-black text-gold text-xs">€{calculateItemPrice(item).toFixed(1)}</span>
                    </div>
                 </div>
               ))}
            </div>

            <div className="p-4 bg-surface border-t border-surface-light rounded-t-[40px] shadow-2xl z-30">
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
                onClick={() => saveOrder(true)}
                disabled={cart.length === 0}
                className="flex-[3] bg-gold hover:bg-gold-hover text-black font-black py-4 rounded-2xl shadow-xl flex items-center justify-center gap-2 disabled:opacity-50"
              >
                PAGA & CHIUDI <CreditCard size={18} />
              </button>
            </div>
            {IS_DEMO_MODE && (
               <div className="mt-2 text-center">
                 <span className="text-[10px] font-black uppercase text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded">MODALITÀ DEMO ATTIVA</span>
               </div>
            )}
            <button 
              onClick={() => toggleDemoMode(!IS_DEMO_MODE)}
              className="w-full text-center text-[10px] text-gray-500 mt-2 underline"
            >
              {IS_DEMO_MODE ? 'Torna Online' : 'Attiva Modalità Demo'}
            </button>
          </div>
        </div>
      )}

      {/* Customization Modal Mobile */}
      {isModalOpen && editingItem && (
        <div className="fixed inset-0 z-[100] flex items-end bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-surface w-full max-h-[90vh] rounded-t-[40px] shadow-2xl flex flex-col animate-in slide-in-from-bottom duration-300">
            
            <div className="p-6 border-b border-surface-light flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-black italic uppercase text-white leading-tight">{editingItem.nome}</h2>
                <p className="text-[10px] font-black text-gold uppercase tracking-[0.2em] mt-1">€{editingItem.prezzo.toFixed(2)} + extra</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-3 bg-charcoal rounded-full text-gray-500"><X size={20} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar pb-32">
              <section>
                <h3 className="text-[10px] font-black text-gray-500 tracking-widest uppercase mb-4 flex items-center gap-2">
                  <Minus size={12} className="text-red-500" /> RIMOZIONI
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
                        className={`px-4 py-2 rounded-xl font-bold text-[10px] border transition-all ${isRemoved ? 'bg-red-500 border-red-500 text-white' : 'bg-charcoal border-surface-light text-gray-400'}`}
                      >
                        {isRemoved ? `NO ${ing.toUpperCase()}` : ing.toUpperCase()}
                      </button>
                    )
                  })}
                </div>
              </section>

              <section>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-[10px] font-black text-gray-500 tracking-widest uppercase flex items-center gap-2">
                    <Plus size={12} className="text-emerald-500" /> AGGIUNTE
                  </h3>
                  <input 
                    type="text"
                    placeholder="Cerca..."
                    value={ingSearch}
                    onChange={e => setIngSearch(e.target.value)}
                    className="bg-charcoal border border-surface-light rounded-lg px-2 py-1 text-[10px] text-white w-24 outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
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
                        className={`p-3 rounded-xl font-bold text-[10px] border transition-all text-left flex flex-col ${isAdded ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 font-black tracking-tight' : 'bg-charcoal border-surface-light text-gray-500'}`}
                      >
                        {ing.nome.toUpperCase()}
                        <span className="text-[8px] opacity-70">+€{(ing.prezzo || 1.5).toFixed(2)}</span>
                      </button>
                    )
                  })}
                </div>
              </section>

              <section>
                <h3 className="text-[10px] font-black text-gray-500 tracking-widest uppercase mb-4">NOTE SPECIALI</h3>
                <textarea 
                  rows={2}
                  placeholder="Esempio: Ben cotta, senza sale..."
                  value={editingItem.notes}
                  onChange={e => setEditingItem({...editingItem, notes: e.target.value})}
                  className="w-full bg-charcoal border border-surface-light rounded-2xl p-4 text-white font-medium outline-none text-sm"
                />
              </section>
            </div>

            <div className="p-6 border-t border-surface-light bg-surface-light/10 absolute bottom-0 left-0 right-0 rounded-t-[30px] shadow-2xl">
              <div className="flex justify-between items-center mb-4">
                <span className="text-2xl font-black text-white italic">€{calculateItemPrice(editingItem).toFixed(2)}</span>
                <div className="flex items-center gap-4">
                  <button onClick={() => setEditingItem({...editingItem, quantity: Math.max(1, editingItem.quantity - 1)})} className="p-2 bg-charcoal rounded-lg text-gold border border-surface-light"><Minus size={16} /></button>
                  <span className="text-xl font-black italic">{editingItem.quantity}</span>
                  <button onClick={() => setEditingItem({...editingItem, quantity: editingItem.quantity + 1})} className="p-2 bg-charcoal rounded-lg text-gold border border-surface-light"><Plus size={16} /></button>
                </div>
              </div>
              <button 
                onClick={saveCustomization}
                className="w-full bg-emerald-500 text-black py-4 rounded-2xl font-black uppercase text-sm"
              >
                AGGIUNGI ALL'ORDINE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
