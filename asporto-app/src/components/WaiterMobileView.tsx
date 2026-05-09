import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { supabase, type Product, type Ingredient, type Tavolo, type OrderCarrelloItem, IS_DEMO_MODE } from '../lib/supabase';
import { newUniqueId } from '../lib/id';
import { MOCK_PRODUCTS, MOCK_INGREDIENTS, MOCK_TABLES } from '../lib/MockData';
import { Plus, Minus, Search, Save, CreditCard, Users, ChevronLeft, AlertTriangle, LayoutDashboard, Edit3, X, AlertCircle, Trash2, LogOut, Receipt } from 'lucide-react';
import BillsHistoryModal from './BillsHistoryModal';
import { staffLogout } from '../lib/staffAuth';
import { syncManager } from '../lib/OfflineSync';
import {
  addedIngredientsFromStoredOrderLine,
  calculateRemovalsPrice,
  findProductForOrderLine,
} from '../lib/orderCarrelloMap';
import SyncStatusIndicator from './SyncStatusIndicator';

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
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<'MENU' | 'RIEPILOGO'>('MENU');

  // Customization state
  const [editingItem, setEditingItem] = useState<CustomizedItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCoversModalOpen, setIsCoversModalOpen] = useState(false);
  const [tempCovers, setTempCovers] = useState(2);
  const [ingSearch, setIngSearch] = useState('');
  const [billsDayOpen, setBillsDayOpen] = useState(false);
  const [billsTableOpen, setBillsTableOpen] = useState(false);
  const [orderActionBusy, setOrderActionBusy] = useState(false);

  const productsRef = useRef(products);
  const ingredientsRef = useRef(ingredients);
  const selectedTableRef = useRef(selectedTable);
  productsRef.current = products;
  ingredientsRef.current = ingredients;
  selectedTableRef.current = selectedTable;

  /** Carica ordine IN_ATTESA dal DB e aggiorna carrello (anche da eventi Realtime). */
  async function loadOpenOrderForTable(table: Tavolo) {
    if (IS_DEMO_MODE || !supabase) return;
    const prods = productsRef.current;
    const ings = ingredientsRef.current;

    const { data } = await supabase
      .from('ordini')
      .select('*')
      .eq('nome_cliente', table.nome)
      .eq('status', 'IN_ATTESA')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      setActiveOrderId(data.id);
      const mappedCart = (data.carrello || []).map((item: OrderCarrelloItem) => {
        const product = findProductForOrderLine(prods, item.nome);
        const basePrezzo = product?.prezzo ?? item.prezzo_unitario ?? 0;
        const rimozioni = item.modifiche?.rimozioni || [];
        const removalsPrice = calculateRemovalsPrice(rimozioni, ings);
        return {
          ...(product || { id: newUniqueId(), nome: item.nome, prezzo: basePrezzo, categoria: 'Generale', disponibile: true, ingredienti: [] }),
          quantity: item.quantity,
          addedIngredients: addedIngredientsFromStoredOrderLine(item, ings, basePrezzo, removalsPrice),
          removedIngredients: rimozioni,
          notes: item.modifiche?.note || '',
          uniqueId: newUniqueId()
        };
      });
      setCart(mappedCart);
      setActiveTab('RIEPILOGO');
    } else {
      setActiveOrderId(null);
      setCart([]);
      setActiveTab('MENU');
    }
  }

  async function fetchTables() {
    if (IS_DEMO_MODE) {
      setTables(MOCK_TABLES);
      return;
    }
    if (!supabase) return;
    const { data } = await supabase.from('tavoli').select('*').order('nome', { ascending: true });
    if (data) setTables(data);
  }

  async function fetchProducts() {
    if (IS_DEMO_MODE) {
      setProducts(MOCK_PRODUCTS);
      return;
    }
    if (!supabase) return;
    const { data } = await supabase.from('prodotti').select('*').order('nome', { ascending: true });
    if (data) setProducts(data);
  }

  async function fetchIngredients() {
    if (IS_DEMO_MODE) {
      setIngredients(MOCK_INGREDIENTS);
      return;
    }
    if (!supabase) return;
    const { data } = await supabase.from('ingredienti').select('*');
    if (data) setIngredients(data);
  }

  async function fetchInitialData() {
    await Promise.all([fetchTables(), fetchProducts(), fetchIngredients()]);
    setLoading(false);
  }

  useEffect(() => {
    void fetchInitialData();
    if (!supabase) return;
    const sb = supabase;
    const tablesChannel = sb.channel('public:tavoli').on('postgres_changes', { event: '*', schema: 'public', table: 'tavoli' }, () => void fetchTables()).subscribe();
    const productsChannel = sb.channel('public:prodotti-waiter').on('postgres_changes', { event: '*', schema: 'public', table: 'prodotti' }, () => void fetchProducts()).subscribe();
    const ingredientsChannel = sb.channel('public:ingredienti-waiter').on('postgres_changes', { event: '*', schema: 'public', table: 'ingredienti' }, () => void fetchIngredients()).subscribe();
    return () => {
      sb.removeChannel(tablesChannel);
      sb.removeChannel(productsChannel);
      sb.removeChannel(ingredientsChannel);
    };
  }, []);

  /** Tavolo occupato: aggiorna carrello se ordine o riga tavolo cambiano (es. da tablet POS). */
  useEffect(() => {
    if (!selectedTable || IS_DEMO_MODE || !supabase) return;
    if (selectedTable.status !== 'OCCUPATO') return;

    const sb = supabase;
    const t = selectedTable;

    const ordiniCh = sb
      .channel(`waiter-realtime-ordini-${t.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ordini',
          filter: `nome_cliente=eq.${t.nome}`,
        },
        () => {
          const cur = selectedTableRef.current;
          if (cur?.id === t.id && cur.status === 'OCCUPATO') {
            void loadOpenOrderForTable(cur);
          }
        }
      )
      .subscribe();

    const tavoliCh = sb
      .channel(`waiter-realtime-tavoli-${t.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tavoli',
          filter: `id=eq.${t.id}`,
        },
        (payload) => {
          const row = payload.new as Partial<Tavolo> & { id?: string };
          if (!row?.id) return;
          const merged = { ...t, ...row } as Tavolo;
          setSelectedTable((prev) => (prev && prev.id === row.id ? { ...prev, ...row } as Tavolo : prev));
          void loadOpenOrderForTable(merged);
        }
      )
      .subscribe();

    return () => {
      sb.removeChannel(ordiniCh);
      sb.removeChannel(tavoliCh);
    };
  }, [selectedTable?.id, selectedTable?.nome, selectedTable?.status]);

  const selectTable = async (table: Tavolo) => {
    if (table.status === 'LIBERO') {
      setSelectedTable(table);
      setTempCovers(2);
      setIsCoversModalOpen(true);
      return;
    }

    setSelectedTable(table);
    setCart([]);
    setActiveOrderId(null);

    if (IS_DEMO_MODE || !supabase) return;

    await loadOpenOrderForTable(table);
  };

  const confirmCovers = async () => {
    if (!selectedTable) return;
    
    // Update table with guests and mark as occupied
    const updatedTable = { ...selectedTable, clienti: tempCovers, status: 'OCCUPATO' as const };
    setTables(prev => prev.map(t => t.id === selectedTable.id ? updatedTable : t));
    setSelectedTable(updatedTable);
    setIsCoversModalOpen(false);

    if (!IS_DEMO_MODE) {
      await syncManager.pushTableUpdate(selectedTable.id, { clienti: tempCovers, status: 'OCCUPATO' });
    }

    // Automatically add "Coperto" to cart
    const copertoProd = products.find(p => p.nome === 'COPERTO') || MOCK_PRODUCTS.find(p => p.nome === 'COPERTO');
    if (copertoProd) {
      setCart([{
        ...copertoProd,
        quantity: tempCovers,
        addedIngredients: [],
        removedIngredients: [],
        notes: '',
        uniqueId: 'initial-coperto'
      }]);
    }
  };

  const addToCart = (product: Product) => {
    const newItem: CustomizedItem = {
      ...product,
      quantity: 1,
      addedIngredients: [],
      removedIngredients: [],
      notes: '',
      uniqueId: newUniqueId()
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
    setCart(prev => prev.filter(i => i.uniqueId !== uniqueId));
  };

  const calculateItemPrice = (item: CustomizedItem) => {
    const extrasPrice = item.addedIngredients.reduce((sum, ing) => sum + ing.prezzo, 0);
    const removalsPrice = item.removedIngredients.reduce((sum, rName) => {
      const ing = ingredients.find(i => i.nome.toLowerCase() === rName.toLowerCase());
      return sum + (ing?.prezzo_rimozione || 0);
    }, 0);
    return Math.max(0, (item.prezzo + extrasPrice - removalsPrice)) * item.quantity;
  };

  const total = cart.reduce((sum, item) => sum + calculateItemPrice(item), 0);

  const saveOrder = async (isClosing: boolean = false) => {
    if (!selectedTable || cart.length === 0 || orderActionBusy) return;
    
    if (IS_DEMO_MODE) {
      alert('SIMULAZIONE: Comanda inviata al sistema (Modalità Demo)');
      setCart([]);
      setSelectedTable(null);
      return;
    }

    setOrderActionBusy(true);
    try {
      const orderData = {
        nome_cliente: selectedTable.nome,
        orario_ritiro: new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
        totale: total,
        status: (isClosing ? 'COMPLETATO' : 'IN_ATTESA') as 'COMPLETATO' | 'IN_ATTESA',
        carrello: cart.map(item => {
          const extras = item.addedIngredients.reduce((s, a) => s + a.prezzo, 0);
          const removals = item.removedIngredients.reduce((s, rName) => {
            const ing = ingredients.find(i => i.nome.toLowerCase() === rName.toLowerCase());
            return s + (ing?.prezzo_rimozione || 0);
          }, 0);
          return {
            nome: item.nome,
            quantity: item.quantity,
            prezzo_unitario: Math.max(0, item.prezzo + extras - removals),
            modifiche: {
              aggiunte: item.addedIngredients.map(a => a.nome),
              rimozioni: item.removedIngredients,
              note: item.notes
            }
          };
        })
      };

      if (activeOrderId) {
        await syncManager.pushOrder({ ...orderData, id: activeOrderId });
      } else {
        await syncManager.pushOrder(orderData);
        // Il tavolo è già OCCUPATO da conferma coperti; in chiusura diretta non serve marcarlo di nuovo.
        if (!isClosing) {
          await syncManager.pushTableUpdate(selectedTable.id, { status: 'OCCUPATO' });
        }
      }

      if (isClosing) {
        await syncManager.pushTableUpdate(selectedTable.id, { status: 'LIBERO', clienti: 0 });
        setActiveOrderId(null);
        setSelectedTable(null);
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch {
      alert('Errore nel salvataggio');
    } finally {
      setOrderActionBusy(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-charcoal flex items-center justify-center text-gold">Caricamento...</div>;

  return (
    <div className="h-screen overflow-hidden bg-charcoal text-white font-sans flex flex-col max-w-md mx-auto relative border-x border-surface">
      
      {!selectedTable ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-6 pb-2 space-y-4">
            <div className="flex justify-between items-center">
              <h1 className="text-3xl font-black italic text-gold uppercase tracking-tighter">Sala & Tavoli</h1>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Uscire? Dovrai reinserire il PIN.')) staffLogout();
                  }}
                  className="p-2 bg-surface rounded-xl text-gray-500 hover:text-red-400 transition-colors"
                  title="Esci staff"
                >
                  <LogOut size={20} />
                </button>
                <Link to="/" className="p-2 bg-surface rounded-xl text-gray-500 hover:text-white transition-colors">
                  <LayoutDashboard size={20} />
                </Link>
              </div>
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
          <div className="p-4 bg-surface border-b border-surface-light flex items-center justify-between shrink-0">
            <button onClick={() => setSelectedTable(null)} className="p-2 bg-charcoal rounded-xl text-gray-400 active:scale-90"><ChevronLeft /></button>
            <div className="flex flex-col items-center">
              <h2 className="text-xl font-black italic uppercase text-white leading-none">{selectedTable.nome}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[8px] font-black text-gold uppercase tracking-[0.2em]">Coperti: {selectedTable.clienti}</span>
                <SyncStatusIndicator />
              </div>
            </div>
            <div className="w-10 h-10 bg-gold rounded-xl flex items-center justify-center text-black font-black shadow-lg">
               €{total.toFixed(0)}
            </div>
          </div>

          {/* Tab Switcher */}
          <div className="flex p-2 bg-charcoal shrink-0">
            <button 
              onClick={() => setActiveTab('RIEPILOGO')}
              className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === 'RIEPILOGO' ? 'bg-surface text-gold border border-surface-light shadow-xl' : 'text-gray-500'}`}
            >
              Riepilogo
            </button>
            <button 
              onClick={() => setActiveTab('MENU')}
              className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === 'MENU' ? 'bg-surface text-gold border border-surface-light shadow-xl' : 'text-gray-500'}`}
            >
              Menu
            </button>
          </div>

          {activeTab === 'MENU' ? (
            <>
              {/* Sticky Search & Categories */}
              <div className="p-4 bg-charcoal space-y-4 shrink-0 shadow-xl z-10">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                  <input 
                    type="text" 
                    placeholder="Cerca prodotto..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full bg-surface border border-surface-light rounded-2xl py-3 pl-12 text-white font-bold outline-none focus:border-gold transition-all"
                  />
                </div>
                
                <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
                  <button 
                    onClick={() => setActiveCategory(null)}
                    className={`px-6 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest border transition-all ${!activeCategory ? 'bg-gold border-gold text-black shadow-lg shadow-gold/20' : 'bg-surface border-surface-light text-gray-500'}`}
                  >
                    Tutti
                  </button>
                  {Array.from(new Set(products.map(p => p.categoria))).map(cat => (
                    <button 
                      key={cat}
                      onClick={() => setActiveCategory(cat)}
                      className={`px-6 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest border transition-all whitespace-nowrap ${activeCategory === cat ? 'bg-gold border-gold text-black shadow-lg shadow-gold/20' : 'bg-surface border-surface-light text-gray-500'}`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Product Grid - Scrollable */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-40">
                {(() => {
                  const filtered = products.filter(p => {
                    const search = searchQuery.toLowerCase().split('').join('.*');
                    const regex = new RegExp(search);
                    return (!searchQuery || regex.test(p.nome.toLowerCase())) && (!activeCategory || p.categoria === activeCategory);
                  });

                  const showSub = activeCategory === 'Bevande' || (!activeCategory && filtered.some(p => p.categoria === 'Bevande'));
                  
                  if (showSub) {
                    const bevande = filtered.filter(p => p.categoria === 'Bevande');
                    const other = filtered.filter(p => p.categoria !== 'Bevande');
                    const subcats = [...new Set(bevande.map(p => p.sottocategoria || 'Altro'))];
                    return (
                      <>
                        {other.map(product => renderProduct(product))}
                        {subcats.map(sub => (
                          <div key={sub}>
                            <div className="text-[10px] font-black text-gold uppercase tracking-widest py-2 px-1">{sub}</div>
                            {bevande.filter(p => (p.sottocategoria || 'Altro') === sub).map(product => renderProduct(product))}
                          </div>
                        ))}
                      </>
                    );
                  }

                  return filtered.map(product => renderProduct(product));

                  function renderProduct(product: Product) {
                    const missing = product.ingredienti?.filter(ingName => {
                      const ingredient = ingredients.find(i => i.nome === ingName);
                      return ingredient && !ingredient.disponibile;
                    }) || [];
                    const available = product.disponibile && missing.length === 0;

                    return (
                      <div key={product.id} className={`p-4 rounded-2xl border flex items-center justify-between transition-all ${available ? 'bg-surface border-surface-light active:bg-surface-light/30' : 'bg-red-500/5 border-red-500/20 opacity-60'}`}>
                        <div className="flex-1 pr-4" onClick={() => available && addToCart(product)}>
                          <h3 className={`font-bold ${available ? 'text-white' : 'text-gray-500 line-through'}`}>{product.nome}</h3>
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-[10px] uppercase font-black text-gray-500">{available ? product.categoria : `MANCA: ${missing.join(', ')}`}</p>
                            <span className="text-[10px] font-black text-gold">€{product.prezzo.toFixed(2)}</span>
                          </div>
                        </div>
                        {available ? (
                          <div className="flex items-center gap-2">
                             {cart.filter(c => c.id === product.id).map(c => (
                               <div key={c.uniqueId} className="flex flex-col items-center mr-1">
                                  <span className="text-[10px] font-black text-gold">x{c.quantity}</span>
                               </div>
                             ))}
                            <button 
                              onClick={() => openCustomization(product)}
                              className="w-10 h-10 bg-charcoal text-gold rounded-xl flex items-center justify-center border border-surface-light active:scale-90"
                            >
                              <Edit3 size={18} />
                            </button>
                            <button 
                              onClick={() => addToCart(product)} 
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
                  }
                })()}
              </div>
            </>
          ) : (
            /* Summary View - Scrollable */
            <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-40">
              <div className="bg-surface/50 rounded-3xl p-6 border border-surface-light mb-4">
                <div className="flex flex-wrap gap-2 mb-4">
                  <button
                    type="button"
                    onClick={() => setBillsDayOpen(true)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-charcoal border border-surface-light text-[9px] font-black uppercase text-gray-400 hover:text-gold"
                  >
                    <Receipt size={12} /> Conti oggi
                  </button>
                  {selectedTable && (
                    <button
                      type="button"
                      onClick={() => setBillsTableOpen(true)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-charcoal border border-surface-light text-[9px] font-black uppercase text-gray-400 hover:text-gold"
                    >
                      <Receipt size={12} /> Storico tavolo
                    </button>
                  )}
                </div>
                <div className="flex justify-between items-end mb-6">
                  <div>
                    <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Stato Tavolo</h3>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-xl font-black italic text-white uppercase">{activeOrderId ? 'Servizio in corso' : 'Tavolo Occupato'}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Totale Attuale</h3>
                    <span className="text-3xl font-black text-gold italic">€{total.toFixed(2)}</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-surface-light pb-2">Articoli Comandati</h4>
                  {cart.length === 0 ? (
                    <div className="py-8 text-center text-gray-500 italic text-sm">Nessun articolo aggiunto</div>
                  ) : (
                    <div className="space-y-3">
                      {cart.map(item => (
                        <div key={item.uniqueId} className="flex justify-between items-start group">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 bg-charcoal rounded text-[10px] flex items-center justify-center font-black text-gold">{item.quantity}</span>
                              <h5 className="font-bold text-sm text-white">{item.nome}</h5>
                            </div>
                            <p className="text-[10px] text-gray-500 ml-7 mt-1">
                              {item.addedIngredients.length > 0 && <span className="text-emerald-500/80">+{item.addedIngredients.map(a => a.nome).join(', ')} </span>}
                              {item.removedIngredients.length > 0 && <span className="text-red-500/80">NO {item.removedIngredients.join(', ')} </span>}
                              {item.notes && <span className="italic">({item.notes})</span>}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-black text-white text-xs">€{calculateItemPrice(item).toFixed(1)}</span>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => editCartItem(item)} className="p-2 bg-charcoal rounded-lg text-gray-500"><Edit3 size={12} /></button>
                              <button onClick={() => removeFromCart(item.uniqueId)} className="p-2 bg-charcoal rounded-lg text-red-500/50"><Trash2 size={12} /></button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              <button 
                onClick={() => setActiveTab('MENU')}
                className="w-full bg-surface border border-gold/30 text-gold py-4 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 shadow-xl"
              >
                <Plus size={16} /> AGGIUNGI ALTRI PIATTI
              </button>
            </div>
          )}

          {/* Sticky Footer Action Bar */}
          <div className="absolute bottom-0 left-0 right-0 p-6 bg-surface/90 backdrop-blur-xl border-t border-white/5 rounded-t-[40px] shadow-[0_-10px_40px_rgba(0,0,0,0.8)] z-40">
            <div className="flex gap-3">
              <button 
                onClick={() => saveOrder(false)}
                disabled={cart.length === 0 || orderActionBusy}
                className={`flex-[2] py-4 rounded-2xl border font-black flex items-center justify-center gap-2 transition-all active:scale-95 ${
                  success 
                    ? 'bg-emerald-500 border-emerald-500 text-black' 
                    : 'bg-surface-light border-white/10 text-white hover:bg-white/10 shadow-xl'
                } disabled:opacity-30`}
              >
                {orderActionBusy ? '…' : success ? 'INVIATO!' : 'AGGIORNA'} <Save size={18} />
              </button>
              <button 
                onClick={() => saveOrder(true)}
                disabled={cart.length === 0 || orderActionBusy}
                className="flex-[3] bg-gold hover:bg-gold-hover text-black font-black py-4 rounded-2xl shadow-2xl shadow-gold/20 flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-30"
              >
                {orderActionBusy ? 'Attendi…' : <>PAGA & CHIUDI <CreditCard size={18} /></>}
              </button>
            </div>
            {IS_DEMO_MODE && (
               <div className="mt-3 text-center">
                 <span className="text-[10px] font-black uppercase text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded">DEMO MODE</span>
               </div>
            )}
          </div>
        </div>
      )}

      {/* Covers Modal */}
      {isCoversModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-surface border border-surface-light w-full max-w-sm rounded-[40px] shadow-2xl overflow-hidden p-8">
            <h2 className="text-2xl font-black italic uppercase text-white mb-2 text-center">Numero Coperti</h2>
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-8 text-center">{selectedTable?.nome}</p>
            
            <div className="flex items-center justify-between bg-charcoal border border-surface-light rounded-3xl p-4 mb-8">
              <button 
                onClick={() => setTempCovers(Math.max(1, tempCovers - 1))}
                className="w-14 h-14 bg-surface rounded-2xl flex items-center justify-center text-gold border border-surface-light active:scale-90 transition-all"
              >
                <Minus size={24} />
              </button>
              <span className="text-5xl font-black italic text-white">{tempCovers}</span>
              <button 
                onClick={() => setTempCovers(tempCovers + 1)}
                className="w-14 h-14 bg-surface rounded-2xl flex items-center justify-center text-gold border border-surface-light active:scale-90 transition-all"
              >
                <Plus size={24} />
              </button>
            </div>
            
            <button 
              onClick={confirmCovers}
              className="w-full bg-gold hover:bg-gold-hover text-black font-black py-5 rounded-2xl text-xl shadow-xl shadow-gold/20 active:scale-95 transition-all"
            >
              INIZIA ORDINE
            </button>
            <button 
              onClick={() => { setSelectedTable(null); setIsCoversModalOpen(false); }}
              className="w-full mt-4 text-gray-500 font-bold uppercase text-[10px] tracking-widest hover:text-white"
            >
              ANNULLA
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
                    const removalPrice = ingredients.find(i => i.nome.toLowerCase() === ing.toLowerCase())?.prezzo_rimozione || 0;
                    return (
                      <button
                        key={ing}
                        onClick={() => {
                          if (isRemoved) setEditingItem({...editingItem, removedIngredients: editingItem.removedIngredients.filter(r => r !== ing)});
                          else setEditingItem({...editingItem, removedIngredients: [...editingItem.removedIngredients, ing]});
                        }}
                        className={`px-4 py-2 rounded-xl font-bold text-[10px] border transition-all ${isRemoved ? 'bg-red-500 border-red-500 text-white' : 'bg-charcoal border-surface-light text-gray-400'}`}
                      >
                        {isRemoved ? `NO ${ing.toUpperCase()} -€${removalPrice.toFixed(2)}` : ing.toUpperCase()}
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
                          else setEditingItem({...editingItem, addedIngredients: [...editingItem.addedIngredients, { nome: ing.nome, prezzo: ing.prezzo ?? 0 }]});
                        }}
                        className={`p-3 rounded-xl font-bold text-[10px] border transition-all text-left flex flex-col ${isAdded ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 font-black tracking-tight' : 'bg-charcoal border-surface-light text-gray-500'}`}
                      >
                        {ing.nome.toUpperCase()}
                        <span className="text-[8px] opacity-70">+€{(ing.prezzo ?? 0).toFixed(2)}</span>
                      </button>
                    )
                  })}
                </div>
              </section>
              <section>
                <h3 className="text-[10px] font-black text-gray-500 tracking-widest uppercase mb-4 flex items-center gap-2">
                  <AlertCircle size={12} className="text-gold" /> VARIANTI RAPIDE
                </h3>
                <div className="flex flex-wrap gap-2">
                  {['Rosè', 'Bianca', 'Rossa', 'Senza Glutine', 'Senza Lattosio', 'Ben Cotta'].map(variant => {
                    const isActive = editingItem.notes.includes(variant);
                    return (
                      <button
                        key={variant}
                        onClick={() => {
                          let newNotes = editingItem.notes;
                          let newAdded = [...editingItem.addedIngredients];
                          const pricedVariants: Record<string, number> = {
                            'Senza Glutine': 2.0,
                            'Senza Lattosio': 1.5
                          };

                          if (isActive) {
                            newNotes = newNotes.replace(variant, '').replace(/,\s*,/g, ',').replace(/^,\s*/, '').replace(/,\s*$/, '').trim();
                            if (pricedVariants[variant]) {
                              newAdded = newAdded.filter(a => a.nome !== variant);
                            }
                          } else {
                            newNotes = newNotes ? `${newNotes}, ${variant}` : variant;
                            if (pricedVariants[variant]) {
                              newAdded.push({ nome: variant, prezzo: pricedVariants[variant] });
                            }
                          }
                          setEditingItem({...editingItem, notes: newNotes, addedIngredients: newAdded});
                        }}
                        className={`px-4 py-2 rounded-xl font-bold text-[10px] border transition-all ${isActive ? 'bg-gold border-gold text-black shadow-lg shadow-gold/20' : 'bg-charcoal border-surface-light text-gray-400'}`}
                      >
                        {variant.toUpperCase()}
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

      <BillsHistoryModal open={billsDayOpen} onClose={() => setBillsDayOpen(false)} variant="day" />
      <BillsHistoryModal
        open={billsTableOpen}
        onClose={() => setBillsTableOpen(false)}
        variant="table"
        tableName={selectedTable?.nome}
      />
    </div>
  );
}
