import React, { useEffect, useState, useCallback } from 'react';
import { supabase, type Product } from '../lib/supabase';
import { translateBatch } from '../lib/translate';
import { UtensilsCrossed, Sparkles, Sun, Soup, Pizza, Wine, Cookie, Coffee, Languages } from 'lucide-react';

const CATEGORY_ORDER = ['Antipasti', 'Fritti', 'Primi', 'Secondi', 'Pizze Rosse', 'Pizze Bianche', 'Pizze Speciali', 'Dolci', 'Caffè e Liquori', 'Bevande'];

const categoryIcons: Record<string, React.ReactNode> = {
  'Antipasti': <Sun size={16} />,
  'Fritti': <Sparkles size={16} />,
  'Primi': <Soup size={16} />,
  'Secondi': <UtensilsCrossed size={16} />,
  'Pizze Rosse': <Pizza size={16} />,
  'Pizze Bianche': <Pizza size={16} />,
  'Pizze Speciali': <Pizza size={16} />,
  'Bevande': <Wine size={16} />,
  'Dolci': <Cookie size={16} />,
  'Caffè e Liquori': <Coffee size={16} />,
};

const categoryColors: Record<string, string> = {
  'Antipasti': 'from-amber-500/20 to-amber-600/5 border-amber-500/20',
  'Fritti': 'from-orange-500/20 to-orange-600/5 border-orange-500/20',
  'Primi': 'from-rose-500/20 to-rose-600/5 border-rose-500/20',
  'Secondi': 'from-red-500/20 to-red-600/5 border-red-500/20',
  'Pizze Rosse': 'from-gold/20 to-amber-600/5 border-gold/20',
  'Pizze Bianche': 'from-gold/20 to-amber-600/5 border-gold/20',
  'Pizze Speciali': 'from-gold/20 to-amber-600/5 border-gold/20',
  'Bevande': 'from-sky-500/20 to-sky-600/5 border-sky-500/20',
  'Dolci': 'from-pink-500/20 to-pink-600/5 border-pink-500/20',
  'Caffè e Liquori': 'from-amber-700/20 to-amber-800/5 border-amber-700/20',
};

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

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-charcoal">
      <div className="relative">
        <div className="w-16 h-16 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-3 h-3 bg-gold rounded-full animate-pulse" />
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-charcoal text-white font-sans selection:bg-gold selection:text-black">
      {/* Hero Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-gold/5 via-transparent to-transparent pointer-events-none" />
        <div className="absolute top-[-20%] left-[-10%] w-[60vw] h-[60vw] rounded-full bg-gold/3 blur-[120px] pointer-events-none" />
        <div className="absolute top-[-10%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-amber-500/3 blur-[100px] pointer-events-none" />
        
        <div className="relative max-w-4xl mx-auto px-4 pt-16 pb-10 text-center">
          {/* Language Switcher */}
          <div className="absolute top-6 right-6 flex items-center gap-1.5 bg-black/40 border border-white/10 rounded-xl p-1">
            <Languages size={14} className="text-gold ml-1.5" />
            {LANGUAGES.map(l => (
              <button
                key={l.code}
                onClick={() => setLang(l.code)}
                className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                  lang === l.code
                    ? 'bg-gold text-black'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>

          {/* Logo / Icon */}
          <div className="w-20 h-20 bg-gradient-to-br from-gold to-amber-600 rounded-[28px] flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-gold/20">
            <UtensilsCrossed size={40} className="text-black" />
          </div>
          
          {/* Restaurant Name */}
          <h1 className="text-5xl md:text-6xl font-black tracking-tighter uppercase italic leading-none text-white">
            Il <span className="text-gold">Girasole</span>
          </h1>
          <p className="text-sm md:text-base text-gray-500 font-bold tracking-widest uppercase mt-3">
            Ristorante Pizzeria
          </p>
          
          {/* Decorative divider */}
          <div className="flex items-center justify-center gap-4 mt-6">
            <div className="w-12 h-px bg-gradient-to-r from-transparent to-gold/40" />
            <Sparkles size={14} className="text-gold" />
            <div className="w-12 h-px bg-gradient-to-l from-transparent to-gold/40" />
          </div>
          
          <p className="text-[10px] text-gray-600 font-black uppercase tracking-[0.3em] mt-4">
            {lang === 'it' ? 'Menu Aggiornato in Tempo Reale' : lang === 'en' ? 'Real-Time Menu' : lang === 'fr' ? 'Menu Mis à Jour en Temps Réel' : 'Echtzeit-Menü'}
          </p>
        </div>
      </div>

      {/* Menu Content */}
      <div className="max-w-4xl mx-auto px-4 pb-20">
        {translating && lang !== 'it' && (
          <div className="text-center py-2">
            <span className="text-[10px] text-gold font-black uppercase tracking-widest animate-pulse">Traduzione in corso...</span>
          </div>
        )}
        <div className="space-y-8">
          {sortedCategories.map(categoria => {
            const items = grouped[categoria];
            const icon = categoryIcons[categoria] || <UtensilsCrossed size={16} />;
            const colors = categoryColors[categoria] || 'from-surface-light/20 to-surface-light/5 border-surface-light/20';
            const hasSubcategories = items.some(p => p.sottocategoria);

            return (
              <div key={categoria} className={`bg-gradient-to-br ${colors} border rounded-[32px] overflow-hidden shadow-xl`}>
                {/* Category Header */}
                <div className="px-6 py-5 flex items-center gap-4 border-b border-white/5">
                  <div className="w-10 h-10 rounded-xl bg-black/40 flex items-center justify-center text-gold">
                    {icon}
                  </div>
                  <div>
                    <h2 className="text-lg font-black uppercase tracking-tight text-white">{categoria}</h2>
                    <p className="text-[9px] text-gray-600 font-black uppercase tracking-widest">{items.length} prodotti</p>
                  </div>
                </div>

                {/* Category Items */}
                {hasSubcategories ? (
                  <div className="p-6 space-y-6">
                    {(() => {
                      const subcats = [...new Set(items.map(p => p.sottocategoria || 'Altro'))];
                      return subcats.map(sub => (
                        <div key={sub}>
                          <h3 className="text-[10px] font-black text-gold uppercase tracking-[0.25em] mb-3 flex items-center gap-2">
                            <div className="w-4 h-px bg-gold/40" />
                            {sub}
                          </h3>
                          <div className="space-y-1">
                            {sub === 'Vini della Casa' ? (
                              (() => {
                                const redWines = items.filter(p => p.nome.includes('ROSSO'));
                                const whiteWines = items.filter(p => p.nome.includes('BIANCO'));
                                return (
                                  <>
                                    {redWines.length > 0 && (
                                      <div className="mb-4">
                                        <div className="flex items-center gap-2 mb-2">
                                          <div className="w-3 h-px bg-red-400/40" />
                                          <span className="text-[9px] font-black text-red-400/80 uppercase tracking-widest">ROSSO</span>
                                          <div className="flex-1 h-px bg-red-400/40" />
                                        </div>
                                        {redWines.map(p => (
                                          <div key={p.id} className="py-2.5 px-3 rounded-xl hover:bg-white/5 transition-colors group">
                                            <div className="flex justify-between items-center">
                                              <span className="text-sm font-bold text-white/90 group-hover:text-white transition-colors">
                                                {getTranslatedName(p)}
                                              </span>
                                              <span className="text-sm font-black text-gold">€{p.prezzo.toFixed(2)}</span>
                                            </div>
                                            {p.ingredienti.length > 0 && (
                                              <p className="text-[10px] text-gray-500 mt-1 leading-relaxed">
                                                {p.ingredienti.join(', ')}
                                              </p>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                    {whiteWines.length > 0 && (
                                      <div>
                                        <div className="flex items-center gap-2 mb-2">
                                          <div className="w-3 h-px bg-amber-400/40" />
                                          <span className="text-[9px] font-black text-amber-400/80 uppercase tracking-widest">BIANCO</span>
                                          <div className="flex-1 h-px bg-amber-400/40" />
                                        </div>
                                        {whiteWines.map(p => (
                                          <div key={p.id} className="py-2.5 px-3 rounded-xl hover:bg-white/5 transition-colors group">
                                            <div className="flex justify-between items-center">
                                              <span className="text-sm font-bold text-white/90 group-hover:text-white transition-colors">
                                                {getTranslatedName(p)}
                                              </span>
                                              <span className="text-sm font-black text-gold">€{p.prezzo.toFixed(2)}</span>
                                            </div>
                                            {p.ingredienti.length > 0 && (
                                              <p className="text-[10px] text-gray-500 mt-1 leading-relaxed">
                                                {p.ingredienti.join(', ')}
                                              </p>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </>
                                );
                              })()
                            ) : (
                              items.filter(p => (p.sottocategoria || 'Altro') === sub).map(p => (
                                <div key={p.id} className="py-2.5 px-3 rounded-xl hover:bg-white/5 transition-colors group">
                                  <div className="flex justify-between items-center">
                                    <span className="text-sm font-bold text-white/90 group-hover:text-white transition-colors">
                                      {getTranslatedName(p)}
                                    </span>
                                    <span className="text-sm font-black text-gold">€{p.prezzo.toFixed(2)}</span>
                                  </div>
                                  {p.ingredienti.length > 0 && (
                                    <p className="text-[10px] text-gray-500 mt-1 leading-relaxed">
                                      {p.ingredienti.join(', ')}
                                    </p>
                                  )}
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                ) : (
                  <div className="p-6 space-y-1">
                    {items.map(p => (
                      <div key={p.id} className="py-2.5 px-3 rounded-xl hover:bg-white/5 transition-colors group">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-bold text-white/90 group-hover:text-white transition-colors">
                            {getTranslatedName(p)}
                          </span>
                          <span className="text-sm font-black text-gold">€{p.prezzo.toFixed(2)}</span>
                        </div>
                        {p.ingredienti.length > 0 && (
                          <p className="text-[10px] text-gray-500 mt-1 leading-relaxed">
                            {p.ingredienti.join(', ')}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <footer className="mt-16 text-center space-y-3">
          <div className="flex items-center justify-center gap-3">
            <div className="w-8 h-px bg-gradient-to-r from-transparent to-gray-700" />
            <div className="w-2 h-2 bg-gold/40 rounded-full" />
            <div className="w-8 h-px bg-gradient-to-l from-transparent to-gray-700" />
          </div>
          <p className="text-[9px] text-gray-700 font-black uppercase tracking-[0.3em]">
            Ristorante Pizzeria Il Girasole — Menu Digitale
          </p>
          <p className="text-[8px] text-gray-800 font-bold">
            {lang === 'it' ? 'I prezzi e la disponibilità sono aggiornati in tempo reale' : lang === 'en' ? 'Prices and availability are updated in real time' : lang === 'fr' ? 'Les prix et la disponibilité sont mis à jour en temps réel' : 'Preise und Verfügbarkeit werden in Echtzeit aktualisiert'}
          </p>
        </footer>
      </div>
    </div>
  );
}
