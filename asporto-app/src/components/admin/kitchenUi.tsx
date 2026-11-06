import type { ReactNode } from 'react';
import { Search, X } from 'lucide-react';

/** Intestazione delle sezioni KitchenHub: titolo, sottotitolo e azioni a destra. */
export function TabHeader({ eyebrow, title, subtitle, children }: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
      <div className="min-w-0">
        <p className="text-[11px] font-black text-gold uppercase tracking-[0.25em]">{eyebrow}</p>
        <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight mt-1">{title}</h2>
        {subtitle && <p className="text-sm text-gray-400 mt-1">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-col sm:flex-row sm:items-center gap-3">{children}</div>}
    </header>
  );
}

export function SearchField({ value, onChange, placeholder }: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative w-full sm:w-72">
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={18} />
      <input
        type="search"
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-surface border border-surface-light focus:border-gold rounded-2xl py-3 pl-11 pr-11 text-white font-semibold outline-none transition-colors text-sm placeholder:text-gray-500 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-lg bg-charcoal text-gray-400 hover:text-white active:scale-90 transition-all"
          aria-label="Cancella ricerca"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

/** Interruttore disponibile/esaurito, grande abbastanza per l'uso col dito in cucina. */
export function AvailabilitySwitch({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={`${label}: ${on ? 'disponibile' : 'esaurito'}`}
      onClick={e => { e.stopPropagation(); onToggle(); }}
      className={`relative shrink-0 w-16 h-9 rounded-full transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-gold/60 active:scale-95 ${
        on ? 'bg-emerald-500' : 'bg-charcoal border border-rose-500/40'
      }`}
    >
      <span
        className={`absolute top-1/2 -translate-y-1/2 w-7 h-7 rounded-full shadow-md transition-all duration-200 ${
          on ? 'left-8 bg-white' : 'left-1 bg-rose-500/80'
        }`}
      />
    </button>
  );
}

/** Contatore compatto (es. "32 disponibili"). Cliccabile se riceve onClick. */
export function StatChip({ value, label, tone, active, onClick }: {
  value: number;
  label: string;
  tone: 'neutral' | 'ok' | 'off';
  active?: boolean;
  onClick?: () => void;
}) {
  const tones = {
    neutral: 'text-white',
    ok: 'text-emerald-400',
    off: 'text-rose-400',
  } as const;
  const base = `flex items-baseline gap-2 px-4 py-2.5 rounded-2xl border transition-all ${
    active ? 'bg-charcoal border-gold/50' : 'bg-surface border-surface-light'
  }`;
  const content = (
    <>
      <span className={`text-xl font-black tabular-nums ${tones[tone]}`}>{value}</span>
      <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">{label}</span>
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} aria-pressed={active} className={`${base} hover:border-gold/30 active:scale-95`}>
      {content}
    </button>
  ) : (
    <div className={base}>{content}</div>
  );
}

export function EmptyState({ text }: { text: string }) {
  return (
    <div className="py-20 text-center text-gray-500 border border-dashed border-surface-light rounded-3xl">
      <p className="font-bold">{text}</p>
    </div>
  );
}

/** Classi comuni per l'input prezzo compatto nelle schede. */
export const priceInputClass =
  'w-20 bg-charcoal border border-surface-light focus:border-gold rounded-xl py-2 px-2 font-bold text-sm text-center outline-none transition-colors tabular-nums';
