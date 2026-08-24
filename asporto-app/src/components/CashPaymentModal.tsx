import { useState, useEffect } from 'react';
import { X, CheckCircle, Banknote } from 'lucide-react';

const BANCONOTE = [5, 10, 20, 50, 100, 200];

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
    setReceived(prev => {
      const current = parseFloat(prev) || 0;
      return (current + val).toFixed(2);
    });
  }

  function handleKey(k: string) {
    setReceived(prev => {
      if (k === 'C') return '';
      if (k === '⌫') return prev.slice(0, -1);
      if (k === '.' && prev.includes('.')) return prev;
      if (k === '.' && prev === '') return '0.';
      // max 2 decimals
      const dotIdx = prev.indexOf('.');
      if (dotIdx !== -1 && prev.length - dotIdx > 2) return prev;
      return prev + k;
    });
  }

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-surface border border-surface-light w-full max-w-sm rounded-[40px] shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-8 pt-8 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gold/10 flex items-center justify-center">
              <Banknote size={20} className="text-gold" />
            </div>
            <div>
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em]">Pagamento</p>
              <h2 className="text-xl font-black italic uppercase text-white tracking-tighter">Contante</h2>
            </div>
          </div>
          <button onClick={onClose} className="p-2 bg-charcoal rounded-xl text-gray-500 hover:text-white border border-surface-light">
            <X size={18} />
          </button>
        </div>

        <div className="px-8 pb-8 space-y-5">

          {/* Totale */}
          <div className="bg-charcoal rounded-3xl p-5 flex items-center justify-between">
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em]">Da pagare</p>
            <p className="text-3xl font-black italic text-gold">€{total.toFixed(2)}</p>
          </div>

          {/* Banconote rapide */}
          <div>
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] mb-3">Banconote rapide</p>
            <div className="grid grid-cols-3 gap-2">
              {BANCONOTE.map(b => (
                <button
                  key={b}
                  onClick={() => addBanconota(b)}
                  className="bg-charcoal hover:bg-surface-light border border-surface-light text-white font-black text-sm py-3 rounded-2xl transition-all active:scale-95"
                >
                  €{b}
                </button>
              ))}
            </div>
          </div>

          {/* Display ricevuto */}
          <div className="bg-charcoal border border-surface-light rounded-2xl px-5 py-4 text-right">
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] text-left mb-1">Ricevuto</p>
            <p className="text-4xl font-black italic text-white tabular-nums">
              €{received || '0.00'}
            </p>
          </div>

          {/* Tastierino numerico */}
          <div className="grid grid-cols-3 gap-2">
            {['7','8','9','4','5','6','1','2','3','.','0','⌫'].map(k => (
              <button
                key={k}
                onClick={() => handleKey(k)}
                className="bg-charcoal hover:bg-surface-light border border-surface-light text-white font-black text-lg py-3 rounded-2xl transition-all active:scale-95"
              >
                {k}
              </button>
            ))}
          </div>

          {/* Pagamento esatto shortcut */}
          <button
            onClick={() => setReceived(total.toFixed(2))}
            className="w-full bg-charcoal border border-dashed border-gold/40 text-gold font-black text-xs py-3 rounded-2xl transition-all active:scale-95 hover:border-gold/70"
          >
            PAGAMENTO ESATTO  €{total.toFixed(2)}
          </button>

          {/* Resto */}
          {receivedNum > 0 && (
            <div className={`rounded-3xl p-5 flex items-center justify-between transition-all ${
              resto >= 0 ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-red-500/10 border border-red-500/30'
            }`}>
              <p className={`text-[10px] font-black uppercase tracking-[0.3em] ${resto >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {resto >= 0 ? 'Resto da dare' : 'Importo insufficiente'}
              </p>
              <p className={`text-3xl font-black italic tabular-nums ${resto >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {resto >= 0 ? `€${resto.toFixed(2)}` : `-€${Math.abs(resto).toFixed(2)}`}
              </p>
            </div>
          )}

          {/* Conferma */}
          <button
            onClick={onConfirm}
            disabled={!canConfirm}
            className="w-full bg-gold hover:bg-gold-hover text-black font-black text-lg py-4 rounded-2xl shadow-lg shadow-gold/20 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-40 disabled:grayscale"
          >
            {loading ? 'ATTENDI...' : <><CheckCircle size={20} /> CONFERMA E CHIUDI</>}
          </button>

        </div>
      </div>
    </div>
  );
}
