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

export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export const IS_DEMO_MODE = localStorage.getItem('demo_mode') === 'true';

export const toggleDemoMode = (val: boolean) => {
  localStorage.setItem('demo_mode', val ? 'true' : 'false');
  window.location.reload();
};
