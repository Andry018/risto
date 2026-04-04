import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "http://127.0.0.1:54321";
const supabaseKey = "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";
const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanupDuplicates() {
  console.log("Inizio pulizia duplicati...");
  
  // 1. Fetch all products
  const { data: allProducts, error: fetchError } = await supabase
    .from('prodotti')
    .select('id, nome, categoria');

  if (fetchError) {
    console.error("Errore fetch:", fetchError);
    return;
  }

  const seen = new Set();
  const toDelete = [];

  allProducts.forEach(p => {
    const key = `${p.nome}-${p.categoria}`.toLowerCase();
    if (seen.has(key)) {
      toDelete.push(p.id);
    } else {
      seen.add(key);
    }
  });

  if (toDelete.length === 0) {
    console.log("Nessun duplicato trovato.");
    return;
  }

  console.log(`Trovati ${toDelete.length} duplicati. Eliminazione in corso...`);

  // 2. Delete duplicates by ID
  const { error: deleteError } = await supabase
    .from('prodotti')
    .delete()
    .in('id', toDelete);

  if (deleteError) {
    console.error("Errore eliminazione:", deleteError);
  } else {
    console.log("Pulizia completata con successo!");
  }
}

cleanupDuplicates();
