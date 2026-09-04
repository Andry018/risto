// Pezza di emergenza per definire la funzione mancante globalmente
global.getDisplayName = function(item) {
    if (!item) return "Articolo";
    return item.nome || item.name || item.title || item.display_name || "Articolo";
};

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const ThermalPrinter = require('node-thermal-printer').printer;
const PrinterTypes = require('node-thermal-printer').types;
const http = require('node:http');
const net  = require('node:net');
const { URL } = require('node:url');

/**
 * Invia un buffer ESC/POS alla stampante via TCP raw.
 * Bypassa il layer di rete di node-thermal-printer che setta un inactivity
 * timeout troppo aggressivo che scatta durante la scrittura di buffer grandi.
 */
function sendBufferToTcp(host, port, buffer, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let done = false;

    const finish = (err) => {
      if (done) return;
      done = true;
      socket.destroy();
      err ? reject(err) : resolve();
    };

    // Timeout globale sull'intera operazione
    const timer = setTimeout(() => finish(new Error('Socket timeout')), timeoutMs);

    socket.connect(port, host, () => {
      clearTimeout(timer);
      socket.write(buffer, null, () => finish(null));
    });

    socket.on('error', finish);
    socket.on('timeout', () => finish(new Error('Socket connect timeout')));
    socket.setTimeout(5000); // solo per la fase di connessione
  });
}

function getDisplayName(item) {
    if (!item) return "Articolo";
    return item.nome || item.name || item.title || item.display_name || "Articolo";
}

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
const defaultPrinterInterface = process.env.PRINTER_INTERFACE || `tcp://${process.env.PRINTER_HOST || '127.0.0.1'}:${process.env.PRINTER_PORT || '9100'}`;
const serverPort = Number(process.env.PRINT_AGENT_PORT || 8787);

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const CATEGORIES_NO_KITCHEN = ['Bevande', 'Caffè e Liquori', 'Servizio', 'Dolce', 'Dolci'];
const VARIANT_NOISE = ['Pizze Bianca', 'Pizze Rosse', 'Pizze', 'Impasto'];
const PIZZA_VARIANTS = new Set(['Bianca', 'Rossa', 'Rosè', 'Rose']);
const PRIORITY_MODS = ['', ''];

/** Ritorna il nome breve della variante pizza (es. 'BIANCA', 'ROSSA', 'ROSÈ')
 *  oppure null se l'ingrediente non è una variante. Matching case-insensitive
 *  e gestisce nomi composti come 'Pizze Bianca', 'Pizze Rosse', 'Rosé', ecc. */
function getPizzaVariantLabel(nome) {
  const n = (nome || '').trim().toLowerCase();
  if (n.includes('bianca')) return 'BIANCA';
  if (n.includes('rosse') || n === 'rossa') return 'ROSSA';
  if (n.startsWith('ros')) return (nome || '').trim().toUpperCase().replace(/^PIZZE\s+/i, '');
  return null;
}

function isPizzaVariant(nome) {
  return getPizzaVariantLabel(nome) !== null;
}

function createPrinter(printerInterface) {
  return new ThermalPrinter({
    type: PrinterTypes.EPSON,
    interface: printerInterface,
    characterSet: 'PC858_EURO',
    removeSpecialCharacters: false,
    lineCharacter: '=',
    options: { timeout: 10000 },
  });
}

function resolvePrinterInterface(job) {
  const ip = (job && job.printerIp || '').trim();
  const port = Number(job && job.printerPort || process.env.PRINTER_PORT || 9100);
  if (ip) return `tcp://${ip}:${Number.isFinite(port) && port > 0 ? port : 9100}`;
  return defaultPrinterInterface;
}

function formatDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function cleanText(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function normalizeVariantNotes(text) {
  return cleanText(text)
    .replace(/\b(Bianca|Rossa|Ros[eè])\b/gi, '')
    .replace(/,\s*,/g, ',')
    .replace(/^,\s*/, '')
    .replace(/,\s*$/, '')
    .trim();
}

function truncate(text, max = 34) {
  const value = cleanText(text);
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

function groupByPortata(items) {
  const grouped = new Map();
  for (const item of items) {
    const key = item.portata || '1';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(item);
  }
  return [...grouped.entries()].sort(([a], [b]) => parseInt(a, 10) - parseInt(b, 10));
}

function portataLabel(key) {
  const map = {
    '1': '1ª Uscita',
    '2': '2ª Uscita',
    '3': '3ª Uscita',
    '4': '4ª Uscita',
    '5': '5ª Uscita',
  };
  return map[key] || key;
}

async function executePrinter(printer, context) {
  try {
    // Usa send TCP diretto per evitare il bug di inactivity timeout
    // nel network layer di node-thermal-printer su buffer ESC/POS grandi.
    const buffer = printer.getBuffer();
    const iface  = resolvePrinterInterface(null);
    const match  = /tcp:\/\/([^:]+):(\d+)/.exec(iface);
    if (match) {
      const host = match[1];
      const port = Number(match[2]);
      await sendBufferToTcp(host, port, buffer);
    } else {
      await printer.execute();
    }
    console.log(`[PRINT SUCCESS] ${context}`);
  } catch (error) {
    console.error(`[PRINT ERROR] ${context}`, error);
    throw error;
  }
}

function topPadding(printer) {
  printer.println('');
  printer.println('');
}

function setReadableText(printer) {
  if (typeof printer.setTextNormal === 'function') printer.setTextNormal();
}

function printModLines(printer, item, maxNote = 44) {
  const extras = (item.addedIngredients || []).filter(a => !VARIANT_NOISE.includes(a.nome) && !PRIORITY_MODS.includes(a.nome) && !isPizzaVariant(a.nome));
  const removed = item.removedIngredients || [];
  const note = normalizeVariantNotes(item.notes);

  if (extras.length > 0) {
    printer.setTextDoubleWidth();
    printer.println(`+ ${truncate(extras.map(a => a.nome).join(', '), maxNote)}`);
    printer.setTextNormal();
  }
  if (removed.length > 0) {
    printer.setTextDoubleWidth();
    printer.println(`- ${truncate(removed.join(', '), maxNote)}`);
    printer.setTextNormal();
  }
  if (note) {
    printer.setTextDoubleWidth();
    printer.println(`NOTE: ${truncate(note, maxNote + 2)}`);
    printer.setTextNormal();
  }
}

function printItemWithHeader(printer, item, maxName) {
  const variantIng = (item.addedIngredients || []).find(a => isPizzaVariant(a.nome));
  const variantLabel = variantIng ? (getPizzaVariantLabel(variantIng.nome) || variantIng.nome.toUpperCase()) : null;
  // Testo GIGANTE per i nomi dei piatti (Altezza e Larghezza doppie)
  printer.setTextQuadArea();
  // Variante sulla stessa riga: "1x Girasole ROSSA"
  const suffix = variantLabel ? ` ${variantLabel}` : '';
  const nameMax = variantLabel ? Math.max(maxName - variantLabel.length - 1, 6) : maxName;
  printer.println(`${item.quantity}x ${truncate(getDisplayName(item), nameMax)}${suffix}`);
  printer.setTextNormal();
  printModLines(printer, item);
}

async function printKitchenJob(job) {
  const printer = createPrinter(resolvePrinterInterface(job));
  setReadableText(printer);
  const foodItems = (job.items || []).filter(i => !CATEGORIES_NO_KITCHEN.includes(i.categoria));
  const grouped = groupByPortata(foodItems);
  const orderTime = cleanText(job.orderTime) || formatDateTime(new Date());

  topPadding(printer);
  printer.alignCenter();
  printer.setTextDoubleWidth();
  printer.bold(true);
  printer.leftRight(truncate(job.tableName || 'TAVOLO', 18), orderTime);
  printer.bold(false);
  printer.setTextNormal();
  printer.drawLine();

  if (job.allergieNote && job.allergieNote.trim()) {
    printer.alignCenter();
    printer.bold(true);
    printer.setTextDoubleWidth();
    printer.println(`!!! ALLERGIE: ${truncate(job.allergieNote.trim(), 28)} !!!`);
    printer.setTextNormal();
    printer.bold(false);
    printer.drawLine();
  }

  printer.alignLeft();
  for (const [portata, items] of grouped) {
    printer.bold(true);
    // Testo GIGANTE anche per i titoli delle portate
    printer.setTextQuadArea();
    printer.println(`[${portataLabel(portata).toUpperCase()}]`);
    printer.setTextNormal();
    printer.bold(false);
    for (const item of items) {
      printItemWithHeader(printer, item, 26);
    }
    printer.drawLine();
  }

  printer.alignCenter();
  printer.setTextDoubleWidth();
  printer.bold(true);
  printer.println(truncate(job.tableName || 'TAVOLO', 18));
  printer.bold(false);
  printer.setTextNormal();

  printer.cut();
  await executePrinter(printer, `Comanda cucina ${job.tableName}`);
}

async function printReceiptJob(job) {
  const printer = createPrinter(resolvePrinterInterface(job));
  setReadableText(printer);
  const now = formatDateTime(new Date());

  topPadding(printer);
  printer.alignCenter();
  printer.setTextDoubleWidth();
  printer.bold(true);
  printer.leftRight(truncate(job.tableName || 'TAVOLO', 18), now);
  printer.bold(false);
  printer.setTextNormal();
  printer.println('CONTO');
  printer.drawLine();

  for (const item of job.items || []) {
    const itemTotal = (item.prezzo || 0) * item.quantity + (item.addedIngredients || []).reduce((s, a) => s + a.prezzo, 0);
    printer.leftRight(`${item.quantity}x ${truncate(item.nome, 20)}`, `€${itemTotal.toFixed(2)}`);
    printModLines(printer, item, 40);
  }

  printer.drawLine();
  printer.alignRight();
  printer.println(`TOTALE: €${Number(job.total || 0).toFixed(2)}`);
  printer.cut();
  await executePrinter(printer, `Ricevuta ${job.tableName}`);
}

async function printPreContoJob(job) {
  const printer = createPrinter(resolvePrinterInterface(job));
  setReadableText(printer);
  const now = formatDateTime(new Date());

  topPadding(printer);
  printer.alignCenter();
  printer.setTextDoubleWidth();
  printer.bold(true);
  printer.leftRight(truncate(job.tableName || 'TAVOLO', 18), now);
  printer.bold(false);
  printer.setTextNormal();

  printer.bold(true);
  printer.setTextDoubleWidth();
  printer.println('IL CONTO');
  printer.setTextNormal();
  printer.bold(false);
  printer.println('- NON FISCALE -');
  printer.drawLine();

  printer.alignLeft();
  for (const item of job.items || []) {
    const basePrice = Number(item.prezzo || 0);
    const variantIng = (item.addedIngredients || []).find(a => isPizzaVariant(a.nome));
    const extras = (item.addedIngredients || []).filter(a => !isPizzaVariant(a.nome) && !VARIANT_NOISE.includes(a.nome));
    const removed = item.removedIngredients || [];
    const note = normalizeVariantNotes(item.notes || '');

    // Riga principale: Nx NomePiatto [VARIANTE]    €basePrice×qty
    const variantLabel = variantIng ? (getPizzaVariantLabel(variantIng.nome) || variantIng.nome.toUpperCase()) : null;
    const variantSuffix = variantLabel ? ` [${variantLabel}]` : '';
    printer.leftRight(
      `${item.quantity}x ${truncate(getDisplayName(item) + variantSuffix, 24)}`,
      `\u20AC${(basePrice * item.quantity).toFixed(2)}`
    );
    // Aggiunte con prezzo individuale
    for (const a of extras) {
      const extraPrice = Number(a.prezzo || 0);
      if (extraPrice > 0) {
        printer.leftRight(`  + ${truncate(a.nome, 28)}`, `\u20AC${extraPrice.toFixed(2)}`);
      } else {
        printer.println(`  + ${truncate(a.nome, 38)}`);
      }
    }
    if (removed.length > 0) printer.println(`  - ${truncate(removed.join(', '), 38)}`);
    if (note) printer.println(`  ${truncate(note, 40)}`);
  }

  printer.drawLine();
  printer.alignRight();
  printer.setTextDoubleWidth();
  printer.bold(true);
  printer.println(`TOTALE: \u20AC${Number(job.total || 0).toFixed(2)}`);
  printer.bold(false);
  printer.setTextNormal();

  if (job.covers && job.covers > 0) {
    printer.alignCenter();
    printer.println(`${job.covers} coperti`);
  }
  printer.alignCenter();
  printer.println('');
  printer.println('Grazie per la visita!');
  printer.println('');
  printer.cut();
  await executePrinter(printer, `Pre-conto ${job.tableName}`);
}

async function printSalaJob(job) {
  const printer = createPrinter(resolvePrinterInterface(job));
  setReadableText(printer);
  const salaItems = (job.items || []).filter(i => CATEGORIES_NO_KITCHEN.includes(i.categoria));
  const grouped = groupByPortata(salaItems);

  topPadding(printer);
  printer.alignCenter();
  printer.setTextDoubleWidth();
  printer.bold(true);
  printer.println(truncate(job.tableName || 'TAVOLO', 20));
  printer.bold(false);
  printer.setTextNormal();
  printer.drawLine();

  printer.alignLeft();
  for (const [portata, items] of grouped) {
    printer.bold(true);
    printer.setTextQuadArea();
    printer.println(`[${portataLabel(portata).toUpperCase()}]`);
    printer.setTextNormal();
    printer.bold(false);
    for (const item of items) {
      printItemWithHeader(printer, item, 30);
    }
    printer.drawLine();
  }

  printer.cut();
  await executePrinter(printer, `Comanda sala ${job.tableName}`);
}

function normalizeDbOrderItems(order) {
  const items = Array.isArray(order?.carrello) ? order.carrello : [];
  return items.map((item) => ({
    nome: item.nome || 'Prodotto',
    quantity: Number(item.quantity || 1),
    prezzo_unitario: Number(item.prezzo_unitario || 0),
    categoria: item.categoria || '',
    portata: item.portata || '1',
    addedIngredients: Array.isArray(item.modifiche?.aggiunte)
      ? item.modifiche.aggiunte.map((nome) => ({ nome, prezzo: 0 }))
      : [],
    removedIngredients: Array.isArray(item.modifiche?.rimozioni) ? item.modifiche.rimozioni : [],
    notes: item.modifiche?.note || '',
  }));
}

async function printQuickLabelJob(job) {
  const printer = createPrinter(resolvePrinterInterface(job));

  const now = new Date();
  const dateStr = now.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

  printer.println('');
  printer.println('');
  printer.alignCenter();
  printer.setTextQuadArea();
  printer.bold(true);
  printer.println((job.nome || 'PRODOTTO').toUpperCase());
  printer.bold(false);
  printer.setTextNormal();
  printer.drawLine();
  printer.setTextDoubleWidth();
  printer.println(`${dateStr}  ${timeStr}`);
  printer.setTextNormal();
  printer.println('');
  printer.cut();
  await executePrinter(printer, `Etichetta rapida ${job.nome}`);
}

async function stampaEtichettaHaccp(dati) {
  const printer = createPrinter(resolvePrinterInterface(dati));

  try {
    printer.println('');
    printer.println('');

    // QR code in alto a destra (stampato prima, poi nome sotto a sinistra)
    if (dati.lotto) {
      const qrUrl = `https://gestionale.90-minuti.it/etichetta/${dati.lotto}`;
      printer.alignRight();
      printer.printQR(qrUrl, { cellSize: 3, correction: 'M', model: 2 });
      printer.alignLeft();
    }

    // Nome prodotto — grassetto, grande
    printer.bold(true);
    printer.setTextDoubleWidth();
    printer.println((dati.nome_prodotto || '').toUpperCase());
    printer.setTextNormal();
    printer.bold(false);
    printer.println('');

    // Allergeni inline
    if (dati.allergeni) {
      printer.bold(true);
      printer.print('Allergeni: ');
      printer.bold(false);
      printer.println(dati.allergeni);
    }

    // Ingredienti inline
    if (dati.ingredienti) {
      printer.bold(true);
      printer.print('INGREDIENTI: ');
      printer.bold(false);
      printer.println(dati.ingredienti);
    }

    // Conservazione inline
    if (dati.conservazione) {
      printer.bold(true);
      printer.print('Conservazione: ');
      printer.bold(false);
      printer.println(dati.conservazione);
    }

    printer.println('');
    printer.drawLine();

    // Footer: Preparato il + Lotto su stessa riga, Scadenza sotto (solo se presente)
    const prepLabel = dati.data_preparazione ? `Preparato il ${dati.data_preparazione}` : '';
    const lottoLabel = dati.lotto ? `Lotto: ${dati.lotto}` : '';
    printer.leftRight(prepLabel, lottoLabel);
    if (dati.data_scadenza) {
      printer.bold(true);
      printer.println(`Scadenza ${dati.data_scadenza}`);
      printer.bold(false);
    }

    printer.println('');
    printer.cut();
    await executePrinter(printer, `Etichetta HACCP ${dati.nome_prodotto}`);
  } catch (error) {
    console.error(`[HACCP LABEL ERROR] ${dati.nome_prodotto}`, error);
    throw error;
  }
}

console.log('=== Print Agent Avviato ===');
console.log(`HTTP print bridge on :${serverPort}`);
console.log('Stampa automatica ordini DB disattivata (solo richieste esplicite /print)');

const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  if (req.method === 'GET' && reqUrl.pathname === '/health') {
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ ok: true }));
  }

  if (req.method === 'POST' && reqUrl.pathname === '/print') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString('utf8');
      if (body.length > 1_000_000) req.destroy();
    });
    req.on('end', async () => {
      try {
        const job = JSON.parse(body || '{}');
        if (job.kind === 'kitchen') {
          await printKitchenJob(job);
        } else if (job.kind === 'sala') {
          await printSalaJob(job);
        } else if (job.kind === 'pre_conto') {
          await printPreContoJob(job);
        } else if (job.kind === 'receipt') {
          await printReceiptJob(job);
        } else if (job.kind === 'haccp_label') {
          await stampaEtichettaHaccp(job);
        } else if (job.kind === 'quick_label') {
          await printQuickLabelJob(job);
        } else {
          throw new Error('Unknown print job');
        }
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true }));
      } catch (error) {
        console.error('[PRINT BRIDGE ERROR]', error);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: false, error: String(error.message || error) }));
      }
    });
    return;
  }

  res.statusCode = 404;
  res.end('Not found');
});

server.listen(serverPort, '0.0.0.0', () => {
  console.log(`Print bridge ascolta su 0.0.0.0:${serverPort}`);
});

process.on('SIGINT', () => {
  console.log('Shutting down...');
  server.close();
  process.exit();
});