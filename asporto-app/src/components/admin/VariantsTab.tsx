import { useState } from 'react';
import { Plus, Save, Edit2, Trash2 } from 'lucide-react';
import { getProductVariants, saveProductVariants, type ProductVariant } from '../../lib/productVariants';

interface VariantsTabProps {
  allCategories: string[];
  canEditMenu: boolean;
}

const SECTION_ORDER = ['VARIANTI RAPIDE', 'MODIFICHE', 'COTTURA', 'GLASSA / CONDIMENTI', 'PREPARAZIONE', 'CONDIMENTI', 'EXTRA'];

export default function VariantsTab({ allCategories, canEditMenu }: VariantsTabProps) {
  const [variants, setVariants] = useState<ProductVariant[]>(() => getProductVariants());
  const [variantEditingId, setVariantEditingId] = useState<string | null>(null);
  const [variantEditDraft, setVariantEditDraft] = useState<Partial<ProductVariant>>({});
  const [variantCategoryFilter, setVariantCategoryFilter] = useState<string | null>(null);

  const persistVariants = (newVariants: ProductVariant[]) => {
    setVariants(newVariants);
    saveProductVariants(newVariants);
  };

  const filtered = variantCategoryFilter
    ? variants.filter(v => v.categories.includes(variantCategoryFilter))
    : variants;
  const grouped: Record<string, typeof filtered> = {};
  for (const v of filtered) {
    if (!grouped[v.section]) grouped[v.section] = [];
    grouped[v.section].push(v);
  }
  for (const key of Object.keys(grouped)) {
    grouped[key].sort((a, b) => a.order - b.order);
  }
  const sortedSections = Object.keys(grouped).sort(
    (a, b) => (SECTION_ORDER.indexOf(a) === -1 ? 99 : SECTION_ORDER.indexOf(a)) - (SECTION_ORDER.indexOf(b) === -1 ? 99 : SECTION_ORDER.indexOf(b))
  );

  const variantCard = (v: ProductVariant) => {
    const isEditing = variantEditingId === v.id;
    return (
      <div key={v.id} className={`group relative ${'bg-surface border-surface-light hover:border-gold/30'} border rounded-2xl p-5 transition-all ${isEditing ? ('ring-2 ring-gold/40 border-gold/30') : ''}`}>
        {isEditing ? (
          <div className="space-y-3">
            <input
              type="text"
              value={variantEditDraft.label ?? ''}
              onChange={e => setVariantEditDraft(prev => ({ ...prev, label: e.target.value }))}
              placeholder="Nome variante"
              className={`w-full ${'bg-charcoal border-surface-light focus:border-gold'} border rounded-xl py-2 px-3 text-white font-bold text-sm outline-none transition-all`}
            />
            <div className="flex gap-2">
              <div className="flex-1">
                <label className={`text-[10px] font-black ${'text-gray-500'} uppercase mb-1 block`}>Prezzo</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={variantEditDraft.price ?? 0}
                  onChange={e => {
                    const raw = e.target.value.replace(',', '.');
                    const val = parseFloat(raw);
                    setVariantEditDraft(prev => ({ ...prev, price: isNaN(val) ? 0 : val }));
                  }}
                  className={`w-full ${'bg-charcoal border-surface-light focus:border-gold'} border rounded-lg py-1.5 px-2 text-white font-bold text-xs text-center outline-none transition-all`}
                />
              </div>
              <div className="flex-1">
                <label className={`text-[10px] font-black ${'text-gray-500'} uppercase mb-1 block`}>Ordine</label>
                <input
                  type="number"
                  value={variantEditDraft.order ?? 0}
                  onChange={e => setVariantEditDraft(prev => ({ ...prev, order: parseInt(e.target.value) || 0 }))}
                  className={`w-full ${'bg-charcoal border-surface-light focus:border-gold'} border rounded-lg py-1.5 px-2 text-white font-bold text-xs text-center outline-none transition-all`}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className={`text-[10px] font-black ${'text-gray-500'} uppercase mb-1 block`}>Sezione</label>
                <select
                  value={variantEditDraft.section ?? 'EXTRA'}
                  onChange={e => setVariantEditDraft(prev => ({ ...prev, section: e.target.value }))}
                  className={`w-full ${'bg-charcoal border-surface-light focus:border-gold'} border rounded-lg py-1.5 px-2 text-white font-bold text-xs outline-none transition-all`}
                >
                  <option value="VARIANTI RAPIDE">VARIANTI RAPIDE</option>
                  <option value="MODIFICHE">MODIFICHE</option>
                  <option value="COTTURA">COTTURA</option>
                  <option value="GLASSA / CONDIMENTI">GLASSA / CONDIMENTI</option>
                  <option value="PREPARAZIONE">PREPARAZIONE</option>
                  <option value="EXTRA">EXTRA</option>
                  <option value="CONDIMENTI">CONDIMENTI</option>
                </select>
              </div>
              <div className="flex-1">
                <label className={`text-[10px] font-black ${'text-gray-500'} uppercase mb-1 block`}>Stile</label>
                <select
                  value={variantEditDraft.style ?? 'gold'}
                  onChange={e => setVariantEditDraft(prev => ({ ...prev, style: e.target.value as 'gold' | 'emerald' | 'rose' }))}
                  className={`w-full ${'bg-charcoal border-surface-light focus:border-gold'} border rounded-lg py-1.5 px-2 text-white font-bold text-xs outline-none transition-all`}
                >
                  <option value="gold">Gold</option>
                  <option value="emerald">Emerald</option>
                  <option value="rose">Rose</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className={`text-[10px] font-black ${'text-gray-500'} uppercase mb-1 block`}>Categorie</label>
                <input
                  type="text"
                  value={variantEditDraft.categories ?? ''}
                  onChange={e => setVariantEditDraft(prev => ({ ...prev, categories: e.target.value }))}
                  placeholder="es: Pizze Rosse,Antipasti"
                  className={`w-full ${'bg-charcoal border-surface-light focus:border-gold'} border rounded-lg py-1.5 px-2 text-white font-bold text-xs outline-none transition-all`}
                />
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className={`text-[10px] font-black ${'text-gray-500'} uppercase`}>Stackable</span>
                  <input
                    type="checkbox"
                    checked={variantEditDraft.stackable ?? false}
                    onChange={e => setVariantEditDraft(prev => ({ ...prev, stackable: e.target.checked }))}
                    className="w-4 h-4 rounded accent-emerald-500"
                  />
                </label>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => {
                  if (variantEditDraft.label?.trim()) {
                    persistVariants(variants.map(x => x.id === v.id ? { ...v, ...variantEditDraft } as ProductVariant : x));
                    setVariantEditingId(null);
                    setVariantEditDraft({});
                  }
                }}
                className={`flex-1 ${'bg-emerald-500 text-black'} font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1 transition-all`}
              >
                <Save size={14} /> Salva
              </button>
              <button
                onClick={() => {
                  if (!v.label) { persistVariants(variants.filter(x => x.id !== v.id)); }
                  setVariantEditingId(null);
                  setVariantEditDraft({});
                }}
                className={`flex-1 ${'bg-charcoal border border-surface-light text-gray-500'} font-bold py-2 rounded-xl text-xs transition-all`}
              >
                Annulla
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex justify-between items-start mb-3">
              <div>
                <h4 className={`font-bold text-white ${'group-hover:text-gold'} transition-colors uppercase text-sm`}>{v.label || '(senza nome)'}</h4>
                <p className="text-xs text-gray-500 mt-0.5 font-medium">{v.categories}</p>
              </div>
              {canEditMenu && (
              <div className="flex gap-1">
                <button
                  onClick={() => { setVariantEditingId(v.id); setVariantEditDraft({ ...v }); }}
                  className={`p-1.5 rounded-lg ${'hover:bg-charcoal text-gray-500 hover:text-gold'} transition-all`}
                >
                  <Edit2 size={14} />
                </button>
                <button
                  onClick={() => persistVariants(variants.filter(x => x.id !== v.id))}
                  className={`p-1.5 rounded-lg ${'hover:bg-charcoal text-gray-500 hover:text-red-400'} transition-all`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${v.style === 'gold' ? 'bg-gold/10 text-gold' : v.style === 'emerald' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                {v.section}
              </span>
              {v.price > 0 && <span className="text-[10px] font-black text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">+€{v.price.toFixed(2)}</span>}
              {v.stackable && <span className="text-[10px] font-black text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full">Stackable</span>}
              <span className="text-[10px] text-gray-600 font-bold px-2 py-0.5">ord. {v.order}</span>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className={`max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500`}>
      <header className="mb-8 flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">Gestione Varianti</h2>
          <p className={'text-gray-500'}>Modifica le varianti rapide per ogni categoria di piatti.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={variantCategoryFilter || ''}
            onChange={e => setVariantCategoryFilter(e.target.value || null)}
            className={`${'bg-charcoal border-surface-light focus:border-gold'} border rounded-xl py-2.5 px-4 text-white font-bold text-sm outline-none transition-all`}
          >
            <option value="">Tutte le categorie</option>
            {allCategories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          {canEditMenu && (
            <button
              onClick={() => {
                const newV: ProductVariant = {
                  id: `v_${Date.now()}`,
                  label: '',
                  price: 0,
                  categories: variantCategoryFilter || 'Antipasti',
                  section: 'EXTRA',
                  style: 'gold',
                  stackable: false,
                  order: variants.length + 1,
                };
                persistVariants([...variants, newV]);
                setVariantEditingId(newV.id);
                setVariantEditDraft(newV);
              }}
              className={`${'bg-gold text-black'} font-bold py-2.5 px-5 rounded-2xl flex items-center gap-2 transition-all`}
            >
              <Plus size={18} /> Nuova Variante
            </button>
          )}
        </div>
      </header>

      {sortedSections.length > 0 ? sortedSections.map(section => (
        <div key={section} className="mb-6 last:mb-0">
          <div className="flex items-center gap-3 mb-3">
            <h3 className={`text-xs font-black uppercase tracking-[0.25em] ${'text-gray-500'}`}>{section}</h3>
            <div className={`flex-1 h-px ${'bg-surface-light'}`} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {grouped[section].map(v => variantCard(v))}
          </div>
        </div>
      )) : (
        <div className="text-center py-12">
          <p className={`text-sm font-bold ${'text-gray-500'}`}>Nessuna variante per questa categoria.</p>
        </div>
      )}

      {canEditMenu && (
      <div className="mt-8 flex justify-center">
        <button
          onClick={() => {
            persistVariants(getProductVariants());
            setVariantEditingId(null);
            setVariantEditDraft({});
          }}
          className={`${'text-gray-500 hover:text-red-400 border-surface-light hover:border-red-400/30'} border rounded-xl py-2 px-6 text-xs font-bold transition-all`}
        >
          Ripristina varianti predefinite
        </button>
      </div>
      )}
    </div>
  );
}
