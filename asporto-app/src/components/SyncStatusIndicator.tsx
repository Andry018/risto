import { useEffect, useState } from 'react';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { syncManager } from '../lib/OfflineSync';

export default function SyncStatusIndicator({ compact = false }: { compact?: boolean }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(syncManager.getIsSyncing());
  const [pendingCount, setPendingCount] = useState(syncManager.getPendingCount());

  useEffect(() => {
    const handleStatusChange = () => {
      setIsOnline(navigator.onLine);
      setIsSyncing(syncManager.getIsSyncing());
      setPendingCount(syncManager.getPendingCount());
    };

    window.addEventListener('online', handleStatusChange);
    window.addEventListener('offline', handleStatusChange);
    window.addEventListener('sync-status-changed', handleStatusChange);

    return () => {
      window.removeEventListener('online', handleStatusChange);
      window.removeEventListener('offline', handleStatusChange);
      window.removeEventListener('sync-status-changed', handleStatusChange);
    };
  }, []);

  if (compact) {
    if (!isOnline) return <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse inline-block" title="Offline" />;
    if (isSyncing || pendingCount > 0) return <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse inline-block" title={`Sincronizzazione (${pendingCount})`} />;
    return <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" title="Online" />;
  }

  if (!isOnline) {
    return (
      <div className="flex items-center gap-2 px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-full text-red-500 text-[10px] font-black uppercase tracking-widest animate-pulse">
        <WifiOff size={12} /> Offline ({pendingCount} in coda)
      </div>
    );
  }

  if (isSyncing || pendingCount > 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full text-amber-500 text-[10px] font-black uppercase tracking-widest">
        <RefreshCw size={12} className="animate-spin" /> Sincronizzazione... ({pendingCount})
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-500 text-[10px] font-black uppercase tracking-widest">
      <Wifi size={12} /> Sistema Online
    </div>
  );
}
