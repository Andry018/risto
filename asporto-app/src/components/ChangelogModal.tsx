import { useState } from 'react';
import { X, CheckCircle, Zap, Bug, TrendingUp, MessageSquare, Bell } from 'lucide-react';
import { useConfirm } from './ConfirmModal';

type ChangeType = 'feature' | 'fix' | 'improvement' | 'breaking';

interface ChangeEntry {
  version: string;
  date: string;
  type: ChangeType;
  title: string;
  description: string;
  details?: string[];
}

const CHANGELOG: ChangeEntry[] = [
  {
    version: '2.1.0',
    date: '2026-09-16',
    type: 'feature',
    title: 'Stampa differenziale (Delta) & Ristampa completa',
    description: 'Aggiorna e Stampa ora funzionano in modo intelligente su Waiter e POS',
    details: [
      'AGGIORNA / Salva Comanda: salva e stampa SOLO le novità (es. Antipasto da 1→2 stampa solo +1)',
      'STAMPA: ristampa SEMPRE tutto l\'ordine da capo (cucina + sala)',
      'Rimosso timeout automatico su "Aggiorna" (Waiter) - il badge "INVIATO!" resta visibile',
      'Logica delta: confronta quantità attuale vs ultima salvata per ogni piatto (nome + portata + modifiche + note)',
      'Opzione "Stampa solo delta quantità" in localStorage (risto_print_delta_qty)',
    ],
  },
  {
    version: '2.0.5',
    date: '2026-09-10',
    type: 'improvement',
    title: 'Migliorie UI/UX generali',
    description: 'Ottimizzazioni interfaccia e gestione stati',
    details: [
      'Pulsanti azione sticky in basso su WaiterMobileView',
      'Gestione allergeni per tavolo persistente',
      'Trasferimento tavolo con ordini, bozza e orario apertura',
    ],
  },
  {
    version: '2.0.0',
    date: '2026-09-01',
    type: 'feature',
    title: 'Ristrutturazione completa app',
    description: 'Nuova architettura modulare e componenti moderni',
    details: [
      'Migrazione a React 19 + Vite 5 + Tailwind 4',
      'Offline-first con IndexedDB e sync automatica',
      'Print Agent LAN per stampanti termiche ESC/POS',
      'Cassa fiscale Custom Big Plus RT integrata',
      'HACCP con etichette e tracciabilità lotti',
    ],
  },
];

const typeConfig: Record<ChangeType, { icon: typeof Zap; color: string; bg: string; label: string }> = {
  feature:    { icon: Zap,        color: 'text-sky-400',     bg: 'bg-sky-500/10',     label: 'Novità' },
  fix:        { icon: Bug,        color: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'Fix' },
  improvement:{ icon: TrendingUp, color: 'text-amber-400',   bg: 'bg-amber-500/10',   label: 'Miglioria' },
  breaking:   { icon: MessageSquare, color: 'text-red-400',  bg: 'bg-red-500/10',     label: 'Breaking' },
};

export default function ChangelogModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { confirm } = useConfirm();
  const [expandedVersion, setExpandedVersion] = useState<string | null>(null);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl animate-in fade-in duration-200">
      <div className="bg-surface border border-surface-light w-full max-w-2xl max-h-[85vh] rounded-[32px] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 border-b border-surface-light bg-surface-light/5 flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-black italic uppercase text-white tracking-tighter flex items-center gap-2">
              <Bell size={28} className="text-gold" />
              Changelog
            </h2>
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mt-1">
              Storico modifiche e nuove funzionalità
            </p>
          </div>
          <button onClick={onClose} className="p-2 bg-charcoal rounded-xl text-gray-400 hover:text-white border border-surface-light active:scale-90 transition">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {CHANGELOG.map((entry) => {
            const config = typeConfig[entry.type];
            const Icon = config.icon;
            const isExpanded = expandedVersion === entry.version;
            
            return (
              <div key={entry.version} className="border border-surface-light rounded-2xl overflow-hidden group">
                <button
                  onClick={() => setExpandedVersion(isExpanded ? null : entry.version)}
                  className="w-full p-5 flex items-start gap-4 text-left transition-colors hover:bg-charcoal/50"
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${config.bg} ${config.color}`}>
                    <Icon size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-3 mb-1">
                      <span className="text-xl font-black text-white">{entry.version}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${config.bg} ${config.color} border border-current/30`}>
                        {config.label}
                      </span>
                      <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{entry.date}</span>
                    </div>
                    <p className="font-bold text-white text-base pr-8">{entry.title}</p>
                    <p className="text-[11px] text-gray-400 mt-1">{entry.description}</p>
                  </div>
                  <div className="text-gold">
                    {isExpanded ? <CheckCircle size={20} /> : <Zap size={20} className="rotate-45" />}
                  </div>
                </button>
                
                {isExpanded && entry.details && (
                  <div className="border-t border-surface-light bg-charcoal/50 p-5 animate-in slide-in-from-top-2 duration-200">
                    <ul className="space-y-2">
                      {entry.details.map((detail, dIdx) => (
                        <li key={dIdx} className="flex items-start gap-3 text-[11px] text-gray-300 leading-relaxed">
                          <span className="text-gold shrink-0 mt-0.5">→</span>
                          <span>{detail}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}

          {/* Version info */}
          <div className="pt-4 border-t border-surface-light text-center">
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Versione corrente</p>
            <p className="text-lg font-black text-gold italic">2.1.0</p>
            <p className="text-[10px] text-gray-600 mt-2">
              Build: {new Date().toLocaleDateString('it-IT')}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-surface-light bg-surface-light/5 flex justify-end gap-3">
          <button
            onClick={async () => {
              const ok = await confirm({
                title: 'Pulisci changelog locale?',
                message: 'Questo rimuoverà il flag "nuova versione" e nasconderà il badge di notifica.',
                confirmLabel: 'Sì, pulisci',
                cancelLabel: 'Annulla',
              });
              if (ok) {
                localStorage.removeItem('risto_changelog_seen');
                onClose();
              }
            }}
            className="px-4 py-2 bg-charcoal border border-surface-light text-gray-400 font-black text-[10px] uppercase tracking-widest rounded-xl hover:text-white hover:border-white/20 transition active:scale-95"
          >
            Segna come lette
          </button>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gold text-black font-black text-sm rounded-xl shadow-lg shadow-gold/20 hover:bg-gold-hover active:scale-95 transition"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}