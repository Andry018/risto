import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

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

export const supabase = createClient(supabaseUrl, supabaseKey);

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
