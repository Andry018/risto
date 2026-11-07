/**
 * Immagini per il Kindle (plugin KOReader "Menu Girasole", vedi /kindle nel repo).
 *
 *   GET /kindle/menu.png   menu del giorno (solo piatti disponibili), scala di grigi, a misura di schermo
 *   GET /kindle/logo.png   logo per lo standby (nero su bianco)
 *
 * Parametri menu.png: w, h (default 1072×1448, Kindle 11ª gen), cat=Primi,Secondi (solo queste categorie),
 * ingr=0 (niente ingredienti), prezzi=0 (niente prezzi), page=N (se il menu non sta in una pagina).
 * Risposta: header X-Pages (numero di pagine) ed ETag: il plugin ridisegna lo schermo solo se cambia.
 *
 * Il testo è disegnato con i font DejaVu inclusi nel pacchetto npm `dejavu-fonts-ttf` (niente font di
 * sistema richiesti sul server) e le larghezze sono misurate leggendo le metriche dei file TTF.
 * Le dipendenze (@resvg/resvg-js, dejavu-fonts-ttf) stanno in asporto-app/package.json: il print agent
 * le trova risalendo a asporto-app/node_modules, installato in automatico da autopull.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const CATEGORY_ORDER = ['Antipasti', 'Fritti', 'Primi', 'Secondi', 'Contorni', 'Pizze Rosse', 'Pizze Bianche', 'Pizze Speciali', 'Dolci', 'Caffè e Liquori', 'Bevande'];
const HIDDEN = new Set(['EXTRA', 'Servizio']);
// Testi in inglese (i nomi dei piatti restano in italiano, come nei menu veri)
const EN = {
  title: "TODAY'S MENU",
  page: (n, tot) => `page ${n} of ${tot}`,
  empty: 'No dishes available right now',
  days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  cats: {
    'Antipasti': 'Starters', 'Fritti': 'Fried', 'Primi': 'First courses', 'Secondi': 'Main courses',
    'Contorni': 'Side dishes', 'Pizze Rosse': 'Red pizzas', 'Pizze Bianche': 'White pizzas',
    'Pizze Speciali': 'Special pizzas', 'Dolci': 'Desserts', 'Caffè e Liquori': 'Coffee & liqueurs', 'Bevande': 'Drinks',
  },
};
const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const GIORNI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];

// ---------------------------------------------------------------------------------------------
// Font e misura del testo (metriche TTF: cmap formato 4 + hmtx)
// ---------------------------------------------------------------------------------------------
const FONT_DIR = path.join(path.dirname(require.resolve('dejavu-fonts-ttf/package.json')), 'ttf');
const FONT_FILES = {
  regular: path.join(FONT_DIR, 'DejaVuSerif.ttf'),
  bold: path.join(FONT_DIR, 'DejaVuSerif-Bold.ttf'),
  italic: path.join(FONT_DIR, 'DejaVuSerif-Italic.ttf'),
};

function parseTtfMetrics(file) {
  const b = fs.readFileSync(file);
  const numTables = b.readUInt16BE(4);
  const tables = {};
  for (let i = 0; i < numTables; i++) {
    const o = 12 + i * 16;
    tables[b.toString('ascii', o, o + 4)] = b.readUInt32BE(o + 8);
  }
  const unitsPerEm = b.readUInt16BE(tables.head + 18);
  const numHMetrics = b.readUInt16BE(tables.hhea + 34);
  const advances = [];
  for (let i = 0; i < numHMetrics; i++) advances.push(b.readUInt16BE(tables.hmtx + i * 4));
  // cmap: sottotabella Windows Unicode BMP (3,1) formato 4
  const cmap = tables.cmap;
  const n = b.readUInt16BE(cmap + 2);
  let sub = -1;
  for (let i = 0; i < n; i++) {
    const o = cmap + 4 + i * 8;
    if (b.readUInt16BE(o) === 3 && b.readUInt16BE(o + 2) === 1) sub = cmap + b.readUInt32BE(o + 4);
  }
  const glyphOf = new Map();
  if (sub >= 0 && b.readUInt16BE(sub) === 4) {
    const segX2 = b.readUInt16BE(sub + 6);
    const ends = sub + 14, starts = ends + segX2 + 2, deltas = starts + segX2, ranges = deltas + segX2;
    for (let s = 0; s < segX2 / 2; s++) {
      const end = b.readUInt16BE(ends + s * 2), start = b.readUInt16BE(starts + s * 2);
      const delta = b.readInt16BE(deltas + s * 2), rangeOff = b.readUInt16BE(ranges + s * 2);
      if (start === 0xffff) continue;
      for (let c = start; c <= end && c < 0x2200; c++) { // basta l'alfabeto latino + simboli comuni
        let g;
        if (rangeOff === 0) g = (c + delta) & 0xffff;
        else {
          g = b.readUInt16BE(ranges + s * 2 + rangeOff + (c - start) * 2);
          if (g !== 0) g = (g + delta) & 0xffff;
        }
        glyphOf.set(c, g);
      }
    }
  }
  return { unitsPerEm, advance: (cp) => {
    const g = glyphOf.get(cp) ?? 0;
    return advances[Math.min(g, advances.length - 1)];
  } };
}

let metrics = null;
function textWidth(text, size, style = 'regular') {
  if (!metrics) metrics = Object.fromEntries(Object.entries(FONT_FILES).map(([k, f]) => [k, parseTtfMetrics(f)]));
  const m = metrics[style];
  let units = 0;
  for (const ch of String(text)) units += m.advance(ch.codePointAt(0));
  return (units / m.unitsPerEm) * size;
}

/** Spezza il testo in righe che stanno in maxWidth (a parole; una parola troppo lunga va da sola). */
function wrap(text, size, style, maxWidth) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (cur && textWidth(next, size, style) > maxWidth) { lines.push(cur); cur = w; } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const euro = (n) => `€ ${Number(n || 0).toFixed(2).replace('.', ',')}`;
const orderOf = (cat) => { const i = CATEGORY_ORDER.indexOf(cat); return i < 0 ? 100 : i; };

