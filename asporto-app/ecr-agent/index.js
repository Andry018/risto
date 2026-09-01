/**
 * ECR Agent — Nexi PAX A35 (ECR17) + Custom Big Plus RT (scontrino fiscale)
 *
 * Espone un'API HTTP locale per:
 *   POST /pay          — avvia pagamento carta sul terminale PAX A35
 *   POST /cancel       — storna l'ultima transazione PAX
 *   POST /print-receipt — stampa scontrino fiscale su cassa Custom Big Plus RT
 *   GET  /status       — verifica connettività terminale PAX
 *   GET  /health       — health check agente
 */

'use strict';

require('dotenv').config();
const net  = require('node:net');
const http = require('node:http');
const { URL } = require('node:url');

// ---------------------------------------------------------------------------
// Configurazione
// ---------------------------------------------------------------------------

const PAX_HOST         = process.env.PAX_HOST         || '192.168.1.50';
const PAX_PORT         = Number(process.env.PAX_PORT   || 10009);
const SERVER_PORT      = Number(process.env.ECR_PORT   || 8788);
const CONNECT_TIMEOUT  = Number(process.env.PAX_CONNECT_TIMEOUT  || 5000);   // ms
const RESPONSE_TIMEOUT = Number(process.env.PAX_RESPONSE_TIMEOUT || 90000);  // ms (90 s — tempo per inserire carta)

// IDs — 8 cifre numeriche, '00000000' = accettato da qualsiasi terminale
const TERMINAL_ID = (process.env.PAX_TERMINAL_ID || '00000000').padStart(8, '0');
const CASH_REG_ID = (process.env.ECR_CASH_REG_ID || '00000001').padStart(8, '0');

// Cassa fiscale Custom Big Plus RT
const CUSTOM_HOST      = process.env.CUSTOM_HOST      || '192.168.1.51';
const CUSTOM_PORT      = Number(process.env.CUSTOM_PORT || 9100);
const CUSTOM_TIMEOUT   = Number(process.env.CUSTOM_TIMEOUT || 10000);        // ms

// ---------------------------------------------------------------------------
// Costanti protocollo ECR17 (Nexi LAN Integration)
// ---------------------------------------------------------------------------

const STX = 0x02; // Start of Text
const ETX = 0x03; // End of Text
const ACK = 0x06; // Acknowledgement
const NAK = 0x15; // Negative Acknowledgement
const SOH = 0x01; // Start of Heading (progress update packets)
const EOT = 0x04; // End of Transmission (fine progress update)
const MAX_RETRIES = 3;

// LRC = XOR di tutti i byte del payload + ETX, con valore base 0x7F
function calcLRC(bytes) {
  return bytes.reduce((acc, b) => acc ^ b, 0x7F);
}

// Frame applicativo: [STX][payload][ETX][LRC]
function buildFrame(payload) {
  const payloadBuf = Buffer.from(payload, 'latin1');
  const frame = Buffer.alloc(payloadBuf.length + 3);
  frame[0] = STX;
  payloadBuf.copy(frame, 1);
  frame[payloadBuf.length + 1] = ETX;
  frame[payloadBuf.length + 2] = calcLRC([...payloadBuf, ETX]);
  return frame;
}

// ACK di conferma ricezione: [ACK][ETX][LRC]
function buildAck() {
  return Buffer.from([ACK, ETX, calcLRC([ACK, ETX])]);
}

// NAK di rifiuto: [NAK][ETX][LRC]
function buildNak() {
  return Buffer.from([NAK, ETX, calcLRC([NAK, ETX])]);
}

// ---------------------------------------------------------------------------
// Costruzione messaggi ECR → Terminale
// ---------------------------------------------------------------------------

/**
 * Terminal Status Request
 * Pos 1-8:  Terminal ID (8 cifre)
 * Pos 9:    Reserved '0'
 * Pos 10:   Message code 's' (0x73)
 */
function buildStatusRequest() {
  return buildFrame(TERMINAL_ID + '0s');
}

