import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase, type Product } from '../lib/supabase';
import { translateBatch } from '../lib/translate';
import { UtensilsCrossed, Search, X, Globe } from 'lucide-react';

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
      <div className="w-12 h-12 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f8f7f4] text-[#1a1a1a] font-sans selection:bg-gold/30">
      {/* Header */}
      <div className="bg-gradient-to-br from-gold/90 via-gold to-amber-400 text-white px-5 pt-12 pb-8 relative overflow-hidden">
        <div className="absolute top-[-40%] right-[-20%] w-[60vw] h-[60vw] rounded-full bg-white/5 blur-[60px]" />
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-[#f8f7f4]" style={{ borderRadius: '32px 32px 0 0' }} />
        <div className="relative flex items-center gap-4">
          <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-lg">
            <UtensilsCrossed size={30} className="text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-black tracking-tight leading-none">Il Girasole</h1>
            <p className="text-sm font-bold text-white/80 mt-0.5">Ristorante Pizzeria</p>
          </div>
          <button
            onClick={() => setShowLangPicker(!showLangPicker)}
            className="p-2.5 bg-white/20 backdrop-blur-sm rounded-xl hover:bg-white/30 transition-all"
          >
            <Globe size={20} className="text-white" />
          </button>
        </div>

        {showLangPicker && (
          <div className="absolute top-28 right-5 bg-white rounded-2xl shadow-2xl border border-gray-100 p-2 z-30 animate-in zoom-in origin-top-right">
            {LANGUAGES.map(l => (
              <button
                key={l.code}
                onClick={() => { setLang(l.code); setShowLangPicker(false); }}
                className={`block w-full text-left px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  lang === l.code ? 'bg-gold/10 text-gold' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        )}
      </div>

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
                  ? 'bg-gold text-white shadow-lg shadow-gold/30'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-gold/40 hover:text-gold shadow-sm'
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
                    <div className="w-1 h-6 rounded-full bg-gold" />
                    <h2 className="text-lg font-black uppercase tracking-tight text-gray-800">{categoria}</h2>
                    <span className="text-[10px] font-black text-gray-400 ml-auto">{items.length}</span>
                  </div>

                  {hasSubcategories ? (
                    <div className="space-y-5">
                      {(() => {
                        const subcats = [...new Set(items.map(p => p.sottocategoria || 'Altro'))];
                        return subcats.map(sub => (
                          <div key={sub}>
                            <h3 className="text-[9px] font-black text-gold uppercase tracking-[0.2em] mb-2.5 flex items-center gap-2">
                              <div className="w-3 h-px bg-gold/30" />
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
                                            <div key={p.id} className="px-4 py-3 hover:bg-gray-50 transition-colors">
                                              <div className="flex justify-between items-start gap-4">
                                                <div className="min-w-0 flex-1">
                                                  <p className="text-sm font-bold text-gray-800">{getTranslatedName(p)}</p>
                                                  {p.ingredienti.length > 0 && (
                                                    <p className="text-[10px] text-gray-500 mt-0.5">{p.ingredienti.join(', ')}</p>
                                                  )}
                                                </div>
                                                <span className="text-sm font-black text-gold shrink-0">€{p.prezzo.toFixed(2)}</span>
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
                                            <div key={p.id} className="px-4 py-3 hover:bg-gray-50 transition-colors">
                                              <div className="flex justify-between items-start gap-4">
                                                <div className="min-w-0 flex-1">
                                                  <p className="text-sm font-bold text-gray-800">{getTranslatedName(p)}</p>
                                                  {p.ingredienti.length > 0 && (
                                                    <p className="text-[10px] text-gray-500 mt-0.5">{p.ingredienti.join(', ')}</p>
                                                  )}
                                                </div>
                                                <span className="text-sm font-black text-gold shrink-0">€{p.prezzo.toFixed(2)}</span>
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
                                  <div key={p.id} className="px-4 py-3 hover:bg-gray-50 transition-colors">
                                    <div className="flex justify-between items-start gap-4">
                                      <div className="min-w-0 flex-1">
                                        <p className="text-sm font-bold text-gray-800">{getTranslatedName(p)}</p>
                                        {p.ingredienti.length > 0 && (
                                          <p className="text-[10px] text-gray-500 mt-0.5">{p.ingredienti.join(', ')}</p>
                                        )}
                                      </div>
                                      <span className="text-sm font-black text-gold shrink-0">€{p.prezzo.toFixed(2)}</span>
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
                        <div key={p.id} className="px-4 py-3 hover:bg-gray-50 transition-colors">
                          <div className="flex justify-between items-start gap-4">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-bold text-gray-800">{getTranslatedName(p)}</p>
                              {p.ingredienti.length > 0 && (
                                <p className="text-[10px] text-gray-500 mt-0.5">{p.ingredienti.join(', ')}</p>
                              )}
                            </div>
                            <span className="text-sm font-black text-gold shrink-0">€{p.prezzo.toFixed(2)}</span>
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
