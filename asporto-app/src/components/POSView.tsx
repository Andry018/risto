import { useEffect, useState, useRef } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { getCurrentUser, getDefaultRouteForRole } from '../lib/staffAuth';
import { supabase, type Product, type Ingredient, type OrderCarrelloItem, type CustomizedItem, PORTATE, IS_DEMO_MODE } from '../lib/supabase';
import { newUniqueId } from '../lib/id';
import { MOCK_PRODUCTS, MOCK_INGREDIENTS, MOCK_TABLES } from '../lib/MockData';
import { ShoppingCart, Plus, Minus, Trash2, Search, CheckCircle, Calculator, AlertTriangle, Save, WifiOff, LayoutDashboard, Edit3, X, Users, Receipt, CreditCard, Printer, Sandwich } from 'lucide-react';
import BillsHistoryModal from './BillsHistoryModal';
import ProductCustomizationModal from './ProductCustomizationModal';
import ReceiptPreview from './ReceiptPreview';
import PaninoBuilderModal from './PaninoBuilderModal';
import { syncManager } from '../lib/OfflineSync';
import { calculateItemPrice } from '../lib/priceUtils';
import { useToast } from './Toast';
import { printKitchen, printFullReceipt } from '../lib/printUtils';
import {
  addedIngredientsFromStoredOrderLine,
  calculateRemovalsPrice,
  findProductForOrderLine,
} from '../lib/orderCarrelloMap';

