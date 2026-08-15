// ============================================================
// Server comande agriturismo — Node puro, zero dipendenze npm.
// Va avviato sul PC collegato alla stampante USB.
// - Il telefono si collega a http://<IP-DI-QUESTO-PC>:4000/  per fare le comande
// - Sullo stesso PC si apre http://localhost:4000/stampa.html che stampa
//   automaticamente ogni comanda/conto inviato dai telefoni.
// Avvio: node server.js
// ============================================================

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const PORT = Number(process.env.PORT || 4000);
const STATE_FILE = path.join(__dirname, 'state.json');
const PUBLIC_DIR = __dirname;

const MENU_DEFAULT = {
  "Antipasto": [
    { nome: "Antipasto misto", prezzo: 10.0, cucina: true },
  ],
  "Primo": [
    { nome: "Primo del giorno", prezzo: 10.0, cucina: true },
  ],
  "Secondo": [
    { nome: "Secondo del giorno", prezzo: 14.0, cucina: true },
  ],
  "Dolce": [
    { nome: "Dolce della casa", prezzo: 5.0, cucina: true },
  ],
  "Bevande": [
    { nome: "Acqua 1L", prezzo: 2.0, cucina: false },
    { nome: "Vino della casa (1/2 lt)", prezzo: 6.0, cucina: false },
    { nome: "Bibita in lattina", prezzo: 3.0, cucina: false },
    { nome: "Caffè", prezzo: 1.5, cucina: false },
  ],
  "Servizio": [
    { nome: "Coperto", prezzo: 2.0, cucina: false },
  ],
};

const TAVOLI_INIZIALI = ['Tavolo 1', 'Tavolo 2', 'Tavolo 3', 'Tavolo 4', 'Tavolo 5', 'Tavolo 6'];

function seedTavoli() {
  const t = {};
  TAVOLI_INIZIALI.forEach((nome) => { t[nome] = { adulti: 0, bambini: 0, carrello: [] }; });
  return t;
}

function loadState() {
  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && parsed.menu && parsed.tavoli) return parsed;
  } catch (e) { /* file assente o corrotto: si riparte dal default */ }
  return { menu: JSON.parse(JSON.stringify(MENU_DEFAULT)), tavoli: seedTavoli() };
}

let state = loadState();
let printQueue = []; // { id, kind: 'cucina'|'conto', tavolo, now, items, adulti, bambini }

function saveState() {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

function nowStr() {
  return new Date().toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 2_000_000) req.destroy();
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch (e) { reject(new Error('JSON non valido')); }
    });
    req.on('error', reject);
  });
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

