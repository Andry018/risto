import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase, type Product, ALLERGEN_META } from '../lib/supabase';
import { translateBatch } from '../lib/translate';
import { Search, X, Globe } from 'lucide-react';

const CATEGORY_ORDER = ['Antipasti', 'Fritti', 'Primi', 'Secondi', 'Pizze Rosse', 'Pizze Bianche', 'Pizze Speciali', 'Dolci', 'Caffè e Liquori', 'Bevande'];

const LANGUAGES = [
  { code: 'it', label: 'ITA' },
  { code: 'en', label: 'ENG' },
  { code: 'fr', label: 'FRA' },
  { code: 'de', label: 'DEU' },
];

export default function PublicMenuView() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState(() => {
    const saved = localStorage.getItem('menu_lang');
    return saved || 'it';
  });
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [translating, setTranslating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const catsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('menu_lang', lang);
  }, [lang]);

  async function fetchData() {
    if (!supabase) { setLoading(false); return; }
    const { data } = await supabase
      .from('prodotti')
      .select('*')
      .eq('disponibile', true)
      .order('categoria')
      .order('nome');
    if (data) setProducts(data);
    setLoading(false);
  }

  useEffect(() => {
    void fetchData();
    if (!supabase) return;
    const sb = supabase;
    const channel = sb.channel('public:prodotti-menu')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'prodotti' }, (payload: { new: Record<string, unknown> }) => {
        const row = payload.new as Pick<Product, 'id' | 'disponibile'>;
        if (!row.disponibile) {
          setProducts(current => current.filter(p => p.id !== row.id));
        } else {
          void fetchData();
        }
      })
      .subscribe();
    return () => { sb.removeChannel(channel); };
  }, []);

  const doTranslate = useCallback(async (targetLang: string, prods: Product[]) => {
    if (targetLang === 'it') {
      setTranslations({});
      return;
    }
    setTranslating(true);
    const items = prods.map(p => ({ id: p.id, text: p.nome }));
    const result = await translateBatch(items, targetLang);
    setTranslations(result);
    setTranslating(false);
  }, []);

  useEffect(() => {
    if (products.length > 0) {
      void doTranslate(lang, products);
    }
  }, [lang, products, doTranslate]);

  const getTranslatedName = (product: Product): string => {
    if (lang === 'it') return product.nome;
    return translations[product.id] || product.nome;
  };

  const getA = (label: string) => ALLERGEN_META.find(a => a.label === label);

  const renderAllergeni = (list: string[] | undefined | null) => list && list.length > 0 && (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {list.map(a => {
        const meta = getA(a);
        return (
          <span key={a} className="inline-flex items-center gap-0.5 text-[7px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border" style={{ color: meta?.color || '#92400e', backgroundColor: meta?.bg || '#fef3c7', borderColor: meta?.color || '#92400e' }}>
            {meta?.icon && <span>{meta.icon}</span>}
            {a}
          </span>
        );
      })}
    </div>
  );

  const grouped = products
    .filter(p => p.categoria !== 'EXTRA' && p.categoria !== 'Servizio')
    .reduce((acc, p) => {
      const cat = p.categoria || 'Altro';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(p);
      return acc;
    }, {} as Record<string, Product[]>);

  const sortedCategories = Object.keys(grouped).sort(
    (a, b) => CATEGORY_ORDER.indexOf(a) - CATEGORY_ORDER.indexOf(b)
  );

  const filteredProducts = searchQuery
    ? products.filter(p =>
        p.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.ingredienti.some(i => i.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.categoria && p.categoria.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : products;

  const filteredGrouped = searchQuery
    ? filteredProducts.reduce((acc, p) => {
        const cat = p.categoria || 'Altro';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(p);
        return acc;
      }, {} as Record<string, Product[]>)
    : grouped;

  const filteredCategories = Object.keys(filteredGrouped).sort(
    (a, b) => CATEGORY_ORDER.indexOf(a) - CATEGORY_ORDER.indexOf(b)
  );

  const scrollToCategory = (cat: string) => {
    setActiveCategory(cat);
    setSearchQuery('');
    const el = document.getElementById(`cat-${cat}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-white">
      <div className="w-12 h-12 border-2 border-[#ebc22d]/30 border-t-[#ebc22d] rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f8f7f4] text-[#1a1a1a] font-sans selection:bg-[#ebc22d]/30">
      {/* Header */}
      <header className="relative bg-gradient-to-b from-[#643232] to-[#4a2525] text-white px-5 pt-14 pb-0 overflow-hidden">
        {/* Decorative rings */}
        <div className="absolute top-[-30%] right-[-10%] w-[50vw] h-[50vw] rounded-full border-[3px] border-[#ebc22d]/10" />
        <div className="absolute top-[-20%] right-[-5%] w-[35vw] h-[35vw] rounded-full border-2 border-[#ebc22d]/15" />
        <div className="absolute bottom-[20%] left-[-15%] w-[40vw] h-[40vw] rounded-full bg-gradient-to-br from-[#ebc22d]/8 to-transparent blur-3xl" />
        <div className="absolute top-4 left-4 w-2 h-2 rounded-full bg-[#ebc22d]/30" />
        <div className="absolute top-10 right-12 w-1.5 h-1.5 rounded-full bg-[#ebc22d]/20" />
        <div className="absolute bottom-[30%] left-[30%] w-1 h-1 rounded-full bg-[#ebc22d]/25" />

        <div className="relative flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-white/15 backdrop-blur-md flex items-center justify-center shadow-2xl shadow-black/20 ring-2 ring-[#ebc22d]/30 ring-offset-2 ring-offset-[#643232]/50 overflow-hidden">
            <img src="/IlGirasole-1.png" alt="Il Girasole" className="w-11 h-11 object-contain" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-black tracking-tight leading-none">Il Girasole</h1>
            <p className="text-xs font-bold text-[#ebc22d] mt-0.5 uppercase tracking-[0.15em]">Ristorante &bull; Pizzeria &bull; Gastronomia</p>
          </div>
          <button
            onClick={() => setShowLangPicker(!showLangPicker)}
            className="p-2.5 bg-white/10 backdrop-blur-md rounded-full hover:bg-white/20 transition-all active:scale-95"
          >
            <Globe size={18} className="text-white" />
          </button>
        </div>

        {showLangPicker && (
          <div className="absolute top-28 right-5 bg-white rounded-2xl shadow-2xl border border-gray-100 p-2 z-30 animate-in zoom-in origin-top-right">
            {LANGUAGES.map(l => (
              <button
                key={l.code}
                onClick={() => { setLang(l.code); setShowLangPicker(false); }}
                className={`block w-full text-left px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  lang === l.code ? 'bg-[#ebc22d]/10 text-[#ebc22d]' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        )}

        {/* Gold accent line */}
        <div className="relative mt-6 h-px bg-gradient-to-r from-transparent via-[#ebc22d]/40 to-transparent" />

        {/* SVG wave divider */}
        <div className="relative -mx-5 mt-4">
          <svg viewBox="0 0 400 32" preserveAspectRatio="none" className="w-full h-8">
            <path d="M0,32 C80,4 160,24 240,12 C320,0 360,20 400,16 L400,32 L0,32 Z" fill="#f8f7f4" />
          </svg>
        </div>
      </header>

      {/* Search Bar */}
      <div className="px-5 -mt-4 relative z-10">
        <div className="bg-white rounded-2xl shadow-lg shadow-black/5 border border-gray-100 flex items-center px-4 py-0">
          <Search size={18} className="text-gray-400 shrink-0" />
          <input
            ref={searchRef}
            type="text"
            placeholder="Cerca nel menu..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent py-3.5 px-3 text-sm font-medium text-gray-800 outline-none placeholder:text-gray-400"
          />
          {searchQuery && (
            <button onClick={() => { setSearchQuery(''); searchRef.current?.focus(); }} className="p-1 text-gray-400 hover:text-gray-600">
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Category Pills */}
      <div ref={catsRef} className="px-5 mt-4 overflow-x-auto hide-scrollbar sticky top-0 z-20 bg-[#f8f7f4] py-2">
        <div className="flex gap-2">
          {sortedCategories.map(cat => (
            <button
              key={cat}
              onClick={() => scrollToCategory(cat)}
              className={`shrink-0 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                activeCategory === cat
                  ? 'bg-[#ebc22d] text-white shadow-lg shadow-[#ebc22d]/30'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-[#ebc22d]/40 hover:text-[#ebc22d] shadow-sm'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Menu Content */}
      <div className="px-5 pb-24 mt-3">
        {translating && lang !== 'it' && (
          <div className="text-center py-3 mb-3 bg-amber-50 rounded-2xl border border-amber-200">
            <span className="text-[10px] text-amber-600 font-black uppercase tracking-widest animate-pulse">Traduzione in corso...</span>
          </div>
        )}

        {searchQuery && filteredCategories.length === 0 ? (
          <div className="text-center py-20">
            <Search size={40} className="mx-auto text-gray-300 mb-4" />
            <p className="font-black text-gray-400 text-sm">Nessun risultato</p>
            <p className="text-xs text-gray-400 mt-1">Prova a modificare la ricerca</p>
          </div>
        ) : (
          <div className="space-y-6">
            {(searchQuery ? filteredCategories : sortedCategories).map(categoria => {
              const items = searchQuery ? (filteredGrouped[categoria] || []) : grouped[categoria];
              if (items.length === 0) return null;
              const hasSubcategories = items.some(p => p.sottocategoria);

              return (
                <div key={categoria} id={`cat-${categoria}`}>
                  {/* Category Title */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-1 h-6 rounded-full bg-[#ebc22d]" />
                    <h2 className="text-lg font-black uppercase tracking-tight text-gray-800">{categoria}</h2>
                    <span className="text-[10px] font-black text-gray-400 ml-auto">{items.length}</span>
                  </div>

                  {hasSubcategories ? (
                    <div className="space-y-5">
                      {(() => {
                        const subcats = [...new Set(items.map(p => p.sottocategoria || 'Altro'))];
                        return subcats.map(sub => (
                          <div key={sub}>
                            <h3 className="text-[9px] font-black text-[#ebc22d] uppercase tracking-[0.2em] mb-2.5 flex items-center gap-2">
                              <div className="w-3 h-px bg-[#ebc22d]/30" />
                              {sub}
                            </h3>
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-50 overflow-hidden">
                              {sub === 'Vini della Casa' ? (
                                (() => {
                                  const redWines = items.filter(p => p.nome.includes('ROSSO'));
                                  const whiteWines = items.filter(p => p.nome.includes('BIANCO'));
                                  return (
                                    <>
                                      {redWines.length > 0 && (
                                        <div>
                                          <div className="px-4 py-2 bg-red-50/50 flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-red-400" />
                                            <span className="text-[8px] font-black text-red-500 uppercase tracking-widest">ROSSI</span>
                                          </div>
                                          {redWines.map(p => (
                                            <div key={p.id} onClick={() => setSelectedProduct(p)} className="px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer active:scale-[0.98]">
                                              <div className="flex justify-between items-start gap-4">
                                                <div className="min-w-0 flex-1 flex items-start gap-3">
                                                  {p.immagine && (
                                                    <img src={p.immagine} alt="" className="w-11 h-11 rounded-xl object-cover shrink-0 mt-0.5 border border-gray-100" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                                  )}
                                                  <div>
                                                    <p className="text-sm font-bold text-gray-800">{getTranslatedName(p)}</p>
                                                    {p.ingredienti.length > 0 && (
                                                      <p className="text-[10px] text-gray-500 mt-0.5">{p.ingredienti.join(', ')}</p>
                                                    )}
{renderAllergeni(p.allergeni)}
                                                  </div>
                                                </div>
                                                <span className="text-sm font-black text-[#ebc22d] shrink-0">€{p.prezzo.toFixed(2)}</span>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                      {whiteWines.length > 0 && (
                                        <div>
                                          <div className="px-4 py-2 bg-amber-50/50 flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-amber-400" />
                                            <span className="text-[8px] font-black text-amber-600 uppercase tracking-widest">BIANCHI</span>
                                          </div>
                                          {whiteWines.map(p => (
                                            <div key={p.id} onClick={() => setSelectedProduct(p)} className="px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer active:scale-[0.98]">
                                              <div className="flex justify-between items-start gap-4">
                                                <div className="min-w-0 flex-1 flex items-start gap-3">
                                                  {p.immagine && (
                                                    <img src={p.immagine} alt="" className="w-11 h-11 rounded-xl object-cover shrink-0 mt-0.5 border border-gray-100" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                                  )}
                                                  <div>
                                                    <p className="text-sm font-bold text-gray-800">{getTranslatedName(p)}</p>
                                                    {p.ingredienti.length > 0 && (
                                                      <p className="text-[10px] text-gray-500 mt-0.5">{p.ingredienti.join(', ')}</p>
                                                    )}
{renderAllergeni(p.allergeni)}
                                                  </div>
                                                </div>
                                                <span className="text-sm font-black text-[#ebc22d] shrink-0">€{p.prezzo.toFixed(2)}</span>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </>
                                  );
                                })()
                              ) : (
                                items.filter(p => (p.sottocategoria || 'Altro') === sub).map(p => (
                                  <div key={p.id} onClick={() => setSelectedProduct(p)} className="px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer active:scale-[0.98]">
                                    <div className="flex justify-between items-start gap-4">
                                      <div className="min-w-0 flex-1 flex items-start gap-3">
                                        {p.immagine && (
                                          <img src={p.immagine} alt="" className="w-11 h-11 rounded-xl object-cover shrink-0 mt-0.5 border border-gray-100" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                        )}
                                        <div>
                                          <p className="text-sm font-bold text-gray-800">{getTranslatedName(p)}</p>
                                          {p.ingredienti.length > 0 && (
                                            <p className="text-[10px] text-gray-500 mt-0.5">{p.ingredienti.join(', ')}</p>
                                          )}
                                          {renderAllergeni(p.allergeni)}
                                        </div>
                                      </div>
                                      <span className="text-sm font-black text-[#ebc22d] shrink-0">€{p.prezzo.toFixed(2)}</span>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                  ) : (
                      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-50 overflow-hidden">
                      {items.map(p => (
                        <div key={p.id} onClick={() => setSelectedProduct(p)} className="px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer active:scale-[0.98]">
                          <div className="flex justify-between items-start gap-4">
                            <div className="min-w-0 flex-1 flex items-start gap-3">
                              {p.immagine && (
                                <img src={p.immagine} alt="" className="w-11 h-11 rounded-xl object-cover shrink-0 mt-0.5 border border-gray-100" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                              )}
                              <div>
                                <p className="text-sm font-bold text-gray-800">{getTranslatedName(p)}</p>
                                {p.ingredienti.length > 0 && (
                                  <p className="text-[10px] text-gray-500 mt-0.5">{p.ingredienti.join(', ')}</p>
                                )}
                                {renderAllergeni(p.allergeni)}
                              </div>
                            </div>
                            <span className="text-sm font-black text-[#ebc22d] shrink-0">€{p.prezzo.toFixed(2)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Product Detail Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={() => setSelectedProduct(null)}>
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            {selectedProduct.immagine ? (
              <div className="relative h-64 bg-[#f8f7f4]">
                <img src={selectedProduct.immagine} alt="" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                <button onClick={() => setSelectedProduct(null)} className="absolute top-4 right-4 w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg border border-gray-200">
                  <X size={16} className="text-gray-700" />
                </button>
              </div>
            ) : (
              <div className="relative h-40 bg-gradient-to-br from-[#643232] to-[#4a2525] flex items-center justify-center rounded-t-3xl">
                <div className="text-center">
                  <div className="w-14 h-14 mx-auto rounded-full bg-white/10 flex items-center justify-center">
                    <span className="text-2xl text-white/40">{selectedProduct.nome[0]}</span>
                  </div>
                </div>
                <button onClick={() => setSelectedProduct(null)} className="absolute top-4 right-4 w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg border border-gray-200">
                  <X size={16} className="text-gray-700" />
                </button>
              </div>
            )}
            <div className="px-6 pt-5 pb-8">
              <div className="flex items-start justify-between gap-4">
                <h2 className="text-xl font-black text-gray-800">{getTranslatedName(selectedProduct)}</h2>
                <span className="text-lg font-black text-[#ebc22d] shrink-0">€{selectedProduct.prezzo.toFixed(2)}</span>
              </div>

              {selectedProduct.ingredienti.length > 0 && (
                <div className="mt-5">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.15em] mb-2">
                    {lang === 'it' ? 'Ingredienti' : 'Ingredients'}
                  </p>
                  <p className="text-sm text-gray-600 leading-relaxed">{selectedProduct.ingredienti.join(', ')}</p>
                </div>
              )}

              {selectedProduct.allergeni && selectedProduct.allergeni.length > 0 && (
                <div className="mt-5">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.15em] mb-2.5">
                    {lang === 'it' ? 'Allergeni' : 'Allergens'}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {selectedProduct.allergeni.map(a => {
                      const meta = getA(a);
                      return (
                        <span key={a} className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-lg border" style={{ color: meta?.color || '#92400e', backgroundColor: meta?.bg || '#fef3c7', borderColor: meta?.color || '#92400e' }}>
                          {meta?.icon && <span>{meta.icon}</span>}
                          {a}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-gray-200 px-5 py-3 text-center">
        <p className="text-[8px] text-gray-400 font-black uppercase tracking-[0.3em]">
          Il Girasole — Menu Digitale
        </p>
        <p className="text-[7px] text-gray-300 font-bold mt-0.5">
          {lang === 'it' ? 'Prezzi e disponibilità aggiornati in tempo reale' : 'Real-time prices and availability'}
        </p>
      </footer>
    </div>
  );
}
