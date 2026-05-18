export type Portata = '1' | '2' | '3' | '4' | '5';

export const PORTATE: { value: Portata; label: string; color: string }[] = [
  { value: '1', label: '1ª Uscita', color: 'text-rose-400 border-rose-500/30 bg-rose-500/10' },
  { value: '2', label: '2ª Uscita', color: 'text-sky-400 border-sky-500/30 bg-sky-500/10' },
  { value: '3', label: '3ª Uscita', color: 'text-amber-400 border-amber-500/30 bg-amber-500/10' },
  { value: '4', label: '4ª Uscita', color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' },
  { value: '5', label: '5ª Uscita', color: 'text-fuchsia-400 border-fuchsia-500/30 bg-fuchsia-500/10' },
];

export type Product = {
  id: string;
  nome: string;
  prezzo: number;
  categoria: string;
  sottocategoria?: string;
  disponibile: boolean;
  ingredienti: string[];
  immagine?: string;
  allergeni?: string[];
};

export type Ingredient = {
  id: string;
  nome: string;
  prezzo: number;
  prezzo_rimozione: number;
  disponibile: boolean;
  created_at?: string;
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
  note?: string;
  created_at?: string;
}

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
  sconto_tipo?: 'percentuale' | 'fisso';
  sconto_valore?: number;
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

export type DocumentoEmesso = {
  id: string;
  doc_number: string;
  customer_name: string;
  piva_cf: string;
  customer_address: string;
  company_name: string;
  codice_univoco: string;
  description: string;
  total: number;
  payment_method: 'contanti' | 'carta';
  doc_date: string;
  file_url: string;
  mode: 'linked' | 'manual';
  order_id?: string;
  created_at: string;
};

export type CustomizedItem = Product & {
  quantity: number;
  addedIngredients: { nome: string; prezzo: number }[];
  removedIngredients: string[];
  notes: string;
  uniqueId: string;
  portata?: Portata;
};

export const ALLERGEN_META: { label: string; icon: string; color: string; bg: string }[] = [
  { label: 'Glutine', icon: '🌾', color: '#92400e', bg: '#fef3c7' },
  { label: 'Lattosio', icon: '🥛', color: '#1e40af', bg: '#dbeafe' },
  { label: 'Uova', icon: '🥚', color: '#9a3412', bg: '#ffedd5' },
  { label: 'Pesce', icon: '🐟', color: '#075985', bg: '#e0f2fe' },
  { label: 'Crostacei', icon: '🦐', color: '#991b1b', bg: '#fee2e2' },
  { label: 'Arachidi', icon: '🥜', color: '#78350f', bg: '#fef3c7' },
  { label: 'Soia', icon: '🫘', color: '#166534', bg: '#dcfce7' },
  { label: 'Frutta a Guscio', icon: '🌰', color: '#44403c', bg: '#f5f5f4' },
  { label: 'Sedano', icon: '🥬', color: '#15803d', bg: '#f0fdf4' },
  { label: 'Senape', icon: '🌿', color: '#854d0e', bg: '#fef9c3' },
  { label: 'Sesamo', icon: '🫓', color: '#713f12', bg: '#fefce8' },
  { label: 'Solfiti', icon: '🧪', color: '#6b21a8', bg: '#f3e8ff' },
  { label: 'Lupini', icon: '🫘', color: '#3f6212', bg: '#ecfccb' },
  { label: 'Molluschi', icon: '🐚', color: '#115e59', bg: '#ccfbf1' },
  { label: 'Vegano', icon: '🌱', color: '#166534', bg: '#dcfce7' },
  { label: 'Vegetariano', icon: '🥗', color: '#15803d', bg: '#f0fdf4' },
];
