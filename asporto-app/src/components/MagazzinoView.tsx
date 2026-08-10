import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package, Plus, Minus, ArrowLeft, Edit2, Trash2, X, Save,
  AlertTriangle, Clock, Truck, ScanBarcode,
} from 'lucide-react';
import type { MagazzinoArticolo, MagazzinoMovimento } from '../types/entities';
import {
  fetchArticoli, fetchFornitoriOptions, addArticolo, updateArticolo, deleteArticolo,
  registraMovimento, fetchMovimentiRecenti, type FornitoreOption,
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
  note: '',
};

export default function MagazzinoView({ onNavigateHome }: { onNavigateHome?: () => void } = {}) {
  const navigate = useNavigate();
  const { confirm } = useConfirm();
  const { addToast } = useToast();

  const [articoli, setArticoli] = useState<MagazzinoArticolo[]>([]);
  const [fornitori, setFornitori] = useState<FornitoreOption[]>([]);
  const [movimenti, setMovimenti] = useState<MagazzinoMovimento[]>([]);
  const [loading, setLoading] = useState(true);
  const [showStorico, setShowStorico] = useState(false);

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
    const [a, f, m] = await Promise.all([fetchArticoli(), fetchFornitoriOptions(), fetchMovimentiRecenti()]);
    setArticoli(a);
    setFornitori(f);
    setMovimenti(m);
    setLoading(false);
  }

  useEffect(() => { void refresh(); }, []);

  const fornitoreName = (id?: string | null) => fornitori.find(f => f.id === id)?.nome;
  const articoloName = (id: string) => articoli.find(a => a.id === id)?.nome || '—';
  const sottoScorta = articoli.filter(a => a.quantita <= a.soglia_minima);
  const valoreTotale = articoli.reduce((sum, a) => sum + a.quantita * (a.costo_unitario || 0), 0);

  const grouped = articoli.reduce<Record<string, MagazzinoArticolo[]>>((acc, a) => {
    const cat = a.categoria || 'Senza categoria';
    (acc[cat] ||= []).push(a);
    return acc;
  }, {});

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
    const payload = {
      nome: form.nome.trim(),
      categoria: form.categoria.trim(),
      unita_misura: form.unita_misura,
      quantita,
      soglia_minima,
      costo_unitario,
      fornitore_id: form.fornitore_id || null,
      codice_a_barre: form.codice_a_barre.trim() || null,
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

  return (
    <div className="flex-1 flex flex-col bg-charcoal text-white h-full overflow-hidden p-8">
      <header className="flex justify-between items-center mb-8 shrink-0">
        <div className="flex items-center gap-6">
          <button onClick={() => onNavigateHome ? onNavigateHome() : navigate('/')} className="p-3 bg-surface border border-surface-light rounded-2xl text-gray-500 hover:text-white transition-all shadow-xl" title="Torna indietro">
            <ArrowLeft size={24} />
          </button>
          <div>
            <h2 className="text-sm text-gold font-black tracking-widest uppercase italic">Gestione Scorte</h2>
            <h1 className="text-4xl font-black text-white uppercase italic">Magazzino</h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowStorico(true)}
            className="p-3.5 bg-surface border border-surface-light rounded-2xl text-gray-500 hover:text-white transition-all"
            title="Storico movimenti"
          >
            <Clock size={20} />
          </button>
          <button
            onClick={() => setScannerOpen(true)}
            disabled={lookingUp}
            className="p-3.5 bg-surface border border-surface-light rounded-2xl text-gray-500 hover:text-gold transition-all disabled:opacity-50"
            title="Scansiona codice a barre"
          >
            <ScanBarcode size={20} />
          </button>
          <button
            onClick={openAddForm}
            className="bg-gold hover:bg-gold-hover text-black px-6 py-3.5 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-gold/20 flex items-center gap-2 active:scale-95 transition-all"
          >
            <Plus size={20} /> Nuovo Articolo
          </button>
        </div>
      </header>

      {IS_DEMO_MODE && (
        <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-400 text-sm font-bold shrink-0">
          Modalità demo: il magazzino richiede un database reale (tabelle non disponibili in demo).
        </div>
      )}

      {lookingUp && (
        <div className="mb-6 p-4 bg-surface border border-surface-light rounded-2xl text-gray-400 text-sm font-bold shrink-0 flex items-center gap-3">
          <div className="w-4 h-4 border-2 border-gold border-t-transparent rounded-full animate-spin" />
          Ricerca prodotto in corso…
        </div>
      )}

      {!loading && articoli.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6 shrink-0">
          <div className="bg-surface border border-surface-light rounded-2xl p-4">
            <p className="text-2xl font-black text-white leading-none">{articoli.length}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mt-1">Articoli a magazzino</p>
          </div>
          <div className="bg-surface border border-surface-light rounded-2xl p-4">
            <p className="text-2xl font-black text-gold leading-none">€{valoreTotale.toFixed(2)}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mt-1">Valore scorte</p>
          </div>
          <div className="bg-surface border border-surface-light rounded-2xl p-4">
            <p className={`text-2xl font-black leading-none ${sottoScorta.length > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>{sottoScorta.length}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mt-1">Sotto scorta</p>
          </div>
        </div>
      )}

      {sottoScorta.length > 0 && (
        <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-start gap-3 shrink-0">
          <AlertTriangle size={20} className="text-rose-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-rose-400 font-black text-sm uppercase tracking-widest mb-1">{sottoScorta.length} articoli sotto scorta minima</p>
            <p className="text-xs text-gray-400">{sottoScorta.map(a => a.nome).join(', ')}</p>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
        {!loading && articoli.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-600 opacity-50">
            <Package size={80} strokeWidth={1} className="mb-6" />
            <p className="text-xl font-black uppercase tracking-widest">Nessun articolo</p>
            <p className="text-sm mt-2">Aggiungi il primo articolo di magazzino</p>
          </div>
        ) : (
          Object.entries(grouped).map(([cat, items]) => (
            <div key={cat} className="mb-8">
              <h3 className="text-[11px] font-black text-gray-500 uppercase tracking-[0.3em] mb-3">{cat}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {items.map(a => {
                  const low = a.quantita <= a.soglia_minima;
                  return (
                    <div key={a.id} className={`bg-surface border rounded-2xl p-5 transition-all ${low ? 'border-rose-500/40' : 'border-surface-light'}`}>
                      <div className="flex justify-between items-start mb-3">
                        <div className="min-w-0">
                          <h4 className="font-bold text-white uppercase text-sm truncate">{a.nome}</h4>
                          {fornitoreName(a.fornitore_id) && (
                            <p className="text-[10px] text-gray-500 font-bold flex items-center gap-1 mt-1"><Truck size={11} /> {fornitoreName(a.fornitore_id)}</p>
                          )}
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button onClick={() => openEditForm(a)} className="p-2 bg-charcoal text-gray-500 hover:text-white rounded-lg"><Edit2 size={15} /></button>
                          <button onClick={() => handleDelete(a)} className="p-2 bg-charcoal text-rose-500/50 hover:text-rose-500 rounded-lg"><Trash2 size={15} /></button>
                        </div>
                      </div>

                      <div className="flex items-end justify-between mb-4">
                        <div>
                          <p className={`text-3xl font-black italic ${low ? 'text-rose-400' : 'text-gold'}`}>
                            {a.quantita} <span className="text-sm font-bold not-italic">{a.unita_misura}</span>
                          </p>
                          <p className="text-[10px] text-gray-500 font-bold mt-1">Soglia minima: {a.soglia_minima} {a.unita_misura}</p>
                          {a.costo_unitario > 0 && (
                            <p className="text-[10px] text-gray-500 font-bold">€{a.costo_unitario.toFixed(2)}/{a.unita_misura} · valore €{(a.quantita * a.costo_unitario).toFixed(2)}</p>
                          )}
                        </div>
                        {low && <AlertTriangle size={20} className="text-rose-400 shrink-0" />}
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => openMovimento(a, 'carico')}
                          className="py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-black text-xs uppercase tracking-widest flex items-center justify-center gap-1.5 active:scale-95 transition-all hover:bg-emerald-500/20"
                        >
                          <Plus size={16} /> Carico
                        </button>
                        <button
                          onClick={() => openMovimento(a, 'scarico')}
                          className="py-3 rounded-xl bg-charcoal border border-surface-light text-gray-300 font-black text-xs uppercase tracking-widest flex items-center justify-center gap-1.5 active:scale-95 transition-all hover:bg-surface-light"
                        >
                          <Minus size={16} /> Scarico
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

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
