import { useEffect, useState, useRef } from 'react';
import { supabase, type Tavolo } from '../lib/supabase';
import { Map as MapIcon, List, Edit2, Users, Save, X, Plus, Trash2, ShoppingCart } from 'lucide-react';

const SALE = ['SALA', 'VERDE', 'ROTONDA'];

export default function TableMapView({ onSelectTable }: { onSelectTable?: (id: string, name: string) => void }) {
  const [tavoli, setTavoli] = useState<Tavolo[]>([]);
  const [activeSala, setActiveSala] = useState(SALE[0]);
  const [viewMode, setViewMode] = useState<'MAP' | 'LIST'>('MAP');
  const [editingTable, setEditingTable] = useState<Tavolo | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const pointerDownPos = useRef({ x: 0, y: 0 });
  const pointerDownTime = useRef(0);

  useEffect(() => {
    fetchTavoli();
    const channel = supabase.channel('public:tavoli')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tavoli' }, () => fetchTavoli())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  async function fetchTavoli() {
    const { data } = await supabase.from('tavoli').select('*').order('nome', { ascending: true });
    if (data) setTavoli(data);
  }

  const updateTable = async (id: string, updates: Partial<Tavolo>) => {
    // Optimistic update
    setTavoli(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    await supabase.from('tavoli').update(updates).eq('id', id);
  };

  const deleteTable = async (id: string) => {
    if (confirm('Sei sicuro di voler eliminare questo tavolo?')) {
      await supabase.from('tavoli').delete().eq('id', id);
    }
  };

  const addTable = async () => {
    const newName = `Tavolo ${tavoli.length + 1}`;
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

  const handlePointerDown = (id: string, e: React.PointerEvent) => {
    if (viewMode === 'LIST') return;
    pointerDownPos.current = { x: e.clientX, y: e.clientY };
    pointerDownTime.current = Date.now();
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

  const filteredTavoli = tavoli.filter(t => (t.sala || 'SALA 1') === activeSala);

  return (
    <div className="flex-1 flex flex-col h-full bg-charcoal text-white overflow-hidden p-8">

      {/* View Header & Toggles */}
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-8">
        <div>
          <h2 className="text-sm text-gray-400 font-bold tracking-widest uppercase">Gestione Sala</h2>
          <h1 className="text-3xl font-black text-white mt-1">MAPPA TAVOLI</h1>
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
            onClick={addTable}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold transition-all shadow-lg active:scale-95"
          >
            <Plus size={20} /> AGGIUNGI
          </button>
        </div>
      </header>

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
                      const duration = Date.now() - pointerDownTime.current;
                      if (dist < 10 && duration < 500) {
                        setEditingTable(tavolo);
                      }
                    }}
                    className={`
                      ${tavolo.shape === 'ROUND' ? 'rounded-full' : 'rounded-2xl'}
                      ${tavolo.shape === 'RECTANGLE' ? 'w-48 h-24' : 'w-24 h-24'}
                      flex flex-col items-center justify-center p-2 shadow-2xl border-2 transition-all
                      ${tavolo.status === 'LIBERO' ? 'bg-charcoal border-gray-700 text-gray-400 hover:border-gray-500' : ''}
                      ${tavolo.status === 'OCCUPATO' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : ''}
                      ${tavolo.status === 'PRENOTATO' ? 'bg-amber-500/20 border-amber-500 text-amber-400' : ''}
                      hover:scale-105 active:scale-95
                    `}
                  >
                    <span className="text-xs font-black uppercase tracking-tighter opacity-70 mb-1 pointer-events-none">{tavolo.nome}</span>
                    <div className="flex items-center gap-1 font-bold text-lg pointer-events-none">
                      <Users size={14} /> {tavolo.clienti}
                    </div>
                  </div>
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
                    <button onClick={() => setEditingTable(tavolo)} className="p-3 bg-surface-light hover:bg-gold hover:text-black rounded-xl text-gray-400 transition-all"><Edit2 size={20} /></button>
                    <button onClick={() => deleteTable(tavolo.id)} className="p-3 bg-surface-light hover:bg-red-500 hover:text-white rounded-xl text-gray-400 transition-all"><Trash2 size={20} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* Edit Modal (Glassmorphism) */}
      {editingTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-md">
          <div className="bg-surface border border-surface-light w-full max-w-md rounded-[40px] shadow-[0_0_100px_rgba(0,0,0,0.5)] overflow-hidden">
            <div className="p-10">
              <div className="flex justify-between items-center mb-10">
                <h2 className="text-2xl font-black tracking-tight uppercase">Gestisci {editingTable.nome}</h2>
                <button onClick={() => setEditingTable(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X /></button>
              </div>

              <div className="space-y-6 max-h-[60vh] overflow-y-auto px-1 custom-scrollbar">
                {/* Sala Assignment */}
                <div className="space-y-3">
                  <label className="text-xs font-black text-gray-400 tracking-widest uppercase">Sposta in un'altra sala</label>
                  <div className="flex gap-2">
                    {SALE.map(sala => (
                      <button
                        key={sala}
                        onClick={() => setEditingTable({ ...editingTable, sala })}
                        className={`flex-1 py-3 rounded-xl font-bold text-[10px] transition-all border ${editingTable.sala === sala ? 'bg-gold border-gold text-black shadow-lg shadow-gold/20' : 'bg-charcoal border-surface-light text-gray-500'}`}
                      >
                        {sala}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Name Input */}
                <div className="space-y-3">
                  <label className="text-xs font-black text-gray-400 tracking-widest uppercase">Nome Tavolo</label>
                  <input
                    type="text"
                    value={editingTable.nome}
                    onChange={e => setEditingTable({ ...editingTable, nome: e.target.value })}
                    className="w-full bg-charcoal border border-surface-light rounded-2xl p-4 text-white font-bold outline-none focus:border-gold transition-colors"
                  />
                </div>

                {/* Status Toggle */}
                <div className="space-y-3">
                  <label className="text-xs font-black text-gray-400 tracking-widest uppercase">Stato Tavolo</label>
                  <div className="flex gap-2">
                    {['LIBERO', 'OCCUPATO', 'PRENOTATO'].map(status => (
                      <button
                        key={status}
                        onClick={() => setEditingTable({ ...editingTable, status: status as any })}
                        className={`flex-1 py-3 rounded-xl font-black text-[10px] tracking-wider transition-all border ${editingTable.status === status ? 'bg-gold border-gold text-black shadow-lg shadow-gold/20' : 'bg-charcoal border-surface-light text-gray-500'}`}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Customer Count */}
                <div className="space-y-3">
                  <label className="text-xs font-black text-gray-400 tracking-widest uppercase">Numero Clienti</label>
                  <div className="flex items-center justify-between bg-charcoal border border-surface-light rounded-2xl p-2 px-4">
                    <button
                      onClick={() => setEditingTable({ ...editingTable, clienti: Math.max(0, editingTable.clienti - 1) })}
                      className="w-10 h-10 flex items-center justify-center bg-surface hover:bg-gold hover:text-black rounded-xl text-gold"
                    >
                      <Plus size={16} className="rotate-45" />
                    </button>
                    <span className="text-3xl font-black text-white">{editingTable.clienti}</span>
                    <button
                      onClick={() => setEditingTable({ ...editingTable, clienti: editingTable.clienti + 1 })}
                      className="w-10 h-10 flex items-center justify-center bg-surface hover:bg-gold hover:text-black rounded-xl text-gold"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>

                {/* Shape Toggle */}
                <div className="space-y-3">
                  <label className="text-xs font-black text-gray-400 tracking-widest uppercase">Forma</label>
                  <div className="flex gap-3">
                    <button onClick={() => setEditingTable({ ...editingTable, shape: 'SQUARE' })} className={`flex-1 p-3 rounded-2xl border ${editingTable.shape === 'SQUARE' ? 'border-gold bg-gold/10' : 'border-surface-light'} transition-all flex flex-col items-center gap-2`}>
                      <div className="w-8 h-8 bg-gold/50 rounded-lg"></div>
                      <span className="text-[10px] font-bold">QUADRATO</span>
                    </button>
                    <button onClick={() => setEditingTable({ ...editingTable, shape: 'ROUND' })} className={`flex-1 p-3 rounded-2xl border ${editingTable.shape === 'ROUND' ? 'border-gold bg-gold/10' : 'border-surface-light'} transition-all flex flex-col items-center gap-2`}>
                      <div className="w-8 h-8 bg-gold/50 rounded-full"></div>
                      <span className="text-[10px] font-bold">ROTONDO</span>
                    </button>
                    <button onClick={() => setEditingTable({ ...editingTable, shape: 'RECTANGLE' })} className={`flex-1 p-3 rounded-2xl border ${editingTable.shape === 'RECTANGLE' ? 'border-gold bg-gold/10' : 'border-surface-light'} transition-all flex flex-col items-center gap-2`}>
                      <div className="w-12 h-6 bg-gold/50 rounded-lg"></div>
                      <span className="text-[10px] font-bold">RETTANGOLO</span>
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => {
                    if (onSelectTable) {
                      onSelectTable(editingTable.id, editingTable.nome);
                      setEditingTable(null);
                    }
                  }}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-3 transition-opacity active:opacity-80 mt-6 shadow-xl"
                >
                  <ShoppingCart size={20} /> ORDINA AL TAVOLO
                </button>

                <button
                  onClick={() => { updateTable(editingTable.id, editingTable); setEditingTable(null); }}
                  className="w-full bg-surface-light hover:bg-white/20 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-3 transition-opacity active:opacity-80 mt-3 border border-surface-light"
                >
                  <Save size={20} /> SALVA MODIFICHE
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
