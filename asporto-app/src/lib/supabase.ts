import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * In sviluppo, se mancano le env, usiamo l'istanza locale standard di `supabase start`.
 * L'anon key è pubblica (è il default della CLI); non è login utente né password DB.
 */
const LOCAL_DEV_SUPABASE_URL = 'http://127.0.0.1:54321';
const LOCAL_DEV_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

const envUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? '';
const envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ?? '';

const supabaseUrl =
  envUrl || (import.meta.env.DEV ? LOCAL_DEV_SUPABASE_URL : '');
const supabaseKey =
  envKey || (import.meta.env.DEV ? LOCAL_DEV_ANON_KEY : '');

if (import.meta.env.DEV && (!envUrl || !envKey)) {
  console.info(
    '[Supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY non impostati: uso default locale (supabase start).'
  );
}

// ── Token operatore ─────────────────────────────────────────────────────────────
// Le tabelle sono leggibili/scrivibili solo dallo staff (RLS): dopo il PIN, staff_login() restituisce
// un JWT che viaggia al posto della anon key. Senza token valgono solo i permessi pubblici
// (menu, ordini online, etichette HACCP).

const STAFF_TOKEN_KEY = 'risto_staff_token';
export const STAFF_TOKEN_INVALID_EVENT = 'risto:staff-token-invalid';

interface StaffTokenClaims { sub: string; exp: number; iat: number; staff_role: string }

export function decodeStaffToken(token: string): StaffTokenClaims | null {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(payload)) as StaffTokenClaims;
  } catch {
    return null;
  }
}

/** Token valido (non scaduto) salvato su questo dispositivo, o null */
export function getStaffToken(): string | null {
  let token: string | null = null;
  try { token = localStorage.getItem(STAFF_TOKEN_KEY); } catch { return null; }
  if (!token) return null;
  const claims = decodeStaffToken(token);
  return claims && claims.exp * 1000 > Date.now() ? token : null;
}

export function setStaffToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(STAFF_TOKEN_KEY, token);
    else localStorage.removeItem(STAFF_TOKEN_KEY);
  } catch { /* storage bloccato: il token vale solo per questa pagina */ }
  // Realtime usa il token alla connessione dei canali: aggiornalo subito
  void supabase?.realtime.setAuth().catch(() => {});
}

// Token rifiutato dal server (scaduto, secret cambiato, operatore eliminato): via il token, torna la schermata PIN
const authAwareFetch: typeof fetch = async (input, init) => {
  const res = await fetch(input, init);
  if (res.status === 401 && getStaffToken()) {
    setStaffToken(null);
    window.dispatchEvent(new Event(STAFF_TOKEN_INVALID_EVENT));
  }
  return res;
};

export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey, {
        accessToken: async () => getStaffToken(),   // null → anon key
        global: { fetch: authAwareFetch },
      })
    : null;

export const IS_DEMO_MODE = localStorage.getItem('demo_mode') === 'true';

export const toggleDemoMode = (val: boolean) => {
  localStorage.setItem('demo_mode', val ? 'true' : 'false');
  window.location.reload();
};
