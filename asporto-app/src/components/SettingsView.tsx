import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Palette, Printer, KeyRound,
  BarChart3, Trash2, RotateCcw, Sun, Store, UtensilsCrossed,
  Smartphone, MonitorCog, Info, Save, Check, Wifi, Database, FileText,
  Users, Plus, Edit3, X, CalendarClock, ChevronLeft, Globe, UploadCloud,
} from 'lucide-react';
import {
  requireManagerPin, setManagerPin,
  getStaffUsers, addStaffUser, updateStaffUser, removeStaffUser,
  type StaffUser, type StaffRole,
} from '../lib/staffAuth';
import { hasTurno, toggleTurno, type TurnoTipo } from '../lib/turni';
import { dbUtils } from '../lib/DatabaseUtils';
import { useConfirm } from './ConfirmModal';
import { useToast } from './Toast';
import { getPrintAgentUrl, getPrinterIp, getPrinterPort } from '../lib/printConfig';
import { setWakeLockEnabled } from '../hooks/useWakeLock';
import { THEMES, applyTheme, getThemeId } from '../lib/theme';
import { SETTINGS_KEYS, useSetting, useBooleanSetting } from '../lib/appSettings';
import { toLocalISODate } from '../lib/dateUtils';
import { publishMenu } from '../lib/publicMenuSync';

const SECTIONS = [
  { id: 'ristorante', label: 'Ristorante', icon: Store, desc: 'Nome e identità' },
  { id: 'aspetto', label: 'Aspetto', icon: Palette, desc: 'Tema e colori' },
  { id: 'stampa', label: 'Stampa', icon: Printer, desc: 'Stampanti e agent' },
  { id: 'comande', label: 'Comande', icon: UtensilsCrossed, desc: 'Ordini in cucina' },
  { id: 'schermo', label: 'Schermo', icon: Smartphone, desc: 'Display e sospensione' },
  { id: 'sicurezza', label: 'Sicurezza', icon: KeyRound, desc: 'PIN responsabile' },
  { id: 'personale', label: 'Personale', icon: CalendarClock, desc: 'Turni pranzo/sera' },
  { id: 'menu-online', label: 'Menu Online', icon: Globe, desc: 'Pubblica il menu su internet' },
  { id: 'sistema', label: 'Sistema', icon: MonitorCog, desc: 'Database e manutenzione' },
] as const;

