import { useState, useEffect } from 'react';
import { X, CheckCircle, Banknote, Delete } from 'lucide-react';

const BANCONOTE = [5, 10, 20, 50, 100, 200];
const KEYS = ['7','8','9','4','5','6','1','2','3','.','0','⌫'];

interface Props {
  open: boolean;
  total: number;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
}

export default function CashPaymentModal({ open, total, onClose, onConfirm, loading }: Props) {
  const [received, setReceived] = useState('');

  useEffect(() => {
    if (open) setReceived('');
  }, [open]);

  if (!open) return null;

  const receivedNum = parseFloat(received) || 0;
  const resto = receivedNum - total;
  const canConfirm = receivedNum >= total && !loading;

  function addBanconota(val: number) {
    setReceived(prev => ((parseFloat(prev) || 0) + val).toFixed(2));
  }

  function handleKey(k: string) {
    setReceived(prev => {
      if (k === '⌫') return prev.slice(0, -1);
      if (k === '.' && prev.includes('.')) return prev;
      if (k === '.' && prev === '') return '0.';
      const dotIdx = prev.indexOf('.');
      if (dotIdx !== -1 && prev.length - dotIdx > 2) return prev;
      return prev + k;
    });
  }

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-surface border border-surface-light w-full max-w-sm md:max-w-2xl rounded-[32px] md:rounded-[40px] shadow-2xl overflow-hidden">

        {/* Layout: single column mobile, two columns md+ */}
        <div className="md:grid md:grid-cols-2">

          {/* ── Colonna sinistra: info + conferma ────────────────── */}
          <div className="flex flex-col px-6 pt-6 pb-6 md:px-8 md:pt-8 md:pb-8 md:border-r md:border-surface-light gap-4">

            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-gold/10 flex items-center justify-center">
                  <Banknote size={22} className="text-gold" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em]">Pagamento</p>
                  <h2 className="text-xl md:text-2xl font-black italic uppercase text-white tracking-tighter">Contante</h2>
                </div>
              </div>
              <button onClick={onClose} className="p-2 bg-charcoal rounded-xl text-gray-500 hover:text-white border border-surface-light">
                <X size={18} />
              </button>
            </div>

            {/* Totale */}
            <div className="bg-charcoal rounded-3xl px-5 py-4 flex items-center justify-between">
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em]">Da pagare</p>
              <p className="text-3xl md:text-4xl font-black italic text-gold">€{total.toFixed(2)}</p>
            </div>

            {/* Display ricevuto */}
            <div className="bg-charcoal border border-surface-light rounded-2xl px-5 py-4">
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] mb-1">Ricevuto</p>
              <p className="text-4xl md:text-5xl font-black italic text-white tabular-nums text-right">
                €{received || '0.00'}
              </p>
            </div>

            {/* Resto */}
            <div className={`rounded-3xl px-5 py-4 flex items-center justify-between transition-all ${
              receivedNum <= 0
                ? 'bg-charcoal border border-surface-light'
                : resto >= 0
                  ? 'bg-emerald-500/10 border border-emerald-500/30'
                  : 'bg-red-500/10 border border-red-500/30'
            }`}>
              <p className={`text-[10px] font-black uppercase tracking-[0.3em] ${
                receivedNum <= 0 ? 'text-gray-600' : resto >= 0 ? 'text-emerald-400' : 'text-red-400'
              }`}>
                {receivedNum <= 0 ? 'Resto' : resto >= 0 ? 'Resto da dare' : 'Importo insufficiente'}
              </p>
              <p className={`text-3xl md:text-4xl font-black italic tabular-nums ${
                receivedNum <= 0 ? 'text-gray-600' : resto >= 0 ? 'text-emerald-400' : 'text-red-400'
              }`}>
                {receivedNum <= 0
                  ? '—'
                  : resto >= 0
                    ? `€${resto.toFixed(2)}`
                    : `-€${Math.abs(resto).toFixed(2)}`
                }
              </p>
            </div>

            {/* Conferma */}
            <button
              onClick={onConfirm}
              disabled={!canConfirm}
              className="w-full bg-gold hover:bg-gold-hover text-black font-black text-lg md:text-xl py-4 md:py-5 rounded-2xl shadow-lg shadow-gold/20 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-40 disabled:grayscale mt-auto"
            >
              {loading ? 'ATTENDI...' : <><CheckCircle size={22} /> CONFERMA E CHIUDI</>}
            </button>
          </div>

          {/* ── Colonna destra: banconote + tastierino ────────────── */}
          <div className="flex flex-col px-6 pb-6 pt-0 md:px-8 md:pt-8 md:pb-8 gap-4">

            {/* Banconote rapide */}
            <div>
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] mb-3">Banconote rapide</p>
              <div className="grid grid-cols-3 gap-2 md:gap-3">
                {BANCONOTE.map(b => (
                  <button
                    key={b}
                    onClick={() => addBanconota(b)}
                    className="bg-charcoal hover:bg-surface-light border border-surface-light text-white font-black text-sm md:text-base py-3 md:py-4 rounded-2xl transition-all active:scale-95"
                  >
                    €{b}
                  </button>
                ))}
              </div>
            </div>

            {/* Tastierino */}
            <div className="grid grid-cols-3 gap-2 md:gap-3 flex-1">
              {KEYS.map(k => (
                <button
                  key={k}
                  onClick={() => handleKey(k)}
                  className={`flex items-center justify-center font-black text-xl md:text-2xl py-4 md:py-5 rounded-2xl transition-all active:scale-95 ${
                    k === '⌫'
                      ? 'bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400'
                      : 'bg-charcoal hover:bg-surface-light border border-surface-light text-white'
                  }`}
                >
                  {k === '⌫' ? <Delete size={20} /> : k}
                </button>
              ))}
            </div>

            {/* Pagamento esatto */}
            <button
              onClick={() => setReceived(total.toFixed(2))}
              className="w-full bg-charcoal border border-dashed border-gold/40 text-gold font-black text-xs md:text-sm py-3 md:py-4 rounded-2xl transition-all active:scale-95 hover:border-gold/70"
            >
              PAGAMENTO ESATTO  €{total.toFixed(2)}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
