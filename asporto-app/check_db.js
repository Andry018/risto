import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error("Errore: VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY non definite nel .env");
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDatabase() {
  console.log("Verifica database...");
  
  const { count, error: ingError } = await supabase.from('ingredienti').select('*', { count: 'exact', head: true });
  if (ingError) {
    console.log("Tabella 'ingredienti' NON TROVATA o errore:", ingError.message);
  } else {
    console.log(`Tabella 'ingredienti' TROVATA. Numero record: ${count ?? 0}`);
  }

  const { data: prod, error: prodError } = await supabase.from('prodotti').select('ingredienti').limit(1);
  if (prodError) {
    console.log("Colonna 'ingredienti' in 'prodotti' NON TROVATA o errore:", prodError.message);
  } else {
    console.log("Colonna 'ingredienti' in 'prodotti' TROVATA.");
  }
}

checkDatabase();
