import { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase, type Tavolo, IS_DEMO_MODE } from '../lib/supabase';
import { MOCK_TABLES } from '../lib/MockData';
import { stablePseudoMinutes } from '../lib/id';
import { Map as MapIcon, List, Edit2, Users, Save, X, Plus, Trash2, ShoppingCart, LayoutDashboard, BookOpen, Minus, MapPin } from 'lucide-react';

const SALE = ['Principale', 'Verde', 'Rotonda'];

export default function TableMapView({ onSelectTable }: { onSelectTable?: (id: string, name: string, status: string) => void }) {
  const [tavoli, setTavoli] = useState<Tavolo[]>([]);
  const [activeSala, setActiveSala] = useState(SALE[0]);
  const [viewMode, setViewMode] = useState<'MAP' | 'LIST'>('MAP');
  const [editingTable, setEditingTable] = useState<Tavolo | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [isEditLayoutMode, setIsEditLayoutMode] = useState(false);
  const [quickCoversModal, setQuickCoversModal] = useState<Tavolo | null>(null);
  const [isReservationsOpen, setIsReservationsOpen] = useState(false);
  const [transferTable, setTransferTable] = useState<Tavolo | null>(null);
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
    if (!supabase) return;
    const { data } = await supabase.from('tavoli').select('*').order('nome', { ascending: true });
    if (data) setTavoli(data);
  }

  async function handleTransfer(from: Tavolo, to: Tavolo) {
     if (to.status !== 'LIBERO') {
       alert('Il tavolo di destinazione deve essere libero');
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
       alert(`Ordine spostato da ${from.nome} a ${to.nome}`);
     }
   }

  const deleteTable = async (id: string) => {
    if (!confirm('Sei sicuro di voler eliminare questo tavolo?')) return;
    if (!IS_DEMO_MODE && supabase) {
      await supabase.from('tavoli').delete().eq('id', id);
    }
  };

  const addTable = async () => {
    const newName = `Tavolo ${tavoli.length + 1}`;
    if (!supabase) return;
    await supabase.from('tavoli').insert([{
      nome: newName,
      x: 10,
      y: 10,
      clienti: 0,
      status: 'LIBERO',
      shape: 'SQUARE',
      sala: activeSala
    }]);
  };

  useEffect(() => {
    void fetchTavoli();
    if (!IS_DEMO_MODE && supabase) {
      const sb = supabase;
      const channel = sb.channel('public:tavoli')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tavoli' }, () => void fetchTavoli())
        .subscribe();
      return () => { sb.removeChannel(channel); };
    }
  }, []);

  const handlePointerDown = (id: string, e: React.PointerEvent) => {
    if (viewMode === 'LIST') return;
    pointerDownPos.current = { x: e.clientX, y: e.clientY };
    pointerDownTime.current = e.timeStamp;
    if (!isEditLayoutMode) return;
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

  const filteredTavoli = tavoli.filter(t => {
    const sala = (t.sala || 'Principale').toUpperCase();
    const active = activeSala.toUpperCase();
    const normalizedSala = sala === 'SALA' ? 'PRINCIPALE' : sala;
    const normalizedActive = active === 'SALA' ? 'PRINCIPALE' : active;
    return normalizedSala === normalizedActive;
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-charcoal text-white overflow-hidden p-8">

      {/* View Header & Toggles */}
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-8">
        <div className="flex gap-4">
          <Link to="/" className="p-3 bg-surface border border-surface-light rounded-2xl text-gray-500 hover:text-white transition-all shadow-xl">
             <LayoutDashboard size={24} />
          </Link>
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

        <div className="flex items-center gap-4 bg-surface p-1.5 rounded-2xl border border-surface-light shadow-xl">
          <button
            onClick={() => setViewMode('MAP')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all ${viewMode === 'MAP' ? 'bg-gold text-black' : 'text-gray-400 hover:text-white'}`}
          >
            <MapIcon size={20} /> MAPPA
          </button>
          <button
            onClick={() => setViewMode('LIST')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all ${viewMode === 'LIST' ? 'bg-gold text-black' : 'text-gray-400 hover:text-white'}`}
          >
            <List size={20} /> LISTA
          </button>
          <div className="w-px h-8 bg-surface-light mx-2" />
          <button
            onClick={() => setIsEditLayoutMode(!isEditLayoutMode)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all border ${isEditLayoutMode ? 'bg-gold text-black border-gold shadow-lg shadow-gold/20' : 'bg-charcoal text-gray-500 border-surface-light'}`}
          >
            {isEditLayoutMode ? <Save size={18} /> : <Edit2 size={18} />} 
            {isEditLayoutMode ? 'SALVA' : 'LAYOUT'}
          </button>
          <button
            onClick={() => setIsReservationsOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-surface border border-surface-light text-gold rounded-xl font-bold transition-all shadow-lg active:scale-95"
          >
            <BookOpen size={20} /> PRENOTAZIONI
          </button>
          <button
            onClick={addTable}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold transition-all shadow-lg active:scale-95"
          >
            <Plus size={20} /> AGGIUNGI
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

      {/* Main View Area */}
      <div className="flex-1 relative bg-surface/50 rounded-[40px] border border-surface-light overflow-hidden shadow-inner flex flex-col">
        
        {viewMode === 'MAP' ? (
          <div className="flex-1 overflow-auto custom-scrollbar p-10 flex items-center justify-center min-h-0">
            <div 
              ref={mapRef}
              onPointerMove={handlePointerMove}
              className="relative touch-none shadow-2xl rounded-[20px] bg-charcoal/50 flex-shrink-0"
              style={{ 
                width: '1200px',
                height: '700px',
                backgroundImage: 'radial-gradient(#2A2A2A 1.5px, transparent 0)',
                backgroundSize: '40px 40px',
                border: '1px solid rgba(207, 160, 85, 0.1)'
              }}
            >
              {filteredTavoli.map(tavolo => (
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
                        if (isEditLayoutMode) {
                          setEditingTable(tavolo);
                        } else {
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
                      }
                    }}
                    className={`
                      ${tavolo.shape === 'ROUND' ? 'rounded-full' : 'rounded-2xl'}
                      ${tavolo.shape === 'RECTANGLE' ? 'w-48 h-24' : 'w-24 h-24'}
                      flex flex-col items-center justify-center p-2 shadow-2xl border-2 transition-all
                      ${tavolo.status === 'LIBERO' ? 'bg-charcoal border-gray-700 text-gray-400 hover:border-gray-500' : ''}
                      ${tavolo.status === 'OCCUPATO' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : ''}
                      ${tavolo.status === 'PRENOTATO' ? 'bg-amber-500/20 border-amber-500 text-amber-400' : ''}
                      ${transferTable?.id === tavolo.id ? 'ring-4 ring-blue-500 animate-pulse' : ''}
                      hover:scale-105 active:scale-95
                    `}
                  >
                     <div className="text-center">
                        <div className={`text-2xl font-black italic mb-0.5 ${tavolo.status === 'OCCUPATO' ? 'text-black' : 'text-white'}`}>{tavolo.nome}</div>
                        {tavolo.status === 'OCCUPATO' && (
                          <div className="flex items-center justify-center gap-1 text-[8px] font-black opacity-60">
                            <Users size={8} /> {tavolo.clienti}
                          </div>
                        )}
                      </div>
                      
                      {/* Pulse Alert for long stay */}
                      {tavolo.status === 'OCCUPATO' && (
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-ping" />
                      )}
                    {tavolo.status === 'OCCUPATO' && (
                      <div className="mt-1 px-2 py-0.5 bg-black/40 rounded-full text-[8px] font-black tracking-tighter text-emerald-400">
                        {stablePseudoMinutes(tavolo.id)}m
                      </div>
                    )}
                  </div>
                  {isEditLayoutMode && (
                    <div className="absolute -top-2 -right-2 w-5 h-5 bg-gold rounded-full flex items-center justify-center text-black animate-bounce shadow-lg">
                      <Edit2 size={10} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-8 h-full overflow-y-auto custom-scrollbar">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredTavoli.map(tavolo => (
                <div key={tavolo.id} className="bg-surface border border-surface-light p-6 rounded-3xl flex items-center justify-between hover:border-gold/30 transition-all shadow-xl group">
                  <div className="flex items-center gap-6">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black ${tavolo.status === 'LIBERO' ? 'bg-charcoal text-gray-500 border border-surface-light' : 'bg-gold text-black shadow-lg shadow-gold/20'}`}>
                      {tavolo.nome.match(/\d+/)?.[0] || 'T'}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">{tavolo.nome}</h3>
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

      </div>

      {/* Quick Covers Modal */}
      {quickCoversModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-black/90 backdrop-blur-xl animate-in zoom-in duration-200">
          <div className="bg-surface border border-surface-light w-full max-w-sm rounded-[40px] shadow-2xl overflow-hidden p-8 text-center">
            <h2 className="text-2xl font-black italic uppercase text-white mb-2">{quickCoversModal.nome}</h2>
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-8">Inserisci numero di coperti</p>
            
            <div className="flex items-center justify-between bg-charcoal border border-surface-light rounded-3xl p-4 mb-8">
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
                {quickCoversModal.status === 'PRENOTATO' ? 'CHECK-IN' : 'APRI TAVOLO'}
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
                   onClick={() => { updateTable(editingTable.id, editingTable); setEditingTable(null); }}
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

      {/* Reservations Modal */}
      {isReservationsOpen && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-6 bg-black/95 backdrop-blur-2xl animate-in fade-in duration-300">
          <div className="bg-surface border border-surface-light w-full max-w-4xl rounded-[50px] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-10 border-b border-surface-light flex justify-between items-center bg-surface-light/5">
              <div>
                <h2 className="text-4xl font-black italic uppercase tracking-tighter text-white">Libro <span className="text-gold">Prenotazioni</span></h2>
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] mt-1">Gestione Tavoli e Orari di Arrivo</p>
              </div>
              <button onClick={() => setIsReservationsOpen(false)} className="p-4 bg-charcoal rounded-3xl text-gray-500 hover:text-white border border-surface-light">
                <X size={28} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
               <div className="grid gap-4">
                  {[
                    { name: 'Famiglia Rossi', time: '20:30', guests: 4, table: 'Tavolo 14' },
                    { name: 'Luca Bianchi', time: '21:00', guests: 2, table: 'Tavolo 5' },
                    { name: 'Cena Aziendale', time: '20:00', guests: 12, table: 'Tavolo 20' }
                  ].map((res, i) => (
                    <div key={i} className="bg-charcoal border border-surface-light p-6 rounded-[32px] flex items-center justify-between group hover:border-gold/30 transition-all">
                       <div className="flex items-center gap-8">
                          <div className="text-center min-w-[80px]">
                             <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Orario</p>
                             <p className="text-3xl font-black text-white italic">{res.time}</p>
                          </div>
                          <div className="w-px h-10 bg-surface-light" />
                          <div>
                             <p className="text-2xl font-black text-white">{res.name}</p>
                             <p className="text-[10px] font-black text-gold uppercase tracking-widest">{res.table} • {res.guests} Persone</p>
                          </div>
                       </div>
                       <button className="bg-emerald-500 text-black px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-500/20 active:scale-95 transition-all">
                          CHECK-IN
                       </button>
                    </div>
                  ))}
                  
                  <button className="mt-10 border-2 border-dashed border-surface-light p-8 rounded-[40px] text-gray-500 font-black uppercase tracking-widest flex items-center justify-center gap-4 hover:border-gold/30 hover:text-gold transition-all">
                     <Plus size={24} /> NUOVA PRENOTAZIONE
                  </button>
               </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
