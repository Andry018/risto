import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, RefreshCw, Server, GitPullRequest, Printer, Radio, LayoutDashboard,
  CheckCircle2, XCircle, ScrollText, KeyRound,
} from 'lucide-react';
import { getSetting, setSetting, SETTINGS_KEYS } from '../lib/appSettings';
import { useToast } from './Toast';
import { useConfirm } from './ConfirmModal';

interface StatusResponse {
  nginx: boolean;
  webhook: boolean;
  adminServer: boolean;
  printAgent: boolean;
}

interface LogResponse {
  lines: string[];
  total: number;
}

const API_BASE = '/admin/api';

function statusBadge(label: string, ok: boolean | null) {
  return (
    <div key={label} className={`flex items-center gap-3 p-4 rounded-2xl border ${'bg-surface border-surface-light'}`}>
      {ok === null ? (
        <div className="w-5 h-5 rounded-full border-2 border-gray-600 border-t-transparent animate-spin" />
      ) : ok ? (
        <CheckCircle2 className="text-emerald-500" size={20} />
      ) : (
        <XCircle className="text-rose-500" size={20} />
      )}
      <span className={`font-bold text-sm ${ok === false ? 'text-rose-400' : 'text-white'}`}>{label}</span>
    </div>
  );
}

export default function SystemPanelView() {
  const { addToast } = useToast();
  const { confirm } = useConfirm();
  const [secret, setSecretState] = useState(() => getSetting(SETTINGS_KEYS.systemPanelSecret, ''));
  const [secretDraft, setSecretDraft] = useState(secret);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [loadingLog, setLoadingLog] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [authError, setAuthError] = useState(false);

  const authHeaders = useCallback((): HeadersInit => ({ 'X-Admin-Secret': secret }), [secret]);

  const fetchStatus = useCallback(async () => {
    if (!secret) return;
    setLoadingStatus(true);
    try {
      const res = await fetch(`${API_BASE}/status`, { headers: authHeaders() });
      if (res.status === 401) { setAuthError(true); setStatus(null); return; }
      setAuthError(false);
      const data: StatusResponse = await res.json();
      setStatus(data);
    } catch {
      addToast({ type: 'error', title: 'Errore', message: 'Impossibile contattare il pannello sistema.' });
    } finally {
      setLoadingStatus(false);
    }
  }, [secret, authHeaders, addToast]);

  const fetchLog = useCallback(async () => {
    if (!secret) return;
    setLoadingLog(true);
    try {
      const res = await fetch(`${API_BASE}/log`, { headers: authHeaders() });
      if (res.status === 401) { setAuthError(true); return; }
      setAuthError(false);
      const data: LogResponse = await res.json();
      setLog(data.lines);
    } catch {
      addToast({ type: 'error', title: 'Errore', message: 'Impossibile caricare il log.' });
    } finally {
      setLoadingLog(false);
    }
  }, [secret, authHeaders, addToast]);

  useEffect(() => {
    if (!secret) return;
    fetchStatus();
    fetchLog();
    const interval = setInterval(fetchStatus, 20000);
    return () => clearInterval(interval);
  }, [secret, fetchStatus, fetchLog]);

  const runAction = async (action: string, endpoint: string, label: string, destructive = false) => {
    if (destructive) {
      const ok = await confirm({ title: label, message: `Confermi "${label}"? I servizi coinvolti si fermeranno per qualche secondo.`, destructive: true });
      if (!ok) return;
    }
    setBusyAction(action);
    try {
      const res = await fetch(`${API_BASE}/${endpoint}`, { method: 'POST', headers: authHeaders() });
      if (res.status === 401) { setAuthError(true); return; }
      const data = await res.json();
      if (data.ok) {
        addToast({ type: 'success', title: label, message: data.message || 'Operazione completata.' });
      } else {
        addToast({ type: 'error', title: label, message: data.error || data.stderr || 'Operazione fallita.' });
      }
    } catch {
      addToast({ type: 'error', title: 'Errore', message: 'Impossibile contattare il pannello sistema.' });
    } finally {
      setBusyAction(null);
      setTimeout(fetchStatus, 1500);
    }
  };

  const saveSecret = () => {
    setSetting(SETTINGS_KEYS.systemPanelSecret, secretDraft.trim());
    setSecretState(secretDraft.trim());
  };

  if (!secret) {
    return (
      <div className={`min-h-screen ${'bg-charcoal text-gray-300'} font-sans flex items-center justify-center p-6`}>
        <div className={`w-full max-w-md ${'bg-surface border-surface-light'} border rounded-[32px] p-8`}>
          <div className="flex items-center gap-3 mb-6">
            <KeyRound className="text-gold" size={28} />
            <h1 className="text-xl font-bold text-white">Pannello Servizi</h1>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Inserisci il secret configurato sul PC del locale (variabile d'ambiente <code className="text-gold">ADMIN_SECRET</code> di <code className="text-gold">admin-server</code>).
          </p>
          <input
            type="password"
            value={secretDraft}
            onChange={e => setSecretDraft(e.target.value)}
            placeholder="Secret pannello sistema"
            className={`w-full ${'bg-charcoal border-surface-light focus:border-gold'} border rounded-xl py-3 px-4 text-white outline-none mb-4`}
          />
          <button
            onClick={saveSecret}
            className={`w-full ${'bg-gold text-black'} font-bold py-3 rounded-xl`}
          >
            Salva e connetti
          </button>
          <Link to="/settings" className="block text-center text-xs text-gray-500 hover:text-white mt-4">
            <ArrowLeft size={14} className="inline mr-1" /> Torna a Impostazioni
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${'bg-charcoal text-gray-300'} font-sans p-4 md:p-10`}>
      <div className="max-w-4xl mx-auto">
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Link to="/settings" className={`p-2 rounded-xl ${'bg-surface text-gray-500 hover:text-white'}`}>
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white">Pannello Servizi</h1>
              <p className="text-sm text-gray-500">Stato e controllo dei servizi sul PC del locale.</p>
            </div>
          </div>
          <button
            onClick={fetchStatus}
            disabled={loadingStatus}
            className={`p-3 rounded-xl ${'bg-surface text-gray-400 hover:text-white'} disabled:opacity-40`}
          >
            <RefreshCw size={18} className={loadingStatus ? 'animate-spin' : ''} />
          </button>
        </header>

        {authError && (
          <div className="mb-6 p-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 text-rose-400 text-sm font-bold">
            Secret non valido o server non raggiungibile. Controlla che il valore corrisponda a <code>ADMIN_SECRET</code> sul PC del locale, oppure che <code>admin-server</code> sia in esecuzione.
            <button onClick={() => { setSetting(SETTINGS_KEYS.systemPanelSecret, ''); setSecretState(''); }} className="block mt-2 underline">
              Reimposta secret
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {statusBadge('Nginx', status?.nginx ?? null)}
          {statusBadge('Webhook', status?.webhook ?? null)}
          {statusBadge('Pannello Servizi', status?.adminServer ?? null)}
          {statusBadge('Print Agent', status?.printAgent ?? null)}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
          <button
            onClick={() => runAction('nginx', 'restart-nginx', 'Riavvia Nginx', true)}
            disabled={busyAction !== null}
            className={`flex items-center justify-center gap-2 ${'bg-surface border-surface-light hover:border-gold/40'} border rounded-2xl py-4 font-bold text-sm disabled:opacity-40`}
          >
            <Server size={16} /> Nginx
          </button>
          <button
            onClick={() => runAction('print', 'restart-print', 'Riavvia Print Agent')}
            disabled={busyAction !== null}
            className={`flex items-center justify-center gap-2 ${'bg-surface border-surface-light hover:border-gold/40'} border rounded-2xl py-4 font-bold text-sm disabled:opacity-40`}
          >
            <Printer size={16} /> Print Agent
          </button>
          <button
            onClick={() => runAction('webhook', 'restart-webhook', 'Riavvia Webhook')}
            disabled={busyAction !== null}
            className={`flex items-center justify-center gap-2 ${'bg-surface border-surface-light hover:border-gold/40'} border rounded-2xl py-4 font-bold text-sm disabled:opacity-40`}
          >
            <Radio size={16} /> Webhook
          </button>
          <button
            onClick={() => runAction('admin', 'restart-admin', 'Riavvia Pannello Servizi')}
            disabled={busyAction !== null}
            className={`flex items-center justify-center gap-2 ${'bg-surface border-surface-light hover:border-gold/40'} border rounded-2xl py-4 font-bold text-sm disabled:opacity-40`}
          >
            <LayoutDashboard size={16} /> Pannello
          </button>
          <button
            onClick={() => runAction('git', 'autopull', 'Aggiorna da Git')}
            disabled={busyAction !== null}
            className={`flex items-center justify-center gap-2 ${'bg-surface border-surface-light hover:border-gold/40'} border rounded-2xl py-4 font-bold text-sm disabled:opacity-40`}
          >
            <GitPullRequest size={16} /> Aggiorna da Git
          </button>
          <button
            onClick={() => runAction('all', 'restart-all', 'Riavvia Tutti i Servizi', true)}
            disabled={busyAction !== null}
            className={`flex items-center justify-center gap-2 ${'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20'} border rounded-2xl py-4 font-bold text-sm disabled:opacity-40`}
          >
            <RefreshCw size={16} /> Riavvia Tutto
          </button>
        </div>

        <div className={`${'bg-surface border-surface-light'} border rounded-2xl p-5`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ScrollText size={18} className="text-gold" />
              <h2 className="font-bold text-white text-sm uppercase tracking-widest">Log Aggiornamenti (log_git.txt)</h2>
            </div>
            <button
              onClick={fetchLog}
              disabled={loadingLog}
              className="text-xs font-bold text-gray-500 hover:text-white disabled:opacity-40"
            >
              Aggiorna
            </button>
          </div>
          <div className="bg-black/40 rounded-xl p-4 max-h-96 overflow-y-auto font-mono text-xs text-gray-400 whitespace-pre-wrap break-all">
            {log.length === 0 ? 'Nessuna riga di log disponibile.' : log.join('\n')}
          </div>
        </div>
      </div>
    </div>
  );
}
