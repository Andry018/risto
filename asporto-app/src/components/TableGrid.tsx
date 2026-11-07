import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Tavolo } from '../types/entities';
import { Users, Clock, MoreVertical, ArrowRightLeft, DoorOpen, Receipt, LayoutGrid, Plus } from 'lucide-react';

const ATTENTION_MINUTES = 20;

interface Props {
  tables: Tavolo[];
  activeRoom: string;
  selectedTable: Tavolo | null;
  now: number;
  tableApertura: Record<string, string>;
  tableOrderCounts?: Record<string, number>;
  onSelectTable: (table: Tavolo) => void;
  onTransferTable?: (table: Tavolo) => void;
  onCloseTable?: (table: Tavolo) => void;
  onPreConto?: (table: Tavolo) => void;
}

function elapsedStr(t: Tavolo, tableApertura: Record<string, string>, now: number): string | null {
  const a = tableApertura[t.id];
  if (!a) return null;
  const diff = now - new Date(a).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'ora';
  if (mins < 60) return `${mins}min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}min`;
}

function getElapsedMins(t: Tavolo, tableApertura: Record<string, string>, now: number): number | null {
  const a = tableApertura[t.id];
  if (!a) return null;
  return Math.floor((now - new Date(a).getTime()) / 60000);
}

function getStatusBadge(table: Tavolo, mins: number | null) {
  if (table.status === 'LIBERO') return { label: 'Libero', text: 'text-emerald-400' };
  if (table.status === 'PRENOTATO') return { label: 'Prenotato', text: 'text-sky-300' };
  if (mins !== null && mins >= ATTENTION_MINUTES) return { label: 'Da controllare', text: 'text-red-300' };
  return { label: 'Occupato', text: 'text-amber-300' };
}

