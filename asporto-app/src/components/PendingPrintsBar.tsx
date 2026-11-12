import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Printer, RotateCw, Trash2, X, Clock } from 'lucide-react';
import Dialog from './Dialog';
import { useConfirm } from './ConfirmModal';
import { useToast } from './Toast';
import { getPrintAgentUrl } from '../lib/printConfig';
import {
  fetchPendingPrints, retryPendingPrint, deletePendingPrint, printErrorMessage,
  PENDING_PRINTS_EVENT, type PendingPrint,
} from '../lib/lanPrint';

const POLL_MS = 15_000;
/** Pagine pubbliche o senza stampa: niente richieste al print agent. */
const HIDDEN_PREFIXES = ['/menu', '/qr-menu', '/etichetta', '/rear'];

function minutiFa(iso: string, now: number): string {
  const mins = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'adesso';
  if (mins < 60) return `${mins} min fa`;
  return `${Math.floor(mins / 60)} h fa`;
}

/**
 * Avviso "Comande non stampate": le comande che il print agent non è riuscito a stampare (stampante
 * spenta, carta finita, coperchio aperto). Quelle con ristampa automatica escono da sole appena la
 * stampante è pronta; qui si possono ristampare subito o eliminare (se già ribattute a mano).
 */
export default function PendingPrintsBar() {
  const location = useLocation();
  const hidden = HIDDEN_PREFIXES.some(p => location.pathname.startsWith(p));
  const [jobs, setJobs] = useState<PendingPrint[]>([]);
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const { confirm } = useConfirm();
  const { addToast } = useToast();

  const load = useCallback(async () => {
    try {
      setJobs(await fetchPendingPrints(getPrintAgentUrl()));
      setNow(Date.now());
    } catch {
      // print agent non raggiungibile: lo segnala già il pallino stampante, qui non si mostra nulla di nuovo
    }
  }, []);

  useEffect(() => {
    if (hidden) return;
    void load();
    const tick = () => { if (document.visibilityState === 'visible') void load(); };
    const id = setInterval(tick, POLL_MS);
    window.addEventListener(PENDING_PRINTS_EVENT, tick);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(id);
      window.removeEventListener(PENDING_PRINTS_EVENT, tick);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [hidden, load]);

  useEffect(() => { if (jobs.length === 0) setOpen(false); }, [jobs.length]);

  if (hidden || jobs.length === 0) return null;

  const retry = async (job: PendingPrint) => {
    setBusyId(job.id);
    try {
      await retryPendingPrint(getPrintAgentUrl(), job.id);
      addToast({ type: 'success', title: 'Comanda stampata', message: job.label, duration: 2500 });
    } catch (e) {
      addToast({ type: 'error', title: 'Ancora non stampata', message: printErrorMessage(e), duration: 5000 });
    } finally {
      setBusyId(null);
      void load();
    }
  };

  const remove = async (job: PendingPrint) => {
    const ok = await confirm({
      title: 'Eliminare la comanda in attesa?',
      message: `"${job.label}" non verrà più stampata. Fallo solo se l'hai già ribattuta o data a voce in cucina.`,
      confirmLabel: 'Elimina',
      cancelLabel: 'Annulla',
      destructive: true,
    });
    if (!ok) return;
    setBusyId(job.id);
    try { await deletePendingPrint(getPrintAgentUrl(), job.id); }
    catch (e) { addToast({ type: 'error', title: 'Errore', message: printErrorMessage(e), duration: 4000 }); }
    finally { setBusyId(null); void load(); }
  };

  const lastReason = jobs[jobs.length - 1].reason;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed left-1/2 -translate-x-1/2 top-[max(0.5rem,env(safe-area-inset-top))] z-[95] max-w-[calc(100vw-2rem)] flex items-center gap-2 pl-3 pr-4 py-2.5 rounded-full bg-red-600 text-white shadow-2xl shadow-red-900/50 border border-red-400/50 animate-pulse active:scale-95"
      >
        <Printer size={18} className="shrink-0" />
        <span className="font-black text-sm whitespace-nowrap">
          {jobs.length === 1 ? '1 comanda non stampata' : `${jobs.length} comande non stampate`}
        </span>
        <span className="text-xs font-bold opacity-90 truncate hidden sm:inline">· {printErrorMessage(lastReason)}</span>
      </button>

      {open && (
        <Dialog
          open
          onClose={() => setOpen(false)}
          label="Comande non stampate"
          overlayClassName="z-[160] items-end sm:items-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
          panelClassName="bg-surface border border-surface-light w-full sm:max-w-lg rounded-t-[28px] sm:rounded-[28px] shadow-2xl max-h-[90dvh] flex flex-col"
        >
          <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-3 border-b border-surface-light shrink-0">
            <div>
              <h2 className="text-lg font-black text-white">Comande non stampate</h2>
              <p className="text-xs text-gray-400 font-bold mt-0.5">Escono da sole appena la stampante è pronta</p>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Chiudi" className="p-2.5 bg-charcoal rounded-xl text-gray-400 hover:text-white border border-surface-light">
              <X size={20} />
            </button>
          </div>

          <div className="overflow-y-auto overscroll-contain p-4 space-y-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {jobs.map(job => (
              <div key={job.id} className="bg-charcoal border border-surface-light rounded-2xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-black text-white text-base truncate">{job.label || 'Comanda'}</p>
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mt-0.5 flex items-center gap-1.5">
                      {job.kind === 'sala' ? 'Sala' : 'Cucina'} · <Clock size={11} /> {minutiFa(job.createdAt, now)}
                    </p>
                  </div>
                  <span className={`shrink-0 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border ${
                    job.auto ? 'border-amber-500/50 text-amber-300 bg-amber-500/10' : 'border-red-500/50 text-red-300 bg-red-500/10'
                  }`}>
                    {job.auto ? 'Riprova da sola' : 'Da ristampare'}
                  </span>
                </div>
                {job.items.length > 0 && (
                  <p className="text-sm text-gray-300 mt-2 leading-snug">
                    {job.items.slice(0, 6).join(' · ')}{job.items.length > 6 && ` · +${job.items.length - 6}`}
                  </p>
                )}
                <p className="text-xs text-red-300 font-bold mt-2">{printErrorMessage(job.reason)}</p>
                {!job.auto && (
                  <p className="text-xs text-gray-400 mt-1">La stampa si è interrotta a metà: controlla se in cucina è uscito qualcosa prima di ristamparla.</p>
                )}
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <button
                    onClick={() => void remove(job)}
                    disabled={busyId === job.id}
                    className="flex items-center justify-center gap-2 py-3 rounded-xl border border-surface-light text-gray-300 font-bold text-sm active:scale-95 disabled:opacity-40"
                  >
                    <Trash2 size={16} /> Elimina
                  </button>
                  <button
                    onClick={() => void retry(job)}
                    disabled={busyId === job.id}
                    className="flex items-center justify-center gap-2 py-3 rounded-xl bg-gold text-black font-black text-sm active:scale-95 disabled:opacity-40"
                  >
                    <RotateCw size={16} className={busyId === job.id ? 'animate-spin' : ''} /> Ristampa ora
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Dialog>
      )}
    </>
  );
}
