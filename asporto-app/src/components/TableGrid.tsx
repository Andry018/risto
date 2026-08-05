import { useState, useRef, useEffect } from 'react';
import type { Tavolo } from '../types/entities';
import { Users, Clock, MoreVertical, ArrowRightLeft } from 'lucide-react';

const ATTENTION_MINUTES = 20;

interface Props {
  tables: Tavolo[];
  activeRoom: string;
  selectedTable: Tavolo | null;
  now: number;
  tableApertura: Record<string, string>;
  onSelectTable: (table: Tavolo) => void;
  onTransferTable?: (table: Tavolo) => void;
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

function TableCard({ table, now, tableApertura, onSelectTable, onTransferTable }: {
  table: Tavolo;
  now: number;
  tableApertura: Record<string, string>;
  onSelectTable: (t: Tavolo) => void;
  onTransferTable?: (t: Tavolo) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  const mins = getElapsedMins(table, tableApertura, now);
  const badge = getStatusBadge(table, mins);
  const elapsed = table.status === 'OCCUPATO' ? elapsedStr(table, tableApertura, now) : null;

  return (
    <div className="relative">
      <button
        onClick={() => onSelectTable(table)}
        className={`relative w-full p-5 rounded-3xl border-2 flex flex-col items-start gap-2 transition-all active:scale-95 text-left ${
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
          <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${badge.color}`}>
            {badge.label}
          </span>
          {(table.status === 'OCCUPATO' || table.status === 'PRENOTATO') && (
            <div className="relative" ref={menuRef}>
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
                className="p-1.5 rounded-xl hover:bg-white/5 text-gray-500 hover:text-white transition-colors"
              >
                <MoreVertical size={16} />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-8 z-50 w-52 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden">
                  <div className="py-1">
                    <p className="px-4 py-2 text-[9px] font-black uppercase tracking-widest text-gray-500 border-b border-gray-800">
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
                  </div>
                </div>
              )}
            </div>
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
        </div>

        {table.status === 'LIBERO' && (
          <div className="mt-1.5 w-full text-center py-2 rounded-xl bg-white/5 text-[9px] font-black uppercase tracking-widest text-gray-600">
            TAP PER APRIRE
          </div>
        )}
      </button>
    </div>
  );
}

export default function TableGrid({ tables, activeRoom, now, tableApertura, onSelectTable, onTransferTable }: Props) {
  return (
    <div className="flex-1 overflow-y-auto p-6 pt-2 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {tables
        .filter(t => {
          const sala = (t.sala || 'Principale').toUpperCase();
          const active = activeRoom.toUpperCase();
          const normalizedSala = sala === 'SALA' ? 'PRINCIPALE' : sala;
          const normalizedActive = active === 'SALA' ? 'PRINCIPALE' : active;
          return normalizedSala === normalizedActive;
        })
        .map(table => (
          <TableCard
            key={table.id}
            table={table}
            now={now}
            tableApertura={tableApertura}
            onSelectTable={onSelectTable}
            onTransferTable={onTransferTable}
          />
        ))}
    </div>
  );
}
