import { supabase } from './supabase';

export const dbUtils = {
  async cleanupDatabase() {
    console.log("Inizio pulizia ordini e reset tavoli...");
    
    // 1. Delete all orders
    const { error: ordersError } = await supabase.from('ordini').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (ordersError) throw ordersError;

    // 2. Reset all tables to LIBERO
    const { error: tablesError } = await supabase.from('tavoli').update({ 
      status: 'LIBERO', 
      clienti: 0 
    }).neq('id', '00000000-0000-0000-0000-000000000000');
    if (tablesError) throw tablesError;

    return { success: true };
  },

  async populateDemoData() {
    console.log("Ripristino dati demo...");
    
    // Ensure we have some default products if the DB is empty
    const demoProducts = [
      { nome: "Pizza Margherita", categoria: "Pizze Classic", prezzo: 6.5, disponibile: true },
      { nome: "Pizza Diavola", categoria: "Pizze Classic", prezzo: 7.5, disponibile: true },
      { nome: "Pizza Bufala", categoria: "Pizze Special", prezzo: 8.5, disponibile: true },
      { nome: "Hamburger Classic", categoria: "Burgers", prezzo: 10.0, disponibile: true },
      { nome: "Patatine Fritte", categoria: "Fritti", prezzo: 4.0, disponibile: true },
      { nome: "Birra Moretti 0.66", categoria: "Bevande", prezzo: 4.5, disponibile: true },
      { nome: "Coca Cola 0.33", categoria: "Bevande", prezzo: 2.5, disponibile: true }
    ];

    const { error: prodError } = await supabase.from('prodotti').upsert(demoProducts, { onConflict: 'nome' });
    if (prodError) throw prodError;

    return { success: true };
  }
};