/**
 * Payment Request
 * Pos 1-8:   Terminal ID
 * Pos 9:     Reserved '0'
 * Pos 10:    Message code 'P' (0x50)
 * Pos 11-18: Cash register ID (8 cifre)
 * Pos 19:    Additional data '0' (non presente)
 * Pos 20-21: Reserved '00'
 * Pos 22:    Card present flag '0' (carta non ancora inserita)
 * Pos 23:    Payment type '0' (riconoscimento automatico)
 * Pos 24-31: Amount in cents, 8 cifre, zero-padded a sinistra
 * Pos 32-159: Testo da stampare (128 char, space-padded a sinistra)
 * Pos 160-167: Reserved '00000000'
 */
function buildPurchaseRequest(amountCents) {
  const amount  = String(amountCents).padStart(8, '0');
  const textPad = ''.padStart(128, ' ');
  // Usa 'X' (Extended Payment) invece di 'P': stessa struttura request ma
  // la risposta include anche action code e importo confermato dall'host.
  const payload = TERMINAL_ID + '0X' + CASH_REG_ID + '0' + '00' + '0' + '0' + amount + textPad + '00000000';
  return buildFrame(payload);
}

/**
 * Reversal (storno ultima transazione)
 * Pos 1-8:   Terminal ID
 * Pos 9:     Reserved '0'
 * Pos 10:    Message code 'S'
 * Pos 11-18: Cash register ID
 * Pos 19-24: STAN (6 cifre). '000000' = nessun controllo, storna l'ultima tx.
 * Pos 25:    Additional data '0'
 * Pos 26:    Reserved '0'
 */
function buildCancelRequest(stan = '') {
  const stanField = stan ? stan.padStart(6, '0') : '000000';
  const payload = TERMINAL_ID + '0S' + CASH_REG_ID + stanField + '0' + '0';
  return buildFrame(payload);
}

// ---------------------------------------------------------------------------
// Parser risposta Terminale → ECR
// ---------------------------------------------------------------------------

/**
 * Analizza il payload (stringa tra STX e ETX) in base al codice messaggio.
 *
 * Payment response ('E' o 'V'):
 *   Pos 1-8:   Terminal ID
 *   Pos 9:     Reserved
 *   Pos 10:    Message code ('E' normale, 'V' con currency exchange)
 *   Pos 11-12: Result code: "00" = OK, "01" = KO, "05" = carta assente, "09" = tag sconosciuto
 *   Se OK:
 *     Pos 13-31: PAN carta (19 char, zero-padded a sinistra)
 *     Pos 32-34: Tipo transazione (ICC/MAG/MAN/CLM/CLI)
 *     Pos 35-40: Codice autorizzazione (6 char)
 *     Pos 41-47: Data/ora host (DDDHHMM)
 *   Se KO:
 *     Pos 13-36: Descrizione errore (24 char)
 *   Comuni:
 *     Pos 48:    Tipo carta ('1'=Bancomat, '2'=Credito, '3'=Altro)
 *     Pos 49-59: Acquirer ID (11 char)
 *     Pos 60-65: STAN (6 cifre)
 *     Pos 66-71: ID online (6 cifre)
 *
 * Status response ('s'):
 *   Pos 1-8:   Terminal ID
 *   Pos 9:     Reserved
 *   Pos 10:    's'
 *   Pos 11-20: Reserved ('0' x10)
 *   Pos 21-30: Data/ora terminale (DDMMYYhhmm)
 *   Pos 31:    Status ('2' = operativo)
 *   Pos 32+:   SW release
 */
