import { useState, useCallback, useEffect, type ReactNode } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { ArrowRight, Users, ChevronRight, ShieldAlert } from 'lucide-react';
import {
  isStaffSessionValid,
  setStaffSessionValid,
  verifyStaffPin,
  getStaffUsers,
  addStaffUser,
  getDefaultStaffPin,
  getDefaultRouteForRole,
  getCurrentUser,
  hasPermission,
  clearStaffSession,
  syncStaffUsersFromDb,
  type StaffUser,
  type StaffRole,
} from '../lib/staffAuth';

interface StaffPinGuardProps {
  children?: ReactNode;
  /** Se presente, oltre al login viene richiesto che l'operatore abbia uno di questi ruoli (admin passa sempre). */
  requiredRoles?: StaffRole[];
}

/** Usabile sia come layout route (con <Outlet/>) sia wrappando direttamente un componente con `children`. */
export default function StaffPinGuard({ children, requiredRoles }: StaffPinGuardProps = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [authed, setAuthed] = useState(() => isStaffSessionValid());
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [users, setUsers] = useState<StaffUser[]>(() => getStaffUsers());
  const defaultPin = getDefaultStaffPin();

  useEffect(() => { setAuthed(isStaffSessionValid()); }, []);
  useEffect(() => {
    // Carica prima da localStorage, poi sincronizza dal DB (cross-device)
    setUsers(getStaffUsers());
    syncStaffUsersFromDb().then(() => setUsers(getStaffUsers()));
  }, []);

  useEffect(() => {
    if (authed) {
      const user = getCurrentUser();
      if (user) {
        const target = getDefaultRouteForRole(user.role);
        if (location.pathname === '/' || location.pathname === '') {
          navigate(target, { replace: true });
        }
      }
    }
  }, [authed]);

  // Auto-create default user if no users exist and a default PIN is configured
  useEffect(() => {
    if (users.length === 0 && defaultPin) {
      addStaffUser('Operatore', defaultPin, 'admin');
      setUsers(getStaffUsers());
    }
  }, []);

  const submit = useCallback(() => {
    setError(null);
    if (selectedUserId) {
      if (!verifyStaffPin(selectedUserId, pin)) {
        setError('PIN non valido');
        setPin('');
        return;
      }
      const user = users.find(u => u.id === selectedUserId) || { id: selectedUserId, name: 'Operatore', pin, role: 'admin' as const };
      setStaffSessionValid(user);
      setAuthed(true);
      setPin('');
    } else if (defaultPin) {
      // Legacy PIN fallback
      if (pin.trim() !== defaultPin) {
        setError('PIN non valido');
        setPin('');
        return;
      }
      const user = users.find(u => u.pin === pin.trim()) || { id: 'legacy', name: 'Operatore', pin, role: 'admin' as const };
      setStaffSessionValid(user);
      setAuthed(true);
      setPin('');
    } else {
      setError('Nessun utente configurato. Contatta l\'amministratore.');
    }
  }, [pin, selectedUserId, defaultPin, users]);

  if (!authed) {
    return (
      <div className="min-h-screen bg-charcoal flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm bg-surface border border-surface-light rounded-[32px] p-8 shadow-2xl">
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-gold/10 rounded-3xl text-gold border border-gold/20">
              <Users size={36} strokeWidth={2.5} />
            </div>
          </div>
          <h1 className="text-2xl font-black text-white text-center uppercase italic tracking-tight mb-1">
            Accesso <span className="text-gold">Staff</span>
          </h1>
          <p className="text-center text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-6">
            Seleziona il tuo profilo
          </p>

          {!selectedUserId ? (
            <div className="space-y-2 mb-6">
              {users.map(user => (
                <button key={user.id} onClick={() => { setSelectedUserId(user.id); setError(null); setPin(''); }}
                  className="w-full flex items-center justify-between p-4 bg-charcoal border border-surface-light rounded-2xl hover:border-gold/40 transition-all text-left group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-surface rounded-xl flex items-center justify-center text-gold font-black group-hover:bg-gold group-hover:text-black transition-all">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold text-white text-sm">{user.name}</p>
                      <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">{user.role}</p>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-gray-600" />
                </button>
              ))}
              {defaultPin && (
                <button onClick={() => setSelectedUserId(null)}
                  className="w-full flex items-center justify-between p-4 bg-charcoal border border-dashed border-surface-light rounded-2xl hover:border-gold/30 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-surface rounded-xl flex items-center justify-center text-gray-500 font-black">?</div>
                    <div>
                      <p className="font-bold text-gray-400 text-sm">PIN predefinito</p>
                      <p className="text-[9px] font-black text-gray-600 uppercase">Login legacy</p>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-gray-600" />
                </button>
              )}
            </div>
          ) : (
            <div className="mb-6">
              <button onClick={() => { setSelectedUserId(null); setError(null); setPin(''); }}
                className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-1 hover:text-white"
              >
                <ArrowRight size={12} className="rotate-180" /> Cambia utente
              </button>
              <p className="text-center text-white font-bold text-sm mb-4">
                {users.find(u => u.id === selectedUserId)?.name || 'Operatore'}
              </p>
              <input type="password" inputMode="numeric" value={pin} onChange={e => { setPin(e.target.value); setError(null); }}
                onKeyDown={e => e.key === 'Enter' && submit()} placeholder="PIN"
                className="w-full bg-charcoal border border-surface-light rounded-2xl px-5 py-4 text-center text-2xl font-black tracking-[0.5em] text-white placeholder:text-gray-600 outline-none focus:border-gold mb-4"
              />
              {error && <p className="text-red-400 text-xs font-bold text-center mb-4 uppercase">{error}</p>}
            </div>
          )}

          {selectedUserId ? (
            <button onClick={submit}
              className="w-full bg-gold hover:bg-gold-hover text-black font-black py-4 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            >
              Accedi <ArrowRight size={20} />
            </button>
          ) : users.length === 0 && defaultPin ? (
            <button onClick={submit} disabled={!defaultPin}
              className="w-full bg-gold hover:bg-gold-hover text-black font-black py-4 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-30"
            >
              Accedi con PIN <ArrowRight size={20} />
            </button>
          ) : null}

          <p className="mt-6 text-[10px] text-gray-600 text-center font-bold uppercase tracking-widest">
            Sessione su questo dispositivo
          </p>
        </div>
      </div>
    );
  }

  if (requiredRoles && requiredRoles.length > 0) {
    const current = getCurrentUser();
    if (current && !hasPermission(current.role, requiredRoles)) {
      return (
        <div className="min-h-screen bg-charcoal flex flex-col items-center justify-center p-6 text-center">
          <div className="p-4 bg-red-500/10 rounded-3xl text-red-400 border border-red-500/20 mb-6">
            <ShieldAlert size={36} strokeWidth={2.5} />
          </div>
          <h1 className="text-xl font-black text-white uppercase italic tracking-tight mb-2">
            Accesso <span className="text-red-400">non autorizzato</span>
          </h1>
          <p className="text-gray-500 text-sm font-bold mb-8 max-w-xs">
            {current.name}, il tuo ruolo ({current.role}) non ha accesso a questa sezione.
          </p>
          <button
            onClick={() => { clearStaffSession(); setSelectedUserId(null); setPin(''); setAuthed(false); }}
            className="bg-gold hover:bg-gold-hover text-black font-black py-3.5 px-6 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          >
            Cambia operatore <ArrowRight size={18} />
          </button>
        </div>
      );
    }
  }

  return children ? <>{children}</> : <Outlet />;
}
