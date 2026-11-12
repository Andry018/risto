import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { getCurrentUser, getDefaultRouteForRole } from '../lib/staffAuth';
import { supabase, IS_DEMO_MODE } from '../lib/supabase';
import type { Product, Ingredient, CustomizedItem } from '../types/entities';
import { MOCK_PRODUCTS, MOCK_INGREDIENTS } from '../lib/MockData';
import { calculateItemPrice, roundCents } from '../lib/priceUtils';
import { syncManager } from '../lib/OfflineSync';
import { printKitchenViaAgent, printErrorMessage } from '../lib/lanPrint';
import { getPrintAgentUrl, getPrinterIp, getPrinterPort } from '../lib/printConfig';
import { useToast } from './Toast';
import { newUniqueId } from '../lib/id';
import { 
  Plus, 
  Search, 
  Save, 
  Clock, 
  User, 
  Trash2, 
  X, 
  Edit3,
  LayoutDashboard,
  Utensils,
  ShoppingCart,
  Eye,
} from 'lucide-react';
import ProductCustomizationModal from './ProductCustomizationModal';

export default function TakeawayTabletView() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { addToast } = useToast();
  // Arrivo da WhatsApp: nome precompilato e, a ordine salvato, ritorno alla chat
  const returnTo = searchParams.get('returnTo')?.startsWith('/whatsapp') ? searchParams.get('returnTo') : null;
  useEffect(() => {
    const user = getCurrentUser();
    if (user && user.role !== 'admin') {
      navigate(getDefaultRouteForRole(user.role), { replace: true });
    }
  }, []);
  const [products, setProducts] = useState<Product[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [cart, setCart] = useState<CustomizedItem[]>([]);
  const [customerName, setCustomerName] = useState(() => searchParams.get('nome') || '');
  const [pickupTime, setPickupTime] = useState(''); // HH:MM di ritiro, scelto liberamente
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  
  // Modals state
  const [editingItem, setEditingItem] = useState<CustomizedItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  async function fetchData() {
    if (IS_DEMO_MODE) {
      setProducts(MOCK_PRODUCTS);
      setIngredients(MOCK_INGREDIENTS);
      return;
    }
    if (!supabase) return;
    const [{ data: pData }, { data: iData }] = await Promise.all([
      supabase.from('prodotti').select('*').order('categoria', { ascending: true }).order('nome', { ascending: true }),
      supabase.from('ingredienti').select('*').order('nome', { ascending: true })
    ]);
    if (pData) setProducts(pData);
    if (iData) setIngredients(iData);
  }

  useEffect(() => {
    void fetchData();
    if (!supabase) return;
    const sb = supabase;
    const productsSub = sb.channel('products-sync').on('postgres_changes', { event: '*', schema: 'public', table: 'prodotti' }, () => void fetchData()).subscribe();
    return () => { sb.removeChannel(productsSub); };
  }, []);

  /** Orari rapidi: tra 15/20/30/45 minuti, arrotondati ai 5 minuti. */
  const quickTimes = [15, 20, 30, 45].map(min => {
    const d = new Date(Date.now() + min * 60000);
    d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0);
    return { min, time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` };
  });

  const addToCartDirectly = (product: Product) => {
    setCart(prev => {
      // Find an existing item that is identical (same ID and no modifications)
      const existingIdx = prev.findIndex(item => 
        item.id === product.id && 
        item.addedIngredients.length === 0 && 
        item.removedIngredients.length === 0 && 
        !item.notes
      );

      if (existingIdx > -1) {
        const newCart = [...prev];
        newCart[existingIdx] = {
          ...newCart[existingIdx],
          quantity: newCart[existingIdx].quantity + 1
        };
        return newCart;
      }

      // Add as new item
      const newItem: CustomizedItem = {
        ...product,
        quantity: 1,
        addedIngredients: [],
        removedIngredients: [],
        notes: '',
        uniqueId: newUniqueId()
      };
      return [...prev, newItem];
    });
  };

  const openCustomization = (product: Product) => {
    setEditingItem({
      ...product,
      quantity: 1,
      addedIngredients: [],
      removedIngredients: [],
      notes: '',
      uniqueId: newUniqueId()
    });
    setIsModalOpen(true);
  };

  const editCartItem = (item: CustomizedItem) => {
    setEditingItem({ ...item });
    setIsModalOpen(true);
  };

  const saveCustomization = (item: CustomizedItem) => {
    setCart(prev => {
      const existingIdx = prev.findIndex(i => i.uniqueId === item.uniqueId);
      if (existingIdx > -1) {
        const newCart = [...prev];
        newCart[existingIdx] = item;
        return newCart;
      }
      return [...prev, item];
    });
    setIsModalOpen(false);
    setEditingItem(null);
  };

  const removeFromCart = (uniqueId: string) => {
    setCart(prev => prev.filter(i => i.uniqueId !== uniqueId));
  };

  const total = roundCents(cart.reduce((sum, item) => sum + calculateItemPrice(item, ingredients), 0));
  const submitOrder = async () => {
    if (!customerName.trim() || cart.length === 0 || !pickupTime) {
      addToast({ type: 'warning', title: 'Dati mancanti', message: 'Inserisci nome, orario di ritiro e almeno un prodotto' });
      return;
    }
    if (saving) return;
    const nome = customerName.trim().toUpperCase();

    if (IS_DEMO_MODE) {
      addToast({ type: 'info', title: 'Demo', message: `Ordine simulato: ${nome}, ritiro ${pickupTime}.` });
      setCart([]);
      setCustomerName('');
      setPickupTime('');
      return;
    }

    setSaving(true);
    try {
      // Coda offline come gli ordini al tavolo: se la rete cade, l'ordine parte appena torna
      await syncManager.pushOrder({
        nome_cliente: nome,
        orario_ritiro: pickupTime,
        totale: total,
        status: 'IN_ATTESA',
        carrello: cart.map(i => {
          const extras = i.addedIngredients.reduce((s, a) => s + a.prezzo, 0);
          const removals = i.removedIngredients.reduce((s, rName) => {
            const ing = ingredients.find(ig => ig.nome.toLowerCase() === rName.toLowerCase());
            return s + (ing?.prezzo_rimozione || 0);
          }, 0);
          return {
            nome: i.nome,
            quantity: i.quantity,
            prezzo_unitario: Math.max(0, i.prezzo + extras - removals),
            modifiche: {
              aggiunte: i.addedIngredients.map(a => a.nome),
              rimozioni: i.removedIngredients,
              note: i.notes
            }
          };
        }),
      });
    } catch {
      addToast({ type: 'error', title: 'Errore', message: 'Ordine non salvato. Riprova.' });
      setSaving(false);
      return;
    }

    // Comanda in cucina: intestazione con nome e orario di ritiro (tutto su un foglio, bevande comprese)
    const items = cart.filter(i => i.categoria !== 'Servizio');
    try {
      await printKitchenViaAgent(items, `ASP ${nome}`, getPrintAgentUrl(), getPrinterIp(), getPrinterPort(), `RITIRO ${pickupTime}`, undefined, true);
      addToast({ type: 'success', title: 'Ordine salvato e stampato', message: `${nome} · ritiro ${pickupTime}` });
    } catch (error) {
      addToast({ type: 'warning', title: 'Ordine salvato, stampa non riuscita', message: printErrorMessage(error), duration: 6000 });
    }
    setSaving(false);

    if (returnTo) {
      const back = new URL(returnTo, window.location.origin);
      back.searchParams.set('asporto', pickupTime);
      back.searchParams.set('totale', total.toFixed(2));
      back.searchParams.set('nome', customerName);
      navigate(back.pathname + back.search);
      return;
    }
    setCart([]);
    setCustomerName('');
    setPickupTime('');
  };

  // Coperto/servizio ed extra non servono all'asporto
  const takeawayProducts = products.filter(p => p.categoria !== 'Servizio' && p.categoria !== 'EXTRA');
  const categories = Array.from(new Set(takeawayProducts.map(p => p.categoria)));
  const filteredProducts = takeawayProducts.filter(p => 
    (!activeCategory || p.categoria === activeCategory) &&
    (!searchQuery || p.nome.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const renderProductCard = (p: Product) => (
    <div
      key={p.id}
      className={`bg-surface border rounded-[32px] flex flex-col justify-between text-left transition-all group relative overflow-hidden h-40 ${p.disponibile ? 'border-surface-light' : 'opacity-40 grayscale pointer-events-none'}`}
    >
      <div 
        onClick={() => addToCartDirectly(p)}
        className="absolute inset-0 z-0 p-6 flex flex-col justify-between active:scale-[0.98] transition-transform cursor-pointer"
      >
        <div>
          <h3 className="font-black text-xl text-white leading-tight mb-2 group-hover:text-gold transition-colors">{p.nome}</h3>
          <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-2 py-0.5 bg-charcoal rounded-full border border-surface-light">{p.categoria}</span>
        </div>
        <div className="flex justify-between items-end">
          <span className="text-2xl font-black text-white italic">€{p.prezzo.toFixed(2)}</span>
          <div className="flex items-center gap-2">
            <button 
              onClick={(e) => { e.stopPropagation(); openCustomization(p); }}
              className="p-3 bg-charcoal rounded-2xl text-gold border border-surface-light hover:bg-surface-light-hover transition-all active:scale-95"
            >
              <Edit3 size={20} />
            </button>
            <div className="p-3 bg-charcoal rounded-2xl text-gold border border-surface-light group-hover:bg-gold group-hover:text-black transition-all">
              <Plus size={20} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-screen bg-charcoal flex overflow-hidden font-sans">
      
      {/* Left: Menu (70%) */}
      <main className="flex-1 flex flex-col min-w-0 p-8 border-r border-surface-light">
        <header className="mb-10 flex justify-between items-center">
          <div className="flex items-center gap-6">
            <Link to="/" className="p-3 bg-surface border border-surface-light rounded-2xl text-gray-500 hover:text-white transition-all shadow-xl active:scale-90">
              <LayoutDashboard size={24} />
            </Link>
            <div>
               <h1 className="text-4xl font-black text-white tracking-tight uppercase italic">Nuovo <span className="text-gold">Asporto</span></h1>
               <p className="text-xs font-black text-gray-500 tracking-widest uppercase mt-1">Tablet Mode • Terminal 01</p>
            </div>
          </div>

          <div className="relative w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
            <input 
              type="text" 
              placeholder="Cerca pizza o bevanda..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-surface border border-surface-light rounded-2xl py-3 pl-12 pr-4 text-white font-bold outline-none focus:border-gold transition-all"
            />
          </div>
        </header>

        {/* Categories */}
        <div className="flex gap-2 overflow-x-auto pb-4 hide-scrollbar mb-6">
          <button 
            onClick={() => setActiveCategory(null)}
            className={`px-6 py-2.5 rounded-xl font-black text-xs tracking-widest transition-all border ${!activeCategory ? 'bg-gold border-gold text-black' : 'bg-surface border-surface-light text-gray-500 hover:text-white'}`}
          >
            TUTTI
          </button>
          {categories.map(cat => (
            <button 
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-6 py-2.5 rounded-xl font-black text-xs tracking-widest transition-all border whitespace-nowrap ${activeCategory === cat ? 'bg-gold border-gold text-black' : 'bg-surface border-surface-light text-gray-500'}`}
            >
              {cat.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar pb-12">
          {(() => {
            const showSub = activeCategory === 'Bevande' || (!activeCategory && filteredProducts.some(p => p.categoria === 'Bevande'));
            if (showSub) {
              const bevande = filteredProducts.filter(p => p.categoria === 'Bevande');
              const other = filteredProducts.filter(p => p.categoria !== 'Bevande');
              const subcats = [...new Set(bevande.map(p => p.sottocategoria || 'Altro'))];
              return (
                <>
                  <div className="grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3 mb-4">
                    {other.map(product => renderProductCard(product))}
                  </div>
                  {subcats.map(sub => (
                    <div key={sub}>
                      <div className="text-[10px] font-black text-gold uppercase tracking-widest py-2 px-1 mt-6 mb-3">{sub}</div>
                      <div className="grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
                        {bevande.filter(p => (p.sottocategoria || 'Altro') === sub).map(product => renderProductCard(product))}
                      </div>
                    </div>
                  ))}
                </>
              );
            }
            return (
              <div className="grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
                {filteredProducts.map(product => renderProductCard(product))}
              </div>
            );
          })()}
        </div>
      </main>

      {/* Right: Checkout Sidebar (30%) */}
      <aside className="w-[420px] shrink-0 bg-surface flex flex-col shadow-2xl relative">
        <header className="p-8 border-b border-surface-light bg-surface-light/20">
          <h2 className="text-xl font-black italic uppercase tracking-tighter text-white mb-6 flex items-center gap-3">
             <Utensils size={24} className="text-gold" /> Ordine Attuale
          </h2>
          
          <div className="space-y-6">
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
              <input 
                type="text" 
                placeholder="NOME CLIENTE"
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                className="w-full bg-charcoal border border-surface-light rounded-2xl py-4 pl-12 text-gold font-black uppercase placeholder:opacity-30 outline-none focus:border-gold/40"
              />
            </div>
            
            {/* Orario di ritiro: scorciatoie o ora scritta a mano */}
            <div>
              <div className="flex items-center gap-2 mb-2 px-1 text-xs font-bold text-gray-400">
                <Clock size={14} /> Orario di ritiro
              </div>
              <div className="flex gap-2">
                {quickTimes.map(q => (
                  <button
                    key={q.min}
                    type="button"
                    onClick={() => setPickupTime(q.time)}
                    className={`flex-1 py-2.5 rounded-xl border font-bold text-sm transition-all active:scale-95 ${
                      pickupTime === q.time ? 'bg-gold border-gold text-black' : 'bg-charcoal border-surface-light text-gray-300'
                    }`}
                  >
                    <span className="block text-base font-black tabular-nums">{q.time}</span>
                    <span className="block text-[11px] opacity-70">+{q.min} min</span>
                  </button>
                ))}
              </div>
              <input
                type="time"
                value={pickupTime}
                onChange={e => setPickupTime(e.target.value)}
                aria-label="Orario di ritiro"
                className="mt-2 w-full bg-charcoal border border-surface-light rounded-xl py-3 px-4 text-white text-lg font-black tabular-nums outline-none focus:border-gold"
              />
            </div>
          </div>
        </header>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-600 opacity-50">
              <ShoppingCart size={48} className="mb-4" />
              <p className="font-black uppercase text-[10px] tracking-widest">Scegli qualcosa dal menu</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.uniqueId} className="bg-charcoal/50 border border-surface-light rounded-[28px] p-5 relative group border-l-4 border-l-gold">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-black text-lg text-white leading-none">{item.nome}</h3>
                    <div className="mt-2 space-y-1">
                      {item.addedIngredients.map(a => <span key={a.nome} className="inline-block text-[10px] font-bold text-emerald-400 mr-2 bg-emerald-500/10 px-2 py-0.5 rounded">+{a.nome}</span>)}
                      {item.removedIngredients.map(r => <span key={r} className="inline-block text-[10px] font-bold text-red-400 mr-2 bg-red-500/10 px-2 py-0.5 rounded">NO {r}</span>)}
                      {item.notes && <p className="text-[10px] text-amber-500 italic mt-1 font-bold">* {item.notes}</p>}
                    </div>
                  </div>
                  <button onClick={() => removeFromCart(item.uniqueId)} className="p-2 text-gray-600 hover:text-red-500 transition-colors">
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="flex justify-between items-center pt-3 border-t border-surface-light">
                  <div className="flex items-center gap-3">
                     <button onClick={() => editCartItem(item)} className="text-[10px] font-black uppercase text-gray-500 hover:text-white flex items-center gap-1">
                        <Edit3 size={12} /> MODIFICA
                     </button>
                  </div>
                  <div className="flex items-center gap-2">
                     <span className="text-gray-500 font-bold text-xs">x{item.quantity}</span>
                     <span className="text-white font-black">€{calculateItemPrice(item, ingredients).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Total & Submit */}
        <div className="p-8 border-t border-surface-light bg-surface-light/10">
          <div className="flex justify-between items-end mb-6">
            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Totale</span>
            <span className="text-5xl font-black text-white italic tracking-tighter">€<span className="text-gold">{total.toFixed(2)}</span></span>
          </div>

          <div className="flex gap-4">
             <button 
              onClick={() => setIsPreviewOpen(true)}
              disabled={cart.length === 0}
              className="p-5 bg-charcoal hover:bg-surface-light border border-surface-light rounded-3xl text-gray-400 hover:text-white transition-all disabled:opacity-30"
              title="Vedi Anteprima Comanda"
             >
                <Eye size={24} />
             </button>
             <button 
              onClick={submitOrder}
              disabled={cart.length === 0 || !pickupTime}
              className="flex-1 bg-gold hover:bg-gold-hover text-black py-6 rounded-3xl font-black text-xl uppercase tracking-tighter shadow-2xl shadow-gold/20 flex items-center justify-center gap-3 transition-all active:scale-95 disabled:grayscale disabled:opacity-50"
             >
              {saving ? 'SALVATAGGIO…' : <>SALVA E STAMPA <Save size={24} /></>}
             </button>
          </div>
        </div>
      </aside>

      <ProductCustomizationModal
        isOpen={isModalOpen}
        editingItem={editingItem}
        ingredients={ingredients}
        variant="desktop"
        onClose={() => setIsModalOpen(false)}
        onSave={saveCustomization}
      />

      {/* Print Preview Modal - Kitchen Style */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
           <div className="bg-white text-black w-full max-w-sm rounded-sm p-10 font-mono shadow-[0_0_50px_rgba(255,255,255,0.1)] relative">
              <button 
                onClick={() => setIsPreviewOpen(false)}
                className="absolute -top-12 right-0 text-white flex items-center gap-2 uppercase font-black text-xs tracking-widest"
              >
                Chiudi <X size={18} />
              </button>

              <div className="mb-6 bg-black text-white p-6 rounded-sm text-center">
                 <p className="text-xs font-bold uppercase tracking-[0.3em] opacity-70 mb-2">ORDINE PER</p>
                 <p className="text-3xl font-black uppercase tracking-tighter">{customerName || 'N/A'}</p>
              </div>

              <div className="flex justify-between items-center mb-8 px-2 border-b-2 border-black pb-4">
                 <div>
                    <p className="text-[10px] font-bold text-gray-500 uppercase">ORARIO RITIRO</p>
                    <p className="text-2xl font-black">{pickupTime}</p>
                 </div>
                 <div className="text-right">
                    <p className="text-[10px] font-bold text-gray-500 uppercase">TOT. PIATTI</p>
                    <p className="text-2xl font-black">{cart.length}</p>
                 </div>
              </div>

              <div className="space-y-6 mb-10">
                 {cart.map((item, idx) => (
                    <div key={idx} className="border-b-2 border-dashed border-gray-200 pb-4">
                       <div className="flex justify-between font-black text-lg leading-tight uppercase">
                          <span>{item.quantity}x {item.nome}</span>
                       </div>
                       <ul className="text-xs font-black ml-4 mt-2 space-y-1">
                          {item.removedIngredients.map(r => <li key={r} className="text-gray-400 line-through">- NO {r.toUpperCase()}</li>)}
                          {item.addedIngredients.map(a => <li key={a.nome} className="text-black bg-gray-100 px-1 inline-block">+ {a.nome.toUpperCase()}</li>)}
                          {item.notes && <li className="text-black underline decoration-2 mt-1 decoration-gold/50 flex items-start gap-2 pt-1 border-t border-gray-100 uppercase font-black break-words"><span>NOTE:</span> {item.notes.toUpperCase()}</li>}
                       </ul>
                    </div>
                 ))}
              </div>

              <div className="pt-4 border-t-2 border-dashed border-black text-center opacity-40">
                 <p className="text-[10px] font-bold uppercase tracking-[0.3em]">{new Date().toLocaleString('it-IT')}</p>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
