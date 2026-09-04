import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, IS_DEMO_MODE } from '../lib/supabase';
import type { Product, Ingredient, Tavolo, OrderCarrelloItem, CustomizedItem, Portata, Reservation } from '../types/entities';
import { PORTATE } from '../types/entities';
import { newUniqueId } from '../lib/id';
import { MOCK_PRODUCTS, MOCK_INGREDIENTS, MOCK_TABLES } from '../lib/MockData';
import { Plus, Minus, Save, ChevronLeft, ChevronRight, Edit3, Trash2, LogOut, Receipt, WifiOff, RefreshCw, BookOpen, X, CheckCircle2, Clock, Printer, ChefHat, CalendarClock, LayoutGrid, BarChart3, Settings, Package, ShieldCheck, AlertTriangle } from 'lucide-react';
import BillsHistoryModal from './BillsHistoryModal';
import { staffLogout, getCurrentUser } from '../lib/staffAuth';
import { printKitchenViaAgent, printSalaViaAgent, printPreContoViaAgent } from '../lib/lanPrint';
import { getPrintAgentUrl, getPrinterIp, getPrinterPort } from '../lib/printConfig';
import { syncManager } from '../lib/OfflineSync';
import { calculateItemPrice } from '../lib/priceUtils';
import ProductCustomizationModal from './ProductCustomizationModal';
import { useToast } from './Toast';
import { useConfirm } from './ConfirmModal';
import {
  addedIngredientsFromStoredOrderLine,
  calculateRemovalsPrice,
  findProductForOrderLine,
} from '../lib/orderCarrelloMap';
import SyncStatusIndicator from './SyncStatusIndicator';
import PrinterStatusBadge from './PrinterStatusBadge';
import OrderHistoryModal from './OrderHistoryModal';
import { parseAperturaFromNote, setAperturaInNote, clearAperturaInNote } from '../lib/tableUtils';
import { notifyNewOrder } from '../lib/notify';
import TableGrid from './TableGrid';
import WaiterMenuTab from './WaiterMenuTab';
import PaninoBuilderModal from './PaninoBuilderModal';
import CustomItemModal from './CustomItemModal';
import { SALE } from '../lib/salas';
import { hasTurno, toggleTurno } from '../lib/turni';
import { toLocalISODate } from '../lib/dateUtils';

