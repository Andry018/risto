import { useState, useMemo } from 'react';
import { X, Plus } from 'lucide-react';
import { type Product, type CustomizedItem, type Portata, PORTATE } from '../lib/supabase';
import { PANINO_CATEGORIES, PANINO_BASE_PRICE, COTTURE } from '../lib/paninoConfig';
import { newUniqueId } from '../lib/id';

interface Props {
  isOpen: boolean;
  products: Product[];
  currentPortata: Portata;
  variant?: 'default' | 'pos';
  onClose: () => void;
  onSave: (item: CustomizedItem) => void;
}

interface Selection {
  itemNome: string;
  cottura?: string;
  contornoDelGiorno?: string;
}

export default function PaninoBuilderModal({ isOpen, products, currentPortata, variant = 'default', onClose, onSave }: Props) {
  const [clienteNome, setClienteNome] = useState('');
  const [selections, setSelections] = useState<Selection[]>([]);
  const [expandedCats, setExpandedCats] = useState<string[]>(PANINO_CATEGORIES.map(c => c.label));
  const [activePortata, setActivePortata] = useState<Portata>(currentPortata);

  const contorniProducts = useMemo(() =>
    products.filter(p => p.categoria === 'Contorni' && p.disponibile),
    [products]
  );

  const isSelected = (itemNome: string) => selections.some(s => s.itemNome === itemNome);

  const toggleItem = (itemNome: string, hasCottura?: boolean, isContorniDelGiorno?: boolean) => {
    setSelections(prev => {
      if (prev.some(s => s.itemNome === itemNome)) {
        return prev.filter(s => s.itemNome !== itemNome);
      }
      const sel: Selection = { itemNome };
      if (hasCottura) sel.cottura = 'Medio';
      if (isContorniDelGiorno && contorniProducts.length > 0) {
        sel.contornoDelGiorno = contorniProducts[0].nome;
      }
      return [...prev, sel];
    });
  };

  const setCottura = (itemNome: string, cottura: string) => {
    setSelections(prev => prev.map(s => s.itemNome === itemNome ? { ...s, cottura } : s));
  };

  const setContorno = (itemNome: string, contornoDelGiorno: string) => {
    setSelections(prev => prev.map(s => s.itemNome === itemNome ? { ...s, contornoDelGiorno } : s));
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

  const selectedCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const cat of PANINO_CATEGORIES) {
      counts[cat.label] = cat.items.filter(i => isSelected(i.nome)).length;
    }
    return counts;
  }, [isSelected]);

  const toggleCategory = (label: string) => {
    setExpandedCats(prev =>
      prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]
    );
  };

  const handleSave = () => {
    if (!clienteNome.trim()) return;

    const parts: string[] = [];
    for (const sel of selections) {
      let desc = sel.itemNome;
      if (sel.cottura) desc += ` (${sel.cottura})`;
      if (sel.contornoDelGiorno) desc += ` → ${sel.contornoDelGiorno}`;
      parts.push(desc);
    }

    const item: CustomizedItem = {
      id: 'panino-builder',
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
    };
    onSave(item);
    reset();
    onClose();
  };

  const reset = () => {
    setClienteNome('');
    setSelections([]);
    setActivePortata(currentPortata);
  };

  if (!isOpen) return null;

  const isPos = variant === 'pos';

  return (
    <div className="fixed inset-0 z-[110] flex bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
      <div className={`flex-1 flex flex-col mx-auto ${isPos ? 'max-w-6xl' : 'max-w-2xl'}`}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-surface-light">
          <div>
            <h2 className="text-xl font-black italic uppercase text-white">Componi Panino</h2>
            <p className="text-[10px] font-black text-gold uppercase tracking-widest mt-0.5">Base €{PANINO_BASE_PRICE.toFixed(2)}</p>
          </div>
          <button onClick={() => { reset(); onClose(); }} className="p-2 bg-surface rounded-xl text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className={`flex-1 overflow-y-auto p-4 sm:p-6 ${isPos ? 'space-y-4' : 'space-y-5'}`}>
          {/* Portata + Nome cliente side by side on POS */}
          {isPos ? (
            <div className="flex gap-4 items-start">
              <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
                {PORTATE.map(p => (
                  <button
                    key={p.value}
                    onClick={() => setActivePortata(p.value)}
                    className={`shrink-0 px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest border transition-all ${
                      activePortata === p.value
                        ? `${p.color} border-current`
                        : 'bg-charcoal border-surface-light text-gray-500'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="flex-1 min-w-0">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-1.5">Nome Cliente</label>
                <input
                  type="text"
                  value={clienteNome}
                  onChange={e => setClienteNome(e.target.value)}
                  placeholder="Inserisci nome..."
                  className="w-full bg-surface border border-surface-light rounded-2xl py-3.5 px-4 text-white font-bold outline-none focus:border-gold transition-all text-base"
                  autoFocus
                />
              </div>
            </div>
          ) : (
            <>
              <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
                {PORTATE.map(p => (
                  <button
                    key={p.value}
                    onClick={() => setActivePortata(p.value)}
                    className={`shrink-0 px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest border transition-all ${
                      activePortata === p.value
                        ? `${p.color} border-current`
                        : 'bg-charcoal border-surface-light text-gray-500'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-1.5">Nome Cliente</label>
                <input
                  type="text"
                  value={clienteNome}
                  onChange={e => setClienteNome(e.target.value)}
                  placeholder="Inserisci nome..."
                  className="w-full bg-surface border border-surface-light rounded-2xl py-3.5 px-4 text-white font-bold outline-none focus:border-gold transition-all text-base"
                  autoFocus
                />
              </div>
            </>
          )}

          {/* Categories — stacked per variant */}
          {isPos ? (
            <div className="grid grid-cols-2 gap-4">
              {PANINO_CATEGORIES.map(cat => (
                <div key={cat.label} className="bg-surface border border-surface-light rounded-3xl overflow-hidden">
                  <button
                    onClick={() => toggleCategory(cat.label)}
                    className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-black text-sm uppercase tracking-wider text-white">{cat.label}</span>
                      {selectedCounts[cat.label] > 0 && (
                        <span className="bg-gold/20 text-gold text-[10px] font-black px-2 py-0.5 rounded-full border border-gold/30">
                          {selectedCounts[cat.label]}
                        </span>
                      )}
                    </div>
                    <span className="text-gray-500 font-bold text-sm">{expandedCats.includes(cat.label) ? '−' : '+'}</span>
                  </button>
                  {expandedCats.includes(cat.label) && (
                    <div className="px-4 pb-3 space-y-1">
                      {cat.items.map(item => (
                        <div key={item.nome}>
                          <button
                            onClick={() => toggleItem(item.nome, item.hasCottura, item.isContorniDelGiorno)}
                            className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all ${
                              isSelected(item.nome)
                                ? 'bg-gold/10 border border-gold/30'
                                : 'bg-charcoal border border-surface-light hover:border-gray-600'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                                isSelected(item.nome)
                                  ? 'bg-gold border-gold'
                                  : 'border-gray-600 bg-charcoal'
                              }`}>
                                {isSelected(item.nome) && <span className="text-black text-[10px] font-black">✓</span>}
                              </div>
                              <span className={`font-bold text-sm ${isSelected(item.nome) ? 'text-white' : 'text-gray-400'}`}>
                                {item.nome}
                              </span>
                            </div>
                            <span className="font-black text-sm text-gold">€{item.prezzo.toFixed(2)}</span>
                          </button>
                          {item.hasCottura && isSelected(item.nome) && (
                            <div className="flex gap-2 mt-1 ml-10 mb-2">
                              {COTTURE.map(c => {
                                const sel = selections.find(s => s.itemNome === item.nome);
                                return (
                                  <button
                                    key={c}
                                    onClick={() => setCottura(item.nome, c)}
                                    className={`px-3 py-1.5 rounded-lg font-black text-[9px] uppercase tracking-wider border transition-all ${
                                      sel?.cottura === c
                                        ? 'bg-rose-500/20 border-rose-500/40 text-rose-400'
                                        : 'bg-charcoal border-surface-light text-gray-500'
                                    }`}
                                  >
                                    {c}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                          {item.isContorniDelGiorno && isSelected(item.nome) && contorniProducts.length > 0 && (
                            <div className="mt-1 ml-10 mb-2 space-y-1">
                              {contorniProducts.map(p => {
                                const sel = selections.find(s => s.itemNome === item.nome);
                                return (
                                  <button
                                    key={p.id}
                                    onClick={() => setContorno(item.nome, p.nome)}
                                    className={`block w-full text-left px-3 py-1.5 rounded-lg font-bold text-xs border transition-all ${
                                      sel?.contornoDelGiorno === p.nome
                                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                                        : 'bg-charcoal border-surface-light text-gray-400'
                                    }`}
                                  >
                                    {p.nome}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <>
              {PANINO_CATEGORIES.map(cat => (
                <div key={cat.label} className="bg-surface border border-surface-light rounded-3xl overflow-hidden">
                  <button
                    onClick={() => toggleCategory(cat.label)}
                    className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-black text-sm uppercase tracking-wider text-white">{cat.label}</span>
                      {selectedCounts[cat.label] > 0 && (
                        <span className="bg-gold/20 text-gold text-[10px] font-black px-2 py-0.5 rounded-full border border-gold/30">
                          {selectedCounts[cat.label]}
                        </span>
                      )}
                    </div>
                    <span className="text-gray-500 font-bold text-sm">{expandedCats.includes(cat.label) ? '−' : '+'}</span>
                  </button>
                  {expandedCats.includes(cat.label) && (
                    <div className="px-4 pb-3 space-y-1">
                      {cat.items.map(item => (
                        <div key={item.nome}>
                          <button
                            onClick={() => toggleItem(item.nome, item.hasCottura, item.isContorniDelGiorno)}
                            className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all ${
                              isSelected(item.nome)
                                ? 'bg-gold/10 border border-gold/30'
                                : 'bg-charcoal border border-surface-light hover:border-gray-600'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                                isSelected(item.nome)
                                  ? 'bg-gold border-gold'
                                  : 'border-gray-600 bg-charcoal'
                              }`}>
                                {isSelected(item.nome) && <span className="text-black text-[10px] font-black">✓</span>}
                              </div>
                              <span className={`font-bold text-sm ${isSelected(item.nome) ? 'text-white' : 'text-gray-400'}`}>
                                {item.nome}
                              </span>
                            </div>
                            <span className="font-black text-sm text-gold">€{item.prezzo.toFixed(2)}</span>
                          </button>
                          {item.hasCottura && isSelected(item.nome) && (
                            <div className="flex gap-2 mt-1 ml-10 mb-2">
                              {COTTURE.map(c => {
                                const sel = selections.find(s => s.itemNome === item.nome);
                                return (
                                  <button
                                    key={c}
                                    onClick={() => setCottura(item.nome, c)}
                                    className={`px-3 py-1.5 rounded-lg font-black text-[9px] uppercase tracking-wider border transition-all ${
                                      sel?.cottura === c
                                        ? 'bg-rose-500/20 border-rose-500/40 text-rose-400'
                                        : 'bg-charcoal border-surface-light text-gray-500'
                                    }`}
                                  >
                                    {c}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                          {item.isContorniDelGiorno && isSelected(item.nome) && contorniProducts.length > 0 && (
                            <div className="mt-1 ml-10 mb-2 space-y-1">
                              {contorniProducts.map(p => {
                                const sel = selections.find(s => s.itemNome === item.nome);
                                return (
                                  <button
                                    key={p.id}
                                    onClick={() => setContorno(item.nome, p.nome)}
                                    className={`block w-full text-left px-3 py-1.5 rounded-lg font-bold text-xs border transition-all ${
                                      sel?.contornoDelGiorno === p.nome
                                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                                        : 'bg-charcoal border-surface-light text-gray-400'
                                    }`}
                                  >
                                    {p.nome}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-6 border-t border-surface-light bg-surface/90 backdrop-blur-xl space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Totale</span>
            <span className="text-3xl font-black text-gold italic">€{total.toFixed(2)}</span>
          </div>
          <button
            onClick={handleSave}
            disabled={!clienteNome.trim() || selections.length === 0}
            className="w-full bg-gold hover:bg-gold-hover text-black font-black py-4 rounded-2xl text-sm flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-30 shadow-xl shadow-gold/20"
          >
            <Plus size={20} /> AGGIUNGI AL CONTO
          </button>
        </div>
      </div>
    </div>
  );
}