// ---------------------------------------------------------------------------------------------
// Impaginazione
// ---------------------------------------------------------------------------------------------
function groupProducts(products, opts) {
  const only = opts.cat ? new Set(opts.cat.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)) : null;
  const groups = new Map();
  for (const p of products) {
    if (!p || p.disponibile === false) continue;
    const cat = p.categoria || 'Altro';
    if (HIDDEN.has(cat)) continue;
    if (only && !only.has(cat.toLowerCase())) continue;
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat).push(p);
  }
  return [...groups.keys()]
    .sort((a, b) => orderOf(a) - orderOf(b) || a.localeCompare(b, 'it'))
    .map(cat => ({ cat, items: groups.get(cat).sort((a, b) => a.nome.localeCompare(b.nome, 'it')) }));
}

/**
 * Trasforma il menu in blocchi (titolo categoria, sottotitolo, piatto) con altezza e righe già calcolate
 * per una certa dimensione del testo e larghezza di colonna.
 */
function buildBlocks(groups, size, colW, opts) {
  const blocks = [];
  const lineH = size * 1.22;
  const ingrSize = Math.round(size * 0.74);
  const ingrLineH = ingrSize * 1.25;
  for (const { cat, items } of groups) {
    const catSize = Math.round(size * 1.08);
    const label = opts.lang === 'en' ? (EN.cats[cat] || cat) : cat;
    blocks.push({ type: 'cat', text: label.toUpperCase(), size: catSize, h: catSize * 1.9, keepWithNext: true });
    const hasSub = items.some(p => p.sottocategoria);
    const subs = hasSub ? [...new Set(items.map(p => p.sottocategoria || 'Altro'))] : [null];
    for (const sub of subs) {
      if (sub) blocks.push({ type: 'sub', text: sub, size: ingrSize, h: ingrSize * 1.8, keepWithNext: true });
      for (const p of items.filter(x => !sub || (x.sottocategoria || 'Altro') === sub)) {
        const price = opts.prezzi ? euro(p.prezzo) : '';
        const priceW = price ? textWidth(price, size, 'bold') + size * 0.8 : 0;
        const nameLines = wrap(p.nome, size, 'bold', colW - priceW);
        const ingr = opts.ingr && p.ingredienti && p.ingredienti.length ? wrap(p.ingredienti.join(', '), ingrSize, 'italic', colW) : [];
        const h = nameLines.length * lineH + ingr.length * ingrLineH + size * 0.55;
        blocks.push({ type: 'item', nameLines, price, ingr, size, ingrSize, lineH, ingrLineH, h });
      }
    }
  }
  return blocks;
}

