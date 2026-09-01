/**
 * CassaFiscaleTab — Pannello Chiusura Z e Rapporto X
 *
 * La Chiusura Z è obbligatoria per legge (DM 7 dicembre 2016, art. 6):
 * azzera i contatori giornalieri del Registratore Telematico e trasmette
 * automaticamente i corrispettivi all'Agenzia delle Entrate.
 * Deve essere eseguita ogni giorno lavorativo, al termine del servizio.
 */

import { useState, useEffect } from 'react';
import {
  Receipt, FileText, AlertTriangle, CheckCircle2,
  Clock, RefreshCw, Wifi, WifiOff, History, Info,
} from 'lucide-react';
import { useConfirm } from '../ConfirmModal';
import { useToast } from '../Toast';
import { performZReport, performXReport, pingEcrAgent } from '../../lib/ecrAgent';
import { getCurrentUser } from '../../lib/staffAuth';
import { toLocalISODate } from '../../lib/dateUtils';

// ---------------------------------------------------------------------------
// Storico Z — persistito in localStorage
// ---------------------------------------------------------------------------

type ZLogEntry = {
  date: string;     // YYYY-MM-DD
  time: string;     // HH:MM
  operator: string;
};

const Z_LOG_KEY = 'risto_z_log';

function loadZLog(): ZLogEntry[] {
  try { return JSON.parse(localStorage.getItem(Z_LOG_KEY) || '[]'); } catch { return []; }
}

