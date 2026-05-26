import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Tavolo, Reservation } from '../types/entities';
import { 
  Sun, Menu, Map as MapIcon, ChefHat, Calculator, CalendarDays,
  BellRing, Utensils, Tags, FilePlus, Zap, History, PauseCircle,
  Settings, ChevronRight, ArrowRight
} from 'lucide-react';
import { staffLogout } from '../lib/staffAuth';
import { dbUtils } from '../lib/DatabaseUtils';

export default function StaffDashboard() {
  const navigate = useNavigate();
  const [tables, setTables] = useState<Tavolo[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Settings State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  

  const handleCleanup = async () => {
    if (!confirm('Sei sicuro? Questo eliminerà TUTTI gli ordini e resetterà i tavoli.')) return;
    setLoadingAction('cleanup');
    try { await dbUtils.cleanupDatabase(); alert('Database pulito!'); } catch { alert('Errore pulizia'); }
    finally { setLoadingAction(null); }
  };

  const handlePopulate = async () => {
    setLoadingAction('populate');
    try { await dbUtils.populateDemoData(); alert('Dati demo ripristinati!'); }
    catch { alert('Errore salvataggio'); }
    finally { setLoadingAction(null); }
  };

  useEffect(() => {
    async function fetchData() {
      if (!supabase) return;
      const today = new Date().toISOString().split('T')[0];

      const [tablesRes, reservationsRes] = await Promise.all([
        supabase.from('tavoli').select('*').order('nome'),
        supabase.from('prenotazioni').select('*').eq('data', today).order('ora')
      ]);

      if (tablesRes.data) setTables(tablesRes.data);
      if (reservationsRes.data) setReservations(reservationsRes.data);
      setLoading(false);
    }
    
    fetchData();

    const sb = supabase;
    if (!sb) return;

    const channel = sb.channel('dashboard-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tavoli' }, () => void fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prenotazioni' }, () => void fetchData())
      .subscribe();

    return () => {
      sb.removeChannel(channel);
    };
  }, []);

  const occupiedCount = tables.filter(t => t.status === 'OCCUPATO').length;
  const availableCount = tables.filter(t => t.status === 'LIBERO').length;
  const reservedCount = tables.filter(t => t.status === 'PRENOTATO').length;

  const currentDate = new Date().toLocaleDateString('it-IT', { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <div className="h-[100dvh] bg-charcoal text-white flex flex-col font-sans overflow-hidden">
      {/* Header */}
      <div className="flex justify-between items-center py-6 px-8 shrink-0">
        <div className="flex items-center gap-3">
          <div className="text-gold">
             <Sun size={38} strokeWidth={1.5} />
          </div>
          <div>
             <h1 className="text-[28px] font-serif tracking-widest text-[#f5f5f5] leading-tight">IL GIRASOLE</h1>
             <p className="text-[10px] tracking-[0.2em] text-gold uppercase font-semibold">Ristorante Italiano</p>
          </div>
        </div>
        <div className="flex items-center gap-5">
          <button 
             onClick={() => setIsSettingsOpen(true)}
             className="text-white hover:text-gold transition-colors cursor-pointer"
             title="Impostazioni"
          >
             <Settings size={28} strokeWidth={1.5} />
          </button>
          <button className="text-white hover:text-gold transition-colors cursor-pointer">
             <Menu size={32} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-4 gap-5 px-8 flex-1 min-h-0 mb-6">
        
        {/* MAPS */}
        <div className="bg-surface border border-surface-light rounded-[24px] flex flex-col p-6 relative">
          <div className="flex justify-between items-start mb-6">
             <div>
                <h2 className="text-2xl font-bold text-white mb-1">MAPPA</h2>
                <p className="text-[11px] text-gold">Visualizza & gestisci tavoli</p>
             </div>
             <div className="text-gold">
                <MapIcon size={32} strokeWidth={1.5} />
             </div>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col items-center">
            {/* Visual Map Representation */}
            <div className="w-full aspect-square border border-surface-light rounded-xl p-4 flex items-center justify-center relative mb-6">
               <div className="grid grid-cols-3 gap-4 w-full h-full relative">
                 {tables.slice(0, 9).map(t => (
                   <div key={t.id} className={`rounded-xl border flex items-center justify-center text-sm font-bold ${
                      t.status === 'OCCUPATO' ? 'border-gold bg-gold/10 text-gold' :
                      t.status === 'LIBERO' ? 'border-[#4ade80] bg-[#4ade80]/10 text-[#4ade80]' :
                      'border-[#888] bg-[#888]/10 text-[#888]'
                   }`}>
                     {t.nome}
                   </div>
                 ))}
               </div>
            </div>

            <div className="flex justify-between w-full px-2 text-center mt-auto">
               <div className="flex-1">
                 <p className="text-2xl font-bold text-gold">{occupiedCount}</p>
                 <p className="text-[10px] text-[#888] mt-1">Occupati</p>
               </div>
               <div className="flex-1">
                 <p className="text-2xl font-bold text-[#4ade80]">{availableCount}</p>
                 <p className="text-[10px] text-[#888] mt-1">Liberi</p>
               </div>
               <div className="flex-1">
                 <p className="text-2xl font-bold text-[#888]">{reservedCount}</p>
                 <p className="text-[10px] text-[#888] mt-1">Prenotati</p>
               </div>
            </div>
          </div>

          <div className="pt-6 shrink-0">
             <button onClick={() => navigate('/map')} className="w-full bg-gold text-black font-semibold py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-gold-hover transition active:scale-[0.98] cursor-pointer">
                Apri Mappa <ArrowRight size={18} />
             </button>
          </div>
        </div>

        {/* KITCHEN */}
        <div className="bg-surface border border-surface-light rounded-[24px] flex flex-col p-6 relative">
          <div className="flex justify-between items-start mb-6 shrink-0">
             <div>
                <h2 className="text-2xl font-bold text-white mb-1">CUCINA</h2>
                <p className="text-[11px] text-gold">Gestione menu e piatti</p>
             </div>
             <div className="text-gold">
                <ChefHat size={32} strokeWidth={1.5} />
             </div>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3">
             <KitchenItem icon={<BellRing size={20} />} title="Disponibilità Menu" desc="Attiva/disattiva piatti" onClick={() => navigate('/kitchen')} />
             <KitchenItem icon={<Utensils size={20} />} title="Gestisci Piatti" desc="Aggiungi, modifica o rimuovi piatti" onClick={() => navigate('/kitchen')} />
             <KitchenItem icon={<Tags size={20} />} title="Modificatori" desc="Gestisci modifiche e opzioni" onClick={() => navigate('/kitchen')} />
          </div>

          <div className="pt-6 shrink-0">
             <button onClick={() => navigate('/kitchen')} className="w-full bg-gold text-black font-semibold py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-gold-hover transition active:scale-[0.98] cursor-pointer">
                Apri Cucina <ArrowRight size={18} />
             </button>
          </div>
        </div>

        {/* POS */}
        <div className="bg-surface border border-surface-light rounded-[24px] flex flex-col p-6 relative">
          <div className="flex justify-between items-start mb-6 shrink-0">
             <div>
                <h2 className="text-2xl font-bold text-white mb-1">POS</h2>
                <p className="text-[11px] text-gold">Crea conto (senza tavolo)</p>
             </div>
             <div className="text-gold">
                <Calculator size={32} strokeWidth={1.5} />
             </div>
          </div>
          
          <div className="flex-1 grid grid-cols-2 gap-3 min-h-0">
             <PosBox icon={<FilePlus size={24} />} title="Nuovo Conto" desc="Apri un nuovo conto" onClick={() => navigate('/pos')} />
             <PosBox icon={<Zap size={24} />} title="Vendita Rapida" desc="Piatti veloci, asporto" onClick={() => navigate('/pos')} />
             <PosBox icon={<History size={24} />} title="Conti Recenti" desc="Visualizza transazioni" onClick={() => navigate('/pos')} />
             <PosBox icon={<PauseCircle size={24} />} title="Conti in Sospeso" desc="Visualizza o riprendi" onClick={() => navigate('/pos?showHold=true')} />
          </div>

          <div className="pt-6 shrink-0">
             <button onClick={() => navigate('/pos')} className="w-full bg-gold text-black font-semibold py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-gold-hover transition active:scale-[0.98] cursor-pointer">
                Apri POS <ArrowRight size={18} />
             </button>
          </div>
        </div>

        {/* RESERVATIONS */}
        <div className="bg-surface border border-surface-light rounded-[24px] flex flex-col p-6 relative">
          <div className="flex justify-between items-start mb-6 shrink-0">
             <div>
                <h2 className="text-2xl font-bold text-white mb-1">PRENOTAZIONI</h2>
                <p className="text-[11px] text-gold">Visualizza & gestisci prenotazioni</p>
             </div>
             <div className="text-gold">
                <CalendarDays size={32} strokeWidth={1.5} />
             </div>
          </div>

          <div className="flex justify-between items-center mb-4 shrink-0">
              <span className="text-[10px] font-bold tracking-widest text-[#888] uppercase">OGGI</span>
              <span className="text-[11px] text-[#888]">{currentDate}</span>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-1">
              {reservations.map(r => (
                <div key={r.id} className="flex justify-between items-center border-b border-surface-light pb-4 last:border-0 last:pb-0">
                  <div>
                    <h4 className="text-[13px] font-bold text-white mb-1">{r.ora}</h4>
                    <p className="text-[11px] text-[#888]">{r.persone} Persone</p>
                    <p className="text-[11px] text-[#888]">{r.nome}</p>
                  </div>
                  <span className={`px-2.5 py-1 rounded border text-[9px] uppercase tracking-wider font-semibold ${
                     r.status === 'CONFERMATA' ? 'border-gold text-gold' :
                     r.status === 'ARRIVATA' ? 'border-[#4ade80] text-[#4ade80]' :
                     'border-[#666] text-[#666]'
                  }`}>
                     {r.status}
                  </span>
                </div>
              ))}
              {reservations.length === 0 && !loading && (
                 <div className="h-full flex items-center justify-center text-[#888] text-[11px]">Nessuna prenotazione oggi</div>
              )}
          </div>

          <div className="pt-6 shrink-0">
             <button onClick={() => navigate('/admin')} className="w-full bg-gold text-black font-semibold py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-gold-hover transition active:scale-[0.98] cursor-pointer">
                Apri Prenotazioni <ArrowRight size={18} />
             </button>
          </div>
        </div>

      </div>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="bg-surface border border-surface-light w-full max-w-xl rounded-[40px] shadow-2xl overflow-hidden p-10 relative animate-in zoom-in-95 duration-200">
             <button onClick={() => setIsSettingsOpen(false)} className="absolute top-8 right-8 text-[#888] hover:text-white transition cursor-pointer text-xl font-bold">X</button>
             <h2 className="text-2xl font-bold text-white mb-6">Impostazioni & Azioni</h2>
             
             <div className="space-y-4">
                <button
                  onClick={() => { setIsSettingsOpen(false); navigate('/reports'); }}
                  className="w-full bg-surface-light/40 border border-gold/30 text-gold p-4 rounded-xl font-bold flex items-center justify-center gap-3 hover:bg-gold/10 transition cursor-pointer"
                >
                  Report e Statistiche
                </button>

                <button
                  onClick={handleCleanup}
                  disabled={loadingAction === 'cleanup'}
                  className="w-full bg-surface-light/40 border border-red-500/30 text-red-400 p-4 rounded-xl font-bold flex items-center justify-center gap-3 hover:bg-red-500/10 transition cursor-pointer"
                >
                  {loadingAction === 'cleanup' ? 'Pulizia...' : 'Svuota Database'}
                </button>

                <button
                  onClick={handlePopulate}
                  disabled={loadingAction === 'populate'}
                  className="w-full bg-surface-light/40 border border-emerald-500/30 text-emerald-400 p-4 rounded-xl font-bold flex items-center justify-center gap-3 hover:bg-emerald-500/10 transition cursor-pointer"
                >
                  {loadingAction === 'populate' ? 'Ripristino...' : 'Ripristina Dati Demo'}
                </button>

                <button
                  onClick={() => { if (confirm('Vuoi effettuare il log out?')) staffLogout(); }}
                  className="w-full bg-surface-light/40 border border-surface-light text-[#888] p-4 rounded-xl font-bold flex items-center justify-center gap-3 hover:bg-white/5 transition cursor-pointer"
                >
                  Esci
                </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}

function KitchenItem({ icon, title, desc, onClick }: { icon: React.ReactNode, title: string, desc: string, onClick?: () => void }) {
  return (
    <button onClick={onClick} className="w-full bg-transparent border border-surface-light rounded-2xl p-4 flex items-center gap-4 text-left group hover:border-gold/50 transition cursor-pointer">
       <div className="text-gold">{icon}</div>
       <div className="flex-1">
         <h3 className="text-[13px] font-semibold text-[#f5f5f5] group-hover:text-gold transition">{title}</h3>
         <p className="text-[11px] text-[#888]">{desc}</p>
       </div>
       <ChevronRight size={16} className="text-[#888] group-hover:text-gold" />
    </button>
  );
}

function PosBox({ icon, title, desc, onClick }: { icon: React.ReactNode, title: string, desc: string, onClick?: () => void }) {
  return (
    <button onClick={onClick} className="bg-transparent border border-surface-light rounded-2xl p-4 flex flex-col items-center justify-center gap-3 group hover:border-gold/50 transition h-full text-center cursor-pointer">
      <div className="text-gold">{icon}</div>
      <div>
        <h3 className="text-[13px] font-semibold text-[#f5f5f5] group-hover:text-gold transition">{title}</h3>
        <p className="text-[10px] text-[#888] mt-1">{desc}</p>
      </div>
    </button>
  );
}
