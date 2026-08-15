// ============================================================
// Stazione di stampa — gira sul PC collegato alla stampante.
// Apri questa pagina con Chrome avviato in modalità
// --kiosk-printing (vedi avvia_stampa.bat) così window.print()
// stampa subito sulla stampante predefinita, senza finestre di conferma.
// ============================================================

const POLL_MS = 1200;
const puntino = document.getElementById('puntino');
const ultimaStampa = document.getElementById('ultimaStampa');
const ticketEl = document.getElementById('ticket');

let stampaInCorso = false;

async function ciclo() {
  if (stampaInCorso) return;
  try {
    const res = await fetch('/api/print-queue');
    const jobs = await res.json();
    puntino.className = 'puntino' + (jobs.length ? ' attesa' : '');
    if (jobs.length > 0) {
      await stampaJob(jobs[0]);
    }
  } catch (e) {
    puntino.className = 'puntino attesa';
    ultimaStampa.textContent = 'Impossibile contattare il server. Verifica che node server.js sia avviato.';
  }
}

async function stampaJob(job) {
  stampaInCorso = true;
  try {
    ticketEl.innerHTML = job.kind === 'cucina'
      ? buildTicketCucina(job.tavolo, job.now, job.items)
      : buildTicketConto(job.tavolo, job.adulti, job.bambini, job.now, job.items);

    window.print();

    await fetch(`/api/print-queue/${job.id}/ack`, { method: 'POST' });

    const etichetta = job.kind === 'cucina' ? 'Comanda cucina' : 'Conto';
    ultimaStampa.textContent = `${new Date().toLocaleTimeString('it-IT')} — ${etichetta} stampato per ${job.tavolo}`;
  } catch (e) {
    ultimaStampa.textContent = `Errore di stampa: ${e.message || e}`;
  } finally {
    ticketEl.innerHTML = '';
    stampaInCorso = false;
  }
}

function buildTicketCucina(tavolo, now, items) {
  if (!items || items.length === 0) {
    return `<h1>${escapeHtml(tavolo)}</h1><p style="text-align:center">Nessuna voce per la cucina</p>`;
  }
  const gruppi = raggruppaPerPortata(items);
  let html = `<div class="riga-testata"><span>${escapeHtml(tavolo)}</span><span>${escapeHtml(now)}</span></div>`;
  const labels = { '1': '1ª USCITA', '2': '2ª USCITA', '3': '3ª USCITA' };
  gruppi.forEach(([portata, arr]) => {
    html += `<div class="portata-titolo">[${labels[portata] || portata}]</div>`;
    arr.forEach((item) => {
      html += `<div class="voce">${item.quantity}x ${escapeHtml(item.nome)}</div>`;
      if (item.note) html += `<div class="voce-mod">NOTE: ${escapeHtml(item.note)}</div>`;
    });
    html += '<hr>';
  });
  return html;
}

function buildTicketConto(tavolo, adulti, bambini, now, items) {
  const coperti = [];
  if (adulti) coperti.push(`${adulti} adulti`);
  if (bambini) coperti.push(`${bambini} bambini`);
  let html = `<div class="riga-testata"><span>${escapeHtml(tavolo)}</span><span>${escapeHtml(now)}</span></div>`;
  html += `<div style="text-align:center;font-weight:bold;">CONTO${coperti.length ? ` · ${coperti.join(', ')}` : ''}</div><hr>`;
  let totale = 0;
  (items || []).forEach((item) => {
    const sub = item.prezzo * item.quantity;
    totale += sub;
    html += `<div class="riga-conto"><span>${item.quantity}x ${escapeHtml(item.nome)}</span><span>€${sub.toFixed(2)}</span></div>`;
  });
  html += `<div class="totale-conto"><span>TOTALE</span><span>€${totale.toFixed(2)}</span></div>`;
  return html;
}

function raggruppaPerPortata(items) {
  const map = new Map();
  items.forEach((item) => {
    const key = item.portata || '1';
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  });
  return [...map.entries()].sort(([a], [b]) => Number(a) - Number(b));
}

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

setInterval(ciclo, POLL_MS);
ciclo();