function serveStatic(req, res, pathname) {
  const safePath = path.normalize(pathname === '/' ? '/index.html' : pathname).replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(PUBLIC_DIR, safePath);
  if (!filePath.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end('Vietato'); }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Non trovato'); }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

// Unisce il carrello ricevuto dal telefono con quello salvato, mantenendo
// sentQty (quanto è già stato mandato in cucina) lato server: il client
// non deve preoccuparsene, lo calcoliamo noi in base all'id di ogni riga.
function mergeCarrello(prevCarrello, incomingCarrello) {
  const prevById = new Map((prevCarrello || []).map((i) => [i.id, i]));
  return (incomingCarrello || []).map((item) => {
    const prev = prevById.get(item.id);
    const quantity = Number(item.quantity) || 0;
    return {
      id: item.id || crypto.randomUUID(),
      nome: String(item.nome || ''),
      prezzo: Number(item.prezzo) || 0,
      cucina: !!item.cucina,
      quantity,
      portata: item.portata || '1',
      note: item.note || '',
      sentQty: prev ? Math.min(prev.sentQty || 0, quantity) : 0,
    };
  });
}

const server = http.createServer(async (req, res) => {
  let u;
  try {
    u = new URL(req.url, `http://${req.headers.host}`);
  } catch (e) {
    res.writeHead(400); return res.end('URL non valido');
  }
  const p = u.pathname;

  try {
    if (req.method === 'GET' && p === '/api/state') {
      return sendJson(res, 200, state);
    }

    if (req.method === 'POST' && p === '/api/tavoli') {
      const body = await readBody(req);
      const nome = String(body.nome || '').trim();
      if (!nome) return sendJson(res, 400, { ok: false, error: 'Nome tavolo mancante' });
      if (state.tavoli[nome]) return sendJson(res, 400, { ok: false, error: 'Esiste già un tavolo con questo nome' });
      state.tavoli[nome] = { adulti: 0, bambini: 0, carrello: [] };
      saveState();
      return sendJson(res, 200, { ok: true });
    }

    const tavoloMatch = p.match(/^\/api\/tavoli\/([^/]+)\/(sync|cucina|conto|chiudi)$/);
    if (req.method === 'POST' && tavoloMatch) {
      const nome = decodeURIComponent(tavoloMatch[1]);
      const azione = tavoloMatch[2];
      const tavolo = state.tavoli[nome];
      if (!tavolo) return sendJson(res, 404, { ok: false, error: 'Tavolo non trovato' });

      if (azione === 'chiudi') {
        state.tavoli[nome] = { adulti: 0, bambini: 0, carrello: [] };
        saveState();
        return sendJson(res, 200, { ok: true });
      }

      const body = await readBody(req);
      const merged = mergeCarrello(tavolo.carrello, body.carrello);
      tavolo.adulti = Number(body.adulti) || 0;
      tavolo.bambini = Number(body.bambini) || 0;
      tavolo.carrello = merged;

      if (azione === 'sync') {
        saveState();
        return sendJson(res, 200, { ok: true });
      }

      if (azione === 'cucina') {
        const daMandare = merged
          .filter((i) => i.cucina && i.quantity > i.sentQty)
          .map((i) => ({ ...i, quantity: i.quantity - i.sentQty }));
        if (daMandare.length === 0) {
          saveState();
          return sendJson(res, 200, { ok: false, error: 'Niente di nuovo da mandare in cucina per questo tavolo.' });
        }
        merged.forEach((i) => { if (i.cucina) i.sentQty = i.quantity; });
        saveState();
        printQueue.push({ id: crypto.randomUUID(), kind: 'cucina', tavolo: nome, now: nowStr(), items: daMandare });
        return sendJson(res, 200, { ok: true });
      }

      if (azione === 'conto') {
        if (merged.length === 0) {
          saveState();
          return sendJson(res, 200, { ok: false, error: 'Il tavolo è vuoto.' });
        }
        saveState();
        printQueue.push({
          id: crypto.randomUUID(),
          kind: 'conto',
          tavolo: nome,
          now: nowStr(),
          items: merged,
          adulti: tavolo.adulti,
          bambini: tavolo.bambini,
        });
        return sendJson(res, 200, { ok: true });
      }
    }

    if (req.method === 'PUT' && p === '/api/menu') {
      const body = await readBody(req);
      if (!body.menu || typeof body.menu !== 'object') return sendJson(res, 400, { ok: false, error: 'Menù non valido' });
      state.menu = body.menu;
      saveState();
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === 'POST' && p === '/api/menu/reset') {
      state.menu = JSON.parse(JSON.stringify(MENU_DEFAULT));
      saveState();
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === 'GET' && p === '/api/print-queue') {
      return sendJson(res, 200, printQueue);
    }

    const ackMatch = p.match(/^\/api\/print-queue\/([^/]+)\/ack$/);
    if (req.method === 'POST' && ackMatch) {
      const id = ackMatch[1];
      printQueue = printQueue.filter((j) => j.id !== id);
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === 'GET') {
      return serveStatic(req, res, p);
    }

    res.writeHead(404);
    res.end('Non trovato');
  } catch (err) {
    console.error('[ERRORE]', err);
    sendJson(res, 500, { ok: false, error: String((err && err.message) || err) });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('=== Server comande agriturismo avviato ===');
  console.log(`In locale: http://localhost:${PORT}/`);
  const nets = os.networkInterfaces();
  Object.keys(nets).forEach((name) => {
    (nets[name] || []).forEach((net) => {
      if (net.family === 'IPv4' && !net.internal) {
        console.log(`Da telefono (stessa rete WiFi): http://${net.address}:${PORT}/`);
        console.log(`Stazione di stampa (su QUESTO pc):  http://${net.address}:${PORT}/stampa.html`);
      }
    });
  });
});