function parseResponse(payload) {
  if (payload.length < 10) {
    return { ok: false, error: 'Risposta troppo corta dal terminale' };
  }

  const msgCode = payload[9]; // posizione 10 (1-indexed)

  // Status response
  if (msgCode === 's') {
    const status    = payload[30] || '0'; // posizione 31
    const datetime  = payload.substring(20, 30); // posizione 21-30
    const swRelease = payload.substring(31).trim();
    const operative = status === '2';
    return {
      ok: operative,
      msgCode,
      status,
      datetime,
      swRelease,
      error: operative ? null : `Terminale non operativo (status: ${status})`,
    };
  }

  // Payment response ('E' = normale, 'V' = currency exchange)
  if (msgCode === 'E' || msgCode === 'V') {
    const resultCode = payload.substring(10, 12); // posizione 11-12
    const approved   = resultCode === '00';

    // Campi comuni (disponibili se il payload è abbastanza lungo)
    const cardType   = payload[47]                || '';          // pos 48
    const stan       = payload.substring(59, 65).trim();         // pos 60-65
    const actionCode = payload.substring(71, 74).trim();         // pos 72-74 (extended)
    const hostAmount = payload.length >= 82                       // pos 75-82 (extended, solo 'X')
      ? payload.substring(74, 82).replace(/^0+/, '') || '0'
      : null;

    if (approved) {
      const pan      = payload.substring(12, 31).replace(/^0+/, ''); // pos 13-31
      const txType   = payload.substring(31, 34).trim();              // pos 32-34
      const authCode = payload.substring(34, 40).trim();              // pos 35-40
      return { ok: true, resultCode, authCode, pan, txType, cardType, stan, actionCode, hostAmount, error: null };
    } else {
      const errorDesc = payload.substring(12, 36).trim();  // pos 13-36
      return {
        ok: false,
        resultCode,
        stan,
        actionCode,
        error: errorDesc || `Transazione rifiutata (codice: ${resultCode})`,
      };
    }
  }

  // Risposta sconosciuta — log grezzo
  console.warn(`[ECR] Codice risposta sconosciuto: '${msgCode}', payload grezzo: ${payload}`);
  return { ok: false, error: `Codice risposta sconosciuto: '${msgCode}'`, rawPayload: payload };
}

// ---------------------------------------------------------------------------
// Comunicazione TCP con il terminale (con ACK/NAK e retry)
// ---------------------------------------------------------------------------

/**
 * Invia un frame al terminale PAX e attende la risposta applicativa.
 *
 * Flusso:
 *   1. ECR invia frame → Terminale risponde con ACK o NAK
 *   2. Se NAK → ritrasmette (max 3 volte)
 *   3. Terminale elabora ed invia progress updates (SOH...EOT) → ignorati
 *   4. Terminale invia risposta applicativa (STX...ETX) → ECR risponde con ACK
 */
function sendToTerminal(message, timeoutMs = RESPONSE_TIMEOUT) {
  return new Promise((resolve, reject) => {
    const socket  = new net.Socket();
    let buf       = Buffer.alloc(0);
    let settled   = false;
    let retries   = 0;
    // 'waiting_ack'      — aspetto ACK/NAK dopo il mio invio
    // 'waiting_response' — aspetto la risposta applicativa del terminale
    let state     = 'waiting_ack';

    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(globalTimer);
      socket.destroy();
      result instanceof Error ? reject(result) : resolve(result);
    };

    const globalTimer = setTimeout(() => {
      finish(new Error(`Timeout: il terminale non ha risposto entro ${Math.round(timeoutMs / 1000)} secondi`));
    }, timeoutMs);

    const sendMsg = () => {
      state = 'waiting_ack';
      socket.write(message);
    };

    socket.setTimeout(CONNECT_TIMEOUT);

    socket.connect(PAX_PORT, PAX_HOST, () => {
      socket.setTimeout(0);
      console.log(`[ECR] Connesso a ${PAX_HOST}:${PAX_PORT} (${message.length} byte)`);
      sendMsg();
    });

    socket.on('data', (chunk) => {
      buf = Buffer.concat([buf, chunk]);

      // Processa tutti i pacchetti completi nel buffer
      let progress = true;
      while (progress && buf.length > 0 && !settled) {
        progress = false;
        const first = buf[0];

        // Progress update: SOH (0x01) + 20 char + EOT (0x04)
        if (first === SOH) {
          if (buf.length >= 22) {
            const msg = buf.slice(1, 21).toString('latin1').trim();
            console.log(`[ECR] Progress: ${msg}`);
            buf = buf.slice(22);
            progress = true;
          }
          continue;
        }

        // ACK dal terminale (conferma ricezione del nostro frame)
        if (first === ACK && state === 'waiting_ack') {
          if (buf.length >= 3) {
            buf = buf.slice(3);
            state = 'waiting_response';
            console.log('[ECR] ACK ricevuto, attendo risposta...');
            progress = true;
          }
          continue;
        }

        // NAK dal terminale (rifiuto del nostro frame)
        if (first === NAK && state === 'waiting_ack') {
          if (buf.length >= 3) {
            buf = buf.slice(3);
            retries++;
            if (retries >= MAX_RETRIES) {
              finish(new Error(`Terminale ha risposto con NAK dopo ${MAX_RETRIES} tentativi`));
              return;
            }
            console.warn(`[ECR] NAK ricevuto, ritento (${retries}/${MAX_RETRIES})`);
            sendMsg();
            progress = true;
          }
          continue;
        }

        // Risposta applicativa: STX + payload + ETX + LRC
        if (first === STX && state === 'waiting_response') {
          const etxIdx = buf.indexOf(ETX, 1);
          if (etxIdx !== -1 && buf.length >= etxIdx + 2) {
            const lrcReceived = buf[etxIdx + 1];
            const lrcExpected = calcLRC([...buf.slice(1, etxIdx), ETX]);
            if (lrcReceived !== lrcExpected) {
              console.warn(`[ECR] LRC errato: ricevuto 0x${lrcReceived.toString(16)}, atteso 0x${lrcExpected.toString(16)}`);
              // Invia NAK e attendi ritrasmissione
              socket.write(buildNak());
              buf = buf.slice(etxIdx + 2);
              progress = true;
              continue;
            }

            const payload = buf.slice(1, etxIdx).toString('latin1');
            buf = buf.slice(etxIdx + 2);

            // Invia ACK al terminale
            socket.write(buildAck());

            finish(parseResponse(payload));
            return;
          }
          continue;
        }

        // Byte inatteso — skip
        console.warn(`[ECR] Byte inatteso 0x${first.toString(16)} in stato '${state}', scartato`);
        buf = buf.slice(1);
        progress = true;
      }
    });

    socket.on('timeout', () => finish(new Error('Timeout di connessione al terminale PAX')));
    socket.on('error',   (err) => finish(err));
    socket.on('close',   () => {
      if (!settled) finish(new Error('Connessione chiusa prima della risposta'));
    });
  });
}

