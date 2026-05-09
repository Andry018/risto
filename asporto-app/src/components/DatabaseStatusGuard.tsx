import React, { useState, useEffect, useCallback } from 'react';
import { Database, RefreshCw, AlertCircle, X } from 'lucide-react';
import { supabase, IS_DEMO_MODE, toggleDemoMode } from '../lib/supabase';

interface Props {
  children: React.ReactNode;
}

export default function DatabaseStatusGuard({ children }: Props) {
  const [dbIssue, setDbIssue] = useState<'none' | 'not_configured' | 'unreachable'>('none');
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const checkConnection = useCallback(async () => {
    if (IS_DEMO_MODE) {
      setDbIssue('none');
      return;
    }
    if (!supabase) {
      setDbIssue('not_configured');
      return;
    }
    try {
      const { error } = await supabase.from('prodotti').select('id').limit(1);
      if (error && error.code === 'PGRST301') {
        setDbIssue('none');
      } else if (error) {
        setDbIssue('unreachable');
      } else {
        setDbIssue('none');
      }
    } catch {
      setDbIssue('unreachable');
    }
  }, []);

  useEffect(() => {
    void checkConnection();
  }, [checkConnection]);

  const showBanner =
    !bannerDismissed &&
    !IS_DEMO_MODE &&
    (dbIssue === 'not_configured' || dbIssue === 'unreachable');

  return (
    <>
      {showBanner && (
        <div
          className={`fixed top-0 left-0 right-0 z-[200] flex items-center gap-3 px-4 py-3 text-sm font-medium shadow-lg ${
            dbIssue === 'not_configured'
              ? 'bg-amber-950/95 text-amber-100 border-b border-amber-500/30'
              : 'bg-red-950/95 text-red-100 border-b border-red-500/30'
          }`}
        >
          <AlertCircle size={18} className="shrink-0 opacity-90" />
          <div className="flex-1 min-w-0">
            {dbIssue === 'not_configured' ? (
              <span>
                Backend non configurato: imposta{' '}
                <code className="text-xs bg-black/30 px-1 rounded">VITE_SUPABASE_URL</code> e{' '}
                <code className="text-xs bg-black/30 px-1 rounded">VITE_SUPABASE_ANON_KEY</code> per
                la build di produzione, oppure avvia <code className="text-xs bg-black/30 px-1 rounded">npx supabase start</code> in locale.
              </span>
            ) : (
              <span>
                Impossibile contattare Supabase (rete o API spenta). L&apos;app resta utilizzabile; i
                dati potrebbero non aggiornarsi.
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => toggleDemoMode(true)}
            className="shrink-0 flex items-center gap-1.5 rounded-lg bg-emerald-600/90 hover:bg-emerald-500 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-white"
          >
            <Database size={14} /> Demo
          </button>
          <button
            type="button"
            onClick={() => void checkConnection()}
            className="shrink-0 flex items-center gap-1.5 rounded-lg bg-white/10 hover:bg-white/20 px-3 py-1.5 text-xs font-black uppercase tracking-wide"
          >
            <RefreshCw size={14} /> Riprova
          </button>
          <button
            type="button"
            onClick={() => setBannerDismissed(true)}
            className="shrink-0 p-1.5 rounded-lg hover:bg-white/10 text-current opacity-70 hover:opacity-100"
            aria-label="Chiudi"
          >
            <X size={18} />
          </button>
        </div>
      )}
      {children}
    </>
  );
}
