import { useState, useEffect, useCallback } from 'react';
import { CreditCard, ChevronLeft, ChevronRight, RefreshCw, RotateCcw, Hand, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { useConfirm } from '../ConfirmModal';
import { useToast } from '../Toast';
import { toLocalISODate } from '../../lib/dateUtils';
import { reverseCardPayment } from '../../lib/ecrAgent';
import {
  fetchCardPayments, markReversed, resolveUnknown, getAdminSecret,
  type CardPayment, type CardPaymentOutcome,
} from '../../lib/cardPayments';

const OUTCOME_STYLE: Record<CardPaymentOutcome, { label: string; cls: string }> = {
  APPROVATO:    { label: 'Approvato',    cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  RIFIUTATO:    { label: 'Rifiutato',    cls: 'bg-red-500/10 text-red-400 border-red-500/30' },
  NON_ESEGUITO: { label: 'Non eseguito', cls: 'bg-gray-500/10 text-gray-400 border-gray-500/30' },
  SCONOSCIUTO:  { label: 'Da verificare', cls: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
};

const euro = (n: number) => `€${n.toFixed(2)}`;
const time = (iso: string) => new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

function shiftDay(day: string, delta: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return toLocalISODate(new Date(y, m - 1, d + delta));
}

export default function PagamentiCartaSection() {
  const { confirm } = useConfirm();
  const { addToast } = useToast();
  const [day, setDay] = useState(() => toLocalISODate());
  const [rows, setRows] = useState<CardPayment[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await fetchCardPayments(day));
    } catch (e) {
      addToast({ type: 'error', title: 'Registro carte', message: e instanceof Error ? e.message : 'Caricamento fallito' });
    } finally {
      setLoading(false);
    }
  }, [day, addToast]);

  useEffect(() => { void load(); }, [load]);

  const isToday = day === toLocalISODate();
  const approved = rows.filter(r => r.esito === 'APPROVATO' && !r.stornato_at);
  const total = approved.reduce((s, r) => s + r.importo, 0);
  const unknown = rows.filter(r => r.esito === 'SCONOSCIUTO');
  const reversedCount = rows.filter(r => r.stornato_at).length;

  // Lo storno ECR ('S') vale per l'ULTIMA transazione del terminale: solo la riga più recente
  // con STAN, se approvata, non stornata e di oggi
  const lastWithStan = rows.find(r => r.stan);
  const reversibleId = isToday && lastWithStan?.esito === 'APPROVATO' && !lastWithStan.stornato_at ? lastWithStan.id : null;

  async function run(id: string, fn: () => Promise<void>) {
    setBusyId(id);
    try { await fn(); await load(); }
    catch (e) { addToast({ type: 'error', title: 'Errore', message: e instanceof Error ? e.message : 'Operazione fallita' }); }
    finally { setBusyId(null); }
  }

  async function handleEcrReversal(r: CardPayment) {
    const secret = getAdminSecret();
    if (!secret) {
      addToast({ type: 'error', title: 'Secret mancante', message: 'Inserisci il secret nel Pannello Sistema (/servizi) per stornare dal gestionale' });
      return;
    }
    const ok = await confirm({
      title: 'Stornare il pagamento?',
      message: `${euro(r.importo)} — ${r.riferimento} (${time(r.created_at)}, STAN ${r.stan}). L'importo verrà restituito sulla carta del cliente.`,
      confirmLabel: 'Storna',
      destructive: true,
    });
    if (!ok) return;
    await run(r.id, async () => {
      const res = await reverseCardPayment(r.stan!, secret);
      if (!res.ok) throw new Error(`${res.error || 'Storno rifiutato'} — se serve, stornalo dal terminale e poi "Segna stornato"`);
      await markReversed(r.id, 'ECR');
      addToast({ type: 'success', title: 'Stornato', message: `${euro(r.importo)} restituiti` });
    });
  }

  async function handleManualReversal(r: CardPayment) {
    const ok = await confirm({
      title: 'Segnare come stornato?',
      message: `Usa questa opzione DOPO aver stornato ${euro(r.importo)} (${r.riferimento}, ${time(r.created_at)}) direttamente sul terminale. Qui viene solo registrato.`,
      confirmLabel: 'Segna stornato',
    });
    if (ok) await run(r.id, () => markReversed(r.id, 'MANUALE', 'Stornato dal terminale'));
  }

  async function handleResolve(r: CardPayment, esito: 'APPROVATO' | 'NON_ESEGUITO') {
    const ok = await confirm({
      title: esito === 'APPROVATO' ? 'Il pagamento era passato?' : 'Il pagamento NON era passato?',
      message: `${euro(r.importo)} — ${r.riferimento} (${time(r.created_at)}). Verificalo sul POS o sul rapporto del terminale prima di confermare.`,
      confirmLabel: 'Conferma',
    });
    if (ok) await run(r.id, () => resolveUnknown(r.id, esito));
  }

  return (
    <div className="max-w-3xl mx-auto mt-8 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-2xl font-black text-white uppercase italic tracking-tight flex items-center gap-2">
          <CreditCard size={22} className="text-gold" /> Pagamenti <span className="text-gold">Carta</span>
        </h2>
        <div className="flex items-center gap-1">
          <button onClick={() => setDay(d => shiftDay(d, -1))} className="p-2 rounded-xl bg-charcoal border border-surface-light text-gray-400 hover:text-white" title="Giorno precedente">
            <ChevronLeft size={16} />
          </button>
          <span className="px-3 text-xs font-bold text-gray-300 min-w-[110px] text-center">
            {isToday ? 'Oggi' : new Date(day + 'T00:00').toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })}
          </span>
          <button onClick={() => setDay(d => shiftDay(d, 1))} disabled={isToday} className="p-2 rounded-xl bg-charcoal border border-surface-light text-gray-400 hover:text-white disabled:opacity-30" title="Giorno successivo">
            <ChevronRight size={16} />
          </button>
          <button onClick={() => void load()} disabled={loading} className="p-2 rounded-xl bg-charcoal border border-surface-light text-gray-400 hover:text-white ml-1" title="Aggiorna">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Riepilogo — da confrontare con il rapporto totali del POS */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-charcoal/40 border border-surface-light rounded-2xl p-4">
          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Incassato carta</p>
          <p className="text-xl font-black text-white mt-1">{euro(total)}</p>
        </div>
        <div className="bg-charcoal/40 border border-surface-light rounded-2xl p-4">
          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Transazioni</p>
          <p className="text-xl font-black text-white mt-1">{approved.length}</p>
        </div>
        <div className="bg-charcoal/40 border border-surface-light rounded-2xl p-4">
          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Stornate</p>
          <p className="text-xl font-black text-white mt-1">{reversedCount}</p>
        </div>
      </div>

      {unknown.length > 0 && (
        <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4">
          <AlertTriangle size={20} className="text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-gray-300">
            <strong className="text-amber-400">{unknown.length} pagament{unknown.length === 1 ? 'o' : 'i'} da verificare:</strong>{' '}
            controlla sul rapporto del POS se sono passati e segnalo qui sotto, così i totali tornano.
          </p>
        </div>
      )}

      <div className="border border-surface-light rounded-2xl overflow-hidden">
        {rows.length === 0 ? (
          <p className="text-center text-sm text-gray-600 py-8">{loading ? 'Caricamento…' : 'Nessun pagamento carta'}</p>
        ) : rows.map(r => {
          const st = OUTCOME_STYLE[r.esito];
          const busy = busyId === r.id;
          return (
            <div key={r.id} className={`p-4 border-b border-surface-light/50 last:border-0 ${r.stornato_at ? 'opacity-60' : ''}`}>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="font-mono text-xs text-gray-500">{time(r.created_at)}</span>
                <span className="font-bold text-sm text-white">{r.riferimento}{r.quota ? ` (${r.quota})` : ''}</span>
                <span className={`font-black text-sm ${r.stornato_at ? 'line-through text-gray-500' : 'text-white'}`}>{euro(r.importo)}</span>
                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-lg border ${st.cls}`}>{st.label}</span>
                {r.recuperato && <span className="text-[10px] text-sky-400 font-bold" title="Esito recuperato dal terminale dopo una risposta persa">recuperato</span>}
                {r.stornato_at && (
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-lg border bg-purple-500/10 text-purple-300 border-purple-500/30">
                    Stornato {r.storno_tipo === 'ECR' ? 'dal gestionale' : 'dal terminale'}
                  </span>
                )}
              </div>
              <div className="text-[10px] text-gray-500 mt-1 font-mono">
                {r.stan && <>STAN {r.stan} · </>}{r.auth_code && <>Auth {r.auth_code} · </>}{r.operatore || '—'}
                {r.errore && <span className="text-gray-400 font-sans"> · {r.errore}</span>}
                {r.stornato_at && <> · storno {time(r.stornato_at)} {r.storno_operatore}</>}
              </div>

              {!r.stornato_at && (
                <div className="flex gap-2 mt-3 flex-wrap">
                  {r.id === reversibleId && (
                    <button onClick={() => void handleEcrReversal(r)} disabled={busy}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-[11px] font-black uppercase hover:bg-red-500/20 disabled:opacity-50">
                      {busy ? <RefreshCw size={12} className="animate-spin" /> : <RotateCcw size={12} />} Storna
                    </button>
                  )}
                  {(r.esito === 'APPROVATO') && (
                    <button onClick={() => void handleManualReversal(r)} disabled={busy}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-charcoal border border-surface-light text-gray-400 text-[11px] font-black uppercase hover:text-white disabled:opacity-50"
                      title="Per storni fatti direttamente sul terminale">
                      <Hand size={12} /> Segna stornato
                    </button>
                  )}
                  {r.esito === 'SCONOSCIUTO' && (
                    <>
                      <button onClick={() => void handleResolve(r, 'APPROVATO')} disabled={busy}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-black uppercase disabled:opacity-50">
                        <CheckCircle2 size={12} /> Era passato
                      </button>
                      <button onClick={() => void handleResolve(r, 'NON_ESEGUITO')} disabled={busy}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-charcoal border border-surface-light text-gray-400 text-[11px] font-black uppercase disabled:opacity-50">
                        <XCircle size={12} /> Non era passato
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-gray-600">
        Lo storno dal gestionale è possibile solo sull'ultima transazione del terminale (protocollo Nexi).
        Per le precedenti: storno dal terminale, poi "Segna stornato". Confronta il totale con il rapporto del POS a fine serata.
      </p>
    </div>
  );
}
