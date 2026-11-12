/**
 * Comande non stampate: lista d'attesa con nuovi tentativi automatici.
 *
 * La cucina lavora solo sui fogli: se la stampante è spenta, senza carta o col coperchio aperto la
 * comanda non deve sparire. Il print agent la tiene qui (salvata su file, sopravvive a un riavvio)
 * e la ristampa appena la stampante torna pronta. Qualunque dispositivo vede la lista (GET /pending).
 *
 * Si ristampa da soli SOLO se il primo tentativo è fallito prima di mandare dati alla stampante
 * (`safe`): così una comanda non può uscire due volte. Se l'errore è arrivato a stampa iniziata la
 * comanda resta in lista come "da controllare" e si ristampa solo a mano.
 */
const fs = require('node:fs');
const crypto = require('node:crypto');

/** Dopo questo tempo non si riprova più da soli (una comanda di mezz'ora fa potrebbe essere già stata ribattuta). */
const AUTO_RETRY_MAX_AGE_MS = 20 * 60 * 1000;
/** Comande vecchie tolte dalla lista in automatico. */
const KEEP_MAX_AGE_MS = 6 * 60 * 60 * 1000;

/** L'errore è avvenuto prima che un solo byte arrivasse alla stampante? */
function isSafeToRetry(err) {
  return !!err && (err.printerNotReady === true || err.beforeConnect === true);
}

function summarize(job) {
  const items = Array.isArray(job.items) ? job.items : [];
  return items
    .filter(i => i && i.categoria !== 'Servizio')
    .map(i => `${i.quantity || 1}x ${i.nome || i.name || 'Articolo'}`);
}

function createPendingStore({ file, runJob, now = () => Date.now(), log = console }) {
  /** @type {Array<{id:string, createdAt:number, lastTryAt:number, attempts:number, kind:string, label:string, reason:string, auto:boolean, job:object}>} */
  let jobs = [];
  let busy = false;

  try {
    if (file && fs.existsSync(file)) jobs = JSON.parse(fs.readFileSync(file, 'utf8')) || [];
  } catch (e) {
    log.warn('[PENDING] File comande in attesa illeggibile, riparto da zero:', e.message);
    jobs = [];
  }

  function save() {
    if (!file) return;
    try { fs.writeFileSync(file, JSON.stringify(jobs)); }
    catch (e) { log.warn('[PENDING] Impossibile salvare le comande in attesa:', e.message); }
  }

  function add(job, err) {
    const entry = {
      id: crypto.randomUUID(),
      createdAt: now(),
      lastTryAt: now(),
      attempts: 1,
      kind: job.kind,
      label: String(job.tableName || ''),
      reason: String((err && err.message) || err || 'Errore di stampa'),
      auto: isSafeToRetry(err),
      job,
    };
    jobs.push(entry);
    save();
    log.warn(`[PENDING] Comanda ${entry.kind} "${entry.label}" in attesa (${entry.auto ? 'ristampa automatica' : 'da controllare'}): ${entry.reason}`);
    return entry;
  }

  function list() {
    const t = now();
    return jobs.map(j => ({
      id: j.id,
      createdAt: new Date(j.createdAt).toISOString(),
      kind: j.kind,
      label: j.label,
      reason: j.reason,
      attempts: j.attempts,
      auto: j.auto && t - j.createdAt < AUTO_RETRY_MAX_AGE_MS,
      items: summarize(j.job),
    }));
  }

  function remove(id) {
    const before = jobs.length;
    jobs = jobs.filter(j => j.id !== id);
    if (jobs.length !== before) save();
    return jobs.length !== before;
  }

  /** Ristampa una comanda. Ritorna { ok, error? }. Se fallisce resta in lista con il nuovo motivo. */
  async function retry(id) {
    const entry = jobs.find(j => j.id === id);
    if (!entry) return { ok: false, error: 'Comanda non più in lista' };
    entry.attempts += 1;
    entry.lastTryAt = now();
    try {
      await runJob(entry.job);
      remove(id);
      log.log(`[PENDING] Comanda "${entry.label}" stampata al tentativo ${entry.attempts}`);
      return { ok: true };
    } catch (err) {
      entry.reason = String((err && err.message) || err);
      // Fallita a stampa iniziata: da qui in poi solo a mano
      if (!isSafeToRetry(err)) entry.auto = false;
      save();
      return { ok: false, error: entry.reason };
    }
  }

  /** Riprova in ordine (dalla più vecchia) le comande con ristampa automatica; si ferma al primo errore. */
  async function flush() {
    if (busy) return;
    busy = true;
    try {
      const t = now();
      const before = jobs.length;
      jobs = jobs.filter(j => t - j.createdAt < KEEP_MAX_AGE_MS);
      if (jobs.length !== before) save();
      const due = jobs.filter(j => j.auto && t - j.createdAt < AUTO_RETRY_MAX_AGE_MS);
      for (const entry of due) {
        const r = await retry(entry.id);
        if (!r.ok) break; // stampante ancora non pronta: inutile provare le altre adesso
      }
    } finally {
      busy = false;
    }
  }

  return { add, list, remove, retry, flush, get size() { return jobs.length; } };
}

module.exports = { createPendingStore, isSafeToRetry, AUTO_RETRY_MAX_AGE_MS };
