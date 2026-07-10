import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Product } from '../types/entities';
import { ALLERGEN_META } from '../types/entities';
import { Search, X, Globe, ChevronRight, Pizza, Coffee, Wine, Cake, Utensils, ArrowUp } from 'lucide-react';

const CATEGORY_ORDER = ['Antipasti', 'Fritti', 'Primi', 'Secondi', 'Pizze Rosse', 'Pizze Bianche', 'Pizze Speciali', 'Dolci', 'Caffè e Liquori', 'Bevande'];

const CATEGORY_ICONS: Record<string, { icon: React.ReactNode; bg: string; text: string }> = {
  'Antipasti':     { icon: <Utensils size={22} />, bg: 'from-emerald-600/80 to-emerald-700', text: 'text-emerald-50' },
  'Fritti':        { icon: <Utensils size={22} />, bg: 'from-amber-600/80 to-amber-700', text: 'text-amber-50' },
  'Primi':         { icon: <Utensils size={22} />, bg: 'from-orange-600/80 to-orange-700', text: 'text-orange-50' },
  'Secondi':       { icon: <Utensils size={22} />, bg: 'from-red-600/80 to-red-700', text: 'text-red-50' },
  'Pizze Rosse':   { icon: <Pizza size={22} />, bg: 'from-rose-600/80 to-rose-700', text: 'text-rose-50' },
  'Pizze Bianche': { icon: <Pizza size={22} />, bg: 'from-stone-500/80 to-stone-600', text: 'text-stone-50' },
  'Pizze Speciali':{ icon: <Pizza size={22} />, bg: 'from-yellow-600/80 to-yellow-700', text: 'text-yellow-50' },
  'Dolci':         { icon: <Cake size={22} />, bg: 'from-pink-500/80 to-pink-600', text: 'text-pink-50' },
  'Caffè e Liquori':{ icon: <Coffee size={22} />, bg: 'from-amber-800/80 to-amber-900', text: 'text-amber-100' },
  'Bevande':       { icon: <Wine size={22} />, bg: 'from-cyan-600/80 to-cyan-700', text: 'text-cyan-50' },
};

declare global {
  interface Window { googleTranslateElementInit: () => void; }
}