/** Distribuisce i blocchi in colonne e pagine. Un titolo non resta mai da solo in fondo a una colonna. */
function flow(blocks, cols, colH) {
  const pages = [];
  let page = [], col = [], used = 0;
  const pushCol = () => { page.push(col); col = []; used = 0; if (page.length === cols) { pages.push(page); page = []; } };
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    let need = b.h;
    if (b.keepWithNext) { // titolo + il primo piatto devono stare insieme
      let j = i + 1;
      while (j < blocks.length && blocks[j].keepWithNext) need += blocks[j++].h;
      if (j < blocks.length) need += blocks[j].h;
    }
    if (used > 0 && used + need > colH) pushCol();
    col.push(b);
    used += b.h;
  }
  if (col.length) pushCol();
  if (page.length) pages.push(page);
  return pages;
}

function layout(groups, W, H, opts) {
  const margin = Math.round(W * 0.045);
  const headerH = Math.round(H * 0.085);
  const bodyTop = margin + headerH;
  const bodyH = H - bodyTop - margin;
  const gap = Math.round(W * 0.04);
  const tryLayout = (cols, baseSize) => {
    const size = Math.round(baseSize * (W / 1072));
    const colW = (W - margin * 2 - gap * (cols - 1)) / cols;
    return { cols, size, colW, pages: flow(buildBlocks(groups, size, colW, opts), cols, bodyH) };
  };
  // Normale: prima una colonna con testo grande, poi due colonne; la prima che sta in UNA pagina.
  const tries = [];
  for (const s of [40, 36, 33, 30, 28, 26]) tries.push({ cols: 1, size: s });
  for (const s of [30, 28, 26, 24, 22, 20]) tries.push({ cols: 2, size: s });
  let best = null;
  for (const t of tries) {
    best = tryLayout(t.cols, t.size);
    if (best.pages.length <= 1) break;
  }
  // Testo più grande (scelta dal Kindle): la dimensione normale × scala, anche se servono più pagine
  // (girano da sole). Fra una e due colonne tiene quella con meno pagine.
  const k = opts.scale || 1;
  if (k > 1) {
    const target = (best.size / (W / 1072)) * k;
    const one = tryLayout(1, target);
    const two = tryLayout(2, target);
    best = two.pages.length < one.pages.length ? two : one;
  }
  return { ...best, margin, headerH, bodyTop, bodyH, gap, lang: opts.lang };
}

// ---------------------------------------------------------------------------------------------
// SVG
// ---------------------------------------------------------------------------------------------
const FONT = 'DejaVu Serif';

