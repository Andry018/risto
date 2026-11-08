import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Tavolo, Reservation } from '../types/entities';
import {
  Sun, Map as MapIcon, ChefHat, Calculator, CalendarDays,
  FilePlus, Zap, History, PauseCircle, Package, Users,
  Settings, ArrowRight, ArrowLeft, UserPlus, Table2, X, Clock, ShieldCheck, Receipt, Info, MessageCircle, Minus, Plus
} from 'lucide-react';
import PrinterStatusBadge from '../components/PrinterStatusBadge';
import { SETTINGS_KEYS, useSetting } from '../lib/appSettings';
import { toLocalISODate } from '../lib/dateUtils';
import ChangelogModal from './ChangelogModal';
import Dialog from './Dialog';
import { useWaUnread } from '../lib/whatsapp';
import { syncManager } from '../lib/OfflineSync';
import { salaDi } from '../lib/salas';
import { confirmedFor, pickReservation } from '../lib/tableReservations';

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
  const [showChangelog, setShowChangelog] = useState(false);
  /** Apertura dei conti in corso, per nome tavolo (ordini.nome_cliente = tavoli.nome) */
  const [tableOpenedAt, setTableOpenedAt] = useState<Record<string, string>>({});
  const [coversTable, setCoversTable] = useState<{ tavolo: Tavolo; coperti: number; prenotazione?: Reservation } | null>(null);
  const [openingTable, setOpeningTable] = useState(false);
  const waUnread = useWaUnread();

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    async function fetchData() {
      if (!supabase) return;
      const today = toLocalISODate();

      const [tablesRes, reservationsRes, ordersRes] = await Promise.all([
        supabase.from('tavoli').select('*').order('nome'),
        supabase.from('prenotazioni').select('*').eq('data', today).order('ora'),
        supabase.from('ordini').select('nome_cliente, created_at').eq('status', 'IN_ATTESA'),
      ]);

      if (tablesRes.data) setTables(tablesRes.data);
      if (reservationsRes.data) setReservations(reservationsRes.data);
      if (ordersRes.data) {
        const opened: Record<string, string> = {};
        for (const o of ordersRes.data as { nome_cliente: string | null; created_at: string | null }[]) {
          if (!o.nome_cliente || !o.created_at) continue;
          if (!opened[o.nome_cliente] || o.created_at < opened[o.nome_cliente]) opened[o.nome_cliente] = o.created_at;
        }
        setTableOpenedAt(opened);
      }
      setLoading(false);
    }

    fetchData();

    const sb = supabase;
    if (!sb) return;

    const channel = sb.channel('dashboard-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tavoli' }, () => void fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prenotazioni' }, () => void fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ordini' }, () => void fetchData())
      .subscribe();

    return () => {
      sb.removeChannel(channel);
    };
  }, []);

  const occupiedCount = tables.filter(t => t.status === 'OCCUPATO').length;
  const availableCount = tables.filter(t => t.status === 'LIBERO').length;
  const reservedCount = tables.filter(t => t.status === 'PRENOTATO').length;
  const expectedPeople = reservations.reduce((sum, r) => sum + (r.persone || 0), 0);

  // Tavoli raggruppati per sala, ordinati per nome "naturale" (2 prima di 10)
  const tableGroups = Object.entries(
    [...tables]
      .sort((a, b) => a.nome.localeCompare(b.nome, 'it', { numeric: true }))
      .reduce<Record<string, Tavolo[]>>((acc, t) => { (acc[salaDi(t)] ||= []).push(t); return acc; }, {})
  );

  function goToPos(t: Tavolo) {
    navigate(`/pos?tableId=${t.id}&tableName=${encodeURIComponent(t.nome)}`);
  }

  function handleTableTap(t: Tavolo) {
    if (t.status === 'OCCUPATO') { goToPos(t); return; }
    const prenotazione = pickReservation(confirmedFor(reservations, t.id), now);
    setCoversTable({ tavolo: t, coperti: prenotazione?.persone || t.clienti || 2, prenotazione });
  }

  async function openTable() {
    if (!coversTable || openingTable) return;
    const { tavolo, coperti, prenotazione } = coversTable;
    setOpeningTable(true);
    try {
      // Il POS legge i coperti dal tavolo per aggiungere il COPERTO: vanno scritti prima di navigare
      await syncManager.pushTableUpdate(tavolo.id, { status: 'OCCUPATO', clienti: coperti });
      if (prenotazione && supabase) {
        await supabase.from('prenotazioni').update({ status: 'ARRIVATA' }).eq('id', prenotazione.id);
      }
      setCoversTable(null);
      goToPos(tavolo);
    } finally {
      setOpeningTable(false);
    }
  }

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
              aria-label="Torna alle sezioni"
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
              <p className="text-[10px] font-bold text-gray-400 capitalize mt-0.5">{dateStr}</p>
            </div>
            <Clock size={22} className="text-gold" />
          </div>
          <PrinterStatusBadge />
          <button
            onClick={() => navigate('/whatsapp')}
            className="relative text-white hover:text-emerald-400 transition-colors cursor-pointer"
            title="WhatsApp"
            aria-label={waUnread ? `WhatsApp, ${waUnread} messaggi non letti` : 'WhatsApp'}
          >
            <MessageCircle size={28} strokeWidth={1.5} />
            {waUnread > 0 && (
              <span className="absolute -top-1.5 -right-2 min-w-[1.25rem] h-5 px-1 rounded-full bg-emerald-500 text-black text-[11px] font-bold flex items-center justify-center ring-2 ring-charcoal">
                {waUnread > 99 ? '99+' : waUnread}
              </span>
            )}
          </button>
          <button
            onClick={() => setShowChangelog(true)}
            className="text-white hover:text-gold transition-colors cursor-pointer"
            title="Novità e changelog"
            aria-label="Novità e changelog"
          >
            <Info size={28} strokeWidth={1.5} />
          </button>
          <button
            onClick={() => navigate('/settings')}
            className="text-white hover:text-gold transition-colors cursor-pointer"
            title="Impostazioni"
            aria-label="Impostazioni"
          >
            <Settings size={28} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      <ChangelogModal isOpen={showChangelog} onClose={() => setShowChangelog(false)} />

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
                  return !log.find(e => e.date === toLocalISODate());
                } catch { return false; }
              })()}
            />
          </div>
        </div>
      )}

      {/* Da tablet in su le card riempiono l'altezza disponibile (righe a 1fr con un minimo):
          i pulsanti "Apri …" restano visibili e scorrono solo le liste interne. */}
      {section === 'sala' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 md:grid-rows-[minmax(20rem,1fr)_minmax(20rem,1fr)] lg:grid-rows-[minmax(24rem,1fr)] gap-4 px-5 md:px-8 flex-1 min-h-0 py-5 overflow-y-auto custom-scrollbar">

          {/* MAPPA */}
          <div className="bg-surface border border-surface-light rounded-[24px] flex flex-col p-6 relative min-h-0">
            <div className="flex justify-between items-start mb-5 shrink-0">
               <div>
                  <h2 className="text-xl font-bold text-white mb-1">MAPPA</h2>
                  <p className="text-[11px] text-gold">Tocca un tavolo per aprirlo</p>
               </div>
               <div className="text-gold">
                  <MapIcon size={30} strokeWidth={1.5} />
               </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar -mx-1 px-1 space-y-4">
              {tableGroups.map(([sala, list]) => (
                <div key={sala}>
                  {tableGroups.length > 1 && (
                    <p className="text-[10px] font-bold tracking-widest text-gray-400 uppercase mb-2">{sala}</p>
                  )}
                  <div className="grid grid-cols-3 xl:grid-cols-4 gap-2">
                    {list.map(t => (
                      <TableTile
                        key={t.id}
                        tavolo={t}
                        apertoDa={tableOpenedAt[t.nome]}
                        prenotazione={pickReservation(confirmedFor(reservations, t.id), now)}
                        altrePrenotazioni={Math.max(0, confirmedFor(reservations, t.id).length - 1)}
                        now={now}
                        onClick={() => handleTableTap(t)}
                      />
                    ))}
                  </div>
                </div>
              ))}
              {tables.length === 0 && !loading && (
                <div className="text-center text-[11px] text-gray-400 py-4">Nessun tavolo</div>
              )}
            </div>

            <div className="pt-5 shrink-0">
               <button onClick={() => navigate('/map')} className="w-full bg-gold text-black font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 hover:bg-gold-hover transition active:scale-[0.98] cursor-pointer">
                  Apri Mappa <ArrowRight size={18} />
               </button>
            </div>
          </div>

          {/* POS */}
          <div className="bg-surface border border-surface-light rounded-[24px] flex flex-col p-6 relative min-h-0">
            <div className="flex justify-between items-start mb-5 shrink-0">
               <div>
                  <h2 className="text-xl font-bold text-white mb-1">POS</h2>
                  <p className="text-[11px] text-gold">Conti senza tavolo e storico</p>
               </div>
               <div className="text-gold">
                  <Calculator size={30} strokeWidth={1.5} />
               </div>
            </div>

            <div className="flex-1 min-h-0 grid grid-rows-3 gap-3">
              <PosBox icon={<FilePlus size={24} />} title="Nuovo conto con nome" desc="Eventi, feste, conti senza tavolo" onClick={() => { setShowNewOrderModal(true); setNewOrderName(''); }} />
              <PosBox icon={<History size={24} />} title="Conti recenti" desc="Scontrini di oggi" onClick={() => navigate('/pos?showBills=day')} />
              <PosBox icon={<PauseCircle size={24} />} title="Conti in sospeso" desc="Visualizza o riprendi" onClick={() => navigate('/pos?showHold=true')} />
            </div>

            <div className="pt-5 shrink-0">
               <button onClick={() => navigate('/pos')} className="w-full bg-gold text-black font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 hover:bg-gold-hover transition active:scale-[0.98] cursor-pointer">
                  <Zap size={18} /> Vendita rapida
               </button>
            </div>
          </div>

          {/* PRENOTAZIONI */}
          <div className="bg-surface border border-surface-light rounded-[24px] flex flex-col p-6 relative min-h-0 md:col-span-2 lg:col-span-1">
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
                <span className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">OGGI</span>
                <span className="text-[11px] text-gray-400 capitalize">{dateStr}</span>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-1">
                {reservations.map(r => (
                  <div key={r.id} className="flex justify-between items-center border-b border-surface-light pb-4 last:border-0 last:pb-0">
                    <div>
                      <h4 className="text-[13px] font-bold text-white mb-1">{r.ora?.split(':').slice(0, 2).join(':')}</h4>
                      <p className="text-[11px] text-gray-400">{r.persone} Persone</p>
                      <p className="text-[11px] text-gray-400">{r.nome}</p>
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
                   <div className="h-full flex items-center justify-center text-gray-400 text-[11px]">Nessuna prenotazione oggi</div>
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
        <Dialog
          open
          onClose={() => setShowNewOrderModal(false)}
          label="Nuovo conto"
          closeOnOverlay={false}
          overlayClassName="z-[100] items-center p-6 bg-black/80 backdrop-blur-xl animate-in fade-in duration-300"
          panelClassName="bg-surface border border-surface-light w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden p-8 relative animate-in zoom-in-95 duration-200"
        >
            <button onClick={() => setShowNewOrderModal(false)} aria-label="Chiudi" className="absolute top-6 right-6 text-gray-400 hover:text-white transition cursor-pointer">
              <X size={20} />
            </button>
            <h2 className="text-2xl font-black text-white mb-6">Nuovo Conto</h2>
            <p className="text-sm text-gray-400 -mt-3 mb-5">Per eventi, feste o clienti senza tavolo. Per un tavolo, toccalo nella mappa.</p>
            <form
              onSubmit={e => { e.preventDefault(); if (newOrderName.trim()) { setShowNewOrderModal(false); navigate(`/pos?tableName=${encodeURIComponent(newOrderName.trim())}`); } }}
              className="space-y-3"
            >
              <input
                type="text"
                value={newOrderName}
                onChange={e => setNewOrderName(e.target.value)}
                placeholder="Nome cliente o evento..."
                className="w-full bg-charcoal border border-surface-light rounded-xl py-4 px-4 text-white text-base font-bold outline-none focus:border-gold transition-all placeholder:text-gray-400"
                autoFocus
              />
              <button
                type="submit"
                disabled={!newOrderName.trim()}
                className="w-full bg-gold text-black font-bold py-4 rounded-xl flex items-center justify-center gap-2 disabled:opacity-40 active:scale-[0.98] transition cursor-pointer"
              >
                Apri conto <ArrowRight size={18} />
              </button>
            </form>
        </Dialog>
      )}

      {/* Apertura tavolo: coperti */}
      {coversTable && (
        <Dialog
          open
          onClose={() => setCoversTable(null)}
          label={`Apri tavolo ${coversTable.tavolo.nome}`}
          overlayClassName="z-[100] items-center p-6 bg-black/80 backdrop-blur-xl animate-in fade-in duration-200"
          panelClassName="bg-surface border border-surface-light w-full max-w-sm rounded-[32px] shadow-2xl p-7 text-center relative"
        >
          <button onClick={() => setCoversTable(null)} aria-label="Chiudi" className="absolute top-5 right-5 text-gray-400 hover:text-white transition cursor-pointer">
            <X size={20} />
          </button>
          <h2 className="text-3xl font-black text-white">{coversTable.tavolo.nome}</h2>
          {coversTable.prenotazione ? (
            <p className="text-sm text-sky-300 font-bold mt-1">
              Prenotato: {coversTable.prenotazione.nome} · {coversTable.prenotazione.ora?.slice(0, 5)}
            </p>
          ) : (
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Coperti</p>
          )}
          <div className="flex items-center justify-between bg-charcoal border border-surface-light rounded-2xl p-3 my-6">
            <button
              onClick={() => setCoversTable(c => c && { ...c, coperti: Math.max(1, c.coperti - 1) })}
              aria-label="Meno coperti"
              className="w-14 h-14 flex items-center justify-center bg-surface rounded-xl text-gold active:scale-90 cursor-pointer"
            ><Minus size={26} /></button>
            <span className="text-5xl font-black text-white tabular-nums">{coversTable.coperti}</span>
            <button
              onClick={() => setCoversTable(c => c && { ...c, coperti: c.coperti + 1 })}
              aria-label="Più coperti"
              className="w-14 h-14 flex items-center justify-center bg-surface rounded-xl text-gold active:scale-90 cursor-pointer"
            ><Plus size={26} /></button>
          </div>
          <button
            onClick={() => void openTable()}
            disabled={openingTable}
            className="w-full bg-gold text-black font-black py-4 rounded-2xl text-lg flex items-center justify-center gap-2 active:scale-[0.98] transition disabled:opacity-50 cursor-pointer"
          >
            {coversTable.prenotazione ? 'Check-in e apri' : 'Apri tavolo'} <ArrowRight size={20} />
          </button>
        </Dialog>
      )}

    </div>
  );
}

