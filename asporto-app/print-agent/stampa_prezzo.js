const ThermalPrinter = require('node-thermal-printer').printer;
const PrinterTypes = require('node-thermal-printer').types;

// Cattura tutti i numeri digitati e li mette in lista
const inputPrezzi = process.argv.slice(2);
if (inputPrezzi.length === 0) inputPrezzi.push("0.00");

// Aggiunge il simbolo € e tre spazi tra un prezzo e l'altro
const rigaPrezzi = inputPrezzi.map(p => `€ ${p}`).join('   ');

async function stampa() {
    let printer = new ThermalPrinter({
        type: PrinterTypes.EPSON,
        interface: 'tcp://192.168.1.200:9100',
        characterSet: 'PC858_EURO',           // Sblocca il simbolo dell'Euro!
        removeSpecialCharacters: false        // Impedisce di cancellarlo
    });

    printer.alignCenter();
    printer.setTextQuadArea(); // Carattere gigante
    printer.bold(true);
    
    // Stampa tutta la riga unita in un colpo solo
    printer.println(rigaPrezzi);
    
    printer.bold(false);
    printer.setTextNormal();
    printer.cut();

    try {
        await printer.execute();
        console.log(`\nFatto! Stampato: ${rigaPrezzi}`);
    } catch (error) {
        console.error("\n[ERRORE] Impossibile stampare.", error);
    }
}

stampa();