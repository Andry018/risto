import { useEffect, useState, useRef, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase, IS_DEMO_MODE } from '../lib/supabase';
import type { Tavolo, Reservation } from '../types/entities';
import { MOCK_TABLES } from '../lib/MockData';
import { Map as MapIcon, List, Edit2, Users, Save, X, Plus, Trash2, ShoppingCart, LayoutDashboard, BookOpen, Minus, MapPin, CheckCircle2, Clock, Lock, Unlock } from 'lucide-react';
import { useConfirm } from './ConfirmModal';
import { usePrompt } from './PromptModal';
import { useToast } from './Toast';

const SALE = ['Principale', 'Verde', 'Rotonda', 'Terrazza'];

export default function TableMapView({ onSelectTable, freedTableIds, onNavigateHome }: { onSelectTable?: (id: string, name: string, status: string) => void; freedTableIds?: Set<string>; onNavigateHome?: () => void }) {
  const { confirm } = useConfirm();
  const { prompt } = usePrompt();
  const { addToast } = useToast();
  const [tavoli, setTavoli] = useState<Tavolo[]>([]);
  const [activeSala, setActiveSala] = useState(SALE[0]);
  const [viewMode, setViewMode] = useState<'MAP' | 'LIST'>('MAP');
  const [editingTable, setEditingTable] = useState<Tavolo | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragLocked, setDragLocked] = useState(true);
  const [quickCoversModal, setQuickCoversModal] = useState<Tavolo | null>(null);
  const [isReservationsOpen, setIsReservationsOpen] = useState(false);
  const [transferTable, setTransferTable] = useState<Tavolo | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [reservationModal, setReservationModal] = useState<{ table?: Tavolo; reservation?: Reservation; open: boolean }>({ open: false });
  const [resForm, setResForm] = useState<Partial<Reservation>>({ nome: '', data: new Date().toISOString().split('T')[0], ora: '20:00', persone: 2, note: '' });
  const [now, setNow] = useState(Date.now());
  const [tableApertura, setTableApertura] = useState<Record<string, string>>({});
  const navigate = useNavigate();
  const mapRef = useRef<HTMLDivElement>(null);
  const pointerDownPos = useRef({ x: 0, y: 0 });
  const pointerDownTime = useRef(0);

  const updateTable = async (id: string, updates: Partial<Tavolo>) => {
    setTavoli(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    if (!IS_DEMO_MODE && supabase) {
      await supabase.from('tavoli').update(updates).eq('id', id);
    }
  };

  async function fetchTavoli() {
    if (IS_DEMO_MODE) {
      setTavoli(MOCK_TABLES);
      return;
    }
    if (!supabase) {
      return;
    }
    try {
      const { data, error } = await supabase.from('tavoli').select('*').order('nome', { ascending: true });
      if (error) {
        console.error('[TableMapView] Error fetching tables:', error.message, error.details || '');
        return;
      }
      if (data) {
        const today = new Date().toISOString().split('T')[0];
        const toFree: string[] = [];
        await Promise.all(data.map(async (t) => {
          if (t.status === 'PRENOTATO') {
            const { data: prenotazioni } = await supabase!
              .from('prenotazioni')
              .select('id')
              .eq('tavolo_id', t.id)
              .eq('data', today)
              .in('status', ['CONFERMATA', 'ARRIVATA'])
              .maybeSingle();
            if (!prenotazioni) toFree.push(t.id);
          }
        }));
        for (const id of toFree) {
          await supabase.from('tavoli').update({ status: 'LIBERO', clienti: 0 }).eq('id', id);
        }
        const cleaned = data.map(t => toFree.includes(t.id) ? { ...t, status: 'LIBERO' as Tavolo['status'], clienti: 0 } : t);
        setTavoli(cleaned);
        const aperturaMap: Record<string, string> = {};
        await Promise.all(cleaned.map(async (t) => {
          if (t.status === 'OCCUPATO') {
            try {
              const { data: ord, error: ordErr } = await supabase!
                .from('ordini')
                .select('created_at')
                .eq('nome_cliente', t.nome)
                .eq('status', 'IN_ATTESA')
                .order('created_at', { ascending: true })
                .limit(1)
                .maybeSingle();
              if (!ordErr && ord?.created_at) {
                aperturaMap[t.id] = ord.created_at;
              }
            } catch { /* skip */ }
          }
        }));
        setTableApertura(prev => ({ ...prev, ...aperturaMap }));
      }
    } catch (err: any) {
      console.error('[TableMapView] Exception during fetchTavoli:', err.message || err);
    }
  }

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  async function handleTransfer(from: Tavolo, to: Tavolo) {
     if (to.status !== 'LIBERO') {
       addToast({ type: 'warning', title: 'Trasferimento', message: 'Il tavolo di destinazione deve essere libero' });
       return;
     }
     if (!supabase) return;
     
     const { data: order } = await supabase
       .from('ordini')
       .select('*')
       .eq('nome_cliente', from.nome)
       .eq('status', 'IN_ATTESA')
       .order('created_at', { ascending: false })
       .limit(1)
       .maybeSingle();
     if (order) {
       await supabase.from('ordini').update({ nome_cliente: to.nome }).eq('id', order.id);
       await updateTable(from.id, { status: 'LIBERO', clienti: 0 });
       await updateTable(to.id, { status: 'OCCUPATO', clienti: from.clienti });
       setTransferTable(null);
       addToast({ type: 'success', title: 'Trasferito', message: `Ordine spostato da ${from.nome} a ${to.nome}` });
     }
   }

  const deleteTable = async (id: string) => {
    const ok = await confirm({ title: 'Elimina tavolo', message: 'Sei sicuro di voler eliminare questo tavolo?', destructive: true });
    if (!ok) return;
    if (!IS_DEMO_MODE && supabase) {
      await supabase.from('tavoli').delete().eq('id', id);
    }
  };

  const addTable = async () => {
    if (!supabase) return;
    const existingNames = tavoli.map(t => t.nome);
    let suggest = 1;
    while (existingNames.includes(`Tavolo ${suggest}`)) suggest++;
    const name = await prompt({ title: 'Nuovo tavolo', message: 'Inserisci il nome del tavolo:', defaultValue: `Tavolo ${suggest}` });
    if (!name) return;
    if (existingNames.includes(name)) {
      addToast({ type: 'error', title: 'Nome già esistente', message: `Esiste già un tavolo chiamato "${name}"` });
      return;
    }
    await supabase.from('tavoli').insert([{
      nome: name,
      x: 10,
      y: 10,
      clienti: 0,
      status: 'LIBERO',
      shape: 'SQUARE',
      sala: activeSala
    }]);
  };

  async function fetchReservationsForDate() {
    if (IS_DEMO_MODE || !supabase) return;
    const today = new Date().toISOString().split('T')[0];
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
    void fetchTavoli();
  }

  const tableReservation = (tableId: string) => reservations.find(r => r.tavolo_id === tableId && r.status === 'CONFERMATA');

  function openReservationModal(table: Tavolo) {
    const existing = tableReservation(table.id);
    if (existing) {
      setResForm({ ...existing });
      setReservationModal({ open: true, table, reservation: existing });
    } else {
      setResForm({ nome: '', data: new Date().toISOString().split('T')[0], ora: '20:00', persone: 2, note: '', tavolo_id: table.id });
      setReservationModal({ open: true, table, reservation: undefined });
    }
  }

  function openNewReservationModal() {
    setResForm({ nome: '', data: new Date().toISOString().split('T')[0], ora: '20:00', persone: 2, note: '' });
    setReservationModal({ open: true, reservation: undefined });
  }

  async function handleSaveReservation() {
    if (!supabase || !resForm.nome || !resForm.data || !resForm.ora) return;
    const payload = { ...resForm };
    if (!payload.tavolo_id) delete payload.tavolo_id;
    const isToday = payload.data === new Date().toISOString().split('T')[0];
    if (reservationModal.reservation) {
      const oldRes = reservationModal.reservation;
      await supabase.from('prenotazioni').update(payload).eq('id', oldRes.id);
      if (oldRes.tavolo_id && oldRes.tavolo_id !== payload.tavolo_id) {
        await supabase.from('tavoli').update({ status: 'LIBERO', clienti: 0 }).eq('id', oldRes.tavolo_id);
      }
      if (payload.tavolo_id && oldRes.tavolo_id !== payload.tavolo_id && isToday) {
        await supabase.from('tavoli').update({ status: 'PRENOTATO', clienti: resForm.persone }).eq('id', payload.tavolo_id);
      }
    } else {
      await supabase.from('prenotazioni').insert([payload]);
      if (payload.tavolo_id && isToday) {
        await supabase.from('tavoli').update({ status: 'PRENOTATO', clienti: resForm.persone }).eq('id', payload.tavolo_id);
      }
    }
    setReservationModal({ open: false });
    void fetchReservationsForDate();
    void fetchTavoli();
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
    void fetchTavoli();
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
    void fetchTavoli();
  }

  useEffect(() => {
    void fetchTavoli();
    void fetchReservationsForDate();
    if (!IS_DEMO_MODE && supabase) {
      const sb = supabase;
      const tavoliChannel = sb.channel('public:tavoli')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tavoli' }, () => void fetchTavoli())
        .subscribe();
      const prenotazioniChannel = sb.channel('public:prenotazioni-map')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'prenotazioni' }, () => void fetchReservationsForDate())
        .subscribe();
      return () => {
        sb.removeChannel(tavoliChannel);
        sb.removeChannel(prenotazioniChannel);
      };
    }
  }, []);

  const handlePointerDown = (id: string, e: React.PointerEvent) => {
    if (viewMode === 'LIST') return;
    pointerDownPos.current = { x: e.clientX, y: e.clientY };
    pointerDownTime.current = e.timeStamp;
    if (dragLocked) return;
    setDraggingId(id);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingId || !mapRef.current) return;

    const mapRect = mapRef.current.getBoundingClientRect();
    const xPercent = Math.round(((e.clientX - mapRect.left) / mapRect.width) * 100);
    const yPercent = Math.round(((e.clientY - mapRect.top) / mapRect.height) * 100);

    // Constrain within bounds (allowing for shape size)
    const x = Math.max(0, Math.min(85, xPercent));
    const y = Math.max(0, Math.min(85, yPercent));

    // Local state only for smoothness
    setTavoli(prev => prev.map(t => t.id === draggingId ? { ...t, x, y } : t));
  };

  const handlePointerUp = async (e: React.PointerEvent) => {
    if (!draggingId) return;
    const table = tavoli.find(t => t.id === draggingId);
    if (table) {
      await updateTable(draggingId, { x: table.x, y: table.y });
    }
    setDraggingId(null);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  const salaColor = (sala: string) => {
    switch (sala.toUpperCase()) {
      case 'VERDE': return 'bg-emerald-600';
      case 'ROTONDA': return 'bg-amber-700';
      case 'TERRAZZA': return 'bg-gray-950';
      default: return 'bg-gray-500';
    }
  };

  const filteredTavoli = tavoli.filter(t => {
    const sala = (t.sala || 'Principale').toUpperCase();
    const active = activeSala.toUpperCase();
    const normalizedSala = sala === 'SALA' ? 'PRINCIPALE' : sala;
    const normalizedActive = active === 'SALA' ? 'PRINCIPALE' : active;
    return normalizedSala === normalizedActive;
  });

  const displayTavoli = useMemo(() =>
    filteredTavoli.map(t => freedTableIds?.has(t.id) ? { ...t, status: 'LIBERO' as Tavolo['status'] } : t),
    [filteredTavoli, freedTableIds]
  );

  return (
    <div className="h-[100dvh] min-h-0 flex flex-col bg-charcoal text-white overflow-hidden p-3 sm:p-5 lg:p-8">

      {/* View Header & Toggles */}
      <header className="flex flex-col gap-4 lg:flex-row lg:justify-between lg:items-start shrink-0 mb-3 sm:mb-4">
        <div className="flex gap-4">
          {onNavigateHome ? (
            <button onClick={onNavigateHome} className="p-3 bg-surface border border-surface-light rounded-2xl text-gray-500 hover:text-white transition-all shadow-xl">
               <LayoutDashboard size={24} />
            </button>
          ) : (
            <Link to="/" className="p-3 bg-surface border border-surface-light rounded-2xl text-gray-500 hover:text-white transition-all shadow-xl">
               <LayoutDashboard size={24} />
            </Link>
          )}
          <div>
            <h2 className="text-sm text-gray-400 font-bold tracking-widest uppercase">Gestione Sala</h2>
            <h1 className="text-3xl font-black text-white mt-1">MAPPA TAVOLI</h1>
          </div>
        </div>

        {/* Sala Selector Tabs */}
        <div className="flex items-center gap-2 bg-surface p-1.5 rounded-2xl border border-surface-light shadow-xl">
          {SALE.map(sala => (
            <button
              key={sala}
              onClick={() => setActiveSala(sala)}
              className={`px-4 py-2 rounded-xl font-bold transition-all text-sm ${activeSala === sala ? 'bg-charcoal text-gold border border-gold/20 shadow-lg' : 'text-gray-500 hover:text-white'}`}
            >
              {sala}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 bg-surface p-1.5 rounded-2xl border border-surface-light shadow-xl w-full lg:w-auto justify-center lg:justify-end">
          <button
            onClick={() => setViewMode('MAP')}
            className={`flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl font-bold text-sm transition-all ${viewMode === 'MAP' ? 'bg-gold text-black' : 'text-gray-400 hover:text-white'}`}
          >
            <MapIcon size={18} /> MAPPA
          </button>
          <button
            onClick={() => setViewMode('LIST')}
            className={`flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl font-bold text-sm transition-all ${viewMode === 'LIST' ? 'bg-gold text-black' : 'text-gray-400 hover:text-white'}`}
          >
            <List size={18} /> LISTA
          </button>
          <div className="hidden sm:block w-px h-8 bg-surface-light mx-1" />
          <button
            onClick={() => setIsReservationsOpen(true)}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-surface border border-surface-light text-gold rounded-xl font-bold text-sm transition-all shadow-lg active:scale-95"
          >
            <BookOpen size={18} /> <span className="hidden sm:inline">PRENOTAZIONI</span>
          </button>
          <button
            onClick={addTable}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold text-sm transition-all shadow-lg active:scale-95"
          >
            <Plus size={18} /> <span className="hidden sm:inline">AGGIUNGI</span>
          </button>
        </div>
      </header>

      {/* Transfer Mode Indicator */}
      {transferTable && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[110] bg-blue-600 text-white px-8 py-4 rounded-3xl shadow-2xl flex items-center gap-6 animate-bounce">
           <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-widest opacity-70">Modalità Spostamento</span>
              <span className="text-sm font-bold">Seleziona il tavolo di destinazione per {transferTable.nome}</span>
           </div>
           <button 
             onClick={() => setTransferTable(null)}
             className="bg-white/20 hover:bg-white/30 p-2 rounded-xl transition-all"
           >
             <X size={20} />
           </button>
        </div>
      )}

      {/* Main View Area — adatta al viewport tablet senza doppio scroll */}
      <div className="flex-1 min-h-0 relative bg-surface/50 rounded-[24px] lg:rounded-[40px] border border-surface-light overflow-hidden shadow-inner flex flex-col">
        
        {viewMode === 'MAP' ? (
          <div className="flex-1 min-h-0 flex items-center justify-center p-2 sm:p-4 overflow-hidden">
            <div 
              ref={mapRef}
              onPointerMove={handlePointerMove}
              className="relative touch-none shadow-2xl rounded-[16px] sm:rounded-[20px] bg-charcoal/50 w-full max-w-[1600px] aspect-[12/7] max-h-[min(calc(100dvh-13rem),78vh)]"
              style={{ 
                backgroundImage: 'radial-gradient(#2A2A2A 1.5px, transparent 0)',
                backgroundSize: '40px 40px',
                border: '1px solid rgba(207, 160, 85, 0.1)'
              }}
            >
              {displayTavoli.map(tavolo => (
                <div
                  key={tavolo.id}
                  onPointerDown={(e) => handlePointerDown(tavolo.id, e)}
                  onPointerUp={handlePointerUp}
                  className={`absolute transition-transform duration-75 select-none ${draggingId === tavolo.id ? 'scale-105 z-50 cursor-grabbing' : 'cursor-grab z-10'}`}
                  style={{ 
                    left: `${tavolo.x}%`, 
                    top: `${tavolo.y}%`,
                    touchAction: 'none'
                  }}
                >
                  <div 
                    onClick={(e) => {
                      e.stopPropagation();
                      // Only open modal if it was a quick click, not a significant drag
                      const dist = Math.sqrt(
                        Math.pow(e.clientX - pointerDownPos.current.x, 2) + 
                        Math.pow(e.clientY - pointerDownPos.current.y, 2)
                      );
                      const duration = e.timeStamp - pointerDownTime.current;
                      if (dist < 10 && duration < 500) {
                          if (transferTable) {
                            handleTransfer(transferTable, tavolo);
                            return;
                          }
                          if (tavolo.status === 'OCCUPATO') {
                           if (onSelectTable) onSelectTable(tavolo.id, tavolo.nome, tavolo.status);
                           else navigate(`/pos?tableId=${tavolo.id}&tableName=${encodeURIComponent(tavolo.nome)}`);
                         } else {
                           setQuickCoversModal(tavolo);
                         }
                      }
                    }}
                    className={`
                      group
                      ${tavolo.shape === 'ROUND' ? 'rounded-full' : 'rounded-2xl'}
                      ${tavolo.shape === 'RECTANGLE' ? 'w-48 h-24' : 'w-24 h-24'}
                      flex flex-col items-center justify-center p-2 shadow-2xl border-2 transition-all
                      ${tavolo.status === 'LIBERO' ? 'bg-charcoal border-gray-700 text-gray-400 hover:border-gray-500' : ''}
                      ${tavolo.status === 'OCCUPATO' ? 'bg-red-500/20 border-red-500 text-red-400' : ''}
                      ${tavolo.status === 'PRENOTATO' ? 'bg-amber-500/20 border-amber-500 text-amber-400' : ''}
                      ${transferTable?.id === tavolo.id ? 'ring-4 ring-blue-500 animate-pulse' : ''}
                      hover:scale-105 active:scale-95
                    `}
                  >
                     <div className="text-center">
                         <div className={`text-2xl font-black italic mb-0.5 ${tavolo.status === 'OCCUPATO' ? 'text-black' : 'text-white'}`}>
                           {tavolo.nome}
                         </div>
                        {tavolo.status === 'OCCUPATO' && (
                          <div className="flex items-center justify-center gap-1 text-[8px] font-black opacity-60">
                            <Users size={8} /> {tavolo.clienti}
                          </div>
                        )}
                        {tavolo.status === 'PRENOTATO' && tableReservation(tavolo.id) && (
                          <div className="text-[8px] font-black text-amber-300 truncate max-w-full px-1">
                            {tableReservation(tavolo.id)!.nome}
                          </div>
                        )}
                      </div>
                      
                       {/* Pulse Alert for long stay */}
                      {tavolo.status === 'OCCUPATO' && (
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-ping" />
                      )}
                    {tavolo.status === 'OCCUPATO' && tableApertura[tavolo.id] && (
                      <div className="flex items-center gap-1 mt-1 px-2 py-1 bg-amber-500/20 border border-amber-500/30 rounded-full text-[9px] font-black text-amber-400">
                        <Clock size={9} />
                        {(() => {
                          const diff = now - new Date(tableApertura[tavolo.id]).getTime();
                          const mins = Math.floor(diff / 60000);
                          if (mins < 1) return 'ora';
                          if (mins < 60) return `${mins}min`;
                          return `${Math.floor(mins / 60)}h ${mins % 60}min`;
                        })()}
                      </div>
                    )}
                    {/* Prenotazione badge / button on table card */}
                    {tavolo.status === 'PRENOTATO' || (tavolo.status !== 'OCCUPATO' && tableReservation(tavolo.id)) ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); openReservationModal(tavolo); }}
                        className="absolute -top-2 -right-2 flex items-center gap-1 px-2 py-1 bg-amber-500 rounded-full text-[8px] font-black text-black shadow-lg hover:scale-110 transition-all active:scale-95 z-20"
                      >
                        <BookOpen size={10} /> {tavolo.status === 'PRENOTATO' ? 'P' : ''}
                      </button>
                    ) : tavolo.status === 'LIBERO' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); openReservationModal(tavolo); }}
                        className="absolute -top-2 -right-2 flex items-center gap-1 px-2 py-1 bg-charcoal border border-amber-500/40 rounded-full text-[8px] font-black text-amber-500 shadow-lg hover:bg-amber-500 hover:text-black transition-all active:scale-95 z-20 opacity-0 group-hover:opacity-100"
                      >
                        <BookOpen size={10} /> P
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingTable(tavolo); }}
                      className="absolute -bottom-1 -left-1 w-6 h-6 bg-surface border border-surface-light rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:border-gray-400 shadow-lg transition-all active:scale-90 z-20"
                      title="Configura tavolo"
                    >
                      <Edit2 size={11} />
                    </button>
                    {/* Sala indicator bar */}
                    <div className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-1 rounded-full mb-1 ${salaColor(tavolo.sala || 'Principale')}`} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-4 sm:p-6 flex-1 min-h-0 overflow-y-auto custom-scrollbar">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
              {displayTavoli.map(tavolo => (
                <div key={tavolo.id} className="bg-surface border border-surface-light p-6 rounded-3xl flex items-center justify-between hover:border-gold/30 transition-all shadow-xl group">
                  <div className="flex items-center gap-6">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black ${tavolo.status === 'LIBERO' ? 'bg-charcoal text-gray-500 border border-surface-light' : 'bg-gold text-black shadow-lg shadow-gold/20'}`}>
                      {tavolo.nome.match(/\d+/)?.[0] || 'T'}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">
                        {tavolo.nome}
                      </h3>
                      <p className="flex items-center gap-2 text-gray-400 font-medium">
                        <span className={`w-2 h-2 rounded-full ${tavolo.status === 'LIBERO' ? 'bg-gray-500' : 'bg-emerald-500 animate-pulse'}`}></span>
                        {tavolo.status} • {tavolo.clienti} Clienti
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {onSelectTable && (
                      <button 
                        onClick={() => onSelectTable(tavolo.id, tavolo.nome, tavolo.status)}
                        className={`p-3 rounded-xl transition-all ${tavolo.status === 'LIBERO' ? 'bg-gold text-black' : 'bg-emerald-500 text-black'}`}
                      >
                        {tavolo.status === 'LIBERO' ? <Plus size={20} /> : <ShoppingCart size={20} />}
                      </button>
                    )}
                    <button onClick={() => setEditingTable(tavolo)} className="p-3 bg-surface-light hover:bg-gold hover:text-black rounded-xl text-gray-400 transition-all"><Edit2 size={20} /></button>
                    <button onClick={() => deleteTable(tavolo.id)} className="p-3 bg-surface-light hover:bg-red-500 hover:text-white rounded-xl text-gray-400 transition-all"><Trash2 size={20} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={() => setDragLocked(!dragLocked)}
          className={`absolute bottom-3 right-3 z-30 w-9 h-9 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-90 border ${dragLocked ? 'bg-gold text-black border-gold' : 'bg-charcoal text-gray-400 border-surface-light'}`}
          title={dragLocked ? 'Blocca posizione: attivo — Tocca per spostare i tavoli' : 'Blocca posizione: disattivo — I tavoli si spostano'}
        >
          {dragLocked ? <Lock size={14} /> : <Unlock size={14} />}
        </button>

      </div>

      {/* Quick Covers Modal */}
      {quickCoversModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-black/90 backdrop-blur-xl animate-in zoom-in duration-200">
          <div className="bg-surface border border-surface-light w-full max-w-sm rounded-[40px] shadow-2xl overflow-hidden p-8 text-center">
            <h2 className="text-2xl font-black italic uppercase text-white mb-2">{quickCoversModal.nome}</h2>
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-8">Inserisci numero di coperti</p>
            
            <div className="flex items-center justify-between bg-charcoal border border-surface-light rounded-3xl p-4 mb-4">
              <button 
                onClick={() => setQuickCoversModal({...quickCoversModal, clienti: Math.max(1, (quickCoversModal.clienti || 2) - 1)})}
                className="w-12 h-12 flex items-center justify-center bg-surface rounded-2xl text-gold"
              ><Minus /></button>
              <span className="text-5xl font-black text-white italic">{quickCoversModal.clienti || 2}</span>
              <button 
                onClick={() => setQuickCoversModal({...quickCoversModal, clienti: (quickCoversModal.clienti || 2) + 1})}
                className="w-12 h-12 flex items-center justify-center bg-surface rounded-2xl text-gold"
              ><Plus /></button>
            </div>

            <div className="grid gap-3">
              {quickCoversModal.status === 'PRENOTATO' ? (
                <>
                  <button 
                    onClick={async () => {
                      const covers = quickCoversModal.clienti || 2;
                      await updateTable(quickCoversModal.id, { status: 'OCCUPATO', clienti: covers });
                      if (onSelectTable) onSelectTable(quickCoversModal.id, quickCoversModal.nome, 'OCCUPATO');
                      else navigate(`/pos?tableId=${quickCoversModal.id}&tableName=${encodeURIComponent(quickCoversModal.nome)}`);
                      setQuickCoversModal(null);
                    }}
                    className="w-full bg-emerald-500 text-black font-black py-5 rounded-2xl text-lg shadow-xl shadow-emerald-500/20 active:scale-95 transition-all"
                  >
                    APRI TAVOLO
                  </button>
                  <button 
                    onClick={async () => {
                      const covers = quickCoversModal.clienti || 2;
                      const res = tableReservation(quickCoversModal.id);
                      await updateTable(quickCoversModal.id, { status: 'OCCUPATO', clienti: covers });
                      if (res && supabase) {
                        await supabase.from('prenotazioni').update({ status: 'ARRIVATA' }).eq('id', res.id);
                        void fetchReservationsForDate();
                      }
                      if (onSelectTable) onSelectTable(quickCoversModal.id, quickCoversModal.nome, 'OCCUPATO');
                      else navigate(`/pos?tableId=${quickCoversModal.id}&tableName=${encodeURIComponent(quickCoversModal.nome)}`);
                      setQuickCoversModal(null);
                      void fetchTavoli();
                    }}
                    className="w-full bg-amber-500 text-black font-black py-5 rounded-2xl text-lg shadow-xl shadow-amber-500/20 active:scale-95 transition-all"
                  >
                    CHECK-IN
                  </button>
                </>
              ) : (
                <button 
                  onClick={async () => {
                    const covers = quickCoversModal.clienti || 2;
                    await updateTable(quickCoversModal.id, { status: 'OCCUPATO', clienti: covers });
                    if (onSelectTable) onSelectTable(quickCoversModal.id, quickCoversModal.nome, 'OCCUPATO');
                    else navigate(`/pos?tableId=${quickCoversModal.id}&tableName=${encodeURIComponent(quickCoversModal.nome)}`);
                    setQuickCoversModal(null);
                  }}
                  className="w-full bg-emerald-500 text-black font-black py-5 rounded-2xl text-lg shadow-xl shadow-emerald-500/20 active:scale-95 transition-all"
                >
                  APRI TAVOLO
                </button>
              )}
              <button 
                onClick={() => { const t = quickCoversModal; setQuickCoversModal(null); openReservationModal(t); }}
                className="w-full bg-amber-500 text-black font-black py-5 rounded-2xl text-lg shadow-xl shadow-amber-500/20 active:scale-95 transition-all"
              >
                {tableReservation(quickCoversModal.id) ? 'MODIFICA PRENOTAZIONE' : 'PRENOTAZIONE'}
              </button>
              <button onClick={() => setQuickCoversModal(null)} className="text-gray-500 font-black text-xs uppercase tracking-widest py-2">Annulla</button>
            </div>
          </div>
        </div>
      )}

      {/* Technical Edit Modal */}
      {editingTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-md">
          <div className="bg-surface border border-surface-light w-full max-w-md rounded-[40px] shadow-[0_0_100px_rgba(0,0,0,0.5)] overflow-hidden">
            <div className="p-10">
              <div className="flex justify-between items-center mb-10">
                <div>
                  <h2 className="text-3xl font-black italic uppercase tracking-tighter text-white">Configurazione <span className="text-gold">{editingTable.nome}</span></h2>
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mt-1">Impostazioni Tecniche Layout</p>
                </div>
                <button onClick={() => setEditingTable(null)} className="p-4 bg-charcoal rounded-2xl text-gray-500 hover:text-white border border-surface-light">
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-8">
                <div className="space-y-3">
                  <label className="text-xs font-black text-gray-400 tracking-widest uppercase">Nome Tavolo</label>
                  <input
                    type="text"
                    value={editingTable.nome}
                    onChange={e => setEditingTable({ ...editingTable, nome: e.target.value })}
                    className="w-full bg-charcoal border border-surface-light rounded-2xl p-4 text-white font-bold outline-none focus:border-gold transition-colors"
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-black text-gray-400 tracking-widest uppercase">Forma Tavolo</label>
                  <div className="grid grid-cols-3 gap-3">
                    <button onClick={() => setEditingTable({...editingTable, shape: 'SQUARE'})} className={`p-4 rounded-2xl border ${editingTable.shape === 'SQUARE' ? 'bg-gold/10 border-gold text-gold' : 'bg-charcoal border-surface-light text-gray-500'} transition-all flex flex-col items-center gap-2`}>
                       <div className="w-8 h-8 bg-current opacity-50 rounded-md" />
                       <span className="text-[10px] font-black">QUADRATO</span>
                    </button>
                    <button onClick={() => setEditingTable({...editingTable, shape: 'ROUND'})} className={`p-4 rounded-2xl border ${editingTable.shape === 'ROUND' ? 'bg-gold/10 border-gold text-gold' : 'bg-charcoal border-surface-light text-gray-500'} transition-all flex flex-col items-center gap-2`}>
                       <div className="w-8 h-8 bg-current opacity-50 rounded-full" />
                       <span className="text-[10px] font-black">ROTONDO</span>
                    </button>
                    <button onClick={() => setEditingTable({...editingTable, shape: 'RECTANGLE'})} className={`p-4 rounded-2xl border ${editingTable.shape === 'RECTANGLE' ? 'bg-gold/10 border-gold text-gold' : 'bg-charcoal border-surface-light text-gray-500'} transition-all flex flex-col items-center gap-2`}>
                       <div className="w-12 h-6 bg-current opacity-50 rounded-sm" />
                       <span className="text-[10px] font-black">RETTANGOLO</span>
                    </button>
                  </div>
                 </div>

                 <button
                   onClick={() => { setTransferTable(editingTable); setEditingTable(null); }}
                   className="w-full bg-blue-500 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-3 transition-opacity active:opacity-80 mt-10 shadow-xl"
                 >
                   <MapPin size={20} /> SPOSTA ORDINE / TAVOLO
                 </button>
                 <button
                    onClick={() => {
                      const dup = tavoli.find(t => t.id !== editingTable.id && t.nome === editingTable.nome);
                      if (dup) { addToast({ type: 'error', title: 'Nome già esistente', message: `Esiste già un tavolo chiamato "${editingTable.nome}"` }); return; }
                      updateTable(editingTable.id, editingTable); setEditingTable(null);
                    }}
                    className="w-full bg-gold text-black font-black py-4 rounded-2xl flex items-center justify-center gap-3 transition-opacity active:opacity-80 mt-2 shadow-xl"
                  >
                    <Save size={20} /> SALVA CONFIGURAZIONE
                  </button>
                <button
                  onClick={() => { deleteTable(editingTable.id); setEditingTable(null); }}
                  className="w-full bg-red-500/10 text-red-500 font-black py-3 rounded-2xl text-xs uppercase tracking-widest mt-2"
                >
                  <Trash2 size={16} className="inline mr-2" /> ELIMINA TAVOLO
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reservation Create/Edit Modal */}
      {reservationModal.open && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center p-6 bg-black/90 backdrop-blur-xl animate-in zoom-in duration-200">
          <div className="bg-surface border border-surface-light w-full max-w-3xl rounded-[40px] shadow-2xl overflow-hidden">
            <div className="p-6 md:p-8">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-xl md:text-2xl font-black italic uppercase tracking-tighter text-white">{reservationModal.reservation ? 'Modifica' : 'Nuova'} <span className="text-gold">Prenotazione</span></h2>
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mt-1">
                    {reservationModal.table ? `Tavolo: ${reservationModal.table.nome}` : 'Nessun tavolo assegnato'}
                  </p>
                </div>
                <button onClick={() => setReservationModal({ open: false })} className="p-3 bg-charcoal rounded-2xl text-gray-500 hover:text-white border border-surface-light">
                  <X size={22} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Nome Cliente</label>
                  <input type="text" placeholder="es. Mario Rossi" value={resForm.nome} onChange={e => setResForm({...resForm, nome: e.target.value})} className="w-full bg-charcoal border border-surface-light rounded-xl p-3.5 text-white font-bold outline-none focus:border-gold transition-all" />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Data</label>
                  <input type="date" value={resForm.data} onChange={e => setResForm({...resForm, data: e.target.value})} className="w-full bg-charcoal border border-surface-light rounded-xl p-3.5 text-white font-bold outline-none focus:border-gold transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Ora</label>
                  <input type="time" value={resForm.ora} onChange={e => setResForm({...resForm, ora: e.target.value})} className="w-full bg-charcoal border border-surface-light rounded-xl p-3.5 text-white font-bold outline-none focus:border-gold transition-all" />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Persone</label>
                  <div className="flex items-center justify-between bg-charcoal border border-surface-light rounded-xl p-1.5 px-3">
                    <button onClick={() => setResForm({...resForm, persone: Math.max(1, (resForm.persone || 2) - 1)})} className="w-9 h-9 bg-surface rounded-xl text-gold active:scale-90">-</button>
                    <span className="text-xl font-black text-white">{resForm.persone}</span>
                    <button onClick={() => setResForm({...resForm, persone: (resForm.persone || 2) + 1})} className="w-9 h-9 bg-surface rounded-xl text-gold active:scale-90">+</button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Assegna Tavolo (Opzionale)</label>
                  <select
                    value={resForm.tavolo_id || ''}
                    onChange={e => setResForm({...resForm, tavolo_id: e.target.value || undefined})}
                    className="w-full bg-charcoal border border-surface-light rounded-xl p-3.5 text-white font-bold outline-none focus:border-gold transition-all appearance-none"
                  >
                    <option value="">Nessun tavolo</option>
                    {tavoli.map(t => (
                      <option key={t.id} value={t.id}>{t.nome} ({t.sala})</option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Note</label>
                  <textarea placeholder="Opzionale..." value={resForm.note || ''} onChange={e => setResForm({...resForm, note: e.target.value})} className="w-full bg-charcoal border border-surface-light rounded-xl p-3.5 text-white font-bold outline-none focus:border-gold transition-all h-16" />
                </div>
              </div>

              <div className="flex items-center gap-3 mt-6">
                <button onClick={handleSaveReservation} className="flex-1 bg-gold text-black font-black py-4 rounded-2xl text-base shadow-xl active:scale-95 transition-all">
                  {reservationModal.reservation ? 'SALVA MODIFICHE' : 'CONFERMA PRENOTAZIONE'}
                </button>
                {reservationModal.reservation && (
                  <button onClick={handleDeleteReservation} className="bg-red-500/10 text-red-500 font-black py-4 px-6 rounded-2xl text-xs uppercase tracking-widest">
                    ELIMINA
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Reservations Modal */}
      {isReservationsOpen && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-6 bg-black/95 backdrop-blur-2xl animate-in fade-in duration-300">
          <div className="bg-surface border border-surface-light w-full max-w-4xl rounded-[50px] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-10 border-b border-surface-light flex justify-between items-center bg-surface-light/5">
              <div>
                <h2 className="text-4xl font-black italic uppercase tracking-tighter text-white">Libro <span className="text-gold">Prenotazioni</span></h2>
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] mt-1">Prenotazioni di oggi</p>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => { setIsReservationsOpen(false); openNewReservationModal(); }} className="p-4 bg-gold text-black rounded-3xl hover:brightness-110 transition-all shadow-lg shadow-gold/20">
                  <Plus size={28} />
                </button>
                <button onClick={() => setIsReservationsOpen(false)} className="p-4 bg-charcoal rounded-3xl text-gray-500 hover:text-white border border-surface-light">
                  <X size={28} />
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
               {reservations.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-600 opacity-50 py-20">
                    <BookOpen size={60} strokeWidth={1} className="mb-4" />
                    <p className="font-black uppercase tracking-widest text-sm mb-6">Nessuna prenotazione oggi</p>
                    <button onClick={() => { setIsReservationsOpen(false); openNewReservationModal(); }} className="bg-gold text-black font-black py-3 px-6 rounded-2xl text-sm uppercase tracking-widest shadow-lg shadow-gold/20 hover:brightness-110 transition-all">
                      NUOVA PRENOTAZIONE
                    </button>
                  </div>
               ) : (
                 <div className="grid gap-4">
                    {reservations.map(res => (
                      <div key={res.id} className="bg-charcoal border border-surface-light p-6 rounded-[32px] flex items-center justify-between group hover:border-gold/30 transition-all">
                         <div className="flex items-center gap-8">
                            <div className="text-center min-w-[80px]">
                               <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Orario</p>
                               <p className="text-3xl font-black text-white italic">{res.ora}</p>
                            </div>
                            <div className="w-px h-10 bg-surface-light" />
                            <div>
                               <p className="text-2xl font-black text-white">{res.nome}</p>
                               <p className="text-[10px] font-black text-gold uppercase tracking-widest">
                                 {res.persone} Persone
                                 {res.tavolo_id && tavoli.find(t => t.id === res.tavolo_id) && ` • ${tavoli.find(t => t.id === res.tavolo_id)!.nome}`}
                               </p>
                            </div>
                         </div>
                          {res.status === 'ARRIVATA' ? (
                            <div className="flex items-center gap-2 px-6 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-500 font-black text-xs uppercase tracking-widest shrink-0">
                              <CheckCircle2 size={16} /> ARRIVATO
                            </div>
                          ) : (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleCheckIn(res); }}
                              className="bg-emerald-500 hover:bg-emerald-400 text-black px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-500/20 active:scale-95 transition-all shrink-0"
                            >
                              CHECK-IN
                            </button>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteReservationById(res); }}
                            className="p-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-2xl transition-all shrink-0"
                            title="Elimina prenotazione"
                          >
                            <Trash2 size={18} />
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
