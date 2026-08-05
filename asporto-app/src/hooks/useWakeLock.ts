import { useEffect, useRef, useCallback } from 'react';
import { SETTINGS_KEYS, useBooleanSetting } from '../lib/appSettings';

const STORAGE_KEY = SETTINGS_KEYS.wakeLock;

export function getWakeLockEnabled(): boolean {
  return localStorage.getItem(STORAGE_KEY) === 'true';
}

export function setWakeLockEnabled(enabled: boolean) {
  localStorage.setItem(STORAGE_KEY, String(enabled));
}

export function useWakeLock() {
  const sentinelRef = useRef<WakeLockSentinel | null>(null);
  const [enabled] = useBooleanSetting(SETTINGS_KEYS.wakeLock, false);

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
    if (!enabled) {
      release();
      return;
    }

    const handleReacquire = () => {
      if (document.visibilityState === 'visible') {
        request();
      }
    };

    document.addEventListener('visibilitychange', handleReacquire);
    window.addEventListener('pageshow', handleReacquire);
    window.addEventListener('focus', handleReacquire);
    request();

    return () => {
      document.removeEventListener('visibilitychange', handleReacquire);
      window.removeEventListener('pageshow', handleReacquire);
      window.removeEventListener('focus', handleReacquire);
      release();
    };
  }, [enabled, request, release]);

  return { request, release, supported: typeof navigator !== 'undefined' && 'wakeLock' in navigator };
}