function renderPageSvg(L, pageIndex, W, H, date) {
  const out = [];
  const t = (x, y, text, size, { weight = 'normal', style = 'normal', anchor = 'start', fill = '#000' } = {}) =>
    out.push(`<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" font-style="${style}" text-anchor="${anchor}" fill="${fill}">${esc(text)}</text>`);

  const m = L.margin;
  const titleSize = Math.round(L.headerH * 0.48);
  t(m, m + titleSize * 0.95, 'Il Girasole', titleSize, { weight: 'bold' });
  const en = L.lang === 'en';
  t(m, m + titleSize * 0.95 + titleSize * 0.62, en ? EN.title : 'MENU DEL GIORNO', Math.round(titleSize * 0.36), { fill: '#333' });
  const dateText = en
    ? `${EN.days[date.getDay()]} ${date.getDate()} ${EN.months[date.getMonth()]}`
    : `${GIORNI[date.getDay()]} ${date.getDate()} ${MESI[date.getMonth()]}`;
  t(W - m, m + titleSize * 0.95, dateText, Math.round(titleSize * 0.42), { anchor: 'end' });
  if (L.pages.length > 1) t(W - m, m + titleSize * 0.95 + titleSize * 0.62, (en ? EN.page(pageIndex + 1, L.pages.length) : `pagina ${pageIndex + 1} di ${L.pages.length}`), Math.round(titleSize * 0.32), { anchor: 'end', fill: '#333' });
  out.push(`<rect x="${m}" y="${L.bodyTop - L.headerH * 0.22}" width="${W - m * 2}" height="4" fill="#000"/>`);

  const page = L.pages[pageIndex] || [];
  page.forEach((col, ci) => {
    const x0 = m + ci * (L.colW + L.gap);
    let y = L.bodyTop;
    for (const b of col) {
      if (b.type === 'cat') {
        t(x0, y + b.size * 1.25, b.text, b.size, { weight: 'bold' });
        out.push(`<rect x="${x0}" y="${(y + b.size * 1.5).toFixed(1)}" width="${L.colW.toFixed(1)}" height="2" fill="#000"/>`);
      } else if (b.type === 'sub') {
        t(x0, y + b.size * 1.35, b.text.toUpperCase(), b.size, { style: 'italic', fill: '#222' });
      } else {
        // baseline della riga corrente
        let baseline = y + b.size;
        b.nameLines.forEach((line, i) => {
          if (i > 0) baseline += b.lineH;
          t(x0, baseline, line, b.size, { weight: 'bold' });
          if (i === 0 && b.price) t(x0 + L.colW, baseline, b.price, b.size, { weight: 'bold', anchor: 'end' });
        });
        for (const line of b.ingr) {
          baseline += b.ingrLineH;
          t(x0, baseline, line, b.ingrSize, { style: 'italic', fill: '#222' });
        }
      }
      y += b.h;
    }
  });
  if (!page.length) t(W / 2, H / 2, en ? EN.empty : 'Nessun piatto disponibile al momento', Math.round(W / 30), { anchor: 'middle' });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="100%" height="100%" fill="#fff"/>${out.join('')}</svg>`;
}

function svgToPng(svg) {
  const { Resvg } = require('@resvg/resvg-js');
  const r = new Resvg(svg, {
    font: { fontFiles: Object.values(FONT_FILES), loadSystemFonts: false, defaultFontFamily: FONT },
    background: '#ffffff',
  });
  return r.render().asPng();
}

// ---------------------------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------------------------
const cache = new Map(); // chiave → { png, pages, etag }

function renderMenuPng(products, query = {}, date = new Date()) {
  const W = Math.min(2000, Math.max(300, Number(query.w) || 1072));
  const H = Math.min(3000, Math.max(300, Number(query.h) || 1448));
  const scale = Math.min(1.6, Math.max(1, Number(query.zoom) || 1));
  const opts = { cat: query.cat || '', ingr: query.ingr !== '0', prezzi: query.prezzi !== '0', scale, lang: query.lang === 'en' ? 'en' : 'it' };
  const groups = groupProducts(products, opts);
  const dayKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  const key = crypto.createHash('sha1').update(JSON.stringify([groups, W, H, opts, dayKey, query.page || 1])).digest('hex');
  if (cache.has(key)) return cache.get(key);

  const L = layout(groups, W, H, opts);
  const pageIndex = Math.min(Math.max(0, (Number(query.page) || 1) - 1), Math.max(0, L.pages.length - 1));
  const png = svgToPng(renderPageSvg(L, pageIndex, W, H, date));
  const result = { png, pages: Math.max(1, L.pages.length), etag: `"${key.slice(0, 16)}"` };
  if (cache.size > 20) cache.delete(cache.keys().next().value);
  cache.set(key, result);
  return result;
}

let logoCache = null;
function renderLogoPng(query = {}) {
  const W = Math.min(2000, Math.max(300, Number(query.w) || 1072));
  const H = Math.min(3000, Math.max(300, Number(query.h) || 1448));
  const k = `${W}x${H}`;
  if (logoCache && logoCache.k === k) return logoCache;
  const logoPath = path.join(__dirname, '..', 'public', 'IlGirasole-1.png');
  const data = fs.readFileSync(logoPath).toString('base64');
  // Il PNG è 5334×3000 (giallo su bordeaux): ritaglio la parte centrale (girasole + scritta) e la porto
  // in scala di grigi invertita con contrasto alto → logo nero su bianco, leggibile sull'e-ink.
  const crop = { x: 1550, y: 380, w: 2240, h: 2130 };
  const boxW = W * 0.86;
  const boxH = boxW * (crop.h / crop.w);
  const x = (W - boxW) / 2, y = (H - boxH) / 2 - H * 0.03;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs><filter id="ink" color-interpolation-filters="sRGB">
    <feColorMatrix type="matrix" values="-0.299 -0.587 -0.114 0 1  -0.299 -0.587 -0.114 0 1  -0.299 -0.587 -0.114 0 1  0 0 0 1 0"/>
    <feComponentTransfer><feFuncR type="linear" slope="2.4" intercept="-0.75"/><feFuncG type="linear" slope="2.4" intercept="-0.75"/><feFuncB type="linear" slope="2.4" intercept="-0.75"/></feComponentTransfer>
  </filter></defs>
  <rect width="100%" height="100%" fill="#fff"/>
  <svg x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${boxW.toFixed(1)}" height="${boxH.toFixed(1)}" viewBox="${crop.x} ${crop.y} ${crop.w} ${crop.h}">
    <image width="5334" height="3000" xlink:href="data:image/png;base64,${data}" filter="url(#ink)"/>
  </svg>
</svg>`;
  logoCache = { k, png: svgToPng(svg), etag: `"logo-${k}"` };
  return logoCache;
}

module.exports = { renderMenuPng, renderLogoPng, textWidth, wrap, groupProducts };
