import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, IS_DEMO_MODE } from '../lib/supabase';
import type { Reservation, Tavolo } from '../types/entities';
import { Plus, X, Calendar, Clock, Users, CheckCircle2, Trash2, MapPin, ChevronLeft, ChevronRight, Edit3, Save, LayoutDashboard, ArrowLeft } from 'lucide-react';
import { useConfirm } from './ConfirmModal';
import { useToast } from './Toast';

export default function ReservationsView({ onNavigateHome }: { onNavigateHome?: () => void }) {
  const navigate = useNavigate();
  const { confirm } = useConfirm();
  const { addToast } = useToast();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [tables, setTables] = useState<Tavolo[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(false);
  
  // New Reservation State
  const [newRes, setNewRes] = useState<Partial<Reservation>>({
    nome: '',
    data: new Date().toISOString().split('T')[0],
    ora: '20:00',
    persone: 2,
    status: 'CONFERMATA',
    note: ''
  });

  const setOra = (val: string) => setNewRes(prev => ({ ...prev, ora: val.split(':').slice(0, 2).join(':') }));

  async function fetchReservations() {
    if (IS_DEMO_MODE) {
       setReservations([]);
       return;
    }
    if (!supabase) return;
    const { data } = await supabase
      .from('prenotazioni')
      .select('*')
      .eq('data', selectedDate)
      .order('ora', { ascending: true });
    if (data) setReservations(data);
  }

  async function fetchTables() {
    if (!supabase) return;
    const { data } = await supabase.from('tavoli').select('*').order('nome');
    if (data) setTables(data);
  }

  useEffect(() => {
    void fetchReservations();
    void fetchTables();
    
    if (!IS_DEMO_MODE && supabase) {
      const sb = supabase;
      const channel = sb.channel('public:prenotazioni')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'prenotazioni' }, () => void fetchReservations())
        .subscribe();
      return () => { sb.removeChannel(channel); };
    }
  }, [selectedDate]);

  async function setTableStatus(tavolo_id: string, status: 'PRENOTATO' | 'OCCUPATO' | 'LIBERO', clienti?: number) {
    const update: Partial<Tavolo> = { status };
    if (clienti !== undefined) update.clienti = clienti;
    if (status === 'LIBERO') update.clienti = 0;
    if (!IS_DEMO_MODE) {
      await supabase!.from('tavoli').update(update).eq('id', tavolo_id);
    }
  }

  async function handleSaveReservation() {
    if (!newRes.nome || !newRes.data || !newRes.ora || !supabase) return;
    setLoading(true);
    try {
      if (editingReservation) {
        const oldRes = editingReservation;
        await supabase.from('prenotazioni').update(newRes).eq('id', editingReservation.id);

        // Se cambia tavolo: libera il vecchio, prenota il nuovo
        if (oldRes.tavolo_id && oldRes.tavolo_id !== newRes.tavolo_id) {
          await setTableStatus(oldRes.tavolo_id, 'LIBERO');
        }
        if (newRes.tavolo_id && oldRes.tavolo_id !== newRes.tavolo_id) {
          await setTableStatus(newRes.tavolo_id, 'PRENOTATO');
        }
      } else {
        const { error } = await supabase.from('prenotazioni').insert([newRes]);
        if (error) throw error;

        if (newRes.tavolo_id) {
          await setTableStatus(newRes.tavolo_id, 'PRENOTATO');
        }
      }
      closeModal();
      fetchReservations();
    } catch {
      addToast({ type: 'error', title: 'Errore', message: 'Salvataggio prenotazione fallito' });
    } finally {
      setLoading(false);
    }
  }

  function openNewModal() {
    setEditingReservation(null);
    setNewRes({
      nome: '',
      data: selectedDate,
      ora: '20:00',
      persone: 2,
      status: 'CONFERMATA',
      note: ''
    });
    setIsModalOpen(true);
  }

  function openEditModal(res: Reservation) {
    setEditingReservation(res);
    setNewRes({ ...res, ora: res.ora?.split(':').slice(0, 2).join(':') ?? res.ora });
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingReservation(null);
  }

  async function handleCheckIn(res: Reservation) {
    if (!supabase) return;
    await supabase.from('prenotazioni').update({ status: 'ARRIVATA' }).eq('id', res.id);
    if (res.tavolo_id) {
      await setTableStatus(res.tavolo_id, 'OCCUPATO', res.persone);
    }
    fetchReservations();
  }

  async function handleCancel(res: Reservation) {
    const ok = await confirm({ title: 'Annulla prenotazione', message: `Annullare la prenotazione di ${res.nome}?` });
    if (!ok) return;
    if (!supabase) return;
    await supabase.from('prenotazioni').update({ status: 'ANNULLATA' }).eq('id', res.id);
    if (res.tavolo_id) {
      await setTableStatus(res.tavolo_id, 'LIBERO');
    }
    fetchReservations();
  }

  async function handleDelete(res: Reservation) {
    const ok = await confirm({ title: 'Elimina prenotazione', message: `Eliminare la prenotazione di ${res.nome}?`, destructive: true });
    if (!ok) return;
    if (!supabase) return;
    if (res.tavolo_id) {
      await setTableStatus(res.tavolo_id, 'LIBERO');
    }
    await supabase.from('prenotazioni').delete().eq('id', res.id);
    fetchReservations();
  }

  const changeDate = (days: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  return (
    <div className="flex-1 flex flex-col bg-charcoal text-white h-full overflow-hidden p-8">
      <header className="flex justify-between items-center mb-10">
        <div className="flex items-center gap-6">
          <button onClick={() => onNavigateHome ? onNavigateHome() : navigate('/')} className="p-3 bg-surface border border-surface-light rounded-2xl text-gray-500 hover:text-white transition-all shadow-xl" title="Torna indietro">
            <ArrowLeft size={24} />
          </button>
          <div>
            <h2 className="text-sm text-gold font-black tracking-widest uppercase italic">Gestione Clienti</h2>
            <h1 className="text-4xl font-black text-white uppercase italic">Libro Prenotazioni</h1>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4 bg-surface p-2 rounded-2xl border border-surface-light shadow-xl">
            <button onClick={() => changeDate(-1)} className="p-2 hover:bg-charcoal rounded-xl text-gray-500 hover:text-white transition-all"><ChevronLeft /></button>
            <div className="flex items-center gap-3 px-4">
              <Calendar className="text-gold" size={20} />
              <span className="text-lg font-black italic">{new Date(selectedDate).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}</span>
            </div>
            <button onClick={() => changeDate(1)} className="p-2 hover:bg-charcoal rounded-xl text-gray-500 hover:text-white transition-all"><ChevronRight /></button>
          </div>

          <button 
            onClick={openNewModal}
            className="bg-gold hover:bg-gold-hover text-black px-8 py-3.5 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-gold/20 flex items-center gap-2 active:scale-95 transition-all"
          >
            <Plus size={20} /> Nuova Prenotazione
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
        {reservations.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-600 opacity-50">
            <Calendar size={80} strokeWidth={1} className="mb-6" />
            <p className="text-xl font-black uppercase italic">Nessuna prenotazione per questo giorno</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {reservations.map(res => (
              <div key={res.id} className="bg-surface border border-surface-light p-8 rounded-[40px] flex items-center justify-between group hover:border-gold/30 transition-all shadow-2xl">
                <div className="flex items-center gap-12">
                  <div className="text-center min-w-[100px]">
                    <div className="flex items-center justify-center gap-2 text-gold mb-1">
                       <Clock size={14} />
                       <span className="text-[10px] font-black uppercase tracking-widest">Orario</span>
                    </div>
                    <p className="text-4xl font-black text-white italic">{res.ora?.split(':').slice(0, 2).join(':')}</p>
                  </div>
                  
                  <div className="w-px h-16 bg-surface-light" />
                  
                  <div>
                    <h3 className="text-3xl font-black text-white mb-1">{res.nome}</h3>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2 px-3 py-1 bg-charcoal border border-surface-light rounded-full text-xs font-bold text-gray-400">
                        <Users size={14} /> {res.persone} persone
                      </div>
                      {res.tavolo_id && (
                        <div className="flex items-center gap-2 px-3 py-1 bg-gold/10 border border-gold/20 rounded-full text-xs font-bold text-gold">
                          <MapPin size={14} /> {tables.find(t => t.id === res.tavolo_id)?.nome || 'Tavolo'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {res.status === 'ARRIVATA' ? (
                    <div className="flex items-center gap-2 px-6 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-500 font-black text-xs uppercase tracking-widest">
                       <CheckCircle2 size={16} /> ARRIVATO
                    </div>
                  ) : res.status === 'ANNULLATA' ? (
                    <div className="flex items-center gap-2 px-6 py-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-500 font-black text-xs uppercase tracking-widest">
                       ANNULLATO
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleCheckIn(res)}
                        className="bg-emerald-500 text-black px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
                      >
                        Check-in
                      </button>
                      <button 
                        onClick={() => handleCancel(res)}
                        className="bg-rose-500/10 text-rose-500 px-4 py-3 rounded-2xl font-black text-xs uppercase tracking-widest border border-rose-500/20 active:scale-95 transition-all"
                      >
                        Annulla
                      </button>
                    </div>
                  )}
                  <button onClick={() => openEditModal(res)} className="p-3 bg-charcoal hover:bg-gold/20 border border-surface-light rounded-2xl text-gray-600 hover:text-gold transition-all">
                    <Edit3 size={18} />
                  </button>
                  <button 
                    onClick={() => handleDelete(res)}
                    className="p-3 bg-charcoal hover:bg-red-500/10 border border-surface-light rounded-2xl text-gray-600 hover:text-red-500 transition-all"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New/Edit Reservation Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/90 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="bg-surface border border-surface-light w-full max-w-2xl rounded-[50px] shadow-2xl overflow-hidden">
            <div className="p-10">
              <div className="flex justify-between items-center mb-10">
                <div>
                  <h2 className="text-3xl font-black italic uppercase tracking-tighter text-white">{editingReservation ? 'Modifica' : 'Nuova'} <span className="text-gold">Prenotazione</span></h2>
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mt-1">Inserimento dati cliente e tavolo</p>
                </div>
                <button onClick={closeModal} className="p-4 bg-charcoal rounded-3xl text-gray-500 hover:text-white border border-surface-light">
                  <X size={28} />
                </button>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Nome Cliente</label>
                    <input 
                      type="text" 
                      placeholder="es. Mario Rossi"
                      value={newRes.nome}
                      onChange={e => setNewRes({...newRes, nome: e.target.value})}
                      className="w-full bg-charcoal border border-surface-light rounded-2xl p-4 text-white font-bold outline-none focus:border-gold transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Persone</label>
                    <div className="flex items-center justify-between bg-charcoal border border-surface-light rounded-2xl p-2 px-4">
                      <button onClick={() => setNewRes({...newRes, persone: Math.max(1, (newRes.persone || 2) - 1)})} className="w-10 h-10 bg-surface rounded-xl text-gold active:scale-90">-</button>
                      <span className="text-2xl font-black text-white">{newRes.persone}</span>
                      <button onClick={() => setNewRes({...newRes, persone: (newRes.persone || 2) + 1})} className="w-10 h-10 bg-surface rounded-xl text-gold active:scale-90">+</button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Data</label>
                    <input 
                      type="date" 
                      value={newRes.data}
                      onChange={e => setNewRes({...newRes, data: e.target.value})}
                      className="w-full bg-charcoal border border-surface-light rounded-2xl p-4 text-white font-bold outline-none focus:border-gold transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Orario</label>
                    <input 
                      type="time" 
                      value={newRes.ora}
                      onChange={e => setOra(e.target.value)}
                      className="w-full bg-charcoal border border-surface-light rounded-2xl p-4 text-white font-bold outline-none focus:border-gold transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Assegna Tavolo (Opzionale)</label>
                  <select 
                    value={newRes.tavolo_id || ''}
                    onChange={e => setNewRes({...newRes, tavolo_id: e.target.value || undefined})}
                    className="w-full bg-charcoal border border-surface-light rounded-2xl p-4 text-white font-bold outline-none focus:border-gold transition-all appearance-none"
                  >
                    <option value="">Nessun tavolo assegnato</option>
                    {tables.map(t => (
                      <option key={t.id} value={t.id}>{t.nome} ({t.sala}) {t.status === 'OCCUPATO' ? '🔴' : t.status === 'PRENOTATO' ? '🟡' : '🟢'}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Note (Opzionale)</label>
                  <textarea 
                    placeholder="Es. allergie, richieste speciali..."
                    value={newRes.note || ''}
                    onChange={e => setNewRes({...newRes, note: e.target.value})}
                    className="w-full bg-charcoal border border-surface-light rounded-2xl p-4 text-white font-bold outline-none focus:border-gold transition-all h-20"
                  />
                </div>

                <button 
                  onClick={handleSaveReservation}
                  disabled={loading}
                  className="w-full bg-gold hover:bg-gold-hover text-black font-black py-5 rounded-[32px] text-lg shadow-2xl shadow-gold/20 mt-8 active:scale-95 transition-all flex items-center justify-center gap-3"
                >
                  {editingReservation ? <Save size={24} /> : <Plus size={24} />} {editingReservation ? 'Salva Modifiche' : 'Conferma Prenotazione'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
