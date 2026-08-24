import { Banknote, CreditCard, X } from 'lucide-react';

interface Props {
  open: boolean;
  total: number;
  onClose: () => void;
  onCash: () => void;
  onCard: () => void;
}

export default function PaymentChoiceModal({ open, total, onClose, onCash, onCard }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-surface border border-surface-light w-full max-w-sm md:max-w-md rounded-[40px] shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-8 pt-8 pb-6">
          <div>
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em]">Chiudi conto</p>
            <h2 className="text-2xl font-black italic uppercase text-white tracking-tighter">
              Metodo di <span className="text-gold">Pagamento</span>
            </h2>
          </div>
          <button onClick={onClose} className="p-2 bg-charcoal rounded-xl text-gray-500 hover:text-white border border-surface-light">
            <X size={18} />
          </button>
        </div>

        {/* Totale */}
        <div className="mx-8 mb-6 bg-charcoal rounded-3xl px-5 py-4 flex items-center justify-between">
          <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em]">Totale</p>
          <p className="text-3xl font-black italic text-gold">€{total.toFixed(2)}</p>
        </div>

        {/* Scelta */}
        <div className="px-8 pb-8 grid grid-cols-2 gap-4">
          <button
            onClick={onCash}
            className="flex flex-col items-center justify-center gap-3 bg-charcoal hover:bg-surface-light border border-surface-light rounded-3xl py-8 transition-all active:scale-95 group"
          >
            <div className="w-14 h-14 rounded-2xl bg-gold/10 flex items-center justify-center group-hover:bg-gold/20 transition-colors">
              <Banknote size={28} className="text-gold" />
            </div>
            <span className="font-black text-sm uppercase tracking-widest text-white">Contante</span>
          </button>

          <button
            onClick={onCard}
            className="flex flex-col items-center justify-center gap-3 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 rounded-3xl py-8 transition-all active:scale-95 group"
          >
            <div className="w-14 h-14 rounded-2xl bg-sky-500/10 flex items-center justify-center group-hover:bg-sky-500/20 transition-colors">
              <CreditCard size={28} className="text-sky-400" />
            </div>
            <span className="font-black text-sm uppercase tracking-widest text-sky-400">Carta</span>
          </button>
        </div>

      </div>
    </div>
  );
}
