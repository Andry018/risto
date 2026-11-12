import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { requireManagerPin } from '../lib/staffAuth';
import { supabase, IS_DEMO_MODE } from '../lib/supabase';
import type { Order, Product, Ingredient, OrderCarrelloItem, CustomizedItem, MagazzinoArticolo } from '../types/entities';
import { newUniqueId } from '../lib/id';
import { MOCK_PRODUCTS, MOCK_INGREDIENTS, MOCK_TABLES } from '../lib/MockData';
import { ShoppingCart, Plus, Minus, Trash2, Search, CheckCircle, Calculator, Save, WifiOff, LayoutDashboard, Edit3, X, Users, Receipt, Printer, Sandwich, Pause, UtensilsCrossed, CreditCard, ChefHat } from 'lucide-react';
import BillsHistoryModal from './BillsHistoryModal';
import CashPaymentModal from './CashPaymentModal';
import CardPaymentModal from './CardPaymentModal';
import PaymentChoiceModal from './PaymentChoiceModal';
import BillReviewPanel from './BillReviewPanel';
import type { PaymentResult } from '../lib/ecrAgent';
import ProductCustomizationModal from './ProductCustomizationModal';
import PaninoBuilderModal from './PaninoBuilderModal';
import CustomItemModal from './CustomItemModal';
import NumericKeypad from './NumericKeypad';
import { syncManager } from '../lib/OfflineSync';
import { useRearScreen } from '../lib/rearScreen';
import { calculateItemPrice, roundCents } from '../lib/priceUtils';
import { getItemKey, qtyByKey, computePending } from '../lib/orderPending';
import { applyItemSplit, splitAmount, subtractSaved, type ItemSelection } from '../lib/splitByItems';
import { useToast } from './Toast';
import { useConfirm } from './ConfirmModal';
import { printKitchenViaAgent, printSalaViaAgent, printReceiptViaAgent, printErrorMessage, comandaNotPrintedToast, isPrintQueued } from '../lib/lanPrint';
import { getPrintAgentUrl, getPrinterIp, getPrinterPort } from '../lib/printConfig';
import {
  addedIngredientsFromStoredOrderLine,
  calculateRemovalsPrice,
  findProductForOrderLine,
} from '../lib/orderCarrelloMap';
import { fetchArticoli } from '../lib/magazzino';

