import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Tavolo } from '../types/entities';
import { Users, Clock, MoreVertical, ArrowRightLeft, DoorOpen, Receipt, LayoutGrid } from 'lucide-react';

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
  if (table.status === 'LIBERO') return { label: 'LIBERO', color: 'bg-green-500/10 text-green-400 border-green-500/30' };
  if (table.status === 'PRENOTATO') return { label: 'PRENOTATO', color: 'bg-blue-500/10 text-blue-400 border-blue-500/30' };
  if (mins !== null && mins >= ATTENTION_MINUTES) return { label: 'ATTENZIONE', color: 'bg-red-500/10 text-red-400 border-red-500/30 animate-pulse' };
  return { label: 'OCCUPATO', color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30' };
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
        className={`relative w-full p-5 rounded-3xl border-2 flex flex-col items-start gap-2 transition-all active:scale-95 text-left cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-gold/60 ${
          table.status === 'LIBERO'
            ? 'bg-gray-900/50 border-gray-800 text-gray-400 hover:border-green-500/30'
            : mins !== null && mins >= ATTENTION_MINUTES
              ? 'bg-red-500/5 border-red-500/40 text-red-300 shadow-lg shadow-red-500/10'
              : table.status === 'PRENOTATO'
                ? 'bg-blue-500/5 border-blue-500/30 text-blue-300'
                : 'bg-yellow-500/5 border-yellow-500/40 text-yellow-200 shadow-lg shadow-yellow-500/10'
        }`}
      >
        <div className="w-full flex items-center justify-between">
          <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${badge.color}`}>
            {badge.label}
          </span>
          {(table.status === 'OCCUPATO' || table.status === 'PRENOTATO') && (
            <button
              ref={triggerRef}
              type="button"
              onClick={handleToggleMenu}
              aria-label={`Azioni per ${table.nome}`}
              aria-expanded={menuOpen}
              className="p-1.5 rounded-xl hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
            >
              <MoreVertical size={16} />
            </button>
          )}
        </div>

        <div className="text-2xl font-black tracking-tight">{table.nome}</div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <div className="flex items-center gap-1.5 opacity-70">
            <Users size={12} /> {table.clienti || '-'}
          </div>
          {elapsed && (
            <div className={`flex items-center gap-1.5 font-black text-[10px] uppercase tracking-wider ${
              mins !== null && mins >= ATTENTION_MINUTES ? 'text-red-400' : 'text-amber-400/70'
            }`}>
              <Clock size={11} /> {elapsed}
            </div>
          )}
          {table.status === 'OCCUPATO' && orderCount !== undefined && orderCount > 0 && (
            <div className="flex items-center gap-1 text-[10px] font-black text-emerald-400/80 uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/80" />
              {orderCount} piatti
            </div>
          )}
        </div>

        {table.status === 'LIBERO' && (
          <div className="mt-1.5 w-full text-center py-2 rounded-xl bg-white/5 text-[10px] font-black uppercase tracking-widest text-gray-400">
            TAP PER APRIRE
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

  return (
    <div className="flex-1 overflow-y-auto p-6 pt-2">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
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
