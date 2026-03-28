import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "http://127.0.0.1:54321";
const supabaseKey = "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";
const supabase = createClient(supabaseUrl, supabaseKey);

const mappings = {
  "Margherita": ["Pomodoro", "Mozzarella"],
  "Diavola": ["Pomodoro", "Mozzarella", "Salame Piccante"],
  "Parmigianosa": ["Pomodoro", "Mozzarella", "Parmigiana"],
  "Vegetariana": ["Mozzarella", "Peperoni", "Melanzane", "Zucchine", "Broccoli"],
  "Broccoli e Salsiccia": ["Mozzarella", "Broccoli", "Salsiccia"],
  "Napoletana": ["Pomodoro", "Sardine", "Capperi"], // Simplified
  "Bufalina": ["Pomodoro", "Mozzarella di Bufala"],
  "Capricciosa": ["Pomodoro", "Mozzarella", "Prosciutto Cotto", "Funghi", "Carciofi"],
  "Quattro Stagioni": ["Pomodoro", "Mozzarella", "Prosciutto Cotto", "Funghi", "Carciofi", "Olive"],
  "Boscaiola": ["Mozzarella", "Funghi", "Salsiccia"],
};

async function mapIngredients() {
  console.log("Inizio mappatura ingredienti...");
  
  const { data: products, error } = await supabase.from('prodotti').select('id, nome');
  
  if (error) {
    console.error(error);
    return;
  }

  for (const product of products) {
    const ingredienti = mappings[product.nome] || [];
    if (ingredienti.length > 0) {
      console.log(`Mappatura ${product.nome} -> ${ingredienti.join(', ')}`);
      await supabase.from('prodotti').update({ ingredienti }).eq('id', product.id);
    }
  }

  console.log("Mappatura completata!");
}

mapIngredients();