function appendZLog(entry: ZLogEntry) {
  const log = loadZLog();
  // Sostituisce se già presente per la stessa data (ri-esecuzione in caso di errore precedente)
  const filtered = log.filter(e => e.date !== entry.date);
  filtered.unshift(entry);
  localStorage.setItem(Z_LOG_KEY, JSON.stringify(filtered.slice(0, 90))); // ~3 mesi
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export default function CassaFiscaleTab() {
  const { confirm } = useConfirm();
  const { addToast } = useToast();

  const [zLog, setZLog] = useState<ZLogEntry[]>(() => loadZLog());
  const [xLoading, setXLoading] = useState(false);
  const [zLoading, setZLoading] = useState(false);
  const [agentOnline, setAgentOnline] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);

  const today = toLocalISODate();
  const todayEntry = zLog.find(e => e.date === today);
  const zDoneToday = !!todayEntry;

  // Calcola quanti giorni consecutivi sono stati saltati
  const missedDays = (() => {
    const missed: string[] = [];
    const d = new Date();
    for (let i = 1; i <= 30; i++) {
      d.setDate(d.getDate() - 1);
      const iso = toLocalISODate(new Date(d));
      if (!zLog.find(e => e.date === iso)) missed.push(iso);
      else break;
    }
    return missed;
  })();

  useEffect(() => {
    void checkAgent();
  }, []);

  async function checkAgent() {
    setChecking(true);
    const ok = await pingEcrAgent();
    setAgentOnline(ok);
    setChecking(false);
  }

  async function handleXReport() {
    if (!agentOnline) {
      addToast({ type: 'error', title: 'Agent non raggiungibile', message: 'Verifica che ecr-agent sia avviato.' });
      return;
    }
    setXLoading(true);
    try {
      const result = await performXReport();
      if (result.ok) {
        addToast({ type: 'success', title: 'Rapporto X inviato', message: 'La cassa ha stampato il rapporto intermedio.' });
      } else {
        addToast({ type: 'error', title: 'Errore Rapporto X', message: result.error || 'Cassa non ha risposto.' });
      }
    } finally {
      setXLoading(false);
    }
  }

  async function handleZReport() {
    if (!agentOnline) {
      addToast({ type: 'error', title: 'Agent non raggiungibile', message: 'Verifica che ecr-agent sia avviato.' });
      return;
    }

    const ok = await confirm({
      title: 'Esegui Chiusura Z',
      message:
        'La Chiusura Z è IRREVERSIBILE.\n\n' +
        'Azzera i contatori giornalieri e trasmette i corrispettivi ' +
        "all'Agenzia delle Entrate tramite il Registratore Telematico.\n\n" +
        'Assicurati che tutte le vendite della giornata siano state registrate. Continuare?',
      destructive: true,
    });
    if (!ok) return;

    setZLoading(true);
    try {
      const result = await performZReport();
      if (result.ok) {
        const now = new Date();
        const entry: ZLogEntry = {
          date: today,
          time: now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
          operator: getCurrentUser()?.name || 'Operatore',
        };
        appendZLog(entry);
        setZLog(loadZLog());
        addToast({
          type: 'success',
          title: 'Chiusura Z eseguita',
          message: `Corrispettivi trasmessi alle ${entry.time}. Obbligo fiscale soddisfatto.`,
        });
      } else {
        addToast({
          type: 'error',
          title: 'Chiusura Z fallita',
          message: result.error || 'La cassa non ha risposto. Riprovare o contattare il tecnico.',
        });
      }
    } finally {
      setZLoading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-black text-white uppercase italic tracking-tight">
            Cassa <span className="text-gold">Fiscale</span>
          </h2>
          <p className="text-xs text-gray-500 font-bold mt-1 uppercase tracking-widest">
            Registratore Telematico — Custom Big Plus RT
          </p>
        </div>
        {/* Agent status */}
        <button
          onClick={checkAgent}
          disabled={checking}
          className="flex items-center gap-2 px-4 py-2 bg-charcoal border border-surface-light rounded-xl text-xs font-bold transition-all hover:border-gray-500 active:scale-95"
          title="Ricontrolla connessione"
        >
          {checking ? (
            <RefreshCw size={14} className="animate-spin text-gray-400" />
          ) : agentOnline === true ? (
            <Wifi size={14} className="text-emerald-400" />
          ) : agentOnline === false ? (
            <WifiOff size={14} className="text-red-400" />
          ) : (
            <Wifi size={14} className="text-gray-600" />
          )}
          <span className={
            agentOnline === true ? 'text-emerald-400' :
            agentOnline === false ? 'text-red-400' : 'text-gray-500'
          }>
            {checking ? 'Verifica...' : agentOnline === true ? 'Cassa Online' : agentOnline === false ? 'Cassa Offline' : 'Stato sconosciuto'}
          </span>
        </button>
      </div>

      {/* Stato giornaliero */}
      {zDoneToday ? (
        <div className="flex items-center gap-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-5">
          <CheckCircle2 size={28} className="text-emerald-400 shrink-0" />
          <div>
            <p className="font-black text-emerald-400 text-sm uppercase tracking-widest">
              Chiusura Z eseguita oggi
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              Ore {todayEntry!.time} — {todayEntry!.operator} — Corrispettivi trasmessi all'AdE
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-4 bg-red-500/10 border border-red-500/30 rounded-2xl p-5">
          <AlertTriangle size={28} className="text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-black text-red-400 text-sm uppercase tracking-widest">
              Chiusura Z non ancora eseguita oggi
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              {missedDays.length > 0
                ? `Attenzione: mancano anche ${missedDays.length} giorn${missedDays.length === 1 ? 'o' : 'i'} precedent${missedDays.length === 1 ? 'e' : 'i'}. Consultare il tecnico.`
                : 'Eseguire la Chiusura Z al termine di ogni giornata lavorativa (obbligo DM 7/12/2016).'}
            </p>
          </div>
        </div>
      )}

      {/* Azioni */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* Rapporto X */}
        <div className="bg-surface border border-surface-light rounded-2xl p-5 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 flex items-center justify-center shrink-0">
              <FileText size={20} className="text-sky-400" />
            </div>
            <div>
              <p className="font-black text-white text-sm">Rapporto X</p>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Lettura intermedia</p>
            </div>
          </div>
          <p className="text-xs text-gray-500 leading-relaxed">
            Stampa lo stato dei corrispettivi della giornata <strong className="text-gray-300">senza azzerare</strong> i contatori.
            Non è un atto fiscale: può essere eseguito quante volte si vuole.
          </p>
          <button
            onClick={handleXReport}
            disabled={xLoading || agentOnline === false}
            className="mt-auto w-full flex items-center justify-center gap-2 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-sky-400 font-black text-xs uppercase tracking-widest py-3 rounded-xl transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {xLoading ? <RefreshCw size={14} className="animate-spin" /> : <FileText size={14} />}
            {xLoading ? 'Attendi...' : 'Stampa Rapporto X'}
          </button>
        </div>

        {/* Chiusura Z */}
        <div className="bg-surface border border-red-500/20 rounded-2xl p-5 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
              <Receipt size={20} className="text-red-400" />
            </div>
            <div>
              <p className="font-black text-white text-sm">Chiusura Z</p>
              <p className="text-[10px] text-red-400 font-black uppercase tracking-widest">Atto fiscale — irreversibile</p>
            </div>
          </div>
          <p className="text-xs text-gray-500 leading-relaxed">
            Azzera i contatori giornalieri e <strong className="text-gray-300">trasmette i corrispettivi all'Agenzia delle Entrate</strong>.
            Eseguire una sola volta al termine di ogni giornata lavorativa.
          </p>
          <button
            onClick={handleZReport}
            disabled={zLoading || agentOnline === false}
            className="mt-auto w-full flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 font-black text-xs uppercase tracking-widest py-3 rounded-xl transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {zLoading ? <RefreshCw size={14} className="animate-spin" /> : <Receipt size={14} />}
            {zLoading ? 'Esecuzione in corso...' : 'Esegui Chiusura Z'}
          </button>
        </div>
      </div>

      {/* Nota legale */}
      <div className="flex items-start gap-3 bg-gold/5 border border-gold/20 rounded-2xl p-4">
        <Info size={16} className="text-gold shrink-0 mt-0.5" />
        <p className="text-xs text-gray-500 leading-relaxed">
          <strong className="text-gold">Obbligo di legge</strong> — DM 7 dicembre 2016, art. 6.
          Il Registratore Telematico trasmette autonomamente i corrispettivi all'AdE a ogni Chiusura Z.
          La mancata esecuzione giornaliera è soggetta a sanzione.
          In caso di guasto della cassa, contattare immediatamente il tecnico abilitato.
        </p>
      </div>

      {/* Storico */}
      <div className="bg-surface border border-surface-light rounded-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-surface-light">
          <History size={16} className="text-gold" />
          <h3 className="font-black text-white text-sm uppercase tracking-widest">Storico Chiusure Z</h3>
          <span className="ml-auto text-[10px] text-gray-600 font-bold uppercase tracking-widest">
            Ultimi {zLog.length} record
          </span>
        </div>
        {zLog.length === 0 ? (
          <div className="py-10 text-center text-gray-600">
            <Clock size={32} strokeWidth={1} className="mx-auto mb-3 opacity-30" />
            <p className="text-xs font-bold uppercase tracking-widest">Nessuna chiusura registrata</p>
          </div>
        ) : (
          <div className="divide-y divide-surface-light">
            {zLog.slice(0, 30).map((entry, i) => {
              const [y, m, d] = entry.date.split('-').map(Number);
              const dateLabel = new Date(y, m - 1, d)
                .toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
              const isToday = entry.date === today;
              return (
                <div key={i} className={`flex items-center justify-between px-5 py-3 ${isToday ? 'bg-emerald-500/5' : ''}`}>
                  <div className="flex items-center gap-3">
                    {isToday && (
                      <span className="text-[9px] font-black uppercase tracking-widest bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                        Oggi
                      </span>
                    )}
                    <span className="text-sm font-bold text-white capitalize">{dateLabel}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span className="font-mono font-bold">{entry.time}</span>
                    <span>{entry.operator}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
