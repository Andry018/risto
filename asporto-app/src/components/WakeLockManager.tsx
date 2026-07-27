import { useWakeLock } from '../hooks/useWakeLock';

export function WakeLockManager() {
  useWakeLock();
  return null;
}
