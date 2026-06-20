import { useEffect, useState, useCallback } from 'react';
import { supabase, IS_DEMO_MODE } from '../lib/supabase';
import { printLabelViaAgent, type HaccpLabelData } from '../lib/lanPrint';
import { PRINT_AGENT_URL } from '../lib/printConfig';
import { useConfirm } from './ConfirmModal';
import { useToast } from './Toast';
import { QRCodeCanvas } from 'qrcode.react';
import { ShieldCheck, Save, Printer, Trash2, Edit2, X, Copy, Package, Truck } from 'lucide-react';

interface HaccpFornitore {
  id: string;
  nome: string;
  partita_iva: string;
  telefono: string;
  indirizzo: string;
  note: string;
}

interface HaccpProdotto {
  id: string;
  nome_prodotto: string;
  ingredienti: string;
  allergeni: string;
  giorni_scadenza: number;
  conservazione: string;
}

interface HaccpViewProps {
  isEmbedded: boolean;
}

type SubTab = 'recipes' | 'fornitori' | 'print';

function formatDate(date: Date): string {
  return date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function formatDateTime(date: Date): string {
  return `${formatDate(date)} - ${date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`;
}

function generateLotto(): string {
  const now = new Date();
  const giorno = String(now.getDate()).padStart(2, '0');
  const mese = String(now.getMonth() + 1).padStart(2, '0');
  const anno = String(now.getFullYear()).slice(2);
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `L.${giorno}${mese}${anno}.${random}`;
}

export default function HaccpView({ isEmbedded }: HaccpViewProps) {
  const { confirm } = useConfirm();
  const { addToast } = useToast();
  const [subTab, setSubTab] = useState<SubTab>('print');
  const [prodotti, setProdotti] = useState<HaccpProdotto[]>([]);
  const [fornitori, setFornitori] = useState<HaccpFornitore[]>([]);
  const [prodottiFornitori, setProdottiFornitori] = useState<Record<string, string[]>>({});
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formNome, setFormNome] = useState('');
  const [formIngredienti, setFormIngredienti] = useState('');
  const [formAllergeni, setFormAllergeni] = useState('');
  const [formGiorni, setFormGiorni] = useState(5);
  const [formConservazione, setFormConservazione] = useState('');
  const [formFornitoriIds, setFormFornitoriIds] = useState<string[]>([]);

  const [printProdottoId, setPrintProdottoId] = useState('');
  const [printLotto, setPrintLotto] = useState(generateLotto());
  const [isPrinting, setIsPrinting] = useState(false);

  const [fornEditId, setFornEditId] = useState<string | null>(null);
  const [fNome, setFNome] = useState('');
  const [fPiva, setFPiva] = useState('');
  const [fTel, setFTel] = useState('');
  const [fInd, setFInd] = useState('');
  const [fNote, setFNote] = useState('');

  const LOC_STORAGE_KEY = 'risto_haccp_prodotti';
  const LOC_LINKS_KEY = 'risto_haccp_prodotti_fornitori';

  const fetchProdotti = useCallback(async () => {
    if (IS_DEMO_MODE) {
      const stored = localStorage.getItem(LOC_STORAGE_KEY);
      setProdotti(stored ? JSON.parse(stored) : []);
      return;
    }
    if (!supabase) return;
    const { data } = await supabase.from('haccp_prodotti').select('*').order('nome_prodotto');
    if (data) setProdotti(data as unknown as HaccpProdotto[]);
  }, []);

  const fetchLinks = useCallback(async () => {
    if (IS_DEMO_MODE) {
      const stored = localStorage.getItem(LOC_LINKS_KEY);
      setProdottiFornitori(stored ? JSON.parse(stored) : {});
      return;
    }
    if (!supabase) return;
    const { data } = await supabase.from('haccp_prodotti_fornitori').select('*');
    if (data) {
      const map: Record<string, string[]> = {};
      for (const row of data) {
        const pid = row.prodotto_id as string;
        if (!map[pid]) map[pid] = [];
        map[pid].push(row.fornitore_id as string);
      }
      setProdottiFornitori(map);
    }
  }, []);

  const fetchFornitori = useCallback(async () => {
    if (IS_DEMO_MODE) {
      const stored = localStorage.getItem('risto_haccp_fornitori');
      setFornitori(stored ? JSON.parse(stored) : []);
      return;
    }
    if (!supabase) return;
    const { data } = await supabase.from('haccp_fornitori').select('*').order('nome');
    if (data) setFornitori(data as HaccpFornitore[]);
  }, []);

  useEffect(() => { fetchProdotti(); fetchLinks(); fetchFornitori(); }, [fetchProdotti, fetchLinks, fetchFornitori]);

  /* ~~~ RICETTE CRUD ~~~ */

  function resetForm() {
    setEditingId(null);
    setFormNome('');
    setFormIngredienti('');
    setFormAllergeni('');
    setFormGiorni(5);
    setFormConservazione('');
    setFormFornitoriIds([]);
  }

  function toggleFornitoreId(id: string) {
    setFormFornitoriIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  async function saveLinks(prodottoId: string, fornitoreIds: string[]) {
    if (IS_DEMO_MODE || !supabase) {
      const updated = { ...prodottiFornitori, [prodottoId]: fornitoreIds };
      setProdottiFornitori(updated);
      localStorage.setItem(LOC_LINKS_KEY, JSON.stringify(updated));
      return;
    }
    await supabase.from('haccp_prodotti_fornitori').delete().eq('prodotto_id', prodottoId);
    if (fornitoreIds.length > 0) {
      await supabase.from('haccp_prodotti_fornitori').insert(fornitoreIds.map(fid => ({ prodotto_id: prodottoId, fornitore_id: fid })));
    }
    await fetchLinks();
  }

  async function saveProdotto() {
    if (!formNome.trim()) { addToast({ type: 'error', title: 'Errore', message: 'Inserisci il nome del prodotto' }); return; }

    const payload = {
      nome_prodotto: formNome.trim(),
      ingredienti: formIngredienti.trim(),
      allergeni: formAllergeni.trim(),
      giorni_scadenza: formGiorni,
      conservazione: formConservazione.trim(),
    };

    if (IS_DEMO_MODE || !supabase) {
      if (editingId) {
        const updated = prodotti.map(p => p.id === editingId ? { ...p, ...payload } : p);
        setProdotti(updated);
        localStorage.setItem(LOC_STORAGE_KEY, JSON.stringify(updated));
        await saveLinks(editingId, formFornitoriIds);
      } else {
        const newId = crypto.randomUUID();
        const newItem: HaccpProdotto = { id: newId, ...payload };
        const updated = [...prodotti, newItem];
        setProdotti(updated);
        localStorage.setItem(LOC_STORAGE_KEY, JSON.stringify(updated));
        await saveLinks(newId, formFornitoriIds);
      }
    } else {
      if (editingId) {
        await supabase.from('haccp_prodotti').update(payload).eq('id', editingId);
        await saveLinks(editingId, formFornitoriIds);
      } else {
        const { data } = await supabase.from('haccp_prodotti').insert([payload]).select('id').single();
        if (data) {
          await saveLinks(data.id, formFornitoriIds);
        }
      }
      await fetchProdotti();
    }

    resetForm();
    addToast({ type: 'success', title: editingId ? 'Ricetta aggiornata' : 'Ricetta salvata' });
  }

  async function deleteProdotto(id: string) {
    const ok = await confirm({ title: 'Elimina ricetta', message: 'Eliminare questa ricetta HACCP?', destructive: true });
    if (!ok) return;

    if (IS_DEMO_MODE || !supabase) {
      const updated = prodotti.filter(p => p.id !== id);
      setProdotti(updated);
      localStorage.setItem(LOC_STORAGE_KEY, JSON.stringify(updated));
      const links = { ...prodottiFornitori };
      delete links[id];
      setProdottiFornitori(links);
      localStorage.setItem(LOC_LINKS_KEY, JSON.stringify(links));
    } else {
      await supabase.from('haccp_prodotti_fornitori').delete().eq('prodotto_id', id);
      await supabase.from('haccp_prodotti').delete().eq('id', id);
      await fetchProdotti();
      await fetchLinks();
    }
    addToast({ type: 'success', title: 'Ricetta eliminata' });
  }

  function editProdotto(p: HaccpProdotto) {
    setEditingId(p.id);
    setFormNome(p.nome_prodotto);
    setFormIngredienti(p.ingredienti);
    setFormAllergeni(p.allergeni);
    setFormGiorni(p.giorni_scadenza);
    setFormConservazione(p.conservazione);
    setFormFornitoriIds(prodottiFornitori[p.id] || []);
    setSubTab('recipes');
  }

  /* ~~~ FORNITORI CRUD ~~~ */

  function resetFornForm() {
    setFornEditId(null);
    setFNome('');
    setFPiva('');
    setFTel('');
    setFInd('');
    setFNote('');
  }

  async function saveFornitore() {
    if (!fNome.trim()) { addToast({ type: 'error', title: 'Errore', message: 'Inserisci il nome del fornitore' }); return; }
    const payload = { nome: fNome.trim(), partita_iva: fPiva.trim(), telefono: fTel.trim(), indirizzo: fInd.trim(), note: fNote.trim() };

    if (IS_DEMO_MODE || !supabase) {
      let updated: HaccpFornitore[];
      if (fornEditId) {
        updated = fornitori.map(f => f.id === fornEditId ? { ...f, ...payload } : f);
      } else {
        updated = [...fornitori, { id: crypto.randomUUID(), ...payload }];
      }
      setFornitori(updated);
      localStorage.setItem('risto_haccp_fornitori', JSON.stringify(updated));
    } else {
      if (fornEditId) {
        await supabase.from('haccp_fornitori').update(payload).eq('id', fornEditId);
      } else {
        await supabase.from('haccp_fornitori').insert([payload]);
      }
      await fetchFornitori();
    }
    resetFornForm();
    addToast({ type: 'success', title: fornEditId ? 'Fornitore aggiornato' : 'Fornitore salvato' });
  }

  async function deleteFornitore(id: string) {
    const ok = await confirm({ title: 'Elimina fornitore', message: 'Eliminare questo fornitore?', destructive: true });
    if (!ok) return;

    if (IS_DEMO_MODE || !supabase) {
      const updated = fornitori.filter(f => f.id !== id);
      setFornitori(updated);
      localStorage.setItem('risto_haccp_fornitori', JSON.stringify(updated));
    } else {
      await supabase.from('haccp_fornitori').delete().eq('id', id);
      await fetchFornitori();
    }
    addToast({ type: 'success', title: 'Fornitore eliminato' });
  }

  function editFornitore(f: HaccpFornitore) {
    setFornEditId(f.id);
    setFNome(f.nome);
    setFPiva(f.partita_iva);
    setFTel(f.telefono);
    setFInd(f.indirizzo);
    setFNote(f.note);
    setSubTab('fornitori');
  }

  /* ~~~ STAMPA ~~~ */

  async function handlePrint() {
    if (!printProdottoId) { addToast({ type: 'error', title: 'Errore', message: 'Seleziona un prodotto' }); return; }
    const p = prodotti.find(x => x.id === printProdottoId);
    if (!p) return;

    setIsPrinting(true);
    try {
      const now = new Date();
      const scad = new Date(now);
      scad.setDate(scad.getDate() + p.giorni_scadenza);

      const data: HaccpLabelData = {
        kind: 'haccp_label',
        nome_prodotto: p.nome_prodotto,
        ingredienti: p.ingredienti,
        allergeni: p.allergeni,
        data_scadenza: formatDate(scad),
        data_preparazione: formatDateTime(now),
        lotto: printLotto.trim() || undefined,
        conservazione: p.conservazione || undefined,
      };
      await printLabelViaAgent(data, PRINT_AGENT_URL);

      // Save to storico etichette
      const etichettaRecord = {
        lotto: printLotto.trim(),
        prodotto_id: p.id,
        data_preparazione: now.toISOString(),
        data_scadenza: scad.toISOString().split('T')[0],
      };
      if (IS_DEMO_MODE || !supabase) {
        const storico = JSON.parse(localStorage.getItem('risto_haccp_etichette') || '[]');
        storico.push({ id: crypto.randomUUID(), ...etichettaRecord, created_at: new Date().toISOString() });
        localStorage.setItem('risto_haccp_etichette', JSON.stringify(storico));
      } else {
        await supabase.from('haccp_etichette').insert([etichettaRecord]);
      }

      addToast({ type: 'success', title: 'Etichetta stampata', message: p.nome_prodotto });
      setPrintLotto(generateLotto());
    } catch (err) {
      addToast({ type: 'error', title: 'Errore stampa', message: String(err) });
    } finally {
      setIsPrinting(false);
    }
  }

  const selectedProdotto = prodotti.find(x => x.id === printProdottoId);
  const nowDate = new Date();
  const scadDate = selectedProdotto ? new Date(nowDate.getTime() + selectedProdotto.giorni_scadenza * 86400000) : null;

  return (
    <div>
      <div className={`flex items-center gap-2 mb-6 ${isEmbedded ? 'text-gray-500' : 'text-slate-400'}`}>
        <ShieldCheck size={18} />
        <span className="text-xs font-black uppercase tracking-widest">Gestione Etichette HACCP</span>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 mb-8 p-1 rounded-2xl w-fit border border-surface-light">
        {([['print', 'Stampa Etichetta', Printer], ['recipes', 'Ricette HACCP', Package], ['fornitori', 'Fornitori', Truck]] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setSubTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all ${subTab === key ? (isEmbedded ? 'bg-gold text-black' : 'bg-white text-slate-900 shadow-md') : 'text-gray-500 hover:text-white'}`}
          >
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>

      {/* Print sub-tab */}
      {subTab === 'print' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className={`${isEmbedded ? 'bg-surface' : 'bg-slate-900'} border border-surface-light rounded-[32px] p-8`}>
            <h3 className="text-2xl font-black italic uppercase tracking-tighter text-white mb-6">Stampa Etichetta</h3>
            <div className="space-y-5">
              <div>
                <label className="text-xs font-black text-gray-400 tracking-widest uppercase mb-2 block">Prodotto</label>
                <select
                  value={printProdottoId}
                  onChange={e => { setPrintProdottoId(e.target.value); setPrintLotto(generateLotto()); }}
                  className="w-full bg-charcoal border border-surface-light rounded-2xl p-4 text-white font-bold outline-none focus:border-gold transition-colors appearance-none"
                >
                  <option value="">Seleziona un prodotto...</option>
                  {prodotti.map(p => (
                    <option key={p.id} value={p.id}>{p.nome_prodotto}</option>
                  ))}
                </select>
              </div>

              {selectedProdotto && (
                <div className={`${isEmbedded ? 'bg-charcoal' : 'bg-slate-800'} rounded-2xl p-6 space-y-3`}>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Data preparazione</p>
                      <p className="text-white font-bold text-lg">{formatDateTime(nowDate)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Data scadenza</p>
                      <p className="text-amber-400 font-bold text-lg">{scadDate ? formatDate(scadDate) : ''}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Allergeni</p>
                    <p className="text-white font-bold">{selectedProdotto.allergeni || '—'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Ingredienti</p>
                    <p className="text-gray-300 text-sm">{selectedProdotto.ingredienti || '—'}</p>
                  </div>
                  {selectedProdotto.conservazione && (
                    <div>
                      <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Conservazione</p>
                      <p className="text-gray-300 text-sm">{selectedProdotto.conservazione}</p>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="text-xs font-black text-gray-400 tracking-widest uppercase mb-2 block">Lotto</label>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={printLotto}
                    onChange={e => setPrintLotto(e.target.value)}
                    className="flex-1 bg-charcoal border border-surface-light rounded-2xl p-4 text-white font-bold outline-none focus:border-gold transition-colors"
                    placeholder="L.shdg"
                  />
                  <button
                    onClick={() => setPrintLotto(generateLotto())}
                    className={`px-4 rounded-2xl font-bold text-xs border ${isEmbedded ? 'border-surface-light text-gray-400 hover:text-white' : 'border-slate-700 text-slate-400 hover:text-white'} transition-all`}
                  >
                    <Copy size={18} />
                  </button>
                </div>
              </div>

              <button
                onClick={handlePrint}
                disabled={isPrinting || !printProdottoId}
                className="w-full bg-gold hover:bg-gold-hover text-black font-black py-4 rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none shadow-xl"
              >
                <Printer size={20} />
                {isPrinting ? 'Stampa in corso...' : 'STAMPA ETICHETTA'}
              </button>
            </div>
          </div>

          {/* Preview */}
          <div className={`${isEmbedded ? 'bg-surface' : 'bg-slate-900'} border border-surface-light rounded-[32px] p-6 flex flex-col items-center`}>
            <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4">Anteprima Etichetta</h3>
            <div className="w-[80mm] bg-white text-black text-[10px] leading-tight font-mono shadow-2xl rounded-sm overflow-hidden">
              <div className="px-3 py-3 space-y-1 text-[9px]">
                <div className="flex justify-between items-start gap-2">
                  <p className="text-sm font-black uppercase tracking-tight leading-tight flex-1">
                    {selectedProdotto?.nome_prodotto || 'PRODOTTO'}
                  </p>
                  {printLotto && (
                    <QRCodeCanvas value={`${window.location.origin}/etichetta/${printLotto}`} size={52} bgColor="#ffffff" fgColor="#000000" level="M" className="shrink-0" />
                  )}
                </div>
                {selectedProdotto?.allergeni && (
                  <p><span className="font-black">Allergeni: </span>{selectedProdotto.allergeni}</p>
                )}
                {selectedProdotto?.ingredienti && (
                  <p className="leading-snug"><span className="font-black">INGREDIENTI: </span>{selectedProdotto.ingredienti}</p>
                )}
                {selectedProdotto?.conservazione && (
                  <p className="leading-snug"><span className="font-black">Conservazione: </span>{selectedProdotto.conservazione}</p>
                )}
                <div className="border-t border-dashed border-gray-400 my-1.5" />
                <div className="flex justify-between text-[8px]">
                  <div>
                    {selectedProdotto && <p><span className="font-black">Preparato il</span> {formatDateTime(nowDate)}</p>}
                    <p><span className="font-black">Scadenza</span> <span className="font-black text-[10px]">{scadDate ? formatDate(scadDate) : ''}</span></p>
                  </div>
                  {printLotto && (
                    <p className="font-black text-[8px]">Lotto: {printLotto}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recipes sub-tab */}
      {subTab === 'recipes' && (
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
          <div className={`xl:col-span-2 ${isEmbedded ? 'bg-surface' : 'bg-slate-900'} border border-surface-light rounded-[32px] p-6 h-fit`}>
            <h3 className="text-lg font-black italic uppercase tracking-tighter text-white mb-6">
              {editingId ? 'Modifica Ricetta' : 'Nuova Ricetta'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase mb-1.5 block">Nome Prodotto *</label>
                <input type="text" value={formNome} onChange={e => setFormNome(e.target.value)} className="w-full bg-charcoal border border-surface-light rounded-2xl p-3.5 text-white font-bold text-sm outline-none focus:border-gold transition-colors" placeholder="es. Acciughe sotto sale" />
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase mb-1.5 block">Ingredienti</label>
                <textarea value={formIngredienti} onChange={e => setFormIngredienti(e.target.value)} rows={3} className="w-full bg-charcoal border border-surface-light rounded-2xl p-3.5 text-white font-bold text-sm outline-none focus:border-gold transition-colors resize-none" placeholder="es. Acciughe, Sale marino. Può contenere lische." />
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase mb-1.5 block">Allergeni</label>
                <input type="text" value={formAllergeni} onChange={e => setFormAllergeni(e.target.value)} className="w-full bg-charcoal border border-surface-light rounded-2xl p-3.5 text-white font-bold text-sm outline-none focus:border-gold transition-colors" placeholder="es. Pesce, Latte" />
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase mb-1.5 block">Fornitori</label>
                {fornitori.length === 0 ? (
                  <p className="text-gray-500 text-xs italic">Nessun fornitore salvato. Vai alla sezione Fornitori per aggiungerne.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {fornitori.map(f => {
                      const checked = formFornitoriIds.includes(f.id);
                      return (
                        <button
                          key={f.id}
                          onClick={() => toggleFornitoreId(f.id)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${checked ? 'bg-gold text-black' : 'bg-charcoal border border-surface-light text-gray-400 hover:text-white'}`}
                        >
                          {f.nome}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase mb-1.5 block">Scade tra (giorni)</label>
                  <input type="number" min={1} value={formGiorni} onChange={e => setFormGiorni(Math.max(1, parseInt(e.target.value) || 1))} className="w-full bg-charcoal border border-surface-light rounded-2xl p-3.5 text-white font-bold text-sm outline-none focus:border-gold transition-colors" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase mb-1.5 block">Conservazione</label>
                  <input type="text" value={formConservazione} onChange={e => setFormConservazione(e.target.value)} className="w-full bg-charcoal border border-surface-light rounded-2xl p-3.5 text-white font-bold text-sm outline-none focus:border-gold transition-colors" placeholder="es. Frigo 0/+6°C" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={saveProdotto} className="flex-1 bg-gold hover:bg-gold-hover text-black font-black py-3.5 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg">
                  <Save size={18} /> {editingId ? 'AGGIORNA' : 'SALVA RICETTA'}
                </button>
                {editingId && (
                  <button onClick={resetForm} className="px-4 rounded-2xl border border-surface-light text-gray-400 hover:text-white font-bold text-xs transition-all">
                    <X size={18} />
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="xl:col-span-3 space-y-3">
            {prodotti.length === 0 && (
              <div className={`${isEmbedded ? 'bg-surface' : 'bg-slate-900'} border border-surface-light rounded-[32px] p-12 text-center`}>
                <Package size={40} className="mx-auto mb-4 text-gray-500" />
                <p className="text-gray-500 font-bold">Nessuna ricetta HACCP salvata.</p>
                <p className="text-gray-600 text-sm mt-1">Creane una usando il form a fianco.</p>
              </div>
            )}
            {prodotti.map(p => {
              const linkedFornitori = (prodottiFornitori[p.id] || []).map(fid => fornitori.find(f => f.id === fid)).filter(Boolean) as HaccpFornitore[];
              return (
                <div key={p.id} className={`${isEmbedded ? 'bg-surface' : 'bg-slate-900'} border border-surface-light rounded-[24px] p-5 flex items-start gap-4 hover:border-gold/30 transition-all group`}>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-white font-black italic text-lg uppercase tracking-tighter">{p.nome_prodotto}</h4>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs font-bold text-gray-500">
                      <span>Scade tra <span className="text-amber-400">{p.giorni_scadenza} giorni</span></span>
                      {p.allergeni && <span>Allergeni: <span className="text-red-400">{p.allergeni}</span></span>}
                    </div>
                    {linkedFornitori.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {linkedFornitori.map(f => (
                          <span key={f.id} className="text-[10px] bg-charcoal text-white font-bold px-2 py-0.5 rounded-full">{f.nome}</span>
                        ))}
                      </div>
                    )}
                    {p.ingredienti && <p className="text-gray-500 text-xs mt-1 line-clamp-1">{p.ingredienti}</p>}
                    {p.conservazione && <p className="text-gray-600 text-xs">{p.conservazione}</p>}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => editProdotto(p)} className={`p-2.5 ${isEmbedded ? 'bg-charcoal text-gray-500 hover:text-white' : 'bg-slate-800 text-slate-400 hover:text-white'} rounded-xl transition-all`}>
                      <Edit2 size={16} />
                    </button>
                    <button onClick={() => deleteProdotto(p.id)} className="p-2.5 bg-charcoal text-gray-500 hover:text-red-400 rounded-xl transition-all">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Fornitori sub-tab */}
      {subTab === 'fornitori' && (
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
          <div className={`xl:col-span-2 ${isEmbedded ? 'bg-surface' : 'bg-slate-900'} border border-surface-light rounded-[32px] p-6 h-fit`}>
            <h3 className="text-lg font-black italic uppercase tracking-tighter text-white mb-6">
              {fornEditId ? 'Modifica Fornitore' : 'Nuovo Fornitore'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase mb-1.5 block">Nome *</label>
                <input type="text" value={fNome} onChange={e => setFNome(e.target.value)} className="w-full bg-charcoal border border-surface-light rounded-2xl p-3.5 text-white font-bold text-sm outline-none focus:border-gold transition-colors" placeholder="es. Agricola Rossi" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase mb-1.5 block">P. IVA</label>
                  <input type="text" value={fPiva} onChange={e => setFPiva(e.target.value)} className="w-full bg-charcoal border border-surface-light rounded-2xl p-3.5 text-white font-bold text-sm outline-none focus:border-gold transition-colors" placeholder="IT01234567890" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase mb-1.5 block">Telefono</label>
                  <input type="text" value={fTel} onChange={e => setFTel(e.target.value)} className="w-full bg-charcoal border border-surface-light rounded-2xl p-3.5 text-white font-bold text-sm outline-none focus:border-gold transition-colors" placeholder="+39 333 1234567" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase mb-1.5 block">Indirizzo</label>
                <input type="text" value={fInd} onChange={e => setFInd(e.target.value)} className="w-full bg-charcoal border border-surface-light rounded-2xl p-3.5 text-white font-bold text-sm outline-none focus:border-gold transition-colors" placeholder="es. Via Roma 1, Milano" />
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase mb-1.5 block">Note</label>
                <textarea value={fNote} onChange={e => setFNote(e.target.value)} rows={2} className="w-full bg-charcoal border border-surface-light rounded-2xl p-3.5 text-white font-bold text-sm outline-none focus:border-gold transition-colors resize-none" placeholder="es. Prodotti biologici certificati" />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={saveFornitore} className="flex-1 bg-gold hover:bg-gold-hover text-black font-black py-3.5 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg">
                  <Save size={18} /> {fornEditId ? 'AGGIORNA' : 'SALVA FORNITORE'}
                </button>
                {fornEditId && (
                  <button onClick={resetFornForm} className="px-4 rounded-2xl border border-surface-light text-gray-400 hover:text-white font-bold text-xs transition-all">
                    <X size={18} />
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="xl:col-span-3 space-y-3">
            {fornitori.length === 0 && (
              <div className={`${isEmbedded ? 'bg-surface' : 'bg-slate-900'} border border-surface-light rounded-[32px] p-12 text-center`}>
                <Truck size={40} className="mx-auto mb-4 text-gray-500" />
                <p className="text-gray-500 font-bold">Nessun fornitore salvato.</p>
                <p className="text-gray-600 text-sm mt-1">Aggiungi un fornitore usando il form a fianco.</p>
              </div>
            )}
            {fornitori.map(f => (
              <div key={f.id} className={`${isEmbedded ? 'bg-surface' : 'bg-slate-900'} border border-surface-light rounded-[24px] p-5 flex items-start gap-4 hover:border-gold/30 transition-all group`}>
                <div className="flex-1 min-w-0">
                  <h4 className="text-white font-black italic text-lg uppercase tracking-tighter">{f.nome}</h4>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs font-bold text-gray-500">
                    {f.partita_iva && <span>P.IVA: {f.partita_iva}</span>}
                    {f.telefono && <span>Tel: {f.telefono}</span>}
                    {f.indirizzo && <span>{f.indirizzo}</span>}
                  </div>
                  {f.note && <p className="text-gray-500 text-xs mt-1">{f.note}</p>}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => editFornitore(f)} className={`p-2.5 ${isEmbedded ? 'bg-charcoal text-gray-500 hover:text-white' : 'bg-slate-800 text-slate-400 hover:text-white'} rounded-xl transition-all`}>
                    <Edit2 size={16} />
                  </button>
                  <button onClick={() => deleteFornitore(f.id)} className="p-2.5 bg-charcoal text-gray-500 hover:text-red-400 rounded-xl transition-all">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
