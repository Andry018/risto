import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getCurrentUser, getDefaultRouteForRole, getStaffUsers } from '../lib/staffAuth';
import { supabase, IS_DEMO_MODE } from '../lib/supabase';
import type { Order, OrderCarrelloItem } from '../types/entities';
import { MOCK_ORDERS } from '../lib/MockData';
import { LayoutDashboard, TrendingUp, ShoppingBag, DollarSign, Clock, Package, Award, FileText, LogOut, AlertTriangle, ArrowUpRight, ArrowDownRight, Minus, Users, ChevronLeft, ChevronRight } from 'lucide-react';
import { useConfirm } from './ConfirmModal';
import { useToast } from './Toast';

type Period = 'today' | 'week' | 'month';

interface ProductStat {
  name: string;
  count: number;
  revenue: number;
}

interface CategoryStat {
  name: string;
  revenue: number;
  count: number;
}

interface HourStat {
  hour: number;
  count: number;
  revenue: number;
}

interface WeekComparison {
  thisWeek: { revenue: number; count: number };
  lastWeek: { revenue: number; count: number };
}

export default function ReportsView({ onNavigateHome }: { onNavigateHome?: () => void } = {}) {
  const navigate = useNavigate();
  const { confirm } = useConfirm();
  const { addToast } = useToast();
  useEffect(() => {
    const user = getCurrentUser();
    if (user && user.role !== 'admin') {
      navigate(getDefaultRouteForRole(user.role), { replace: true });
    }
  }, []);
  const [orders, setOrders] = useState<Order[]>([]);
  const [period, setPeriod] = useState<Period>('today');
  const [loading, setLoading] = useState(true);
  const [weekComparison, setWeekComparison] = useState<WeekComparison | null>(null);
  const [view, setView] = useState<'stats' | 'turni'>('stats');
  const [turniMonth, setTurniMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [turniData, setTurniData] = useState<{ user_id: string; data: string; turno: string }[]>([]);

  async function fetchOrders() {
    if (IS_DEMO_MODE) {
      setOrders(MOCK_ORDERS);
      setLoading(false);
      return;
    }
    if (!supabase) { setLoading(false); return; }
    const now = new Date();
    let startDate: string;
    if (period === 'today') {
      const localMidnight = new Date(now);
      localMidnight.setHours(0, 0, 0, 0);
      startDate = localMidnight.toISOString();
    } else if (period === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      startDate = weekAgo.toISOString();
    } else {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      startDate = monthAgo.toISOString();
    }
    const { data } = await supabase.from('ordini').select('*').gte('created_at', startDate).order('created_at', { ascending: false });
    if (data) setOrders(data);
    setLoading(false);
  }

  useEffect(() => {
    setLoading(true);
    void fetchOrders();
  }, [period]);

  async function fetchWeekComparison() {
    if (IS_DEMO_MODE || !supabase) return;
    const now = new Date();
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const { data } = await supabase.from('ordini').select('created_at, totale, status').gte('created_at', twoWeeksAgo.toISOString());
    if (!data) return;
    const oneWeekAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    const acc: WeekComparison = { thisWeek: { revenue: 0, count: 0 }, lastWeek: { revenue: 0, count: 0 } };
    data.forEach((o: { created_at: string; totale: number; status: string }) => {
      if (o.status !== 'COMPLETATO') return;
      const t = new Date(o.created_at).getTime();
      const bucket = t >= oneWeekAgo ? acc.thisWeek : acc.lastWeek;
      bucket.revenue += o.totale;
      bucket.count += 1;
    });
    setWeekComparison(acc);
  }

  useEffect(() => { void fetchWeekComparison(); }, []);

  async function fetchTurni(month: string) {
    if (!supabase) return;
    const [y, m] = month.split('-').map(Number);
    const start = `${month}-01`;
    const end = `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
    const { data } = await supabase.from('turni').select('user_id, data, turno').gte('data', start).lte('data', end);
    if (data) setTurniData(data as { user_id: string; data: string; turno: string }[]);
  }

  useEffect(() => { if (view === 'turni') void fetchTurni(turniMonth); }, [view, turniMonth]);

  const stats = useMemo(() => {
    const completed = orders.filter(o => o.status === 'COMPLETATO');
    const totalRevenue = completed.reduce((sum, o) => sum + o.totale, 0);
    const totalOrders = completed.length;
    const avgOrder = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    const productMap = new Map<string, { count: number; revenue: number }>();
    const categoryMap = new Map<string, { count: number; revenue: number }>();

    completed.forEach(order => {
      (order.carrello || []).forEach((item: OrderCarrelloItem) => {
        const existing = productMap.get(item.nome) || { count: 0, revenue: 0 };
        existing.count += item.quantity;
        existing.revenue += (item.prezzo_unitario ?? 0) * item.quantity;
        productMap.set(item.nome, existing);

        const cat = item.categoria || 'Generale';
        const catExisting = categoryMap.get(cat) || { count: 0, revenue: 0 };
        catExisting.count += item.quantity;
        catExisting.revenue += (item.prezzo_unitario ?? 0) * item.quantity;
        categoryMap.set(cat, catExisting);
      });
    });

    const topProducts: ProductStat[] = Array.from(productMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    const categoryStats: CategoryStat[] = Array.from(categoryMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.revenue - a.revenue);

    const pendingCount = orders.filter(o => o.status === 'IN_ATTESA').length;

    const hourMap = new Map<number, { count: number; revenue: number }>();
    completed.forEach(order => {
      const hour = new Date(order.created_at).getHours();
      const existing = hourMap.get(hour) || { count: 0, revenue: 0 };
      existing.count += 1;
      existing.revenue += order.totale;
      hourMap.set(hour, existing);
    });
    const hourlyStats: HourStat[] = Array.from(hourMap.entries())
      .map(([hour, data]) => ({ hour, ...data }))
      .sort((a, b) => a.hour - b.hour);

    return { totalRevenue, totalOrders, avgOrder, topProducts, categoryStats, pendingCount, hourlyStats };
  }, [orders]);

  const periodLabel = period === 'today' ? 'Oggi' : period === 'week' ? 'Ultimi 7 Giorni' : 'Ultimi 30 Giorni';

  if (loading) return (
    <div className="min-h-screen bg-charcoal flex items-center justify-center">
      <div className="w-12 h-12 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-charcoal text-white p-6 md:p-10 overflow-y-auto">
      <div className="max-w-7xl mx-auto">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
          <div className="flex items-center gap-6">
            {onNavigateHome ? (
              <button onClick={onNavigateHome} className="p-3 bg-surface border border-surface-light rounded-2xl text-gray-500 hover:text-white transition-all">
                <LayoutDashboard size={24} />
              </button>
            ) : (
              <Link to="/" className="p-3 bg-surface border border-surface-light rounded-2xl text-gray-500 hover:text-white transition-all">
                <LayoutDashboard size={24} />
              </Link>
            )}
            <div>
              <h1 className="text-4xl font-black italic uppercase tracking-tighter">Report <span className="text-gold">& Analytics</span></h1>
              <p className="text-xs font-black text-gray-500 uppercase tracking-widest mt-1">{periodLabel}</p>
            </div>
          </div>
          <div className="flex gap-3 flex-wrap justify-end">
            <div className="flex gap-1 bg-surface p-1.5 rounded-2xl border border-surface-light">
              <button onClick={() => setView('stats')} className={`px-4 py-2 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${view === 'stats' ? 'bg-gold text-black shadow-lg' : 'text-gray-500 hover:text-white'}`}>Statistiche</button>
              <button onClick={() => setView('turni')} className={`px-4 py-2 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${view === 'turni' ? 'bg-gold text-black shadow-lg' : 'text-gray-500 hover:text-white'}`}><Users size={13} className="inline mr-1" />Turni</button>
            </div>
            {view === 'stats' && (
              <div className="flex gap-2 bg-surface p-1.5 rounded-2xl border border-surface-light">
                {(['today', 'week', 'month'] as Period[]).map(p => (
                  <button key={p} onClick={() => setPeriod(p)}
                    className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${period === p ? 'bg-gold text-black shadow-lg' : 'text-gray-500 hover:text-white'}`}
                  >
                    {p === 'today' ? 'Oggi' : p === 'week' ? 'Settimana' : 'Mese'}
                  </button>
                ))}
              </div>
            )}
          </div>
        </header>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          <div className="bg-surface border border-surface-light rounded-[32px] p-8">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-emerald-500/10 rounded-2xl"><DollarSign className="text-emerald-400" size={24} /></div>
              <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Incasso Totale</span>
            </div>
            <p className="text-4xl font-black italic text-white">€{stats.totalRevenue.toFixed(2)}</p>
          </div>
          <div className="bg-surface border border-surface-light rounded-[32px] p-8">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-blue-500/10 rounded-2xl"><ShoppingBag className="text-blue-400" size={24} /></div>
              <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Ordini Completati</span>
            </div>
            <p className="text-4xl font-black italic text-white">{stats.totalOrders}</p>
          </div>
          <div className="bg-surface border border-surface-light rounded-[32px] p-8">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-amber-500/10 rounded-2xl"><TrendingUp className="text-amber-400" size={24} /></div>
              <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Valore Medio Ordine</span>
            </div>
            <p className="text-4xl font-black italic text-white">€{stats.avgOrder.toFixed(2)}</p>
          </div>
          <div className="bg-surface border border-surface-light rounded-[32px] p-8">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-rose-500/10 rounded-2xl"><Clock className="text-rose-400" size={24} /></div>
              <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">In Attesa</span>
            </div>
            <p className="text-4xl font-black italic text-white">{stats.pendingCount}</p>
          </div>
        </div>

        {/* Daily Close */}
        {period === 'today' && (
          <div className="bg-surface border border-rose-500/30 rounded-[32px] p-8 mb-10">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-rose-500/10 rounded-2xl"><AlertTriangle className="text-rose-400" size={24} /></div>
                <div>
                  <h2 className="text-lg font-black italic uppercase tracking-tighter text-white">Chiusura Giornaliera</h2>
                  <p className="text-xs text-gray-500 font-bold mt-1">
                    {stats.totalOrders} ordini &middot; €{stats.totalRevenue.toFixed(2)} incasso &middot; {stats.pendingCount} in attesa
                  </p>
                </div>
              </div>
              <button
                onClick={async () => {
                  const doBackup = await confirm({ title: 'Backup consigliato', message: 'Prima di chiudere la giornata, esegui un backup del database.\n\nAndare su Impostazioni → Backup ora?\n\nOppure procedere con la chiusura?', confirmLabel: 'Chiudi GIORNATA', cancelLabel: 'Annulla', destructive: true });
                  if (!doBackup) return;
                  const ok = await confirm({ title: 'Conferma chiusura', message: `Chiudere la giornata?\n\nOrdini completati: ${stats.totalOrders}\nIncasso totale: €${stats.totalRevenue.toFixed(2)}\n\nTutti i tavoli OCCUPATO verranno liberati.`, destructive: true });
                  if (!ok) return;
                  if (!supabase) { addToast({ type: 'warning', title: 'Modalità demo', message: 'Nessuna azione eseguita' }); return; }
                  await supabase.from('ordini').update({ status: 'COMPLETATO' }).eq('status', 'IN_ATTESA');
                  const { error } = await supabase.from('tavoli').update({ status: 'LIBERO' }).eq('status', 'OCCUPATO');
                  if (error) { addToast({ type: 'error', title: 'Errore', message: error.message }); return; }
                  addToast({ type: 'success', title: 'Giornata chiusa!', message: `€${stats.totalRevenue.toFixed(2)} incasso · ${stats.totalOrders} ordini · Tavoli liberati.` });
                  void fetchOrders();
                }}
                className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 font-black text-xs px-6 py-3 rounded-2xl transition-all active:scale-95 flex items-center gap-2 shrink-0"
              >
                <LogOut size={16} /> CHIUDI GIORNATA
              </button>
            </div>
          </div>
        )}

        {/* Week over Week */}
        {weekComparison && (weekComparison.thisWeek.count > 0 || weekComparison.lastWeek.count > 0) && (
          <div className="bg-surface border border-surface-light rounded-[40px] p-8 mb-10">
            <h2 className="text-lg font-black italic uppercase tracking-tighter text-white mb-6 flex items-center gap-3">
              <TrendingUp className="text-gold" size={20} /> Settimana su Settimana
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {(() => {
                const { thisWeek, lastWeek } = weekComparison;
                const revenueDelta = lastWeek.revenue > 0 ? ((thisWeek.revenue - lastWeek.revenue) / lastWeek.revenue) * 100 : null;
                const countDelta = lastWeek.count > 0 ? ((thisWeek.count - lastWeek.count) / lastWeek.count) * 100 : null;
                const deltaBadge = (delta: number | null) => {
                  if (delta === null) return null;
                  const up = delta > 0.5;
                  const down = delta < -0.5;
                  const color = up ? 'text-emerald-400 bg-emerald-500/10' : down ? 'text-rose-400 bg-rose-500/10' : 'text-gray-400 bg-gray-500/10';
                  const Icon = up ? ArrowUpRight : down ? ArrowDownRight : Minus;
                  return (
                    <span className={`inline-flex items-center gap-1 text-xs font-black px-2.5 py-1 rounded-full ${color}`}>
                      <Icon size={14} /> {Math.abs(delta).toFixed(0)}%
                    </span>
                  );
                };
                return (
                  <>
                    <div className="bg-charcoal/50 rounded-2xl p-6 border border-surface-light">
                      <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Incasso (ultimi 7gg vs 7 precedenti)</p>
                      <div className="flex items-center gap-3">
                        <p className="text-2xl font-black text-white">€{thisWeek.revenue.toFixed(2)}</p>
                        {deltaBadge(revenueDelta)}
                      </div>
                      <p className="text-xs text-gray-600 mt-1">vs €{lastWeek.revenue.toFixed(2)} settimana precedente</p>
                    </div>
                    <div className="bg-charcoal/50 rounded-2xl p-6 border border-surface-light">
                      <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Ordini (ultimi 7gg vs 7 precedenti)</p>
                      <div className="flex items-center gap-3">
                        <p className="text-2xl font-black text-white">{thisWeek.count}</p>
                        {deltaBadge(countDelta)}
                      </div>
                      <p className="text-xs text-gray-600 mt-1">vs {lastWeek.count} settimana precedente</p>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {/* Hourly Breakdown */}
        {stats.hourlyStats.length > 0 && (
          <div className="bg-surface border border-surface-light rounded-[40px] p-8 mb-10">
            <h2 className="text-lg font-black italic uppercase tracking-tighter text-white mb-6 flex items-center gap-3">
              <Clock className="text-gold" size={20} /> Vendite per Fascia Oraria — {periodLabel}
            </h2>
            <div className="space-y-2">
              {stats.hourlyStats.map(h => {
                const maxRevenue = Math.max(...stats.hourlyStats.map(x => x.revenue), 1);
                const pct = (h.revenue / maxRevenue) * 100;
                return (
                  <div key={h.hour} className="flex items-center gap-4">
                    <span className="w-14 text-xs font-black text-gray-500 shrink-0">{String(h.hour).padStart(2, '0')}:00</span>
                    <div className="flex-1 h-6 bg-charcoal rounded-lg overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-gold to-gold/60 rounded-lg transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-24 text-right text-xs font-black text-gold shrink-0">€{h.revenue.toFixed(2)}</span>
                    <span className="w-16 text-right text-[10px] text-gray-500 font-bold shrink-0">{h.count} ord.</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
          {/* Top Products */}
          <div className="bg-surface border border-surface-light rounded-[40px] p-8">
            <h2 className="text-lg font-black italic uppercase tracking-tighter text-white mb-6 flex items-center gap-3">
              <Award className="text-gold" size={20} /> Più Ordinati
            </h2>
            {stats.topProducts.length === 0 ? (
              <p className="text-gray-500 italic">Nessun dato disponibile</p>
            ) : (
              <div className="space-y-3">
                {stats.topProducts.map((p, i) => (
                  <div key={p.name} className="flex items-center justify-between bg-charcoal/50 rounded-2xl p-4 border border-surface-light">
                    <div className="flex items-center gap-4">
                      <span className="w-8 h-8 rounded-xl bg-gold/10 text-gold flex items-center justify-center font-black text-sm">{i + 1}</span>
                      <div>
                        <p className="font-bold text-white">{p.name}</p>
                        <p className="text-[10px] text-gray-500 font-black">x{p.count} ordinati</p>
                      </div>
                    </div>
                    <span className="font-black text-gold">€{p.revenue.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Revenue by Category */}
          <div className="bg-surface border border-surface-light rounded-[40px] p-8">
            <h2 className="text-lg font-black italic uppercase tracking-tighter text-white mb-6 flex items-center gap-3">
              <Package className="text-gold" size={20} /> Ricavi per Categoria
            </h2>
            {stats.categoryStats.length === 0 ? (
              <p className="text-gray-500 italic">Nessun dato disponibile</p>
            ) : (
              <div className="space-y-3">
                {stats.categoryStats.map(cat => {
                  const maxRevenue = stats.categoryStats[0]?.revenue || 1;
                  const pct = (cat.revenue / maxRevenue) * 100;
                  return (
                    <div key={cat.name} className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-bold text-white">{cat.name}</span>
                        <span className="text-sm font-black text-gold">€{cat.revenue.toFixed(2)}</span>
                      </div>
                      <div className="h-2 bg-charcoal rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-gold to-gold/60 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-[10px] text-gray-600 font-black">{cat.count} articoli</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Recent Orders */}
        <div className="bg-surface border border-surface-light rounded-[40px] p-8 mb-10">
          <h2 className="text-lg font-black italic uppercase tracking-tighter text-white mb-6 flex items-center gap-3">
            <Clock className="text-gold" size={20} /> Ordini Recenti
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] font-black text-gray-500 uppercase tracking-widest border-b border-surface-light">
                  <th className="pb-4 pr-4">Cliente</th>
                  <th className="pb-4 pr-4">Orario</th>
                  <th className="pb-4 pr-4">Articoli</th>
                  <th className="pb-4 pr-4">Totale</th>
                  <th className="pb-4">Stato</th>
                </tr>
              </thead>
              <tbody>
                {orders.slice(0, 20).map(order => (
                  <tr key={order.id} className="border-b border-surface-light/50 text-sm">
                    <td className="py-4 pr-4 font-bold text-white">{order.nome_cliente}</td>
                    <td className="py-4 pr-4 text-gray-400">{new Date(order.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="py-4 pr-4 text-gray-400">{order.carrello?.reduce((s: number, i: OrderCarrelloItem) => s + i.quantity, 0) || 0}</td>
                    <td className="py-4 pr-4 font-black text-gold">€{order.totale.toFixed(2)}</td>
                    <td className="py-4">
                      <span className={`text-[10px] font-black uppercase px-3 py-1.5 rounded-lg ${order.status === 'COMPLETATO' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                        {order.status === 'COMPLETATO' ? 'Completato' : 'In Attesa'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {!IS_DEMO_MODE && (
          <Link
            to="/fatture"
            className="flex items-center justify-between bg-surface border border-surface-light hover:border-gold/30 rounded-[40px] p-8 mb-10 transition-all group"
          >
            <div className="flex items-center gap-3">
              <FileText className="text-gold" size={20} />
              <div>
                <h2 className="text-lg font-black italic uppercase tracking-tighter text-white">Fatture &amp; Documenti Fiscali</h2>
                <p className="text-xs text-gray-500 mt-1">Emetti e gestisci le fatture da qui</p>
              </div>
            </div>
            <span className="text-xs font-black text-gray-500 group-hover:text-gold uppercase tracking-widest transition-all">Apri →</span>
          </Link>
        )}

        {view === 'turni' && (() => {
          const staffUsers = getStaffUsers();
          const [ty, tm] = turniMonth.split('-').map(Number);
          const monthLabel = new Date(ty, tm - 1, 1).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
          const daysInMonth = new Date(ty, tm, 0).getDate();
          const shiftMonth = (delta: number) => {
            const d = new Date(ty, tm - 1 + delta, 1);
            setTurniMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
          };

          const summary = staffUsers.map(u => {
            const userTurni = turniData.filter(t => t.user_id === u.id);
            const pranzi = userTurni.filter(t => t.turno === 'pranzo').length;
            const sere = userTurni.filter(t => t.turno === 'sera').length;
            const giorni = new Set(userTurni.map(t => t.data)).size;
            return { ...u, pranzi, sere, giorni };
          });

          return (
            <div className="bg-surface border border-surface-light rounded-[40px] p-8 mb-10">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-lg font-black italic uppercase tracking-tighter text-white flex items-center gap-3">
                  <Users className="text-gold" size={20} /> Turni Mensili
                </h2>
                <div className="flex items-center gap-2 bg-charcoal border border-surface-light rounded-2xl px-2 py-1">
                  <button onClick={() => shiftMonth(-1)} className="p-1.5 rounded-xl text-gray-500 hover:text-white transition-all"><ChevronLeft size={16} /></button>
                  <span className="text-sm font-black text-white capitalize px-2">{monthLabel}</span>
                  <button onClick={() => shiftMonth(1)} className="p-1.5 rounded-xl text-gray-500 hover:text-white transition-all"><ChevronRight size={16} /></button>
                </div>
              </div>

              {staffUsers.length === 0 ? (
                <p className="text-xs text-gray-500 font-bold text-center py-8">Nessun operatore configurato in Impostazioni → Personale.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-[10px] font-black text-gray-500 uppercase tracking-widest border-b border-surface-light">
                        <th className="pb-4 pr-6">Operatore</th>
                        <th className="pb-4 pr-6 text-center">Giorni</th>
                        <th className="pb-4 pr-6 text-center">Pranzi</th>
                        <th className="pb-4 pr-6 text-center">Sere</th>
                        <th className="pb-4 text-center">Totale Turni</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-light">
                      {summary.map(u => (
                        <tr key={u.id}>
                          <td className="py-4 pr-6">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 bg-gold/10 rounded-xl flex items-center justify-center text-gold font-black text-xs shrink-0">{u.name.charAt(0).toUpperCase()}</div>
                              <div>
                                <p className="font-bold text-white text-sm">{u.name}</p>
                                <p className="text-[10px] text-gray-500 uppercase tracking-widest">{u.role}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 pr-6 text-center">
                            <span className={`text-2xl font-black ${u.giorni > 0 ? 'text-white' : 'text-gray-600'}`}>{u.giorni}</span>
                            <p className="text-[10px] text-gray-600">/ {daysInMonth}</p>
                          </td>
                          <td className="py-4 pr-6 text-center">
                            <span className={`text-xl font-black ${u.pranzi > 0 ? 'text-gold' : 'text-gray-600'}`}>{u.pranzi}</span>
                          </td>
                          <td className="py-4 pr-6 text-center">
                            <span className={`text-xl font-black ${u.sere > 0 ? 'text-blue-400' : 'text-gray-600'}`}>{u.sere}</span>
                          </td>
                          <td className="py-4 text-center">
                            <span className={`px-3 py-1.5 rounded-xl text-sm font-black ${u.pranzi + u.sere > 0 ? 'bg-gold/10 text-gold' : 'text-gray-600'}`}>{u.pranzi + u.sere}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })()}

        <footer className="text-center py-8">
          <p className="text-[10px] font-bold text-gray-600 uppercase tracking-[0.5em]">Il Girasole · Reports</p>
        </footer>
      </div>
    </div>
  );
}
