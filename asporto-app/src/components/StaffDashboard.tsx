import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Tavolo, Reservation } from '../types/entities';
import { 
  Sun, Map as MapIcon, ChefHat, Calculator, CalendarDays,
  BellRing, Utensils, Tags, FilePlus, Zap, History, PauseCircle,
  Settings, ChevronRight, ArrowRight, UserPlus, Table2, X
} from 'lucide-react';
import { requireManagerPin } from '../lib/staffAuth';
import { dbUtils } from '../lib/DatabaseUtils';
import { useConfirm } from '../components/ConfirmModal';
import { useToast } from '../components/Toast';
import PrinterStatusBadge from '../components/PrinterStatusBadge';
import { PRINT_AGENT_URL, PRINTER_IP, PRINTER_PORT } from '../lib/printConfig';

export default function StaffDashboard() {
  const navigate = useNavigate();
  const { confirm } = useConfirm();
  const { addToast } = useToast();
  const [tables, setTables] = useState<Tavolo[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Settings State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const [newOrderName, setNewOrderName] = useState('');
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionTestMessage, setConnectionTestMessage] = useState<string | null>(null);
  const [printDeltaQty, setPrintDeltaQty] = useState(() => localStorage.getItem('risto_print_delta_qty') === 'true');

  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    setConnectionTestMessage(null);
    try {
      const normalizedAgentUrl = PRINT_AGENT_URL.trim().replace(/\/+$/, '');
      if (!normalizedAgentUrl) throw new Error('Print Agent URL mancante');

      const healthResponse = await fetch(`${normalizedAgentUrl}/health`, { method: 'GET' });
      if (!healthResponse.ok) {
        throw new Error(`Print Agent non raggiungibile (${healthResponse.status})`);
      }

      const payload = {
        kind: 'kitchen',
        tableName: 'TEST STAMPA',
        orderTime: new Date().toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
        printerIp: PRINTER_IP,
        printerPort: PRINTER_PORT,
        items: [
          {
            nome: 'TEST STAMPA',
            quantity: 1,
            prezzo: 0,
            categoria: 'Generale',
            disponibile: true,
            ingredienti: [],
            addedIngredients: [],
            removedIngredients: [],
            notes: '',
            uniqueId: 'printer-test',
            portata: '1',
          },
        ],
      };

      const printResponse = await fetch(`${normalizedAgentUrl}/print`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!printResponse.ok) {
        const text = await printResponse.text().catch(() => '');
        throw new Error(text || `Errore stampa test (${printResponse.status})`);
      }

      setConnectionTestMessage('Connessione OK. Test stampato.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Connessione non riuscita';
      setConnectionTestMessage(message);
    } finally {
      setIsTestingConnection(false);
    }
  };
  const handleCleanup = async () => {
    if (!requireManagerPin('svuotare il database')) return;
    const ok = await confirm({ title: 'Pulisci database', message: 'Eliminare TUTTI gli ordini e resettare i tavoli?', destructive: true });
    if (!ok) return;
    setLoadingAction('cleanup');
    try { await dbUtils.cleanupDatabase(); addToast({ type: 'success', title: 'Database pulito!' }); } catch { addToast({ type: 'error', title: 'Errore pulizia' }); }
    finally { setLoadingAction(null); }
  };

  const handlePopulate = async () => {
    if (!requireManagerPin('ripristinare i dati demo')) return;
    setLoadingAction('populate');
    try { await dbUtils.populateDemoData(); addToast({ type: 'success', title: 'Dati demo ripristinati!' }); }
    catch { addToast({ type: 'error', title: 'Errore salvataggio' }); }
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
           <PrinterStatusBadge />
           <button 
             onClick={() => setIsSettingsOpen(true)}
             className="text-white hover:text-gold transition-colors cursor-pointer"
             title="Impostazioni"
           >
             <Settings size={28} strokeWidth={1.5} />
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
             <KitchenItem icon={<BellRing size={20} />} title="Disponibilità Menu" desc="Attiva/disattiva piatti" onClick={() => navigate('/kitchen?tab=menu')} />
             <KitchenItem icon={<Utensils size={20} />} title="Gestisci Piatti" desc="Aggiungi, modifica o rimuovi piatti" onClick={() => navigate('/kitchen?tab=menu')} />
             <KitchenItem icon={<Tags size={20} />} title="Modificatori" desc="Gestisci modifiche e opzioni" onClick={() => navigate('/kitchen?tab=variants')} />
          </div>

          <div className="pt-6 shrink-0">
             <button onClick={() => navigate('/kitchen?tab=menu')} className="w-full bg-gold text-black font-semibold py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-gold-hover transition active:scale-[0.98] cursor-pointer">
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
              <PosBox icon={<FilePlus size={24} />} title="Nuovo Conto" desc="Apri un nuovo conto" onClick={() => { setShowNewOrderModal(true); setNewOrderName(''); }} />
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
                    <h4 className="text-[13px] font-bold text-white mb-1">{r.ora?.split(':').slice(0, 2).join(':')}</h4>
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
              <button onClick={() => navigate('/reservations')} className="w-full bg-gold text-black font-semibold py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-gold-hover transition active:scale-[0.98] cursor-pointer">
                 Apri Prenotazioni <ArrowRight size={18} />
              </button>
          </div>
        </div>

      </div>

      {/* New Order Modal */}
      {showNewOrderModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="bg-surface border border-surface-light w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden p-8 relative animate-in zoom-in-95 duration-200">
            <button onClick={() => setShowNewOrderModal(false)} className="absolute top-6 right-6 text-gray-500 hover:text-white transition cursor-pointer">
              <X size={20} />
            </button>
            <h2 className="text-2xl font-black text-white mb-6">Nuovo Conto</h2>
            <div className="space-y-3">
              <button
                onClick={() => { setShowNewOrderModal(false); navigate('/map'); }}
                className="w-full flex items-center gap-4 p-5 bg-charcoal border border-surface-light rounded-2xl hover:border-gold/40 transition-all group text-left"
              >
                <div className="w-12 h-12 rounded-2xl bg-gold/10 flex items-center justify-center shrink-0 group-hover:bg-gold/20 transition-all">
                  <Table2 size={24} className="text-gold" />
                </div>
                <div>
                  <p className="font-bold text-white group-hover:text-gold transition-colors">Apri su Tavolo</p>
                  <p className="text-xs text-gray-500 mt-0.5">Seleziona un tavolo dalla mappa</p>
                </div>
              </button>
              <div className="flex items-center gap-3 py-1">
                <div className="flex-1 h-px bg-surface-light" />
                <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">oppure</span>
                <div className="flex-1 h-px bg-surface-light" />
              </div>
              <div>
                <button
                  onClick={() => { if (newOrderName.trim()) { setShowNewOrderModal(false); navigate(`/pos?tableName=${encodeURIComponent(newOrderName.trim())}`); } }}
                  className="w-full flex items-center gap-4 p-5 bg-charcoal border border-surface-light rounded-2xl hover:border-gold/40 transition-all group text-left mb-3"
                >
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center shrink-0 group-hover:bg-emerald-500/20 transition-all">
                    <UserPlus size={24} className="text-emerald-400" />
                  </div>
                  <div>
                    <p className="font-bold text-white group-hover:text-emerald-400 transition-colors">Apri con Nome</p>
                    <p className="text-xs text-gray-500 mt-0.5">Per eventi, feste o conti sospesi</p>
                  </div>
                </button>
                <input
                  type="text"
                  value={newOrderName}
                  onChange={e => setNewOrderName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && newOrderName.trim()) { setShowNewOrderModal(false); navigate(`/pos?tableName=${encodeURIComponent(newOrderName.trim())}`); } }}
                  placeholder="Inserisci nome cliente o evento..."
                  className="w-full bg-charcoal border border-surface-light rounded-xl py-3 px-4 text-white text-sm font-bold outline-none focus:border-gold transition-all placeholder:text-gray-600"
                  autoFocus
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="bg-surface border border-surface-light w-full max-w-4xl rounded-[40px] shadow-2xl overflow-hidden relative animate-in zoom-in-95 duration-200">
             <button onClick={() => setIsSettingsOpen(false)} className="absolute top-6 right-6 z-10 w-10 h-10 flex items-center justify-center bg-charcoal rounded-xl text-gray-500 hover:text-white border border-surface-light transition cursor-pointer">
               <X size={20} />
             </button>
             <div className="p-6 md:p-8">
               <h2 className="text-2xl font-bold text-white mb-6">Impostazioni & Azioni</h2>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="space-y-4">
                    <div className="border border-surface-light rounded-2xl p-4 bg-charcoal/40 space-y-3">
                      <div>
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.25em]">Stampa LAN</p>
                        <h3 className="text-lg font-black text-white mt-1">Test connessione</h3>
                      </div>
                      <p className="text-xs text-gray-300 leading-relaxed">
                        Configura Print Agent nel file <strong className="text-white">.env</strong> (<strong className="text-white">VITE_PRINT_AGENT_URL</strong>, <strong className="text-white">VITE_PRINTER_IP</strong>, <strong className="text-white">VITE_PRINTER_PORT</strong>).
                      </p>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={handleTestConnection}
                          disabled={isTestingConnection}
                          className="flex-1 bg-gold hover:bg-gold-hover text-black p-3 rounded-xl font-bold text-xs transition cursor-pointer disabled:opacity-60"
                        >
                          {isTestingConnection ? 'Test in corso...' : 'Test connessione'}
                        </button>
                        <div className="flex-1 min-h-[48px] rounded-xl border border-surface-light px-3 py-2 text-xs font-bold flex items-center text-white">
                          {connectionTestMessage || 'Stato stampante'}
                        </div>
                      </div>
                    </div>

                    <div className="border border-surface-light rounded-2xl p-4 bg-charcoal/40 space-y-3">
                      <div>
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.25em]">Aggiornamento comande</p>
                        <h3 className="text-lg font-black text-white mt-1">Ristampa quantità</h3>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-gray-300 leading-relaxed">
                          Quando si cambia la quantità di un piatto già in comanda, stampa l'aggiunta in cucina
                        </p>
                        <button
                          onClick={() => {
                            const next = !printDeltaQty;
                            setPrintDeltaQty(next);
                            localStorage.setItem('risto_print_delta_qty', String(next));
                          }}
                          className={`relative w-14 h-8 rounded-full transition-all shrink-0 ml-4 ${printDeltaQty ? 'bg-gold' : 'bg-surface-light/40'}`}
                        >
                          <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-all ${printDeltaQty ? 'left-7' : 'left-1'}`} />
                        </button>
                      </div>
                    </div>
                 </div>

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
                 </div>
               </div>
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
