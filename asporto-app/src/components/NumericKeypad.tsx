import { Delete } from 'lucide-react';

interface NumericKeypadProps {
  /** Valore corrente come stringa (es. "12.5"). */
  value: string;
  onChange: (next: string) => void;
  allowDecimal?: boolean;
  className?: string;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'back'] as const;

export default function NumericKeypad({ value, onChange, allowDecimal = true, className = '' }: NumericKeypadProps) {
  const press = (key: (typeof KEYS)[number]) => {
    if (key === 'back') {
      onChange(value.slice(0, -1));
      return;
    }
    if (key === '.') {
      if (!allowDecimal || value.includes('.')) return;
      onChange(value === '' ? '0.' : value + '.');
      return;
    }
    if (value === '0') {
      onChange(key);
      return;
    }
    onChange(value + key);
  };

  return (
    <div className={`grid grid-cols-3 gap-2 ${className}`}>
      {KEYS.map(key => (
        <button
          key={key}
          type="button"
          onClick={() => press(key)}
          disabled={key === '.' && !allowDecimal}
          className={`h-14 rounded-2xl font-black text-2xl flex items-center justify-center transition-all active:scale-90 disabled:opacity-20 ${
            key === 'back'
              ? 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20'
              : 'bg-charcoal border border-surface-light text-white hover:border-gold/40'
          }`}
        >
          {key === 'back' ? <Delete size={24} /> : key}
        </button>
      ))}
    </div>
  );
}
