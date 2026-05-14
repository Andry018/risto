import { useState, useEffect } from 'react';
import { type Product, type Ingredient, type CustomizedItem, PORTATE } from '../lib/supabase';
import { calculateItemPrice } from '../lib/priceUtils';
import { Minus, Plus, Search, X, AlertCircle, Split } from 'lucide-react';

interface Props {
  isOpen: boolean;
  editingItem: CustomizedItem | null;
  ingredients: Ingredient[];
  products?: Product[];
  variant?: 'desktop' | 'mobile';
  onClose: () => void;
  onSave: (item: CustomizedItem) => void;
  onDuettoSave?: (item: CustomizedItem, pairedId: string, pairedName: string) => void;
}

export default function ProductCustomizationModal({ isOpen, editingItem, ingredients, products, variant = 'desktop', onClose, onSave, onDuettoSave }: Props) {
  const [localItem, setLocalItem] = useState<CustomizedItem | null>(null);
  const [ingSearch, setIngSearch] = useState('');
  const [duettoActive, setDuettoActive] = useState(false);
  const [duettoPairId, setDuettoPairId] = useState('');
  const [duettoPairName, setDuettoPairName] = useState('');
  const [duettoSearch, setDuettoSearch] = useState('');

  useEffect(() => {
    if (isOpen && editingItem) {
      setLocalItem({ ...editingItem });
      setIngSearch('');
      setDuettoActive(false);
      setDuettoPairId('');
      setDuettoPairName('');
      setDuettoSearch('');
    }
    if (!isOpen) {
      setLocalItem(null);
      setIngSearch('');
      setDuettoActive(false);
      setDuettoPairId('');
      setDuettoPairName('');
      setDuettoSearch('');
    }
  }, [isOpen, editingItem]);

  if (!isOpen || !localItem) return null;

  const portataSection = (
    <section>
      <h3 className="text-[10px] font-black text-gray-500 tracking-widest uppercase mb-3">Portata</h3>
      <div className="flex flex-wrap gap-2">
        {PORTATE.map(p => {
          const isActive = localItem.portata === p.value;
          return (
            <button
              key={p.value}
              onClick={() => setLocalItem({ ...localItem, portata: p.value })}
              className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase border transition-all ${
                isActive
                  ? `${p.color} border-current shadow-lg`
                  : 'bg-charcoal border-surface-light text-gray-500 hover:text-white'
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>
    </section>
  );

  const removalsSection = (
    <section>
      <h3 className="text-[10px] font-black text-gray-500 tracking-widest uppercase mb-4 flex items-center gap-2">
        <Minus size={14} className="text-red-500" /> {variant === 'mobile' ? 'RIMOZIONI' : 'Togli ingredienti'}
      </h3>
      <div className="flex flex-wrap gap-2">
        {localItem.ingredienti?.map(ing => {
          const isRemoved = localItem.removedIngredients.includes(ing);
          const removalPrice = ingredients.find(i => i.nome.toLowerCase() === ing.toLowerCase())?.prezzo_rimozione || 0;
          return (
            <button
              key={ing}
              onClick={() => {
                if (isRemoved) setLocalItem({ ...localItem, removedIngredients: localItem.removedIngredients.filter(r => r !== ing) });
                else setLocalItem({ ...localItem, removedIngredients: [...localItem.removedIngredients, ing] });
              }}
              className={`px-4 py-2.5 rounded-xl font-bold text-[10px] border transition-all ${isRemoved ? 'bg-red-500 border-red-500 text-white shadow-lg shadow-red-500/20' : 'bg-charcoal border-surface-light text-gray-400 hover:border-surface-light-hover'}`}
            >
              {isRemoved ? `NO ${ing.toUpperCase()} -€${removalPrice.toFixed(2)}` : ing.toUpperCase()}
            </button>
          );
        })}
      </div>
    </section>
  );

  const isPizza = localItem.categoria.startsWith('Pizze');
  const isPrimo = localItem.categoria === 'Primo' || localItem.categoria === 'Primi';
  const isSecondo = localItem.categoria === 'Secondo' || localItem.categoria === 'Secondi';
  const isContorno = localItem.categoria === 'Contorni';
  const hasIngredients = (localItem.ingredienti?.length ?? 0) > 0;

  const toggleVariant = (variant: string, price?: number) => {
    let newNotes = localItem.notes;
    let newAdded = [...localItem.addedIngredients];
    const isActive = newNotes.includes(variant);
    if (isActive) {
      newNotes = newNotes.replace(variant, '').replace(/,\s*,/g, ',').replace(/^,\s*/, '').replace(/,\s*$/, '').trim();
      if (price) newAdded = newAdded.filter(a => a.nome !== variant);
    } else {
      newNotes = newNotes ? `${newNotes}, ${variant}` : variant;
      if (price) newAdded.push({ nome: variant, prezzo: price });
    }
    setLocalItem({ ...localItem, notes: newNotes, addedIngredients: newAdded });
  };

  const handleSave = () => {
    if (!localItem) return;
    if (duettoActive && duettoPairId && onDuettoSave) {
      const updated = {
        ...localItem,
        notes: localItem.notes
          ? `${localItem.notes}, DUETTO CON: ${duettoPairName}`
          : `DUETTO CON: ${duettoPairName}`
      };
      onDuettoSave(updated, duettoPairId, duettoPairName);
    } else {
      onSave(localItem);
    }
    setLocalItem(null);
    setIngSearch('');
  };

  const setCottura = (cottura: string) => {
    const cleaned = localItem.notes
      .replace(/Al sangue|Media|Ben cotta/g, '')
      .replace(/,\s*,/g, ',').replace(/^,\s*/, '').replace(/,\s*$/, '').trim();
    const newNotes = cleaned ? `${cleaned}, ${cottura}` : cottura;
    setLocalItem({ ...localItem, notes: newNotes });
  };

  const categorySection = isPizza ? (
    <section>
      <h3 className="text-[10px] font-black text-gray-500 tracking-widest uppercase mb-4 flex items-center gap-2">
        <AlertCircle size={14} className="text-gold" /> VARIANTI RAPIDE
      </h3>
      <div className="flex flex-wrap gap-2">
        {[
          { label: 'Rosè' }, { label: 'Bianca' }, { label: 'Rossa' },
          { label: 'Cottura ++' }, { label: 'Patatine', price: 1.0 },
          { label: 'Senza Glutine', price: 5.0 }, { label: 'Senza Lattosio', price: 1.5 },
        ].map(v => {
          const isActive = localItem.notes.includes(v.label);
          return (
            <button
              key={v.label}
              onClick={() => toggleVariant(v.label, v.price)}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase border transition-all ${isActive ? 'bg-gold border-gold text-black shadow-lg shadow-gold/20' : 'bg-charcoal border-surface-light text-gray-500 hover:text-white'}`}
            >
              {v.label}
            </button>
          );
        })}
      </div>

      {/* Duetto */}
      {products && (
        <div className="mt-5 pt-4 border-t border-surface-light">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-[10px] font-black text-gray-500 tracking-widest uppercase flex items-center gap-2">
              <Split size={14} className="text-gold" /> DUETTO
            </h4>
            <button
              onClick={() => { setDuettoActive(!duettoActive); if (!duettoActive) { setDuettoPairId(''); setDuettoPairName(''); setDuettoSearch(''); } }}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase border transition-all ${duettoActive ? 'bg-gold border-gold text-black shadow-lg shadow-gold/20' : 'bg-charcoal border-surface-light text-gray-500 hover:text-white'}`}
            >
              {duettoActive ? 'DUETTO ✓' : 'DUETTO'}
            </button>
          </div>
          {duettoActive && (
            <div className="space-y-2">
              <div className="relative">
                <input
                  type="text"
                  value={duettoSearch}
                  onChange={e => setDuettoSearch(e.target.value)}
                  placeholder="Cerca pizza da abbinare..."
                  className="w-full bg-charcoal border border-surface-light rounded-xl py-2.5 pl-4 pr-10 text-sm font-bold text-white outline-none focus:border-gold transition-all"
                />
                {duettoPairId && (
                  <button onClick={() => { setDuettoPairId(''); setDuettoPairName(''); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                    <X size={14} />
                  </button>
                )}
              </div>
              {duettoPairId ? (
                <div className="bg-gold/10 border border-gold/30 rounded-xl px-4 py-3 flex items-center gap-3">
                  <span className="text-sm font-black text-gold">{duettoPairName}</span>
                  <span className="text-[9px] text-gray-500">✓ selezionata</span>
                </div>
              ) : (
                <div className="max-h-32 overflow-y-auto space-y-1 custom-scrollbar">
                  {products
                    .filter(p => p.categoria.startsWith('Pizze') && p.disponibile && p.id !== localItem.id && p.nome.toLowerCase().includes(duettoSearch.toLowerCase()))
                    .map(p => (
                      <button
                        key={p.id}
                        onClick={() => { setDuettoPairId(p.id); setDuettoPairName(p.nome); }}
                        className="w-full text-left px-4 py-2.5 rounded-xl font-bold text-xs border border-surface-light bg-charcoal text-gray-300 hover:border-gold/40 hover:text-white transition-all"
                      >
                        {p.nome}
                      </button>
                    ))}
                  {products.filter(p => p.categoria.startsWith('Pizze') && p.disponibile && p.id !== localItem.id).length === 0 && (
                    <p className="text-gray-600 text-xs italic py-2 text-center">Nessuna pizza disponibile</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  ) : isPrimo ? (
    <section>
      <h3 className="text-[10px] font-black text-gray-500 tracking-widest uppercase mb-4 flex items-center gap-2">
        <AlertCircle size={14} className="text-gold" /> MODIFICHE
      </h3>
      <div className="flex flex-wrap gap-2">
        {[
          { label: 'Diviso in Due Piatti' },
          { label: 'Con Formaggio', price: 1.5 },
          { label: 'Con Piccante', price: 1.0 },
          { label: 'Senza Glutine', price: 2.0 },
          { label: 'Senza Lattosio', price: 1.5 },
        ].map(v => {
          const isActive = localItem.notes.includes(v.label);
          return (
            <button
              key={v.label}
              onClick={() => toggleVariant(v.label, v.price)}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase border transition-all ${isActive ? 'bg-gold border-gold text-black shadow-lg shadow-gold/20' : 'bg-charcoal border-surface-light text-gray-500 hover:text-white'}`}
            >
              {v.label}{v.price ? ` +€${v.price.toFixed(2)}` : ''}
            </button>
          );
        })}
      </div>
    </section>
  ) : isSecondo ? (
    <section>
      <h3 className="text-[10px] font-black text-gray-500 tracking-widest uppercase mb-4 flex items-center gap-2">
        <AlertCircle size={14} className="text-gold" /> COTTURA
      </h3>
      <div className="flex flex-wrap gap-2">
        {['Al sangue', 'Media', 'Ben cotta'].map(c => {
          const isActive = localItem.notes.includes(c);
          return (
            <button
              key={c}
              onClick={() => setCottura(c)}
              className={`px-4 py-2.5 rounded-xl font-bold text-[10px] uppercase border transition-all ${
                isActive
                  ? 'bg-rose-500 border-rose-500 text-white shadow-lg shadow-rose-500/20'
                  : 'bg-charcoal border-surface-light text-gray-400 hover:text-white'
              }`}
            >
              {c}
            </button>
          );
        })}
      </div>
      <h3 className="text-[10px] font-black text-gray-500 tracking-widest uppercase mb-4 mt-6 flex items-center gap-2">
        <AlertCircle size={14} className="text-gold" /> GLASSA / CONDIMENTI
      </h3>
      <div className="flex flex-wrap gap-2">
        {['Con glassa', 'Senza glassa'].map(v => {
          const isActive = localItem.notes.includes(v);
          return (
            <button
              key={v}
              onClick={() => toggleVariant(v)}
              className={`px-4 py-2.5 rounded-xl font-bold text-[10px] uppercase border transition-all ${isActive ? 'bg-emerald-500 border-emerald-500 text-black shadow-lg shadow-emerald-500/20' : 'bg-charcoal border-surface-light text-gray-400 hover:text-white'}`}
            >
              {v}
            </button>
          );
        })}
      </div>
    </section>
  ) : isContorno ? (
    <section>
      <h3 className="text-[10px] font-black text-gray-500 tracking-widest uppercase mb-4 flex items-center gap-2">
        <AlertCircle size={14} className="text-gold" /> CONDIMENTI
      </h3>
      <div className="flex flex-wrap gap-2">
        {['Limone', 'Sale e Olio', 'Balsamico', 'Glassa'].map(v => {
          const isActive = localItem.notes.includes(v);
          return (
            <button
              key={v}
              onClick={() => toggleVariant(v)}
              className={`px-4 py-2.5 rounded-xl font-bold text-[10px] uppercase border transition-all ${isActive ? 'bg-emerald-500 border-emerald-500 text-black shadow-lg shadow-emerald-500/20' : 'bg-charcoal border-surface-light text-gray-400 hover:text-white'}`}
            >
              {v}
            </button>
          );
        })}
      </div>
    </section>
  ) : null;

  const notesSection = (
    <section>
      <h3 className="text-[10px] font-black text-gray-500 tracking-widest uppercase mb-4">NOTE SPECIALI</h3>
      <textarea
        rows={2}
        placeholder={variant === 'mobile' ? 'Esempio: Ben cotta, senza sale...' : 'Altre note...'}
        value={localItem.notes}
        onChange={e => setLocalItem({ ...localItem, notes: e.target.value })}
        className="w-full bg-charcoal border border-surface-light rounded-2xl p-4 text-white text-xs font-medium outline-none focus:border-gold transition-all"
      />
    </section>
  );

  const additionsSection = (
    <section>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-[10px] font-black text-gray-500 tracking-widest uppercase flex items-center gap-2">
          <Plus size={14} className="text-emerald-500" /> AGGIUNTE
        </h3>
        <div className="relative w-48 sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" size={14} />
          <input
            type="text"
            placeholder="Cerca aggiunta..."
            value={ingSearch}
            onChange={e => setIngSearch(e.target.value)}
            className="w-full bg-charcoal border border-surface-light rounded-xl py-2.5 pl-10 pr-10 text-xs font-bold text-white outline-none focus:border-gold"
          />
          {ingSearch && (
            <button
              onClick={() => setIngSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors p-0.5"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {ingredients
          .filter(i => i.disponibile && i.nome.toLowerCase().includes(ingSearch.toLowerCase()))
          .map(ing => {
            const isAdded = localItem.addedIngredients.some(a => a.nome === ing.nome);
            return (
              <button
                key={ing.id}
                onClick={() => {
                  if (isAdded) setLocalItem({ ...localItem, addedIngredients: localItem.addedIngredients.filter(a => a.nome !== ing.nome) });
                  else setLocalItem({ ...localItem, addedIngredients: [...localItem.addedIngredients, { nome: ing.nome, prezzo: ing.prezzo ?? 0 }] });
                }}
                className={`p-3 rounded-xl font-bold text-[10px] border transition-all text-left flex flex-col gap-0.5 ${isAdded ? (variant === 'mobile' ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400' : 'bg-emerald-500 border-emerald-500 text-black shadow-lg shadow-emerald-500/20') : 'bg-charcoal border-surface-light text-gray-500 hover:border-surface-light-hover'}`}
              >
                <span className={isAdded && variant === 'desktop' ? 'text-black' : 'text-white'}>{ing.nome.toUpperCase()}</span>
                <span className={isAdded && variant === 'desktop' ? 'text-black/60 font-black' : 'text-emerald-500 font-black'}>+ €{(ing.prezzo ?? 0).toFixed(2)}</span>
              </button>
            );
          })}
      </div>
    </section>
  );

  const footerSection = (
    <>
      <div className="flex items-center gap-6 bg-charcoal p-3 sm:p-4 rounded-3xl border border-surface-light">
        <span className="hidden sm:inline text-[10px] font-black uppercase text-gray-500 tracking-widest">Quantità</span>
        <div className="flex items-center gap-4">
          <button onClick={() => setLocalItem({ ...localItem, quantity: Math.max(1, localItem.quantity - 1) })} className="p-2 bg-surface rounded-xl text-gold border border-surface-light active:scale-90"><Minus size={18} /></button>
          <span className="text-2xl sm:text-3xl font-black italic w-8 text-center">{localItem.quantity}</span>
          <button onClick={() => setLocalItem({ ...localItem, quantity: localItem.quantity + 1 })} className="p-2 bg-surface rounded-xl text-gold border border-surface-light active:scale-90"><Plus size={18} /></button>
        </div>
      </div>
      <div className="flex items-center gap-4 sm:gap-6">
        <div className="text-right">
          <p className="text-[10px] font-black text-gray-500 uppercase">Totale</p>
          <p className="text-2xl sm:text-4xl font-black italic text-white">€{calculateItemPrice(localItem, ingredients).toFixed(2)}</p>
        </div>
        <button
          onClick={handleSave}
          className="bg-emerald-500 hover:bg-emerald-600 text-black px-8 sm:px-12 py-4 sm:py-6 rounded-[32px] font-black text-base sm:text-xl shadow-xl shadow-emerald-500/20 active:scale-95 transition-all"
        >
          {variant === 'mobile' ? 'AGGIUNGI ALL\'ORDINE' : 'CONFERMA E AGGIUNGI'}
        </button>
      </div>
    </>
  );

  if (variant === 'mobile') {
    return (
      <div className="fixed inset-0 z-[100] flex items-end bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="bg-surface w-full max-h-[90vh] rounded-t-[40px] shadow-2xl flex flex-col animate-in slide-in-from-bottom duration-300">
          <div className="p-6 border-b border-surface-light flex justify-between items-center shrink-0">
            <div>
              <h2 className="text-2xl font-black italic uppercase text-white leading-tight">{localItem.nome}</h2>
              <p className="text-[10px] font-black text-gold uppercase tracking-[0.2em] mt-1">€{localItem.prezzo.toFixed(2)} + extra</p>
            </div>
            <button onClick={() => { onClose(); setLocalItem(null); setIngSearch(''); }} className="p-3 bg-charcoal rounded-full text-gray-500"><X size={20} /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar pb-32">
            {portataSection}
            {categorySection}
            {hasIngredients && removalsSection}
            {hasIngredients && additionsSection}
            {notesSection}
          </div>
          <div className="p-6 border-t border-surface-light bg-surface-light/10 absolute bottom-0 left-0 right-0 rounded-t-[30px] shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <span className="text-2xl font-black text-white italic">€{calculateItemPrice(localItem, ingredients).toFixed(2)}</span>
              <div className="flex items-center gap-4">
                <button onClick={() => setLocalItem({ ...localItem, quantity: Math.max(1, localItem.quantity - 1) })} className="p-2 bg-charcoal rounded-lg text-gold border border-surface-light"><Minus size={16} /></button>
                <span className="text-xl font-black italic">{localItem.quantity}</span>
                <button onClick={() => setLocalItem({ ...localItem, quantity: localItem.quantity + 1 })} className="p-2 bg-charcoal rounded-lg text-gold border border-surface-light"><Plus size={16} /></button>
              </div>
            </div>
            <button onClick={() => { onSave(localItem); setLocalItem(null); setIngSearch(''); }} className="w-full bg-emerald-500 text-black py-4 rounded-2xl font-black uppercase text-sm">
              AGGIUNGI ALL'ORDINE
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl animate-in zoom-in duration-200">
      <div className="bg-surface border border-surface-light w-full max-w-5xl rounded-[40px] shadow-[0_0_100px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-8 border-b border-surface-light flex justify-between items-center bg-surface-light/5 shrink-0">
          <div>
            <h2 className="text-3xl font-black italic uppercase tracking-tighter text-white">Personalizza <span className="text-gold">{localItem.nome}</span></h2>
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] mt-1">Configurazione Ingredienti e Varianti</p>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-[10px] font-black text-gray-500 uppercase">Prezzo Piatto</p>
              <p className="text-2xl font-black text-white italic">€{calculateItemPrice(localItem, ingredients).toFixed(2)}</p>
            </div>
            <button onClick={() => { onClose(); setLocalItem(null); setIngSearch(''); }} className="p-4 bg-charcoal rounded-2xl text-gray-500 hover:text-white transition-colors border border-surface-light">
              <X size={24} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden flex">
          <div className="w-[40%] border-r border-surface-light p-8 overflow-y-auto custom-scrollbar space-y-10">
            {portataSection}
            {categorySection}
            {hasIngredients && removalsSection}
            {notesSection}
          </div>
          <div className="flex-1 bg-charcoal/30 p-8 overflow-y-auto custom-scrollbar">
            {hasIngredients ? additionsSection : (
              <div className="h-full flex items-center justify-center text-gray-600 text-sm font-bold italic">
                Nessun ingrediente extra disponibile
              </div>
            )}
          </div>
        </div>
        <div className="p-8 border-t border-surface-light bg-surface-light/5 flex justify-between items-center shrink-0">
          {footerSection}
        </div>
      </div>
    </div>
  );
}