export default function POSView({ tableId: propTableId, tableName: propTableName, onOrderFinished }: { tableId?: string, tableName?: string, onOrderFinished?: () => void }) {
  const navigate = useNavigate();
  useEffect(() => {
    const user = getCurrentUser();
    if (user && user.role !== 'admin') {
      navigate(getDefaultRouteForRole(user.role), { replace: true });
    }
  }, []);
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
  const [billsDayOpen, setBillsDayOpen] = useState(false);
  const [billsTableOpen, setBillsTableOpen] = useState(false);
  const [finishingOrder, setFinishingOrder] = useState(false);
  const [tableClienti, setTableClienti] = useState(0);
  const [splitResult, setSplitResult] = useState<{ parts: number; eachAmount: number } | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [showBillReview, setShowBillReview] = useState(false);

  // Customization state
  const [editingItem, setEditingItem] = useState<CustomizedItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [paninoModalOpen, setPaninoModalOpen] = useState(false);

  const toast = useToast();
  const productsRef = useRef(products);
  const ingredientsRef = useRef(ingredients);
  const localUpdateRef = useRef(false);
  productsRef.current = products;
  ingredientsRef.current = ingredients;

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
      if (mockTable) {
        setTableClienti(mockTable.clienti || 0);
        if (mockTable.clienti > 0) {
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
      const prods = productsRef.current;
      const ings = ingredientsRef.current;
      const mappedCart = (order.carrello || []).map((item: OrderCarrelloItem) => {
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
          portata: item.portata,
          uniqueId: newUniqueId()
        };
      });
      setCart(mappedCart);
      if (mappedCart.length > 0) setShowBillReview(true);
    } else if (tableId) {
      const { data: table } = await supabase.from('tavoli').select('clienti').eq('id', tableId).single();
      if (table) {
        setTableClienti(table.clienti || 0);
        if (table.clienti > 0) {
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

  /** Sync conto tavolo da altri dispositivi (es. telefono cameriere) senza ricaricare. */
  useEffect(() => {
    if (IS_DEMO_MODE || !supabase || !tableName) return;
    const sb = supabase;

    const ordiniCh = sb
      .channel(`pos-realtime-ordini-${tableId ?? tableName}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ordini',
          filter: `nome_cliente=eq.${tableName}`,
        },
        (payload) => {
          if (!localUpdateRef.current) {
            toast.addToast({
              type: 'info',
              title: 'Ordine aggiornato',
              message: payload.eventType === 'INSERT' ? 'Nuovo ordine dal cameriere' : 'Modifiche ricevute dal cameriere',
              duration: 3000,
            });
          }
          localUpdateRef.current = false;
          void fetchExistingOrder();
        }
      )
      .subscribe();

    const channels: ReturnType<typeof sb.channel>[] = [ordiniCh];

    if (tableId) {
      const tavoliCh = sb
        .channel(`pos-realtime-tavoli-${tableId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'tavoli',
            filter: `id=eq.${tableId}`,
          },
          () => {
            if (!localUpdateRef.current) {
              toast.addToast({
                type: 'info',
                title: 'Tavolo aggiornato',
                message: 'Stato tavolo modificato dal cameriere',
                duration: 3000,
              });
            }
            localUpdateRef.current = false;
            void fetchExistingOrder();
          }
        )
        .subscribe();
      channels.push(tavoliCh);
    }

    return () => {
      channels.forEach((ch) => {
        sb.removeChannel(ch);
      });
    };
  }, [tableId, tableName, toast]);

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

  const saveCustomization = (item: CustomizedItem) => {
    setCart(prev => {
      const existingIdx = prev.findIndex(i => i.uniqueId === item.uniqueId);
      if (existingIdx > -1) {
        const newCart = [...prev];
        newCart[existingIdx] = item;
        return newCart;
      }
      return [...prev, item];
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

  const addPaninoToCart = (item: CustomizedItem) => {
    setCart(prev => [...prev, item]);
  };

  const total = cart.reduce((sum, item) => sum + calculateItemPrice(item, ingredients), 0);

  const freeTable = async () => {
    if (!tableId || finishingOrder) return;
    if (!confirm(`Sei sicuro di voler liberare il tavolo? I dati del conto andranno persi.`)) return;

    localUpdateRef.current = true;
    setFinishingOrder(true);
    try {
      if (activeOrderId) {
        await syncManager.pushOrder({
          nome_cliente: tableName || 'TAVOLO',
          orario_ritiro: new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
          totale: 0,
          status: 'COMPLETATO',
          carrello: [],
          id: activeOrderId,
        } as any);
      }
      await syncManager.pushTableUpdate(tableId, { status: 'LIBERO', clienti: 0 });
      setActiveOrderId(null);
      setCart([]);
      if (onOrderFinished) onOrderFinished();
    } catch (error) {
      console.error('Error freeing table:', error);
      alert('Errore durante la liberazione del tavolo.');
    } finally {
      setFinishingOrder(false);
    }
  };

  const handleFinishOrder = async () => {
    if (cart.length === 0 || finishingOrder) return;

    localUpdateRef.current = true;
    setFinishingOrder(true);
    try {
      const orderData = {
        nome_cliente: tableName || 'POS VENDITA',
        orario_ritiro: new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
        totale: total,
        status: 'COMPLETATO' as const,
        carrello: cart.map(i => {
          const extras = i.addedIngredients.reduce((s, a) => s + a.prezzo, 0);
          const removals = i.removedIngredients.reduce((s, rName) => {
            const ing = ingredients.find(ig => ig.nome.toLowerCase() === rName.toLowerCase());
            return s + (ing?.prezzo_rimozione || 0);
          }, 0);
          return {
            nome: i.nome,
            quantity: i.quantity,
            prezzo_unitario: Math.max(0, i.prezzo + extras - removals),
            modifiche: {
              aggiunte: i.addedIngredients.map(a => a.nome),
              rimozioni: i.removedIngredients,
              note: i.notes
            }
          };
        })
      };

      if (activeOrderId) {
        await syncManager.pushOrder({ ...orderData, id: activeOrderId });
      } else {
        await syncManager.pushOrder(orderData);
      }

      if (tableId) {
        await syncManager.pushTableUpdate(tableId, { status: 'LIBERO', clienti: 0 });
      }

      setActiveOrderId(null);
      setOrderSuccess(true);
      setCart([]);
      setTimeout(() => {
        setOrderSuccess(false);
        if (onOrderFinished) onOrderFinished();
      }, 2000);
    } catch (error) {
      console.error('Error submitting POS order:', error);
      alert('Errore durante la chiusura dell\'ordine.');
    } finally {
      setFinishingOrder(false);
    }
  };

  const handleUpdateBill = async () => {
    if (cart.length === 0 || !tableId) return;
    localUpdateRef.current = true;
    try {
      const orderData = {
        nome_cliente: tableName || 'POS',
        orario_ritiro: new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
        totale: total,
        status: 'IN_ATTESA' as const,
        carrello: cart.map(i => {
          const extras = i.addedIngredients.reduce((s, a) => s + a.prezzo, 0);
          const removals = i.removedIngredients.reduce((s, rName) => {
            const ing = ingredients.find(ig => ig.nome.toLowerCase() === rName.toLowerCase());
            return s + (ing?.prezzo_rimozione || 0);
          }, 0);
          return {
            nome: i.nome,
            quantity: i.quantity,
            prezzo_unitario: Math.max(0, i.prezzo + extras - removals),
            modifiche: {
              aggiunte: i.addedIngredients.map(a => a.nome),
              rimozioni: i.removedIngredients,
              note: i.notes
            }
          };
        })
      };

      if (activeOrderId) {
        await syncManager.pushOrder({ ...orderData, id: activeOrderId });
      } else {
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

  const categoryDefs: { label: string; match: string[] }[] = [
    { label: 'Antipasto', match: ['Antipasto', 'Antipasti'] },
    { label: 'Primo', match: ['Primo', 'Primi'] },
    { label: 'Secondo', match: ['Secondo', 'Secondi'] },
    { label: 'Contorni', match: ['Contorni'] },
    { label: 'Fritti', match: ['Fritti'] },
    { label: 'Pizze', match: ['Pizze Rosse', 'Pizze Bianche', 'Pizze Speciali'] },
    { label: 'Bevande', match: ['Bevande'] },
    { label: 'Dolce', match: ['Dolce', 'Dolci'] },
    { label: 'Caffè e Liquori', match: ['Caffè e Liquori'] },
    { label: 'Servizio', match: ['Servizio'] },
  ];
  const activeDef = categoryDefs.find(d => d.label === activeCategory);
  const filteredProducts = products.filter(p => {
    if (activeCategory) {
      const match = activeDef ? activeDef.match : [activeCategory];
      if (!match.includes(p.categoria)) return false;
    }
    if (searchQuery && !p.nome.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  if (loading) return <div className="flex-1 flex justify-center items-center bg-charcoal"><div className="w-12 h-12 border-4 border-gold border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <>
      {/* Bill Review Overlay */}
      {showBillReview && (
        <div className="fixed inset-0 z-[100] flex bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
          <div className="flex-1 flex flex-col px-8 md:px-12 lg:px-20 xl:px-32">
            {/* Header */}
            <div className="flex items-center justify-between py-6 border-b border-surface-light">
              <div className="flex items-center gap-4">
                <button onClick={() => setShowBillReview(false)} className="p-2 bg-charcoal rounded-xl text-gray-400 hover:text-white transition-colors">
                  <X size={22} />
                </button>
                <div>
                  <h2 className="text-2xl font-black italic uppercase tracking-tighter text-white">Riepilogo <span className="text-gold">Conto</span></h2>
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mt-1">{tableName || 'POS'} · coperti {tableClienti || '-'}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-gray-500 uppercase">Totale</p>
                <p className="text-4xl font-black text-gold italic">€{total.toFixed(2)}</p>
              </div>
            </div>

            {/* Items grouped by portata */}
            <div className="flex-1 overflow-y-auto py-8 space-y-6">
              {cart.length === 0 ? (
                <div className="py-16 text-center text-gray-500 text-lg font-bold">Nessun articolo nel conto</div>
              ) : (
                (() => {
                  const grouped = new Map<string, CustomizedItem[]>();
                  for (const item of cart) {
                    const key = item.portata || '_';
                    if (!grouped.has(key)) grouped.set(key, []);
                    grouped.get(key)!.push(item);
                  }
                  const sortedGroups = Array.from(grouped.entries()).sort(([a], [b]) => {
                    if (a === '_') return 1; if (b === '_') return -1;
                    return parseInt(a) - parseInt(b);
                  });
                  return sortedGroups.map(([portataKey, items]) => {
                    const portataInfo = PORTATE.find(p => p.value === portataKey);
                    const groupTotal = items.reduce((s, i) => s + calculateItemPrice(i, ingredients), 0);
                    return (
                      <div key={portataKey}>
                        <div className={`flex items-center justify-between mb-3 px-5 py-3 rounded-2xl border ${portataInfo?.color || 'border-surface-light bg-charcoal'}`}>
                          <span className="font-black text-base uppercase tracking-wider">{portataInfo?.label || 'SENZA USCITA'}</span>
                          <span className="font-black text-base opacity-80">€{groupTotal.toFixed(2)}</span>
                        </div>
                        <div className="space-y-2">
                          {items.map(item => (
                            <div key={item.uniqueId} className="flex items-center justify-between py-2 px-2">
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <span className="w-8 h-8 bg-charcoal rounded-xl text-sm flex items-center justify-center font-black text-gold shrink-0">{item.quantity}</span>
                                <span className="font-bold text-white text-base truncate">{item.nome}</span>
                                {item.addedIngredients.length > 0 && <span className="text-xs text-emerald-400 font-bold truncate">+{item.addedIngredients.map(a => a.nome).join(', ')}</span>}
                                {item.removedIngredients.length > 0 && <span className="text-xs text-red-400 font-bold truncate">NO {item.removedIngredients.join(', ')}</span>}
                                {item.portata && (
                                  <span className={`shrink-0 text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${portataInfo?.color || ''}`}>
                                    {portataInfo?.label || item.portata}
                                  </span>
                                )}
                              </div>
                              <span className="font-black text-white text-base shrink-0 ml-4">€{calculateItemPrice(item, ingredients).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  });
                })()
              )}

              {splitResult && (
                <div className="bg-charcoal border border-gold/30 rounded-3xl p-6">
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Conto diviso</p>
                  <p className="text-4xl font-black italic text-gold">€{splitResult.eachAmount.toFixed(2)} <span className="text-sm text-gray-500 font-bold">× {splitResult.parts}</span></p>
                </div>
              )}
            </div>

            {/* Footer actions */}
            <div className="py-4 border-t border-surface-light bg-surface-light/5 space-y-3">
              <div className="flex gap-3">
                <button
                  onClick={() => printKitchen(cart, tableName || 'Tavolo')}
                  disabled={cart.length === 0}
                  className="flex-1 bg-charcoal border border-surface-light text-gray-300 font-black py-3 rounded-2xl text-[10px] uppercase tracking-widest hover:border-amber-500/40 active:scale-95 transition-all disabled:opacity-30 flex items-center justify-center gap-2"
                >
                  <Printer size={16} /> STAMPA CUCINA
                </button>
                <button
                  onClick={() => printFullReceipt(cart, tableName || 'Tavolo', total)}
                  disabled={cart.length === 0}
                  className="flex-1 bg-charcoal border border-surface-light text-gray-300 font-black py-3 rounded-2xl text-[10px] uppercase tracking-widest hover:border-blue-500/40 active:scale-95 transition-all disabled:opacity-30 flex items-center justify-center gap-2"
                >
                  <Printer size={16} /> STAMPA SCONTRINO
                </button>
              </div>
              <button
                onClick={freeTable}
                disabled={finishingOrder}
                className="w-full bg-red-500/10 border border-red-500/30 text-red-400 font-black py-2.5 rounded-2xl text-[10px] uppercase tracking-widest active:scale-95 transition-all disabled:opacity-30 flex items-center justify-center gap-1.5"
              >
                LIBERA TAVOLO
              </button>
              <div className="flex gap-4">
                <button
                  onClick={() => setShowBillReview(false)}
                  className="flex-1 bg-surface-light border border-white/10 text-white font-black py-5 rounded-2xl text-sm flex items-center justify-center gap-3 hover:bg-white/10 active:scale-95 transition-all"
                >
                  <Edit3 size={20} /> MODIFICA
                </button>
                <button
                  onClick={() => setIsSplitModalOpen(true)}
                  disabled={cart.length === 0}
                  className="flex-1 bg-charcoal border border-surface-light text-gray-300 font-black py-5 rounded-2xl text-sm uppercase tracking-widest hover:border-gold/30 active:scale-95 transition-all disabled:opacity-30 flex items-center justify-center gap-2"
                >
                  <Users size={20} /> DIVIDI
                </button>
                <button
                  onClick={() => { if (confirm('Confermi la chiusura del conto?')) { setShowBillReview(false); handleFinishOrder(); } }}
                  disabled={cart.length === 0 || finishingOrder}
                  className="flex-[2] bg-gold hover:bg-gold-hover text-black font-black py-5 rounded-2xl shadow-2xl shadow-gold/20 flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-30 text-lg"
                >
                  {finishingOrder ? 'Attendi…' : <><CreditCard size={26} /> PAGA €{total.toFixed(2)}</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="h-[100dvh] flex bg-charcoal text-white overflow-hidden">
      
      {/* Left Column: Menu */}
      <div className="flex-1 flex flex-col min-w-0 p-4 md:p-6 lg:p-8 min-h-0">
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
                <div className="flex flex-wrap gap-2 mt-3">
                  <button
                    type="button"
                    onClick={() => setBillsDayOpen(true)}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-charcoal border border-surface-light text-[10px] font-black uppercase tracking-wider text-gray-300 hover:text-gold hover:border-gold/30 transition-all"
                  >
                    <Receipt size={14} /> Conti oggi
                  </button>
                  {tableName && (
                    <button
                      type="button"
                      onClick={() => setBillsTableOpen(true)}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-charcoal border border-surface-light text-[10px] font-black uppercase tracking-wider text-gray-300 hover:text-gold hover:border-gold/30 transition-all"
                    >
                      <Receipt size={14} /> Storico tavolo
                    </button>
                  )}
                </div>
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
                className="w-full bg-surface border border-surface-light rounded-2xl py-3 pl-12 pr-12 text-white font-bold outline-none focus:border-gold transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors p-1"
                >
                  <X size={18} />
                </button>
              )}
            </div>
          </div>

          {/* Categories Selector */}
          <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
            <button
              onClick={() => setActiveCategory(null)}
              className={`px-6 py-2.5 rounded-xl font-black text-xs tracking-widest transition-all border whitespace-nowrap shrink-0 ${activeCategory === null ? 'bg-gold border-gold text-black shadow-lg shadow-gold/20' : 'bg-surface border-surface-light text-gray-500 hover:text-white'}`}
            >
              TUTTI
            </button>
            {(() => {
              const coveredCats = new Set(categoryDefs.flatMap(d => d.match));
              const extraCats = Array.from(new Set(products.map(p => p.categoria)))
                .filter(c => !coveredCats.has(c) && c !== 'EXTRA')
                .sort();
              return [...categoryDefs, ...extraCats.map(c => ({ label: c, match: [c] }))].filter(def => def.match.some(c => products.some(p => p.categoria === c)));
            })().map(def => (
              <button 
                key={def.label}
                onClick={() => setActiveCategory(activeCategory === def.label ? null : def.label)}
                className={`px-6 py-2.5 rounded-xl font-black text-xs tracking-widest transition-all border whitespace-nowrap shrink-0 ${activeCategory === def.label ? 'bg-gold border-gold text-black shadow-lg shadow-gold/20' : 'bg-surface border-surface-light text-gray-500 hover:text-white'}`}
              >
                {def.label.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Panino Builder Button */}
          <button
            onClick={() => setPaninoModalOpen(true)}
            className="w-full bg-gold/10 border-2 border-dashed border-gold/40 text-gold font-black py-3 rounded-2xl text-xs uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all hover:bg-gold/20"
          >
            <Sandwich size={18} /> COMPONI PANINO
          </button>
        </header>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar pb-12">
          {(() => {
            const showSub = activeCategory === 'Bevande' || (!activeCategory && filteredProducts.some(p => p.categoria === 'Bevande'));
            const gridClass = 'grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 xxl:grid-cols-5 gap-4';
            
            if (showSub) {
              const bevande = filteredProducts.filter(p => p.categoria === 'Bevande');
              const other = filteredProducts.filter(p => p.categoria !== 'Bevande');
              const subcats = [...new Set(bevande.map(p => p.sottocategoria || 'Altro'))];
              return (
                <>
                  {other.length > 0 && (
                    <div className={gridClass}>
                      {other.map(p => renderProductCard(p))}
                    </div>
                  )}
                  {subcats.map(sub => (
                    <div key={sub}>
                      <div className="text-[10px] font-black text-gold uppercase tracking-widest py-3 mb-2 border-b border-surface-light">{sub}</div>
                      <div className={gridClass}>
                        {bevande.filter(p => (p.sottocategoria || 'Altro') === sub).map(p => renderProductCard(p))}
                      </div>
                    </div>
                  ))}
                </>
              );
            }
            
            return <div className={gridClass}>{filteredProducts.map(p => renderProductCard(p))}</div>;

            function renderProductCard(product: Product) {
              const missingIngredients = product.ingredienti?.filter(ingName => {
                const ingredient = ingredients.find(i => i.nome === ingName);
                return ingredient && !ingredient.disponibile;
              }) || [];
              const isTrulyAvailable = product.disponibile && missingIngredients.length === 0;
              const cartCount = cart.filter(c => c.id === product.id).reduce((s, c) => s + c.quantity, 0);
              const inCart = cartCount > 0;

              return (
                <div
                  key={product.id}
                  onClick={() => isTrulyAvailable && addToCart(product)}
                  className={`bg-surface border p-5 rounded-[24px] flex flex-col justify-between text-left transition-all active:scale-95 group shadow-xl h-44 relative overflow-hidden cursor-pointer ${
                    !isTrulyAvailable ? 'border-red-500/20 grayscale opacity-60 cursor-not-allowed'
                    : inCart ? 'border-gold/60 ring-2 ring-gold/20'
                    : 'border-surface-light hover:border-gold/40'
                  }`}
                >
                  {inCart && (
                    <div className="absolute top-2 right-2 z-10">
                      <span className="bg-gold text-black text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-lg shadow-gold/30">×{cartCount}</span>
                    </div>
                  )}
                  <div>
                    <h3 className={`font-bold text-lg leading-tight transition-colors ${isTrulyAvailable ? 'group-hover:text-gold' : 'text-gray-500 line-through'}`}>{product.nome}</h3>
                    <p className={`text-[10px] font-black uppercase tracking-widest mt-1 ${isTrulyAvailable ? 'text-gray-500' : 'text-red-500'}`}>
                      {isTrulyAvailable ? product.categoria : `MANCA: ${missingIngredients.join(', ')}`}
                    </p>
                  </div>
                  <div className="flex justify-between items-end">
                    <span className={`text-xl font-black ${isTrulyAvailable ? 'text-white' : 'text-gray-500'}`}>€{product.prezzo.toFixed(2)}</span>
                    <div className="flex items-center gap-1.5">
                      <button 
                        onClick={(e) => { e.stopPropagation(); if (isTrulyAvailable) openCustomization(product); }}
                        className={`p-2 rounded-xl border transition-all active:scale-95 ${isTrulyAvailable ? 'bg-charcoal border-surface-light text-gold hover:bg-surface-light' : 'opacity-50'}`}
                      >
                        <Edit3 size={16} />
                      </button>
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all ${isTrulyAvailable ? 'bg-charcoal border-surface-light text-gold group-hover:bg-gold group-hover:text-black' : 'bg-red-500/10 border-red-500/20 text-red-500'}`}>
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
            }
          })()}
        </div>
      </div>

      {/* Right Column: Calculator/Cart */}
      <aside className="w-full max-w-[450px] shrink-0 md:w-[420px] lg:w-[450px] bg-surface flex flex-col min-h-0 border-l border-surface-light shadow-2xl relative overflow-hidden">
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
            className="p-4 bg-charcoal border border-surface-light rounded-2xl text-gray-500 hover:text-red-500 hover:border-red-500/20 transition-all active:scale-90"
            title="Svuota carrello"
          >
            <Trash2 size={22} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar relative z-10">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-600 opacity-50">
              <ShoppingCart size={64} className="mb-4" />
              <p className="font-black uppercase tracking-widest text-[10px]">Aggiungi prodotti</p>
            </div>
          ) : (
            (() => {
              const grouped = new Map<string, CustomizedItem[]>();
              for (const item of cart) {
                const key = item.portata || '_';
                if (!grouped.has(key)) grouped.set(key, []);
                grouped.get(key)!.push(item);
              }
              const sortedGroups = Array.from(grouped.entries()).sort(([a], [b]) => {
                if (a === '_') return 1; if (b === '_') return -1;
                return parseInt(a) - parseInt(b);
              });
              return sortedGroups.map(([portataKey, items]) => {
                const portataInfo = PORTATE.find(p => p.value === portataKey);
                const groupTotal = items.reduce((s, i) => s + calculateItemPrice(i, ingredients), 0);
                return (
                  <div key={portataKey}>
                    <div className={`flex items-center justify-between mb-3 px-4 py-2.5 rounded-2xl border ${portataInfo?.color || 'border-surface-light bg-charcoal'}`}>
                      <span className="font-black text-xs uppercase tracking-wider">{portataInfo?.label || 'SENZA USCITA'}</span>
                      <span className="font-black text-sm opacity-80">€{groupTotal.toFixed(2)}</span>
                    </div>
                    <div className="space-y-3">
                      {items.map(item => (
                        <div key={item.uniqueId} className="bg-charcoal/50 border border-surface-light rounded-2xl p-4 flex flex-col border-l-4 border-l-gold">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex-1 min-w-0 pr-4">
                              <div className="flex items-center gap-2">
                                <p className="font-bold text-white text-base truncate">{item.nome}</p>
                                {item.portata && (
                                  <span className={`shrink-0 text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${portataInfo?.color || 'text-gray-500 border-gray-500/30'}`}>
                                    {portataInfo?.label || item.portata}
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {item.addedIngredients.map(a => <span key={a.nome} className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">+{a.nome}</span>)}
                                {item.removedIngredients.map(r => <span key={r} className="text-[10px] font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded">NO {r}</span>)}
                                {item.notes && <p className="text-[10px] text-amber-500 italic w-full font-bold">* {item.notes}</p>}
                              </div>
                            </div>
                            <button onClick={() => removeEntireItem(item.uniqueId)} className="p-3 text-gray-600 hover:text-red-500 transition-colors active:scale-90">
                              <Trash2 size={18} />
                            </button>
                          </div>
                          <div className="flex items-center justify-between pt-2 border-t border-surface-light/50">
                            <button onClick={() => editCartItem(item)} className="px-3 py-2 text-[10px] font-black uppercase text-gray-500 hover:text-white flex items-center gap-1.5 bg-charcoal rounded-xl border border-surface-light hover:border-gold/30 transition-all active:scale-90">
                              <Edit3 size={14} /> MODIFICA
                            </button>
                            <div className="flex items-center gap-3 bg-surface p-1.5 rounded-xl border border-surface-light shadow-lg">
                              <button onClick={() => removeFromCart(item.uniqueId)} className="w-10 h-10 flex items-center justify-center bg-charcoal hover:bg-gold/20 hover:text-gold rounded-xl text-gray-500 transition-all active:scale-90"><Minus size={18} /></button>
                              <span className="w-8 text-center font-black text-white text-lg">{item.quantity}</span>
                              <button onClick={() => addToCart(item)} className="w-10 h-10 flex items-center justify-center bg-charcoal hover:bg-gold/20 hover:text-gold rounded-xl text-gray-500 transition-all active:scale-90"><Plus size={18} /></button>
                            </div>
                            <p className="text-white font-black text-base">€{calculateItemPrice(item, ingredients).toFixed(2)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              });
            })()
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
                disabled={cart.length === 0 || finishingOrder}
                className="w-full bg-surface hover:bg-white/5 text-gold font-black text-xs py-4 rounded-2xl border border-dashed border-gold/30 mb-2 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <Users size={16} /> DIVISIONE CONTO
              </button>
              
              <button
                onClick={() => setReceiptOpen(true)}
                disabled={cart.length === 0}
                className="w-full bg-charcoal hover:bg-surface-light text-gray-400 hover:text-white font-black text-xs py-3 rounded-2xl border border-surface-light transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <Receipt size={16} /> ANTEPRIMA RICEVUTA
              </button>
              
              {tableId && (
                <button
                  onClick={handleUpdateBill}
                  disabled={cart.length === 0 || finishingOrder}
                  className="w-full bg-surface-light hover:bg-white/10 text-white font-black text-lg py-4 rounded-2xl border border-surface-light transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  Salva solo Comanda <Save size={20} />
                </button>
              )}
              <button
                onClick={handleFinishOrder}
                disabled={cart.length === 0 || finishingOrder}
                className="w-full bg-gold hover:bg-gold-hover text-black font-black text-2xl py-6 rounded-3xl shadow-2xl shadow-gold/20 transition-all active:scale-95 flex items-center justify-center gap-4 disabled:opacity-50 disabled:grayscale"
              >
                {finishingOrder ? (
                  <>Attendi…</>
                ) : (
                  <>
                    Chiudi Conto <CheckCircle size={28} />
                  </>
                )}
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
                  <div className="text-[10px] opacity-60 mt-1">Diviso {tableClienti || 1} persone</div>
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
                const parts = splitType === 'EQUAL' ? 2 : splitType === 'GUESTS' ? (tableClienti || 1) : customSplitCount;
                setSplitResult({ parts, eachAmount: total / parts });
              }}
              disabled={splitType === 'NONE' || finishingOrder}
              className="w-full bg-gold hover:bg-gold-hover text-black font-black py-6 rounded-3xl text-xl shadow-2xl shadow-gold/20 active:scale-95 transition-all disabled:opacity-30"
            >
              PROCEDI AL PAGAMENTO DIVISO
            </button>
          </div>
        </div>
      )}

      {/* Split Result Confirmation */}
      {splitResult && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-surface border border-surface-light w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden p-10 text-center">
            <div className="w-16 h-16 rounded-full bg-gold/20 flex items-center justify-center mx-auto mb-6">
              <Calculator size={32} className="text-gold" />
            </div>
            <h2 className="text-3xl font-black italic uppercase text-white tracking-tighter mb-2">Conto Diviso</h2>
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-8">
              {splitResult.parts} quote da €{total.toFixed(2)}
            </p>

            <div className="bg-charcoal border border-surface-light rounded-3xl p-6 mb-8">
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Importo per quota</p>
              <p className="text-5xl font-black italic text-gold">€{splitResult.eachAmount.toFixed(2)}</p>
              <p className="text-xs text-gray-500 mt-2">× {splitResult.parts} persone</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setSplitResult(null)}
                className="flex-1 bg-charcoal border border-surface-light text-gray-300 font-black py-5 rounded-2xl text-sm uppercase tracking-widest hover:bg-surface-light active:scale-95 transition-all"
              >
                INDIETRO
              </button>
              <button
                onClick={() => {
                  setSplitResult(null);
                  setIsSplitModalOpen(false);
                  void handleFinishOrder();
                }}
                disabled={finishingOrder}
                className="flex-[2] bg-gold hover:bg-gold-hover text-black font-black py-5 rounded-2xl text-sm shadow-xl shadow-gold/20 active:scale-95 transition-all disabled:opacity-30 uppercase tracking-widest"
              >
                {finishingOrder ? '…' : 'CONFERMA E CHIUDI CONTO'}
              </button>
            </div>
          </div>
        </div>
      )}
      <ProductCustomizationModal
        isOpen={isModalOpen}
        editingItem={editingItem}
        ingredients={ingredients}
        products={products}
        variant="desktop"
        onClose={() => setIsModalOpen(false)}
        onSave={saveCustomization}
         onDuettoSave={(item, pairedId) => {
          const product = products.find(p => p.id === pairedId);
          if (product) {
            const pairedItem: CustomizedItem = {
              ...product,
              quantity: 1,
              addedIngredients: [],
              removedIngredients: [],
              notes: `DUETTO CON: ${item.nome}`,
              uniqueId: newUniqueId(),
            };
            setCart(prev => [...prev, item, pairedItem]);
          }
          setIsModalOpen(false);
          setEditingItem(null);
        }}
      />

      <ReceiptPreview
        isOpen={receiptOpen}
        onClose={() => setReceiptOpen(false)}
        customerName={tableName || 'POS'}
        pickupTime={new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
        items={cart}
        ingredients={ingredients}
        total={total}
      />
      <PaninoBuilderModal
        isOpen={paninoModalOpen}
        products={products}
        currentPortata="1"
        variant="pos"
        onClose={() => setPaninoModalOpen(false)}
        onSave={addPaninoToCart}
      />
      <BillsHistoryModal open={billsDayOpen} onClose={() => setBillsDayOpen(false)} variant="day" />
      <BillsHistoryModal
        open={billsTableOpen}
        onClose={() => setBillsTableOpen(false)}
        variant="table"
        tableName={tableName}
      />
    </>
  );
}
