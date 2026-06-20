require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const ThermalPrinter = require('node-thermal-printer').printer;
const PrinterTypes = require('node-thermal-printer').types;
const http = require('node:http');
const { URL } = require('node:url');

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
const defaultPrinterInterface = process.env.PRINTER_INTERFACE || `tcp://${process.env.PRINTER_HOST || '127.0.0.1'}:${process.env.PRINTER_PORT || '9100'}`;
const serverPort = Number(process.env.PRINT_AGENT_PORT || 8787);

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const CATEGORIES_NO_KITCHEN = ['Bevande', 'Caffè e Liquori', 'Servizio'];
const VARIANT_NOISE = ['Pizze Bianca', 'Pizze Rosse', 'Pizze', 'Impasto'];
const PIZZA_VARIANTS = new Set(['Bianca', 'Rossa', 'Rosè', 'Rose']);
const PRIORITY_MODS = ['', ''];

function createPrinter(printerInterface) {
  return new ThermalPrinter({
    type: PrinterTypes.EPSON,
    interface: printerInterface,
    characterSet: 'PC858_EURO',
    removeSpecialCharacters: false,
    lineCharacter: '=',
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
    await printer.execute();
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
  const extras = (item.addedIngredients || []).filter(a => !VARIANT_NOISE.includes(a.nome) && !PRIORITY_MODS.includes(a.nome) && !PIZZA_VARIANTS.has(a.nome));
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
  printer.setTextDoubleWidth();
  printer.println(`${item.quantity}x ${truncate(getDisplayName(item), maxName)}`);
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

  printer.alignLeft();
  for (const [portata, items] of grouped) {
    printer.bold(true);
    printer.setTextDoubleWidth();
    printer.println(`[${portataLabel(portata).toUpperCase()}]`);
    printer.setTextNormal();
    printer.bold(false);
    for (const item of items) {
      printItemWithHeader(printer, item, 26);
    }
    printer.drawLine();
  }

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

async function stampaEtichettaHaccp(dati) {
  const printer = createPrinter(resolvePrinterInterface(dati));

  try {
    printer.println('');
    printer.println('');

    // Titolo — nome prodotto in grassetto, carattere grande
    printer.bold(true);
    printer.setTextDoubleWidth();
    printer.println((dati.nome_prodotto || '').toUpperCase());
    printer.setTextNormal();
    printer.bold(false);

    printer.println('');

    // Allergeni
    if (dati.allergeni) {
      printer.bold(true);
      printer.println('Allergeni Presenti');
      printer.bold(false);
      printer.println(dati.allergeni);
      printer.println('');
    }

    // Ingredienti
    if (dati.ingredienti) {
      printer.bold(true);
      printer.print('INGREDIENTI: ');
      printer.bold(false);
      printer.println(dati.ingredienti);
      printer.println('');
    }

    // Conservazione
    if (dati.conservazione) {
      printer.bold(true);
      printer.println('Conservazione');
      printer.bold(false);
      printer.println(dati.conservazione);
      printer.println('');
    }

    // Riga divisoria leggera
    printer.drawLine();
    printer.println('');

    // Piè di pagina — due colonne con date e lotto
    if (dati.data_preparazione) {
      printer.leftRight('Preparato il', dati.lotto ? `Lotto: ${dati.lotto}` : '');
      printer.leftRight(dati.data_preparazione, '');
    } else if (dati.lotto) {
      printer.leftRight('', `Lotto: ${dati.lotto}`);
    }
    printer.leftRight('Scadenza', '');
    printer.bold(true);
    printer.leftRight(dati.data_scadenza || '', '');
    printer.bold(false);
    printer.println('');

    // Barcode dal lotto (centrato)
    if (dati.lotto) {
      printer.alignCenter();
      printer.qrcode(dati.lotto);
      printer.alignLeft();
      printer.println('');
    }

    printer.println('');
    printer.cut();
    await executePrinter(printer, `Etichetta HACCP ${dati.nome_prodotto}`);
  } catch (error) {
    console.error(`[HACCP LABEL ERROR] ${dati.nome_prodotto}`, error);
    throw error;
  }
}

async function printDbOrder(order) {
  const printer = createPrinter(resolvePrinterInterface(order));
  const items = normalizeDbOrderItems(order);
  const orderTime = formatDateTime(order?.created_at || new Date());

  topPadding(printer);
  printer.alignCenter();
  printer.setTextDoubleWidth();
  printer.bold(true);
  printer.leftRight(truncate(order?.nome_cliente || 'TAVOLO', 18), orderTime);
  printer.bold(false);
  printer.setTextNormal();
  printer.drawLine();

  for (const item of items) {
    const itemTotal = Number(item.prezzo_unitario || 0) * Number(item.quantity || 1);
    printer.leftRight(`${item.quantity}x ${truncate(item.nome, 20)}`, `€${itemTotal.toFixed(2)}`);
    printModLines(printer, item, 40);
  }

  printer.drawLine();
  printer.alignRight();
  printer.println(`TOTALE: €${Number(order?.totale || 0).toFixed(2)}`);
  printer.cut();
  await executePrinter(printer, `Ordine database ${order?.nome_cliente || 'sconosciuto'}`);
}

console.log('=== Print Agent Avviato ===');
console.log('In ascolto di nuovi ordini da Supabase...');
console.log(`HTTP print bridge on :${serverPort}`);

const channel = supabase
  .channel('public:ordini')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ordini' }, (payload) => {
    console.log('\n===========================================');
    console.log('Nuovo Ordine Ricevuto!');
    console.log(`Cliente: ${payload.new.nome_cliente}`);
    console.log(`Ritiro: ${payload.new.orario_ritiro}`);
    console.log('Generazione stampa in corso...');
    void printDbOrder(payload.new).catch((error) => {
      console.error('[DB PRINT ERROR]', error);
    });
  })
  .subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      console.log('Connessione a Supabase Realtime stabilita correttamente.');
    }
  });

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
        } else if (job.kind === 'receipt') {
          await printReceiptJob(job);
        } else if (job.kind === 'haccp_label') {
          await stampaEtichettaHaccp(job);
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
  supabase.removeChannel(channel);
  server.close();
  process.exit();
});