export default function PublicMenuView() {
  const [searchParams] = useSearchParams();
  const tableName = searchParams.get('tavolo');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentLang, setCurrentLang] = useState('it');
  const [searchQuery, setSearchQuery] = useState('');
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [hasScrolled, setHasScrolled] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.googleTranslateElementInit = () => {
      new (window as any).google.translate.TranslateElement({
        pageLanguage: 'it',
        includedLanguages: 'en,fr,de',
        autoDisplay: false,
      }, 'google_translate_element');
    };
    const script = document.createElement('script');
    script.src = '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
    script.async = true;
    document.body.appendChild(script);
    const style = document.createElement('style');
    style.textContent = `.goog-te-banner-frame,.goog-te-balloon-frame,.goog-te-gadget-simple,.goog-te-gadget-icon{display:none!important}body{top:0!important}`;
    document.head.appendChild(style);
    return () => { document.body.removeChild(script); document.head.removeChild(style); };
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => { if (el.scrollTop > 150) setHasScrolled(true); else setHasScrolled(false); };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

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

  const changeLang = (code: string) => {
    setCurrentLang(code);
    setShowLangPicker(false);
    try {
      const select = document.querySelector('.goog-te-combo') as HTMLSelectElement;
      if (select) { select.value = code; select.dispatchEvent(new Event('change')); }
    } catch {}
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

  const scrollToCategory = (cat: string) => {
    const el = document.getElementById(`cat-${cat}`);
    if (scrollRef.current && el) {
      const top = el.getBoundingClientRect().top + scrollRef.current.scrollTop - scrollRef.current.getBoundingClientRect().top - 20;
      scrollRef.current.scrollTo({ top, behavior: 'smooth' });
    }
  };

  const scrollToTop = () => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-white">
      <div className="w-12 h-12 border-2 border-[#ebc22d]/30 border-t-[#ebc22d] rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="h-screen flex flex-col bg-[#f8f7f4] text-[#1a1a1a] font-sans selection:bg-[#ebc22d]/30 overflow-hidden">
      {/* Fixed Header */}
      <header className="relative shrink-0 bg-gradient-to-b from-[#643232] to-[#4a2525] text-white px-5 pt-12 pb-5 overflow-hidden">
        <div className="absolute top-[-30%] right-[-10%] w-[50vw] h-[50vw] rounded-full border-[3px] border-[#ebc22d]/10" />
        <div className="absolute top-[-20%] right-[-5%] w-[35vw] h-[35vw] rounded-full border-2 border-[#ebc22d]/15" />
        <div className="absolute bottom-[20%] left-[-15%] w-[40vw] h-[40vw] rounded-full bg-gradient-to-br from-[#ebc22d]/8 to-transparent blur-3xl" />

        <div className="relative flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-white/15 backdrop-blur-md flex items-center justify-center shadow-2xl shadow-black/20 ring-2 ring-[#ebc22d]/30 ring-offset-2 ring-offset-[#643232]/50 overflow-hidden">
            <img src="/IlGirasole-1.png" alt="Il Girasole" className="w-9 h-9 object-contain" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-black tracking-tight leading-none">Il Girasole</h1>
            <p className="text-[10px] font-bold text-[#ebc22d] mt-0.5 uppercase tracking-[0.15em]">Ristorante &bull; Pizzeria &bull; Gastronomia</p>
            {tableName && <p className="text-xs font-black text-white/80 mt-1">Tavolo {tableName}</p>}
          </div>
          <button
            onClick={() => setShowLangPicker(!showLangPicker)}
            className="p-2 bg-white/10 backdrop-blur-md rounded-full hover:bg-white/20 transition-all active:scale-95"
          >
            <Globe size={16} className="text-white" />
          </button>
        </div>

        {showLangPicker && (
          <div className="absolute top-24 right-5 bg-white rounded-2xl shadow-2xl border border-gray-100 p-2 z-30 animate-in zoom-in origin-top-right">
            {[
              { code: 'it', label: 'ITA' },
              { code: 'en', label: 'ENG' },
              { code: 'fr', label: 'FRA' },
              { code: 'de', label: 'DEU' },
            ].map(l => (
              <button
                key={l.code}
                onClick={() => changeLang(l.code)}
                className={`block w-full text-left px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  currentLang === l.code ? 'bg-[#ebc22d]/10 text-[#ebc22d]' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        )}

        <div id="google_translate_element" className="hidden" />
      </header>

      {/* Scrollable area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar">
        {/* Search */}
        <div className="px-5 -mt-4 relative z-10">
          <div className="bg-white rounded-2xl shadow-lg shadow-black/5 border border-gray-100 flex items-center px-4 py-0">
            <Search size={16} className="text-gray-400 shrink-0" />
            <input
              ref={searchRef}
              type="text"
              placeholder="Cerca nel menu..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent py-3 px-3 text-sm font-medium text-gray-800 outline-none placeholder:text-gray-400"
            />
            {searchQuery && (
              <button onClick={() => { setSearchQuery(''); searchRef.current?.focus(); }} className="p-1 text-gray-400 hover:text-gray-600">
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Category Grid */}
        {!searchQuery && (
          <div className="px-4 mt-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {sortedCategories.map(cat => {
                const meta = CATEGORY_ICONS[cat];
                const items = grouped[cat] || [];
                return (
                  <button
                    key={cat}
                    onClick={() => scrollToCategory(cat)}
                    className={`relative bg-gradient-to-br ${meta?.bg || 'from-gray-600 to-gray-700'} rounded-2xl p-4 shadow-lg active:scale-95 transition-all text-left overflow-hidden min-h-[90px] flex flex-col justify-end`}
                  >
                    <div className="absolute top-2 right-2 opacity-20 text-white">{meta?.icon}</div>
                    <span className={`text-xs font-black uppercase tracking-wider ${meta?.text || 'text-white'}`}>
                      {cat}
                    </span>
                    <span className="text-[10px] text-white/50 font-bold mt-0.5">{items.length} piatti</span>
                    <div className="absolute bottom-2 right-2 text-white/30">
                      <ChevronRight size={16} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Divider */}
        {!searchQuery && sortedCategories.length > 0 && (
          <div className="flex items-center gap-3 px-6 mt-6 mb-2">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">Menu</span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>
        )}

        {/* Items */}
        <div className="px-5 pb-24 mt-3">
          {searchQuery && (
            <div className="flex items-center gap-2 mb-4 text-sm font-bold text-gray-500">
              <Search size={14} /> Risultati ricerca
            </div>
          )}
          {searchQuery && (() => {
            const filtered = products.filter(p =>
              p.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
              p.ingredienti.some(i => i.toLowerCase().includes(searchQuery.toLowerCase())) ||
              (p.categoria && p.categoria.toLowerCase().includes(searchQuery.toLowerCase()))
            );
            if (filtered.length === 0) return (
              <div className="text-center py-16">
                <Search size={36} className="mx-auto text-gray-300 mb-3" />
                <p className="font-black text-gray-400 text-sm">Nessun risultato</p>
                <p className="text-xs text-gray-400 mt-1">Prova a modificare la ricerca</p>
              </div>
            );
            const filteredGrouped = filtered.reduce((acc, p) => {
              const cat = p.categoria || 'Altro';
              if (!acc[cat]) acc[cat] = [];
              acc[cat].push(p);
              return acc;
            }, {} as Record<string, Product[]>);
            return renderCategories(Object.keys(filteredGrouped).sort((a, b) => CATEGORY_ORDER.indexOf(a) - CATEGORY_ORDER.indexOf(b)), filteredGrouped, true);
          })()}
          {!searchQuery && renderCategories(sortedCategories, grouped, false)}
        </div>
      </div>

      {/* Back to top */}
      {hasScrolled && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-24 right-5 z-30 w-12 h-12 bg-[#ebc22d] text-black rounded-full shadow-2xl flex items-center justify-center active:scale-90 hover:scale-110 transition-all"
        >
          <ArrowUp size={22} />
        </button>
      )}

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-gray-200 px-5 py-3 text-center z-10">
        <p className="text-[8px] text-gray-400 font-black uppercase tracking-[0.3em]">
          Il Girasole {tableName ? `— Tavolo ${tableName}` : '— Menu Digitale'}
        </p>
      </footer>

      {/* Product Detail Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={() => setSelectedProduct(null)}>
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            {selectedProduct.immagine ? (
              <div className="relative h-56 bg-[#f8f7f4]">
                <img src={selectedProduct.immagine} alt="" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                <button onClick={() => setSelectedProduct(null)} className="absolute top-4 right-4 w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg border border-gray-200">
                  <X size={16} className="text-gray-700" />
                </button>
              </div>
            ) : (
              <div className="relative h-36 bg-gradient-to-br from-[#643232] to-[#4a2525] flex items-center justify-center rounded-t-3xl">
                <div className="text-center">
                  <div className="w-12 h-12 mx-auto rounded-full bg-white/10 flex items-center justify-center">
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
                <h2 className="text-xl font-black text-gray-800">{selectedProduct.nome}</h2>
                <span className="text-lg font-black text-[#ebc22d] shrink-0">€{selectedProduct.prezzo.toFixed(2)}</span>
              </div>
              {selectedProduct.ingredienti.length > 0 && (
                <div className="mt-5">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.15em] mb-2">
                    {currentLang === 'it' ? 'Ingredienti' : 'Ingredients'}
                  </p>
                  <p className="text-sm text-gray-600 leading-relaxed">{selectedProduct.ingredienti.join(', ')}</p>
                </div>
              )}
              {selectedProduct.allergeni && selectedProduct.allergeni.length > 0 && (
                <div className="mt-5">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.15em] mb-2.5">
                    {currentLang === 'it' ? 'Allergeni' : 'Allergens'}
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

    </div>
  );

  function renderCategories(categories: string[], catGroup: Record<string, Product[]>, isSearch: boolean) {
    return (
      <div className="space-y-5">
        {categories.map(categoria => {
          const items = catGroup[categoria] || [];
          if (items.length === 0) return null;
          const hasSubcategories = items.some(p => p.sottocategoria);

          return (
            <div key={categoria} id={`cat-${categoria}`}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-1 h-5 rounded-full bg-[#ebc22d]" />
                <h2 className="text-base font-black uppercase tracking-tight text-gray-800">{categoria}</h2>
                <span className="text-[9px] font-black text-gray-400 ml-auto">{items.length}</span>
              </div>

              {hasSubcategories ? (
                <div className="space-y-4">
                  {(() => {
                    const subcats = [...new Set(items.map(p => p.sottocategoria || 'Altro'))];
                    return subcats.map(sub => (
                      <div key={sub}>
                        <h3 className="text-[8px] font-black text-[#ebc22d] uppercase tracking-[0.2em] mb-2 flex items-center gap-2">
                          <div className="w-2.5 h-px bg-[#ebc22d]/30" />
                          {sub}
                        </h3>
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-50 overflow-hidden">
                          {sub === 'Vini della Casa' ? (
                            <>
                              {(() => {
                                const redWines = items.filter(p => p.nome.includes('ROSSO'));
                                const whiteWines = items.filter(p => p.nome.includes('BIANCO'));
                                return (
                                  <>
                                    {redWines.length > 0 && (
                                      <div>
                                        <div className="px-4 py-1.5 bg-red-50/50 flex items-center gap-2">
                                          <div className="w-2 h-2 rounded-full bg-red-400" />
                                          <span className="text-[7px] font-black text-red-500 uppercase tracking-widest">ROSSI</span>
                                        </div>
                                        {renderItems(redWines)}
                                      </div>
                                    )}
                                    {whiteWines.length > 0 && (
                                      <div>
                                        <div className="px-4 py-1.5 bg-amber-50/50 flex items-center gap-2">
                                          <div className="w-2 h-2 rounded-full bg-amber-400" />
                                          <span className="text-[7px] font-black text-amber-600 uppercase tracking-widest">BIANCHI</span>
                                        </div>
                                        {renderItems(whiteWines)}
                                      </div>
                                    )}
                                  </>
                                );
                              })()}
                            </>
                          ) : (
                            renderItems(items.filter(p => (p.sottocategoria || 'Altro') === sub))
                          )}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              ) : (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-50 overflow-hidden">
                  {renderItems(items)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  function renderItems(items: Product[]) {
    return items.map(p => (
      <div key={p.id} onClick={() => setSelectedProduct(p)} className="px-4 py-2.5 hover:bg-gray-50 transition-colors cursor-pointer active:scale-[0.98]">
        <div className="flex justify-between items-start gap-4">
          <div className="min-w-0 flex-1 flex items-start gap-3">
            {p.immagine && (
              <img src={p.immagine} alt="" className="w-10 h-10 rounded-xl object-cover shrink-0 mt-0.5 border border-gray-100" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            )}
            <div>
              <p className="text-sm font-bold text-gray-800">{p.nome}</p>
              {p.ingredienti.length > 0 && (
                <p className="text-[9px] text-gray-500 mt-0.5">{p.ingredienti.join(', ')}</p>
              )}
              {renderAllergeni(p.allergeni)}
            </div>
          </div>
          <span className="text-sm font-black text-[#ebc22d] shrink-0">€{p.prezzo.toFixed(2)}</span>
        </div>
      </div>
    ));
  }
}
