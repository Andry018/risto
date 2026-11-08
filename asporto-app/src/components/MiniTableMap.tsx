import { useState } from 'react';
import type { Tavolo } from '../types/entities';
import { SALE, salaDi } from '../lib/salas';

/**
 * Mappa dei tavoli in piccolo (stesse posizioni x/y della mappa vera), per scegliere un tavolo con un tocco.
 * Usata nel form prenotazioni al posto della lista a tendina.
 */
export default function MiniTableMap({ tables, selectedId, onSelect, notes }: {
  tables: Tavolo[];
  selectedId?: string;
  onSelect: (t: Tavolo) => void;
  /** Testo breve sotto il nome del tavolo (es. prenotazione già presente). */
  notes?: Record<string, string>;
}) {
  const saleConTavoli = SALE.filter(s => tables.some(t => salaDi(t).toUpperCase() === s.toUpperCase()));
  const sale = saleConTavoli.length > 0 ? saleConTavoli : [SALE[0]];
  const selected = tables.find(t => t.id === selectedId);
  const [sala, setSala] = useState<string>(selected ? salaDi(selected) : sale[0]);
  const visibili = tables.filter(t => salaDi(t).toUpperCase() === sala.toUpperCase());

  return (
    <div className="space-y-3">
      {sale.length > 1 && (
        <div className="flex gap-2 overflow-x-auto">
          {sale.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setSala(s)}
              className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition ${
                s.toUpperCase() === sala.toUpperCase() ? 'bg-gold text-black' : 'bg-charcoal border border-surface-light text-gray-400'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div
        className="relative w-full aspect-[12/7] rounded-2xl bg-charcoal/60 border border-gold/10 overflow-hidden"
        style={{ backgroundImage: 'radial-gradient(#2A2A2A 1.5px, transparent 0)', backgroundSize: '24px 24px' }}
      >
        {visibili.map(t => {
          const isSel = t.id === selectedId;
          const nota = notes?.[t.id];
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelect(t)}
              aria-label={`Tavolo ${t.nome}${nota ? `, ${nota}` : ''}`}
              aria-pressed={isSel}
              className={`absolute flex flex-col items-center justify-center border-2 transition active:scale-95 overflow-hidden px-0.5
                ${t.shape === 'ROUND' ? 'rounded-full' : 'rounded-xl'}
                ${isSel ? 'bg-gold border-gold text-black ring-4 ring-gold/30 z-10'
                  : t.status === 'OCCUPATO' ? 'bg-red-500/20 border-red-500 text-red-300'
                  : t.status === 'PRENOTATO' || nota ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                  : 'bg-surface border-gray-600 text-white'}`}
              style={{
                left: `${Math.min(t.x, 100 - (t.shape === 'RECTANGLE' ? 16 : 8))}%`,
                top: `${Math.min(t.y, 100 - 14)}%`,
                width: t.shape === 'RECTANGLE' ? '16%' : '8%',
                height: '14%',
                minWidth: 44,
                minHeight: 44,
              }}
            >
              <span className="text-sm font-black leading-none truncate max-w-full">{t.nome}</span>
              {nota && <span className="text-[9px] font-bold leading-tight truncate max-w-full mt-0.5">{nota}</span>}
            </button>
          );
        })}
        {visibili.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-500">Nessun tavolo in questa sala</div>
        )}
      </div>

      <div className="flex flex-wrap gap-4 text-[11px] font-bold text-gray-400">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-surface border-2 border-gray-600" /> Libero</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-500/20 border-2 border-amber-500" /> Prenotato</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-500/20 border-2 border-red-500" /> Occupato ora</span>
      </div>
    </div>
  );
}
