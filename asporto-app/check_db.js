import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "http://127.0.0.1:54321";
const supabaseKey = "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDatabase() {
  console.log("Verifica database...");
  
  const { data: ing, error: ingError } = await supabase.from('ingredienti').select('count', { count: 'exact', head: true });
  if (ingError) {
    console.log("Tabella 'ingredienti' NON TROVATA o errore:", ingError.message);
  } else {
    console.log(`Tabella 'ingredienti' TROVATA. Numero record: ${ing[0]?.count || 0}`);
  }

  const { data: prod, error: prodError } = await supabase.from('prodotti').select('ingredienti').limit(1);
  if (prodError) {
    console.log("Colonna 'ingredienti' in 'prodotti' NON TROVATA o errore:", prodError.message);
  } else {
    console.log("Colonna 'ingredienti' in 'prodotti' TROVATA.");
  }
}

checkDatabase();
