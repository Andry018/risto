import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

export default function ExitGuard({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const backCountRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const toastRef = useRef<HTMLDivElement | null>(null);

  const rootPaths = ['/', '/waiter', '/map', '/takeaway', '/kitchen', '/pos', '/reports'];

  useEffect(() => {
    if (!rootPaths.includes(location.pathname)) {
      backCountRef.current = 0;
      return;
    }

    const onPopState = () => {
      if (backCountRef.current === 0) {
        window.history.pushState(null, '', window.location.href);
        backCountRef.current = 1;
        clearTimeout(timerRef.current);

        const toast = document.createElement('div');
        toast.className = 'fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] bg-charcoal border border-surface-light text-white px-6 py-3 rounded-2xl text-sm font-bold shadow-2xl animate-in fade-in slide-in-from-bottom-4';
        toast.textContent = 'Premi di nuovo INDIETRO per uscire';
        document.body.appendChild(toast);
        toastRef.current = toast;

        setTimeout(() => { toast.remove(); if (toastRef.current === toast) toastRef.current = null; }, 2000);

        timerRef.current = setTimeout(() => {
          backCountRef.current = 0;
        }, 2000);
      } else {
        clearTimeout(timerRef.current);
        backCountRef.current = 0;
        if (toastRef.current) { toastRef.current.remove(); toastRef.current = null; }
      }
    };

    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
      clearTimeout(timerRef.current);
      if (toastRef.current) { toastRef.current.remove(); toastRef.current = null; }
    };
  }, [location.pathname]);

  return <>{children}</>;
}
