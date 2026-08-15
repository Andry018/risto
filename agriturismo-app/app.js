// ============================================================
// App comande agriturismo — lato telefono/tablet.
// Non stampa direttamente: manda le azioni al server (server.js,
// in esecuzione sul PC collegato alla stampante), che mette il
// lavoro in coda per la pagina stampa.html aperta su quel PC.
// ============================================================

const POLL_MS = 2000;

let state = { menu: {}, tavoli: {} };
let tavoloAttivo = null;
let categoriaAttiva = null;
let editIndex = null;
let modaleApertaCount = 0;

const tavoliLista = document.getElementById('tavoliLista');
const tavoloAttivoLabel = document.getElementById('tavoloAttivoLabel');
const copertiAdultiInput = document.getElementById('copertiAdultiInput');
const copertiBambiniInput = document.getElementById('copertiBambiniInput');
const categorieNav = document.getElementById('categorieNav');
const prodottiGrid = document.getElementById('prodottiGrid');
const carrelloLista = document.getElementById('carrelloLista');
const totaleValore = document.getElementById('totaleValore');
const cucinaBtn = document.getElementById('cucinaBtn');
const contoBtn = document.getElementById('contoBtn');
const chiudiTavoloBtn = document.getElementById('chiudiTavoloBtn');
const connStatus = document.getElementById('connStatus');

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function carrelloAttivo() {
  return tavoloAttivo && state.tavoli[tavoloAttivo] ? state.tavoli[tavoloAttivo].carrello : [];
}

