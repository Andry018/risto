import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getCurrentUser, getDefaultRouteForRole } from '../lib/staffAuth';
import { supabase, type Order, type OrderCarrelloItem, IS_DEMO_MODE } from '../lib/supabase';
import { MOCK_ORDERS } from '../lib/MockData';
import { LayoutDashboard, TrendingUp, ShoppingBag, DollarSign, Clock, Package, Award } from 'lucide-react';

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

export default function ReportsView() {
  const navigate = useNavigate();
  useEffect(() => {
    const user = getCurrentUser();
    if (user && user.role !== 'admin') {
      navigate(getDefaultRouteForRole(user.role), { replace: true });
    }
  }, []);
  const [orders, setOrders] = useState<Order[]>([]);
  const [period, setPeriod] = useState<Period>('today');
  const [loading, setLoading] = useState(true);

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
      startDate = now.toISOString().split('T')[0];
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

    return { totalRevenue, totalOrders, avgOrder, topProducts, categoryStats, pendingCount };
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
            <Link to="/" className="p-3 bg-surface border border-surface-light rounded-2xl text-gray-500 hover:text-white transition-all">
              <LayoutDashboard size={24} />
            </Link>
            <div>
              <h1 className="text-4xl font-black italic uppercase tracking-tighter">Report <span className="text-gold">& Analytics</span></h1>
              <p className="text-xs font-black text-gray-500 uppercase tracking-widest mt-1">{periodLabel}</p>
            </div>
          </div>
          <div className="flex gap-2 bg-surface p-1.5 rounded-2xl border border-surface-light">
            {(['today', 'week', 'month'] as Period[]).map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${period === p ? 'bg-gold text-black shadow-lg' : 'text-gray-500 hover:text-white'}`}
              >
                {p === 'today' ? 'Oggi' : p === 'week' ? 'Settimana' : 'Mese'}
              </button>
            ))}
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

        <footer className="text-center py-8">
          <p className="text-[10px] font-bold text-gray-600 uppercase tracking-[0.5em]">RistoPremium Reports</p>
        </footer>
      </div>
    </div>
  );
}