// ---------------------------------------------------------------------------
// Protocollo Custom Big Plus RT
// ---------------------------------------------------------------------------
//
// Frame: [STX][CNT 2 cifre][IDENT 1 char][CMD 4 char + params][CKS 2 cifre][ETX]
//
// - STX  = 0x02
// - CNT  = contatore frame 00-99 (due cifre ASCII decimali)
// - IDENT= tipo pacchetto: 'A' = comando, 'B' = risposta
// - CMD  = 4 caratteri codice comando + parametri separati da FS (0x1C)
// - CKS  = checksum: somma di (CNT + IDENT + CMD) modulo 100, due cifre decimali
// - ETX  = 0x03
//
// Comandi fiscali Custom (da verificare sul manuale Big Plus RT):
// [TODO-CUSTOM] Cercare nel manuale tecnico la sezione "Comandi ECR" o "Protocollo ECR":
//   - Comando apertura scontrino
//   - Comando vendita articolo (nome, prezzo, quantità, IVA)
//   - Comando tipo pagamento (contanti / carta)
//   - Comando chiusura scontrino
//
// I codici qui sotto sono placeholder da sostituire con i valori corretti.

let customFrameCounter = 0;

function nextCustomCnt() {
  const cnt = customFrameCounter % 100;
  customFrameCounter++;
  return String(cnt).padStart(2, '0');
}

/**
 * Calcola il checksum Custom: somma dei byte ASCII di CNT+IDENT+CMD, modulo 100.
 */
function customChecksum(cnt, ident, cmd) {
  const raw = cnt + ident + cmd;
  let sum = 0;
  for (let i = 0; i < raw.length; i++) sum += raw.charCodeAt(i);
  return String(sum % 100).padStart(2, '0');
}

/**
 * Costruisce un frame Custom completo.
 */
function buildCustomFrame(ident, cmd) {
  const cnt = nextCustomCnt();
  const cks = customChecksum(cnt, ident, cmd);
  return Buffer.from(`\x02${cnt}${ident}${cmd}${cks}\x03`, 'latin1');
}

/**
 * Invia un frame alla cassa Custom e attende la risposta.
 */
