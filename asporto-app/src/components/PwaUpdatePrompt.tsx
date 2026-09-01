import { RefreshCw } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';

export function PwaUpdatePrompt() {
  const { needRefresh, updateServiceWorker } = useRegisterSW();
  const [needsUpdate] = needRefresh;

  if (!needsUpdate) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[300] w-[calc(100%-2rem)] max-w-sm">
      <div className="flex items-center gap-3 rounded-2xl border border-surface-light bg-surface shadow-2xl p-4 backdrop-blur-xl">
        <div className="shrink-0 text-white/80">
          <RefreshCw size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-black text-sm uppercase tracking-wider text-white">Aggiornamento disponibile</p>
          <p className="text-xs text-white/70 mt-0.5">Nuova versione dell'app pronta.</p>
        </div>
        <button
          onClick={() => updateServiceWorker(true)}
          className="shrink-0 rounded-xl bg-white/10 hover:bg-white/20 transition-colors px-3 py-2 text-xs font-black uppercase tracking-wider text-white"
        >
          Aggiorna
        </button>
      </div>
    </div>
  );
}
