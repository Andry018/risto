/**
 * WA Agent — ponte tra il gestionale e Evolution API (WhatsApp)
 *
 * Evolution API gira in Docker (vedi docker-compose.yml) e tiene la sessione WhatsApp.
 * Questo agent tiene la sua API key lontana dal browser ed espone solo ciò che serve alla UI:
 *   GET  /health            — health check (senza token)
 *   GET  /status            — stato connessione WhatsApp
 *   POST /connect           — crea l'istanza se manca e restituisce il QR da scansionare
 *   POST /logout            — scollega il telefono
 *   GET  /chats             — elenco chat
 *   GET  /messages?jid=     — messaggi di una chat
 *   POST /send              — invia testo { jid, text }
 *   POST /read              — segna come letti { jid, ids: [] }
 *   GET  /media?id=         — scarica foto/sticker di un messaggio (base64)
 *   GET  /events?token=     — eventi in tempo reale (SSE)
 *   POST /webhook/<secret>  — chiamato da Evolution API (nuovi messaggi, QR, connessione)
 *
 * Tutte le rotte (tranne /health e /webhook) richiedono il token WA_ACCESS_TOKEN
 * nell'header X-Wa-Token: le chat contengono dati dei clienti e il gestionale è esposto su internet.
 */

'use strict';

const http   = require('node:http');
const fs     = require('node:fs');
const path   = require('node:path');
const crypto = require('node:crypto');
const { URL } = require('node:url');

// .env letto a mano (sul CT lo carica già systemd con EnvironmentFile): nessuna dipendenza npm
(function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
})(path.join(__dirname, '.env'));

// ---------------------------------------------------------------------------
// Configurazione
// ---------------------------------------------------------------------------

const PORT           = Number(process.env.WA_PORT || 8789);
const EVO_URL        = (process.env.EVOLUTION_URL || 'http://127.0.0.1:8085').replace(/\/+$/, '');
const EVO_KEY        = process.env.EVOLUTION_API_KEY || '';
const INSTANCE       = process.env.EVOLUTION_INSTANCE || 'risto';
const ACCESS_TOKEN   = process.env.WA_ACCESS_TOKEN || '';
const WEBHOOK_SECRET = process.env.WA_WEBHOOK_SECRET || '';
// URL con cui il container Evolution raggiunge questo agent (host-gateway di Docker)
const WEBHOOK_URL    = process.env.WA_WEBHOOK_URL || `http://host.docker.internal:${PORT}/webhook/${WEBHOOK_SECRET}`;
const WEBHOOK_EVENTS = ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'SEND_MESSAGE', 'CONNECTION_UPDATE', 'QRCODE_UPDATED'];

const inst = encodeURIComponent(INSTANCE);

function log(...args) {
  console.log(new Date().toISOString(), '[wa]', ...args);
}

