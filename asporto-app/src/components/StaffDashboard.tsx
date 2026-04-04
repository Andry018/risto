import { Link } from 'react-router-dom';
import { 
  PhoneCall,
  LayoutDashboard, 
  Map, 
  ShoppingCart, 
  ChefHat, 
  Calculator, 
  Settings, 
  Clock, 
  TrendingUp,
  Activity,
  ArrowRight,
  X,
  Database,
  ShieldCheck,
  CreditCard,
  RefreshCw,
  Trash2
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { dbUtils } from '../lib/DatabaseUtils';

export default function StaffDashboard() {
  const [stats, setStats] = useState({
    pendingOrders: 0,
    occupiedTables: 0,
    totalToday: 0
  });
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
    
    // Stats real-time subscription
    const ordersChannel = supabase.channel('dashboard-stats')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ordini' }, () => fetchStats())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tavoli' }, () => fetchStats())
      .subscribe();
    
    // Dynamic Clock
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    
    return () => { 
      supabase.removeChannel(ordersChannel); 
      clearInterval(timer);
    };
  }, []);

  async function fetchStats() {
    const today = new Date().toISOString().split('T')[0];
    
    const [ordersRes, tablesRes] = await Promise.all([
      supabase.from('ordini').select('status, totale').gte('created_at', today),
      supabase.from('tavoli').select('status')
    ]);

    const pending = ordersRes.data?.filter(o => o.status === 'IN_ATTESA').length || 0;
    const total = ordersRes.data?.reduce((sum, o) => sum + o.totale, 0) || 0;
    const occupied = tablesRes.data?.filter(t => t.status === 'OCCUPATO').length || 0;

    setStats({ pendingOrders: pending, occupiedTables: occupied, totalToday: total });
  }

  const handleCleanup = async () => {
    if (!confirm('Sei sicuro? Questo eliminerà TUTTI gli ordini e resetterà i tavoli.')) return;
    setLoading('cleanup');
    try {
      await dbUtils.cleanupDatabase();
      await fetchStats();
      alert('Database pulito!');
    } catch (e) {
      alert('Errore pulizia');
    } finally {
      setLoading(null);
    }
  };

  const handlePopulate = async () => {
    setLoading('populate');
    try {
      await dbUtils.populateDemoData();
      await fetchStats();
      alert('Dati demo ripristinati!');
    } catch (e) {
      alert('Errore salvataggio');
    } finally {
      setLoading(null);
    }
  };

  const modules = [
    {
      title: "Nuovo Asporto",
      desc: "Gestione chiamate tablet",
      icon: PhoneCall,
      path: "/takeaway",
      color: "from-amber-500/20 to-amber-500/5",
      iconColor: "text-amber-400",
      badge: "Phone"
    },
    {
      title: "Mappa Tavoli",
      desc: "Gestione visiva della sala",
      icon: Map,
      path: "/map",
      color: "from-gold/20 to-gold/5",
      iconColor: "text-gold",
      badge: `${stats.occupiedTables} occupati`
    },
    {
      title: "Prendi Ordine",
      desc: "Interfaccia rapida cameriere",
      icon: ShoppingCart,
      path: "/waiter",
      color: "from-emerald-500/20 to-emerald-500/5",
      iconColor: "text-emerald-400",
      badge: "Mobile"
    },
    {
      title: "Cucina (KDS)",
      desc: "Coda ordini e preparazioni",
      icon: ChefHat,
      path: "/kitchen",
      color: "from-blue-500/20 to-blue-500/5",
      iconColor: "text-blue-400",
      badge: `${stats.pendingOrders} in coda`
    },
    {
      title: "Cassa (POS)",
      desc: "Terminal vendite e pagamenti",
      icon: Calculator,
      path: "/pos",
      color: "from-fuchsia-500/20 to-fuchsia-500/5",
      iconColor: "text-fuchsia-400",
      badge: "Desktop"
    }
  ];

  return (
    <div className="min-h-screen bg-charcoal text-white p-6 md:p-12 overflow-hidden relative">
      {/* Background Ornaments */}
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-gold/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] bg-emerald-500/5 blur-[100px] rounded-full pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10 flex flex-col min-h-full">
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-16">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-surface rounded-xl border border-surface-light shadow-xl">
                 <LayoutDashboard className="text-gold" size={24} />
              </div>
              <span className="text-xs font-black uppercase tracking-[0.3em] text-gray-500">Control Center</span>
            </div>
            <h1 className="text-5xl md:text-6xl font-black italic uppercase tracking-tighter">
              Risto<span className="text-gold">Premium</span>
            </h1>
          </div>

          <div className="flex gap-4">
             <div className="bg-surface/50 backdrop-blur-md border border-surface-light p-4 px-6 rounded-3xl shadow-xl flex items-center gap-4">
                <div className="p-3 bg-emerald-500/10 rounded-2xl">
                   <TrendingUp className="text-emerald-400" size={20} />
                </div>
                <div>
                   <p className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Incasso Odierno</p>
                   <p className="text-2xl font-black italic">€{stats.totalToday.toFixed(2)}</p>
                </div>
             </div>
             
             <div className="bg-surface/50 backdrop-blur-md border border-surface-light p-4 px-6 rounded-3xl shadow-xl flex items-center gap-4">
                <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-400">
                   <Clock size={20} className="animate-pulse" />
                </div>
                <div>
                   <p className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Orario Locale</p>
                   <p className="text-2xl font-black italic">
                      {currentTime.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                   </p>
                </div>
             </div>
          </div>
        </header>

        {/* Modules Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {modules.map((m, idx) => (
            <Link 
              key={idx} 
              to={m.path}
              className={`group relative bg-surface border border-surface-light rounded-[40px] p-8 transition-all hover:scale-[1.02] active:scale-95 shadow-2xl overflow-hidden flex flex-col h-72`}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${m.color} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
              
              <div className="relative z-10 flex flex-col h-full">
                <div className="flex justify-between items-start mb-6">
                  <div className={`p-4 rounded-3xl bg-charcoal border border-surface-light shadow-inner ${m.iconColor}`}>
                    <m.icon size={32} />
                  </div>
                  <span className="bg-charcoal px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-surface-light text-gray-400 group-hover:text-white transition-colors">
                    {m.badge}
                  </span>
                </div>

                <div className="mt-auto">
                  <h3 className="text-2xl font-black italic uppercase tracking-tight text-white mb-2 group-hover:text-gold transition-colors">{m.title}</h3>
                  <p className="text-sm text-gray-500 font-medium leading-relaxed max-w-[80%]">{m.desc}</p>
                </div>

                <div className="absolute bottom-8 right-8 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 translate-x-4 transition-all duration-300">
                   <ArrowRight className={m.iconColor} size={28} />
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Action Bar / Bottom Section */}
        <footer className="mt-auto flex flex-col md:flex-row items-center justify-between gap-8 py-8 border-t border-surface-light">
           <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                 <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                 <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Sistema Operativo</span>
              </div>
              <div className="h-4 w-px bg-surface-light" />
              <div className="flex items-center gap-3">
                 <Activity size={16} className="text-gold" />
                 <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Database Connesso</span>
              </div>
           </div>

           <div className="flex items-center gap-4">
              <Link to="/asporto" className="flex items-center gap-2 px-6 py-3 bg-charcoal hover:bg-surface-light border border-surface-light rounded-2xl text-xs font-black uppercase tracking-widest transition-all">
                Vista Cliente <ArrowRight size={14} />
              </Link>
              <button 
                onClick={() => setIsSettingsOpen(true)}
                className="p-3 bg-charcoal hover:bg-surface-light border border-surface-light rounded-2xl text-gray-500 transition-all hover:text-gold active:scale-95"
              >
                <Settings size={20} />
              </button>
           </div>
        </footer>
      </div>

      {/* Settings Modal (Glassmorphism) */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="bg-surface border border-surface-light w-full max-w-xl rounded-[40px] shadow-[0_0_100px_rgba(0,0,0,0.5)] overflow-hidden">
            <div className="p-8 md:p-12">
              <div className="flex justify-between items-center mb-10">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-charcoal rounded-2xl text-gold border border-surface-light shadow-xl">
                    <Settings size={24} />
                  </div>
                  <h2 className="text-3xl font-black italic tracking-tighter uppercase">Impostazioni <span className="text-gold">Sistema</span></h2>
                </div>
                <button onClick={() => setIsSettingsOpen(false)} className="p-3 hover:bg-white/10 rounded-full transition-colors text-gray-500">
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-8">
                {/* Database Section */}
                <section>
                  <h3 className="text-xs font-black text-gray-500 tracking-[0.2em] uppercase mb-4 flex items-center gap-2">
                    <Database size={14} /> Manutenzione Database
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <button 
                      onClick={handleCleanup}
                      disabled={loading === 'cleanup'}
                      className="p-6 bg-charcoal border border-surface-light rounded-3xl flex flex-col items-center gap-3 group hover:border-red-500/40 transition-all"
                    >
                      <div className="p-3 bg-red-500/10 rounded-2xl text-red-400 group-hover:scale-110 transition-transform">
                        <Trash2 size={24} />
                      </div>
                      <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest whitespace-nowrap">
                        {loading === 'cleanup' ? 'PULIZIA...' : 'PULISCI DATABASE'}
                      </span>
                    </button>
                    <button 
                      onClick={handlePopulate}
                      disabled={loading === 'populate'}
                      className="p-6 bg-charcoal border border-surface-light rounded-3xl flex flex-col items-center gap-3 group hover:border-emerald-500/40 transition-all"
                    >
                      <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-400 group-hover:scale-110 transition-transform">
                        <RefreshCw size={24} />
                      </div>
                      <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest whitespace-nowrap">
                        {loading === 'populate' ? 'RIPRISTINO...' : 'POPOLA DATI DEMO'}
                      </span>
                    </button>
                  </div>
                </section>

                {/* Configuration Section */}
                <section>
                  <h3 className="text-xs font-black text-gray-500 tracking-[0.2em] uppercase mb-4 flex items-center gap-2">
                    <ShieldCheck size={14} /> Configurazione & Sicurezza
                  </h3>
                  <div className="space-y-4">
                    <div className="bg-charcoal border border-surface-light p-5 rounded-3xl flex items-center justify-between group">
                      <div className="flex items-center gap-4">
                         <div className="p-2 bg-surface rounded-xl text-gray-400">
                           <CreditCard size={18} />
                         </div>
                         <div>
                            <p className="text-sm font-bold text-white uppercase italic tracking-tight leading-none mb-1">SumUp Affiliate Key</p>
                            <p className="text-[10px] text-gray-500 uppercase font-black">Necessario per i pagamenti mobile</p>
                         </div>
                      </div>
                      <input 
                        type="password" 
                        placeholder="••••••••••••"
                        className="bg-surface border border-surface-light rounded-xl px-4 py-2 text-gold font-bold text-xs outline-none focus:border-gold/40 w-32"
                      />
                    </div>

                    <div className="bg-charcoal border border-surface-light p-5 rounded-3xl flex items-center justify-between group">
                      <div className="flex items-center gap-4">
                         <div className="p-2 bg-surface rounded-xl text-gray-400">
                           <Activity size={18} />
                         </div>
                         <div>
                            <p className="text-sm font-bold text-white uppercase italic tracking-tight leading-none mb-1">Modalità Test</p>
                            <p className="text-[10px] text-gray-500 uppercase font-black">Simula pagamenti senza carta</p>
                         </div>
                      </div>
                      <button className="w-12 h-6 bg-gold/10 rounded-full border border-gold/20 relative flex items-center px-1">
                        <div className="w-4 h-4 bg-gold rounded-full shadow-lg" />
                      </button>
                    </div>
                  </div>
                </section>
              </div>

              <div className="mt-12 flex justify-center">
                 <p className="text-[10px] font-bold text-gray-600 uppercase tracking-[0.5em]">RistoPremium v1.0.4 • Stable Build</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