type Accent = 'gold' | 'green' | 'gray' | 'blue' | 'orange' | 'purple' | 'red';

const accentClasses: Record<Accent, { icon: string; border: string; glow: string; bg: string; title: string }> = {
  gold:   { icon: 'text-gold',        border: 'hover:border-gold/50',        glow: 'group-hover:bg-gold/10',        bg: 'bg-gold/10',        title: 'group-hover:text-gold' },
  green:  { icon: 'text-emerald-400', border: 'hover:border-emerald-500/50', glow: 'group-hover:bg-emerald-500/10', bg: 'bg-emerald-500/10', title: 'group-hover:text-emerald-400' },
  blue:   { icon: 'text-sky-400',     border: 'hover:border-sky-500/50',     glow: 'group-hover:bg-sky-500/10',     bg: 'bg-sky-500/10',     title: 'group-hover:text-sky-400' },
  orange: { icon: 'text-orange-400',  border: 'hover:border-orange-500/50',  glow: 'group-hover:bg-orange-500/10', bg: 'bg-orange-500/10',  title: 'group-hover:text-orange-400' },
  purple: { icon: 'text-violet-400',  border: 'hover:border-violet-500/50',  glow: 'group-hover:bg-violet-500/10', bg: 'bg-violet-500/10',  title: 'group-hover:text-violet-400' },
  gray:   { icon: 'text-gray-400',    border: 'hover:border-gray-500/50',    glow: 'group-hover:bg-gray-500/10',   bg: 'bg-gray-500/10',    title: 'group-hover:text-gray-400' },
  red:    { icon: 'text-red-400',     border: 'hover:border-red-500/50',     glow: 'group-hover:bg-red-500/10',    bg: 'bg-red-500/10',     title: 'group-hover:text-red-400' },
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
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mt-1">{label}</p>
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
        <p className={`text-2xl font-black uppercase tracking-tight text-white ${a.title} transition-colors`}>{title}</p>
        <p className="text-xs text-gray-400 mt-1 font-medium">{desc}</p>
      </div>
    </button>
  );
}

