import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error("Errore: VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY non definite nel .env");
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey);

const products = [
  // FRITTI
  { nome: "Patatine", prezzo: 3.5, categoria: "Fritti", disponibile: true },
  { nome: "Crocchè*", prezzo: 3.5, categoria: "Fritti", disponibile: true },
  { nome: "Frittatina di pasta*", prezzo: 2.5, categoria: "Fritti", disponibile: true },
  { nome: "Fritti misti*", prezzo: 3.5, categoria: "Fritti", disponibile: true },

  // PIZZE SPECIALI
  { nome: "Mimosa", prezzo: 8.0, categoria: "Pizze Speciali", disponibile: true },
  { nome: "Nocina", prezzo: 8.0, categoria: "Pizze Speciali", disponibile: true },
  { nome: "Parmigianosa", prezzo: 7.5, categoria: "Pizze Speciali", disponibile: true },
  { nome: "Paesana", prezzo: 8.0, categoria: "Pizze Speciali", disponibile: true },
  { nome: "Dalila", prezzo: 6.0, categoria: "Pizze Speciali", disponibile: true },

  // EXTRA
  { nome: "Base Pizza Senza Glutine", prezzo: 5.0, categoria: "EXTRA", disponibile: true },
  { nome: "Mozzarella Senza Lattosio", prezzo: 1.5, categoria: "EXTRA", disponibile: true },

  // PIZZE ROSSE
  { nome: "Focaccia rossa", prezzo: 3.0, categoria: "Pizze Rosse", disponibile: true },
  { nome: "Cilentana", prezzo: 4.0, categoria: "Pizze Rosse", disponibile: true },
  { nome: "Margherita", prezzo: 4.0, categoria: "Pizze Rosse", disponibile: true },
  { nome: "Napoletana", prezzo: 4.0, categoria: "Pizze Rosse", disponibile: true },
  { nome: "Bufalina", prezzo: 6.5, categoria: "Pizze Rosse", disponibile: true },
  { nome: "Diavola", prezzo: 5.5, categoria: "Pizze Rosse", disponibile: true },
  { nome: "Regina", prezzo: 5.5, categoria: "Pizze Rosse", disponibile: true },
  { nome: "Capricciosa", prezzo: 6.5, categoria: "Pizze Rosse", disponibile: true },
  { nome: "Quattro Stagioni", prezzo: 7.0, categoria: "Pizze Rosse", disponibile: true },
  { nome: "Bavarese", prezzo: 6.0, categoria: "Pizze Rosse", disponibile: true },
  { nome: "Mare e Monti", prezzo: 7.0, categoria: "Pizze Rosse", disponibile: true },
  { nome: "Vulcano", prezzo: 6.0, categoria: "Pizze Rosse", disponibile: true },
  { nome: "Girasole", prezzo: 7.5, categoria: "Pizze Rosse", disponibile: true },
  { nome: "Arianna", prezzo: 7.0, categoria: "Pizze Rosse", disponibile: true },
  { nome: "Piccantina", prezzo: 7.5, categoria: "Pizze Rosse", disponibile: true },

  // PIZZE BIANCHE
  { nome: "Focaccia Bianca", prezzo: 3.0, categoria: "Pizze Bianche", disponibile: true },
  { nome: "Marinara", prezzo: 4.5, categoria: "Pizze Bianche", disponibile: true },
  { nome: "Prosciutto e Mais", prezzo: 5.5, categoria: "Pizze Bianche", disponibile: true },
  { nome: "Broccoli e Salsiccia", prezzo: 6.0, categoria: "Pizze Bianche", disponibile: true },
  { nome: "Provola e Speck", prezzo: 6.0, categoria: "Pizze Bianche", disponibile: true },
  { nome: "Vegetariana", prezzo: 6.5, categoria: "Pizze Bianche", disponibile: true },
  { nome: "Tartufata", prezzo: 7.0, categoria: "Pizze Bianche", disponibile: true },
  { nome: "Quattro Formaggi", prezzo: 6.0, categoria: "Pizze Bianche", disponibile: true },
  { nome: "Sfiziosa", prezzo: 6.0, categoria: "Pizze Bianche", disponibile: true },
  { nome: "Gustosa", prezzo: 7.0, categoria: "Pizze Bianche", disponibile: true },
  { nome: "Boscaiola", prezzo: 7.5, categoria: "Pizze Bianche", disponibile: true },
  { nome: "Norvegese", prezzo: 7.5, categoria: "Pizze Bianche", disponibile: true },
  { nome: "Tonno e Cipolla", prezzo: 6.0, categoria: "Pizze Bianche", disponibile: true },
  { nome: "Porchetta", prezzo: 6.5, categoria: "Pizze Bianche", disponibile: true },
];

async function insertProducts() {
  console.log("Inizializzazione inserimento prodotti...");
  
  const { data, error } = await supabase
    .from('prodotti')
    .insert(products);

  if (error) {
    console.error("Errore durante l'inserimento:", error);
  } else {
    console.log("Prodotti inseriti con successo!");
  }
}

insertProducts();
