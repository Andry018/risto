import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package, Plus, Minus, ArrowLeft, Trash2, X, Save,
  Clock, Truck, ScanBarcode, Snowflake, Link2, Search, ShoppingCart, Share2, CheckCircle2,
} from 'lucide-react';
import { stockLevel, buildOrderGroups, orderText, type OrderGroup } from '../lib/magazzinoOrdini';
import type { MagazzinoArticolo, MagazzinoMovimento } from '../types/entities';
import {
  fetchArticoli, fetchFornitoriOptions, addArticolo, updateArticolo, deleteArticolo,
  registraMovimento, fetchMovimentiRecenti, fetchProdottiOptions,
  type FornitoreOption, type ProdottoOption,
} from '../lib/magazzino';
import { lookupBarcodeProduct } from '../lib/barcodeLookup';
import { IS_DEMO_MODE } from '../lib/supabase';
import { getCurrentUser, requireManagerPin } from '../lib/staffAuth';
import { useConfirm } from './ConfirmModal';
import { useToast } from './Toast';
import NumericKeypad from './NumericKeypad';
import BarcodeScanner from './BarcodeScanner';

const UNITA_OPTIONS = ['kg', 'g', 'L', 'ml', 'pz', 'confezioni', 'casse'];

const emptyForm = {
  nome: '',
  categoria: '',
  unita_misura: 'kg',
  quantita: '',
  soglia_minima: '',
  costo_unitario: '',
  fornitore_id: '',
  codice_a_barre: '',
  prodotto_id: '',
  target_frigo: '',
  note: '',
};

