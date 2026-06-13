import { X, Save, Upload } from 'lucide-react';
import { ALLERGEN_META, type Product } from '../types/entities';
import { supabase } from '../lib/supabase';
import { useToast } from './Toast';

interface Props {
  isOpen: boolean;
  editingProduct: Partial<Product> | null;
  newProduct: Partial<Product>;
  productPriceDraft: string;
  allCategories: string[];
  onClose: () => void;
  onEditingProductChange: (p: Partial<Product> | null) => void;
  onNewProductChange: (p: Partial<Product>) => void;
  onPriceDraftChange: (v: string) => void;
  onSave: () => void;
  isEmbedded: boolean;
}

export default function ProductFormModal({
  isOpen, editingProduct, newProduct, productPriceDraft, allCategories,
  onClose, onEditingProductChange, onNewProductChange, onPriceDraftChange,
  onSave, isEmbedded,
}: Props) {
  const { addToast } = useToast();

  const curr = editingProduct ?? newProduct;

  const set = (patch: Partial<Product>) => {
    if (editingProduct) onEditingProductChange({ ...editingProduct, ...patch });
    else onNewProductChange({ ...newProduct, ...patch });
  };

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-6 ${isEmbedded ? 'bg-black/80' : 'bg-slate-950/80'} backdrop-blur-md animate-in fade-in duration-200`}>
      <div className={`${isEmbedded ? 'bg-surface border-surface-light' : 'bg-slate-900 border-slate-800'} border w-full max-w-2xl rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200`}>
        <div className={`p-6 border-b ${isEmbedded ? 'border-surface-light bg-surface-light/20' : 'border-slate-800 bg-slate-800/20'} flex justify-between items-center`}>
          <h3 className="text-xl font-bold text-white italic uppercase tracking-tighter">
            {editingProduct ? 'Modifica' : 'Nuovo'} <span className={isEmbedded ? 'text-gold' : 'text-indigo-400'}>Piatto</span>
          </h3>
          <button onClick={onClose} className={`p-2 ${isEmbedded ? 'text-gray-500 hover:text-white' : 'text-slate-500 hover:text-white'}`}><X size={24} /></button>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className={`block text-xs font-black ${isEmbedded ? 'text-gray-500' : 'text-slate-500'} uppercase mb-1.5`}>Nome Piatto</label>
              <input
                type="text"
                value={curr.nome ?? ''}
                onChange={e => set({ nome: e.target.value })}
                className={`w-full ${isEmbedded ? 'bg-charcoal border-surface-light focus:border-gold' : 'bg-slate-950 border-slate-800 focus:border-indigo-500'} border rounded-xl py-3 px-4 text-white outline-none`}
                placeholder="Esempio: Linguine allo Scoglio"
              />
            </div>
            <div>
              <label className={`block text-xs font-black ${isEmbedded ? 'text-gray-500' : 'text-slate-500'} uppercase mb-1.5`}>Prezzo (€)</label>
              <input
                type="text"
                inputMode="decimal"
                value={productPriceDraft}
                onChange={e => onPriceDraftChange(e.target.value)}
                onBlur={e => {
                  const raw = e.target.value.replace(',', '.');
                  const val = parseFloat(raw);
                  if (!isNaN(val) && val >= 0) {
                    set({ prezzo: val });
                    onPriceDraftChange(String(val));
                  } else {
                    onPriceDraftChange(String(curr.prezzo ?? 0));
                  }
                }}
                className={`w-full ${isEmbedded ? 'bg-charcoal border-surface-light focus:border-gold' : 'bg-slate-950 border-slate-800 focus:border-indigo-500'} border rounded-xl py-3 px-4 text-white outline-none`}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={`block text-xs font-black ${isEmbedded ? 'text-gray-500' : 'text-slate-500'} uppercase mb-1.5`}>Categoria</label>
              <select
                value={curr.categoria ?? ''}
                onChange={e => {
                  const cat = e.target.value;
                  const hasSub = cat === 'Bevande' || cat === 'Caffè e Liquori';
                  set({ categoria: cat, sottocategoria: hasSub ? (curr.sottocategoria || '') : '' });
                }}
                className={`w-full ${isEmbedded ? 'bg-charcoal border-surface-light focus:border-gold' : 'bg-slate-950 border-slate-800 focus:border-indigo-500'} border rounded-xl py-3 px-4 text-white outline-none appearance-none`}
              >
                {allCategories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            {['Bevande', 'Caffè e Liquori'].includes(curr.categoria ?? '') ? (
              <div>
                <label className={`block text-xs font-black ${isEmbedded ? 'text-gray-500' : 'text-slate-500'} uppercase mb-1.5`}>Sotto-Categoria</label>
                <select
                  value={curr.sottocategoria || ''}
                  onChange={e => set({ sottocategoria: e.target.value })}
                  className={`w-full ${isEmbedded ? 'bg-charcoal border-surface-light focus:border-gold' : 'bg-slate-950 border-slate-800 focus:border-indigo-500'} border rounded-xl py-3 px-4 text-white outline-none appearance-none`}
                >
                  <option value="">Nessuna</option>
                  {(curr.categoria) === 'Bevande' ? (
                    <>
                      <option value="Acqua">Acqua</option>
                      <option value="Bibite">Bibite</option>
                      <option value="Vini della Casa">Vini della Casa</option>
                      <option value="Birra alla Spina">Birra alla Spina</option>
                      <option value="Birra in Vetro">Birra in Vetro</option>
                      <option value="Senza Glutine">Senza Glutine</option>
                      <option value="Analcolica">Analcolica</option>
                      <option value="Vini Bottiglia">Vini Bottiglia</option>
                    </>
                  ) : (
                    <>
                      <option value="Caffè">Caffè</option>
                      <option value="Amari e Liquori">Amari e Liquori</option>
                    </>
                  )}
                </select>
              </div>
            ) : (
              <div>
                <label className={`block text-xs font-black ${isEmbedded ? 'text-gray-500' : 'text-slate-500'} uppercase mb-1.5`}>Ingredienti</label>
                <input
                  value={curr.ingredienti?.join(', ') ?? ''}
                  onChange={e => {
                    const ings = e.target.value.split(',').map(i => i.trim()).filter(i => i !== '');
                    set({ ingredienti: ings });
                  }}
                  className={`w-full ${isEmbedded ? 'bg-charcoal border-surface-light focus:border-gold' : 'bg-slate-950 border-slate-800 focus:border-indigo-500'} border rounded-xl py-3 px-4 text-white outline-none`}
                  placeholder="Pomodoro, Mozzarella, Basilico..."
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={`block text-xs font-black ${isEmbedded ? 'text-gray-500' : 'text-slate-500'} uppercase mb-1.5`}>Immagine</label>
              <div className="flex items-center gap-3">
                {(curr.immagine) ? (
                  <div className="relative w-16 h-16 shrink-0 rounded-xl overflow-hidden border border-surface-light">
                    <img src={curr.immagine} alt="" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    <button
                      onClick={() => set({ immagine: undefined })}
                      className="absolute top-0.5 right-0.5 p-0.5 bg-red-500/80 rounded-full text-white"
                    ><X size={10} /></button>
                  </div>
                ) : null}
                <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                  <label className={`cursor-pointer flex items-center justify-center gap-2 px-3 py-2 rounded-xl ${isEmbedded ? 'bg-charcoal border-surface-light' : 'bg-slate-950 border-slate-800'} border text-[10px] font-black ${isEmbedded ? 'text-gray-400 hover:text-white' : 'text-slate-400 hover:text-white'} transition-all`}>
                    <Upload size={14} />
                    Carica
                    <input type="file" accept="image/*" className="hidden" onChange={async e => {
                      const file = e.target.files?.[0];
                      if (!file || !supabase) return;
                      const ext = file.name.split('.').pop();
                      const fileName = `product_${Date.now()}.${ext}`;
                      const { error } = await supabase.storage.from('product_images').upload(fileName, file);
                      if (error) { addToast({ type: 'error', title: 'Upload fallito', message: error.message }); return; }
                      const { data: { publicUrl } } = supabase.storage.from('product_images').getPublicUrl(fileName);
                      set({ immagine: publicUrl });
                    }} />
                  </label>
                  <input
                    type="text"
                    placeholder="Oppure incolla un link..."
                    value={curr.immagine || ''}
                    onChange={e => set({ immagine: e.target.value.trim() || undefined })}
                    className={`w-full ${isEmbedded ? 'bg-charcoal border-surface-light focus:border-gold' : 'bg-slate-950 border-slate-800 focus:border-indigo-500'} border rounded-xl py-1.5 px-3 text-white text-[10px] outline-none placeholder:text-gray-600`}
                  />
                </div>
              </div>
            </div>
            <div>
              <label className={`block text-xs font-black ${isEmbedded ? 'text-gray-500' : 'text-slate-500'} uppercase mb-1.5`}>Allergeni</label>
              <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                {ALLERGEN_META.map(({ label, icon, color, bg }) => {
                  const currentList = (curr.allergeni || []);
                  const isSelected = currentList.includes(label);
                  return (
                    <button
                      key={label}
                      onClick={() => {
                        const updated = isSelected ? currentList.filter(a => a !== label) : [...currentList, label];
                        set({ allergeni: updated });
                      }}
                      className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all border ${
                        isSelected
                          ? 'border-current shadow-sm'
                          : 'border-transparent opacity-50 hover:opacity-80'
                      }`}
                      style={{ color, backgroundColor: isSelected ? bg : 'transparent' }}
                    >
                      <span className="text-[10px]">{icon}</span>
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className={`p-6 ${isEmbedded ? 'bg-surface-light/20 border-surface-light' : 'bg-slate-800/20 border-slate-800'} border-t`}>
          <button
            onClick={onSave}
            className={`w-full ${isEmbedded ? 'bg-gold text-black' : 'bg-indigo-500 hover:bg-indigo-400 text-white shadow-lg shadow-indigo-500/20'} font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 text-sm`}
          >
            <Save size={18} /> Salva Modifiche
          </button>
        </div>
      </div>
    </div>
  );
}