type SectionId = typeof SECTIONS[number]['id'];

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onChange}
      disabled={disabled}
      className={`relative w-14 h-8 rounded-full transition-all shrink-0 ml-4 cursor-pointer disabled:opacity-50 ${checked ? 'bg-gold' : 'bg-surface-light/40'}`}
    >
      <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-all ${checked ? 'left-7' : 'left-1'}`} />
    </button>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text', suffix }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; suffix?: string;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.25em]">{label}</span>
      <div className="flex items-center gap-2 mt-1.5">
        <input
          type={type}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-charcoal border border-surface-light rounded-xl px-3 py-2.5 text-sm text-white font-bold placeholder:text-gray-600 focus:outline-none focus:border-gold/50 transition"
        />
        {suffix && <span className="text-xs text-gray-500 font-bold shrink-0">{suffix}</span>}
      </div>
    </label>
  );
}

const SECTION_IDS = SECTIONS.map(s => s.id);

export default function SettingsView() {
  const navigate = useNavigate();
  const { confirm } = useConfirm();
  const { addToast } = useToast();
  const [searchParams] = useSearchParams();

  const sectionFromUrl = searchParams.get('section');
  const [section, setSection] = useState<SectionId>(
    sectionFromUrl && (SECTION_IDS as string[]).includes(sectionFromUrl) ? (sectionFromUrl as SectionId) : 'ristorante'
  );

  const [restaurantName, setRestaurantName] = useSetting(SETTINGS_KEYS.restaurantName, 'IL GIRASOLE');
  const [restaurantTagline, setRestaurantTagline] = useSetting(SETTINGS_KEYS.restaurantTagline, 'Ristorante Italiano');
  const [themeId, setThemeId] = useState<string>(getThemeId());

  const [agentUrl, setAgentUrl] = useSetting(SETTINGS_KEYS.printAgentUrl, getPrintAgentUrl());
  const [printerIp, setPrinterIp] = useSetting(SETTINGS_KEYS.printerIp, getPrinterIp());
  const [printerPort, setPrinterPort] = useSetting(SETTINGS_KEYS.printerPort, String(getPrinterPort()));
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionTestMessage, setConnectionTestMessage] = useState<string | null>(null);

  const [printDeltaQty, setPrintDeltaQty] = useBooleanSetting(SETTINGS_KEYS.printDeltaQty, false);
  const [wakeLockEnabled, setWakeLockLocal] = useBooleanSetting(SETTINGS_KEYS.wakeLock, false);
  const wakeLockSupported = typeof navigator !== 'undefined' && 'wakeLock' in navigator;

  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const [turniDate, setTurniDate] = useState(() => toLocalISODate());
  const [turniTick, setTurniTick] = useState(0);
  const handleToggleTurno = (userId: string, turno: TurnoTipo) => {
    toggleTurno(userId, turniDate, turno);
    setTurniTick(t => t + 1);
  };
  const shiftTurniDate = (days: number) => {
    const [y, m, d] = turniDate.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + days);
    setTurniDate(toLocalISODate(dt));
  };

  const [publishUrl, setPublishUrl] = useSetting(SETTINGS_KEYS.publishMenuUrl, '');
  const [publishSecret, setPublishSecret] = useSetting(SETTINGS_KEYS.publishMenuSecret, '');
  const [isPublishing, setIsPublishing] = useState(false);
  const handlePublishMenu = async () => {
    setIsPublishing(true);
    const result = await publishMenu(publishUrl, publishSecret);
    setIsPublishing(false);
    addToast({ type: result.ok ? 'success' : 'error', title: result.ok ? 'Menu pubblicato' : 'Errore', message: result.message });
  };

  const [staffUsers, setStaffUsers] = useState<StaffUser[]>(() => getStaffUsers());
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserPin, setNewUserPin] = useState('');
  const [newUserRole, setNewUserRole] = useState<StaffRole>('waiter');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editUserName, setEditUserName] = useState('');
  const [editUserPin, setEditUserPin] = useState('');
  const [editUserRole, setEditUserRole] = useState<StaffRole>('waiter');

  const refreshStaffUsers = () => setStaffUsers(getStaffUsers());

  const handleAddUser = () => {
    if (!newUserName.trim()) { addToast({ type: 'error', title: 'Nome mancante', message: 'Inserisci un nome per l\'operatore' }); return; }
    if (newUserPin.trim().length < 4) { addToast({ type: 'error', title: 'PIN troppo corto', message: 'Minimo 4 cifre' }); return; }
    addStaffUser(newUserName, newUserPin, newUserRole);
    refreshStaffUsers();
    setNewUserName('');
    setNewUserPin('');
    setNewUserRole('waiter');
    setIsAddingUser(false);
    addToast({ type: 'success', title: 'Operatore aggiunto' });
  };

  const startEditUser = (user: StaffUser) => {
    setEditingUserId(user.id);
    setEditUserName(user.name);
    setEditUserPin('');
    setEditUserRole(user.role);
  };

  const handleSaveEditUser = (id: string) => {
    if (!editUserName.trim()) { addToast({ type: 'error', title: 'Nome mancante', message: 'Inserisci un nome per l\'operatore' }); return; }
    const updates: Partial<StaffUser> = { name: editUserName.trim(), role: editUserRole };
    if (editUserPin.trim()) {
      if (editUserPin.trim().length < 4) { addToast({ type: 'error', title: 'PIN troppo corto', message: 'Minimo 4 cifre' }); return; }
      updates.pin = editUserPin.trim();
    }
    updateStaffUser(id, updates);
    refreshStaffUsers();
    setEditingUserId(null);
    addToast({ type: 'success', title: 'Operatore aggiornato' });
  };

  const handleRemoveUser = async (user: StaffUser) => {
    const ok = await confirm({ title: 'Elimina operatore', message: `Eliminare "${user.name}"? Dovrà reinserire i dati per accedere di nuovo.`, destructive: true });
    if (!ok) return;
    removeStaffUser(user.id);
    refreshStaffUsers();
    addToast({ type: 'success', title: 'Operatore eliminato' });
  };

  const ROLE_LABELS: Record<StaffRole, string> = { admin: 'Amministratore / Cassa', waiter: 'Cameriere', kitchen: 'Cucina' };

  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    setConnectionTestMessage(null);
    try {
      const normalizedAgentUrl = getPrintAgentUrl().trim().replace(/\/+$/, '');
      if (!normalizedAgentUrl) throw new Error('Print Agent URL mancante');

      const healthResponse = await fetch(`${normalizedAgentUrl}/health`, { method: 'GET' });
      if (!healthResponse.ok) {
        throw new Error(`Print Agent non raggiungibile (${healthResponse.status})`);
      }

      const payload = {
        kind: 'kitchen',
        tableName: 'TEST STAMPA',
        orderTime: new Date().toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
        printerIp: getPrinterIp(),
        printerPort: getPrinterPort(),
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
    if (!(await requireManagerPin('svuotare il database'))) return;
    const ok = await confirm({ title: 'Pulisci database', message: 'Eliminare TUTTI gli ordini e resettare i tavoli?', destructive: true });
    if (!ok) return;
    setLoadingAction('cleanup');
    try { await dbUtils.cleanupDatabase(); addToast({ type: 'success', title: 'Database pulito!' }); } catch { addToast({ type: 'error', title: 'Errore pulizia' }); }
    finally { setLoadingAction(null); }
  };

  const handlePopulate = async () => {
    if (!(await requireManagerPin('ripristinare i dati demo'))) return;
    setLoadingAction('populate');
    try { await dbUtils.populateDemoData(); addToast({ type: 'success', title: 'Dati demo ripristinati!' }); }
    catch { addToast({ type: 'error', title: 'Errore salvataggio' }); }
    finally { setLoadingAction(null); }
  };

  const Card = ({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) => (
    <div className="border border-surface-light rounded-2xl p-5 md:p-6 bg-charcoal/40">
      <h3 className="text-base font-black text-white">{title}</h3>
      {subtitle && <p className="text-xs text-gray-500 mt-0.5 mb-4">{subtitle}</p>}
      {!subtitle && <div className="mb-4" />}
      {children}
    </div>
  );

  return (
    <div className="min-h-screen bg-charcoal text-white font-sans flex flex-col h-dvh overflow-hidden">
      {/* Header */}
      <div className="flex justify-between items-center py-4 md:py-6 px-5 md:px-8 shrink-0 border-b border-surface-light">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="w-10 h-10 flex items-center justify-center bg-surface border border-surface-light rounded-xl text-gray-400 hover:text-gold transition cursor-pointer"
            title="Torna al Dashboard"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-3">
            <div className="text-gold">
              <Sun size={34} strokeWidth={1.5} />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-serif tracking-widest text-[#f5f5f5] leading-tight">IMPOSTAZIONI</h1>
              <p className="text-[10px] tracking-[0.2em] text-gold uppercase font-semibold">Configurazione sistema</p>
            </div>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
          <Wifi size={14} className="text-emerald-400" />
          Rete Locale
        </div>
      </div>

      {/* Body: sidebar + content */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <aside className="w-full md:w-72 border-r border-surface-light bg-surface/30 overflow-y-auto custom-scrollbar shrink-0 md:flex md:flex-col">
          <nav className="p-3 md:p-4 space-y-1.5">
            {SECTIONS.map((s) => {
              const Icon = s.icon;
              const isActive = section === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setSection(s.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all cursor-pointer ${
                    isActive
                      ? 'bg-gold text-black shadow-lg shadow-gold/20'
                      : 'text-gray-400 hover:bg-surface hover:text-white'
                  }`}
                >
                  <Icon size={20} className="shrink-0" />
                  <div className="text-left flex-1 min-w-0">
                    <p className={`text-sm font-bold ${isActive ? 'text-black' : ''}`}>{s.label}</p>
                    <p className={`text-[10px] truncate ${isActive ? 'text-black/60' : 'text-gray-600'}`}>{s.desc}</p>
                  </div>
                  {isActive && <ArrowRight size={16} className="shrink-0" />}
                </button>
              );
            })}
          </nav>
          <div className="mt-auto hidden md:block p-4">
            <div className="p-4 bg-surface border border-surface-light rounded-xl">
              <div className="flex items-center gap-2 mb-1">
                <Info size={14} className="text-gold" />
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.25em]">Info</p>
              </div>
              <p className="text-[11px] text-gray-500 leading-relaxed">
                Le impostazioni si salvano automaticamente su questo dispositivo.
              </p>
            </div>
          </div>
        </aside>

        {/* Content */}
        <main className="flex-1 overflow-y-auto custom-scrollbar p-5 md:p-8">
          <div className="max-w-2xl mx-auto space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300" key={section}>

            {/* ===== RISTORANTE ===== */}
            {section === 'ristorante' && (
              <>
                <Card title="Identità del ristorante" subtitle="Compare nella schermata principale e sulle stampe.">
                  <div className="space-y-4">
                    <Field label="Nome ristorante" value={restaurantName} onChange={setRestaurantName} placeholder="IL GIRASOLE" />
                    <Field label="Sottotitolo" value={restaurantTagline} onChange={setRestaurantTagline} placeholder="Ristorante Italiano" />
                  </div>
                </Card>
                <div className="border border-surface-light rounded-2xl p-5 bg-charcoal/40">
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.25em] mb-3">Anteprima intestazione</p>
                  <div className="flex items-center gap-3">
                    <div className="text-gold"><Sun size={30} strokeWidth={1.5} /></div>
                    <div>
                      <h1 className="text-xl font-serif tracking-widest text-[#f5f5f5] leading-tight">{restaurantName || 'IL GIRASOLE'}</h1>
                      <p className="text-[10px] tracking-[0.2em] text-gold uppercase font-semibold">{restaurantTagline || 'Ristorante Italiano'}</p>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ===== ASPETTO ===== */}
            {section === 'aspetto' && (
              <Card title="Tema grafico" subtitle="Cambia i colori di tutta l'app. La scelta si applica subito.">
                <div className="flex flex-wrap gap-2">
                  {THEMES.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => { applyTheme(t.id); setThemeId(t.id); }}
                      className={`flex-1 min-w-[220px] flex items-center gap-3 p-4 rounded-2xl border transition cursor-pointer ${
                        themeId === t.id
                          ? 'border-gold bg-gold/10'
                          : 'border-surface-light bg-charcoal hover:border-gold/40'
                      }`}
                    >
                      <div className="flex gap-1.5 shrink-0">
                        <span className="w-5 h-5 rounded-full border border-white/20" style={{ background: t.colors.charcoal }} />
                        <span className="w-5 h-5 rounded-full border border-white/20" style={{ background: t.colors.surface }} />
                        <span className="w-5 h-5 rounded-full border border-white/20" style={{ background: t.colors.gold }} />
                      </div>
                      <span className={`text-sm font-bold ${themeId === t.id ? 'text-gold' : 'text-gray-300'}`}>{t.label}</span>
                      {themeId === t.id && <Check size={16} className="ml-auto text-gold shrink-0" />}
                    </button>
                  ))}
                </div>
              </Card>
            )}

            {/* ===== STAMPA ===== */}
            {section === 'stampa' && (
              <>
                <Card title="Print Agent" subtitle="Servizio locale che inoltra le stampe alle stampanti di rete.">
                  <div className="space-y-4">
                    <Field label="Print Agent URL" value={agentUrl} onChange={setAgentUrl} placeholder="http://127.0.0.1:8787" />
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="IP stampante" value={printerIp} onChange={setPrinterIp} placeholder="192.168.1.100" />
                      <Field label="Porta" value={printerPort} onChange={(v) => setPrinterPort(v.replace(/\D/g, '').slice(0, 5))} placeholder="9100" type="text" />
                    </div>
                  </div>
                </Card>
                <Card title="Test connessione" subtitle="Verifica che il Print Agent risponda e stampa una prova in cucina.">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleTestConnection}
                      disabled={isTestingConnection}
                      className="bg-gold hover:bg-gold-hover text-black px-5 py-2.5 rounded-xl font-bold text-xs transition cursor-pointer disabled:opacity-60"
                    >
                      {isTestingConnection ? 'Test in corso...' : 'Test connessione'}
                    </button>
                    <div className="flex-1 min-h-[42px] rounded-xl border border-surface-light px-3 py-2 text-xs font-bold flex items-center text-white">
                      {connectionTestMessage || 'Stato stampante'}
                    </div>
                  </div>
                </Card>
              </>
            )}

            {/* ===== COMANDI ===== */}
            {section === 'comande' && (
              <Card title="Comportamento comande" subtitle="Opzioni relative all'invio degli ordini in cucina e sala.">
                <div className="space-y-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-bold text-white">Ristampa quantità</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Quando si cambia la quantità di un piatto già in comanda, stampa l'aggiunta in cucina
                      </p>
                    </div>
                    <Toggle checked={printDeltaQty} onChange={() => setPrintDeltaQty(!printDeltaQty)} />
                  </div>
                </div>
              </Card>
            )}

            {/* ===== SCHERMO ===== */}
            {section === 'schermo' && (
              <Card title="Display" subtitle="Comportamento dello schermo sui dispositivi.">
                <div className="space-y-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-bold text-white">Always On Display</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Impedisce al dispositivo di andare in sospensione mentre l'app è aperta
                      </p>
                    </div>
                    <Toggle
                      checked={wakeLockEnabled}
                      onChange={() => {
                        const next = !wakeLockEnabled;
                        setWakeLockLocal(next);
                        setWakeLockEnabled(next);
                      }}
                    />
                  </div>
                  {wakeLockEnabled && !wakeLockSupported && (
                    <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                      Questo browser/dispositivo non supporta la funzione "sempre acceso". Su iPad serve Safari aggiornato (iOS 16.4+) e l'app aperta come PWA installata dalla schermata Home, non come semplice scheda del browser.
                    </p>
                  )}
                </div>
              </Card>
            )}

            {/* ===== SICUREZZA ===== */}
            {section === 'sicurezza' && (
              <Card title="PIN responsabile" subtitle="Richiesto per azioni sensibili (svuota DB, cambio PIN, chiusure).">
                <div className="space-y-2">
                  <div className="flex flex-col sm:flex-row items-stretch gap-2">
                    <input
                      type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6}
                      placeholder="Nuovo PIN (4-6 cifre)"
                      value={newPin}
                      onChange={e => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="w-full bg-charcoal border border-surface-light rounded-xl px-3 py-2.5 text-sm text-white font-bold text-center placeholder:text-gray-600 focus:outline-none focus:border-gold/50"
                    />
                    <input
                      type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6}
                      placeholder="Conferma PIN"
                      value={confirmNewPin}
                      onChange={e => setConfirmNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="w-full bg-charcoal border border-surface-light rounded-xl px-3 py-2.5 text-sm text-white font-bold text-center placeholder:text-gray-600 focus:outline-none focus:border-gold/50"
                    />
                    <button
                      onClick={async () => {
                        if (newPin.length < 4) { addToast({ type: 'error', title: 'PIN troppo corto', message: 'Minimo 4 cifre' }); return; }
                        if (newPin !== confirmNewPin) { addToast({ type: 'error', title: 'PIN non corrispondono', message: 'I due PIN non coincidono' }); return; }
                        if (await requireManagerPin('cambiare il PIN')) {
                          setManagerPin(newPin);
                          setNewPin('');
                          setConfirmNewPin('');
                          addToast({ type: 'success', title: 'PIN cambiato' });
                        }
                      }}
                      className="bg-gold hover:bg-gold-hover text-black shrink-0 px-5 py-2.5 rounded-xl font-bold text-xs transition cursor-pointer"
                    >
                      <Save size={14} className="inline mr-1" /> Salva
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-500 font-bold">Il PIN attuale è richiesto per azioni sensibili (svuota DB, cambio PIN)</p>
                </div>
              </Card>
            )}

            {section === 'sicurezza' && (
              <Card title="Operatori" subtitle="Aggiungi, modifica o rimuovi gli operatori che possono accedere da cameriere.">
                <div className="space-y-2 mb-4">
                  {staffUsers.length === 0 && !isAddingUser && (
                    <p className="text-xs text-gray-500 font-bold py-4 text-center">Nessun operatore configurato. Il PIN responsabile qui sopra resta valido come accesso di riserva.</p>
                  )}
                  {staffUsers.map(user => (
                    <div key={user.id} className="bg-charcoal border border-surface-light rounded-2xl p-4">
                      {editingUserId === user.id ? (
                        <div className="space-y-2">
                          <input type="text" placeholder="Nome" value={editUserName} onChange={e => setEditUserName(e.target.value)}
                            className="w-full bg-surface border border-surface-light rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-gold" />
                          <input type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6} placeholder="Nuovo PIN (lascia vuoto per non cambiare)" value={editUserPin}
                            onChange={e => setEditUserPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
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
                            <button onClick={() => handleSaveEditUser(user.id)}
                              className="flex-1 py-2 bg-gold text-black rounded-xl text-[10px] font-black uppercase">Salva</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 bg-surface rounded-xl flex items-center justify-center text-gold font-black shrink-0">{user.name.charAt(0).toUpperCase()}</div>
                            <div className="min-w-0">
                              <p className="font-bold text-white text-sm truncate">{user.name}</p>
                              <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">{ROLE_LABELS[user.role]}</p>
                            </div>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <button onClick={() => startEditUser(user)} className="p-2 text-gray-500 hover:text-gold" title="Modifica">
                              <Edit3 size={16} />
                            </button>
                            <button onClick={() => handleRemoveUser(user)} className="p-2 text-gray-500 hover:text-red-500" title="Elimina">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {isAddingUser ? (
                  <div className="bg-charcoal border border-dashed border-gold/30 rounded-2xl p-4 space-y-2">
                    <input type="text" placeholder="Nome operatore" autoFocus value={newUserName} onChange={e => setNewUserName(e.target.value)}
                      className="w-full bg-surface border border-surface-light rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-gold" />
                    <input type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6} placeholder="PIN (4-6 cifre)" value={newUserPin}
                      onChange={e => setNewUserPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="w-full bg-surface border border-surface-light rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-gold" />
                    <select value={newUserRole} onChange={e => setNewUserRole(e.target.value as StaffRole)}
                      className="w-full bg-surface border border-surface-light rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-gold">
                      <option value="waiter">Cameriere</option>
                      <option value="kitchen">Cucina</option>
                      <option value="admin">Amministratore / Cassa</option>
                    </select>
                    <div className="flex gap-2">
                      <button onClick={() => { setIsAddingUser(false); setNewUserName(''); setNewUserPin(''); }}
                        className="flex-1 py-2.5 bg-charcoal border border-surface-light rounded-xl text-[10px] font-black uppercase text-gray-400">
                        <X size={14} className="inline mr-1" /> Annulla
                      </button>
                      <button onClick={handleAddUser} className="flex-1 py-2.5 bg-gold text-black rounded-xl text-[10px] font-black uppercase">
                        <Save size={14} className="inline mr-1" /> Aggiungi
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setIsAddingUser(true)}
                    className="w-full py-3.5 bg-charcoal border border-dashed border-surface-light hover:border-gold/40 rounded-2xl text-gray-400 hover:text-gold font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                  >
                    <Plus size={16} /> Aggiungi operatore
                  </button>
                )}

                <p className="text-[10px] text-gray-500 font-bold mt-4 flex items-center gap-1.5">
                  <Users size={12} /> Il cameriere sceglie il proprio nome e inserisce il PIN una volta sola per dispositivo: resta collegato finché non fa logout.
                </p>
              </Card>
            )}

            {/* ===== PERSONALE (TURNI) ===== */}
            {section === 'personale' && (
              <Card title="Turni" subtitle="Segna se un operatore ha lavorato a pranzo e/o a sera. Marcatura manuale, senza orari.">
                <div className="flex items-center justify-between mb-5 bg-charcoal border border-surface-light rounded-2xl p-2">
                  <button onClick={() => shiftTurniDate(-1)} className="p-2.5 rounded-xl text-gray-400 hover:text-white hover:bg-surface-light transition-all">
                    <ChevronLeft size={18} />
                  </button>
                  <div className="text-center">
                    <p className="text-sm font-black text-white">
                      {new Date(turniDate + 'T00:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </p>
                    {turniDate !== toLocalISODate() && (
                      <button onClick={() => setTurniDate(toLocalISODate())} className="text-[10px] font-black text-gold uppercase tracking-widest mt-0.5">Torna a oggi</button>
                    )}
                  </div>
                  <button onClick={() => shiftTurniDate(1)} className="p-2.5 rounded-xl text-gray-400 hover:text-white hover:bg-surface-light transition-all">
                    <ArrowRight size={18} />
                  </button>
                </div>

                <div key={turniTick} className="space-y-2">
                  {staffUsers.length === 0 && (
                    <p className="text-xs text-gray-500 font-bold py-6 text-center">Nessun operatore configurato (vedi sopra in Sicurezza).</p>
                  )}
                  {staffUsers.map(user => (
                    <div key={user.id} className="bg-charcoal border border-surface-light rounded-2xl p-3.5 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 bg-surface rounded-xl flex items-center justify-center text-gold font-black shrink-0 text-xs">{user.name.charAt(0).toUpperCase()}</div>
                        <p className="font-bold text-white text-sm truncate">{user.name}</p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => handleToggleTurno(user.id, 'pranzo')}
                          className={`px-3 py-2 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all active:scale-90 ${
                            hasTurno(user.id, turniDate, 'pranzo') ? 'bg-gold border-gold text-black' : 'bg-surface border-surface-light text-gray-500 hover:text-white'
                          }`}
                        >
                          Pranzo
                        </button>
                        <button
                          onClick={() => handleToggleTurno(user.id, 'sera')}
                          className={`px-3 py-2 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all active:scale-90 ${
                            hasTurno(user.id, turniDate, 'sera') ? 'bg-gold border-gold text-black' : 'bg-surface border-surface-light text-gray-500 hover:text-white'
                          }`}
                        >
                          Sera
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* ===== MENU ONLINE ===== */}
            {section === 'menu-online' && (
              <Card title="Menu Online" subtitle="Pubblica il menu su internet (raggiungibile senza WiFi del locale).">
                <div className="space-y-4">
                  <p className="text-xs text-gray-500 font-bold leading-relaxed">
                    Il menu online non è in tempo reale: mostra l'ultimo snapshot pubblicato.
                    Premi "Pubblica" ogni volta che vuoi aggiornare quello che vedono i clienti online.
                  </p>
                  <Field
                    label="URL di pubblicazione"
                    value={publishUrl}
                    onChange={setPublishUrl}
                    placeholder="https://tuo-menu.vercel.app/api/publish-menu"
                  />
                  <Field
                    label="Chiave di pubblicazione"
                    value={publishSecret}
                    onChange={setPublishSecret}
                    type="password"
                    placeholder="La stessa impostata su Vercel come PUBLISH_SECRET"
                  />
                  <button
                    onClick={handlePublishMenu}
                    disabled={isPublishing || !publishUrl.trim() || !publishSecret.trim()}
                    className="w-full bg-gold hover:bg-gold-hover text-black font-black py-3.5 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-30"
                  >
                    <UploadCloud size={18} /> {isPublishing ? 'Pubblicazione in corso…' : 'Pubblica Menu Online'}
                  </button>
                </div>
              </Card>
            )}

            {/* ===== SISTEMA ===== */}
            {section === 'sistema' && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button
                    onClick={() => navigate('/reports')}
                    className="flex items-center gap-4 p-5 bg-charcoal/40 border border-gold/30 rounded-2xl hover:bg-gold/10 transition-all cursor-pointer text-left"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-gold/10 flex items-center justify-center shrink-0">
                      <BarChart3 size={24} className="text-gold" />
                    </div>
                    <div>
                      <p className="font-bold text-white">Report e Statistiche</p>
                      <p className="text-xs text-gray-500 mt-0.5">Vendite, incassi e chiusure</p>
                    </div>
                    <ArrowRight size={18} className="ml-auto text-gold shrink-0" />
                  </button>
                  <button
                    onClick={() => navigate('/reports')}
                    className="flex items-center gap-4 p-5 bg-charcoal/40 border border-gold/30 rounded-2xl hover:bg-gold/10 transition-all cursor-pointer text-left"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-gold/10 flex items-center justify-center shrink-0">
                      <FileText size={24} className="text-gold" />
                    </div>
                    <div>
                      <p className="font-bold text-white">Documenti emessi</p>
                      <p className="text-xs text-gray-500 mt-0.5">Ricevute e fatture</p>
                    </div>
                    <ArrowRight size={18} className="ml-auto text-gold shrink-0" />
                  </button>
                  <button
                    onClick={() => navigate('/servizi')}
                    className="flex items-center gap-4 p-5 bg-charcoal/40 border border-gold/30 rounded-2xl hover:bg-gold/10 transition-all cursor-pointer text-left"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-gold/10 flex items-center justify-center shrink-0">
                      <MonitorCog size={24} className="text-gold" />
                    </div>
                    <div>
                      <p className="font-bold text-white">Pannello Servizi</p>
                      <p className="text-xs text-gray-500 mt-0.5">Nginx, stampante, aggiornamenti da Git</p>
                    </div>
                    <ArrowRight size={18} className="ml-auto text-gold shrink-0" />
                  </button>
                </div>

                <Card title="Database" subtitle="Operazioni di manutenzione sui dati del ristorante.">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      onClick={handleCleanup}
                      disabled={loadingAction === 'cleanup'}
                      className="flex-1 bg-surface-light/40 border border-red-500/30 text-red-400 py-3 rounded-xl font-bold text-xs text-center hover:bg-red-500/10 transition cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                      <Trash2 size={16} /> {loadingAction === 'cleanup' ? 'Pulizia...' : 'Svuota Database'}
                    </button>
                    <button
                      onClick={handlePopulate}
                      disabled={loadingAction === 'populate'}
                      className="flex-1 bg-surface-light/40 border border-emerald-500/30 text-emerald-400 py-3 rounded-xl font-bold text-xs text-center hover:bg-emerald-500/10 transition cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                      <RotateCcw size={16} /> {loadingAction === 'populate' ? 'Ripristino...' : 'Ripristina Dati Demo'}
                    </button>
                  </div>
                </Card>

                <div className="border border-surface-light rounded-2xl p-5 bg-charcoal/40 flex items-center gap-3">
                  <Database size={18} className="text-gray-500 shrink-0" />
                  <p className="text-xs text-gray-500">
                    Stato: <span className="text-emerald-400 font-bold">Online</span> — connessione al database attiva.
                  </p>
                </div>
              </>
            )}

          </div>
        </main>
      </div>
    </div>
  );
}
