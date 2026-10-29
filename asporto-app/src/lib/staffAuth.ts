import { supabase } from './supabase';

const PIN_STORAGE_KEY = 'risto_manager_pin';
const USERS_STORAGE_KEY = 'risto_staff_users';
const SESSION_STORAGE_KEY = 'risto_staff_session_user_id';
/** Verificatori dei PIN già usati con successo su QUESTO dispositivo: permettono il login offline. */
const PIN_CACHE_KEY = 'risto_staff_pin_cache';
const ADMIN_PIN_CACHE_ID = '__admin__';

/**
 * PIN di prima configurazione: vale solo finché nel DB non esiste nessun amministratore.
 * Poi il "PIN responsabile" è il PIN di un qualsiasi amministratore (verificato sul server).
 */
export function getManagerPin(): string {
  return localStorage.getItem(PIN_STORAGE_KEY) || '2580';
}

export function setManagerPin(newPin: string): void {
  localStorage.setItem(PIN_STORAGE_KEY, newPin);
}

export type StaffRole = 'admin' | 'waiter' | 'kitchen';

/** I PIN non arrivano mai al browser: stanno nel DB solo come hash (vedi migration staff_pin_hash). */
export interface StaffUser {
  id: string;
  name: string;
  role: StaffRole;
}

export interface PinCheck {
  ok: boolean;
  error?: string;
}

const LEGACY_USER: StaffUser = { id: 'legacy', name: 'Operatore', role: 'admin' };

export function newStaffId(): string {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });
}

function readUsers(): StaffUser[] {
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    const list = raw ? (JSON.parse(raw) as StaffUser[]) : [];
    // Le versioni precedenti salvavano anche il PIN in chiaro: non lo teniamo più
    return list.map(({ id, name, role }) => ({ id, name, role }));
  } catch {
    return [];
  }
}

function writeUsers(users: StaffUser[]): void {
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users.map(({ id, name, role }) => ({ id, name, role }))));
}

/** PIN "legacy" (impostazioni > Sicurezza) usato come fallback finché non esistono operatori configurati. */
export function getDefaultStaffPin(): string {
  return getManagerPin();
}

export function getStaffUsers(): StaffUser[] {
  return readUsers();
}

// ── Cache locale per il login offline ────────────────────────────────────────