function TableCard({ table, now, tableApertura, orderCount, onSelectTable, onTransferTable, onCloseTable, onPreConto }: {
  table: Tavolo;
  now: number;
  tableApertura: Record<string, string>;
  orderCount?: number;
  onSelectTable: (t: Tavolo) => void;
  onTransferTable?: (t: Tavolo) => void;
  onCloseTable?: (t: Tavolo) => void;
  onPreConto?: (t: Tavolo) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; right: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (!panelRef.current?.contains(target) && !triggerRef.current?.contains(target)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  const handleToggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!menuOpen) {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (rect) setDropdownPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
    }
    setMenuOpen(m => !m);
  };

  const mins = getElapsedMins(table, tableApertura, now);
  const badge = getStatusBadge(table, mins);
  const late = table.status === 'OCCUPATO' && mins !== null && mins >= ATTENTION_MINUTES;
  const elapsed = table.status === 'OCCUPATO' ? elapsedStr(table, tableApertura, now) : null;

  const handleCardKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelectTable(table);
    }
  };

  return (
    <div className="relative">
      <div
        role="button"
        tabIndex={0}
        onClick={() => onSelectTable(table)}
        onKeyDown={handleCardKeyDown}
        className={`relative w-full min-h-[118px] pl-4 pr-2 py-3 rounded-2xl border overflow-hidden flex flex-col items-start gap-1 transition-all active:scale-[0.97] text-left cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-gold/60 ${
          table.status === 'LIBERO'
            ? 'bg-surface/60 border-surface-light text-gray-300'
            : late
              ? 'bg-red-500/10 border-red-500/50 text-white'
              : table.status === 'PRENOTATO'
                ? 'bg-sky-500/10 border-sky-500/40 text-white'
                : 'bg-amber-500/10 border-amber-500/40 text-white'
        }`}
      >
        {/* barra di stato a sinistra: si legge da lontano */}
        <span className={`absolute left-0 top-0 bottom-0 w-1.5 ${
          table.status === 'LIBERO' ? 'bg-emerald-500/60' : late ? 'bg-red-500' : table.status === 'PRENOTATO' ? 'bg-sky-400' : 'bg-amber-400'
        }`} />

        <div className="w-full flex items-start justify-between gap-1">
          <div className="text-2xl font-black tracking-tight leading-none">{table.nome}</div>
          {(table.status === 'OCCUPATO' || table.status === 'PRENOTATO') && (
            <button
              ref={triggerRef}
              type="button"
              onClick={handleToggleMenu}
              aria-label={`Azioni per ${table.nome}`}
              aria-expanded={menuOpen}
              className="-mt-1 w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 hover:text-white active:bg-white/10"
            >
              <MoreVertical size={18} />
            </button>
          )}
        </div>

        <span className={`text-[11px] font-bold ${badge.text}`}>{badge.label}</span>

        {table.status === 'LIBERO' ? (
          <div className="mt-auto flex items-center gap-1.5 text-xs text-gray-400">
            <Plus size={14} /> Tocca per aprire
          </div>
        ) : (
          <div className="mt-auto w-full flex items-end justify-between gap-2">
            <div className="flex items-center gap-1 text-sm font-bold text-gray-200">
              <Users size={14} className="opacity-70" /> {table.clienti || '–'}
              {table.status === 'OCCUPATO' && orderCount !== undefined && orderCount > 0 && (
                <span className="ml-1.5 text-xs font-bold text-emerald-300">· {orderCount} piatti</span>
              )}
            </div>
            {elapsed && (
              <div className={`flex items-center gap-1 text-sm font-black tabular-nums ${late ? 'text-red-300' : 'text-amber-200'}`}>
                <Clock size={13} /> {elapsed}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Dropdown via portale — evita clipping da overflow-y-auto del grid */}
      {menuOpen && dropdownPos && createPortal(
        <div
          ref={panelRef}
          style={{ position: 'fixed', top: dropdownPos.top, right: dropdownPos.right, zIndex: 9999 }}
          className="w-52 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden"
        >
          <p className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-800">
            {table.nome} · Azioni
          </p>
          {onTransferTable && (
            <button
              onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onTransferTable(table); }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
            >
              <ArrowRightLeft size={15} className="text-amber-400" />
              Trasferisci Tavolo
            </button>
          )}
          {onPreConto && (
            <button
              onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onPreConto(table); }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
            >
              <Receipt size={15} className="text-blue-400" />
              Pre-Conto Cliente
            </button>
          )}
          {onCloseTable && (
            <button
              onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onCloseTable(table); }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors border-t border-gray-800"
            >
              <DoorOpen size={15} className="text-rose-400" />
              Chiudi Tavolo
            </button>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}

export default function TableGrid({ tables, activeRoom, now, tableApertura, tableOrderCounts, onSelectTable, onTransferTable, onCloseTable, onPreConto }: Props) {
  const roomTables = tables.filter(t => {
    const sala = (t.sala || 'Principale').toUpperCase();
    const active = activeRoom.toUpperCase();
    const normalizedSala = sala === 'SALA' ? 'PRINCIPALE' : sala;
    const normalizedActive = active === 'SALA' ? 'PRINCIPALE' : active;
    return normalizedSala === normalizedActive;
  });

  if (roomTables.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto p-6 pt-2 flex flex-col items-center justify-center text-center">
        <LayoutGrid size={48} strokeWidth={1} className="mb-4 text-gray-400" />
        <p className="text-sm font-black uppercase tracking-widest text-gray-400">Nessun tavolo in questa sala</p>
        <p className="mt-1 text-[10px] uppercase tracking-[0.3em] text-gray-400">Seleziona un&apos;altra sala o aggiungi tavoli</p>
      </div>
    );
  }

  const counts = {
    liberi: roomTables.filter(t => t.status === 'LIBERO').length,
    occupati: roomTables.filter(t => t.status === 'OCCUPATO').length,
    prenotati: roomTables.filter(t => t.status === 'PRENOTATO').length,
  };

  return (
    <div className="flex-1 overflow-y-auto px-3 pb-6 pt-1">
      <div className="flex gap-3 px-1 pb-2 text-xs font-bold text-gray-400">
        <span><span className="text-emerald-400 tabular-nums">{counts.liberi}</span> liberi</span>
        <span><span className="text-amber-300 tabular-nums">{counts.occupati}</span> occupati</span>
        {counts.prenotati > 0 && <span><span className="text-sky-300 tabular-nums">{counts.prenotati}</span> prenotati</span>}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
        {roomTables.map(table => (
          <TableCard
            key={table.id}
            table={table}
            now={now}
            tableApertura={tableApertura}
            orderCount={tableOrderCounts?.[table.nome]}
            onSelectTable={onSelectTable}
            onTransferTable={onTransferTable}
            onCloseTable={onCloseTable}
            onPreConto={onPreConto}
          />
        ))}
      </div>
    </div>
  );
}
