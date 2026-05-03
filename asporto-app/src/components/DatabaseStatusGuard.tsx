import React, { useState, useEffect } from 'react';
import { Database, RefreshCw, AlertCircle } from 'lucide-react';
import { supabase, IS_DEMO_MODE, toggleDemoMode } from '../lib/supabase';

interface Props {
  children: React.ReactNode;
}

export default function DatabaseStatusGuard({ children }: Props) {
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  const checkConnection = async () => {
    if (IS_DEMO_MODE) {
      setIsOnline(true);
      setIsChecking(false);
      return;
    }
    setIsChecking(true);
    try {
      // Simple probe to check if Supabase is reachable
      const { error } = await supabase.from('prodotti').select('id').limit(1);
      
      if (error && error.code === 'PGRST301') {
        // This specific error means "database exists but table might be missing" 
        // which is better than "failed to fetch" (network error)
        setIsOnline(true);
      } else if (error) {
        setIsOnline(false);
      } else {
        setIsOnline(true);
      }
    } catch (err) {
      setIsOnline(false);
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    checkConnection();
  }, []);

  if (isChecking) {
    return (
      <div className="min-h-screen bg-charcoal flex flex-col items-center justify-center space-y-4">
        <RefreshCw className="text-gold animate-spin" size={40} />
        <p className="text-gold font-black italic uppercase tracking-widest text-sm">Connessione al Database...</p>
      </div>
    );
  }

  if (isOnline === false) {
    return (
      <div className="min-h-screen bg-charcoal p-8 flex items-center justify-center">
        <div className="max-w-md w-full bg-surface border border-red-500/30 rounded-[40px] p-10 text-center shadow-[0_0_50px_rgba(239,68,68,0.1)]">
          <div className="inline-flex p-5 bg-red-500/10 rounded-3xl text-red-500 mb-6">
            <Database size={48} />
          </div>
          <h2 className="text-3xl font-black italic uppercase text-white mb-4">Database <span className="text-red-500">Offline</span></h2>
          <p className="text-gray-400 font-medium leading-relaxed mb-8">
            Non è stato possibile stabilire una connessione con il database locale o remoto.
          </p>
          
          <div className="bg-charcoal/50 border border-surface-light rounded-2xl p-4 mb-8 text-left">
            <div className="flex items-center gap-2 text-amber-500 mb-2">
              <AlertCircle size={16} />
              <span className="text-[10px] font-black uppercase tracking-widest">Suggerimento Tecnico</span>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              Assicurati che Supabase sia avviato correttamente. Prova a eseguire <code className="bg-black/30 px-1 rounded text-gold">npx supabase start</code> nel terminale.
            </p>
          </div>

          <button 
            onClick={checkConnection}
            className="w-full bg-surface-light hover:bg-white/10 text-white font-black py-4 rounded-2xl border border-white/10 flex items-center justify-center gap-3 transition-all active:scale-95"
          >
            <RefreshCw size={20} /> RIPROVA CONNESSIONE
          </button>

          <div className="mt-6 flex items-center gap-4">
             <div className="h-px bg-surface-light flex-1"></div>
             <span className="text-[10px] font-black text-gray-600 uppercase">Oppure</span>
             <div className="h-px bg-surface-light flex-1"></div>
          </div>

          <button 
            onClick={() => toggleDemoMode(true)}
            className="w-full mt-6 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 font-black py-4 rounded-2xl border border-emerald-500/20 flex items-center justify-center gap-3 transition-all active:scale-95"
          >
            <Database size={20} /> ENTRA IN MODALITÀ DEMO
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
