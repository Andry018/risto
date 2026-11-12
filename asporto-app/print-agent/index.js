require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const ThermalPrinter = require('node-thermal-printer').printer;
const PrinterTypes = require('node-thermal-printer').types;
const http = require('node:http');
const net  = require('node:net');
const { URL } = require('node:url');
const path = require('node:path');
const { createPendingStore } = require('./pendingJobs');

/**
 * Invia un buffer ESC/POS alla stampante via TCP raw.
 * Bypassa il layer di rete di node-thermal-printer che setta un inactivity
 * timeout troppo aggressivo che scatta durante la scrittura di buffer grandi.
 */
function sendBufferToTcp(host, port, buffer, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let done = false;
    let connected = false;

    const fail = (err) => {
      if (done) return;
      done = true;
      socket.destroy();
      // Segna se l'errore è avvenuto prima di inviare dati: solo in quel caso si può riprovare
      // senza rischiare una doppia stampa.
      if (err && typeof err === 'object' && err.beforeConnect === undefined) err.beforeConnect = !connected;
      reject(err);
    };

    // Timeout globale sull'intera operazione
    const timer = setTimeout(() => fail(new Error('Socket timeout')), timeoutMs);

    const writeJob = () => {
      socket.write(buffer, null, (writeErr) => {
        if (writeErr) return fail(writeErr);
        // Chiusura graceful: FIN viene inviato solo dopo che tutti i byte
        // sono stati ricevuti dalla stampante (evita troncamenti su buffer grandi).
        socket.end();
        if (!done) { done = true; resolve(); }
      });
    };

    socket.connect(port, host, () => {
      connected = true;
      clearTimeout(timer);
      // Disabilita timeout di inattività ora che la connessione è stabilita:
      // buffer grandi (cucina con testo quad) possono richiedere più tempo.
      socket.setTimeout(0);

      // Stampante che non ha mai risposto alla domanda di stato: per un po' non gliela si rifà,
      // così non si perde tempo a ogni stampa.
      const hostKey = `${host}:${port}`;
      if (!PRINTER_STATUS_CHECK || (silentPrinters.get(hostKey) || 0) > Date.now()) return writeJob();

      // Prima di stampare chiede alla stampante se è pronta (ESC/POS "real-time status").
      // Senza questo controllo la stampante accetta i byte anche senza carta o col coperchio
      // aperto: l'app diceva "stampato" e il foglio non usciva. Se la stampante non risponde
      // entro poco (modello che non supporta il comando) si stampa comunque come prima.
      const replies = [];
      let waiting = true;
      const proceed = () => {
        if (!waiting || done) return;
        waiting = false;
        clearTimeout(statusTimer);
        socket.removeListener('data', onData);
        if (replies.length === 0) silentPrinters.set(hostKey, Date.now() + SILENT_PRINTER_SKIP_MS);
        else silentPrinters.delete(hostKey);
        const problem = printerProblemFromStatus(replies);
        if (problem) {
          const err = new Error(problem);
          err.beforeConnect = false; // inutile riprovare da soli: serve una persona
          err.printerNotReady = true;
          return fail(err);
        }
        writeJob();
      };
      const onData = (chunk) => {
        for (const b of chunk) replies.push(b);
        if (replies.length >= 2) proceed();
      };
      const statusTimer = setTimeout(proceed, PRINTER_STATUS_TIMEOUT_MS);
      socket.on('data', onData);
      // DLE EOT 2 = causa offline (coperchio, errore) · DLE EOT 4 = sensore carta
      socket.write(Buffer.from([0x10, 0x04, 0x02, 0x10, 0x04, 0x04]));
    });

    socket.on('error', fail);
    socket.on('timeout', () => fail(new Error('Socket connect timeout')));
    socket.setTimeout(5000); // solo per la fase di connect
  });
}

