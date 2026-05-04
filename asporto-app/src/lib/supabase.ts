import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.warn('Supabase credentials missing. App will run in offline/demo mode if configured.');
  console.log('Environment Debug:', { 
    url: supabaseUrl ? 'Defined' : 'Empty', 
    key: supabaseKey ? 'Defined' : 'Empty',
    all_env: import.meta.env 
  });
}

export const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey) 
  : null as any;

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
  disponibile: boolean;
  ingredienti: string[]; // List of ingredient names or IDs
};

export type Ingredient = {
  id: string;
  nome: string;
  prezzo: number;
  disponibile: boolean;
  created_at?: string;
};

export type Order = {
  id: string;
  created_at: string;
  nome_cliente: string;
  orario_ritiro: string;
  totale: number;
  status: 'IN_ATTESA' | 'COMPLETATO';
  carrello: any;
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

// Demo Mode support
export const IS_DEMO_MODE = localStorage.getItem('demo_mode') === 'true';

export const toggleDemoMode = (val: boolean) => {
  localStorage.setItem('demo_mode', val ? 'true' : 'false');
  window.location.reload(); // Refresh to apply throughout
};
