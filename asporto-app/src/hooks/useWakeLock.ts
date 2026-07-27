import { useEffect, useRef, useCallback } from 'react';

const STORAGE_KEY = 'risto_wake_lock';

export function getWakeLockEnabled(): boolean {
  return localStorage.getItem(STORAGE_KEY) === 'true';
}

export function setWakeLockEnabled(enabled: boolean) {
  localStorage.setItem(STORAGE_KEY, String(enabled));
}

export function useWakeLock() {
  const sentinelRef = useRef<WakeLockSentinel | null>(null);

  const release = useCallback(async () => {
    if (sentinelRef.current) {
      await sentinelRef.current.release();
      sentinelRef.current = null;
    }
  }, []);

  const request = useCallback(async () => {
    if (!('wakeLock' in navigator)) return;
    try {
      await release();
      sentinelRef.current = await navigator.wakeLock.request('screen');
      sentinelRef.current.addEventListener('release', () => {
        sentinelRef.current = null;
      });
    } catch {
      sentinelRef.current = null;
    }
  }, [release]);

  useEffect(() => {
    const enabled = getWakeLockEnabled();
    if (!enabled) return;

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        request();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    request();

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      release();
    };
  }, [request, release]);

  return { request, release };
}