/** Controllo stato prima della stampa: PRINTER_STATUS_CHECK=0 nel .env lo disattiva. */
const PRINTER_STATUS_CHECK = !/^(0|false|no|off)$/i.test(String(process.env.PRINTER_STATUS_CHECK || '1').trim());
const PRINTER_STATUS_TIMEOUT_MS = Number(process.env.PRINTER_STATUS_TIMEOUT_MS) || 700;
const SILENT_PRINTER_SKIP_MS = 10 * 60 * 1000;
const silentPrinters = new Map();

/**
 * Interpreta le risposte a DLE EOT 2 e DLE EOT 4 (nell'ordine in cui sono state chieste).
 * Ogni byte di stato ESC/POS ha bit fissi (0 e 7 a zero, 1 e 4 a uno): un byte che non li rispetta
 * non è uno stato valido e viene ignorato, così una stampante "strana" non blocca mai la stampa.
 * Ritorna il messaggio per l'operatore oppure null se è tutto a posto / non si sa.
 */
function printerProblemFromStatus(bytes) {
  const valid = (b) => typeof b === 'number' && (b & 0x93) === 0x12;
  // Servono tutte e due le risposte: con una sola non si sa a quale domanda appartiene
  // (i bit hanno significati diversi) e si rischierebbe un falso allarme.
  if (bytes.length < 2) return null;
  const [offline, paper] = bytes;
  if (valid(paper) && (paper & 0x60) === 0x60) return 'Carta finita: cambia il rotolo e ristampa.';
  if (valid(offline)) {
    if (offline & 0x20) return 'Carta finita: cambia il rotolo e ristampa.';
    if (offline & 0x04) return 'Coperchio della stampante aperto: chiudilo e ristampa.';
    if (offline & 0x40) return 'Stampante in errore (spia accesa): spegnila, riaccendila e ristampa.';
  }
  return null;
}

/**
 * Coda di stampa + nuovi tentativi.
 * - Le stampanti termiche di rete accettano di solito UNA connessione alla volta: due stampe insieme
 *   (es. comanda + pre-conto da due dispositivi) facevano fallire la seconda. Ora vanno in fila.
 * - Se la connessione non riesce (stampante che si sveglia dallo standby, rete Wi-Fi lenta, stampante
 *   ancora occupata) si riprova da soli. Si riprova SOLO se l'errore è avvenuto prima di inviare dati,
 *   così una stampa non può uscire due volte.
 */
const PRINT_RETRY_DELAYS_MS = [500, 1500, 3000];
let printQueue = Promise.resolve();

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function sendWithRetry(host, port, buffer, context) {
  for (let attempt = 0; ; attempt++) {
    try {
      await sendBufferToTcp(host, port, buffer);
      if (attempt > 0) console.log(`[PRINT RETRY OK] ${context} al tentativo ${attempt + 1}`);
      return;
    } catch (err) {
      const delay = PRINT_RETRY_DELAYS_MS[attempt];
      if (!err || !err.beforeConnect || delay === undefined) throw err;
      console.warn(`[PRINT RETRY] ${context}: ${err.code || err.message}, nuovo tentativo tra ${delay} ms`);
      await sleep(delay);
    }
  }
}

