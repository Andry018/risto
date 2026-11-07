import type { ReactNode } from 'react';
import type { Reservation, Tavolo } from '../types/entities';
import type { StaffUser } from '../lib/staffAuth';
import { useWaUnread } from '../lib/whatsapp';
import {
  LayoutGrid, BookOpen, CalendarClock, ChefHat, Package, ShieldCheck, BarChart3, Settings,
  MessageCircle, LogOut, Info, WifiOff, ChevronRight, Users, Clock,
} from 'lucide-react';

interface Props {
  user: StaffUser | null;
  tables: Tavolo[];
  /** prenotazioni di oggi (CONFERMATA / ARRIVATA) */
  reservations: Reservation[];
  now: number;
  turnoPranzo: boolean;
  turnoSera: boolean;
  pendingSync: number;
  printerBadge: ReactNode;
  onOpenSala: () => void;
  onOpenReservations: () => void;
  onOpenTurno: () => void;
  onNavigate: (path: string) => void;
  onChangelog: () => void;
  onLogout: () => void;
}

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

function Tile({ icon, title, info, accent, badge, onClick }: {
  icon: ReactNode; title: string; info?: string; accent: string; badge?: number; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="relative bg-surface border border-surface-light rounded-2xl p-3.5 flex flex-col items-start gap-2 text-left active:scale-[0.97] transition-all min-h-[104px]"
    >
      <span className={`w-10 h-10 rounded-xl flex items-center justify-center ${accent}`}>{icon}</span>
      <span className="font-bold text-white text-[15px] leading-tight">{title}</span>
      {info && <span className="text-xs text-gray-400 leading-tight -mt-1">{info}</span>}
      {!!badge && badge > 0 && (
        <span className="absolute top-2.5 right-2.5 min-w-6 h-6 px-1.5 rounded-full bg-emerald-500 text-black text-xs font-black flex items-center justify-center tabular-nums">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  );
}

/** Schermata iniziale del telefono: la sala dal vivo in grande, il resto in una griglia a colpo d'occhio. */
export default function WaiterHub({
  user, tables, reservations, now, turnoPranzo, turnoSera, pendingSync, printerBadge,
  onOpenSala, onOpenReservations, onOpenTurno, onNavigate, onChangelog, onLogout,
}: Props) {
  const waUnread = useWaUnread();
  const role = user?.role;
  const isAdmin = !user || role === 'admin';
  const canKitchen = isAdmin || role === 'kitchen';
  const canWa = isAdmin || role === 'waiter';

  const occupied = tables.filter(t => t.status === 'OCCUPATO');
  const free = tables.filter(t => t.status === 'LIBERO').length;
  const booked = tables.filter(t => t.status === 'PRENOTATO').length;
  const covers = occupied.reduce((s, t) => s + (t.clienti || 0), 0);

  const nowHM = hhmm(new Date(now));
  const waiting = reservations.filter(r => r.status === 'CONFERMATA');
  const next = waiting.find(r => (r.ora || '').slice(0, 5) >= nowHM) ?? waiting[0];
  const resCovers = reservations.reduce((s, r) => s + (r.persone || 0), 0);

  const turnoInfo = turnoPranzo && turnoSera ? 'Pranzo e sera' : turnoPranzo ? 'Pranzo' : turnoSera ? 'Sera' : 'Non segnato';

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Intestazione */}
      <header className="px-4 pt-4 pb-3 shrink-0 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold text-gray-400">{nowHM} · {turnoInfo === 'Non segnato' ? 'turno non segnato' : `turno: ${turnoInfo.toLowerCase()}`}</p>
          <h1 className="text-2xl font-black text-white tracking-tight truncate">
            {user ? `Ciao, ${user.name}` : 'Il Girasole'}
          </h1>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {printerBadge}
          {pendingSync > 0 && (
            <span className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold" title="Modifiche in attesa di rete">
              <WifiOff size={12} /> {pendingSync}
            </span>
          )}
          <button onClick={onChangelog} aria-label="Novità" className="w-10 h-10 flex items-center justify-center bg-surface rounded-xl text-gray-400">
            <Info size={18} />
          </button>
          <button onClick={onLogout} aria-label="Esci dall'area staff" className="w-10 h-10 flex items-center justify-center bg-surface rounded-xl text-gray-400">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-3 custom-scrollbar">
        {/* Sala dal vivo: l'azione principale */}
        <button
          onClick={onOpenSala}
          className="w-full text-left rounded-3xl p-4 bg-gradient-to-br from-gold/20 to-surface border border-gold/40 active:scale-[0.98] transition-all"
        >
          <div className="flex items-center gap-3">
            <span className="w-12 h-12 rounded-2xl bg-gold text-black flex items-center justify-center shrink-0"><LayoutGrid size={24} /></span>
            <div className="flex-1 min-w-0">
              <p className="text-xl font-black text-white leading-tight">Sala & tavoli</p>
              <p className="text-sm text-gray-300">Apri i tavoli e prendi le comande</p>
            </div>
            <ChevronRight size={22} className="text-gold shrink-0" />
          </div>
          <div className="grid grid-cols-3 gap-2 mt-4">
            <div className="rounded-xl bg-charcoal/70 px-3 py-2">
              <p className="text-2xl font-black text-amber-300 tabular-nums leading-none">{occupied.length}</p>
              <p className="text-xs text-gray-400 mt-1">occupati</p>
            </div>
            <div className="rounded-xl bg-charcoal/70 px-3 py-2">
              <p className="text-2xl font-black text-emerald-400 tabular-nums leading-none">{free}</p>
              <p className="text-xs text-gray-400 mt-1">liberi{booked > 0 ? ` · ${booked} pren.` : ''}</p>
            </div>
            <div className="rounded-xl bg-charcoal/70 px-3 py-2">
              <p className="text-2xl font-black text-white tabular-nums leading-none">{covers}</p>
              <p className="text-xs text-gray-400 mt-1">coperti in sala</p>
            </div>
          </div>
        </button>

        {/* Prossimo arrivo */}
        <button
          onClick={onOpenReservations}
          className="w-full text-left rounded-2xl p-3.5 bg-surface border border-surface-light flex items-center gap-3 active:scale-[0.98] transition-all"
        >
          <span className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0"><BookOpen size={20} /></span>
          <div className="flex-1 min-w-0">
            {next ? (
              <>
                <p className="text-xs font-bold text-gray-400">Prossimo arrivo</p>
                <p className="font-bold text-white truncate">
                  <Clock size={13} className="inline -mt-0.5 mr-1 text-amber-400" />{(next.ora || '').slice(0, 5)} · {next.nome}
                  <span className="text-gray-400 font-semibold"> · <Users size={13} className="inline -mt-0.5" /> {next.persone}</span>
                </p>
              </>
            ) : (
              <>
                <p className="font-bold text-white">Prenotazioni</p>
                <p className="text-xs text-gray-400">{reservations.length ? 'Tutti già arrivati' : 'Nessuna prenotazione oggi'}</p>
              </>
            )}
          </div>
          {reservations.length > 0 && (
            <span className="text-right shrink-0">
              <span className="block text-lg font-black text-white tabular-nums leading-none">{reservations.length}</span>
              <span className="block text-[11px] text-gray-400">oggi · {resCovers} cop.</span>
            </span>
          )}
        </button>

        {/* Il resto, a colpo d'occhio */}
        <div className="grid grid-cols-2 gap-3">
          {user && (
            <Tile icon={<CalendarClock size={20} />} title="Il mio turno" info={turnoInfo} accent="bg-emerald-500/10 text-emerald-400" onClick={onOpenTurno} />
          )}
          {canWa && (
            <Tile icon={<MessageCircle size={20} />} title="WhatsApp" info={waUnread > 0 ? `${waUnread} da leggere` : 'Messaggi clienti'} accent="bg-emerald-500/10 text-emerald-300" badge={waUnread} onClick={() => onNavigate('/whatsapp')} />
          )}
          {canKitchen && (
            <>
              <Tile icon={<ChefHat size={20} />} title="Cucina" info="Piatti esauriti" accent="bg-sky-500/10 text-sky-400" onClick={() => onNavigate('/kitchen')} />
              <Tile icon={<Package size={20} />} title="Magazzino" info="Scorte e carichi" accent="bg-orange-500/10 text-orange-400" onClick={() => onNavigate('/magazzino')} />
              <Tile icon={<ShieldCheck size={20} />} title="HACCP" info="Etichette" accent="bg-emerald-600/10 text-emerald-400" onClick={() => onNavigate('/haccp')} />
            </>
          )}
          {isAdmin && (
            <>
              <Tile icon={<BarChart3 size={20} />} title="Report" info="Incassi" accent="bg-fuchsia-500/10 text-fuchsia-400" onClick={() => onNavigate('/reports')} />
              <Tile icon={<Settings size={20} />} title="Impostazioni" accent="bg-gray-500/10 text-gray-300" onClick={() => onNavigate('/settings')} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