export default function MagazzinoView({ onNavigateHome }: { onNavigateHome?: () => void } = {}) {
  const navigate = useNavigate();
  const { confirm } = useConfirm();
  const { addToast } = useToast();

  const [articoli, setArticoli] = useState<MagazzinoArticolo[]>([]);
  const [fornitori, setFornitori] = useState<FornitoreOption[]>([]);
  const [prodotti, setProdotti] = useState<ProdottoOption[]>([]);
  const [movimenti, setMovimenti] = useState<MagazzinoMovimento[]>([]);
  const [loading, setLoading] = useState(true);
  const [showStorico, setShowStorico] = useState(false);
  const [tab, setTab] = useState<'articoli' | 'ordini' | 'frigo'>('articoli');
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState<string | null>(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);

  const [movimentoTarget, setMovimentoTarget] = useState<MagazzinoArticolo | null>(null);
  const [movimentoTipo, setMovimentoTipo] = useState<'carico' | 'scarico'>('carico');
  const [movimentoQty, setMovimentoQty] = useState('');
  const [movimentoNota, setMovimentoNota] = useState('');

  async function refresh() {
    const [a, f, p, m] = await Promise.all([fetchArticoli(), fetchFornitoriOptions(), fetchProdottiOptions(), fetchMovimentiRecenti()]);
    setArticoli(a);
    setFornitori(f);
    setProdotti(p);
    setMovimenti(m);
    setLoading(false);
  }

  useEffect(() => { void refresh(); }, []);

  const fornitoreName = (id?: string | null) => fornitori.find(f => f.id === id)?.nome;
  const articoloName = (id: string) => articoli.find(a => a.id === id)?.nome || '—';
  const prodottoNome = (a: MagazzinoArticolo) => (a.prodotto_id ? prodotti.find(p => p.id === a.prodotto_id)?.nome : undefined) || a.nome;
  const sottoScorta = articoli.filter(a => stockLevel(a) !== 'ok');
  const categorie = [...new Set(articoli.map(a => a.categoria || 'Senza categoria'))].sort((x, y) => x.localeCompare(y, 'it'));
  const q = search.trim().toLowerCase();
  const visibili = articoli.filter(a =>
    (!catFilter || (a.categoria || 'Senza categoria') === catFilter) &&
    (!q || a.nome.toLowerCase().includes(q) || (fornitoreName(a.fornitore_id) || '').toLowerCase().includes(q)));
  const groupedVisibili = visibili.reduce<Record<string, MagazzinoArticolo[]>>((acc, a) => {
    (acc[a.categoria || 'Senza categoria'] ||= []).push(a);
    return acc;
  }, {});
  const ordini = buildOrderGroups(articoli, fornitoreName);
  const fmtQ = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, '').replace('.', ','));
  const valoreTotale = articoli.reduce((sum, a) => sum + a.quantita * (a.costo_unitario || 0), 0);

  const frigoArticoli = articoli.filter(a => a.prodotto_id);
  const daCaricare = (a: MagazzinoArticolo) => Math.max(0, (a.target_frigo || 0) - a.quantita);
  const frigoDaCaricare = frigoArticoli.filter(a => daCaricare(a) > 0);
  const totaleDaCaricare = frigoDaCaricare.reduce((s, a) => s + daCaricare(a), 0);


  function openAddForm() {
    setEditingId(null);
    setForm(emptyForm);
    setIsFormOpen(true);
  }

  function openEditForm(a: MagazzinoArticolo) {
    setEditingId(a.id);
    setForm({
      nome: a.nome,
      categoria: a.categoria,
      unita_misura: a.unita_misura,
      quantita: String(a.quantita),
      soglia_minima: String(a.soglia_minima),
      costo_unitario: String(a.costo_unitario || ''),
      fornitore_id: a.fornitore_id || '',
      codice_a_barre: a.codice_a_barre || '',
      prodotto_id: a.prodotto_id || '',
      target_frigo: a.target_frigo ? String(a.target_frigo) : '',
      note: a.note,
    });
    setIsFormOpen(true);
  }

  async function handleBarcodeScanned(code: string) {
    setScannerOpen(false);

    const existing = articoli.find(a => a.codice_a_barre === code);
    if (existing) {
      setIsFormOpen(false);
      addToast({ type: 'info', title: 'Articolo trovato', message: `${existing.nome} è già censito: registra un carico.` });
      openMovimento(existing, 'carico');
      return;
    }

    setLookingUp(true);
    const info = await lookupBarcodeProduct(code);
    setLookingUp(false);

    setEditingId(null);
    setForm({
      ...emptyForm,
      codice_a_barre: code,
      nome: info?.nome || '',
      categoria: info?.categoria || '',
      unita_misura: info?.unita_misura || 'kg',
    });
    setIsFormOpen(true);

    if (info) {
      addToast({ type: 'success', title: 'Prodotto trovato', message: `Dati precompilati per "${info.nome}" — controlla prima di salvare.` });
    } else {
      addToast({ type: 'info', title: 'Prodotto non trovato', message: 'Inserisci i dati manualmente.' });
    }
  }

  async function handleSaveForm() {
    if (!form.nome.trim()) { addToast({ type: 'error', title: 'Nome mancante', message: 'Inserisci il nome dell\'articolo' }); return; }
    const quantita = parseFloat(form.quantita.replace(',', '.')) || 0;
    const soglia_minima = parseFloat(form.soglia_minima.replace(',', '.')) || 0;
    const costo_unitario = parseFloat(form.costo_unitario.replace(',', '.')) || 0;
    const target_frigo = parseFloat(form.target_frigo.replace(',', '.')) || 0;
    const payload = {
      nome: form.nome.trim(),
      categoria: form.categoria.trim(),
      unita_misura: form.unita_misura,
      quantita,
      soglia_minima,
      costo_unitario,
      fornitore_id: form.fornitore_id || null,
      codice_a_barre: form.codice_a_barre.trim() || null,
      prodotto_id: form.prodotto_id || null,
      target_frigo,
      note: form.note.trim(),
    };
    const ok = editingId ? await updateArticolo(editingId, payload) : await addArticolo(payload);
    if (!ok) { addToast({ type: 'error', title: 'Errore', message: 'Salvataggio non riuscito.' }); return; }
    setIsFormOpen(false);
    await refresh();
    addToast({ type: 'success', title: editingId ? 'Articolo aggiornato' : 'Articolo aggiunto' });
  }

  async function handleDelete(a: MagazzinoArticolo) {
    if (!(await requireManagerPin('eliminare un articolo di magazzino'))) return;
    const ok = await confirm({ title: 'Elimina articolo', message: `Eliminare "${a.nome}" e il suo storico movimenti?`, destructive: true });
    if (!ok) return;
    const success = await deleteArticolo(a.id);
    if (!success) { addToast({ type: 'error', title: 'Errore', message: 'Eliminazione non riuscita.' }); return; }
    await refresh();
    addToast({ type: 'success', title: 'Articolo eliminato' });
  }

  function openMovimento(a: MagazzinoArticolo, tipo: 'carico' | 'scarico') {
    setMovimentoTarget(a);
    setMovimentoTipo(tipo);
    setMovimentoQty('');
    setMovimentoNota('');
  }

  async function handleConfirmMovimento() {
    if (!movimentoTarget) return;
    const qty = parseFloat(movimentoQty.replace(',', '.'));
    if (isNaN(qty) || qty <= 0) { addToast({ type: 'error', title: 'Quantità non valida' }); return; }
    const operatore = getCurrentUser()?.name || '';
    const ok = await registraMovimento(movimentoTarget.id, movimentoTipo, qty, movimentoNota.trim(), operatore);
    if (!ok) { addToast({ type: 'error', title: 'Errore', message: 'Movimento non registrato.' }); return; }
    setMovimentoTarget(null);
    await refresh();
    addToast({ type: 'success', title: movimentoTipo === 'carico' ? 'Carico registrato' : 'Scarico registrato' });
  }

  /** ±1 al volo dalla riga: aggiorna subito a schermo, poi registra il movimento. */
  async function quickAdjust(a: MagazzinoArticolo, delta: 1 | -1) {
    if (delta < 0 && a.quantita <= 0) return;
    setArticoli(prev => prev.map(x => x.id === a.id ? { ...x, quantita: Math.max(0, x.quantita + delta) } : x));
    const ok = await registraMovimento(a.id, delta > 0 ? 'carico' : 'scarico', 1, 'Rettifica rapida', getCurrentUser()?.name || '');
    if (!ok) {
      addToast({ type: 'error', title: 'Errore', message: 'Movimento non registrato.' });
    }
    await refresh();
  }

  /** Lista per il fornitore: condivisione del telefono (WhatsApp, SMS…) o, in mancanza, copia negli appunti. */
  async function shareOrder(g: OrderGroup) {
    const text = orderText(g);
    try {
      if (navigator.share) { await navigator.share({ text }); return; }
    } catch { /* condivisione annullata: si prova a copiare */ }
    try {
      await navigator.clipboard.writeText(text);
      addToast({ type: 'success', title: 'Lista copiata', message: `Incollala nel messaggio per ${g.fornitore}.` });
    } catch {
      addToast({ type: 'error', title: 'Impossibile copiare', message: 'Copia la lista a mano.' });
    }
  }

  /** Porta la scorta di un articolo fino al target frigo (registra un carico della differenza). */
  async function caricaFinoATarget(a: MagazzinoArticolo) {
    const mancante = daCaricare(a);
    if (mancante <= 0) return;
    const operatore = getCurrentUser()?.name || '';
    const ok = await registraMovimento(a.id, 'carico', mancante, 'Rifornimento frigo', operatore);
    if (!ok) { addToast({ type: 'error', title: 'Errore', message: 'Carico non registrato.' }); return; }
    await refresh();
    addToast({ type: 'success', title: `${prodottoNome(a)}: +${mancante} a frigo` });
  }

  async function caricaTutto() {
    if (frigoDaCaricare.length === 0) return;
    if (!(await confirm({ title: 'Rifornisci frigo', message: `Caricare ${totaleDaCaricare} pezzi su ${frigoDaCaricare.length} bibite fino al target?` }))) return;
    const operatore = getCurrentUser()?.name || '';
    let done = 0;
    for (const a of frigoDaCaricare) {
      const ok = await registraMovimento(a.id, 'carico', daCaricare(a), 'Rifornimento frigo', operatore);
      if (ok) done++;
    }
    await refresh();
    addToast({ type: done > 0 ? 'success' : 'error', title: done > 0 ? 'Frigo rifornito' : 'Errore', message: done > 0 ? `${done} bibite portate a target.` : 'Nessun carico registrato.' });
  }

  return (
    <div className="flex-1 flex flex-col bg-charcoal text-white h-full overflow-hidden px-4 pt-4 md:p-8">
      <header className="flex justify-between items-center mb-3 md:mb-6 shrink-0 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => onNavigateHome ? onNavigateHome() : navigate('/')} aria-label="Indietro" className="w-11 h-11 flex items-center justify-center bg-surface border border-surface-light rounded-xl text-gray-300 shrink-0 active:scale-95">
            <ArrowLeft size={20} />
          </button>
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight truncate">Magazzino</h1>
            {!loading && articoli.length > 0 && (
              <p className="text-xs text-gray-400 truncate">
                {articoli.length} articoli<span className="hidden sm:inline"> · valore €{valoreTotale.toFixed(0)}</span>
                {sottoScorta.length > 0 && <span className="text-rose-400 font-bold"> · {sottoScorta.length} da ordinare</span>}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => setShowStorico(true)} aria-label="Storico movimenti" title="Storico movimenti" className="w-11 h-11 flex items-center justify-center bg-surface border border-surface-light rounded-xl text-gray-300 active:scale-95">
            <Clock size={18} />
          </button>
          <button onClick={() => setScannerOpen(true)} disabled={lookingUp} aria-label="Scansiona codice a barre" title="Scansiona codice a barre" className="w-11 h-11 flex items-center justify-center bg-surface border border-surface-light rounded-xl text-gray-300 active:scale-95 disabled:opacity-50">
            <ScanBarcode size={18} />
          </button>
          <button onClick={openAddForm} aria-label="Nuovo articolo" className="h-11 px-3 md:px-5 bg-gold hover:bg-gold-hover text-black rounded-xl font-black text-sm flex items-center gap-1.5 active:scale-95">
            <Plus size={18} /><span className="hidden sm:inline">Nuovo</span>
          </button>
        </div>
      </header>

      {/* Schede */}
      <div className="flex gap-1 p-1 mb-3 bg-surface border border-surface-light rounded-2xl shrink-0">
        {([
          { id: 'articoli' as const, label: 'Scorte', icon: <Package size={16} />, badge: 0, tone: '' },
          { id: 'ordini' as const, label: 'Da ordinare', icon: <ShoppingCart size={16} />, badge: sottoScorta.length, tone: 'bg-rose-500 text-white' },
          { id: 'frigo' as const, label: 'Frigo', icon: <Snowflake size={16} />, badge: frigoDaCaricare.length, tone: 'bg-sky-500 text-black' },
        ]).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 h-10 rounded-xl font-bold text-sm whitespace-nowrap flex items-center justify-center gap-1.5 transition-colors ${tab === t.id ? 'bg-charcoal text-white shadow' : 'text-gray-400'}`}
          >
            <span className="hidden sm:inline">{t.icon}</span> {t.label}
            {t.badge > 0 && <span className={`min-w-5 h-5 px-1 rounded-full text-[11px] font-black flex items-center justify-center ${t.tone}`}>{t.badge}</span>}
          </button>
        ))}
      </div>

      {IS_DEMO_MODE && (
        <p className="mb-3 text-xs font-bold text-amber-400 shrink-0">Modalità demo: dati di prova, le modifiche non vengono salvate.</p>
      )}

      {lookingUp && (
        <div className="mb-3 p-3 bg-surface border border-surface-light rounded-xl text-gray-300 text-sm font-bold shrink-0 flex items-center gap-3">
          <div className="w-4 h-4 border-2 border-gold border-t-transparent rounded-full animate-spin" />
          Ricerca prodotto in corso…
        </div>
      )}

      {/* ── Scorte ───────────────────────────────────────────── */}
      {tab === 'articoli' && (
        <>
          {articoli.length > 0 && (
            <div className="shrink-0 space-y-2 mb-3">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="search"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Cerca articolo…"
                  className="w-full bg-surface border border-surface-light rounded-xl py-2.5 pl-10 pr-3 text-white font-semibold outline-none focus:border-gold text-[15px]"
                />
              </div>
              <div className="flex gap-1.5 overflow-x-auto hide-scrollbar -mx-4 px-4 md:mx-0 md:px-0">
                {[null, ...categorie].map(c => (
                  <button
                    key={c ?? 'tutte'}
                    onClick={() => setCatFilter(c)}
                    className={`shrink-0 px-3.5 py-1.5 rounded-full text-[13px] font-bold border ${catFilter === c ? 'bg-gold border-gold text-black' : 'bg-surface border-surface-light text-gray-300'}`}
                  >
                    {c ?? 'Tutte'}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex-1 overflow-y-auto custom-scrollbar pb-6 -mx-1 px-1">
            {!loading && articoli.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-500 text-center px-6">
                <Package size={64} strokeWidth={1} className="mb-4" />
                <p className="text-lg font-bold">Nessun articolo</p>
                <p className="text-sm mt-1">Aggiungi il primo con “Nuovo” o scansiona un codice a barre</p>
              </div>
            ) : visibili.length === 0 ? (
              <p className="text-center text-gray-500 py-10 font-bold">Nessun articolo trovato</p>
            ) : (
              Object.entries(groupedVisibili).map(([cat, items]) => (
                <section key={cat} className="mb-5">
                  <h3 className="sticky top-0 z-10 bg-charcoal/95 backdrop-blur py-1.5 text-xs font-black text-gray-400 uppercase tracking-wider">{cat}</h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                    {items.map(a => {
                      const level = stockLevel(a);
                      const max = Math.max(a.soglia_minima * 2, a.quantita, 1);
                      const pct = Math.min(100, Math.round((a.quantita / max) * 100));
                      return (
                        <div key={a.id} className={`rounded-2xl border p-3 bg-surface ${level === 'ok' ? 'border-surface-light' : level === 'basso' ? 'border-amber-500/40' : 'border-rose-500/50'}`}>
                          <div className="flex items-start gap-3">
                            <button onClick={() => openEditForm(a)} className="flex-1 min-w-0 text-left">
                              <p className="font-bold text-white leading-snug">{a.nome}</p>
                              <p className="text-xs text-gray-400 mt-0.5 truncate">
                                {fornitoreName(a.fornitore_id) && <><Truck size={11} className="inline -mt-0.5" /> {fornitoreName(a.fornitore_id)} · </>}
                                min {fmtQ(a.soglia_minima)} {a.unita_misura}
                              </p>
                            </button>
                            <div className="text-right shrink-0">
                              <p className={`text-2xl font-black tabular-nums leading-none ${level === 'ok' ? 'text-white' : level === 'basso' ? 'text-amber-300' : 'text-rose-400'}`}>
                                {fmtQ(a.quantita)}<span className="text-sm font-bold text-gray-400 ml-1">{a.unita_misura}</span>
                              </p>
                              <p className={`text-[11px] font-bold mt-1 ${level === 'ok' ? 'text-emerald-400' : level === 'basso' ? 'text-amber-300' : 'text-rose-400'}`}>
                                {level === 'ok' ? 'ok' : level === 'basso' ? 'sotto scorta' : 'finito'}
                              </p>
                            </div>
                          </div>
                          <div className="h-1.5 mt-2.5 rounded-full bg-charcoal overflow-hidden">
                            <div className={`h-full rounded-full ${level === 'ok' ? 'bg-emerald-500' : level === 'basso' ? 'bg-amber-400' : 'bg-rose-500'}`} style={{ width: `${Math.max(pct, level === 'finito' ? 0 : 4)}%` }} />
                          </div>
                          <div className="flex items-center gap-2 mt-2.5">
                            <button onClick={() => void quickAdjust(a, -1)} disabled={a.quantita <= 0} aria-label={`Togli 1 ${a.unita_misura}`} className="w-11 h-10 rounded-xl bg-charcoal border border-surface-light text-gray-200 flex items-center justify-center active:scale-90 disabled:opacity-30">
                              <Minus size={18} />
                            </button>
                            <button onClick={() => void quickAdjust(a, 1)} aria-label={`Aggiungi 1 ${a.unita_misura}`} className="w-11 h-10 rounded-xl bg-charcoal border border-surface-light text-gray-200 flex items-center justify-center active:scale-90">
                              <Plus size={18} />
                            </button>
                            <button onClick={() => openMovimento(a, 'carico')} className="flex-1 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-bold text-sm active:scale-95">
                              Carico
                            </button>
                            <button onClick={() => openMovimento(a, 'scarico')} className="flex-1 h-10 rounded-xl bg-charcoal border border-surface-light text-gray-300 font-bold text-sm active:scale-95">
                              Scarico
                            </button>
                            <button onClick={() => handleDelete(a)} aria-label={`Elimina ${a.nome}`} className="w-10 h-10 rounded-xl text-rose-400/60 hover:text-rose-400 flex items-center justify-center">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))
            )}
          </div>
        </>
      )}

      {/* ── Da ordinare ──────────────────────────────────────── */}
      {tab === 'ordini' && (
        <div className="flex-1 overflow-y-auto custom-scrollbar pb-6">
          {ordini.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-gray-500 px-6">
              <CheckCircle2 size={56} strokeWidth={1.5} className="mb-3 text-emerald-500" />
              <p className="text-lg font-bold text-white">Niente da ordinare</p>
              <p className="text-sm mt-1">Tutti gli articoli sono sopra la soglia minima.</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-400 mb-3">Quantità suggerite per tornare al doppio della soglia minima. Raggruppate per fornitore, pronte da mandare.</p>
              <div className="space-y-3">
                {ordini.map(g => (
                  <section key={g.fornitore} className="rounded-2xl border border-surface-light bg-surface overflow-hidden">
                    <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-surface-light">
                      <div className="min-w-0">
                        <p className="font-black text-white truncate flex items-center gap-1.5"><Truck size={16} className="text-gold shrink-0" /> {g.fornitore}</p>
                        <p className="text-xs text-gray-400">{g.righe.length} {g.righe.length === 1 ? 'articolo' : 'articoli'}</p>
                      </div>
                      <button onClick={() => void shareOrder(g)} className="h-10 px-4 rounded-xl bg-gold text-black font-black text-sm flex items-center gap-1.5 active:scale-95 shrink-0">
                        <Share2 size={16} /> Invia lista
                      </button>
                    </header>
                    <ul>
                      {g.righe.map(r => (
                        <li key={r.articolo.id} className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-surface-light/50 last:border-0">
                          <div className="min-w-0">
                            <p className="font-bold text-white truncate">{r.articolo.nome}</p>
                            <p className="text-xs text-gray-400">ora {fmtQ(r.articolo.quantita)} {r.articolo.unita_misura} · min {fmtQ(r.articolo.soglia_minima)}</p>
                          </div>
                          <p className="text-lg font-black text-gold tabular-nums shrink-0">+{fmtQ(r.quantita)} <span className="text-xs text-gray-400 font-bold">{r.articolo.unita_misura}</span></p>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Frigo ────────────────────────────────────────────── */}
      {tab === 'frigo' && (
        <div className="flex-1 overflow-y-auto custom-scrollbar pb-6">
          {loading ? (
            <p className="text-center text-gray-500 text-sm py-10">Caricamento…</p>
          ) : frigoArticoli.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-500 text-center px-6">
              <Snowflake size={56} strokeWidth={1.5} className="mb-3" />
              <p className="text-lg font-bold text-white">Nessuna bibita collegata</p>
              <p className="text-sm mt-1 max-w-md">Apri un articolo, collegalo a una bibita del POS e imposta quante ne vuoi in frigo.</p>
            </div>
          ) : (
            <>
              <div className="mb-3 p-3 bg-sky-500/10 border border-sky-500/30 rounded-2xl flex items-center justify-between gap-3">
                <p className="text-sm font-bold text-sky-300">
                  {frigoDaCaricare.length > 0 ? `${frigoDaCaricare.length} bibite da caricare · ${totaleDaCaricare} pezzi` : 'Frigo completo'}
                </p>
                {frigoDaCaricare.length > 0 && (
                  <button onClick={caricaTutto} className="h-10 px-4 bg-sky-500 text-black rounded-xl font-black text-sm active:scale-95 shrink-0">Carica tutto</button>
                )}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                {frigoArticoli.map(a => {
                  const mancante = daCaricare(a);
                  const target = a.target_frigo || 0;
                  const pct = target > 0 ? Math.min(100, Math.round((a.quantita / target) * 100)) : 100;
                  return (
                    <div key={a.id} className={`rounded-2xl border p-3 bg-surface ${mancante > 0 ? 'border-sky-500/40' : 'border-surface-light'}`}>
                      <div className="flex items-center gap-3">
                        <button onClick={() => openEditForm(a)} className="flex-1 min-w-0 text-left">
                          <p className="font-bold text-white truncate">{prodottoNome(a)}</p>
                          <p className="text-xs text-gray-400 flex items-center gap-1"><Link2 size={11} /> {prodotti.find(p => p.id === a.prodotto_id)?.categoria || a.nome}</p>
                        </button>
                        <p className={`text-2xl font-black tabular-nums shrink-0 ${mancante > 0 ? 'text-sky-300' : 'text-emerald-400'}`}>
                          {a.quantita}<span className="text-sm font-bold text-gray-400"> / {target}</span>
                        </p>
                      </div>
                      <div className="h-1.5 mt-2.5 rounded-full bg-charcoal overflow-hidden">
                        <div className={`h-full rounded-full ${mancante > 0 ? 'bg-sky-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
                      </div>
                      <button
                        onClick={() => caricaFinoATarget(a)}
                        disabled={mancante <= 0}
                        className="w-full h-10 mt-2.5 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-300 font-bold text-sm active:scale-95 disabled:opacity-40"
                      >
                        {mancante > 0 ? `Carica ${mancante}` : 'Al completo'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* Add/Edit Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-surface border border-surface-light w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
            <div className="p-6 border-b border-surface-light flex justify-between items-center shrink-0">
              <h2 className="text-xl font-black italic uppercase text-white">{editingId ? 'Modifica' : 'Nuovo'} <span className="text-gold">Articolo</span></h2>
              <button onClick={() => setIsFormOpen(false)} className="p-2 bg-charcoal rounded-xl text-gray-500 hover:text-white border border-surface-light">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
              <div>
                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-[.2em] mb-2">Nome *</label>
                <input type="text" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })}
                  placeholder="es. Farina 00" className="w-full bg-charcoal border border-surface-light rounded-2xl py-3 px-4 text-white font-bold text-sm outline-none focus:border-gold/50" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-[.2em] mb-2">Categoria</label>
                <input type="text" value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })}
                  placeholder="es. Farine e Cereali" className="w-full bg-charcoal border border-surface-light rounded-2xl py-3 px-4 text-white font-bold text-sm outline-none focus:border-gold/50" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-gray-500 uppercase tracking-[.2em] mb-2">Quantità iniziale</label>
                  <input type="text" inputMode="decimal" value={form.quantita} onChange={e => setForm({ ...form, quantita: e.target.value })}
                    placeholder="0" className="w-full bg-charcoal border border-surface-light rounded-2xl py-3 px-4 text-white font-bold text-sm outline-none focus:border-gold/50" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-500 uppercase tracking-[.2em] mb-2">Unità</label>
                  <select value={form.unita_misura} onChange={e => setForm({ ...form, unita_misura: e.target.value })}
                    className="w-full bg-charcoal border border-surface-light rounded-2xl py-3 px-4 text-white font-bold text-sm outline-none focus:border-gold/50 appearance-none">
                    {UNITA_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-gray-500 uppercase tracking-[.2em] mb-2">Soglia minima</label>
                  <input type="text" inputMode="decimal" value={form.soglia_minima} onChange={e => setForm({ ...form, soglia_minima: e.target.value })}
                    placeholder="0" className="w-full bg-charcoal border border-surface-light rounded-2xl py-3 px-4 text-white font-bold text-sm outline-none focus:border-gold/50" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-500 uppercase tracking-[.2em] mb-2">Costo unitario (€)</label>
                  <input type="text" inputMode="decimal" value={form.costo_unitario} onChange={e => setForm({ ...form, costo_unitario: e.target.value })}
                    placeholder="0.00" className="w-full bg-charcoal border border-surface-light rounded-2xl py-3 px-4 text-white font-bold text-sm outline-none focus:border-gold/50" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-[.2em] mb-2">Fornitore</label>
                <select value={form.fornitore_id} onChange={e => setForm({ ...form, fornitore_id: e.target.value })}
                  className="w-full bg-charcoal border border-surface-light rounded-2xl py-3 px-4 text-white font-bold text-sm outline-none focus:border-gold/50 appearance-none">
                  <option value="">Nessuno</option>
                  {fornitori.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-[.2em] mb-2">Collega bibita / prodotto</label>
                <select value={form.prodotto_id} onChange={e => setForm({ ...form, prodotto_id: e.target.value })}
                  className="w-full bg-charcoal border border-surface-light rounded-2xl py-3 px-4 text-white font-bold text-sm outline-none focus:border-gold/50 appearance-none">
                  <option value="">Nessuno</option>
                  {prodotti.map(p => <option key={p.id} value={p.id}>{p.nome}{p.categoria ? ` (${p.categoria})` : ''}</option>)}
                </select>
                <p className="text-[10px] text-gray-600 font-bold mt-1">Le vendite scalano automaticamente la scorta di questo articolo.</p>
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-[.2em] mb-2">Pezzi nel frigo (target)</label>
                <input type="text" inputMode="decimal" value={form.target_frigo} onChange={e => setForm({ ...form, target_frigo: e.target.value })}
                  placeholder="0" className="w-full bg-charcoal border border-surface-light rounded-2xl py-3 px-4 text-white font-bold text-sm outline-none focus:border-gold/50" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-[.2em] mb-2">Note</label>
                <input type="text" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })}
                  className="w-full bg-charcoal border border-surface-light rounded-2xl py-3 px-4 text-white font-bold text-sm outline-none focus:border-gold/50" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-[.2em] mb-2">Codice a barre</label>
                <div className="flex gap-2">
                  <input type="text" value={form.codice_a_barre} onChange={e => setForm({ ...form, codice_a_barre: e.target.value })}
                    placeholder="Scansiona o inserisci a mano" className="flex-1 bg-charcoal border border-surface-light rounded-2xl py-3 px-4 text-white font-bold text-sm outline-none focus:border-gold/50" />
                  <button type="button" onClick={() => setScannerOpen(true)} className="shrink-0 px-4 bg-charcoal border border-surface-light rounded-2xl text-gray-400 hover:text-gold transition-all">
                    <ScanBarcode size={18} />
                  </button>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-surface-light shrink-0">
              <button onClick={handleSaveForm} className="w-full bg-gold hover:bg-gold-hover text-black font-black py-4 rounded-2xl text-sm shadow-xl shadow-gold/20 active:scale-95 transition-all uppercase tracking-widest">
                <Save size={16} className="inline mr-2" /> Salva
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Movimento Modal */}
      {movimentoTarget && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-surface border border-surface-light w-full max-w-sm rounded-[32px] shadow-2xl p-8">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-xl font-black italic uppercase text-white">
                {movimentoTipo === 'carico' ? 'Carico' : 'Scarico'} <span className="text-gold">{movimentoTarget.nome}</span>
              </h2>
              <button onClick={() => setMovimentoTarget(null)} className="p-2 bg-charcoal rounded-xl text-gray-500 hover:text-white border border-surface-light">
                <X size={18} />
              </button>
            </div>
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-5">
              Scorta attuale: {movimentoTarget.quantita} {movimentoTarget.unita_misura}
            </p>

            <div className="w-full bg-charcoal border border-surface-light rounded-2xl p-4 mb-4 text-right text-4xl font-black italic text-gold tabular-nums">
              {movimentoQty || '0'} <span className="text-lg not-italic text-gray-500">{movimentoTarget.unita_misura}</span>
            </div>

            <NumericKeypad value={movimentoQty} onChange={setMovimentoQty} className="mb-4" />

            <input
              type="text"
              value={movimentoNota}
              onChange={e => setMovimentoNota(e.target.value)}
              placeholder="Nota (opzionale)"
              className="w-full bg-charcoal border border-surface-light rounded-xl py-3 px-4 text-white text-sm font-bold outline-none focus:border-gold mb-4 placeholder:text-gray-600"
            />

            <button
              onClick={handleConfirmMovimento}
              disabled={!movimentoQty || parseFloat(movimentoQty.replace(',', '.')) <= 0}
              className={`w-full font-black py-4 rounded-2xl text-sm shadow-xl active:scale-95 transition-all uppercase tracking-widest disabled:opacity-30 ${
                movimentoTipo === 'carico' ? 'bg-emerald-500 text-black' : 'bg-gold text-black'
              }`}
            >
              Conferma {movimentoTipo === 'carico' ? 'Carico' : 'Scarico'}
            </button>
          </div>
        </div>
      )}

      {/* Storico Modal */}
      {showStorico && (
        <div className="fixed inset-0 z-[130] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/90 backdrop-blur-xl animate-in fade-in duration-200">
          <div className="bg-surface border border-surface-light w-full sm:max-w-lg rounded-t-[32px] sm:rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-5 border-b border-surface-light flex justify-between items-center">
              <h2 className="text-xl font-black italic uppercase text-white">Storico <span className="text-gold">Movimenti</span></h2>
              <button onClick={() => setShowStorico(false)} className="p-2 bg-charcoal rounded-xl text-gray-500 hover:text-white border border-surface-light">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
              {movimenti.length === 0 ? (
                <p className="text-center text-gray-500 text-sm py-10">Nessun movimento registrato</p>
              ) : (
                movimenti.map(m => (
                  <div key={m.id} className="bg-charcoal border border-surface-light rounded-xl p-3 flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white truncate">{articoloName(m.articolo_id)}</p>
                      <p className="text-[10px] text-gray-500 font-bold">
                        {new Date(m.created_at).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        {m.operatore && ` · ${m.operatore}`}
                        {m.nota && ` · ${m.nota}`}
                      </p>
                    </div>
                    <span className={`shrink-0 text-sm font-black ${m.tipo === 'carico' ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {m.tipo === 'carico' ? '+' : '-'}{m.quantita}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <BarcodeScanner
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleBarcodeScanned}
      />
    </div>
  );
}