function PosBox({ icon, title, desc, onClick }: { icon: React.ReactNode, title: string, desc: string, onClick?: () => void }) {
  return (
    <button onClick={onClick} className="bg-transparent border border-surface-light rounded-2xl px-4 py-2 flex items-center gap-4 group hover:border-gold/50 transition h-full min-h-0 overflow-hidden text-left cursor-pointer active:scale-[0.98]">
      <div className="text-gold shrink-0">{icon}</div>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-[#f5f5f5] group-hover:text-gold transition truncate">{title}</h3>
        <p className="text-[11px] text-gray-400 mt-0.5 truncate">{desc}</p>
      </div>
      <ArrowRight size={16} className="ml-auto shrink-0 text-gray-600 group-hover:text-gold transition" />
    </button>
  );
}

/** Tavolo nella card Sala: colore per stato, coperti e da quanto è aperto. */
function TableTile({ tavolo, apertoDa, prenotazione, altrePrenotazioni = 0, now, onClick }: {
  tavolo: Tavolo; apertoDa?: string; prenotazione?: Reservation; altrePrenotazioni?: number; now: Date; onClick: () => void;
}) {
  const occupato = tavolo.status === 'OCCUPATO';
  const prenotato = tavolo.status === 'PRENOTATO';
  let durata = '';
  if (occupato && apertoDa) {
    const mins = Math.max(0, Math.floor((now.getTime() - new Date(apertoDa).getTime()) / 60000));
    durata = mins < 60 ? `${mins}'` : `${Math.floor(mins / 60)}h${String(mins % 60).padStart(2, '0')}`;
  }
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border-2 min-h-[64px] px-1 py-2 flex flex-col items-center justify-center gap-1 transition active:scale-95 cursor-pointer ${
        occupato ? 'border-gold bg-gold/15 text-gold' :
        prenotato ? 'border-sky-400/60 bg-sky-400/10 text-sky-300' :
        'border-emerald-400/40 bg-emerald-400/5 text-emerald-400'
      }`}
    >
      <span className="text-base font-black leading-none text-white">{tavolo.nome}</span>
      {occupato && (
        <span className="flex items-center gap-1 text-[10px] font-bold leading-none">
          <Users size={10} /> {tavolo.clienti || 0}{durata && <> · {durata}</>}
        </span>
      )}
      {prenotato && prenotazione && (
        <span className="text-[10px] font-bold leading-none truncate max-w-full">{prenotazione.ora?.slice(0, 5)} {prenotazione.nome}{altrePrenotazioni > 0 && ` +${altrePrenotazioni}`}</span>
      )}
      {!occupato && !prenotato && <span className="text-[10px] font-bold leading-none">libero</span>}
    </button>
  );
}