// ---- Comunicazione col server ----
async function apiGet(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Errore server (${res.status})`);
  return res.json();
}
async function apiPost(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Errore server (${res.status})`);
  return data;
}
async function apiPut(url, body) {
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Errore server (${res.status})`);
  return data;
}

async function refreshState() {
  try {
    const nuovo = await apiGet('/api/state');
    state = nuovo;
    setConnStatus(true);
    if (modaleApertaCount === 0) {
      if (!categoriaAttiva || !state.menu[categoriaAttiva]) categoriaAttiva = Object.keys(state.menu)[0];
      renderCategorie();
      renderProdotti();
      renderTavoli();
      renderCarrello();
    } else {
      renderTavoli();
    }
  } catch (e) {
    setConnStatus(false);
  }
}

function setConnStatus(ok) {
  connStatus.textContent = ok ? 'Connesso' : 'Connessione persa — riprovo...';
  connStatus.className = 'conn-status' + (ok ? '' : ' conn-error');
}

async function syncTavoloCorrente() {
  if (!tavoloAttivo) return;
  const info = state.tavoli[tavoloAttivo];
  try {
    await apiPost(`/api/tavoli/${encodeURIComponent(tavoloAttivo)}/sync`, {
      adulti: info.adulti,
      bambini: info.bambini,
      carrello: info.carrello,
    });
  } catch (e) {
    mostraToast(`Non sincronizzato: ${e.message}`);
  }
}

// ---- Tavoli ----
function renderTavoli() {
  tavoliLista.innerHTML = '';
  Object.keys(state.tavoli).forEach((nome) => {
    const info = state.tavoli[nome];
    const totale = info.carrello.reduce((s, i) => s + i.prezzo * i.quantity, 0);
    const occupato = info.carrello.length > 0;
    const card = document.createElement('div');
    card.className = 'tavolo-card' + (occupato ? ' occupato' : '') + (nome === tavoloAttivo ? ' attivo' : '');
    card.innerHTML = `<span class="nome-tavolo">${escapeHtml(nome)}</span><span class="totale-tavolo">${occupato ? '€' + totale.toFixed(2) : 'libero'}</span>`;
    card.onclick = () => selezionaTavolo(nome);
    tavoliLista.appendChild(card);
  });
}

function selezionaTavolo(nome) {
  tavoloAttivo = nome;
  tavoloAttivoLabel.textContent = nome;
  copertiAdultiInput.disabled = false;
  copertiBambiniInput.disabled = false;
  copertiAdultiInput.value = state.tavoli[nome].adulti || 0;
  copertiBambiniInput.value = state.tavoli[nome].bambini || 0;
  renderTavoli();
  renderCarrello();
}

document.getElementById('aggiungiTavoloBtn').onclick = async () => {
  const input = document.getElementById('nuovoTavoloInput');
  const nome = input.value.trim();
  if (!nome) return;
  try {
    await apiPost('/api/tavoli', { nome });
    input.value = '';
    await refreshState();
    selezionaTavolo(nome);
  } catch (e) {
    alert(e.message);
  }
};

copertiAdultiInput.onchange = () => {
  if (!tavoloAttivo) return;
  state.tavoli[tavoloAttivo].adulti = Number(copertiAdultiInput.value || 0);
  syncTavoloCorrente();
};
copertiBambiniInput.onchange = () => {
  if (!tavoloAttivo) return;
  state.tavoli[tavoloAttivo].bambini = Number(copertiBambiniInput.value || 0);
  syncTavoloCorrente();
};

// ---- Menu / categorie ----
function renderCategorie() {
  categorieNav.innerHTML = '';
  Object.keys(state.menu).forEach((cat) => {
    const btn = document.createElement('button');
    btn.textContent = cat;
    if (cat === categoriaAttiva) btn.classList.add('active');
    btn.onclick = () => { categoriaAttiva = cat; renderCategorie(); renderProdotti(); };
    categorieNav.appendChild(btn);
  });
}

function renderProdotti() {
  prodottiGrid.innerHTML = '';
  (state.menu[categoriaAttiva] || []).forEach((prod) => {
    const card = document.createElement('div');
    card.className = 'prodotto-card';
    card.innerHTML = `<div class="nome">${escapeHtml(prod.nome)}</div><div class="prezzo">€${prod.prezzo.toFixed(2)}</div>`;
    card.onclick = () => aggiungiAlCarrello(prod);
    prodottiGrid.appendChild(card);
  });
}

function aggiungiAlCarrello(prod) {
  if (!tavoloAttivo) { alert('Seleziona prima un tavolo.'); return; }
  const carrello = carrelloAttivo();
  const esistente = carrello.find((i) => i.nome === prod.nome && !i.note);
  if (esistente) {
    esistente.quantity += 1;
  } else {
    carrello.push({ id: uid(), nome: prod.nome, prezzo: prod.prezzo, cucina: prod.cucina, quantity: 1, sentQty: 0, portata: '1', note: '' });
  }
  renderCarrello();
  renderTavoli();
  syncTavoloCorrente();
}

function renderCarrello() {
  carrelloLista.innerHTML = '';
  const carrello = carrelloAttivo();
  carrello.forEach((item, idx) => {
    const div = document.createElement('div');
    div.className = 'carrello-item';
    const daInviare = item.cucina && item.quantity > (item.sentQty || 0);
    div.innerHTML = `
      <div class="carrello-item-top">
        <div class="carrello-item-nome">${escapeHtml(item.nome)}${daInviare ? ' 🔸' : ''}</div>
        <div class="carrello-item-qty">
          <button data-act="dec">−</button>
          <span>${item.quantity}</span>
          <button data-act="inc">+</button>
        </div>
        <button class="remove-item" data-act="del">✕</button>
      </div>
      <div class="carrello-item-meta">
        <span>€${(item.prezzo * item.quantity).toFixed(2)} · ${item.portata}ª uscita</span>
        <button data-act="note">Note/uscita</button>
      </div>
      ${item.note ? `<div class="carrello-item-nota">Nota: ${escapeHtml(item.note)}</div>` : ''}
    `;
    div.querySelector('[data-act="inc"]').onclick = () => { item.quantity += 1; renderCarrello(); renderTavoli(); syncTavoloCorrente(); };
    div.querySelector('[data-act="dec"]').onclick = () => {
      item.quantity -= 1;
      if (item.quantity <= 0) carrello.splice(idx, 1);
      renderCarrello(); renderTavoli(); syncTavoloCorrente();
    };
    div.querySelector('[data-act="del"]').onclick = () => { carrello.splice(idx, 1); renderCarrello(); renderTavoli(); syncTavoloCorrente(); };
    div.querySelector('[data-act="note"]').onclick = () => apriModaleNote(idx);
    carrelloLista.appendChild(div);
  });

  const totale = carrello.reduce((s, i) => s + i.prezzo * i.quantity, 0);
  totaleValore.textContent = `€${totale.toFixed(2)}`;
  const haVoci = carrello.length > 0;
  cucinaBtn.disabled = !haVoci;
  contoBtn.disabled = !haVoci;
  chiudiTavoloBtn.disabled = !tavoloAttivo || !haVoci;
}

// ---- Modale note/portata ----
const noteModal = document.getElementById('noteModal');
const noteModalTitle = document.getElementById('noteModalTitle');
const notePortata = document.getElementById('notePortata');
const noteText = document.getElementById('noteText');

function apriModaleNote(idx) {
  editIndex = idx;
  const item = carrelloAttivo()[idx];
  noteModalTitle.textContent = item.nome;
  notePortata.value = item.portata;
  noteText.value = item.note;
  apriModale(noteModal);
}

document.getElementById('noteAnnulla').onclick = () => chiudiModale(noteModal);
document.getElementById('noteSalva').onclick = () => {
  if (editIndex !== null) {
    const item = carrelloAttivo()[editIndex];
    item.portata = notePortata.value;
    item.note = noteText.value.trim();
    syncTavoloCorrente();
  }
  chiudiModale(noteModal);
  renderCarrello();
};

function apriModale(el) { modaleApertaCount += 1; el.classList.remove('hidden'); }
function chiudiModale(el) { modaleApertaCount = Math.max(0, modaleApertaCount - 1); el.classList.add('hidden'); }

// ---- Chiudi tavolo (dopo pagamento) ----
chiudiTavoloBtn.onclick = async () => {
  if (!tavoloAttivo) return;
  if (!confirm(`Chiudere ${tavoloAttivo}? La comanda verrà svuotata.`)) return;
  try {
    await apiPost(`/api/tavoli/${encodeURIComponent(tavoloAttivo)}/chiudi`, {});
    await refreshState();
    selezionaTavolo(tavoloAttivo);
  } catch (e) {
    alert(e.message);
  }
};

// ---- Manda in cucina ----
cucinaBtn.onclick = async () => {
  if (!tavoloAttivo) return;
  const info = state.tavoli[tavoloAttivo];
  try {
    const risposta = await apiPost(`/api/tavoli/${encodeURIComponent(tavoloAttivo)}/cucina`, {
      adulti: info.adulti,
      bambini: info.bambini,
      carrello: info.carrello,
    });
    if (risposta.ok) {
      mostraToast(`Comanda inviata in cucina per ${tavoloAttivo}`);
    } else {
      mostraToast(risposta.error || 'Niente da mandare in cucina.');
    }
    await refreshState();
    if (tavoloAttivo) selezionaTavolo(tavoloAttivo);
  } catch (e) {
    alert(e.message);
  }
};

// ---- Stampa conto ----
contoBtn.onclick = async () => {
  if (!tavoloAttivo) return;
  const info = state.tavoli[tavoloAttivo];
  try {
    const risposta = await apiPost(`/api/tavoli/${encodeURIComponent(tavoloAttivo)}/conto`, {
      adulti: info.adulti,
      bambini: info.bambini,
      carrello: info.carrello,
    });
    if (risposta.ok) {
      mostraToast(`Conto inviato in stampa per ${tavoloAttivo}`);
    } else {
      mostraToast(risposta.error || 'Impossibile stampare il conto.');
    }
  } catch (e) {
    alert(e.message);
  }
};

function mostraToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.remove('hidden');
  clearTimeout(mostraToast._t);
  mostraToast._t = setTimeout(() => toast.classList.add('hidden'), 3000);
}

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ============================================================
// Modifica menù
// ============================================================
const menuEditModal = document.getElementById('menuEditModal');
const menuEditContent = document.getElementById('menuEditContent');

document.getElementById('modificaMenuBtn').onclick = () => {
  renderMenuEdit();
  apriModale(menuEditModal);
};
document.getElementById('chiudiMenuEditBtn').onclick = () => {
  chiudiModale(menuEditModal);
  refreshState();
};
document.getElementById('ripristinaMenuBtn').onclick = async () => {
  if (!confirm('Ripristinare il menù ai valori di default? Le modifiche fatte finora andranno perse.')) return;
  try {
    await apiPost('/api/menu/reset', {});
    const nuovo = await apiGet('/api/state');
    state = nuovo;
    renderMenuEdit();
  } catch (e) {
    alert(e.message);
  }
};
document.getElementById('aggiungiCategoriaBtn').onclick = async () => {
  const input = document.getElementById('nuovaCategoriaInput');
  const nome = input.value.trim();
  if (!nome) return;
  if (state.menu[nome]) { alert('Categoria già esistente.'); return; }
  state.menu[nome] = [];
  input.value = '';
  await salvaMenu();
  renderMenuEdit();
};

async function salvaMenu() {
  try {
    await apiPut('/api/menu', { menu: state.menu });
  } catch (e) {
    mostraToast(`Menù non salvato: ${e.message}`);
  }
}

function renderMenuEdit() {
  menuEditContent.innerHTML = '';
  Object.keys(state.menu).forEach((cat) => {
    const catBox = document.createElement('div');
    catBox.className = 'menu-edit-categoria';

    const header = document.createElement('div');
    header.className = 'menu-edit-categoria-header';
    const catInput = document.createElement('input');
    catInput.type = 'text';
    catInput.value = cat;
    catInput.onchange = () => rinominaCategoria(cat, catInput.value.trim());
    const delCatBtn = document.createElement('button');
    delCatBtn.className = 'menu-edit-del-cat';
    delCatBtn.textContent = 'Elimina categoria';
    delCatBtn.onclick = async () => {
      if (!confirm(`Eliminare la categoria "${cat}" e tutti i suoi piatti?`)) return;
      delete state.menu[cat];
      await salvaMenu();
      renderMenuEdit();
    };
    header.appendChild(catInput);
    header.appendChild(delCatBtn);
    catBox.appendChild(header);

    state.menu[cat].forEach((prod, idx) => {
      const riga = document.createElement('div');
      riga.className = 'menu-edit-riga';

      const nomeInput = document.createElement('input');
      nomeInput.type = 'text';
      nomeInput.value = prod.nome;
      nomeInput.placeholder = 'Nome piatto';
      nomeInput.onchange = () => { prod.nome = nomeInput.value.trim() || prod.nome; salvaMenu(); };

      const prezzoInput = document.createElement('input');
      prezzoInput.type = 'number';
      prezzoInput.step = '0.5';
      prezzoInput.min = '0';
      prezzoInput.value = prod.prezzo;
      prezzoInput.onchange = () => { prod.prezzo = Number(prezzoInput.value || 0); salvaMenu(); };

      const cucinaLabel = document.createElement('label');
      const cucinaCheck = document.createElement('input');
      cucinaCheck.type = 'checkbox';
      cucinaCheck.checked = !!prod.cucina;
      cucinaCheck.onchange = () => { prod.cucina = cucinaCheck.checked; salvaMenu(); };
      cucinaLabel.appendChild(cucinaCheck);
      cucinaLabel.appendChild(document.createTextNode('cucina'));

      const delBtn = document.createElement('button');
      delBtn.textContent = '✕';
      delBtn.onclick = async () => {
        state.menu[cat].splice(idx, 1);
        await salvaMenu();
        renderMenuEdit();
      };

      riga.appendChild(nomeInput);
      riga.appendChild(prezzoInput);
      riga.appendChild(cucinaLabel);
      riga.appendChild(delBtn);
      catBox.appendChild(riga);
    });

    const addRigaBtn = document.createElement('button');
    addRigaBtn.className = 'menu-edit-add-riga';
    addRigaBtn.textContent = '+ Aggiungi piatto';
    addRigaBtn.onclick = async () => {
      state.menu[cat].push({ nome: 'Nuovo piatto', prezzo: 0, cucina: true });
      await salvaMenu();
      renderMenuEdit();
    };
    catBox.appendChild(addRigaBtn);

    menuEditContent.appendChild(catBox);
  });
}

async function rinominaCategoria(vecchioNome, nuovoNome) {
  if (!nuovoNome || nuovoNome === vecchioNome) { renderMenuEdit(); return; }
  if (state.menu[nuovoNome]) { alert('Categoria già esistente.'); renderMenuEdit(); return; }
  const nuovoMenu = {};
  Object.keys(state.menu).forEach((k) => {
    nuovoMenu[k === vecchioNome ? nuovoNome : k] = state.menu[k];
  });
  state.menu = nuovoMenu;
  if (categoriaAttiva === vecchioNome) categoriaAttiva = nuovoNome;
  await salvaMenu();
  renderMenuEdit();
}

// ---- Init ----
refreshState();
setInterval(refreshState, POLL_MS);
