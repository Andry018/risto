export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      ordini: {
        Row: {
          id: string;
          created_at: string;
          nome_cliente: string;
          orario_ritiro: string;
          totale: number;
          status: 'IN_ATTESA' | 'COMPLETATO';
          carrello: Json;
          sconto_tipo: 'percentuale' | 'fisso' | null;
          sconto_valore: number | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          nome_cliente: string;
          orario_ritiro: string;
          totale: number;
          status?: 'IN_ATTESA' | 'COMPLETATO';
          carrello: Json;
          sconto_tipo?: 'percentuale' | 'fisso' | null;
          sconto_valore?: number | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          nome_cliente?: string;
          orario_ritiro?: string;
          totale?: number;
          status?: 'IN_ATTESA' | 'COMPLETATO';
          carrello?: Json;
          sconto_tipo?: 'percentuale' | 'fisso' | null;
          sconto_valore?: number | null;
        };
      };
      prodotti: {
        Row: {
          id: string;
          nome: string;
          prezzo: number;
          categoria: string;
          sottocategoria: string | null;
          disponibile: boolean;
          ingredienti: string[];
          immagine: string | null;
          allergeni: string[];
          traduzioni: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          nome: string;
          prezzo: number;
          categoria: string;
          sottocategoria?: string | null;
          disponibile?: boolean;
          ingredienti?: string[];
          immagine?: string | null;
          allergeni?: string[];
          traduzioni?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          nome?: string;
          prezzo?: number;
          categoria?: string;
          sottocategoria?: string | null;
          disponibile?: boolean;
          ingredienti?: string[];
          immagine?: string | null;
          allergeni?: string[];
          traduzioni?: Json;
          created_at?: string;
        };
      };
      ingredienti: {
        Row: {
          id: string;
          nome: string;
          prezzo: number;
          prezzo_rimozione: number;
          disponibile: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          nome: string;
          prezzo?: number;
          prezzo_rimozione?: number;
          disponibile?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          nome?: string;
          prezzo?: number;
          prezzo_rimozione?: number;
          disponibile?: boolean;
          created_at?: string;
        };
      };
      tavoli: {
        Row: {
          id: string;
          nome: string;
          x: number;
          y: number;
          clienti: number;
          status: 'LIBERO' | 'OCCUPATO' | 'PRENOTATO';
          shape: 'SQUARE' | 'ROUND' | 'RECTANGLE';
          sala: string;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          nome: string;
          x?: number;
          y?: number;
          clienti?: number;
          status?: 'LIBERO' | 'OCCUPATO' | 'PRENOTATO';
          shape?: 'SQUARE' | 'ROUND' | 'RECTANGLE';
          sala?: string;
          note?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          nome?: string;
          x?: number;
          y?: number;
          clienti?: number;
          status?: 'LIBERO' | 'OCCUPATO' | 'PRENOTATO';
          shape?: 'SQUARE' | 'ROUND' | 'RECTANGLE';
          sala?: string;
          note?: string | null;
          created_at?: string;
        };
      };
      prenotazioni: {
        Row: {
          id: string;
          nome: string;
          data: string;
          ora: string;
          persone: number;
          tavolo_id: string | null;
          status: 'CONFERMATA' | 'ANNULLATA' | 'ARRIVATA';
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          nome: string;
          data: string;
          ora: string;
          persone?: number;
          tavolo_id?: string | null;
          status?: 'CONFERMATA' | 'ANNULLATA' | 'ARRIVATA';
          note?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          nome?: string;
          data?: string;
          ora?: string;
          persone?: number;
          tavolo_id?: string | null;
          status?: 'CONFERMATA' | 'ANNULLATA' | 'ARRIVATA';
          note?: string | null;
          created_at?: string;
        };
      };
      documenti_emessi: {
        Row: {
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
          order_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          doc_number: string;
          customer_name?: string;
          piva_cf?: string;
          customer_address?: string;
          company_name?: string;
          codice_univoco?: string;
          description: string;
          total: number;
          payment_method?: 'contanti' | 'carta';
          doc_date?: string;
          file_url?: string;
          mode: 'linked' | 'manual';
          order_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          doc_number?: string;
          customer_name?: string;
          piva_cf?: string;
          customer_address?: string;
          company_name?: string;
          codice_univoco?: string;
          description?: string;
          total?: number;
          payment_method?: 'contanti' | 'carta';
          doc_date?: string;
          file_url?: string;
          mode?: 'linked' | 'manual';
          order_id?: string | null;
          created_at?: string;
        };
      };
    };
    Functions: {
      next_doc_number: {
        Args: Record<string, never>;
        Returns: string;
      };
    };
    Enums: Record<string, never>;
  };
}