const PORTATA_OPTIONS = [
  { value: '1', label: '1ª Uscita', color: 'text-rose-400 border-rose-500/30 bg-rose-500/10' },
  { value: '2', label: '2ª Uscita', color: 'text-sky-400 border-sky-500/30 bg-sky-500/10' },
  { value: '3', label: '3ª Uscita', color: 'text-amber-400 border-amber-500/30 bg-amber-500/10' },
  { value: '4', label: '4ª Uscita', color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' },
  { value: '5', label: '5ª Uscita', color: 'text-fuchsia-400 border-fuchsia-500/30 bg-fuchsia-500/10' },
] as const;

export default function POSView({ tableId: propTableId, tableName: propTableName, onOrderFinished, onNavigateHome }: { tableId?: string, tableName?: string, onOrderFinished?: () => void, onNavigateHome?: () => void }) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const tableId = propTableId || searchParams.get('tableId');
  const tableName = propTableName || searchParams.get('tableName');

  const [products, setProducts] = useState<Product[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [magazzino, setMagazzino] = useState<MagazzinoArticolo[]>([]);
  const [cart, setCart] = useState<CustomizedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [isSplitModalOpen, setIsSplitModalOpen] = useState(false);
  const [splitType, setSplitType] = useState<'NONE' | 'EQUAL' | 'GUESTS' | 'CUSTOM' | 'ITEMS'>('NONE');
  /** Divisione per piatto: pezzi scelti per chi paga adesso */
  const [itemSelection, setItemSelection] = useState<ItemSelection>({});
  /** Pagamento in corso di una parte (per piatto): cosa si paga, cosa resta, quanto */
  const [itemSplitPaying, setItemSplitPaying] = useState<{ paid: CustomizedItem[]; remaining: CustomizedItem[]; amount: number } | null>(null);
  const [customSplitCount, setCustomSplitCount] = useState(2);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [billsDayOpen, setBillsDayOpen] = useState(false);
  const [billsTableOpen, setBillsTableOpen] = useState(false);
  const [billsSuspendedOpen, setBillsSuspendedOpen] = useState(false);
  const [finishingOrder, setFinishingOrder] = useState(false);
  const [tableClienti, setTableClienti] = useState(0);
  const [splitResult, setSplitResult] = useState<{ parts: number; eachAmount: number } | null>(null);
  const [showBillReview, setShowBillReview] = useState(false);
  const [scontoTipo, setScontotipo] = useState<'percentuale' | 'fisso' | null>(null);
  const [scontoValore, setScontoValore] = useState(0);
  const [discountModalOpen, setDiscountModalOpen] = useState(false);
  const [discountDraftTipo, setDiscountDraftTipo] = useState<'percentuale' | 'fisso'>('percentuale');
  const [discountDraftValue, setDiscountDraftValue] = useState('');
  const [currentPortata, setCurrentPortata] = useState<(typeof PORTATA_OPTIONS)[number]['value']>('1');

  // Pagamento carta (ECR / PAX A35)
  const [paymentChoiceOpen, setPaymentChoiceOpen] = useState(false);
  const [cashPaymentOpen, setCashPaymentOpen] = useState(false);
  const [cashPaymentAmount, setCashPaymentAmount] = useState(0);
  const [cardPaymentOpen, setCardPaymentOpen] = useState(false);
  const [cardPaymentSplitParts, setCardPaymentSplitParts] = useState<number | undefined>(undefined);

  // Customization state
  const [editingItem, setEditingItem] = useState<CustomizedItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [paninoModalOpen, setPaninoModalOpen] = useState(false);
  const [customItemModalOpen, setCustomItemModalOpen] = useState(false);

  // URY-style single/double click
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clickCountRef = useRef(0);

  const handleProductClick = (product: Product) => {
    if (!product.disponibile) return;
    clickCountRef.current += 1;
    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    clickTimerRef.current = setTimeout(() => {
      if (clickCountRef.current === 1) {
        addToCart(product);
      } else if (clickCountRef.current >= 2) {
        openCustomization(product);
      }
      clickCountRef.current = 0;
    }, 250);
  };

  const toast = useToast();
  const { confirm } = useConfirm();

  /** true se il carrello differisce dall'ultimo salvataggio (stesse chiavi usate per il delta di stampa) */
  function hasUnsavedChanges(): boolean {
    const current = new Map<string, number>();
    for (const item of cartRef.current) {
      const key = getItemKey(item);
      current.set(key, (current.get(key) || 0) + item.quantity);
    }
    const saved = savedItemQtysRef.current;
    if (current.size !== saved.size) return true;
    for (const [key, qty] of current) {
      if (saved.get(key) !== qty) return true;
    }
    return false;
  }

  async function handleBack() {
    if (cart.length > 0 && hasUnsavedChanges()) {
      const ok = await confirm({
        title: 'Modifiche non salvate',
        message: 'Nel carrello ci sono articoli non ancora salvati. Uscire ora li perderà. Continuare?',
        confirmLabel: 'Esci',
        cancelLabel: 'Rimani',
        destructive: true,
      });
      if (!ok) return;
    }
    if (onNavigateHome) {
      onNavigateHome();
    } else if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  }
  const productsRef = useRef(products);
  const ingredientsRef = useRef(ingredients);
  const localUpdateRef = useRef(false);
  const savedItemQtysRef = useRef<Map<string, number>>(new Map());
  /** Quantità già inviate in cucina, anche come stato: servono per "NUOVO" e per il pulsante INVIA. */
  const [savedQtys, setSavedQtysState] = useState<Map<string, number>>(new Map());
  const setSavedQtys = (m: Map<string, number>) => { savedItemQtysRef.current = m; setSavedQtysState(m); };
  const cartRef = useRef<CustomizedItem[]>(cart);
  productsRef.current = products;
  ingredientsRef.current = ingredients;
  cartRef.current = cart;


  useEffect(() => {
    setCurrentPortata('1');
  }, [tableId, tableName]);

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

  async function fetchMagazzino() {
    if (IS_DEMO_MODE || !supabase) return;
    setMagazzino(await fetchArticoli());
  }

  async function fetchExistingOrder(force = true) {
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
      setCurrentPortata('1');
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
      if (!force && hasUnsavedChanges()) {
        toast.addToast({
          type: 'info',
          title: 'Modifiche non salvate',
          message: "L'ordine è stato aggiornato da un altro dispositivo. Salva o ricarica per allinearti.",
          duration: 5000,
        });
        return;
      }
      setCart(mappedCart);
      setSavedQtys(qtyByKey(mappedCart));
      if (mappedCart.length > 0) setShowBillReview(true);
    } else if (tableId) {
      // Nessun ordine sul server: da un evento realtime (force=false) non sovrascrivere un carrello
      // con piatti non ancora inviati, altrimenti resterebbe solo la riga COPERTO.
      if (!force && hasUnsavedChanges()) return;
      const { data: table } = await supabase.from('tavoli').select('clienti').eq('id', tableId).single();
      if (table) {
        setTableClienti(table.clienti || 0);
        if (table.clienti > 0) {
          const { data: prods } = await supabase.from('prodotti').select('*').eq('nome', 'COPERTO').maybeSingle();
          const copertoProd = prods || MOCK_PRODUCTS.find(p => p.nome === 'COPERTO');

          if (copertoProd) {
            const initialCart = [{
              ...copertoProd,
              quantity: table.clienti,
              addedIngredients: [],
              removedIngredients: [],
              notes: '',
              uniqueId: 'initial-coperto'
            }];
            setCart(initialCart);
            setSavedQtys(qtyByKey(initialCart));
          }
        }
      }
      setCurrentPortata('1');
    }
  }

  useEffect(() => {
    void fetchProducts();
    void fetchIngredients();
    void fetchMagazzino();

    if (!supabase) return;
    const sb = supabase;

    const productsChannel = sb
      .channel('public:prodotti-pos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prodotti' }, () => void fetchProducts())
      .subscribe();
    const ingredientsChannel = sb
      .channel('public:ingredienti')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ingredienti' }, () => void fetchIngredients())
      .subscribe();
    const magazzinoChannel = sb
      .channel('public:magazzino-pos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'magazzino_articoli' }, () => void fetchMagazzino())
      .subscribe();
    return () => { 
      sb.removeChannel(productsChannel); 
      sb.removeChannel(ingredientsChannel);
      sb.removeChannel(magazzinoChannel);
    };
  }, []);

  useEffect(() => {
    if (tableId && products.length > 0) {
      void fetchExistingOrder();
    }
  }, [tableId, products.length]);

  useEffect(() => {
    if (searchParams.get('showHold') === 'true') setBillsSuspendedOpen(true);
    if (searchParams.get('showBills') === 'day') setBillsDayOpen(true);
  }, [searchParams]);

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
          void fetchExistingOrder(false);
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
            void fetchExistingOrder(false);
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
        item.portata === currentPortata &&
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
        portata: currentPortata,
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
      portata: currentPortata,
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

  const clearCart = () => {
    setCart([]);
    setCurrentPortata('1');
  };

  const addPaninoToCart = (item: CustomizedItem) => {
    setCart(prev => [...prev, { ...item, portata: item.portata ?? currentPortata }]);
  };

  const total = cart.reduce((sum, item) => sum + calculateItemPrice(item, ingredients), 0);

  const discountedTotal = roundCents(scontoTipo === 'percentuale'
    ? total * (1 - scontoValore / 100)
    : scontoTipo === 'fisso'
    ? Math.max(0, total - scontoValore)
    : total);

  /** Cosa non è ancora stato inviato in cucina (etichette NUOVO e pulsante INVIA). */
  const pending = computePending(cart, savedQtys, ingredients);

  /** Ristampa di cucina, sala o tutto: chiede conferma (doppioni in cucina) e segnala gli errori. */
  const reprint = async (kind: 'tutto' | 'cucina' | 'sala') => {
    if (cart.length === 0 || printBusy) return;
    const ok = await confirm({
      title: kind === 'tutto' ? 'Ristampare tutta la comanda?' : `Ristampare la comanda ${kind}?`,
      message: 'Viene stampato di nuovo TUTTO, non solo le aggiunte. Per mandare solo i piatti nuovi usa INVIA.',
      confirmLabel: 'Ristampa',
      cancelLabel: 'Annulla',
    });
    if (!ok) return;
    if (kind === 'tutto') { await handlePrintFull(); return; }
    const salaCats = ['Bevande', 'Dolce', 'Dolci', 'Caffè e Liquori'];
    const items = cart.filter(i => i.categoria !== 'Servizio').filter(i => (kind === 'sala') === salaCats.includes(i.categoria));
    if (items.length === 0) return;
    setPrintBusy('comanda');
    try {
      const orderTime = new Date().toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      if (kind === 'cucina') await printKitchenViaAgent(items, tableName || 'Tavolo', getPrintAgentUrl(), getPrinterIp(), getPrinterPort(), orderTime);
      else await printSalaViaAgent(items, tableName || 'Tavolo', getPrintAgentUrl(), getPrinterIp(), getPrinterPort());
      toast.addToast({ type: 'success', title: 'Ristampata', message: `Comanda ${kind} inviata alla stampante.`, duration: 2500 });
    } catch (error) {
      toast.addToast({
        type: isPrintQueued(error) ? 'warning' : 'error',
        title: isPrintQueued(error) ? 'Comanda in attesa di stampa' : 'Stampa non riuscita',
        message: printErrorMessage(error),
        duration: isPrintQueued(error) ? 10000 : 4500,
      });
    } finally {
      setPrintBusy(null);
    }
  };

  const rearScreen = useRearScreen({
    table: tableName || 'Banco',
    cart,
    total: discountedTotal,
    status: cardPaymentOpen ? 'paying' : null,
  });


  const handleFinishOrder = async () => {
    if (cart.length === 0 || finishingOrder) return;

    localUpdateRef.current = true;
    setFinishingOrder(true);
    try {
      const orderData = {
        nome_cliente: tableName || 'POS VENDITA',
        orario_ritiro: new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
        totale: discountedTotal,
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
            portata: i.portata,
            modifiche: {
              aggiunte: i.addedIngredients.map(a => a.nome),
              rimozioni: i.removedIngredients,
              note: i.notes
            }
          };
        }),
        ...(scontoTipo ? { sconto_tipo: scontoTipo, sconto_valore: scontoValore } : {}),
      };

      if (activeOrderId) {
        await syncManager.pushOrder({ ...orderData, id: activeOrderId });
      } else {
        await syncManager.pushOrder(orderData);
      }
      void fetchMagazzino();

      if (tableId) {
        await syncManager.pushTableUpdate(tableId, { status: 'LIBERO', clienti: 0 });
      }

      setActiveOrderId(null);
      setSavedQtys(new Map());
      rearScreen.pulse('paid', discountedTotal);
      setOrderSuccess(true);
      setCart([]);
      setTimeout(() => {
        setOrderSuccess(false);
        if (onOrderFinished) onOrderFinished();
      }, 2000);
    } catch (error) {
      console.error('Error submitting POS order:', error);
      toast.addToast({ type: 'error', title: 'Errore', message: 'Errore durante la chiusura dell\'ordine.' });
    } finally {
      setFinishingOrder(false);
    }
  };

  /** Stampa in corso: blocca i pulsanti di stampa così più tocchi non mandano più copie. */
  const [printBusy, setPrintBusy] = useState<null | 'comanda' | 'ricevuta'>(null);

  const handlePrintReceipt = async () => {
    if (cart.length === 0 || printBusy) return;
    setPrintBusy('ricevuta');
    try {
      await printReceiptViaAgent(cart, tableName || 'POS', discountedTotal, getPrintAgentUrl(), getPrinterIp(), getPrinterPort(), {
        lineTotals: cart.map(i => calculateItemPrice(i, ingredients)),
        subtotal: total,
        discount: Math.max(0, total - discountedTotal),
        discountLabel: scontoTipo === 'percentuale' ? `${scontoValore}%` : (scontoTipo === 'fisso' ? `-€${scontoValore.toFixed(2)}` : undefined),
      });
      toast.addToast({ type: 'success', title: 'Ricevuta stampata', message: 'Inviata alla stampante.', duration: 2500 });
    } catch (error) {
      toast.addToast({ type: 'error', title: 'Stampa non riuscita', message: printErrorMessage(error), duration: 4500 });
    } finally {
      setPrintBusy(null);
    }
  };

  const handlePrintFull = async () => {
    if (cart.length === 0 || printBusy) return;
    setPrintBusy('comanda');
    const salaCats = ['Bevande', 'Dolce', 'Dolci', 'Caffè e Liquori'];
    const tableLabel = tableName || 'Tavolo';

    // STAMPA = ristampa SEMPRE tutto il carrello (escluso Servizio/Coperto)
    const itemsToPrint = cart.filter(i => i.categoria !== 'Servizio');
    const cucinaItems = itemsToPrint.filter(i => !salaCats.includes(i.categoria));
    const salaItems = itemsToPrint.filter(i => salaCats.includes(i.categoria));
    try {
      const orderTime = new Date().toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      // Cucina e sala sempre tutte e due: se la prima non esce la seconda va provata lo stesso
      const failed: string[] = [];
      let reason: unknown;
      if (cucinaItems.length > 0) {
        await printKitchenViaAgent(cucinaItems, tableLabel, getPrintAgentUrl(), getPrinterIp(), getPrinterPort(), orderTime)
          .catch((e: unknown) => { failed.push('cucina'); reason = e; });
      }
      if (salaItems.length > 0) {
        await printSalaViaAgent(salaItems, tableLabel, getPrintAgentUrl(), getPrinterIp(), getPrinterPort())
          .catch((e: unknown) => { failed.push('sala'); reason = e; });
      }
      if (failed.length > 0) throw reason;
      toast.addToast({
        type: 'success',
        title: 'Comanda stampata',
        message: 'Cucina e sala inviate alla stampante LAN.',
        duration: 2500,
      });
    } catch (error) {
      console.error('Print failed:', error);
      toast.addToast({
        type: isPrintQueued(error) ? 'warning' : 'error',
        title: isPrintQueued(error) ? 'Comanda in attesa di stampa' : 'Stampa non riuscita',
        message: printErrorMessage(error),
        duration: isPrintQueued(error) ? 10000 : 4500,
      });
    } finally {
      setPrintBusy(null);
    }
  };

  const handleUpdateBill = async () => {
    if (cart.length === 0 || !tableId) return;
    
    const isUpdate = !!activeOrderId;
    const printDeltaQty = localStorage.getItem('risto_print_delta_qty') === 'true';

    // Calculate delta items to print (only new items since last save)
    let printItems: CustomizedItem[] = [];
    if (isUpdate) {
      for (const item of cart) {
        if (item.categoria === 'Servizio') continue;
        const key = getItemKey(item);
        const oldQty = savedItemQtysRef.current.get(key) || 0;
        if (item.quantity > oldQty) {
          const deltaQty = item.quantity - oldQty;
          printItems.push({ ...item, quantity: printDeltaQty && oldQty > 0 ? deltaQty : item.quantity });
        }
      }
    } else {
      // First time: all items are new
      printItems = cart.filter(i => i.categoria !== 'Servizio');
    }

    localUpdateRef.current = true;
    try {
      const orderData = {
        nome_cliente: tableName || 'POS',
        orario_ritiro: new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
        totale: discountedTotal,
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
            portata: i.portata,
            modifiche: {
              aggiunte: i.addedIngredients.map(a => a.nome),
              rimozioni: i.removedIngredients,
              note: i.notes
            }
          };
        }),
        ...(scontoTipo ? { sconto_tipo: scontoTipo, sconto_valore: scontoValore } : {}),
      };

      if (isUpdate) {
        await syncManager.pushOrder({ ...orderData, id: activeOrderId });
      } else {
        // L'ordine appena creato diventa quello attivo: i salvataggi successivi lo aggiornano
        // invece di crearne un altro (e stampano solo le aggiunte).
        setActiveOrderId(await syncManager.pushOrder(orderData));
        await syncManager.pushTableUpdate(tableId, { status: 'OCCUPATO' });
      }
      void fetchMagazzino();

      // Update saved quantities after successful save
      setSavedQtys(qtyByKey(cart));

      // Print delta items if any
      if (printItems.length > 0) {
        const orderTime = new Date().toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        const salaCats = ['Bevande', 'Dolce', 'Dolci', 'Caffè e Liquori'];
        const cucinaItems = printItems.filter(i => !salaCats.includes(i.categoria));
        const salaItems = printItems.filter(i => salaCats.includes(i.categoria));
        const label = isUpdate ? `${tableName || 'Tavolo'} (AGGIUNTA)` : tableName || 'Tavolo';
        // La cucina lavora solo sui fogli: se la comanda non esce bisogna saperlo subito.
        const failed: string[] = [];
        let reason: unknown;
        if (cucinaItems.length > 0) {
          await printKitchenViaAgent(cucinaItems, label, getPrintAgentUrl(), getPrinterIp(), getPrinterPort(), orderTime)
            .catch((e: unknown) => { failed.push('cucina'); reason = e; });
        }
        if (salaItems.length > 0) {
          await printSalaViaAgent(salaItems, label, getPrintAgentUrl(), getPrinterIp(), getPrinterPort())
            .catch((e: unknown) => { failed.push('sala'); reason = e; });
        }
        if (failed.length > 0) toast.addToast(comandaNotPrintedToast(failed, reason, 'Conto salvato'));
      }
      
      setOrderSuccess(true);
    } catch (error) {
      console.error('Error updating bill:', error);
      toast.addToast({ type: 'error', title: 'Errore', message: 'Errore durante l\'aggiornamento del conto.' });
    }
  };

  const handleFreeTable = async () => {
    if (!tableId) return;
    if (!(await requireManagerPin('liberare il tavolo senza vendita'))) return;
    const ok = await confirm({ title: 'Libera tavolo', message: 'Liberare il tavolo elimina la comanda corrente senza registrare una vendita. Continuare?', destructive: true });
    if (!ok) return;

    localUpdateRef.current = true;
    try {
      if (activeOrderId) {
        await syncManager.pushOrder({ id: activeOrderId, status: 'COMPLETATO' as const });
      } else if (tableName) {
        await syncManager.pushOrder({ nome_cliente: tableName, status: 'COMPLETATO' as const, totale: 0, carrello: [], orario_ritiro: '' });
      }
      await syncManager.pushTableUpdate(tableId, { status: 'LIBERO', clienti: 0 });
      setActiveOrderId(null);
      setSavedQtys(new Map());
      setCart([]);
      setScontotipo(null);
      setScontoValore(0);
      setSplitType('NONE');
      setSplitResult(null);
      setTableClienti(0);
      setOrderSuccess(true);
      setTimeout(() => setOrderSuccess(false), 1500);
    } catch (error) {
      console.error('Error freeing table:', error);
      toast.addToast({ type: 'error', title: 'Errore', message: 'Errore durante la liberazione del tavolo.' });
    }
  };

  const openDiscountModal = () => {
    setDiscountDraftTipo(scontoTipo || 'percentuale');
    setDiscountDraftValue(scontoValore > 0 ? String(scontoValore) : '');
    setDiscountModalOpen(true);
  };

  const applyDiscount = () => {
    const value = parseFloat(discountDraftValue);
    if (isNaN(value) || value <= 0) return;
    setScontotipo(discountDraftTipo);
    setScontoValore(discountDraftTipo === 'percentuale' ? Math.min(100, value) : value);
    setDiscountModalOpen(false);
  };

  const removeDiscount = () => {
    setScontotipo(null);
    setScontoValore(0);
    setDiscountModalOpen(false);
  };

  const resumeOrder = (order: Order) => {
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
    setScontotipo(order.sconto_tipo || null);
    setScontoValore(order.sconto_valore || 0);
    setBillsTableOpen(false);
    setBillsDayOpen(false);
    setBillsSuspendedOpen(false);
    toast.addToast({
      type: 'success',
      title: 'Conto caricato',
      message: `Caricato l'ordine di "${order.nome_cliente}"`,
      duration: 3000,
    });
  };

  const handleHoldBill = async () => {
    if (cart.length === 0 || finishingOrder) return;
    
    let name = tableName;
    if (!name) {
      const enteredName = prompt("Inserisci un riferimento per il conto in sospeso (es. Asporto 1, Mario...):");
      if (enteredName === null) return; // Annullato dall'utente
      name = enteredName.trim() || `Asporto #${new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`;
    }

    localUpdateRef.current = true;
    setFinishingOrder(true);
    try {
      const orderData = {
        nome_cliente: name,
        orario_ritiro: new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
        totale: discountedTotal,
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
            portata: i.portata,
            modifiche: {
              aggiunte: i.addedIngredients.map(a => a.nome),
              rimozioni: i.removedIngredients,
              note: i.notes
            }
          };
        }),
        ...(scontoTipo ? { sconto_tipo: scontoTipo, sconto_valore: scontoValore } : {}),
      };

      if (activeOrderId) {
        await syncManager.pushOrder({ ...orderData, id: activeOrderId });
      } else {
        await syncManager.pushOrder(orderData);
      }

      if (tableId) {
        await syncManager.pushTableUpdate(tableId, { status: 'OCCUPATO' });
      }

      setActiveOrderId(null);
      setSavedQtys(new Map());
      setCart([]);
      void fetchMagazzino();
      toast.addToast({
        type: 'success',
        title: 'Conto in Sospeso',
        message: `Conto per "${name}" salvato nei sospesi.`,
        duration: 3000,
      });
      if (onOrderFinished) onOrderFinished();
    } catch (error) {
      console.error('Error suspending bill:', error);
      toast.addToast({ type: 'error', title: 'Errore', message: 'Errore durante il salvataggio in sospeso.' });
    } finally {
      setFinishingOrder(false);
    }
  };


  const openCardPayment = (splitParts?: number) => {
    setCardPaymentSplitParts(splitParts);
    setCardPaymentOpen(true);
  };

  /** Rapporto sconto (totale scontato / pieno): lo sconto del tavolo si applica in proporzione a ogni parte. */
  const discountRatio = total > 0 ? discountedTotal / total : 1;

  const cartToCarrello = (items: CustomizedItem[]) => items.map(i => {
    const extras = i.addedIngredients.reduce((s, a) => s + a.prezzo, 0);
    const removals = i.removedIngredients.reduce((s, rName) => {
      const ing = ingredients.find(ig => ig.nome.toLowerCase() === rName.toLowerCase());
      return s + (ing?.prezzo_rimozione || 0);
    }, 0);
    return {
      nome: i.nome,
      quantity: i.quantity,
      prezzo_unitario: Math.max(0, i.prezzo + extras - removals),
      portata: i.portata,
      modifiche: { aggiunte: i.addedIngredients.map(a => a.nome), rimozioni: i.removedIngredients, note: i.notes },
    };
  });

  /** Avvia il pagamento dei piatti scelti. Se sono tutti, è un normale "chiudi conto". */
  const startItemPayment = (method: 'cash' | 'card') => {
    const { paid, remaining } = applyItemSplit(cart, itemSelection);
    if (paid.length === 0) return;
    setIsSplitModalOpen(false);
    if (remaining.length === 0) {
      setItemSplitPaying(null);
      if (method === 'cash') { setCashPaymentAmount(discountedTotal); setCashPaymentOpen(true); }
      else openCardPayment();
      return;
    }
    const amount = splitAmount(paid, ingredients, discountRatio);
    setItemSplitPaying({ paid, remaining, amount });
    if (method === 'cash') { setCashPaymentAmount(amount); setCashPaymentOpen(true); }
    else { setCardPaymentSplitParts(undefined); setCardPaymentOpen(true); }
  };

  /**
   * Pagamento di una parte riuscito: i piatti pagati diventano un ordine COMPLETATO (conta negli
   * incassi e nei report), il resto rimane aperto sul tavolo.
   */
  const finishItemSplit = async () => {
    const pay = itemSplitPaying;
    if (!pay) return;
    setFinishingOrder(true);
    localUpdateRef.current = true;
    try {
      const orario = new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
      await syncManager.pushOrder({
        nome_cliente: tableName || 'POS VENDITA',
        orario_ritiro: orario,
        totale: pay.amount,
        status: 'COMPLETATO' as const,
        carrello: cartToCarrello(pay.paid),
      });
      const restTotale = splitAmount(pay.remaining, ingredients, discountRatio);
      if (activeOrderId) {
        await syncManager.pushOrder({ id: activeOrderId, carrello: cartToCarrello(pay.remaining), totale: restTotale });
      } else {
        setActiveOrderId(await syncManager.pushOrder({
          nome_cliente: tableName || 'POS VENDITA', orario_ritiro: orario, totale: restTotale,
          status: 'IN_ATTESA' as const, carrello: cartToCarrello(pay.remaining),
        }));
      }
      setCart(pay.remaining);
      setSavedQtys(subtractSaved(savedItemQtysRef.current, pay.paid));
      setItemSelection({});
      setItemSplitPaying(null);
      void fetchMagazzino();
      toast.addToast({ type: 'success', title: `Pagato €${pay.amount.toFixed(2)}`, message: `Restano €${restTotale.toFixed(2)} sul tavolo.`, duration: 3500 });
    } catch (error) {
      console.error('Errore pagamento parziale:', error);
      toast.addToast({ type: 'error', title: 'Errore', message: 'Pagamento parziale non registrato. Riprova.' });
    } finally {
      setFinishingOrder(false);
    }
  };

  const handleCardAllPaid = (_results: PaymentResult[]) => {
    setCardPaymentOpen(false);
    setCardPaymentSplitParts(undefined);
    setSplitResult(null);
    setIsSplitModalOpen(false);
    if (itemSplitPaying) { void finishItemSplit(); return; }
    void handleFinishOrder();
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
    const missingIngredients = p.ingredienti?.filter(ingName => {
      const ingredient = ingredients.find(i => i.nome === ingName);
      return ingredient && !ingredient.disponibile;
    }) || [];
    return p.disponibile && missingIngredients.length === 0;
  });

  if (loading) return <div className="flex-1 flex justify-center items-center bg-charcoal"><div className="w-12 h-12 border-4 border-gold border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <>
      {/* Riepilogo conto */}
      {showBillReview && (
        <BillReviewPanel
          cart={cart}
          ingredients={ingredients}
          tableName={tableName}
          covers={tableClienti}
          total={total}
          discountedTotal={discountedTotal}
          scontoTipo={scontoTipo}
          scontoValore={scontoValore}
          pending={pending}
          isTable={!!tableId}
          busy={finishingOrder}
          printBusy={!!printBusy}
          portate={PORTATA_OPTIONS}
          onClose={() => setShowBillReview(false)}
          onDiscount={openDiscountModal}
          onPrintReceipt={() => void handlePrintReceipt()}
          onSend={() => void handleUpdateBill()}
          onSplit={() => setIsSplitModalOpen(true)}
          onHold={() => void handleHoldBill()}
          onFreeTable={() => void handleFreeTable()}
          onCheckout={() => setPaymentChoiceOpen(true)}
        />
      )}

      <div className="h-dvh flex bg-charcoal text-white overflow-hidden">

      {/* Lato sinistro: Categorie Menu (stile URY) */}
      <aside className="w-[88px] shrink-0 bg-surface/80 border-r border-surface-light flex flex-col items-center py-4 gap-1 overflow-y-auto">
        <div className="text-[9px] font-black uppercase tracking-[0.3em] text-gray-500 mb-1 pb-2 border-b border-surface-light w-full text-center">CATEGORIE</div>
        <button
          onClick={() => setActiveCategory(null)}
          className={`w-[72px] h-[52px] rounded-2xl border flex items-center justify-center transition-all active:scale-90 text-[10px] font-black uppercase tracking-wider ${
            activeCategory === null
              ? 'bg-gold border-gold text-black shadow-lg shadow-gold/20'
              : 'bg-charcoal border-surface-light text-gray-500 hover:text-white hover:border-gray-500'
          }`}
        >
          Tutti
        </button>
        {(() => {
          const coveredCats = new Set(categoryDefs.flatMap(d => d.match));
          const extraCats = Array.from(new Set(products.map(p => p.categoria)))
            .filter(c => !coveredCats.has(c) && c !== 'EXTRA')
            .sort();
          return [...categoryDefs, ...extraCats.map(c => ({ label: c, match: [c] }))].filter(def => def.match.some(c => products.some(p => p.categoria === c)));
        })().map(def => {
          const isActive = activeCategory === def.label;
          const icons: Record<string, string> = {
            Antipasto: '🥗', Primo: '🍝', Secondo: '🥩', Contorni: '🥦',
            Fritti: '🍟', Pizze: '🍕', Bevande: '🥤', Dolce: '🍰',
            'Caffè e Liquori': '☕', Servizio: '⚙️'
          };
          return (
            <button
              key={def.label}
              type="button"
              onClick={() => setActiveCategory(isActive ? null : def.label)}
              className={`w-[72px] h-[52px] rounded-2xl border flex flex-col items-center justify-center gap-0.5 transition-all active:scale-90 ${
                isActive
                  ? 'bg-gold border-gold text-black shadow-lg shadow-gold/20'
                  : 'bg-charcoal border-surface-light text-gray-500 hover:text-white hover:border-gray-500'
              }`}
            >
              <span className="text-base leading-none">{icons[def.label] || '📋'}</span>
              <span className="text-[9px] font-black uppercase tracking-wider leading-tight text-center px-0.5">{def.label}</span>
            </button>
          );
        })}
        <div className="mt-auto pt-2 border-t border-surface-light w-full flex flex-col items-center gap-1">
          <button
            onClick={() => setPaninoModalOpen(true)}
            className="w-[72px] h-[40px] rounded-2xl border border-gold/30 bg-gold/10 text-gold text-[10px] font-black uppercase tracking-wider transition-all hover:bg-gold/20 active:scale-90 flex items-center justify-center gap-1"
          >
            <Sandwich size={14} /> Panino
          </button>
          <button
            onClick={() => setCustomItemModalOpen(true)}
            className="w-[72px] h-[40px] rounded-2xl border border-emerald-400/30 bg-emerald-500/10 text-emerald-400 text-[10px] font-black uppercase tracking-wider transition-all hover:bg-emerald-500/20 active:scale-90 flex items-center justify-center gap-1"
          >
            <UtensilsCrossed size={14} /> Personal.
          </button>
        </div>
      </aside>

      {/* Colonna centrale: Menu Prodotti */}
      <div className="flex-1 flex flex-col min-w-0 p-4 md:p-6 lg:p-8 min-h-0">
        <header className="mb-4 sm:mb-6 lg:mb-8 flex flex-col gap-4 sm:gap-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4 sm:gap-6">
              <button
                onClick={() => void handleBack()}
                className="p-2.5 bg-surface border border-surface-light rounded-xl text-gray-500 hover:text-white transition-all shadow-xl sm:p-3 sm:rounded-2xl"
              >
                <LayoutDashboard className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-xs sm:text-sm text-gray-400 font-bold tracking-widest uppercase italic">Comanda & Conto</h2>
                  {pendingSyncCount > 0 && (
                    <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-500 text-white text-[9px] font-black rounded uppercase animate-pulse">
                      <WifiOff size={8} /> Sincronizzazione in corso ({pendingSyncCount})
                    </span>
                  )}
                </div>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white mt-0.5">POS <span className="text-gold italic">TERMINAL</span></h1>
                <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-2 sm:mt-3">
                  <button
                    type="button"
                    onClick={() => setBillsDayOpen(true)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl bg-charcoal border border-surface-light text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-gray-300 hover:text-gold hover:border-gold/30 transition-all"
                  >
                    <Receipt className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Conti oggi
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillsSuspendedOpen(true)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl bg-charcoal border border-surface-light text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-amber-500 hover:bg-amber-500/10 hover:border-amber-500/30 transition-all"
                  >
                    <Pause className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Conti Sospesi
                  </button>
                  {tableName && (
                    <button
                      type="button"
                      onClick={() => setBillsTableOpen(true)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl bg-charcoal border border-surface-light text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-gray-300 hover:text-gold hover:border-gold/30 transition-all"
                    >
                      <Receipt className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Storico tavolo
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative w-full max-w-md">
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
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            )}
          </div>

          {/* Uscita: un tocco per scegliere dove vanno i piatti che aggiungi */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-400">Uscita</span>
            <div className="flex gap-1.5">
              {PORTATA_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setCurrentPortata(opt.value)}
                  aria-pressed={currentPortata === opt.value}
                  className={`min-w-[52px] h-11 px-3 rounded-xl border font-black text-sm transition-all active:scale-95 ${
                    currentPortata === opt.value ? `${opt.color} border-current ring-2 ring-current/40` : 'bg-charcoal border-surface-light text-gray-400'
                  }`}
                >
                  {opt.label.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>

        </header>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar pb-12">
          {(() => {
            const showSub = activeCategory === 'Bevande' || (!activeCategory && filteredProducts.some(p => p.categoria === 'Bevande'));
            const gridClass = 'grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 xxl:grid-cols-5 gap-4';
            // Va dichiarata PRIMA dei return: renderProductCard (sotto) la usa, e il codice dopo un return
            // non viene mai eseguito (il minificatore lo elimina → "P is not defined" all'apertura del tavolo)
            const stockByProdotto = new Map<string, MagazzinoArticolo>(
              magazzino
                .filter((a): a is MagazzinoArticolo & { prodotto_id: string } => !!a.prodotto_id)
                .map(a => [a.prodotto_id, a]),
            );

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
              const linkedArticle = stockByProdotto.get(product.id);

              return (
                <div
                  key={product.id}
                  onClick={() => isTrulyAvailable && handleProductClick(product)}
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
                      {product.categoria}
                    </p>
                  </div>
                  <div className="flex justify-between items-end">
                    <div className="flex flex-col">
                      <span className={`text-xl font-black ${isTrulyAvailable ? 'text-white' : 'text-gray-500'}`}>€{product.prezzo.toFixed(2)}</span>
                      {linkedArticle && (
                        <span className={`text-[9px] font-black uppercase tracking-wider ${linkedArticle.quantita <= (linkedArticle.soglia_minima || 0) ? 'text-rose-400' : 'text-sky-400'}`}>
                          Frigo: {linkedArticle.quantita}{linkedArticle.target_frigo ? `/${linkedArticle.target_frigo}` : ''}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={(e) => { e.stopPropagation(); if (isTrulyAvailable) openCustomization(product); }}
                        className={`p-2 rounded-xl border transition-all active:scale-95 ${isTrulyAvailable ? 'bg-charcoal border-surface-light text-gold hover:bg-surface-light' : 'opacity-50'}`}
                      >
                        <Edit3 size={16} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); if (isTrulyAvailable) addToCart(product); }}
                        className="p-2 rounded-xl bg-gold text-black font-bold shadow-lg shadow-gold/20 active:scale-95 transition-all hover:bg-gold-hover"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            }
          })()}
        </div>
      </div>

      <aside className="w-full max-w-[450px] shrink-0 md:portrait:w-[320px] md:landscape:w-[420px] lg:landscape:w-[450px] bg-surface flex flex-col min-h-0 border-l border-surface-light shadow-2xl relative overflow-hidden">
        {/* Decor */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-gold/5 blur-3xl pointer-events-none" />

        <header className="p-4 sm:p-6 lg:p-8 border-b border-surface-light flex justify-between items-center bg-surface-light/20 relative z-10">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-charcoal rounded-xl sm:rounded-2xl flex items-center justify-center text-gold border border-surface-light shadow-xl">
              <Calculator className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <h2 className="text-lg sm:text-xl font-black text-white uppercase italic">SCONTRINO</h2>
          </div>
          <button
            onClick={() => setShowBillReview(true)}
            disabled={cart.length === 0}
            className="ml-auto mr-2 px-4 py-3 bg-charcoal border border-surface-light rounded-xl sm:rounded-2xl text-gray-200 font-bold text-sm hover:text-gold hover:border-gold/30 transition-all active:scale-95 disabled:opacity-30"
            title="Apri il riepilogo del conto"
          >
            Riepilogo
          </button>
          <button 
            onClick={clearCart}
            className="p-3 sm:p-4 bg-charcoal border border-surface-light rounded-xl sm:rounded-2xl text-gray-500 hover:text-red-500 hover:border-red-500/20 transition-all active:scale-90"
            title="Svuota carrello"
          >
            <Trash2 className="w-4.5 h-4.5 sm:w-5.5 sm:h-5.5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-6 custom-scrollbar relative z-10">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-600 opacity-50">
              <ShoppingCart className="w-16 h-16 mb-4" />
              <p className="font-black uppercase tracking-widest text-[10px]">Aggiungi prodotti</p>
            </div>
          ) : (
            <div className="space-y-3">
              {cart.map(item => (
                <div key={item.uniqueId} className={`bg-charcoal/50 border rounded-2xl p-4 flex flex-col border-l-4 ${pending.newQtyById.has(item.uniqueId) ? 'border-gold/50 border-l-gold' : 'border-surface-light border-l-surface-light'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex-1 min-w-0 pr-4">
                      <p className="font-bold text-white text-base leading-snug line-clamp-2">{item.nome}</p>
                      {pending.newQtyById.has(item.uniqueId) && (
                        <span className="inline-block mt-1 text-[10px] font-black uppercase px-1.5 py-0.5 rounded-md bg-gold text-black">
                          {pending.newQtyById.get(item.uniqueId) === item.quantity ? 'nuovo' : `+${pending.newQtyById.get(item.uniqueId)} nuovo`}
                        </span>
                      )}
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {item.addedIngredients.map(a => <span key={a.nome} className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">+{a.nome}</span>)}
                        {item.removedIngredients.map(r => <span key={r} className="text-[10px] font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded">NO {r}</span>)}
                        {item.notes && <p className="text-[10px] text-amber-500 italic w-full font-bold">* {item.notes}</p>}
                      </div>
                    </div>
                    <button onClick={() => removeEntireItem(item.uniqueId)} className="p-3 text-gray-600 hover:text-red-500 transition-colors active:scale-90">
                      <Trash2 className="w-4.5 h-4.5" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-surface-light/50">
                    <button onClick={() => editCartItem(item)} className="px-3 py-2 text-[10px] font-black uppercase text-gray-500 hover:text-white flex items-center gap-1.5 bg-charcoal rounded-xl border border-surface-light hover:border-gold/30 transition-all active:scale-90">
                      <Edit3 className="w-3.5 h-3.5" /> MODIFICA
                    </button>
                    <div className="flex items-center gap-3 bg-surface p-1.5 rounded-xl border border-surface-light shadow-lg">
                      <button onClick={() => removeFromCart(item.uniqueId)} className="w-10 h-10 flex items-center justify-center bg-charcoal hover:bg-gold/20 hover:text-gold rounded-xl text-gray-500 transition-all active:scale-90"><Minus className="w-4.5 h-4.5" /></button>
                      <span className="w-8 text-center font-black text-white text-lg">{item.quantity}</span>
                      <button onClick={() => addToCart(item)} className="w-10 h-10 flex items-center justify-center bg-charcoal hover:bg-gold/20 hover:text-gold rounded-xl text-gray-500 transition-all active:scale-90"><Plus className="w-4.5 h-4.5" /></button>
                    </div>
                    <p className="text-white font-black text-base">€{calculateItemPrice(item, ingredients).toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Total & Checkout */}
        <div className="p-3 sm:p-4 border-t border-surface-light bg-surface-light/10 relative z-10">

          <div className="flex justify-between items-end mb-1">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-[.3em]">Totale</span>
            {scontoTipo ? (
              <div className="flex flex-col items-end">
                <span className="text-sm font-black text-gray-500 line-through">€{total.toFixed(2)}</span>
                <span className="text-3xl sm:text-4xl font-black text-white italic tracking-tighter leading-none">€<span className="text-gold">{discountedTotal.toFixed(2)}</span></span>
              </div>
            ) : (
              <span className="text-3xl sm:text-4xl font-black text-white italic tracking-tighter leading-none">€<span className="text-gold">{total.toFixed(2)}</span></span>
            )}
          </div>
          <div className="flex justify-end mb-2 sm:mb-3">
            <button
              type="button"
              onClick={openDiscountModal}
              disabled={cart.length === 0}
              className="text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-gold disabled:opacity-30 disabled:pointer-events-none transition-all"
            >
              {scontoTipo ? `Sconto: ${scontoTipo === 'percentuale' ? scontoValore + '%' : '€' + scontoValore.toFixed(2)} · Modifica` : '+ Applica sconto'}
            </button>
          </div>

          {orderSuccess ? (
            <div className="w-full bg-emerald-500 text-black font-black text-base sm:text-lg py-3 sm:py-4 rounded-xl sm:rounded-2xl flex items-center justify-center gap-3 animate-in zoom-in">
              <CheckCircle className="w-4.5 h-4.5 sm:w-5 sm:h-5" /> OPERAZIONE COMPLETATA!
            </div>
          ) : (
              <div className="flex flex-col gap-1.5 sm:gap-2">
                {/* Ristampe: azioni secondarie, con conferma */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-gray-500 mr-1">Ristampa</span>
                  {(['tutto', 'cucina', 'sala'] as const).map(kind => (
                    <button
                      key={kind}
                      onClick={() => void reprint(kind)}
                      disabled={cart.length === 0 || !!printBusy}
                      className="flex-1 bg-charcoal hover:bg-surface-light text-gray-300 font-bold text-xs py-2 rounded-xl border border-surface-light transition-all active:scale-95 flex items-center justify-center gap-1 disabled:opacity-30"
                    >
                      <Printer className="w-3 h-3" /> {kind === 'tutto' ? (printBusy === 'comanda' ? '…' : 'Tutto') : kind === 'cucina' ? 'Cucina' : 'Sala'}
                    </button>
                  ))}
                </div>
                {tableId ? (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={handleUpdateBill}
                      disabled={cart.length === 0 || finishingOrder || !pending.dirty}
                      className={`w-full font-black text-sm py-3 rounded-2xl border transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-60 ${pending.dirty ? 'bg-amber-500/15 text-amber-200 border-amber-500/50 hover:bg-amber-500/25' : 'bg-surface-light text-gray-400 border-surface-light'}`}
                      title="Manda in cucina i piatti nuovi (stampa solo le aggiunte)"
                    >
                      {pending.count > 0
                        ? <>Invia · {pending.count} {pending.count === 1 ? 'nuovo' : 'nuovi'} <ChefHat size={16} /></>
                        : pending.dirty ? <>Salva modifiche <Save size={16} /></> : <>Tutto inviato <CheckCircle size={16} /></>}
                    </button>
                    <button
                      onClick={handleHoldBill}
                      disabled={cart.length === 0 || finishingOrder}
                      className="w-full bg-surface-light hover:bg-white/10 text-amber-500 font-black text-xs py-3 rounded-2xl border border-surface-light transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                      title="Metti in sospeso e libera lo schermo"
                    >
                      Metti in Sospeso <Pause size={16} />
                    </button>
                  </div>
                  <button
                    onClick={() => setPaymentChoiceOpen(true)}
                    disabled={cart.length === 0 || finishingOrder}
                    className="w-full bg-gold hover:bg-gold-hover text-black font-black text-lg py-3 rounded-2xl shadow-lg shadow-gold/20 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:grayscale"
                  >
                    {finishingOrder ? <>Attendi...</> : <>Chiudi Conto <CheckCircle size={20} /></>}
                  </button>
                </>
              ) : (
                <div className="flex flex-col gap-2">
                  <button
                    onClick={handleHoldBill}
                    disabled={cart.length === 0 || finishingOrder}
                    className="w-full bg-surface-light hover:bg-white/10 text-amber-500 font-black text-xs py-3 rounded-2xl border border-surface-light transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    Metti in Sospeso <Pause size={16} />
                  </button>
                  <button
                    onClick={() => setPaymentChoiceOpen(true)}
                    disabled={cart.length === 0 || finishingOrder}
                    className="w-full bg-gold hover:bg-gold-hover text-black font-black text-base py-3 rounded-2xl shadow-lg shadow-gold/20 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:grayscale"
                  >
                    {finishingOrder ? <>Attendi...</> : <>Chiudi Conto <CheckCircle size={20} /></>}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>

      </div>

      {/* Payment Split Modal */}
      {isSplitModalOpen && (
        <div className="fixed inset-0 z-[110] flex justify-center p-4 overflow-y-auto bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-surface border border-surface-light w-full max-w-xl my-auto rounded-[40px] shadow-2xl p-6 md:p-10">
            <div className="flex justify-between items-center mb-6">
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
                  <div className="text-[10px] opacity-60 mt-1">€{(discountedTotal / 2).toFixed(2)} a testa</div>
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
                    {splitType === 'CUSTOM' && <div className="text-[10px] opacity-60 mt-1">€{(discountedTotal / customSplitCount).toFixed(2)} a testa</div>}
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

            {/* Per piatto: ognuno paga il suo, il resto rimane sul tavolo */}
            <button
              onClick={() => { setSplitType('ITEMS'); setItemSelection({}); }}
              className={`w-full -mt-6 mb-6 p-5 rounded-3xl border-2 flex items-center gap-4 text-left transition-all ${splitType === 'ITEMS' ? 'bg-gold/10 border-gold text-gold shadow-xl' : 'bg-charcoal border-surface-light text-gray-500'}`}
            >
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${splitType === 'ITEMS' ? 'bg-gold text-black' : 'bg-surface'}`}><Receipt size={22} /></div>
              <div>
                <div className="text-xs font-black uppercase tracking-widest">Per piatto</div>
                <div className="text-[11px] opacity-70 mt-1">Ognuno paga quello che ha preso, il resto rimane sul tavolo</div>
              </div>
            </button>

            {splitType === 'ITEMS' && (() => {
              const { paid } = applyItemSplit(cart, itemSelection);
              const amount = splitAmount(paid, ingredients, discountRatio);
              const tutti = paid.reduce((n, i) => n + i.quantity, 0) === cart.reduce((n, i) => n + i.quantity, 0);
              return (
                <div className="mb-6">
                  <div className="max-h-[40vh] overflow-y-auto custom-scrollbar space-y-1.5 pr-1">
                    {cart.map(item => {
                      const sel = itemSelection[item.uniqueId] || 0;
                      const unit = calculateItemPrice({ ...item, quantity: 1 }, ingredients);
                      const setSel = (n: number) => setItemSelection(prev => ({ ...prev, [item.uniqueId]: Math.max(0, Math.min(item.quantity, n)) }));
                      return (
                        <div key={item.uniqueId} className={`flex items-center gap-3 rounded-2xl border px-3 py-2 ${sel > 0 ? 'border-gold/60 bg-gold/5' : 'border-surface-light bg-charcoal'}`}>
                          <button onClick={() => setSel(sel > 0 ? 0 : item.quantity)} className="flex-1 min-w-0 text-left">
                            <p className="font-bold text-white truncate">{item.nome}</p>
                            <p className="text-xs text-gray-400">€{unit.toFixed(2)} cad. · al tavolo {item.quantity}</p>
                          </button>
                          {item.quantity > 1 ? (
                            <div className="flex items-center bg-surface rounded-xl border border-surface-light shrink-0">
                              <button onClick={() => setSel(sel - 1)} className="w-9 h-9 flex items-center justify-center text-gray-300"><Minus size={16} /></button>
                              <span className="w-10 text-center font-black text-white tabular-nums">{sel}/{item.quantity}</span>
                              <button onClick={() => setSel(sel + 1)} className="w-9 h-9 flex items-center justify-center text-gray-300"><Plus size={16} /></button>
                            </div>
                          ) : (
                            <span className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center shrink-0 ${sel > 0 ? 'bg-gold border-gold text-black' : 'border-surface-light'}`}>{sel > 0 && <CheckCircle size={16} />}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between mt-4 mb-3">
                    <span className="text-sm text-gray-400">{paid.length === 0 ? 'Tocca i piatti di chi paga' : tutti ? 'Tutto il conto' : 'Da pagare ora'}</span>
                    <span className="text-3xl font-black text-gold tabular-nums">€{amount.toFixed(2)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => startItemPayment('cash')} disabled={paid.length === 0 || finishingOrder} className="py-4 rounded-2xl bg-gold text-black font-black active:scale-95 disabled:opacity-30">Contanti</button>
                    <button onClick={() => startItemPayment('card')} disabled={paid.length === 0 || finishingOrder} className="py-4 rounded-2xl bg-sky-500 text-white font-black flex items-center justify-center gap-2 active:scale-95 disabled:opacity-30"><CreditCard size={18} /> Carta</button>
                  </div>
                </div>
              );
            })()}

            {splitType !== 'ITEMS' && <button 
              onClick={() => {
                const parts = splitType === 'EQUAL' ? 2 : splitType === 'GUESTS' ? (tableClienti || 1) : customSplitCount;
                setSplitResult({ parts, eachAmount: discountedTotal / parts });
              }}
              disabled={splitType === 'NONE' || finishingOrder}
              className="w-full bg-gold hover:bg-gold-hover text-black font-black py-6 rounded-3xl text-xl shadow-2xl shadow-gold/20 active:scale-95 transition-all disabled:opacity-30"
            >
              PROCEDI AL PAGAMENTO DIVISO
            </button>}
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
              {splitResult.parts} quote da €{discountedTotal.toFixed(2)}
            </p>

            <div className="bg-charcoal border border-surface-light rounded-3xl p-6 mb-8">
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Importo per quota</p>
              <p className="text-5xl font-black italic text-gold">€{splitResult.eachAmount.toFixed(2)}</p>
              <p className="text-xs text-gray-500 mt-2">× {splitResult.parts} persone</p>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => openCardPayment(splitResult.parts)}
                disabled={finishingOrder}
                className="w-full bg-sky-500 hover:bg-sky-400 text-white font-black py-5 rounded-3xl text-base shadow-xl shadow-sky-500/20 active:scale-95 transition-all disabled:opacity-30 flex items-center justify-center gap-2 uppercase tracking-widest"
              >
                <CreditCard size={18} /> PAGA CON CARTA
              </button>
              <div className="flex gap-3">
                <button
                  onClick={() => setSplitResult(null)}
                  className="flex-1 bg-charcoal border border-surface-light text-gray-300 font-black py-4 rounded-2xl text-sm uppercase tracking-widest hover:bg-surface-light active:scale-95 transition-all"
                >
                  INDIETRO
                </button>
                <button
                  onClick={() => {
                    setCashPaymentAmount(splitResult.eachAmount);
                    setSplitResult(null);
                    setIsSplitModalOpen(false);
                    setCashPaymentOpen(true);
                  }}
                  disabled={finishingOrder}
                  className="flex-[2] bg-gold hover:bg-gold-hover text-black font-black py-4 rounded-2xl text-sm shadow-xl shadow-gold/20 active:scale-95 transition-all disabled:opacity-30 uppercase tracking-widest"
                >
                  CONTANTE
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Discount Modal */}
      {discountModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-surface border border-surface-light w-full max-w-sm rounded-[40px] shadow-2xl overflow-hidden p-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black italic uppercase text-white tracking-tighter">Applica <span className="text-gold">Sconto</span></h2>
              <button onClick={() => setDiscountModalOpen(false)} className="p-2 bg-charcoal rounded-xl text-gray-500 hover:text-white border border-surface-light">
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-4">
              <button
                type="button"
                onClick={() => setDiscountDraftTipo('percentuale')}
                className={`py-3 rounded-2xl border font-black text-sm uppercase tracking-widest transition-all ${
                  discountDraftTipo === 'percentuale' ? 'bg-gold border-gold text-black' : 'bg-charcoal border-surface-light text-gray-500'
                }`}
              >
                Percentuale %
              </button>
              <button
                type="button"
                onClick={() => setDiscountDraftTipo('fisso')}
                className={`py-3 rounded-2xl border font-black text-sm uppercase tracking-widest transition-all ${
                  discountDraftTipo === 'fisso' ? 'bg-gold border-gold text-black' : 'bg-charcoal border-surface-light text-gray-500'
                }`}
              >
                Importo €
              </button>
            </div>

            <div className="w-full bg-charcoal border border-surface-light rounded-2xl p-4 mb-4 text-right text-4xl font-black italic text-gold tabular-nums">
              {discountDraftValue || '0'}{discountDraftTipo === 'percentuale' ? '%' : '€'}
            </div>

            <NumericKeypad
              value={discountDraftValue}
              onChange={setDiscountDraftValue}
              allowDecimal={discountDraftTipo === 'fisso'}
              className="mb-4"
            />

            <div className="flex gap-3">
              {scontoTipo && (
                <button
                  onClick={removeDiscount}
                  className="flex-1 bg-charcoal border border-red-500/20 text-red-400 font-black py-4 rounded-2xl text-xs uppercase tracking-widest hover:bg-red-500/10 active:scale-95 transition-all"
                >
                  Rimuovi
                </button>
              )}
              <button
                onClick={applyDiscount}
                disabled={!discountDraftValue || parseFloat(discountDraftValue) <= 0}
                className="flex-[2] bg-gold hover:bg-gold-hover text-black font-black py-4 rounded-2xl text-sm shadow-xl shadow-gold/20 active:scale-95 transition-all disabled:opacity-30 uppercase tracking-widest"
              >
                Applica
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
              portata: item.portata ?? currentPortata,
              uniqueId: newUniqueId(),
            };
            setCart(prev => [...prev, item, pairedItem]);
          }
          setIsModalOpen(false);
          setEditingItem(null);
        }}
      />

      <PaninoBuilderModal
        isOpen={paninoModalOpen}
        products={products}
        currentPortata="1"
        variant="pos"
        onClose={() => setPaninoModalOpen(false)}
        onSave={addPaninoToCart}
      />
      <CustomItemModal
        isOpen={customItemModalOpen}
        currentPortata={currentPortata}
        onClose={() => setCustomItemModalOpen(false)}
        onSave={addPaninoToCart}
      />
      <BillsHistoryModal open={billsDayOpen} onClose={() => setBillsDayOpen(false)} variant="day" onSelect={resumeOrder} />
      <BillsHistoryModal
        open={billsTableOpen}
        onClose={() => setBillsTableOpen(false)}
        variant="table"
        tableName={tableName}
        onSelect={resumeOrder}
      />
      <BillsHistoryModal
        open={billsSuspendedOpen}
        onClose={() => setBillsSuspendedOpen(false)}
        variant="suspended"
        onSelect={resumeOrder}
      />
      <PaymentChoiceModal
        open={paymentChoiceOpen}
        total={discountedTotal}
        onClose={() => setPaymentChoiceOpen(false)}
        onCash={() => { setPaymentChoiceOpen(false); setCashPaymentAmount(discountedTotal); setCashPaymentOpen(true); }}
        onCard={() => { setPaymentChoiceOpen(false); openCardPayment(); }}
      />
      <CashPaymentModal
        open={cashPaymentOpen}
        total={cashPaymentAmount}
        loading={finishingOrder}
        onClose={() => { setCashPaymentOpen(false); setItemSplitPaying(null); }}
        onConfirm={() => { setCashPaymentOpen(false); if (itemSplitPaying) void finishItemSplit(); else void handleFinishOrder(); }}
      />
      <CardPaymentModal
        open={cardPaymentOpen}
        totalAmount={itemSplitPaying ? itemSplitPaying.amount : discountedTotal}
        splitParts={cardPaymentSplitParts}
        label={tableName || 'POS'}
        fiscalItems={(itemSplitPaying ? itemSplitPaying.paid : cart).map(item => ({
          nome:     item.nome,
          prezzo:   calculateItemPrice(item, ingredients),
          quantita: item.quantity,
          iva:      '10',
        }))}
        onClose={() => { setCardPaymentOpen(false); setCardPaymentSplitParts(undefined); setItemSplitPaying(null); }}
        onAllPaid={handleCardAllPaid}
      />
    </>
  );
}