export default function WaiterMobileView() {
  const navigate = useNavigate();
  const [tables, setTables] = useState<Tavolo[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [cart, setCart] = useState<CustomizedItem[]>([]);
  const [selectedTable, setSelectedTable] = useState<Tavolo | null>(null);
  const [activeRoom, setActiveRoom] = useState<string>('Principale');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [currentPortata, setCurrentPortata] = useState<Portata>('1');
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<'MENU' | 'RIEPILOGO'>('MENU');
  const [activeSection, setActiveSection] = useState<'hub' | 'sala'>('hub');

  // Customization state
  const [editingItem, setEditingItem] = useState<CustomizedItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCoversModalOpen, setIsCoversModalOpen] = useState(false);
  const [tempCovers, setTempCovers] = useState(2);

  const [billsDayOpen, setBillsDayOpen] = useState(false);
  const [billsTableOpen, setBillsTableOpen] = useState(false);
  const [orderActionBusy, setOrderActionBusy] = useState(false);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [tableApertura, setTableApertura] = useState<Record<string, string>>({});
  const [transferSource, setTransferSource] = useState<Tavolo | null>(null);
  const [transferBusy, setTransferBusy] = useState(false);
  const currentUser = getCurrentUser();
  const [tableDrafts, setTableDrafts] = useState<Record<string, { cart: CustomizedItem[]; covers: number }>>({});
  const [tableOrderCounts, setTableOrderCounts] = useState<Record<string, number>>({});
  const [paninoModalOpen, setPaninoModalOpen] = useState(false);
  const [customItemModalOpen, setCustomItemModalOpen] = useState(false);
  const [orderHistoryOpen, setOrderHistoryOpen] = useState(false);
  const [turnoModalOpen, setTurnoModalOpen] = useState(false);
  const [turnoTick, setTurnoTick] = useState(0);
  const [allergieNote, setAllergieNote] = useState('');
  const [tableAllergie, setTableAllergie] = useState<Record<string, string>>({});
  const [pullRefreshDistance, setPullRefreshDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const pullStartY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Reservation state
  const [isReservationsOpen, setIsReservationsOpen] = useState(false);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [reservationModal, setReservationModal] = useState<{ table?: Tavolo; reservation?: Reservation; open: boolean }>({ open: false });
  const [resForm, setResForm] = useState<Partial<Reservation>>({ nome: '', data: toLocalISODate(), ora: '20:00', persone: 2, note: '' });

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  const lastMenuFetchRef = useRef(0);

  useEffect(() => {
    const handleSyncChange = () => setPendingSyncCount(syncManager.getPendingCount());
    window.addEventListener('sync-status-changed', handleSyncChange);
    return () => window.removeEventListener('sync-status-changed', handleSyncChange);
  }, []);

  // Persiste allergieNote per tavolo — sopravvive a chiudi/riapri pannello
  useEffect(() => {
    if (selectedTable) {
      setTableAllergie(prev => ({ ...prev, [selectedTable.id]: allergieNote }));
    }
  }, [allergieNote, selectedTable?.id]);

  const handlePrint = async () => {
    if (cart.length === 0) return;
    const salaCats = ['Bevande', 'Dolce', 'Dolci', 'Caffè e Liquori'];
    const tableName = selectedTable?.nome || 'Tavolo';
    const isUpdate = !!activeOrderId;
    const printDeltaQty = localStorage.getItem('risto_print_delta_qty') === 'true';

    // Prima stampa: tutto il carrello. Stampe successive: solo piatti nuovi/aggiunti.
    let itemsToPrint = cart;
    if (isUpdate) {
      const deltaItems: CustomizedItem[] = [];
      for (const item of cart) {
        const key = getItemKey(item);
        const oldQty = savedItemQtysRef.current.get(key) || 0;
        if (item.quantity > oldQty) {
          const deltaQty = item.quantity - oldQty;
          deltaItems.push(printDeltaQty && oldQty > 0 ? { ...item, quantity: deltaQty } : item);
        }
      }
      itemsToPrint = deltaItems;
    }

    if (itemsToPrint.length === 0) {
      const forceReprint = await confirm({
        title: 'Nessuna novità',
        message: 'Tutti i piatti sono già stati inviati. Vuoi ristampare tutta la comanda per emergenza?',
        confirmLabel: 'Ristampa tutto',
        cancelLabel: 'Annulla',
      });
      if (!forceReprint) return;
      itemsToPrint = cart;
    }

    const cucinaItems = itemsToPrint.filter(i => !salaCats.includes(i.categoria));
    const salaItems = itemsToPrint.filter(i => salaCats.includes(i.categoria));
    try {
      const orderTime = new Date().toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      if (cucinaItems.length > 0) {
        await printKitchenViaAgent(cucinaItems, isUpdate ? `${tableName} (AGGIUNTA)` : tableName, getPrintAgentUrl(), getPrinterIp(), getPrinterPort(), orderTime, allergieNote || undefined);
      }
      if (salaItems.length > 0) {
        await printSalaViaAgent(salaItems, isUpdate ? `${tableName} (AGGIUNTA)` : tableName, getPrintAgentUrl(), getPrinterIp(), getPrinterPort());
      }
      toast.addToast({
        type: 'success',
        title: 'Comanda stampata',
        message: isUpdate ? 'Aggiunta inviata alla stampante.' : 'Cucina e sala inviate alla stampante LAN.',
        duration: 2500,
      });
      await saveOrder(true);
    } catch (error) {
      console.error('Print failed:', error);
      toast.addToast({
        type: 'error',
        title: 'Stampa non riuscita',
        message: 'Controlla print agent, IP stampante e rete LAN.',
        duration: 4500,
      });
    }
  };

  const toast = useToast();
  const { confirm } = useConfirm();

  const handlePreConto = async () => {
    if (cart.length === 0) return;
    try {
      await printPreContoViaAgent(
        cart,
        selectedTable?.nome || 'Tavolo',
        total,
        getPrintAgentUrl(),
        getPrinterIp(),
        getPrinterPort(),
        selectedTable?.clienti,
      );
      toast.addToast({ type: 'success', title: 'Pre-conto stampato', message: 'Conto non fiscale inviato alla stampante.', duration: 2500 });
    } catch {
      toast.addToast({ type: 'error', title: 'Stampa non riuscita', message: 'Controlla print agent e rete LAN.', duration: 4000 });
    }
  };
  const productsRef = useRef(products);
  const ingredientsRef = useRef(ingredients);
  const selectedTableRef = useRef(selectedTable);
  /** Flag separati per sopprimere il toast "aggiornato dalla cassa" solo per l'evento realtime
   *  generato dalla propria scrittura, evitando che un evento sulla tabella ordini consumi
   *  (o venga consumato da) un flag pensato per la tabella tavoli, o viceversa. */
  const localUpdateOrdiniRef = useRef(false);
  const localUpdateTavoliRef = useRef(false);
  const savedItemQtysRef = useRef<Map<string, number>>(new Map());

  const getItemKey = (item: CustomizedItem): string => {
    const adds = [...item.addedIngredients].map(a => a.nome).sort().join(',');
    const rems = [...item.removedIngredients].sort().join(',');
    return `${item.nome}|${item.portata || ''}|${adds}|${rems}|${item.notes}`;
  };
  productsRef.current = products;
  ingredientsRef.current = ingredients;
  selectedTableRef.current = selectedTable;

  /** Carica ordine IN_ATTESA dal DB e aggiorna carrello (anche da eventi Realtime). */
  async function loadOpenOrderForTable(table: Tavolo): Promise<boolean> {
    if (IS_DEMO_MODE || !supabase) return false;
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

    // Se nel frattempo l'utente ha selezionato un altro tavolo, non applicare questo risultato:
    // eviterebbe di popolare il carrello con i dati del tavolo sbagliato.
    if (selectedTableRef.current?.id !== table.id) return false;

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
          portata: item.portata,
          uniqueId: newUniqueId()
        };
      });
      setCart(mappedCart);
      const qtyMap = new Map<string, number>();
      for (const i of mappedCart) {
        const k = getItemKey(i);
        qtyMap.set(k, (qtyMap.get(k) || 0) + i.quantity);
      }
      savedItemQtysRef.current = qtyMap;
      setActiveTab('RIEPILOGO');
      return true;
    } else {
      setActiveOrderId(null);
      setCart([]);
      setActiveTab('MENU');
      return false;
    }
  }

  async function fetchTables() {
    if (IS_DEMO_MODE) {
      setTables(MOCK_TABLES);
      return;
    }
    const sb = supabase;
    if (!sb) return;
    const { data } = await sb.from('tavoli').select('*').order('nome', { ascending: true });
    if (data) {
      setTables(data);
      const aperturaMap: Record<string, string> = {};
      await Promise.all(data.map(async (t) => {
        if (t.status === 'OCCUPATO') {
          const fromNote = parseAperturaFromNote(t.note);
          if (fromNote) {
            aperturaMap[t.id] = fromNote;
          } else {
            // fallback: first IN_ATTESA order
            const { data: ord } = await sb
              .from('ordini')
              .select('created_at')
              .eq('nome_cliente', t.nome)
              .eq('status', 'IN_ATTESA')
              .order('created_at', { ascending: true })
              .limit(1)
              .maybeSingle();
            if (ord?.created_at) aperturaMap[t.id] = ord.created_at;
          }
        }
      }));
      setTableApertura(prev => ({ ...prev, ...aperturaMap }));

      // Conteggio piatti per tavolo (ordini IN_ATTESA)
      const { data: activeOrders } = await sb
        .from('ordini')
        .select('nome_cliente, carrello')
        .eq('status', 'IN_ATTESA');
      if (activeOrders) {
        const counts: Record<string, number> = {};
        for (const o of activeOrders as { nome_cliente: string; carrello: { quantity: number }[] }[]) {
          counts[o.nome_cliente] = (o.carrello || []).reduce((s, i) => s + (i.quantity || 1), 0);
        }
        setTableOrderCounts(counts);
      }
    }
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

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchInitialData();
    setIsRefreshing(false);
  };

  const handleTouchStartPull = (e: React.TouchEvent) => {
    if (selectedTable) return;
    pullStartY.current = e.touches[0].clientY;
  };

  const handleTouchMovePull = (e: React.TouchEvent) => {
    if (!pullStartY.current || selectedTable) return;
    const diff = e.touches[0].clientY - pullStartY.current;
    if (diff > 0) {
      setPullRefreshDistance(Math.min(diff * 0.4, 100));
    }
  };

  const handleTouchEndPull = () => {
    if (pullRefreshDistance >= 70 && !selectedTable) {
      void handleRefresh();
    }
    pullStartY.current = 0;
    setPullRefreshDistance(0);
  };

  useEffect(() => {
    void fetchInitialData();
    void fetchReservationsForDate();
    if (!supabase) return;
    const sb = supabase;
    const tablesChannel = sb.channel('public:tavoli').on('postgres_changes', { event: '*', schema: 'public', table: 'tavoli' }, () => void fetchTables()).subscribe();
    const productsChannel = sb.channel('public:prodotti-waiter').on('postgres_changes', { event: '*', schema: 'public', table: 'prodotti' }, () => void fetchProducts()).subscribe();
    const ingredientsChannel = sb.channel('public:ingredienti-waiter').on('postgres_changes', { event: '*', schema: 'public', table: 'ingredienti' }, () => void fetchIngredients()).subscribe();
    const prenotazioniChannel = sb.channel('public:prenotazioni-waiter').on('postgres_changes', { event: '*', schema: 'public', table: 'prenotazioni' }, () => void fetchReservationsForDate()).subscribe();
    const ordiniNotifyChannel = sb.channel('public:ordini-notify-waiter').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ordini' }, () => { notifyNewOrder(); void fetchTables(); }).subscribe();
    return () => {
      sb.removeChannel(tablesChannel);
      sb.removeChannel(productsChannel);
      sb.removeChannel(ingredientsChannel);
      sb.removeChannel(prenotazioniChannel);
      sb.removeChannel(ordiniNotifyChannel);
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
        (payload) => {
          if (!localUpdateOrdiniRef.current) {
            const newStatus = (payload.new as { status?: string })?.status;
            if (newStatus === 'COMPLETATO') {
              toast.addToast({
                type: 'success',
                title: 'Conto chiuso dalla cassa',
                message: `Il conto del ${t.nome} è stato chiuso dal POS`,
                duration: 4000,
              });
              setSelectedTable(null);
              return;
            }
            toast.addToast({
              type: 'info',
              title: 'Ordine aggiornato dalla cassa',
              message: payload.eventType === 'INSERT' ? 'Nuovo ordine dal POS' : 'Modifiche ricevute dal POS',
              duration: 3000,
            });
          }
          localUpdateOrdiniRef.current = false;
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
          if (!localUpdateTavoliRef.current && row.status === 'LIBERO') {
            toast.addToast({
              type: 'info',
              title: 'Tavolo liberato',
              message: `${t.nome} è stato liberato dalla cassa`,
              duration: 4000,
            });
            setSelectedTable(null);
            return;
          }
          localUpdateTavoliRef.current = false;
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
  }, [selectedTable?.id, selectedTable?.nome, selectedTable?.status, toast]);

  const saveDraft = useCallback((tableId: string, cartItems: CustomizedItem[], covers: number) => {
    if (cartItems.length > 0) {
      setTableDrafts(prev => ({ ...prev, [tableId]: { cart: cartItems, covers } }));
    }
  }, []);

  const clearDraft = useCallback((tableId: string) => {
    setTableDrafts(prev => {
      const next = { ...prev };
      delete next[tableId];
      return next;
    });
  }, []);

  const selectTable = async (table: Tavolo) => {
    setAllergieNote(tableAllergie[table.id] || '');
    const draft = tableDrafts[table.id];

    // Restore draft for any table status
    if (draft && draft.cart.length > 0) {
      setSelectedTable(table);
      setCart(draft.cart);
      setActiveOrderId(null);
      setActiveTab('RIEPILOGO');
      clearDraft(table.id);
      if (table.status === 'LIBERO') {
        const covers = draft.covers || table.clienti || 2;
        const updatedTable = { ...table, status: 'OCCUPATO' as const, clienti: covers };
        setTables(prev => prev.map(t => t.id === table.id ? updatedTable : t));
        setSelectedTable(updatedTable);
      }
      return;
    }

    if (table.status === 'LIBERO') {
      setSelectedTable(table);
      setTempCovers(2);
      setIsCoversModalOpen(true);
      return;
    }

    setSelectedTable(table);
    setCart([]);
    setActiveOrderId(null);
    (async () => {
      const hadOrder = await loadOpenOrderForTable(table);
      if (selectedTableRef.current?.id !== table.id) return;
      if (!hadOrder) {
        const copertoProd = products.find(p => p.nome === 'COPERTO') || MOCK_PRODUCTS.find(p => p.nome === 'COPERTO');
        if (copertoProd) {
          setCart([{
            ...copertoProd,
            quantity: table.clienti || 2,
            addedIngredients: [],
            removedIngredients: [],
            notes: '',
            uniqueId: 'initial-coperto'
          }]);
        }
        setActiveTab('MENU');
      }
    })();
  };

  const closeTable = async (table: Tavolo) => {
    const ok = await confirm({
      title: `Chiudi ${table.nome}`,
      message: 'Vuoi liberare il tavolo? Gli eventuali ordini in attesa verranno eliminati.',
      confirmLabel: 'Libera Tavolo',
      cancelLabel: 'Annulla',
      destructive: true,
    });
    if (!ok) return;

    if (!IS_DEMO_MODE && supabase) {
      await supabase.from('ordini').delete().eq('nome_cliente', table.nome).eq('status', 'IN_ATTESA');
    }

    const newNote = clearAperturaInNote(table.note);
    localUpdateTavoliRef.current = true;
    await syncManager.pushTableUpdate(table.id, { status: 'LIBERO', clienti: 0, note: newNote });

    setTables(prev => prev.map(t => t.id === table.id ? { ...t, status: 'LIBERO', clienti: 0, note: newNote } : t));
    setTableApertura(prev => { const n = { ...prev }; delete n[table.id]; return n; });
    setTableAllergie(prev => { const n = { ...prev }; delete n[table.id]; return n; });

    if (selectedTable?.id === table.id) {
      setSelectedTable(null);
      setCart([]);
      setActiveOrderId(null);
    }

    toast.addToast({ type: 'success', title: 'Tavolo liberato', message: `${table.nome} è stato liberato.`, duration: 2500 });
  };

  const confirmCovers = async () => {
    if (!selectedTable) return;
    
    const nowISO = new Date().toISOString();
    const newNote = setAperturaInNote(selectedTable.note, nowISO);
    
    // Update table with guests and mark as occupied
    const updatedTable = { ...selectedTable, clienti: tempCovers, status: 'OCCUPATO' as const, note: newNote };
    setTables(prev => prev.map(t => t.id === selectedTable.id ? updatedTable : t));
    setSelectedTable(updatedTable);
    setIsCoversModalOpen(false);
    setTableApertura(prev => ({ ...prev, [selectedTable.id]: nowISO }));

    localUpdateTavoliRef.current = true;
    if (!IS_DEMO_MODE) {
      await syncManager.pushTableUpdate(selectedTable.id, { clienti: tempCovers, status: 'OCCUPATO', note: newNote });
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
    setActiveTab('RIEPILOGO');
  };

  /** Trasferisce ordini aperti, bozza e coperti dal tavolo sorgente al tavolo destinazione. */
  const handleTransferTable = async (from: Tavolo, to: Tavolo) => {
    if (to.status !== 'LIBERO') {
      toast.addToast({ type: 'error', title: 'Trasferimento non riuscito', message: `${to.nome} non è libero`, duration: 3000 });
      return;
    }
    setTransferBusy(true);
    try {
      let movedOrders = 0;
      if (!IS_DEMO_MODE && supabase) {
        const { data: orders } = await supabase
          .from('ordini')
          .select('id')
          .eq('nome_cliente', from.nome)
          .eq('status', 'IN_ATTESA');
        localUpdateOrdiniRef.current = true;
        localUpdateTavoliRef.current = true;
        if (orders && orders.length > 0) {
          for (const order of orders) {
            await syncManager.pushOrder({ id: order.id, nome_cliente: to.nome });
          }
          movedOrders = orders.length;
        }
        const apertura = tableApertura[from.id] || parseAperturaFromNote(from.note);
        await syncManager.pushTableUpdate(from.id, { status: 'LIBERO', clienti: 0, note: clearAperturaInNote(from.note) });
        await syncManager.pushTableUpdate(to.id, {
          status: 'OCCUPATO',
          clienti: from.clienti || 2,
          note: apertura ? setAperturaInNote(to.note, apertura) : to.note,
        });
      }

      const apertura = tableApertura[from.id] || parseAperturaFromNote(from.note);
      setTables(prev => prev.map(t => {
        if (t.id === from.id) return { ...t, status: 'LIBERO' as const, clienti: 0, note: clearAperturaInNote(t.note) };
        if (t.id === to.id) return { ...t, status: 'OCCUPATO' as const, clienti: from.clienti || 2, note: apertura ? setAperturaInNote(t.note, apertura) : t.note };
        return t;
      }));
      setTableApertura(prev => {
        const next = { ...prev };
        delete next[from.id];
        if (apertura) next[to.id] = apertura;
        return next;
      });
      setTableDrafts(prev => {
        const next = { ...prev };
        if (next[from.id]) {
          next[to.id] = next[from.id];
          delete next[from.id];
        }
        return next;
      });
      if (selectedTable?.id === from.id) {
        setSelectedTable(null);
        setCart([]);
        setActiveOrderId(null);
      }
      toast.addToast({
        type: 'success',
        title: 'Tavolo trasferito',
        message: `${from.nome} → ${to.nome}${movedOrders > 0 ? ` (${movedOrders} ordine${movedOrders > 1 ? 'i' : ''} spostati)` : ''}`,
        duration: 3500,
      });
    } catch (error) {
      console.error('Transfer failed:', error);
      toast.addToast({ type: 'error', title: 'Trasferimento non riuscito', message: 'Controlla la connessione e riprova', duration: 4000 });
    } finally {
      localUpdateOrdiniRef.current = false;
      localUpdateTavoliRef.current = false;
      setTransferSource(null);
      setTransferBusy(false);
    }
  };

  const addToCart = (product: Product) => {
    const now = Date.now();
    if (now - lastMenuFetchRef.current > 15_000) {
      lastMenuFetchRef.current = now;
      void fetchProducts();
      void fetchIngredients();
    }
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
        newCart[existingIdx] = { ...newCart[existingIdx], quantity: newCart[existingIdx].quantity + 1 };
        return newCart;
      }
      return [...prev, { ...product, quantity: 1, addedIngredients: [], removedIngredients: [], notes: '', uniqueId: newUniqueId(), portata: currentPortata }];
    });
  };

  const openCustomization = (product: Product) => {
    setEditingItem({
      ...product,
      quantity: 1,
      addedIngredients: [],
      removedIngredients: [],
      notes: '',
      uniqueId: newUniqueId(),
      portata: currentPortata
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
    setCart(prev => prev.filter(i => i.uniqueId !== uniqueId));
  };

  const addPaninoToCart = (item: CustomizedItem) => {
    setCart(prev => [...prev, item]);
  };

  const total = useMemo(
    () => cart.reduce((sum, item) => sum + calculateItemPrice(item, ingredients), 0),
    [cart, ingredients]
  );

  const saveOrder = async (skipPrint = false) => {
    if (!selectedTable || cart.length === 0 || orderActionBusy) return;
    
    if (IS_DEMO_MODE) {
      toast.addToast({ type: 'info', title: 'Demo', message: 'Comanda simulata (Modalità Demo)' });
      if (selectedTable) clearDraft(selectedTable.id);
      setCart([]);
      setSelectedTable(null);
      return;
    }

    localUpdateOrdiniRef.current = true;
    setOrderActionBusy(true);

    const isUpdate = !!activeOrderId;
    const printDeltaQty = localStorage.getItem('risto_print_delta_qty') === 'true';

    let printItems: CustomizedItem[] = [];
    if (isUpdate) {
      const seen = new Map<string, number>();
      for (const item of cart) {
        const key = getItemKey(item);
        const oldQty = savedItemQtysRef.current.get(key) || 0;
        seen.set(key, (seen.get(key) || 0) + item.quantity);
        if (item.quantity > oldQty) {
          const deltaQty = item.quantity - oldQty;
          if (printDeltaQty && oldQty > 0) {
            printItems.push({ ...item, quantity: deltaQty });
          } else if (oldQty === 0) {
            printItems.push(item);
          }
        }
      }
    }

    try {
      const orderData = {
        nome_cliente: selectedTable.nome,
        orario_ritiro: new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
        totale: total,
        status: 'IN_ATTESA' as const,
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
            portata: item.portata,
            modifiche: {
              aggiunte: item.addedIngredients.map(a => a.nome),
              rimozioni: item.removedIngredients,
              note: item.notes
            }
          };
        }),
      };

      if (isUpdate) {
        await syncManager.pushOrder({ ...orderData, id: activeOrderId });
      } else {
        const nowISO = new Date().toISOString();
        await syncManager.pushOrder(orderData);
        localUpdateTavoliRef.current = true;
        const newNote = setAperturaInNote(selectedTable.note, nowISO);
        await syncManager.pushTableUpdate(selectedTable.id, { status: 'OCCUPATO', note: newNote });
        setTableApertura(prev => ({ ...prev, [selectedTable.id]: nowISO }));
        setTables(prev => prev.map(t => t.id === selectedTable.id ? { ...t, note: newNote } : t));
        setSelectedTable(prev => prev ? { ...prev, note: newNote } : prev);
      }

      const newMap = new Map<string, number>();
      for (const item of cart) {
        const key = getItemKey(item);
        newMap.set(key, (newMap.get(key) || 0) + item.quantity);
      }
      savedItemQtysRef.current = newMap;

      if (!skipPrint && printItems.length > 0) {
        const orderTime = new Date().toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        const salaCats = ['Bevande', 'Dolce', 'Dolci', 'Caffè e Liquori'];
        const cucinaItems = printItems.filter(i => !salaCats.includes(i.categoria));
        const salaItems = printItems.filter(i => salaCats.includes(i.categoria));
        if (cucinaItems.length > 0) {
          await printKitchenViaAgent(cucinaItems, `${selectedTable.nome} (AGGIUNTA)`, getPrintAgentUrl(), getPrinterIp(), getPrinterPort(), orderTime).catch(() => {});
        }
        if (salaItems.length > 0) {
          await printSalaViaAgent(salaItems, `${selectedTable.nome} (AGGIUNTA)`, getPrintAgentUrl(), getPrinterIp(), getPrinterPort()).catch(() => {});
        }
      }

      clearDraft(selectedTable.id);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch {
      localUpdateOrdiniRef.current = false;
      localUpdateTavoliRef.current = false;
      toast.addToast({ type: 'error', title: 'Errore', message: 'Salvataggio comanda fallito' });
    } finally {
      setOrderActionBusy(false);
    }
  };

  // --- Reservation functions ---

  async function fetchReservationsForDate() {
    if (IS_DEMO_MODE || !supabase) return;
    const today = toLocalISODate();
    const { data } = await supabase
      .from('prenotazioni')
      .select('*')
      .eq('data', today)
      .in('status', ['CONFERMATA', 'ARRIVATA'])
      .order('ora', { ascending: true });
    if (data) setReservations(data);
  }

  async function handleCheckIn(res: Reservation) {
    if (!supabase) return;
    await supabase.from('prenotazioni').update({ status: 'ARRIVATA' }).eq('id', res.id);
    if (res.tavolo_id) {
      await supabase.from('tavoli').update({ status: 'OCCUPATO', clienti: res.persone }).eq('id', res.tavolo_id);
    }
    void fetchReservationsForDate();
    void fetchTables();
  }

  function openNewReservationModal() {
    setResForm({ nome: '', data: toLocalISODate(), ora: '20:00', persone: 2, note: '' });
    setReservationModal({ open: true, reservation: undefined });
  }

  async function handleSaveReservation() {
    if (!supabase || !resForm.nome || !resForm.data || !resForm.ora) return;
    const payload = { ...resForm };
    if (!payload.tavolo_id) delete payload.tavolo_id;
    if (reservationModal.reservation) {
      const oldRes = reservationModal.reservation;
      await supabase.from('prenotazioni').update(payload).eq('id', oldRes.id);
      if (oldRes.tavolo_id && oldRes.tavolo_id !== payload.tavolo_id) {
        await supabase.from('tavoli').update({ status: 'LIBERO', clienti: 0 }).eq('id', oldRes.tavolo_id);
      }
      if (payload.tavolo_id && oldRes.tavolo_id !== payload.tavolo_id) {
        await supabase.from('tavoli').update({ status: 'PRENOTATO', clienti: resForm.persone }).eq('id', payload.tavolo_id);
      }
    } else {
      await supabase.from('prenotazioni').insert([payload]);
      if (payload.tavolo_id) {
        await supabase.from('tavoli').update({ status: 'PRENOTATO', clienti: resForm.persone }).eq('id', payload.tavolo_id);
      }
    }
    setReservationModal({ open: false });
    void fetchReservationsForDate();
    void fetchTables();
  }

  async function handleDeleteReservation() {
    if (!supabase || !reservationModal.reservation) return;
    const ok = await confirm({ title: 'Elimina prenotazione', message: `Eliminare la prenotazione per ${reservationModal.reservation.nome}?`, destructive: true });
    if (!ok) return;
    await supabase.from('prenotazioni').delete().eq('id', reservationModal.reservation.id);
    if (reservationModal.reservation.tavolo_id) {
      await supabase.from('tavoli').update({ status: 'LIBERO', clienti: 0 }).eq('id', reservationModal.reservation.tavolo_id);
    }
    setReservationModal({ open: false });
    void fetchReservationsForDate();
    void fetchTables();
  }

  async function handleDeleteReservationById(res: Reservation) {
    if (!supabase) return;
    const ok = await confirm({ title: 'Elimina prenotazione', message: `Eliminare la prenotazione per ${res.nome}?`, destructive: true });
    if (!ok) return;
    await supabase.from('prenotazioni').delete().eq('id', res.id);
    if (res.tavolo_id) {
      await supabase.from('tavoli').update({ status: 'LIBERO', clienti: 0 }).eq('id', res.tavolo_id);
    }
    void fetchReservationsForDate();
    void fetchTables();
  }

  if (loading) return (
    <div className="min-h-screen bg-charcoal flex items-center justify-center">
      <div className="relative">
        <div className="w-12 h-12 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-2 h-2 bg-gold rounded-full animate-pulse" />
        </div>
      </div>
    </div>
  );

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStartPull}
      onTouchMove={handleTouchMovePull}
      onTouchEnd={handleTouchEndPull}
      className="h-dvh overflow-hidden bg-charcoal text-white font-sans flex flex-col max-w-2xl mx-auto relative border-x border-surface"
    >
      
      {/* Pull-to-refresh indicator */}
      {pullRefreshDistance > 0 && !selectedTable && (
        <div
          className="absolute top-0 left-0 right-0 z-50 flex items-center justify-center bg-charcoal/90 backdrop-blur-sm border-b border-surface-light transition-all duration-100"
          style={{ height: pullRefreshDistance, transform: `translateY(0)` }}
        >
          <div className="flex items-center gap-3">
            {isRefreshing ? (
              <div className="w-5 h-5 border-2 border-gold border-t-transparent rounded-full animate-spin" />
            ) : (
              <RefreshCw
                size={18}
                className="text-gold transition-transform duration-200"
                style={{ transform: `rotate(${pullRefreshDistance * 3}deg)` }}
              />
            )}
            <span className="text-[10px] font-black uppercase tracking-widest text-gold">
              {isRefreshing ? 'AGGIORNAMENTO...' : 'RILASCIA PER AGGIORNARE'}
            </span>
          </div>
        </div>
      )}
      
      {!selectedTable ? (
        activeSection === 'hub' ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-6 pb-4 shrink-0">
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-3xl font-black italic text-gold uppercase tracking-tighter">
                    {currentUser ? `Ciao, ${currentUser.name}` : 'Il Girasole'}
                  </h1>
                  {currentUser && (
                    <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mt-0.5">{currentUser.role}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <PrinterStatusBadge />
                  {pendingSyncCount > 0 && (
                    <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-500 text-[9px] font-black uppercase tracking-wider animate-pulse">
                      <WifiOff size={10} /> {pendingSyncCount}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await confirm({ title: 'Uscita', message: 'Uscire? Dovrai reinserire il PIN.' });
                      if (ok) staffLogout();
                    }}
                    className="p-2 bg-surface rounded-xl text-gray-500 hover:text-red-400 transition-colors"
                    title="Esci staff"
                  >
                    <LogOut size={20} />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-3 custom-scrollbar">
              <HubCard
                icon={<LayoutGrid size={24} />}
                title="Sala & Tavoli"
                desc="Gestisci i tavoli e prendi le comande"
                accent="bg-gold/10 text-gold"
                onClick={() => setActiveSection('sala')}
              />
              <HubCard
                icon={<BookOpen size={24} />}
                title="Prenotazioni"
                desc="Libro prenotazioni di oggi"
                accent="bg-amber-500/10 text-amber-400"
                onClick={() => setIsReservationsOpen(true)}
              />
              {currentUser && (
                <HubCard
                  icon={<CalendarClock size={24} />}
                  title="Il mio turno"
                  desc="Segna pranzo e/o sera"
                  accent="bg-emerald-500/10 text-emerald-400"
                  onClick={() => setTurnoModalOpen(true)}
                />
              )}
              {(!currentUser || currentUser.role === 'admin' || currentUser.role === 'kitchen') && (
                <>
                  <HubCard
                    icon={<ChefHat size={24} />}
                    title="Cucina"
                    desc="Disponibilità piatti e menu"
                    accent="bg-sky-500/10 text-sky-400"
                    onClick={() => navigate('/kitchen')}
                  />
                  <HubCard
                    icon={<Package size={24} />}
                    title="Magazzino"
                    desc="Scorte e carico/scarico"
                    accent="bg-orange-500/10 text-orange-400"
                    onClick={() => navigate('/magazzino')}
                  />
                  <HubCard
                    icon={<ShieldCheck size={24} />}
                    title="HACCP"
                    desc="Etichette & tracciabilità"
                    accent="bg-emerald-600/10 text-emerald-400"
                    onClick={() => navigate('/haccp')}
                  />
                </>
              )}
              {(!currentUser || currentUser.role === 'admin') && (
                <>
                  <HubCard
                    icon={<BarChart3 size={24} />}
                    title="Report"
                    desc="Incassi e statistiche"
                    accent="bg-fuchsia-500/10 text-fuchsia-400"
                    onClick={() => navigate('/reports')}
                  />
                  <HubCard
                    icon={<Settings size={24} />}
                    title="Impostazioni"
                    desc="Configurazione del locale"
                    accent="bg-gray-500/10 text-gray-400"
                    onClick={() => navigate('/settings')}
                  />
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-6 pb-2 space-y-4">
              <div className="flex items-center gap-3">
                <button onClick={() => setActiveSection('hub')} className="p-2 bg-surface rounded-xl text-gray-400 active:scale-90 shrink-0">
                  <ChevronLeft size={20} />
                </button>
                <h1 className="text-2xl font-black italic text-gold uppercase tracking-tighter leading-none">Sala & Tavoli</h1>
              </div>

              {/* Room Slider */}
              <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
                {SALE.map(room => (
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

            <TableGrid
              tables={tables}
              activeRoom={activeRoom}
              selectedTable={selectedTable}
              now={now}
              tableApertura={tableApertura}
              tableOrderCounts={tableOrderCounts}
              onSelectTable={selectTable}
              onTransferTable={(table) => {
                if (table.status === 'OCCUPATO' || table.status === 'PRENOTATO') {
                  setTransferSource(table);
                } else {
                  toast.addToast({ type: 'info', title: 'Trasferimento Tavolo', message: `${table.nome} non ha un conto aperto`, duration: 3000 });
                }
              }}
              onCloseTable={closeTable}
              onPreConto={async (table) => {
                if (selectedTable?.id !== table.id || cart.length === 0) {
                  toast.addToast({ type: 'info', title: 'Apri il tavolo', message: 'Apri prima il tavolo per stampare il pre-conto.', duration: 3000 });
                  return;
                }
                await handlePreConto();
              }}
            />
          </div>
        )
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header Mobile */}
          <div className="p-4 bg-surface border-b border-surface-light flex items-center justify-between shrink-0">
            <button onClick={() => { if (selectedTable && cart.length > 0) saveDraft(selectedTable.id, cart, selectedTable.clienti || 2); setSelectedTable(null); }} className="p-2 bg-charcoal rounded-xl text-gray-400 active:scale-90"><ChevronLeft /></button>
            <div className="flex flex-col items-center">
              <h2 className="text-xl font-black italic uppercase text-white leading-none">{selectedTable.nome}</h2>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-[9px] font-black text-gold uppercase tracking-[0.2em]">Coperti: {selectedTable.clienti}</span>
                {selectedTable.status === 'OCCUPATO' && tableApertura[selectedTable.id] && (
                  <span className="flex items-center gap-1 text-[9px] font-black text-amber-400 uppercase tracking-[0.2em]">
                    <Clock size={10} /> {(() => {
                      const diff = now - new Date(tableApertura[selectedTable.id]).getTime();
                      const mins = Math.floor(diff / 60000);
                      if (mins < 1) return 'Ora';
                      if (mins < 60) return `${mins}min`;
                      return `${Math.floor(mins / 60)}h ${mins % 60}min`;
                    })()}
                  </span>
                )}
                <SyncStatusIndicator compact />
              </div>
            </div>
            <div className="w-10" />
            </div>

          {/* Tab Switcher */}
          <div className="flex p-3 bg-charcoal shrink-0">
            <button 
              onClick={() => setActiveTab('RIEPILOGO')}
              className={`flex-1 py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all ${activeTab === 'RIEPILOGO' ? 'bg-surface text-gold border border-surface-light shadow-xl' : 'text-gray-500'}`}
            >
              Riepilogo
            </button>
            <button 
              onClick={() => setActiveTab('MENU')}
              className={`flex-1 py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all ${activeTab === 'MENU' ? 'bg-surface text-gold border border-surface-light shadow-xl' : 'text-gray-500'}`}
            >
              Menu
            </button>
          </div>

          {activeTab === 'MENU' ? (
            <WaiterMenuTab
              products={products}
              ingredients={ingredients}
              cart={cart}
              searchQuery={searchQuery}
              activeCategory={activeCategory}
              currentPortata={currentPortata}
              onSearchChange={setSearchQuery}
              onCategoryChange={setActiveCategory}
              onPortataChange={setCurrentPortata}
              onAddToCart={addToCart}
              onOpenCustomization={openCustomization}
              onOpenPaninoBuilder={() => setPaninoModalOpen(true)}
              onOpenCustomItem={() => setCustomItemModalOpen(true)}
            />
          ) : (
            <div className="flex-1 overflow-y-auto pb-44">
              <div className="bg-surface/80 backdrop-blur-xl border-b border-surface-light px-5 py-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Totale</p>
                    <p className="text-4xl font-black text-gold italic">€{total.toFixed(2)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => setBillsDayOpen(true)} className="px-3 py-2 bg-charcoal rounded-xl border border-surface-light text-[10px] font-black uppercase text-gray-400 hover:text-gold active:scale-90">
                      <Receipt size={14} className="inline mr-1" /> Oggi
                    </button>
                    {selectedTable && (
                      <button type="button" onClick={() => setBillsTableOpen(true)} className="px-3 py-2 bg-charcoal rounded-xl border border-surface-light text-[10px] font-black uppercase text-gray-400 hover:text-gold active:scale-90">
                        <Receipt size={14} className="inline mr-1" /> Storico
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-sm font-bold text-white">{selectedTable?.nome} · {selectedTable?.clienti} coperti</span>
                  <span className="text-[10px] font-black text-gray-500 uppercase">{activeOrderId ? 'Servizio in corso' : 'Occupato'}</span>
                </div>
              </div>

              <div className="p-5 space-y-6">
                {/* Allergie / avviso cucina */}
                <div className={`rounded-2xl border px-4 py-3 flex items-start gap-3 transition-colors ${allergieNote ? 'bg-red-500/10 border-red-500/40' : 'bg-charcoal border-surface-light'}`}>
                  <AlertTriangle size={16} className={`mt-0.5 flex-shrink-0 ${allergieNote ? 'text-red-400' : 'text-gray-600'}`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${allergieNote ? 'text-red-400' : 'text-gray-600'}`}>Allergie / Avviso Cucina</p>
                    <input
                      type="text"
                      value={allergieNote}
                      onChange={e => setAllergieNote(e.target.value)}
                      placeholder="es. NOCI, GLUTINE, LACTOSIO..."
                      className="w-full bg-transparent text-sm font-bold text-white placeholder-gray-700 outline-none"
                    />
                  </div>
                  {allergieNote && (
                    <button onClick={() => setAllergieNote('')} className="text-gray-600 hover:text-white transition-colors">
                      <X size={14} />
                    </button>
                  )}
                </div>
                {cart.length === 0 ? (
                  <div className="py-16 text-center">
                    <p className="text-gray-600 text-base font-bold">Nessun articolo</p>
                    <p className="text-gray-600/50 text-sm mt-1">Aggiungi prodotti dal menu</p>
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
                      const groupCount = items.reduce((s, i) => s + i.quantity, 0);
                      return (
                        <div key={portataKey}>
                          <div className={`flex items-center justify-between mb-3 px-3 py-2 rounded-2xl border ${portataInfo?.color || 'border-surface-light bg-charcoal'}`}>
                            <span className="font-black text-sm uppercase tracking-wider">{portataInfo?.label || 'SENZA USCITA'}</span>
                            <div className="flex items-center gap-2.5">
                              <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">{groupCount} {groupCount === 1 ? 'piatto' : 'piatti'}</span>
                              <span className="font-black text-sm opacity-80">€{groupTotal.toFixed(2)}</span>
                            </div>
                          </div>
                          <div className="space-y-2 pl-2">
                            {items.map(item => (
                              <SwipeableCartItem key={item.uniqueId} item={item} onRemove={removeFromCart} onEdit={editCartItem} onSetCart={setCart} />
                            ))}
                          </div>
                        </div>
                      );
                    });
                  })()
                )}

                <button 
                  onClick={() => setActiveTab('MENU')}
                  className="w-full bg-surface border-2 border-dashed border-gold/40 text-gold py-5 rounded-3xl font-black uppercase text-sm tracking-widest flex items-center justify-center gap-3 active:scale-95 transition-all"
                >
                  <Plus size={20} /> AGGIUNGI ALTRI PIATTI
                </button>
              </div>
            </div>
          )}

          {/* Sticky Footer Action Bar */}
          <div className="absolute bottom-0 left-0 right-0 p-4 pb-3 bg-surface/90 backdrop-blur-xl border-t border-white/5 z-40">
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={handlePrint}
                disabled={cart.length === 0}
                className="py-3 rounded-xl border border-surface-light bg-charcoal font-black text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-1.5 transition-all active:scale-95 text-amber-400 hover:bg-surface-light disabled:opacity-30"
              >
                <Printer size={14} /> STAMPA
              </button>
              <button
                onClick={() => saveOrder()}
                disabled={cart.length === 0 || orderActionBusy}
                className={`py-3 rounded-xl border font-black text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-1.5 transition-all active:scale-95 ${
                  success
                    ? 'bg-emerald-500 border-emerald-500 text-black'
                    : 'bg-surface-light border-white/10 text-white hover:bg-white/10 shadow-xl'
                } disabled:opacity-30`}
              >
                {orderActionBusy ? 'INVIO...' : success ? 'INVIATO!' : <><Save size={16} /> AGGIORNA</>}
              </button>
            </div>
            {IS_DEMO_MODE && (
               <div className="mt-2 text-center">
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
            
            <div className="flex items-center justify-between bg-charcoal border border-surface-light rounded-3xl p-4 mb-4">
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
              onClick={() => { setOrderHistoryOpen(true); }}
              className="w-full mt-3 bg-charcoal border border-white/10 text-gray-400 font-bold py-3 rounded-2xl text-xs uppercase tracking-widest hover:text-white hover:border-white/20 active:scale-95 transition-all"
            >
              <Clock size={14} className="inline mr-2" />STORICO ORDINI
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

      {transferSource && (
        <div className="fixed inset-0 z-[130] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/90 backdrop-blur-xl animate-in fade-in duration-200">
          <div className="bg-surface border border-surface-light w-full sm:max-w-md max-h-[85vh] flex flex-col rounded-t-[32px] sm:rounded-[32px] shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-surface-light shrink-0">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-xl font-black italic uppercase text-white">Trasferisci Tavolo</h2>
                <button onClick={() => setTransferSource(null)} className="p-2 bg-charcoal rounded-xl text-gray-400 active:scale-90">
                  <X size={18} />
                </button>
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-400">
                Da {transferSource.nome} · {transferSource.clienti || 0} coperti
              </p>
              <p className="text-[10px] text-gray-500 font-bold mt-1">
                Ordini aperti, bozza e orario di apertura verranno spostati sul tavolo selezionato.
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
              {transferBusy ? (
                <div className="flex items-center justify-center py-16 text-gray-500 font-black text-xs uppercase tracking-widest animate-pulse">
                  Trasferimento in corso...
                </div>
              ) : (
                SALE.map(room => {
                  const roomTables = tables.filter(t => {
                    const sala = (t.sala || 'Principale').toUpperCase();
                    const normalized = sala === 'SALA' ? 'PRINCIPALE' : sala;
                    return normalized === room.toUpperCase() && t.id !== transferSource.id;
                  });
                  if (roomTables.length === 0) return null;
                  return (
                    <div key={room}>
                      <p className="text-[10px] font-black uppercase tracking-[0.25em] text-gray-600 mb-2 px-1">{room}</p>
                      <div className="grid grid-cols-2 gap-2">
                        {roomTables.map(t => {
                          const isFree = t.status === 'LIBERO';
                          return (
                            <button
                              key={t.id}
                              disabled={!isFree}
                              onClick={() => void handleTransferTable(transferSource, t)}
                              className={`rounded-2xl border-2 p-3 text-left transition-all flex flex-col gap-1.5 ${
                                isFree
                                  ? 'border-green-500/40 bg-green-500/5 hover:bg-green-500/15 active:scale-95'
                                  : 'border-surface-light bg-charcoal/50 opacity-40 cursor-not-allowed'
                              }`}
                            >
                              <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border self-start ${
                                isFree ? 'border-green-500/40 text-green-400' : 'border-surface-light text-gray-600'
                              }`}>
                                {t.status === 'LIBERO' ? 'Libero' : t.status}
                              </span>
                              <span className="text-lg font-black text-white leading-none">{t.nome}</span>
                              <span className="text-[10px] font-bold text-gray-500">{t.clienti || 0} coperti</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-4 border-t border-surface-light shrink-0">
              <button
                onClick={() => setTransferSource(null)}
                disabled={transferBusy}
                className="w-full py-4 rounded-2xl bg-charcoal border border-surface-light text-gray-400 font-black text-xs uppercase tracking-widest hover:text-white active:scale-95 disabled:opacity-30"
              >
                ANNULLA
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
        variant="mobile"
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
               portata: item.portata ?? currentPortata,
             };
             setCart(prev => [...prev, item, pairedItem]);
           }
           setIsModalOpen(false);
           setEditingItem(null);
         }}
      />

      <BillsHistoryModal open={billsDayOpen} onClose={() => setBillsDayOpen(false)} variant="day" />
      <BillsHistoryModal
        open={billsTableOpen}
        onClose={() => setBillsTableOpen(false)}
        variant="table"
        tableName={selectedTable?.nome}
      />

      <OrderHistoryModal
        isOpen={orderHistoryOpen}
        onClose={() => setOrderHistoryOpen(false)}
        tableName={selectedTable?.nome || ''}
      />

      <PaninoBuilderModal
        isOpen={paninoModalOpen}
        products={products}
        currentPortata={currentPortata}
        onClose={() => setPaninoModalOpen(false)}
        onSave={addPaninoToCart}
      />

      <CustomItemModal
        isOpen={customItemModalOpen}
        currentPortata={currentPortata}
        onClose={() => setCustomItemModalOpen(false)}
        onSave={addPaninoToCart}
      />

      {/* Turno Modal (marcatura pranzo/sera propria) */}
      {turnoModalOpen && currentUser && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-surface border border-surface-light w-full max-w-sm rounded-[32px] shadow-2xl p-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black italic uppercase text-white">Il tuo <span className="text-gold">Turno</span></h2>
              <button onClick={() => setTurnoModalOpen(false)} className="p-2 bg-charcoal rounded-xl text-gray-500 hover:text-white border border-surface-light">
                <X size={18} />
              </button>
            </div>
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-5">
              {currentUser.name} · {new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            <div key={turnoTick} className="grid grid-cols-2 gap-3">
              <button
                onClick={() => { toggleTurno(currentUser.id, toLocalISODate(), 'pranzo'); setTurnoTick(t => t + 1); }}
                className={`py-6 rounded-2xl border-2 font-black text-sm uppercase tracking-widest transition-all active:scale-95 ${
                  hasTurno(currentUser.id, toLocalISODate(), 'pranzo') ? 'bg-gold border-gold text-black' : 'bg-charcoal border-surface-light text-gray-500'
                }`}
              >
                Pranzo
              </button>
              <button
                onClick={() => { toggleTurno(currentUser.id, toLocalISODate(), 'sera'); setTurnoTick(t => t + 1); }}
                className={`py-6 rounded-2xl border-2 font-black text-sm uppercase tracking-widest transition-all active:scale-95 ${
                  hasTurno(currentUser.id, toLocalISODate(), 'sera') ? 'bg-gold border-gold text-black' : 'bg-charcoal border-surface-light text-gray-500'
                }`}
              >
                Sera
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reservation Create/Edit Modal */}
      {reservationModal.open && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl animate-in zoom-in duration-200">
          <div className="bg-surface border border-surface-light w-full max-w-sm rounded-[32px] shadow-2xl overflow-hidden">
            <div className="p-5">
              <div className="flex justify-between items-center mb-5">
                <div>
                  <h2 className="text-lg font-black italic uppercase tracking-tighter text-white">{reservationModal.reservation ? 'Modifica' : 'Nuova'} <span className="text-gold">Prenotazione</span></h2>
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mt-0.5">
                    {reservationModal.table ? `Tavolo: ${reservationModal.table.nome}` : 'Nessun tavolo assegnato'}
                  </p>
                </div>
                <button onClick={() => setReservationModal({ open: false })} className="p-2 bg-charcoal rounded-xl text-gray-500 hover:text-white border border-surface-light">
                  <X size={18} />
                </button>
              </div>
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Nome Cliente</label>
                  <input type="text" placeholder="es. Mario Rossi" value={resForm.nome} onChange={e => setResForm({...resForm, nome: e.target.value})} className="w-full bg-charcoal border border-surface-light rounded-xl p-3 text-sm text-white font-bold outline-none focus:border-gold transition-all" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Data</label>
                    <input type="date" value={resForm.data} onChange={e => setResForm({...resForm, data: e.target.value})} className="w-full bg-charcoal border border-surface-light rounded-xl p-3 text-sm text-white font-bold outline-none focus:border-gold transition-all" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Ora</label>
                    <input type="time" value={resForm.ora} onChange={e => setResForm({...resForm, ora: e.target.value})} className="w-full bg-charcoal border border-surface-light rounded-xl p-3 text-sm text-white font-bold outline-none focus:border-gold transition-all" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Persone</label>
                  <div className="flex items-center justify-between bg-charcoal border border-surface-light rounded-xl p-1.5 px-3">
                    <button onClick={() => setResForm({...resForm, persone: Math.max(1, (resForm.persone || 2) - 1)})} className="w-8 h-8 bg-surface rounded-lg text-gold active:scale-90 text-sm">-</button>
                    <span className="text-xl font-black text-white">{resForm.persone}</span>
                    <button onClick={() => setResForm({...resForm, persone: (resForm.persone || 2) + 1})} className="w-8 h-8 bg-surface rounded-lg text-gold active:scale-90 text-sm">+</button>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Assegna Tavolo (Opzionale)</label>
                  <select
                    value={resForm.tavolo_id || ''}
                    onChange={e => setResForm({...resForm, tavolo_id: e.target.value || undefined})}
                    className="w-full bg-charcoal border border-surface-light rounded-xl p-3 text-sm text-white font-bold outline-none focus:border-gold transition-all appearance-none"
                  >
                    <option value="">Nessun tavolo</option>
                    {tables.map(t => (
                      <option key={t.id} value={t.id}>{t.nome} ({t.sala})</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                </div>
                <div className="grid gap-2 mt-4">
                  <button onClick={handleSaveReservation} className="w-full bg-gold text-black font-black py-4 rounded-xl text-base shadow-xl active:scale-95 transition-all">
                    {reservationModal.reservation ? 'SALVA MODIFICHE' : 'CONFERMA PRENOTAZIONE'}
                  </button>
                  {reservationModal.reservation && (
                    <button onClick={handleDeleteReservation} className="w-full bg-red-500/10 text-red-500 font-black py-2.5 rounded-xl text-[10px] uppercase tracking-widest">
                      ELIMINA PRENOTAZIONE
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reservations Modal */}
      {isReservationsOpen && (
        <div className="fixed inset-0 z-[130] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/95 backdrop-blur-2xl animate-in fade-in duration-300">
          <div className="bg-surface border border-surface-light w-full sm:max-w-xl rounded-t-[32px] sm:rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-surface-light flex justify-between items-center bg-surface-light/5">
              <div>
                <h2 className="text-xl font-black italic uppercase tracking-tighter text-white">Libro <span className="text-gold">Prenotazioni</span></h2>
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] mt-0.5">Prenotazioni di oggi</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => { setIsReservationsOpen(false); openNewReservationModal(); }} className="p-3 bg-gold text-black rounded-2xl hover:brightness-110 transition-all shadow-lg shadow-gold/20">
                  <Plus size={20} />
                </button>
                <button onClick={() => setIsReservationsOpen(false)} className="p-3 bg-charcoal rounded-2xl text-gray-500 hover:text-white border border-surface-light">
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
               {reservations.length === 0 ? (
                 <div className="h-full flex flex-col items-center justify-center text-gray-600 opacity-50 py-16">
                   <BookOpen size={48} strokeWidth={1} className="mb-4" />
                   <p className="font-black uppercase tracking-widest text-sm mb-5">Nessuna prenotazione oggi</p>
                   <button onClick={() => { setIsReservationsOpen(false); openNewReservationModal(); }} className="bg-gold text-black font-black py-3 px-6 rounded-2xl text-sm uppercase tracking-widest shadow-lg shadow-gold/20 hover:brightness-110 transition-all">
                     NUOVA PRENOTAZIONE
                   </button>
                 </div>
               ) : (
                 <div className="grid gap-3">
                    {reservations.map(res => (
                      <div key={res.id} className="bg-gradient-to-br from-charcoal to-surface border border-surface-light/80 p-4 rounded-[24px] flex items-center justify-between group hover:border-gold/40 hover:shadow-lg hover:shadow-gold/5 transition-all">
                         <div className="flex items-center gap-4 flex-1 min-w-0">
                            <div className="flex flex-col items-center justify-center w-16 h-16 rounded-2xl bg-gold/10 border border-gold/20 shrink-0">
                               <p className="text-[9px] font-black text-gold/70 uppercase tracking-widest leading-none">Ora</p>
                               <p className="text-lg font-black text-gold italic leading-tight">{res.ora.length > 5 ? res.ora.slice(0, 5) : res.ora}</p>
                            </div>
                            <div className="min-w-0">
                               <p className="text-base font-black text-white truncate">{res.nome}</p>
                               <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mt-0.5">
                                 {res.persone} {res.persone === 1 ? 'Persona' : 'Persone'}
                                 {res.tavolo_id && tables.find(t => t.id === res.tavolo_id) && ` · ${tables.find(t => t.id === res.tavolo_id)!.nome}`}
                               </p>
                               {res.note && <p className="text-[10px] text-gray-500 italic mt-1 truncate">"{res.note}"</p>}
                            </div>
                         </div>
                          {res.status === 'ARRIVATA' ? (
                            <div className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-500 font-black text-[10px] uppercase tracking-widest shrink-0">
                              <CheckCircle2 size={14} /> ARRIVATO
                            </div>
                          ) : (
                            <button
                              onClick={() => handleCheckIn(res)}
                              className="bg-emerald-500 hover:bg-emerald-400 text-black px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-500/20 active:scale-95 transition-all shrink-0"
                            >
                              CHECK-IN
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteReservationById(res)}
                            className="p-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl transition-all shrink-0"
                            title="Elimina prenotazione"
                          >
                            <Trash2 size={16} />
                          </button>
                      </div>
                    ))}
                 </div>
               )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function HubCard({ icon, title, desc, accent, onClick }: {
  icon: React.ReactNode; title: string; desc: string; accent: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full bg-surface border border-surface-light rounded-3xl p-5 flex items-center gap-4 text-left active:scale-[0.98] transition-all hover:border-gold/30"
    >
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${accent}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-black text-white text-base uppercase tracking-tight">{title}</h3>
        <p className="text-xs text-gray-500 font-bold mt-0.5">{desc}</p>
      </div>
      <ChevronRight size={20} className="text-gray-600 shrink-0" />
    </button>
  );
}

interface SwipeableCartItemProps {
  item: CustomizedItem;
  onRemove: (id: string) => void;
  onEdit: (item: CustomizedItem) => void;
  onSetCart: React.Dispatch<React.SetStateAction<CustomizedItem[]>>;
}

function SwipeableCartItem({ item, onRemove, onEdit, onSetCart }: SwipeableCartItemProps) {
  const [swipeX, setSwipeX] = useState(0);
  const swipeStartX = useRef(0);
  const DELETE_THRESHOLD = -80;

  const handleTouchStart = (e: React.TouchEvent) => {
    swipeStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const diff = e.touches[0].clientX - swipeStartX.current;
    if (diff < 0) {
      setSwipeX(Math.max(diff, DELETE_THRESHOLD * 1.2));
    }
  };

  const handleTouchEnd = () => {
    if (swipeX <= DELETE_THRESHOLD) {
      onRemove(item.uniqueId);
    }
    setSwipeX(0);
  };

  const portataInfo = PORTATE.find(p => p.value === item.portata);

  return (
    <div className="relative overflow-hidden rounded-xl">
      <div className="absolute inset-y-0 right-0 flex items-center justify-end bg-red-500/20 rounded-xl pr-3">
        <button
          onClick={() => { onRemove(item.uniqueId); setSwipeX(0); }}
          className="w-10 h-10 flex items-center justify-center bg-red-500 text-white rounded-xl active:scale-90"
        >
          <Trash2 size={18} />
        </button>
      </div>
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="relative bg-surface border border-surface-light rounded-xl p-3 flex items-center gap-3 transition-transform duration-200"
        style={{ transform: `translateX(${swipeX}px)` }}
      >
        {/* Info (fill remaining space) */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h5 className="font-bold text-white text-sm truncate">{item.nome}</h5>
            {item.portata && (
              <span className={`shrink-0 text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${portataInfo?.color || 'text-gray-500 border-gray-500/30 bg-gray-500/10'}`}>
                {item.portata}ª
              </span>
            )}
          </div>
          <p className="text-[10px] text-gray-400 mt-0.5">
            {item.addedIngredients.length > 0 && <span className="text-emerald-400 font-bold">+{item.addedIngredients.map(a => a.nome).join(', ')} </span>}
            {item.removedIngredients.length > 0 && <span className="text-red-400 font-bold">NO {item.removedIngredients.join(', ')} </span>}
            {item.notes && <span className="text-amber-400 italic font-bold">({item.notes})</span>}
          </p>
        </div>

        {/* Quantity controls */}
        <div className="shrink-0 flex items-center gap-2">
          <button onClick={() => onEdit(item)} className="w-9 h-9 bg-charcoal text-gray-400 hover:text-gold rounded-xl flex items-center justify-center border border-surface-light active:scale-90">
            <Edit3 size={15} />
          </button>
          <div className="flex items-center bg-charcoal rounded-xl border border-surface-light">
            <button
              onClick={() => {
                if (item.quantity <= 1) { onRemove(item.uniqueId); return; }
                onSetCart(prev => prev.map(i => i.uniqueId === item.uniqueId ? { ...i, quantity: i.quantity - 1 } : i));
              }}
              className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-white active:scale-90"
            >
              <Minus size={15} />
            </button>
            <span className="w-6 text-center font-black text-white text-sm">{item.quantity}</span>
            <button
              onClick={() => onSetCart(prev => prev.map(i => i.uniqueId === item.uniqueId ? { ...i, quantity: i.quantity + 1 } : i))}
              className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-white active:scale-90"
            >
              <Plus size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
