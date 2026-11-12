import { useState, useMemo, useRef } from 'react';
import { X, Plus, ChevronDown } from 'lucide-react';
import type { Product, CustomizedItem, Portata } from '../types/entities';
import { PANINO_CATEGORIES, PANINO_BASE_PRICE, PANINO_COMPOSTO_ID, COTTURE, type PaninoItem } from '../lib/paninoConfig';
import { newUniqueId } from '../lib/id';

const PORTATA_OPTIONS = [
  { value: '1', label: '1ª', color: 'text-rose-400 border-rose-500/60 bg-rose-500/15' },
  { value: '2', label: '2ª', color: 'text-sky-400 border-sky-500/60 bg-sky-500/15' },
  { value: '3', label: '3ª', color: 'text-amber-400 border-amber-500/60 bg-amber-500/15' },
  { value: '4', label: '4ª', color: 'text-emerald-400 border-emerald-500/60 bg-emerald-500/15' },
  { value: '5', label: '5ª', color: 'text-fuchsia-400 border-fuchsia-500/60 bg-fuchsia-500/15' },
] as const;

interface Props {
  isOpen: boolean;
  products: Product[];
  currentPortata: Portata;
  /** 'pos' = schermo largo (tablet/PC): categorie su due colonne da md in su. */
  variant?: 'default' | 'pos';
  onClose: () => void;
  onSave: (item: CustomizedItem) => void;
}

interface Selection {
  itemNome: string;
  cottura?: string;
  contornoDelGiorno?: string;
}

/** Solo con mouse/tastiera fisica: sul telefono il focus automatico apre la tastiera e copre la lista. */
const hasFinePointer = () => typeof window !== 'undefined' && window.matchMedia?.('(pointer: fine)').matches;

