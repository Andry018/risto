const SESSION_KEY = 'risto_staff_session_ok';

/**
 * PIN operatore: imposta `VITE_STAFF_PIN` nella build.
 * In sviluppo, se non impostato, il default è `1234` (solo locale).
 * In produzione senza variabile: autenticazione staff non configurata (vedi StaffPinGuard).
 */
export function getConfiguredStaffPin(): string | null {
  const raw = import.meta.env.VITE_STAFF_PIN;
  if (typeof raw === 'string' && raw.trim() !== '') return raw.trim();
  if (import.meta.env.DEV) return '1234';
  return null;
}

export function isStaffSessionValid(): boolean {
  if (typeof sessionStorage === 'undefined') return false;
  return sessionStorage.getItem(SESSION_KEY) === '1';
}

export function setStaffSessionValid(): void {
  sessionStorage.setItem(SESSION_KEY, '1');
}

export function clearStaffSession(): void {
  sessionStorage.removeItem(SESSION_KEY);
}

/** Chiude la sessione staff e ricarica (mostra di nuovo il PIN). */
export function staffLogout(): void {
  clearStaffSession();
  window.location.href = '/';
}

export function verifyStaffPin(input: string): boolean {
  const expected = getConfiguredStaffPin();
  if (!expected) return false;
  return input.trim() === expected;
}
