import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "http://127.0.0.1:54321";
const supabaseKey = "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";
const supabase = createClient(supabaseUrl, supabaseKey);

const mapping = {
  // PIZZE ROSSE
  "Focaccia rossa": ["Pomodoro", "Aglio", "Origano"],
  "Cilentana": ["Pomodoro", "Caprino"],
  "Margherita": ["Pomodoro", "Mozzarella"],
  "Napoletana": ["Pomodoro", "Aglio", "Origano", "Acciughe"],
  "Bufalina": ["Pomodoro", "Mozzarella di Bufala"],
  "Diavola": ["Pomodoro", "Mozzarella", "Salame Piccante"],
  "Regina": ["Pomodoro", "Mozzarella", "Prosciutto Cotto", "Funghi"],
  "Capricciosa": ["Pomodoro", "Mozzarella", "Prosciutto Cotto", "Funghi", "Carciofi"],
  "Quattro Stagioni": ["Pomodoro", "Mozzarella", "Prosciutto Cotto", "Funghi", "Carciofi", "Olive Nere"],
  "Bavarese": ["Pomodoro", "Mozzarella", "Wurstel", "Patatine"],
  "Mare e Monti": ["Pomodoro", "Mozzarella", "Tonno", "Salame Piccante", "Cipolla", "Zucchine"],
  "Vulcano": ["Pomodoro", "Mozzarella", "Prosciutto Crudo", "Bocconcino"],
  "Girasole": ["Pomodoro", "Mozzarella", "Prosciutto Crudo", "Rucola", "Scaglie di Parmigiano", "Pomodorini"],
  "Arianna": ["Pomodoro", "Mozzarella", "Bresaola", "Lattuga Iceberg", "Scaglie di Parmigiano"],
  "Piccantina": ["Pomodoro", "Mozzarella", "Prosciutto Cotto", "Salame Piccante", "Wurstel", "Tonno", "Salsiccia"],

  // PIZZE BIANCHE
  "Focaccia Bianca": ["Aglio", "Origano"],
  "Marinara": ["Aglio", "Origano", "Acciughe", "Olive Nere"],
  "Prosciutto e Mais": ["Mozzarella", "Prosciutto Cotto", "Mais"],
  "Broccoli e Salsiccia": ["Mozzarella", "Broccoli", "Salsiccia"],
  "Provola e Speck": ["Mozzarella", "Provola Affumicata", "Speck"],
  "Vegetariana": ["Mozzarella", "Peperoni", "Melanzane", "Zucchine", "Broccoli"],
  "Quattro Formaggi": ["Mozzarella", "Edam", "Parmigiano", "Emmenthal", "Gorgonzola"],
  "Sfiziosa": ["Mozzarella", "Pancetta", "Patate Lesse", "Cipolla"],
  "Gustosa": ["Mozzarella", "Patate Lesse", "Salsiccia", "Provola Affumicata"],
  "Boscaiola": ["Mozzarella", "Porcini", "Salsiccia", "Provola Affumicata"],
  "Norvegese": ["Mozzarella", "Salmone Affumicato", "Rucola", "Scaglie di Parmigiano"],
  "Tonno e Cipolla": ["Mozzarella", "Tonno", "Cipolla"],
  "Porchetta": ["Mozzarella", "Porchetta", "Auricchio Piccante", "Olive Verdi"],

  // PIZZE SPECIALI
  "Mimosa": ["Pomodorini", "Mozzarella", "Pancetta", "Provola Affumicata"],
  "Nocina": ["Noci", "Mozzarella", "Pancetta", "Gorgonzola", "Rucola"],
  "Parmigianosa": ["Pomodoro", "Mozzarella", "Melanzane", "Parmigiana", "Provola Affumicata"],
  "Paesana": ["Mozzarella", "Pancetta Piccante", "Funghi", "Pomodorini", "Patate al forno"],
  "Dalila": ["Nutella"]
};

async function runMapping() {
  console.log("Inizio mappatura completa ingredienti...");
  
  const { data: products, error } = await supabase.from('prodotti').select('id, nome');
  if (error) {
    console.error("Errore recupero prodotti:", error);
    return;
  }

  for (const product of products) {
    if (mapping[product.nome]) {
      console.log(`Mapping ${product.nome}...`);
      await supabase.from('prodotti').update({ ingredienti: mapping[product.nome] }).eq('id', product.id);
    }
  }

  console.log("Mapping completato con successo!");
}

runMapping();
