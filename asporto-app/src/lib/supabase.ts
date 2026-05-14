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

export type Portata = '1' | '2' | '3' | '4' | '5';

export const PORTATE: { value: Portata; label: string; color: string }[] = [
  { value: '1', label: '1ª Uscita', color: 'text-rose-400 border-rose-500/30 bg-rose-500/10' },
  { value: '2', label: '2ª Uscita', color: 'text-sky-400 border-sky-500/30 bg-sky-500/10' },
  { value: '3', label: '3ª Uscita', color: 'text-amber-400 border-amber-500/30 bg-amber-500/10' },
  { value: '4', label: '4ª Uscita', color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' },
  { value: '5', label: '5ª Uscita', color: 'text-fuchsia-400 border-fuchsia-500/30 bg-fuchsia-500/10' },
];

export type CustomizedItem = Product & {
  quantity: number;
  addedIngredients: { nome: string; prezzo: number }[];
  removedIngredients: string[];
  notes: string;
  uniqueId: string;
  portata?: Portata;
};

export interface Tavolo {
  id: string;
  nome: string;
  x: number;
  y: number;
  clienti: number;
  status: 'LIBERO' | 'OCCUPATO' | 'PRENOTATO';
  shape: 'SQUARE' | 'ROUND' | 'RECTANGLE';
  sala: string;
  created_at?: string;
}

export type Product = {
  id: string;
  nome: string;
  prezzo: number;
  categoria: string;
  sottocategoria?: string;
  disponibile: boolean;
  ingredienti: string[];
};

export type Ingredient = {
  id: string;
  nome: string;
  prezzo: number;
  prezzo_rimozione: number;
  disponibile: boolean;
  created_at?: string;
};

export type OrderCarrelloItem = {
  nome: string;
  quantity: number;
  prezzo_unitario?: number;
  categoria?: string;
  portata?: Portata;
  modifiche?: {
    aggiunte?: string[];
    rimozioni?: string[];
    note?: string;
  };
};

export type Order = {
  id: string;
  created_at: string;
  nome_cliente: string;
  orario_ritiro: string;
  totale: number;
  status: 'IN_ATTESA' | 'COMPLETATO';
  carrello: OrderCarrelloItem[];
};

export type Reservation = {
  id: string;
  nome: string;
  data: string;
  ora: string;
  persone: number;
  tavolo_id?: string;
  status: 'CONFERMATA' | 'ANNULLATA' | 'ARRIVATA';
  note?: string;
  created_at?: string;
};

export const IS_DEMO_MODE = localStorage.getItem('demo_mode') === 'true';

export const toggleDemoMode = (val: boolean) => {
  localStorage.setItem('demo_mode', val ? 'true' : 'false');
  window.location.reload();
};