export default function PaninoBuilderModal({ isOpen, products, currentPortata, variant = 'default', onClose, onSave }: Props) {
  const [clienteNome, setClienteNome] = useState('');
  const [selections, setSelections] = useState<Selection[]>([]);
  const [collapsedCats, setCollapsedCats] = useState<string[]>([]);
  const [activePortata, setActivePortata] = useState<Portata>(currentPortata);
  const nameRef = useRef<HTMLInputElement>(null);

  const contorniProducts = useMemo(() =>
    products.filter(p => p.categoria === 'Contorni' && p.disponibile),
    [products]
  );

  const selectionOf = (itemNome: string) => selections.find(s => s.itemNome === itemNome);

  const toggleItem = (item: PaninoItem) => {
    setSelections(prev => {
      if (prev.some(s => s.itemNome === item.nome)) return prev.filter(s => s.itemNome !== item.nome);
      const sel: Selection = { itemNome: item.nome };
      if (item.hasCottura) sel.cottura = 'Medio';
      if (item.isContorniDelGiorno && contorniProducts.length > 0) sel.contornoDelGiorno = contorniProducts[0].nome;
      return [...prev, sel];
    });
  };

  const updateSelection = (itemNome: string, patch: Partial<Selection>) => {
    setSelections(prev => prev.map(s => s.itemNome === itemNome ? { ...s, ...patch } : s));
  };

  const total = useMemo(() => {
    let t = PANINO_BASE_PRICE;
    for (const sel of selections) {
      for (const cat of PANINO_CATEGORIES) {
        const item = cat.items.find(i => i.nome === sel.itemNome);
        if (item) t += item.prezzo;
      }
    }
    return t;
  }, [selections]);

  const toggleCategory = (label: string) => {
    setCollapsedCats(prev => prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]);
  };

  const reset = () => {
    setClienteNome('');
    setSelections([]);
    setCollapsedCats([]);
    setActivePortata(currentPortata);
  };

  const close = () => { reset(); onClose(); };

  const handleSave = () => {
    if (!clienteNome.trim()) {
      // Il nome sta in alto: ci si riporta lì invece di lasciare un pulsante spento senza spiegazioni
      nameRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      nameRef.current?.focus();
      return;
    }
    if (selections.length === 0) return;

    const parts = selections.map(sel => {
      let desc = sel.itemNome;
      if (sel.cottura) desc += ` (${sel.cottura})`;
      if (sel.contornoDelGiorno) desc += ` → ${sel.contornoDelGiorno}`;
      return desc;
    });

    onSave({
      id: PANINO_COMPOSTO_ID,
      nome: `Panino: ${clienteNome.trim()}`,
      prezzo: total,
      categoria: 'Panini',
      sottocategoria: undefined,
      disponibile: true,
      ingredienti: [],
      quantity: 1,
      addedIngredients: [],
      removedIngredients: [],
      notes: parts.join(', '),
      uniqueId: newUniqueId(),
      portata: activePortata,
    });
    close();
  };

  if (!isOpen) return null;

  const isPos = variant === 'pos';
  const nomeMancante = !clienteNome.trim();

  return (
    <div
      className="fixed inset-0 z-[150] flex justify-center bg-charcoal animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-label="Componi panino"
    >
      <div className={`w-full h-dvh flex flex-col ${isPos ? 'max-w-6xl' : 'max-w-2xl'}`}>
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between gap-3 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] border-b border-surface-light">
          <div className="min-w-0">
            <h2 className="text-lg font-black uppercase text-white leading-tight">Componi panino</h2>
            <p className="text-[11px] font-bold text-gold">Pane €{PANINO_BASE_PRICE.toFixed(2)} + ingredienti</p>
          </div>
          <button onClick={close} aria-label="Chiudi" className="p-2.5 bg-surface rounded-xl text-gray-400 hover:text-white transition-colors">
            <X size={22} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-4 space-y-4">
          {/* Nome cliente + uscita */}
          <div className={isPos ? 'md:flex md:items-end md:gap-4 space-y-3 md:space-y-0' : 'space-y-3'}>
            <div className="flex-1 min-w-0">
              <label htmlFor="panino-nome" className="text-[11px] font-black text-gray-400 uppercase tracking-widest block mb-1.5">Nome cliente</label>
              <input
                id="panino-nome"
                ref={nameRef}
                type="text"
                value={clienteNome}
                onChange={e => setClienteNome(e.target.value)}
                placeholder="Per chi è il panino?"
                enterKeyHint="done"
                autoComplete="off"
                className="w-full bg-surface border border-surface-light rounded-2xl py-3 px-4 text-white font-bold outline-none focus:border-gold transition-all text-base"
                autoFocus={hasFinePointer()}
              />
            </div>
            <div>
              <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest block mb-1.5">Uscita</span>
              <div className="grid grid-cols-5 gap-2">
                {PORTATA_OPTIONS.map(p => (
                  <button
                    key={p.value}
                    onClick={() => setActivePortata(p.value)}
                    aria-pressed={activePortata === p.value}
                    className={`h-11 md:px-4 rounded-xl font-black text-sm border transition-all ${
                      activePortata === p.value ? p.color : 'bg-surface border-surface-light text-gray-500'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Ingredienti per categoria */}
          <div className={isPos ? 'grid grid-cols-1 md:grid-cols-2 gap-4 items-start' : 'space-y-4'}>
            {PANINO_CATEGORIES.map(cat => {
              const open = !collapsedCats.includes(cat.label);
              const count = cat.items.filter(i => selectionOf(i.nome)).length;
              return (
                <section key={cat.label} className="bg-surface border border-surface-light rounded-2xl overflow-hidden">
                  <button
                    onClick={() => toggleCategory(cat.label)}
                    aria-expanded={open}
                    className="w-full flex items-center justify-between px-4 py-3"
                  >
                    <span className="flex items-center gap-2">
                      <span className="font-black text-sm uppercase tracking-wider text-white">{cat.label}</span>
                      {count > 0 && (
                        <span className="bg-gold text-black text-[11px] font-black min-w-5 h-5 px-1.5 rounded-full flex items-center justify-center">{count}</span>
                      )}
                    </span>
                    <ChevronDown size={18} className={`text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
                  </button>
                  {open && (
                    <div className="px-2 pb-2 space-y-1.5">
                      {cat.items.map(item => {
                        const sel = selectionOf(item.nome);
                        return (
                          <div key={item.nome}>
                            <button
                              onClick={() => toggleItem(item)}
                              aria-pressed={!!sel}
                              className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl border text-left transition-all active:scale-[0.99] ${
                                sel ? 'bg-gold/10 border-gold/50' : 'bg-charcoal border-surface-light'
                              }`}
                            >
                              <span className={`w-6 h-6 shrink-0 rounded-md border-2 flex items-center justify-center ${
                                sel ? 'bg-gold border-gold' : 'border-gray-600'
                              }`}>
                                {sel && <span className="text-black text-xs font-black">✓</span>}
                              </span>
                              <span className={`flex-1 min-w-0 font-bold text-[15px] leading-snug ${sel ? 'text-white' : 'text-gray-300'}`}>
                                {item.nome}
                              </span>
                              <span className="shrink-0 font-black text-sm text-gold tabular-nums">+€{item.prezzo.toFixed(2)}</span>
                            </button>

                            {item.hasCottura && sel && (
                              <div className="grid grid-cols-3 gap-2 mt-1.5 mb-1 pl-9">
                                {COTTURE.map(c => (
                                  <button
                                    key={c}
                                    onClick={() => updateSelection(item.nome, { cottura: c })}
                                    aria-pressed={sel.cottura === c}
                                    className={`py-2.5 rounded-lg font-black text-xs uppercase border transition-all ${
                                      sel.cottura === c
                                        ? 'bg-rose-500/20 border-rose-500/60 text-rose-300'
                                        : 'bg-charcoal border-surface-light text-gray-400'
                                    }`}
                                  >
                                    {c}
                                  </button>
                                ))}
                              </div>
                            )}

                            {item.isContorniDelGiorno && sel && contorniProducts.length > 0 && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-1.5 mb-1 pl-9">
                                {contorniProducts.map(p => (
                                  <button
                                    key={p.id}
                                    onClick={() => updateSelection(item.nome, { contornoDelGiorno: p.nome })}
                                    aria-pressed={sel.contornoDelGiorno === p.nome}
                                    className={`text-left px-3 py-2.5 rounded-lg font-bold text-sm border transition-all ${
                                      sel.contornoDelGiorno === p.nome
                                        ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300'
                                        : 'bg-charcoal border-surface-light text-gray-400'
                                    }`}
                                  >
                                    {p.nome}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </div>

        {/* Footer: totale e conferma su una riga */}
        <div className="shrink-0 flex items-center gap-3 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-surface-light bg-surface">
          <div className="shrink-0">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">
              {selections.length} {selections.length === 1 ? 'ingrediente' : 'ingredienti'}
            </p>
            <p className="text-2xl font-black text-gold tabular-nums leading-tight">€{total.toFixed(2)}</p>
          </div>
          <button
            onClick={handleSave}
            disabled={!nomeMancante && selections.length === 0}
            className="flex-1 min-w-0 bg-gold hover:bg-gold-hover text-black font-black py-4 px-3 rounded-2xl text-sm flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-30"
          >
            {nomeMancante ? 'Scrivi il nome' : selections.length === 0 ? 'Scegli gli ingredienti' : <><Plus size={20} /> Aggiungi al conto</>}
          </button>
        </div>
      </div>
    </div>
  );
}