function sendToCustom(frame, timeoutMs = CUSTOM_TIMEOUT) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let buf      = Buffer.alloc(0);
    let settled  = false;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      result instanceof Error ? reject(result) : resolve(result);
    };

    const timer = setTimeout(() => finish(new Error(`Timeout cassa Custom (${timeoutMs}ms)`)), timeoutMs);

    socket.setTimeout(CONNECT_TIMEOUT);
    socket.connect(CUSTOM_PORT, CUSTOM_HOST, () => {
      socket.setTimeout(0);
      socket.write(frame);
    });

    socket.on('data', (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      // La risposta Custom termina con ETX
      if (buf.includes(0x03)) finish({ raw: buf.toString('latin1'), ok: true });
    });

    socket.on('timeout', () => finish(new Error('Timeout connessione cassa Custom')));
    socket.on('error',   (err) => finish(err));
    socket.on('close',   () => { if (!settled) finish(new Error('Connessione cassa chiusa prima della risposta')); });
  });
}

/**
 * Rapporto X — lettura parziale senza azzeramento (non fiscale).
 * Utile per controllare i totali a metà giornata senza chiudere.
 *
 * [TODO-CUSTOM] Verificare nel manuale Custom Big Plus RT il codice corretto.
 * Il comando è tipicamente nella sezione "Rapporti" del protocollo ECR.
 * Codici comuni (da verificare): X-report potrebbe essere '6300' o 'RPTX'.
 */
async function performXReport() {
  // [TODO-CUSTOM] Sostituire '6300' con il codice X-report corretto dal manuale.
  console.log('[CUSTOM] Avvio Rapporto X...');
  const resp = await sendToCustom(buildCustomFrame('A', '6300'));
  console.log('[CUSTOM] Rapporto X completato:', resp.raw?.substring(0, 60));
  return resp;
}

/**
 * Chiusura Z — chiusura fiscale giornaliera obbligatoria (DM 7/12/2016).
 * Azzera i contatori giornalieri e trasmette i corrispettivi all'AdE.
 * OPERAZIONE IRREVERSIBILE — eseguire una sola volta al giorno, fine serata.
 *
 * [TODO-CUSTOM] Verificare nel manuale Custom Big Plus RT il codice corretto.
 * Sezione del manuale: "Chiusura Fiscale" o "Invio Corrispettivi".
 * Codici comuni (da verificare): Z-report potrebbe essere '6400' o 'RPTZ'.
 */
async function performZReport() {
  // [TODO-CUSTOM] Sostituire '6400' con il codice Z-report corretto dal manuale.
  console.log('[CUSTOM] Avvio Chiusura Z (OPERAZIONE FISCALE IRREVERSIBILE)...');
  const resp = await sendToCustom(buildCustomFrame('A', '6400'));
  console.log('[CUSTOM] Chiusura Z completata:', resp.raw?.substring(0, 60));
  return resp;
}

/**
 * Stampa uno scontrino fiscale sulla cassa Custom Big Plus RT.
 *
 * @param {object} receipt
 * @param {Array}  receipt.items     - Array di { nome, prezzo, quantita, iva }
 * @param {number} receipt.total     - Totale da pagare
 * @param {string} receipt.payment   - 'carta' | 'contanti'
 * @param {string} [receipt.authCode] - Codice autorizzazione carta (facoltativo)
 */