async function pinVerifier(id: string, pin: string): Promise<string | null> {
  if (typeof crypto === 'undefined' || !crypto.subtle) return null;   // pagina non HTTPS: niente cache
  const data = new TextEncoder().encode(`risto-staff:${id}:${pin.trim()}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function readPinCache(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(PIN_CACHE_KEY) || '{}') as Record<string, string>; } catch { return {}; }
}

async function rememberPin(id: string, pin: string): Promise<void> {
  const v = await pinVerifier(id, pin);
  if (!v) return;
  const cache = readPinCache();
  cache[id] = v;
  try { localStorage.setItem(PIN_CACHE_KEY, JSON.stringify(cache)); } catch { /* storage pieno/bloccato */ }
}

async function checkCachedPin(id: string, pin: string): Promise<boolean> {
  const expected = readPinCache()[id];
  return !!expected && expected === await pinVerifier(id, pin);
}

function isNetworkError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String((err as { message?: string })?.message ?? err);
  return /fetch|network|load failed|timeout/i.test(msg);
}

// ── Verifica PIN ────────────────────────────────────────────────────────────

/** Login operatore: verifica sul server; offline accetta solo PIN già usati su questo dispositivo. */
export async function verifyStaffPin(userId: string, pin: string): Promise<PinCheck> {
  if (!supabase) return { ok: await checkCachedPin(userId, pin) };
  const { data, error } = await supabase.rpc('staff_verify_pin', { p_user_id: userId, p_pin: pin.trim() });
  if (error) {
    if (isNetworkError(error)) {
      return (await checkCachedPin(userId, pin)) ? { ok: true } : { ok: false, error: 'Server non raggiungibile' };
    }
    return { ok: false, error: error.message };
  }
  if (data === true) void rememberPin(userId, pin);
  return { ok: data === true };
}

/** PIN responsabile: PIN di un qualsiasi amministratore. Senza amministratori nel DB vale il PIN locale di prima configurazione. */
export async function verifyManagerPin(pin: string): Promise<PinCheck> {
  if (supabase) {
    const { data, error } = await supabase.rpc('staff_check_admin_pin', { p_pin: pin.trim() });
    if (!error) {
      if (data === true) void rememberPin(ADMIN_PIN_CACHE_ID, pin);
      if (data !== null) return { ok: data === true };
    } else if (!isNetworkError(error)) {
      return { ok: false, error: error.message };
    } else if (await checkCachedPin(ADMIN_PIN_CACHE_ID, pin)) {
      return { ok: true };
    } else if (readUsers().some(u => u.role === 'admin')) {
      return { ok: false, error: 'Server non raggiungibile' };
    }
  }
  return { ok: pin.trim() === getManagerPin() };
}

// ── Gestione operatori (solo amministratori, sul server) ──────────────────────

/** Crea o modifica un operatore. `pin` null = lascia invariato. Restituisce un errore leggibile o null. */
export async function saveStaffUser(adminPin: string, user: StaffUser, pin: string | null): Promise<string | null> {
  if (!supabase) return 'Database non disponibile';
  const { data, error } = await supabase.rpc('staff_save', {
    p_admin_pin: adminPin.trim(), p_id: user.id, p_name: user.name.trim(), p_role: user.role, p_pin: pin?.trim() || null,
  });
  if (error) return isNetworkError(error) ? 'Server non raggiungibile' : error.message;
  if (data) return data as string;
  await syncStaffUsersFromDb();
  return null;
}

export async function deleteStaffUser(adminPin: string, id: string): Promise<string | null> {
  if (!supabase) return 'Database non disponibile';
  const { data, error } = await supabase.rpc('staff_delete', { p_admin_pin: adminPin.trim(), p_id: id });
  if (error) return isNetworkError(error) ? 'Server non raggiungibile' : error.message;
  if (data) return data as string;
  if (readSessionUserId() === id) clearStaffSession();
  await syncStaffUsersFromDb();
  return null;
}

// ── Sessione sul dispositivo ────────────────────────────────────────────────

function readSessionUserId(): string | null {
  return localStorage.getItem(SESSION_STORAGE_KEY);
}

/** Operatore collegato su questo dispositivo (persistito in localStorage), o null se nessuno ha ancora inserito il PIN qui. */
export function getCurrentUser(): StaffUser | null {
  const id = readSessionUserId();
  if (!id) return null;
  const users = readUsers();
  if (id === LEGACY_USER.id) return users.length === 0 ? LEGACY_USER : null;
  return users.find(u => u.id === id) || null;
}

export function isStaffSessionValid(): boolean {
  return getCurrentUser() !== null;
}

/** Salva la sessione sul dispositivo corrente: da qui in poi non serve reinserire il PIN. */
export function setStaffSessionValid(user: StaffUser): void {
  localStorage.setItem(SESSION_STORAGE_KEY, user.id);
}

export function legacyStaffUser(): StaffUser {
  return LEGACY_USER;
}

export function clearStaffSession(): void {
  localStorage.removeItem(SESSION_STORAGE_KEY);
}

export function staffLogout(): void {
  clearStaffSession();
  window.location.href = '/';
}

/** L'amministratore può sempre tutto; gli altri ruoli solo se compresi in `requiredRoles`. */
export function hasPermission(userRole: StaffRole, requiredRoles: StaffRole | StaffRole[]): boolean {
  if (userRole === 'admin') return true;
  const required = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
  return required.includes(userRole);
}

export function getDefaultRouteForRole(_role: StaffRole): string {
  return '/';
}

export function canAccessRoute(_path: string): boolean {
  return true;
}

// ── Sync con Supabase (best-effort, fallback su localStorage) ────────────────

/** Carica gli operatori dal DB (solo id/nome/ruolo) e li salva in localStorage. Da chiamare all'avvio. */
export async function syncStaffUsersFromDb(): Promise<void> {
  if (!supabase) return;
  try {
    const { data, error } = await supabase.from('staff_users').select('id, name, role').order('name');
    if (!error && data) writeUsers(data as StaffUser[]);
  } catch { /* offline: usa localStorage */ }
}

// ── PIN responsabile (azioni protette) ─────────────────────────────────────────

let _pinPromptHandler: ((label: string) => Promise<string | null>) | null = null;

/** Registrato da PinProvider: mostra il dialog e risolve con il PIN già verificato, o null se annullato. */
export function setPinPromptHandler(handler: (label: string) => Promise<string | null>): void {
  _pinPromptHandler = handler;
}

/** Chiede il PIN responsabile e lo restituisce (verificato), per le azioni che devono passarlo al server. */
export async function requestManagerPin(actionLabel = 'questa azione'): Promise<string | null> {
  if (_pinPromptHandler) return _pinPromptHandler(actionLabel);
  const pin = window.prompt(`PIN responsabile richiesto per ${actionLabel}`);
  if (pin === null) return null;
  const check = await verifyManagerPin(pin);
  if (check.ok) return pin;
  window.alert(check.error || 'PIN non valido');
  return null;
}

export async function requireManagerPin(actionLabel = 'questa azione'): Promise<boolean> {
  return (await requestManagerPin(actionLabel)) !== null;
}
