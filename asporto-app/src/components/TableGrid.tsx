import { useState } from 'react';
import type { Tavolo } from '../types/entities';
import { Users, X } from 'lucide-react';

interface Props {
  tables: Tavolo[];
  activeRoom: string;
  selectedTable: Tavolo | null;
  now: number;
  tableApertura: Record<string, string>;
  onSelectTable: (table: Tavolo) => void;
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

export default function TableGrid({ tables, activeRoom, now, tableApertura, onSelectTable }: Props) {
  const [noteText, setNoteText] = useState<string | null>(null);

  return (
    <>
      <div className="flex-1 overflow-y-auto p-6 pt-2 grid grid-cols-2 gap-4">
        {tables
          .filter(t => {
            const sala = (t.sala || 'Principale').toUpperCase();
            const active = activeRoom.toUpperCase();
            const normalizedSala = sala === 'SALA' ? 'PRINCIPALE' : sala;
            const normalizedActive = active === 'SALA' ? 'PRINCIPALE' : active;
            return normalizedSala === normalizedActive;
          })
          .map(table => (
            <button
              key={table.id}
              onClick={() => onSelectTable(table)}
              className={`relative p-6 rounded-3xl border-2 flex flex-col items-center gap-2 transition-all active:scale-95 ${
                table.status === 'LIBERO' ? 'bg-surface border-surface-light text-gray-500' : 'bg-emerald-500/10 border-emerald-500 text-emerald-400 font-bold'
              }`}
            >
              <div className="text-2xl font-black">{table.nome}</div>
              <div className="text-[10px] uppercase font-black tracking-widest opacity-60">{table.status}</div>
              <div className="flex items-center gap-1 text-xs"><Users size={10} /> {table.clienti}</div>
              {table.status === 'OCCUPATO' && elapsedStr(table, tableApertura, now) && (
                <div className="text-[8px] font-black text-gold/70 uppercase tracking-widest mt-1">{elapsedStr(table, tableApertura, now)}</div>
              )}
              {table.note && (
                <button
                  onClick={e => { e.stopPropagation(); setNoteText(table.note || null); }}
                  className="absolute -top-2 -left-2 flex items-center gap-1 px-2 py-1 bg-sky-500 rounded-full text-[8px] font-black text-white shadow-lg hover:scale-110 transition-all active:scale-95 z-20"
                >
                  <span className="text-[10px]">📝</span>
                </button>
              )}
            </button>
          ))}
      </div>

      {noteText && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm" onClick={() => setNoteText(null)}>
          <div className="bg-surface border border-surface-light rounded-[32px] p-8 max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black italic text-white flex items-center gap-2">📝 Note</h3>
              <button onClick={() => setNoteText(null)} className="text-gray-500 hover:text-white"><X size={20} /></button>
            </div>
            <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">{noteText}</p>
            <button onClick={() => setNoteText(null)} className="w-full mt-6 bg-gold text-black font-black py-3 rounded-2xl text-sm active:scale-95 transition-all">CHIUDI</button>
          </div>
        </div>
      )}
    </>
  );
}