async function printFiscalReceipt(receipt) {
  const { items = [], total, payment = 'carta', authCode } = receipt;

  // [TODO-CUSTOM] Sostituire i codici comando con quelli corretti dal manuale Big Plus RT.
  // Il manuale tecnico di Custom si chiama tipicamente "Manuale Programmazione" o
  // "Interfaccia ECR". I comandi fiscali sono nella sezione "Scontrino Fiscale".
  //
  // Sequenza tipica per uno scontrino:
  //   1. Apertura scontrino  (es. comando "3010" o "OPEN")
  //   2. Articolo per riga   (es. comando "3401" con nome;prezzo;qta;iva)
  //   3. Tipo pagamento       (es. comando "3402" con tipo;importo)
  //   4. Chiusura scontrino  (es. comando "3501" o "CLOSE")

  console.log(`[CUSTOM] Stampa scontrino: ${items.length} articoli, totale €${total.toFixed(2)}, pagamento ${payment}`);

  // --- Apertura scontrino ---
  // [TODO-CUSTOM] Sostituire '3010' con il codice apertura corretto
  await sendToCustom(buildCustomFrame('A', '3010'));

  // --- Articoli ---
  for (const item of items) {
    const nome     = String(item.nome     || 'Articolo').substring(0, 32).padEnd(32, ' ');
    const prezzo   = Math.round((item.prezzo   || 0) * 100); // in centesimi
    const quantita = Math.round((item.quantita || 1) * 1000); // in millesimi
    const iva      = String(item.iva || '10');   // aliquota IVA % — [TODO-CUSTOM] verificare formato

    // [TODO-CUSTOM] Verificare formato esatto parametri articolo (separatore, ordine campi)
    const cmdArticolo = `3401${nome}\x1C${prezzo}\x1C${quantita}\x1C${iva}`;
    await sendToCustom(buildCustomFrame('A', cmdArticolo));
  }

  // --- Pagamento ---
  const paymentCode = payment === 'carta' ? '1' : '0'; // [TODO-CUSTOM] verificare codici pagamento Custom
  const totalCents  = Math.round(total * 100);
  const cmdPagamento = `3402${paymentCode}\x1C${totalCents}`;
  if (authCode) {
    // [TODO-CUSTOM] verificare se e come passare il codice auth carta alla cassa
    console.log(`[CUSTOM] Auth code carta: ${authCode}`);
  }
  await sendToCustom(buildCustomFrame('A', cmdPagamento));

  // --- Chiusura scontrino ---
  // [TODO-CUSTOM] Sostituire '3501' con il codice chiusura corretto
  await sendToCustom(buildCustomFrame('A', '3501'));

  console.log('[CUSTOM] Scontrino stampato con successo');
}

// ---------------------------------------------------------------------------
// Stato transazione corrente
// ---------------------------------------------------------------------------

let currentTx = null; // { id, amount, startedAt }

// ---------------------------------------------------------------------------
// HTTP Server
// ---------------------------------------------------------------------------

