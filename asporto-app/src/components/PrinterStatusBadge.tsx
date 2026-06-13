import { useEffect, useState } from 'react';
import { PRINT_AGENT_URL } from '../lib/printConfig';

type Status = 'checking' | 'online' | 'offline' | 'error';

export default function PrinterStatusBadge({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const [status, setStatus] = useState<Status>('checking');

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      if (!navigator.onLine) { if (!cancelled) setStatus('offline'); return; }
      try {
        const res = await fetch(`${PRINT_AGENT_URL}/health`, { method: 'GET', signal: AbortSignal.timeout(3000) });
        if (!cancelled) setStatus(res.ok ? 'online' : 'error');
      } catch { if (!cancelled) setStatus('error'); }
    };
    check();
    const id = setInterval(check, 30000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const colorMap: Record<Status, string> = {
    checking: 'bg-amber-500',
    online: 'bg-emerald-500',
    offline: 'bg-amber-500',
    error: 'bg-red-500',
  };

  const labelMap: Record<Status, string> = {
    checking: 'Verifica...',
    online: 'Stampante OK',
    offline: 'In attesa rete...',
    error: 'Stampante non raggiungibile',
  };

  const dotSize = size === 'sm' ? 'w-2 h-2' : 'w-3 h-3';

  return (
    <div className="flex items-center gap-1.5 group relative" title={labelMap[status]}>
      <div className={`${dotSize} rounded-full ${colorMap[status]} ${status === 'online' ? '' : 'animate-pulse'} shadow-lg`} />
      <span className="hidden group-hover:inline absolute top-full left-1/2 -translate-x-1/2 mt-1.5 px-2 py-1 bg-charcoal border border-surface-light rounded-lg text-[8px] font-black text-white whitespace-nowrap uppercase tracking-wider z-50 shadow-xl pointer-events-none">
        {labelMap[status]}
      </span>
    </div>
  );
}