function enqueuePrint(task) {
  const run = printQueue.then(task, task);
  printQueue = run.catch(() => {}); // un errore non blocca le stampe successive
  return run;
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
const PRIORITY_MODS = ['Senza Glutine', 'Senza Lattosio'];

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

/** Spezza il testo su più righe senza tagliare nulla, andando a capo
 *  sugli spazi. Usato per ingredienti/note lunghi (es. Panini). */
function wrapText(text, max = 34) {
  const value = cleanText(text);
  if (!value) return [];
  const words = value.split(' ');
  const lines = [];
  let current = '';
  for (const word of words) {
    if (!current) {
      current = word;
    } else if (`${current} ${word}`.length <= max) {
      current += ` ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** Stampa un testo su più righe: prefisso solo sulla prima, indent sulle
 *  successive, così gli elenchi lunghi restano allineati e completi. */
function printWrapped(printer, text, max, prefix = '', indent = '') {
  for (const [i, line] of wrapText(text, max).entries()) {
    printer.println(`${i === 0 ? prefix : indent}${line}`);
  }
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

async function executePrinter(printer, context, printerSource = null) {
  try {
    // Usa send TCP diretto per evitare il bug di inactivity timeout
    // nel network layer di node-thermal-printer su buffer ESC/POS grandi.
    const buffer = printer.getBuffer();
    const iface  = resolvePrinterInterface(printerSource);
    const match  = /tcp:\/\/([^:]+):(\d+)/.exec(iface);
    if (match) {
      const host = match[1];
      const port = Number(match[2]);
      await enqueuePrint(() => sendWithRetry(host, port, buffer, context));
    } else {
      await enqueuePrint(() => printer.execute());
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
  // ESC/POS GS ( E: imposta densità stampa al massimo (8/8)
  printer.append(Buffer.from([0x1D, 0x28, 0x45, 0x02, 0x00, 0x02, 0x08]));
}

function printModLines(printer, item, maxNote = 44) {
  const allMods = item.addedIngredients || [];
  const priorityMods = allMods.filter(a => PRIORITY_MODS.includes(a.nome));
  const extras = allMods.filter(a => !VARIANT_NOISE.includes(a.nome) && !PRIORITY_MODS.includes(a.nome) && !isPizzaVariant(a.nome));
  const removed = item.removedIngredients || [];
  const note = normalizeVariantNotes(item.notes);

  if (priorityMods.length > 0) {
    printer.bold(true);
    printer.setTextDoubleWidth();
    printWrapped(printer, `!! ${priorityMods.map(a => a.nome).join(' / ')} !!`, maxNote, '', '   ');
    printer.setTextNormal();
    printer.bold(false);
  }
  if (extras.length > 0) {
    printer.setTextDoubleWidth();
    printWrapped(printer, `+ ${extras.map(a => a.nome).join(', ')}`, maxNote, '', '  ');
    printer.setTextNormal();
  }
  if (removed.length > 0) {
    printer.setTextDoubleWidth();
    printWrapped(printer, `- ${removed.join(', ')}`, maxNote, '', '  ');
    printer.setTextNormal();
  }
  if (note) {
    printer.setTextDoubleWidth();
    printWrapped(printer, note, maxNote + 2, 'NOTE: ', '      ');
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
  // allItems (asporto): tutto su un foglio, bevande e dolci compresi; resta fuori solo il coperto.
  const foodItems = (job.items || []).filter(i => job.allItems
    ? i.categoria !== 'Servizio'
    : !CATEGORIES_NO_KITCHEN.includes(i.categoria));
  if (foodItems.length === 0) throw new Error('Nessun piatto da stampare su questa comanda.');
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
  await executePrinter(printer, `Comanda cucina ${job.tableName}`, job);
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
    const extras = (item.addedIngredients || []).reduce((s, a) => s + Number(a.prezzo || 0), 0);
    const computed = ((Number(item.prezzo) || 0) + extras) * (Number(item.quantity) || 1);
    const itemTotal = Number.isFinite(item.lineTotal) ? Number(item.lineTotal) : computed;
    printer.leftRight(`${item.quantity}x ${truncate(item.nome, 20)}`, `€${itemTotal.toFixed(2)}`);
    printModLines(printer, item, 40);
  }

  printer.drawLine();
  printer.alignRight();
  const discount = Number(job.discount || 0);
  if (discount > 0) {
    const subtotal = Number.isFinite(job.subtotal) ? Number(job.subtotal) : Number(job.total || 0) + discount;
    printer.println(`Subtotale: €${subtotal.toFixed(2)}`);
    const label = job.discountLabel ? ` (${job.discountLabel})` : '';
    printer.println(`Sconto${label}: -€${discount.toFixed(2)}`);
  }
  printer.println(`TOTALE: €${Number(job.total || 0).toFixed(2)}`);
  printer.cut();
  await executePrinter(printer, `Ricevuta ${job.tableName}`, job);
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
    // Aggiunte con prezzo individuale (moltiplicato per quantità)
    for (const a of extras) {
      const extraPrice = Number(a.prezzo || 0);
      if (extraPrice > 0) {
        printer.leftRight(`  + ${truncate(a.nome, 28)}`, `\u20AC${(extraPrice * item.quantity).toFixed(2)}`);
      } else {
        printer.println(`  + ${truncate(a.nome, 38)}`);
      }
    }
    if (removed.length > 0) printWrapped(printer, `- ${removed.join(', ')}`, 38, '  ');
    const removalDiscount = Number(item.removalDiscount || 0);
    if (removalDiscount > 0) {
      printer.leftRight(`  Sconto rimozioni`, `-\u20AC${(removalDiscount * item.quantity).toFixed(2)}`);
    }
    if (note) printWrapped(printer, note, 40, '  ');
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
  await executePrinter(printer, `Pre-conto ${job.tableName}`, job);
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
  await executePrinter(printer, `Comanda sala ${job.tableName}`, job);
}

async function printQuickLabelJob(job) {
  const printer = createPrinter(resolvePrinterInterface(job));
  printer.append(Buffer.from([0x1D, 0x28, 0x45, 0x02, 0x00, 0x02, 0x08]));

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
  await executePrinter(printer, `Etichetta rapida ${job.nome}`, job);
}

async function stampaEtichettaHaccp(dati) {
  const printer = createPrinter(resolvePrinterInterface(dati));
  printer.append(Buffer.from([0x1D, 0x28, 0x45, 0x02, 0x00, 0x02, 0x08]));

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
    await executePrinter(printer, `Etichetta HACCP ${dati.nome_prodotto}`, dati);
  } catch (error) {
    console.error(`[HACCP LABEL ERROR] ${dati.nome_prodotto}`, error);
    throw error;
  }
}

console.log('=== Print Agent Avviato ===');
console.log(`HTTP print bridge on :${serverPort}`);
console.log('Stampa automatica ordini DB disattivata (solo richieste esplicite /print)');

/**
 * Piatti per il menu Kindle, letti come fa la pagina pubblica /menu (chiave anon, sola lettura).
 * La chiave si prende da asporto-app/.env (sempre aggiornata, la usa la build) e in mancanza dal .env
 * dell'agent. Risultato tenuto 10 s per non interrogare il DB a ogni richiesta.
 */
let menuProductsCache = { at: 0, data: null };
function readAnonKey() {
  try {
    const env = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', '.env'), 'utf8');
    const m = /^VITE_SUPABASE_ANON_KEY=(.+)$/m.exec(env);
    if (m) return m[1].trim().replace(/^["']|["']$/g, '');
  } catch { /* nessun asporto-app/.env (es. sviluppo) */ }
  return supabaseKey;
}
async function fetchMenuProducts() {
  if (menuProductsCache.data && Date.now() - menuProductsCache.at < 10_000) return menuProductsCache.data;
  const base = (process.env.KINDLE_SUPABASE_URL || 'http://127.0.0.1:54321').replace(/\/+$/, '');
  const key = readAnonKey();
  const r = await fetch(`${base}/rest/v1/prodotti?select=nome,prezzo,categoria,sottocategoria,ingredienti,disponibile&disponibile=eq.true`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error(`Lettura menu fallita (${r.status})`);
  menuProductsCache = { at: Date.now(), data: await r.json() };
  return menuProductsCache.data;
}

async function runPrintJob(job) {
  if (job.kind === 'kitchen') return printKitchenJob(job);
  if (job.kind === 'sala') return printSalaJob(job);
  if (job.kind === 'pre_conto') return printPreContoJob(job);
  if (job.kind === 'receipt') return printReceiptJob(job);
  if (job.kind === 'haccp_label') return stampaEtichettaHaccp(job);
  if (job.kind === 'quick_label') return printQuickLabelJob(job);
  throw new Error('Unknown print job');
}

/** Solo le comande vanno in lista d'attesa: conti, pre-conti ed etichette si ristampano a mano sul momento. */
const QUEUED_KINDS = ['kitchen', 'sala'];
const PENDING_RETRY_INTERVAL_MS = 20_000;
const pending = createPendingStore({ file: path.join(__dirname, 'pending-jobs.json'), runJob: runPrintJob });
setInterval(() => { if (pending.size > 0) void pending.flush(); }, PENDING_RETRY_INTERVAL_MS);

const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  // Immagini per il Kindle (plugin KOReader in /kindle): menu del giorno e logo per lo standby
  // Senza estensione: Cloudflare mette in cache i .png per ore (menu vecchio sul Kindle), le rotte senza no.
  const kindleRoute = { '/kindle/menu': 'menu', '/kindle/menu.png': 'menu', '/kindle/logo': 'logo', '/kindle/logo.png': 'logo' }[reqUrl.pathname];
  if (req.method === 'GET' && kindleRoute) {
    try {
      const km = require('./kindleMenu');
      const query = Object.fromEntries(reqUrl.searchParams);
      const result = kindleRoute === 'logo'
        ? km.renderLogoPng(query)
        : km.renderMenuPng(await fetchMenuProducts(), query);
      res.setHeader('ETag', result.etag);
      res.setHeader('Cache-Control', 'no-store'); // niente cache intermedie (Cloudflare)
      if (result.pages) res.setHeader('X-Pages', String(result.pages));
      if (req.headers['if-none-match'] === result.etag) { res.statusCode = 304; return res.end(); }
      res.setHeader('Content-Type', 'image/png');
      return res.end(result.png);
    } catch (error) {
      console.error('[KINDLE ERROR]', error);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.end(String(error.message || error));
    }
  }

  if (req.method === 'GET' && reqUrl.pathname === '/health') {
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ ok: true }));
  }

  // Comande non stampate: lista e azioni (Ristampa / Elimina) dall'app
  if (reqUrl.pathname === '/pending' && req.method === 'GET') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    return res.end(JSON.stringify({ jobs: pending.list() }));
  }
  const pendingAction = /^\/pending\/([0-9a-f-]{36})\/(retry|delete)$/.exec(reqUrl.pathname);
  if (pendingAction && req.method === 'POST') {
    const [, id, action] = pendingAction;
    res.setHeader('Content-Type', 'application/json');
    if (action === 'delete') {
      return res.end(JSON.stringify({ ok: pending.remove(id) }));
    }
    try {
      const result = await pending.retry(id);
      res.statusCode = result.ok ? 200 : 500;
      return res.end(JSON.stringify(result));
    } catch (e) {
      res.statusCode = 500;
      return res.end(JSON.stringify({ ok: false, error: String(e.message || e) }));
    }
  }

  if (req.method === 'POST' && reqUrl.pathname === '/print') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString('utf8');
      if (body.length > 1_000_000) req.destroy();
    });
    req.on('end', async () => {
      let job = null;
      try {
        job = JSON.parse(body || '{}');
        await runPrintJob(job);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true }));
        // La stampante funziona: se c'erano comande in attesa escono adesso
        if (pending.size > 0) void pending.flush();
      } catch (error) {
        console.error('[PRINT BRIDGE ERROR]', error);
        res.setHeader('Content-Type', 'application/json');
        // Comanda (cucina/sala) non stampata per un problema della stampante (beforeConnect è valorizzato
        // solo dagli errori di comunicazione con la stampante): non si perde, va nella lista d'attesa.
        if (job && QUEUED_KINDS.includes(job.kind) && error && error.beforeConnect !== undefined) {
          const entry = pending.add(job, error);
          res.statusCode = 202;
          return res.end(JSON.stringify({ ok: false, queued: true, auto: entry.auto, id: entry.id, error: String(error.message || error) }));
        }
        res.statusCode = 500;
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

// Un errore sfuggito non deve far cadere l'agent a metà servizio (con lui cadevano anche le stampe in coda):
// si scrive nel log e si va avanti.
process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED REJECTION]', reason);
});
process.on('uncaughtException', (error) => {
  console.error('[UNCAUGHT EXCEPTION]', error);
});

process.on('SIGINT', () => {
  console.log('Shutting down...');
  server.close();
  process.exit();
});