function jsonResponse(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 50_000) req.destroy(); });
    req.on('end',  () => {
      try { resolve(JSON.parse(body || '{}')); }
      catch { resolve({}); }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }

  const url      = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);
  const pathname = url.pathname;

  // GET /health
  if (req.method === 'GET' && pathname === '/health') {
    return jsonResponse(res, 200, {
      ok:      true,
      paxHost: PAX_HOST,
      paxPort: PAX_PORT,
      busy:    !!currentTx,
    });
  }

  // GET /status — verifica connettività terminale
  if (req.method === 'GET' && pathname === '/status') {
    try {
      const msg    = buildStatusRequest();
      const result = await sendToTerminal(msg, 5000);
      return jsonResponse(res, 200, { ok: true, terminal: result });
    } catch (err) {
      console.error('[ECR] Status check fallito:', err.message);
      return jsonResponse(res, 503, { ok: false, error: err.message });
    }
  }

  // POST /pay — avvia pagamento
  if (req.method === 'POST' && pathname === '/pay') {
    if (currentTx) {
      return jsonResponse(res, 409, {
        ok:    false,
        error: `Transazione in corso (${currentTx.id}). Attendere il completamento.`,
      });
    }

    const body        = await readBody(req);
    const rawAmount   = parseFloat(body.amount);
    const partNumber  = body.partNumber  || null;
    const totalParts  = body.totalParts  || null;
    const description = body.description || null;

    if (!rawAmount || isNaN(rawAmount) || rawAmount <= 0) {
      return jsonResponse(res, 400, { ok: false, error: 'Importo non valido o mancante' });
    }

    const amountCents = Math.round(rawAmount * 100);
    const txId        = `TX-${Date.now()}`;

    currentTx = { id: txId, amount: amountCents, startedAt: new Date().toISOString() };

    const partLabel = partNumber && totalParts ? ` [quota ${partNumber}/${totalParts}]` : '';
    console.log(`[ECR] Avvio pagamento ${txId}: €${rawAmount.toFixed(2)}${partLabel}`);

    try {
      const msg    = buildPurchaseRequest(amountCents);
      const result = await sendToTerminal(msg);

      const response = {
        ok:          result.ok,
        txId,
        amount:      rawAmount,
        amountCents,
        authCode:    result.authCode,
        responseCode: result.responseCode,
        description,
        partNumber,
        totalParts,
        completedAt: new Date().toISOString(),
        error:       result.error,
      };

      console.log(`[ECR] ${txId}: ${result.ok ? 'APPROVATO' : 'RIFIUTATO'} (codice ${result.responseCode}, auth ${result.authCode})`);
      return jsonResponse(res, result.ok ? 200 : 402, response);
    } catch (err) {
      console.error(`[ECR] Errore ${txId}:`, err.message);
      return jsonResponse(res, 503, {
        ok: false, txId,
        amount: rawAmount, amountCents,
        error: err.message,
      });
    } finally {
      currentTx = null;
    }
  }

  // POST /cancel — storna l'ultima transazione (opzionale)
  if (req.method === 'POST' && pathname === '/cancel') {
    if (currentTx) {
      return jsonResponse(res, 409, { ok: false, error: 'Transazione in corso, impossibile stornare ora' });
    }
    const body  = await readBody(req);
    const txRef = body.txRef || '';
    try {
      const msg    = buildCancelRequest(txRef);
      const result = await sendToTerminal(msg, 15000);
      return jsonResponse(res, result.ok ? 200 : 422, { ok: result.ok, ...result });
    } catch (err) {
      return jsonResponse(res, 503, { ok: false, error: err.message });
    }
  }

  // GET /x-report — rapporto X (lettura senza azzeramento)
  if (req.method === 'GET' && pathname === '/x-report') {
    try {
      const result = await performXReport();
      return jsonResponse(res, 200, { ok: true, raw: result.raw });
    } catch (err) {
      console.error('[CUSTOM] Errore Rapporto X:', err.message);
      return jsonResponse(res, 503, { ok: false, error: err.message });
    }
  }

  // POST /z-report — chiusura Z fiscale (irreversibile, una volta al giorno)
  if (req.method === 'POST' && pathname === '/z-report') {
    if (currentTx) {
      return jsonResponse(res, 409, { ok: false, error: 'Transazione carta in corso. Attendere il completamento prima di eseguire la Chiusura Z.' });
    }
    console.warn('[CUSTOM] *** CHIUSURA Z RICHIESTA — operazione fiscale irreversibile ***');
    try {
      const result = await performZReport();
      const ts = new Date().toISOString();
      console.log(`[CUSTOM] Chiusura Z eseguita alle ${ts}`);
      return jsonResponse(res, 200, { ok: true, raw: result.raw, executedAt: ts });
    } catch (err) {
      console.error('[CUSTOM] Errore Chiusura Z:', err.message);
      return jsonResponse(res, 503, { ok: false, error: err.message });
    }
  }

  // POST /print-receipt — stampa scontrino fiscale sulla cassa Custom
  if (req.method === 'POST' && pathname === '/print-receipt') {
    const body = await readBody(req);
    const { items, total, payment, authCode } = body;

    if (!total || isNaN(parseFloat(total)) || parseFloat(total) <= 0) {
      return jsonResponse(res, 400, { ok: false, error: 'Totale mancante o non valido' });
    }

    try {
      await printFiscalReceipt({
        items:    items    || [],
        total:    parseFloat(total),
        payment:  payment  || 'carta',
        authCode: authCode || null,
      });
      return jsonResponse(res, 200, { ok: true });
    } catch (err) {
      console.error('[CUSTOM] Errore stampa scontrino:', err.message);
      return jsonResponse(res, 503, { ok: false, error: err.message });
    }
  }

  res.statusCode = 404;
  res.end('Not found');
});

server.listen(SERVER_PORT, '0.0.0.0', () => {
  console.log('=== ECR Agent Avviato ===');
  console.log(`HTTP bridge su :${SERVER_PORT}`);
  console.log(`Terminale PAX A35: ${PAX_HOST}:${PAX_PORT}`);
  console.log('Endpoints: GET /health  GET /status  POST /pay  POST /cancel');
});

process.on('SIGINT', () => {
  if (currentTx) {
    console.warn(`[ATTENZIONE] Transazione ${currentTx.id} in corso durante lo spegnimento!`);
  }
  server.close(() => process.exit(0));
});
