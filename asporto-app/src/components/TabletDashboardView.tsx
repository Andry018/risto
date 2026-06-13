import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { LayoutDashboard, BookOpen, Map as MapIcon, Calculator, Settings, X, Database, RefreshCw, Trash2, LogOut, Users, ShieldCheck, Clock, Activity, ArrowRight, BarChart3, Calendar } from 'lucide-react';
import TableMapView from './TableMapView';
import POSView from './POSView';
import AdminView from './AdminView';
import ReportsView from './ReportsView';
import ReservationsView from './ReservationsView';
import { staffLogout, getCurrentUser, getStaffUsers, removeStaffUser, updateStaffUser, type StaffUser, type StaffRole } from '../lib/staffAuth';
import { dbUtils } from '../lib/DatabaseUtils';
import { useConfirm } from '../components/ConfirmModal';
import { useToast } from '../components/Toast';

export default function TabletDashboardView() {
  const { confirm } = useConfirm();
  const { addToast } = useToast();
  const [activeView, setActiveView] = useState<'DASHBOARD' | 'POS' | 'MAPPA' | 'MENU' | 'PRENOTAZIONI' | 'REPORTS'>('DASHBOARD');
  const [selectedTable, setSelectedTable] = useState<{ id: string, nome: string } | null>(null);
  const [freedTableIds, setFreedTableIds] = useState<Set<string>>(new Set());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const currentUser = getCurrentUser();
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editUserName, setEditUserName] = useState('');
  const [editUserPin, setEditUserPin] = useState('');
  const [editUserRole, setEditUserRole] = useState<StaffRole>('waiter');

  const [stats, setStats] = useState({
    pendingOrders: 0,
    occupiedTables: 0,
    totalToday: 0
  });

  async function fetchStats() {
    if (!supabase) return;
    const today = new Date().toISOString().split('T')[0];
    const [ordersRes, tablesRes] = await Promise.all([
      supabase.from('ordini').select('status, totale').gte('created_at', today),
      supabase.from('tavoli').select('status')
    ]);
    type OrderRow = { status: string; totale: number };
    type TableRow = { status: string };
    const pending = ordersRes.data?.filter((o: OrderRow) => o.status === 'IN_ATTESA').length || 0;
    const total = ordersRes.data?.reduce((sum: number, o: OrderRow) => sum + o.totale, 0) || 0;
    const occupied = tablesRes.data?.filter((t: TableRow) => t.status === 'OCCUPATO').length || 0;
    setStats({ pendingOrders: pending, occupiedTables: occupied, totalToday: total });
  }

  useEffect(() => {
    void fetchStats();
    if (!supabase) return;
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleCleanup = async () => {
    const ok = await confirm({ title: 'Pulisci database', message: 'Eliminare TUTTI gli ordini e resettare i tavoli?', destructive: true });
    if (!ok) return;
    setLoading('cleanup');
    try { await dbUtils.cleanupDatabase(); void fetchStats(); addToast({ type: 'success', title: 'Database pulito!' }); } catch { addToast({ type: 'error', title: 'Errore pulizia' }); }
    finally { setLoading(null); }
  };

  const handlePopulate = async () => {
    setLoading('populate');
    try { await dbUtils.populateDemoData(); void fetchStats(); addToast({ type: 'success', title: 'Dati demo ripristinati!' }); }
    catch { addToast({ type: 'error', title: 'Errore salvataggio' }); }
    finally { setLoading(null); }
  };

  const allModules = [
    {
      title: "Cassa (POS)",
      desc: "Terminal vendite e pagamenti",
      icon: Calculator,
      view: 'POS' as const,
      color: "from-fuchsia-500/20 to-fuchsia-500/5",
      iconColor: "text-fuchsia-400"
    },
    {
      title: "Mappa Tavoli",
      desc: "Gestione visiva della sala",
      icon: MapIcon,
      view: 'MAPPA' as const,
      color: "from-gold/20 to-gold/5",
      iconColor: "text-gold",
      badge: `${stats.occupiedTables} occupati`
    },
    {
      title: "Gestione Menù",
      desc: "Prodotti, aggiunte e rimozioni",
      icon: BookOpen,
      view: 'MENU' as const,
      color: "from-indigo-500/20 to-indigo-500/5",
      iconColor: "text-indigo-400"
    },
    {
      title: "Prenotazioni",
      desc: "Libro prenotazioni e check-in",
      icon: Calendar,
      view: 'PRENOTAZIONI' as const,
      color: "from-emerald-500/20 to-emerald-500/5",
      iconColor: "text-emerald-400"
    },
    {
      title: "Report & Analytics",
      desc: "Vendite, statistiche e fatture",
      icon: BarChart3,
      view: 'REPORTS' as const,
      color: "from-sky-500/20 to-sky-500/5",
      iconColor: "text-sky-400"
    }
  ];

  if (activeView === 'DASHBOARD') {
    return (
      <div className="min-h-screen bg-charcoal text-white p-6 md:p-12 overflow-hidden relative">
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-gold/5 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] bg-emerald-500/5 blur-[100px] rounded-full pointer-events-none" />

        <div className="max-w-7xl mx-auto relative z-10 flex flex-col min-h-full">
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
              {currentUser && (
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mt-2">
                  {currentUser.name} • <span className="text-gold">{currentUser.role.toUpperCase()}</span>
                </p>
              )}
            </div>

            <div className="flex gap-4">
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

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {allModules.map((m, idx) => (
              <button
                key={idx}
                onClick={() => setActiveView(m.view)}
                className={`group relative bg-surface border border-surface-light rounded-[40px] p-8 transition-all hover:scale-[1.02] active:scale-95 shadow-2xl overflow-hidden flex flex-col h-72 text-left`}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${m.color} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />

                <div className="relative z-10 flex flex-col h-full">
                  <div className="flex justify-between items-start mb-6">
                    <div className={`p-4 rounded-3xl bg-charcoal border border-surface-light shadow-inner ${m.iconColor}`}>
                      <m.icon size={32} />
                    </div>
                    {m.badge && (
                      <span className="bg-charcoal px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-surface-light text-gray-400 group-hover:text-white transition-colors">
                        {m.badge}
                      </span>
                    )}
                  </div>

                  <div className="mt-auto">
                    <h3 className="text-2xl font-black italic uppercase tracking-tight text-white mb-2 group-hover:text-gold transition-colors">{m.title}</h3>
                    <p className="text-sm text-gray-500 font-medium leading-relaxed max-w-[80%]">{m.desc}</p>
                  </div>

                  <div className="absolute bottom-8 right-8 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 translate-x-4 transition-all duration-300">
                     <ArrowRight className={m.iconColor} size={28} />
                  </div>
                </div>
              </button>
            ))}
          </div>

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
                <button
                  onClick={() => { setStaffUsers(getStaffUsers()); setIsSettingsOpen(true); }}
                  className="p-3 bg-charcoal hover:bg-surface-light border border-surface-light rounded-2xl text-gray-500 transition-all hover:text-gold active:scale-95"
                >
                  <Settings size={20} />
                </button>
             </div>
          </footer>
        </div>

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

                  <section>
                    <h3 className="text-xs font-black text-gray-500 tracking-[0.2em] uppercase mb-4 flex items-center gap-2">
                      <Users size={14} /> Gestione Operatori
                    </h3>
                    <div className="space-y-2 mb-6">
                      {staffUsers.map(user => (
                        <div key={user.id} className="bg-charcoal border border-surface-light rounded-2xl p-4">
                          {editingUserId === user.id ? (
                            <div className="space-y-2">
                              <input type="text" value={editUserName} onChange={e => setEditUserName(e.target.value)}
                                className="w-full bg-surface border border-surface-light rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-gold" />
                              <input type="password" placeholder="Nuovo PIN" value={editUserPin} onChange={e => setEditUserPin(e.target.value)}
                                className="w-full bg-surface border border-surface-light rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-gold" />
                              <select value={editUserRole} onChange={e => setEditUserRole(e.target.value as StaffRole)}
                                className="w-full bg-surface border border-surface-light rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-gold">
                                <option value="waiter">Cameriere</option>
                                <option value="kitchen">Cucina</option>
                                <option value="admin">Amministratore / Cassa</option>
                              </select>
                              <div className="flex gap-2">
                                <button onClick={() => setEditingUserId(null)}
                                  className="flex-1 py-2 bg-charcoal border border-surface-light rounded-xl text-[10px] font-black uppercase text-gray-400">Annulla</button>
                                <button onClick={() => {
                                  const updates: Partial<StaffUser> = { name: editUserName, role: editUserRole };
                                  if (editUserPin.trim()) updates.pin = editUserPin.trim();
                                  updateStaffUser(user.id, updates);
                                  setEditingUserId(null);
                                  setStaffUsers(getStaffUsers());
                                }}
                                  className="flex-1 py-2 bg-gold text-black rounded-xl text-[10px] font-black uppercase">Salva</button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-surface rounded-xl flex items-center justify-center text-gold font-black">{user.name.charAt(0).toUpperCase()}</div>
                                <div>
                                  <p className="font-bold text-white text-sm">{user.name}</p>
                                  <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">{user.role}</p>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <button onClick={() => {
                                  setEditingUserId(user.id);
                                  setEditUserName(user.name);
                                  setEditUserPin('');
                                  setEditUserRole(user.role);
                                }} className="text-[10px] font-black text-gray-500 hover:text-gold uppercase">Modifica</button>
                                {currentUser?.role === 'admin' && user.id !== currentUser.id && (
                                  <button onClick={async () => { const ok = await confirm({ title: 'Elimina', message: `Eliminare ${user.name}?`, destructive: true }); if (ok) { removeStaffUser(user.id); setStaffUsers(getStaffUsers()); } }}
                                    className="text-[10px] font-black text-red-500/50 hover:text-red-500 uppercase">Elimina</button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>

                  <section>
                    <h3 className="text-xs font-black text-gray-500 tracking-[0.2em] uppercase mb-4 flex items-center gap-2">
                      <ShieldCheck size={14} /> Configurazione & Sicurezza
                    </h3>
                    <div className="space-y-4">
                      <button
                        onClick={async () => { const ok = await confirm({ title: 'Uscita', message: 'Uscire dall\'area staff? Dovrai reinserire il PIN.' }); if (ok) staffLogout(); }}
                        className="w-full bg-charcoal border border-red-500/30 hover:border-red-500/50 p-5 rounded-3xl flex items-center justify-center gap-3 text-red-400 font-black text-xs uppercase tracking-widest transition-colors"
                      >
                        <LogOut size={18} /> Esci dall&apos;area staff
                      </button>
                    </div>
                  </section>
                </div>

                <div className="mt-12 flex justify-center">
                   <p className="text-[10px] font-bold text-gray-600 uppercase tracking-[0.5em]">Il Girasole · Ristorante Pizzeria</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Sub-views
  return (
    <div className="min-h-screen bg-charcoal text-white flex flex-col h-screen overflow-hidden">
      {selectedTable ? (
        <div className="h-full">
          <POSView
            tableId={selectedTable.id}
            tableName={selectedTable.nome}
            onNavigateHome={() => { setActiveView('DASHBOARD'); setSelectedTable(null); }}
            onOrderFinished={() => {
              setFreedTableIds(prev => new Set(prev).add(selectedTable.id));
              setSelectedTable(null);
            }}
          />
        </div>
      ) : activeView === 'POS' ? (
        <POSView onNavigateHome={() => setActiveView('DASHBOARD')} />
      ) : activeView === 'MAPPA' ? (
        <TableMapView freedTableIds={freedTableIds} onNavigateHome={() => setActiveView('DASHBOARD')} onSelectTable={(id, nome) => {
          setSelectedTable({ id, nome });
        }} />
      ) : activeView === 'PRENOTAZIONI' ? (
        <ReservationsView onNavigateHome={() => setActiveView('DASHBOARD')} />
      ) : activeView === 'MENU' ? (
        <AdminView onNavigateHome={() => setActiveView('DASHBOARD')} />
      ) : activeView === 'REPORTS' ? (
        <ReportsView onNavigateHome={() => setActiveView('DASHBOARD')} />
      ) : null}
    </div>
  );
}
