import { useState, useEffect, useRef } from 'react';
import { CreditCard, CheckCircle, X, AlertCircle, ChevronRight, Printer, RotateCcw, Loader2 } from 'lucide-react';
import { payWithCard, printFiscalReceipt } from '../lib/ecrAgent';
import type { PaymentResult, FiscalReceiptItem } from '../lib/ecrAgent';

type Phase = 'confirm' | 'paying' | 'partSuccess' | 'allDone' | 'error';

interface Props {
  open: boolean;
  totalAmount: number;
  /** Se impostato, divide il pagamento in N transazioni sequenziali da totalAmount/splitParts ciascuna */
  splitParts?: number;
  /** Nome tavolo / riferimento (per log e visualizzazione) */
  label?: string;
  /** Articoli del conto — passati alla cassa fiscale per lo scontrino */
  fiscalItems?: FiscalReceiptItem[];
  onClose: () => void;
  /** Chiamato quando tutti i pagamenti sono stati approvati — il chiamante chiude il conto */
  onAllPaid: (results: PaymentResult[]) => void;
}

export default function CardPaymentModal({
  open,
  totalAmount,
  splitParts,
  label,
  fiscalItems,
  onClose,
  onAllPaid,
}: Props) {
  const isSplit       = splitParts && splitParts > 1;
  const eachAmount    = isSplit ? totalAmount / splitParts! : totalAmount;
  const totalParts    = isSplit ? splitParts! : 1;

  const [phase,          setPhase]          = useState<Phase>('confirm');
  const [currentPart,    setCurrentPart]    = useState(1);
  const [results,        setResults]        = useState<PaymentResult[]>([]);
  const [lastResult,     setLastResult]     = useState<PaymentResult | null>(null);
  const [errorMsg,       setErrorMsg]       = useState('');
  const [printingFiscal, setPrintingFiscal] = useState(false);
  const [fiscalPrinted,  setFiscalPrinted]  = useState(false);
  const [fiscalError,    setFiscalError]    = useState('');
  const abortedRef = useRef(false);

  // Reset quando il modal si apre
  useEffect(() => {
    if (open) {
      setPhase('confirm');
      setCurrentPart(1);
      setResults([]);
      setLastResult(null);
      setErrorMsg('');
      setPrintingFiscal(false);
      setFiscalPrinted(false);
      setFiscalError('');
      abortedRef.current = false;
    }
  }, [open]);

  if (!open) return null;

  const amountLabel = `€${eachAmount.toFixed(2)}`;

  async function triggerFiscalPrint(authCode?: string) {
    setPrintingFiscal(true);
    setFiscalError('');
    try {
      const result = await printFiscalReceipt({
        items:    fiscalItems || [],
        total:    totalAmount,
        payment:  'carta',
        authCode,
      });
      if (result.ok) {
        setFiscalPrinted(true);
      } else {
        setFiscalError(result.error || 'Errore stampa scontrino');
      }
    } catch {
      setFiscalError('Cassa fiscale non raggiungibile');
    } finally {
      setPrintingFiscal(false);
    }
  }

  async function startPayment(partNum: number) {
    setPhase('paying');
    setLastResult(null);
    setErrorMsg('');

    try {
      const result = await payWithCard(eachAmount, {
        partNumber:  isSplit ? partNum : undefined,
        totalParts:  isSplit ? totalParts : undefined,
        description: label || undefined,
      });

      if (abortedRef.current) return;

      setLastResult(result);

      if (!result.ok) {
        setErrorMsg(result.error || 'Transazione rifiutata dal terminale');
        setPhase('error');
        return;
      }

      const newResults = [...results, result];
      setResults(newResults);

      if (partNum >= totalParts) {
        setPhase('allDone');
        // Avvia stampa scontrino fiscale automaticamente
        void triggerFiscalPrint(result.authCode);
      } else {
        setPhase('partSuccess');
      }
    } catch (err) {
      if (abortedRef.current) return;
      setErrorMsg(err instanceof Error ? err.message : 'Errore di comunicazione con il terminale');
      setPhase('error');
    }
  }

  function handleClose() {
    abortedRef.current = true;
    onClose();
  }

  function handleDone() {
    onAllPaid(results);
  }

  function handleNextPart() {
    const next = currentPart + 1;
    setCurrentPart(next);
    void startPayment(next);
  }

  function handleRetry() {
    void startPayment(currentPart);
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-surface border border-surface-light w-full max-w-sm rounded-[40px] shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="px-8 pt-8 pb-6 border-b border-surface-light flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
              <CreditCard size={20} className="text-sky-400" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                {isSplit ? `Quota ${currentPart} di ${totalParts}` : 'Pagamento carta'}
              </p>
              <h2 className="text-lg font-black italic uppercase text-white leading-tight">
                {label || 'Pagamento POS'}
              </h2>
            </div>
          </div>
          {phase !== 'paying' && (
            <button
              onClick={handleClose}
              className="p-2 bg-charcoal rounded-xl text-gray-500 hover:text-white border border-surface-light transition-all"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-8 space-y-6">

          {/* Importo */}
          <div className="bg-charcoal border border-surface-light rounded-3xl p-6 text-center">
            {isSplit && (
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">
                Importo per quota
              </p>
            )}
            <p className="text-5xl font-black italic text-sky-400">{amountLabel}</p>
            {isSplit && (
              <p className="text-xs text-gray-500 mt-2">
                Totale: €{totalAmount.toFixed(2)} · {totalParts} persone
              </p>
            )}
          </div>

          {/* Progress quote (split) */}
          {isSplit && results.length > 0 && (
            <div className="flex gap-1.5">
              {Array.from({ length: totalParts }).map((_, i) => (
                <div
                  key={i}
                  className={`flex-1 h-1.5 rounded-full ${
                    i < results.length
                      ? 'bg-emerald-500'
                      : i === results.length
                      ? 'bg-sky-500 animate-pulse'
                      : 'bg-surface-light'
                  }`}
                />
              ))}
            </div>
          )}

          {/* === FASE: confirm === */}
          {phase === 'confirm' && (
            <div className="space-y-3">
              <p className="text-xs text-gray-400 text-center">
                {isSplit
                  ? `Presentare il terminale alla persona ${currentPart}`
                  : 'Presentare la carta al terminale PAX A35'}
              </p>
              <button
                onClick={() => startPayment(currentPart)}
                className="w-full bg-sky-500 hover:bg-sky-400 text-white font-black text-base py-4 rounded-2xl shadow-lg shadow-sky-500/20 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <CreditCard size={18} />
                AVVIA PAGAMENTO
              </button>
              <button
                onClick={handleClose}
                className="w-full bg-charcoal border border-surface-light text-gray-400 font-black text-xs py-3 rounded-2xl transition-all active:scale-95 hover:text-white"
              >
                ANNULLA
              </button>
            </div>
          )}

          {/* === FASE: paying === */}
          {phase === 'paying' && (
            <div className="text-center space-y-4 py-4">
              <div className="w-16 h-16 rounded-full border-4 border-sky-500 border-t-transparent animate-spin mx-auto" />
              <div>
                <p className="text-white font-black text-lg">In attesa del terminale...</p>
                <p className="text-gray-500 text-xs mt-1">
                  Il cliente può inserire, avvicinare o strisciare la carta
                </p>
              </div>
            </div>
          )}

          {/* === FASE: partSuccess (quota pagata, ne mancano altre) === */}
          {phase === 'partSuccess' && lastResult && (
            <div className="space-y-4">
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 text-center">
                <CheckCircle size={28} className="text-emerald-400 mx-auto mb-2" />
                <p className="text-emerald-400 font-black">Quota {currentPart} approvata</p>
                {lastResult.authCode && (
                  <p className="text-[10px] text-gray-500 mt-1 font-mono">
                    Auth: {lastResult.authCode}
                  </p>
                )}
              </div>
              <p className="text-xs text-gray-400 text-center">
                Passare il terminale alla persona {currentPart + 1}
              </p>
              <button
                onClick={handleNextPart}
                className="w-full bg-sky-500 hover:bg-sky-400 text-white font-black text-base py-4 rounded-2xl shadow-lg shadow-sky-500/20 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                PERSONA {currentPart + 1} <ChevronRight size={18} />
              </button>
            </div>
          )}

          {/* === FASE: allDone === */}
          {phase === 'allDone' && lastResult && (
            <div className="space-y-4">
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-5 text-center">
                <CheckCircle size={36} className="text-emerald-400 mx-auto mb-3" />
                <p className="text-emerald-400 font-black text-lg">
                  {isSplit ? 'Tutte le quote approvate!' : 'Pagamento approvato!'}
                </p>
                {lastResult.authCode && (
                  <p className="text-[10px] text-gray-500 mt-2 font-mono">
                    Auth: {lastResult.authCode}
                  </p>
                )}
              </div>

              {/* Stato stampa scontrino fiscale Custom Big Plus RT */}
              {printingFiscal && (
                <div className="bg-sky-500/5 border border-sky-500/20 rounded-2xl p-4 flex items-center gap-3">
                  <Loader2 size={18} className="text-sky-400 shrink-0 animate-spin" />
                  <div>
                    <p className="text-sky-400 font-black text-xs">Stampa scontrino fiscale...</p>
                    <p className="text-gray-500 text-[10px] mt-0.5">Cassa Custom Big Plus RT</p>
                  </div>
                </div>
              )}

              {fiscalPrinted && !printingFiscal && (
                <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-4 flex items-center gap-3">
                  <Printer size={18} className="text-emerald-400 shrink-0" />
                  <p className="text-emerald-400 font-black text-xs">Scontrino fiscale stampato</p>
                </div>
              )}

              {fiscalError && !printingFiscal && (
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Printer size={18} className="text-amber-400 shrink-0" />
                    <div>
                      <p className="text-amber-400 font-black text-xs">Scontrino non stampato</p>
                      <p className="text-gray-500 text-[10px] mt-0.5">{fiscalError}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => triggerFiscalPrint(lastResult.authCode)}
                    className="shrink-0 px-3 py-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 font-black text-[10px] rounded-xl transition-all hover:bg-amber-500/20"
                  >
                    RIPROVA
                  </button>
                </div>
              )}

              <button
                onClick={handleDone}
                disabled={printingFiscal}
                className="w-full bg-gold hover:bg-gold-hover text-black font-black text-base py-4 rounded-2xl shadow-lg shadow-gold/20 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <CheckCircle size={18} /> CHIUDI CONTO
              </button>
            </div>
          )}

          {/* === FASE: error === */}
          {phase === 'error' && (
            <div className="space-y-4">
              <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-center">
                <AlertCircle size={28} className="text-red-400 mx-auto mb-2" />
                <p className="text-red-400 font-black">Transazione non riuscita</p>
                <p className="text-gray-400 text-xs mt-1">{errorMsg}</p>
              </div>
              <button
                onClick={handleRetry}
                className="w-full bg-charcoal border border-sky-500/30 text-sky-400 font-black text-sm py-4 rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2 hover:bg-sky-500/10"
              >
                <RotateCcw size={16} /> RIPROVA
              </button>
              <button
                onClick={handleClose}
                className="w-full bg-charcoal border border-surface-light text-gray-400 font-black text-xs py-3 rounded-2xl transition-all active:scale-95 hover:text-white"
              >
                ANNULLA
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