function safeEqual(value, expected) {
  if (typeof value !== 'string' || !expected) return false;
  const a = Buffer.from(value), b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ---------------------------------------------------------------------------
// Client Evolution API
// ---------------------------------------------------------------------------

async function evo(method, p, body, timeoutMs = 20000) {
  let res;
  try {
    res = await fetch(EVO_URL + p, {
      method,
      headers: { apikey: EVO_KEY, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    const e = new Error(`Evolution API non raggiungibile (${EVO_URL}): ${err.message}`);
    e.status = 502;
    throw e;
  }
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const msg = data?.response?.message ?? data?.message ?? data?.error;
    const e = new Error(`Evolution ${res.status}: ${Array.isArray(msg) ? msg.join(', ') : (msg || 'errore')}`);
    e.status = res.status;
    throw e;
  }
  return data;
}

async function getState() {
  try {
    const data = await evo('GET', `/instance/connectionState/${inst}`);
    return data?.instance?.state || data?.state || 'close';
  } catch (err) {
    if (err.status === 404) return 'missing';
    throw err;
  }
}

async function configureWebhook() {
  if (!WEBHOOK_SECRET) {
    log('WA_WEBHOOK_SECRET non impostato: niente messaggi in tempo reale');
    return;
  }
  await evo('POST', `/webhook/set/${inst}`, {
    webhook: { enabled: true, url: WEBHOOK_URL, byEvents: false, base64: false, events: WEBHOOK_EVENTS },
  });
}

async function ensureInstance() {
  if (await getState() !== 'missing') return;
  log(`creo istanza '${INSTANCE}'`);
  await evo('POST', '/instance/create', { instanceName: INSTANCE, integration: 'WHATSAPP-BAILEYS', qrcode: true });
}

// ---------------------------------------------------------------------------
// Normalizzazione — la forma dei dati di Evolution cambia tra versioni:
// la UI riceve sempre gli stessi campi
// ---------------------------------------------------------------------------

function toSeconds(ts) {
  if (ts == null) return 0;
  if (typeof ts === 'object' && 'low' in ts) return Number(ts.low) >>> 0;   // Long di protobuf
  const n = Number(ts);
  if (Number.isFinite(n)) return n > 1e12 ? Math.floor(n / 1000) : n;
  const d = Date.parse(ts);
  return Number.isFinite(d) ? Math.floor(d / 1000) : 0;
}

function phoneFromJid(jid) {
  if (typeof jid !== 'string' || !jid.endsWith('@s.whatsapp.net')) return '';
  return jid.split('@')[0].split(':')[0];
}

function unwrap(msg) {
  let m = msg || {};
  for (let i = 0; i < 3; i++) {
    const inner = m.ephemeralMessage?.message || m.viewOnceMessage?.message
      || m.viewOnceMessageV2?.message || m.documentWithCaptionMessage?.message;
    if (!inner) break;
    m = inner;
  }
  return m;
}

function describe(msg) {
  const m = unwrap(msg);
  if (m.conversation)               return { kind: 'text', text: m.conversation };
  if (m.extendedTextMessage)        return { kind: 'text', text: m.extendedTextMessage.text || '' };
  if (m.imageMessage)               return { kind: 'image', text: m.imageMessage.caption || '' };
  if (m.stickerMessage)             return { kind: 'sticker', text: '' };
  if (m.videoMessage)               return { kind: 'video', text: m.videoMessage.caption || '' };
  if (m.audioMessage)               return { kind: 'audio', text: '' };
  if (m.documentMessage)            return { kind: 'document', text: m.documentMessage.caption || m.documentMessage.fileName || '' };
  if (m.locationMessage)            return { kind: 'location', text: m.locationMessage.name || m.locationMessage.address || '' };
  if (m.contactMessage)             return { kind: 'contact', text: m.contactMessage.displayName || '' };
  if (m.reactionMessage)            return { kind: 'reaction', text: m.reactionMessage.text || '' };
  if (m.buttonsResponseMessage)     return { kind: 'text', text: m.buttonsResponseMessage.selectedDisplayText || '' };
  if (m.listResponseMessage)        return { kind: 'text', text: m.listResponseMessage.title || '' };
  if (m.protocolMessage)            return { kind: 'protocol', text: '' };
  return { kind: 'other', text: '' };
}

function lastStatus(m) {
  if (m.status) return String(m.status);
  const updates = m.MessageUpdate || m.messageUpdate;
  if (Array.isArray(updates) && updates.length) return String(updates[updates.length - 1].status || '');
  return '';
}

function normMessage(m) {
  const key = m?.key || {};
  if (!key.id || !key.remoteJid) return null;
  const { kind, text } = describe(m.message);
  return {
    id: key.id,
    jid: key.remoteJid,
    fromMe: !!key.fromMe,
    pushName: m.pushName || '',
    timestamp: toSeconds(m.messageTimestamp),
    kind,
    text,
    status: lastStatus(m),
    // Chat @lid (nuovo formato WhatsApp): il numero vero arriva a parte
    phone: phoneFromJid(key.remoteJid) || phoneFromJid(key.remoteJidAlt) || phoneFromJid(key.senderPn),
  };
}

function normChat(c, contacts) {
  const jid = c.remoteJid || c.id;
  if (typeof jid !== 'string' || !jid.includes('@') || jid === 'status@broadcast') return null;
  const last = c.lastMessage ? normMessage(c.lastMessage) : null;
  const contact = contacts.get(jid);
  const name = c.pushName || c.name || contact?.pushName
    || (last && !last.fromMe ? last.pushName : '') || '';
  return {
    jid,
    name,
    phone: phoneFromJid(jid) || last?.phone || '',
    isGroup: jid.endsWith('@g.us'),
    avatar: c.profilePicUrl || contact?.profilePicUrl || null,
    unread: Number(c.unreadCount ?? c.unreadMessages ?? 0) || 0,
    lastMessage: last && last.kind !== 'protocol' ? last : null,
    updatedAt: last?.timestamp ? last.timestamp * 1000 : (Date.parse(c.updatedAt) || 0),
  };
}

function records(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.messages?.records)) return data.messages.records;
  if (Array.isArray(data?.records)) return data.records;
  if (Array.isArray(data?.messages)) return data.messages;
  return [];
}

// ---------------------------------------------------------------------------
// Eventi in tempo reale (Server-Sent Events)
// ---------------------------------------------------------------------------

const sseClients = new Set();

function broadcast(event) {
  const line = `data: ${JSON.stringify(event)}\n\n`;
  for (const res of sseClients) res.write(line);
}

setInterval(() => {
  for (const res of sseClients) res.write(': ping\n\n');
}, 25000).unref();

function handleWebhook(payload) {
  const event = String(payload?.event || '').toLowerCase().replace(/_/g, '.');
  const data = payload?.data;
  if (payload?.instance && payload.instance !== INSTANCE) return;

  if (event === 'messages.upsert' || event === 'send.message') {
    for (const raw of Array.isArray(data) ? data : [data]) {
      const message = normMessage(raw);
      if (message && message.kind !== 'protocol') broadcast({ type: 'message', message });
    }
  } else if (event === 'messages.update') {
    for (const u of Array.isArray(data) ? data : [data]) {
      const id = u?.keyId || u?.key?.id;
      const status = u?.status || u?.update?.status;
      if (id && status) broadcast({ type: 'status', id, jid: u.remoteJid || u.key?.remoteJid, status: String(status) });
    }
  } else if (event === 'connection.update') {
    log(`connessione: ${data?.state}`);
    broadcast({ type: 'connection', state: data?.state || 'close' });
  } else if (event === 'qrcode.updated') {
    const qr = data?.qrcode?.base64 || data?.base64;
    if (qr) broadcast({ type: 'qr', qr });
  }
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

const MAX_BODY = 5 * 1024 * 1024;

function readBody(req, limit = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > limit) { reject(Object.assign(new Error('Body troppo grande'), { status: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); }
      catch { reject(Object.assign(new Error('JSON non valido'), { status: 400 })); }
    });
    req.on('error', reject);
  });
}

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function sendTarget(jid) {
  // Numeri normali: solo cifre; gruppi e @lid: jid completo
  return phoneFromJid(jid) || jid;
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Wa-Token');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const url = new URL(req.url || '/', 'http://127.0.0.1');
  const route = `${req.method} ${url.pathname.replace(/\/+$/, '') || '/'}`;

  try {
    if (route === 'GET /health') {
      return json(res, 200, { ok: true, instance: INSTANCE, configured: !!(EVO_KEY && ACCESS_TOKEN) });
    }

    if (req.method === 'POST' && url.pathname.startsWith('/webhook/')) {
      if (!safeEqual(url.pathname.slice('/webhook/'.length), WEBHOOK_SECRET)) return json(res, 403, { ok: false });
      handleWebhook(await readBody(req, MAX_BODY));
      return json(res, 200, { ok: true });
    }

    if (!ACCESS_TOKEN || !EVO_KEY) {
      return json(res, 503, { ok: false, error: 'WA agent non configurato: imposta WA_ACCESS_TOKEN e EVOLUTION_API_KEY in wa-agent/.env' });
    }
    // Il token in query è ammesso solo per /events: EventSource non può mandare header
    const token = req.headers['x-wa-token'] || (route === 'GET /events' ? url.searchParams.get('token') : '');
    if (!safeEqual(token, ACCESS_TOKEN)) return json(res, 401, { ok: false, error: 'Token WhatsApp non valido' });

    switch (route) {
      case 'GET /events': {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
          'X-Accel-Buffering': 'no',
        });
        res.write(': connesso\n\n');
        sseClients.add(res);
        req.on('close', () => sseClients.delete(res));
        return;
      }

      case 'GET /status':
        return json(res, 200, { ok: true, state: await getState(), instance: INSTANCE });

      case 'POST /connect': {
        await ensureInstance();
        await configureWebhook().catch(err => log('webhook non configurato:', err.message));
        const state = await getState();
        if (state === 'open') return json(res, 200, { ok: true, state });
        const data = await evo('GET', `/instance/connect/${inst}`);
        return json(res, 200, { ok: true, state, qr: data?.base64 || data?.qrcode?.base64 || null, pairingCode: data?.pairingCode || null });
      }

      case 'POST /logout':
        await evo('DELETE', `/instance/logout/${inst}`);
        broadcast({ type: 'connection', state: 'close' });
        return json(res, 200, { ok: true });

      case 'GET /chats': {
        const [chats, contacts] = await Promise.all([
          evo('POST', `/chat/findChats/${inst}`, {}),
          evo('POST', `/chat/findContacts/${inst}`, {}).catch(() => []),
        ]);
        const contactMap = new Map((Array.isArray(contacts) ? contacts : []).map(c => [c.remoteJid || c.id, c]));
        const list = (Array.isArray(chats) ? chats : [])
          .map(c => normChat(c, contactMap))
          .filter(Boolean)
          .sort((a, b) => b.updatedAt - a.updatedAt);
        return json(res, 200, { ok: true, chats: list });
      }

      case 'GET /messages': {
        const jid = url.searchParams.get('jid');
        if (!jid) return json(res, 400, { ok: false, error: 'jid mancante' });
        const limit = Math.min(Number(url.searchParams.get('limit')) || 60, 200);
        const data = await evo('POST', `/chat/findMessages/${inst}`, { where: { key: { remoteJid: jid } }, page: 1, offset: limit });
        const messages = records(data)
          .map(normMessage)
          .filter(m => m && m.kind !== 'protocol')
          .sort((a, b) => a.timestamp - b.timestamp);
        return json(res, 200, { ok: true, messages });
      }

      case 'POST /send': {
        const { jid, text } = await readBody(req);
        if (typeof jid !== 'string' || typeof text !== 'string' || !text.trim()) {
          return json(res, 400, { ok: false, error: 'jid e testo obbligatori' });
        }
        if (text.length > 4000) return json(res, 400, { ok: false, error: 'Messaggio troppo lungo' });
        const data = await evo('POST', `/message/sendText/${inst}`, { number: sendTarget(jid), text });
        const message = normMessage(data) || {
          id: `local-${Date.now()}`, jid, fromMe: true, pushName: '', timestamp: Math.floor(Date.now() / 1000),
          kind: 'text', text, status: 'PENDING', phone: phoneFromJid(jid),
        };
        return json(res, 200, { ok: true, message });
      }

      case 'POST /read': {
        const { jid, ids } = await readBody(req);
        if (typeof jid !== 'string' || !Array.isArray(ids) || ids.length === 0) return json(res, 200, { ok: true });
        await evo('POST', `/chat/markMessageAsRead/${inst}`, {
          readMessages: ids.slice(-50).map(id => ({ remoteJid: jid, fromMe: false, id: String(id) })),
        });
        return json(res, 200, { ok: true });
      }

      case 'GET /media': {
        const id = url.searchParams.get('id');
        if (!id) return json(res, 400, { ok: false, error: 'id mancante' });
        const data = await evo('POST', `/chat/getBase64FromMediaMessage/${inst}`, { message: { key: { id } }, convertToMp4: false }, 60000);
        if (!data?.base64) return json(res, 404, { ok: false, error: 'Media non disponibile' });
        return json(res, 200, { ok: true, base64: data.base64, mimetype: data.mimetype || 'image/jpeg' });
      }

      default:
        return json(res, 404, { ok: false, error: 'Rotta sconosciuta' });
    }
  } catch (err) {
    log(`${route} → ${err.message}`);
    if (!res.headersSent) json(res, err.status && err.status < 600 ? err.status : 500, { ok: false, error: err.message });
  }
});

server.listen(PORT, process.env.WA_BIND || '0.0.0.0', () => {
  log(`WA agent su :${PORT} → Evolution ${EVO_URL}, istanza '${INSTANCE}'`);
  if (!ACCESS_TOKEN || !EVO_KEY) log('ATTENZIONE: WA_ACCESS_TOKEN / EVOLUTION_API_KEY mancanti');
  // Se l'istanza esiste già (riavvio), riallinea il webhook: l'URL potrebbe essere cambiato
  getState()
    .then(state => state !== 'missing' ? configureWebhook() : undefined)
    .catch(err => log('Evolution non ancora pronta:', err.message));
});
