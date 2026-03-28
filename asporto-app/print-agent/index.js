require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const ThermalPrinter = require('node-thermal-printer').printer;
const PrinterTypes = require('node-thermal-printer').types;

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_ANON_KEY in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Function to print a receipt
async function printReceipt(order) {
  let printer = new ThermalPrinter({
    type: PrinterTypes.EPSON,
    interface: 'printer:dummy', // Dummy interface for simulation/testing without an actual printer connected
    characterSet: 'PC858_EURO',
    removeSpecialCharacters: false,
    lineCharacter: "=",
  });

  printer.alignCenter();
  printer.println("RISTORANTE DA MARIO");
  printer.println("Ricevuta Asporto");
  printer.drawLine();
  
  printer.alignLeft();
  printer.println(`Ordine: #${order.id.split('-')[0]}`);
  printer.println(`Cliente: ${order.nome_cliente}`);
  printer.println(`Orario Ritiro: ${order.orario_ritiro}`);
  printer.drawLine();

  // Print items
  for (const item of order.carrello) {
    printer.leftRight(
      `${item.quantity}x ${item.nome.substring(0, 20)}`,
      `EUR ${(item.prezzo * item.quantity).toFixed(2)}`
    );
  }
  
  printer.drawLine();
  printer.alignRight();
  printer.println(`TOTALE: EUR ${order.totale.toFixed(2)}`);
  printer.drawLine();
  printer.alignCenter();
  printer.println("Grazie per aver scelto noi!");
  printer.cut();

  try {
    const execute = await printer.execute();
    console.log(`[PRINT SUCCESS] Ricevuta stampata per l'ordine di ${order.nome_cliente} (Ritiro: ${order.orario_ritiro})`);
    console.log("\n--- ANTEPRIMA RICEVUTA (testo puro) ---");
    console.log(printer.getText());
    console.log("---------------------------------------\n");
  } catch (error) {
    console.error(`[PRINT ERROR] Errore di stampa:`, error);
  }
}

console.log("=== Print Agent Avviato ===");
console.log("In ascolto di nuovi ordini da Supabase...");

const channel = supabase
  .channel('public:ordini')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ordini' }, (payload) => {
    console.log(`\n===========================================`);
    console.log(`Nuovo Ordine Ricevuto!`);
    console.log(`Cliente: ${payload.new.nome_cliente}`);
    console.log(`Ritiro: ${payload.new.orario_ritiro}`);
    console.log(`Generazione stampa in corso...`);
    printReceipt(payload.new);
  })
  .subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      console.log('Connessione a Supabase Realtime stabilita correttamente.');
    }
  });

// Keep process running
process.on('SIGINT', () => {
  console.log("Shutting down...");
  supabase.removeChannel(channel);
  process.exit();
});
