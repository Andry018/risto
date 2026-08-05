const PIN_STORAGE_KEY = 'risto_manager_pin';
const USERS_STORAGE_KEY = 'risto_staff_users';
const SESSION_STORAGE_KEY = 'risto_staff_session_user_id';

export function getManagerPin(): string {
  return localStorage.getItem(PIN_STORAGE_KEY) || '2580';
}

export function setManagerPin(newPin: string): void {
  localStorage.setItem(PIN_STORAGE_KEY, newPin);
}

export type StaffRole = 'admin' | 'waiter' | 'kitchen';

export interface StaffUser {
  id: string;
  name: string;
  pin: string;
  role: StaffRole;
}

function generateId(): string {
  return typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `staff_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function readUsers(): StaffUser[] {
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StaffUser[]) : [];
  } catch {
    return [];
  }
}

function writeUsers(users: StaffUser[]): void {
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
}

/** PIN "legacy" (impostazioni > Sicurezza) usato come fallback finché non esistono operatori configurati. */
export function getDefaultStaffPin(): string {
  return getManagerPin();
}

export function getStaffUsers(): StaffUser[] {
  return readUsers();
}

export function addStaffUser(name: string, pin: string, role: StaffRole): StaffUser {
  const user: StaffUser = { id: generateId(), name: name.trim(), pin: pin.trim(), role };
  const users = readUsers();
  users.push(user);
  writeUsers(users);
  return user;
}

export function removeStaffUser(id: string): void {
  writeUsers(readUsers().filter(u => u.id !== id));
  if (readSessionUserId() === id) clearStaffSession();
}

export function updateStaffUser(id: string, updates: Partial<StaffUser>): void {
  writeUsers(readUsers().map(u => (u.id === id ? { ...u, ...updates } : u)));
}

export function verifyStaffPin(userId: string, pin: string): boolean {
  const user = readUsers().find(u => u.id === userId);
  return !!user && pin.trim() === user.pin;
}

function readSessionUserId(): string | null {
  return localStorage.getItem(SESSION_STORAGE_KEY);
}

/** Operatore collegato su questo dispositivo (persistito in localStorage), o null se nessuno ha ancora inserito il PIN qui. */
export function getCurrentUser(): StaffUser | null {
  const id = readSessionUserId();
  if (!id) return null;
  return readUsers().find(u => u.id === id) || null;
}

export function isStaffSessionValid(): boolean {
  return getCurrentUser() !== null;
}

/** Salva la sessione sul dispositivo corrente: da qui in poi non serve reinserire il PIN. */
export function setStaffSessionValid(user: StaffUser): void {
  localStorage.setItem(SESSION_STORAGE_KEY, user.id);
}

export function clearStaffSession(): void {
  localStorage.removeItem(SESSION_STORAGE_KEY);
}

export function staffLogout(): void {
  clearStaffSession();
  window.location.href = '/';
}

/** Placeholder per una futura granularità di permessi: oggi tutti gli operatori loggati possono tutto. */
export function hasPermission(_requiredRole: StaffRole): boolean {
  return true;
}

export function getDefaultRouteForRole(_role: StaffRole): string {
  return '/';
}

export function canAccessRoute(_path: string): boolean {
  return true;
}

let _pinPromptHandler: ((label: string) => Promise<boolean>) | null = null;

export function setPinPromptHandler(handler: (label: string) => Promise<boolean>): void {
  _pinPromptHandler = handler;
}

export async function requireManagerPin(actionLabel = 'questa azione'): Promise<boolean> {
  if (_pinPromptHandler) {
    return _pinPromptHandler(actionLabel);
  }
  const pin = window.prompt(`PIN responsabile richiesto per ${actionLabel}`);
  if (pin === null) return false;
  if (pin.trim() === getManagerPin()) return true;
  window.alert('PIN non valido');
  return false;
}
