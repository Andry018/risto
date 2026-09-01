import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Tavolo, Reservation } from '../types/entities';
import {
  Sun, Map as MapIcon, ChefHat, Calculator, CalendarDays,
  FilePlus, Zap, History, PauseCircle, Package, Users,
  Settings, ArrowRight, ArrowLeft, UserPlus, Table2, X, Clock, ShieldCheck, Receipt
} from 'lucide-react';
import PrinterStatusBadge from '../components/PrinterStatusBadge';
import { SETTINGS_KEYS, useSetting } from '../lib/appSettings';
import { toLocalISODate } from '../lib/dateUtils';

type Section = 'hub' | 'sala';

export default function StaffDashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [section, setSection] = useState<Section>(
    (searchParams.get('section') as Section) || 'hub'
  );

  function goToSection(s: Section) {
    setSection(s);
    setSearchParams(s === 'hub' ? {} : { section: s }, { replace: true });
  }
  const [tables, setTables] = useState<Tavolo[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [restaurantName] = useSetting(SETTINGS_KEYS.restaurantName, 'IL GIRASOLE');
  const [restaurantTagline] = useSetting(SETTINGS_KEYS.restaurantTagline, 'Ristorante Italiano');
  const [now, setNow] = useState(() => new Date());

  // Settings State
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const [newOrderName, setNewOrderName] = useState('');

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    async function fetchData() {
      if (!supabase) return;
      const today = toLocalISODate();

      const [tablesRes, reservationsRes] = await Promise.all([
        supabase.from('tavoli').select('*').order('nome'),
        supabase.from('prenotazioni').select('*').eq('data', today).order('ora')
      ]);

      if (tablesRes.data) setTables(tablesRes.data);
      if (reservationsRes.data) setReservations(reservationsRes.data);
      setLoading(false);
    }

    fetchData();

    const sb = supabase;
    if (!sb) return;

    const channel = sb.channel('dashboard-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tavoli' }, () => void fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prenotazioni' }, () => void fetchData())
      .subscribe();

    return () => {
      sb.removeChannel(channel);
    };
  }, []);

  const occupiedCount = tables.filter(t => t.status === 'OCCUPATO').length;
  const availableCount = tables.filter(t => t.status === 'LIBERO').length;
  const reservedCount = tables.filter(t => t.status === 'PRENOTATO').length;
  const expectedPeople = reservations.reduce((sum, r) => sum + (r.persone || 0), 0);

  const timeStr = now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });


  return (
    <div className="h-dvh bg-charcoal text-white flex flex-col font-sans overflow-hidden">
      {/* Header */}
      <div className="flex justify-between items-center py-5 px-5 md:px-8 shrink-0">
        <div className="flex items-center gap-3">
          {section !== 'hub' && (
            <button
              onClick={() => goToSection('hub')}
              className="p-2 -ml-1 mr-1 bg-surface border border-surface-light rounded-xl text-gray-400 hover:text-white transition-colors cursor-pointer"
              title="Torna alle sezioni"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <div className="text-gold">
             <Sun size={38} strokeWidth={1.5} />
          </div>
          <div>
             <h1 className="text-[26px] md:text-[28px] font-serif tracking-widest text-[#f5f5f5] leading-tight">{restaurantName}</h1>
             <p className="text-[10px] tracking-[0.2em] text-gold uppercase font-semibold">
               {section === 'hub' ? restaurantTagline : 'Sala'}
             </p>
          </div>
        </div>
        <div className="flex items-center gap-5">
          <div className="hidden md:flex items-center gap-3 mr-2">
            <div className="text-right">
              <p className="text-xl font-black text-white leading-none tabular-nums">{timeStr}</p>
              <p className="text-[10px] font-bold text-gray-500 capitalize mt-0.5">{dateStr}</p>
            </div>
            <Clock size={22} className="text-gold" />
          </div>
          <PrinterStatusBadge />
          <button
            onClick={() => navigate('/settings')}
            className="text-white hover:text-gold transition-colors cursor-pointer"
            title="Impostazioni"
          >
            <Settings size={28} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {section === 'hub' && (
        <div className="flex-1 min-h-0 flex flex-col px-5 md:px-8 pb-5 gap-4 overflow-hidden">

          {/* KPI Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
            <KpiCard label="Tavoli occupati" value={occupiedCount} accent="gold"  icon={<Table2 size={18} />} />
            <KpiCard label="Tavoli liberi"   value={availableCount} accent="green" icon={<MapIcon size={18} />} />
            <KpiCard label="Prenotati oggi"  value={reservedCount}  accent="blue"  icon={<CalendarDays size={18} />} />
            <KpiCard label="Persone attese"  value={expectedPeople} accent="gray"  icon={<UserPlus size={18} />} />
          </div>

          {/* Sezioni macro — riempiono lo spazio restante */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 flex-1 min-h-0">
            <BigSectionCard
              title="Sala"
              desc="Tavoli, conto e POS"
              icon={<MapIcon size={36} strokeWidth={1.2} />}
              accent="gold"
              onClick={() => goToSection('sala')}
            />
            <BigSectionCard
              title="Cucina"
              desc="Comande & menu"
              icon={<ChefHat size={36} strokeWidth={1.2} />}
              accent="orange"
              onClick={() => navigate('/kitchen?tab=menu')}
            />
            <BigSectionCard
              title="Magazzino"
              desc="Inventario & scorte"
              icon={<Package size={36} strokeWidth={1.2} />}
              accent="blue"
              onClick={() => navigate('/magazzino')}
            />
            <BigSectionCard
              title="HACCP"
              desc="Etichette & tracciabilità"
              icon={<ShieldCheck size={36} strokeWidth={1.2} />}
              accent="green"
              onClick={() => navigate('/haccp')}
            />
            <BigSectionCard
              title="Personale"
              desc="Staff & impostazioni"
              icon={<Users size={36} strokeWidth={1.2} />}
              accent="purple"
              onClick={() => navigate('/settings?section=personale')}
            />
            <BigSectionCard
              title="Cassa Fiscale"
              desc="Chiusura Z & Rapporto X"
              icon={<Receipt size={36} strokeWidth={1.2} />}
              accent="red"
              onClick={() => navigate('/cassa')}
              badge={(() => {
                try {
                  const log = JSON.parse(localStorage.getItem('risto_z_log') || '[]') as { date: string }[];
                  const today = new Date().toISOString().slice(0, 10);
                  return !log.find(e => e.date === today);
                } catch { return false; }
              })()}
            />
          </div>
        </div>
      )}

      {section === 'sala' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 px-5 md:px-8 flex-1 min-h-0 py-5 overflow-y-auto custom-scrollbar">

          {/* MAPPA */}
          <div className="bg-surface border border-surface-light rounded-[24px] flex flex-col p-6 relative">
            <div className="flex justify-between items-start mb-5 shrink-0">
               <div>
                  <h2 className="text-xl font-bold text-white mb-1">MAPPA</h2>
                  <p className="text-[11px] text-gold">Visualizza & gestisci tavoli</p>
               </div>
               <div className="text-gold">
                  <MapIcon size={30} strokeWidth={1.5} />
               </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col items-center">
              <div className="w-full border border-surface-light rounded-xl p-3 mb-5">
                <div className={`grid gap-2 w-full ${tables.length > 12 ? 'grid-cols-4' : 'grid-cols-3'}`}>
                  {tables.map(t => (
                    <div key={t.id} className={`rounded-lg border py-2.5 flex items-center justify-center text-xs font-bold transition ${
                       t.status === 'OCCUPATO' ? 'border-gold bg-gold/10 text-gold' :
                       t.status === 'LIBERO' ? 'border-emerald-400/40 bg-emerald-400/5 text-emerald-400' :
                       'border-gray-500/40 bg-gray-500/5 text-gray-400'
                    }`}>
                      {t.nome}
                    </div>
                  ))}
                  {tables.length === 0 && !loading && (
                    <div className="col-span-full text-center text-[11px] text-gray-500 py-4">Nessun tavolo</div>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-5 shrink-0">
               <button onClick={() => navigate('/map')} className="w-full bg-gold text-black font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 hover:bg-gold-hover transition active:scale-[0.98] cursor-pointer">
                  Apri Mappa <ArrowRight size={18} />
               </button>
            </div>
          </div>

          {/* POS */}
          <div className="bg-surface border border-surface-light rounded-[24px] flex flex-col p-6 relative">
            <div className="flex justify-between items-start mb-5 shrink-0">
               <div>
                  <h2 className="text-xl font-bold text-white mb-1">POS</h2>
                  <p className="text-[11px] text-gold">Crea conto (senza tavolo)</p>
               </div>
               <div className="text-gold">
                  <Calculator size={30} strokeWidth={1.5} />
               </div>
            </div>

            <div className="flex-1 grid grid-cols-2 gap-3 min-h-0">
                <PosBox icon={<FilePlus size={24} />} title="Nuovo Conto" desc="Apri un nuovo conto" onClick={() => { setShowNewOrderModal(true); setNewOrderName(''); }} />
               <PosBox icon={<Zap size={24} />} title="Vendita Rapida" desc="Piatti veloci, asporto" onClick={() => navigate('/pos')} />
               <PosBox icon={<History size={24} />} title="Conti Recenti" desc="Visualizza transazioni" onClick={() => navigate('/pos')} />
               <PosBox icon={<PauseCircle size={24} />} title="Conti in Sospeso" desc="Visualizza o riprendi" onClick={() => navigate('/pos?showHold=true')} />
            </div>

            <div className="pt-5 shrink-0">
               <button onClick={() => navigate('/pos')} className="w-full bg-gold text-black font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 hover:bg-gold-hover transition active:scale-[0.98] cursor-pointer">
                  Apri POS <ArrowRight size={18} />
               </button>
            </div>
          </div>

          {/* PRENOTAZIONI */}
          <div className="bg-surface border border-surface-light rounded-[24px] flex flex-col p-6 relative">
            <div className="flex justify-between items-start mb-5 shrink-0">
               <div>
                  <h2 className="text-xl font-bold text-white mb-1">PRENOTAZIONI</h2>
                  <p className="text-[11px] text-gold">Visualizza & gestisci prenotazioni</p>
               </div>
               <div className="text-gold">
                  <CalendarDays size={30} strokeWidth={1.5} />
               </div>
            </div>

            <div className="flex justify-between items-center mb-4 shrink-0">
                <span className="text-[10px] font-bold tracking-widest text-gray-500 uppercase">OGGI</span>
                <span className="text-[11px] text-gray-500 capitalize">{dateStr}</span>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-1">
                {reservations.map(r => (
                  <div key={r.id} className="flex justify-between items-center border-b border-surface-light pb-4 last:border-0 last:pb-0">
                    <div>
                      <h4 className="text-[13px] font-bold text-white mb-1">{r.ora?.split(':').slice(0, 2).join(':')}</h4>
                      <p className="text-[11px] text-gray-500">{r.persone} Persone</p>
                      <p className="text-[11px] text-gray-500">{r.nome}</p>
                    </div>
                    <span className={`px-2.5 py-1 rounded border text-[10px] uppercase tracking-wider font-semibold ${
                       r.status === 'CONFERMATA' ? 'border-gold text-gold' :
                       r.status === 'ARRIVATA' ? 'border-emerald-400/40 text-emerald-400' :
                       'border-gray-500/40 text-gray-400'
                    }`}>
                       {r.status}
                    </span>
                  </div>
                ))}
                {reservations.length === 0 && !loading && (
                   <div className="h-full flex items-center justify-center text-gray-500 text-[11px]">Nessuna prenotazione oggi</div>
                )}
            </div>

            <div className="pt-5 shrink-0">
                <button onClick={() => navigate('/reservations')} className="w-full bg-gold text-black font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 hover:bg-gold-hover transition active:scale-[0.98] cursor-pointer">
                   Apri Prenotazioni <ArrowRight size={18} />
                </button>
            </div>
          </div>

        </div>
      )}

      {/* New Order Modal */}
      {showNewOrderModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="bg-surface border border-surface-light w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden p-8 relative animate-in zoom-in-95 duration-200">
            <button onClick={() => setShowNewOrderModal(false)} className="absolute top-6 right-6 text-gray-500 hover:text-white transition cursor-pointer">
              <X size={20} />
            </button>
            <h2 className="text-2xl font-black text-white mb-6">Nuovo Conto</h2>
            <div className="space-y-3">
              <button
                onClick={() => { setShowNewOrderModal(false); navigate('/map'); }}
                className="w-full flex items-center gap-4 p-5 bg-charcoal border border-surface-light rounded-2xl hover:border-gold/40 transition-all group text-left"
              >
                <div className="w-12 h-12 rounded-2xl bg-gold/10 flex items-center justify-center shrink-0 group-hover:bg-gold/20 transition-all">
                  <Table2 size={24} className="text-gold" />
                </div>
                <div>
                  <p className="font-bold text-white group-hover:text-gold transition-colors">Apri su Tavolo</p>
                  <p className="text-xs text-gray-500 mt-0.5">Seleziona un tavolo dalla mappa</p>
                </div>
              </button>
              <div className="flex items-center gap-3 py-1">
                <div className="flex-1 h-px bg-surface-light" />
                <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">oppure</span>
                <div className="flex-1 h-px bg-surface-light" />
              </div>
              <div>
                <button
                  onClick={() => { if (newOrderName.trim()) { setShowNewOrderModal(false); navigate(`/pos?tableName=${encodeURIComponent(newOrderName.trim())}`); } }}
                  className="w-full flex items-center gap-4 p-5 bg-charcoal border border-surface-light rounded-2xl hover:border-gold/40 transition-all group text-left mb-3"
                >
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center shrink-0 group-hover:bg-emerald-500/20 transition-all">
                    <UserPlus size={24} className="text-emerald-400" />
                  </div>
                  <div>
                    <p className="font-bold text-white group-hover:text-emerald-400 transition-colors">Apri con Nome</p>
                    <p className="text-xs text-gray-500 mt-0.5">Per eventi, feste o conti sospesi</p>
                  </div>
                </button>
                <input
                  type="text"
                  value={newOrderName}
                  onChange={e => setNewOrderName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && newOrderName.trim()) { setShowNewOrderModal(false); navigate(`/pos?tableName=${encodeURIComponent(newOrderName.trim())}`); } }}
                  placeholder="Inserisci nome cliente o evento..."
                  className="w-full bg-charcoal border border-surface-light rounded-xl py-3 px-4 text-white text-sm font-bold outline-none focus:border-gold transition-all placeholder:text-gray-600"
                  autoFocus
                />
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

type Accent = 'gold' | 'green' | 'gray' | 'blue' | 'orange' | 'purple' | 'red';

const accentClasses: Record<Accent, { icon: string; border: string; glow: string; bg: string }> = {
  gold:   { icon: 'text-gold',        border: 'hover:border-gold/50',        glow: 'group-hover:bg-gold/10',        bg: 'bg-gold/10' },
  green:  { icon: 'text-emerald-400', border: 'hover:border-emerald-500/50', glow: 'group-hover:bg-emerald-500/10', bg: 'bg-emerald-500/10' },
  blue:   { icon: 'text-sky-400',     border: 'hover:border-sky-500/50',     glow: 'group-hover:bg-sky-500/10',     bg: 'bg-sky-500/10' },
  orange: { icon: 'text-orange-400',  border: 'hover:border-orange-500/50',  glow: 'group-hover:bg-orange-500/10', bg: 'bg-orange-500/10' },
  purple: { icon: 'text-violet-400',  border: 'hover:border-violet-500/50',  glow: 'group-hover:bg-violet-500/10', bg: 'bg-violet-500/10' },
  gray:   { icon: 'text-gray-400',    border: 'hover:border-gray-500/50',    glow: 'group-hover:bg-gray-500/10',   bg: 'bg-gray-500/10' },
  red:    { icon: 'text-red-400',     border: 'hover:border-red-500/50',     glow: 'group-hover:bg-red-500/10',    bg: 'bg-red-500/10' },
};

function KpiCard({ label, value, accent, icon }: { label: string; value: number; accent: Accent; icon: React.ReactNode }) {
  const a = accentClasses[accent];
  return (
    <div className="bg-surface border border-surface-light rounded-2xl p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${a.bg} ${a.icon}`}>
        {icon}
      </div>
      <div>
        <p className={`text-3xl font-black leading-none ${a.icon}`}>{value}</p>
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mt-1">{label}</p>
      </div>
    </div>
  );
}

function BigSectionCard({ title, desc, icon, accent, onClick, badge }: {
  title: string; desc: string; icon: React.ReactNode; accent: Accent; onClick: () => void; badge?: boolean;
}) {
  const a = accentClasses[accent];
  return (
    <button
      onClick={onClick}
      className={`relative group bg-surface border border-surface-light ${a.border} rounded-3xl p-7 flex flex-col justify-between transition-all duration-200 active:scale-[0.97] cursor-pointer h-full min-h-[180px]`}
    >
      {badge && (
        <span className="absolute top-4 right-4 w-3 h-3 rounded-full bg-red-500 ring-2 ring-charcoal" />
      )}
      <div className={`w-16 h-16 rounded-2xl ${a.bg} ${a.glow} flex items-center justify-center transition-colors duration-200 ${a.icon}`}>
        {icon}
      </div>
      <div className="text-left mt-4">
        <p className={`text-2xl font-black uppercase tracking-tight text-white group-hover:${a.icon} transition-colors`}>{title}</p>
        <p className="text-xs text-gray-500 mt-1 font-medium">{desc}</p>
      </div>
    </button>
  );
}

function PosBox({ icon, title, desc, onClick }: { icon: React.ReactNode, title: string, desc: string, onClick?: () => void }) {
  return (
    <button onClick={onClick} className="bg-transparent border border-surface-light rounded-2xl p-4 flex flex-col items-center justify-center gap-3 group hover:border-gold/50 transition h-full text-center cursor-pointer">
      <div className="text-gold">{icon}</div>
      <div>
        <h3 className="text-[13px] font-semibold text-[#f5f5f5] group-hover:text-gold transition">{title}</h3>
        <p className="text-[10px] text-gray-500 mt-1">{desc}</p>
      </div>
    </button>
  );
}
