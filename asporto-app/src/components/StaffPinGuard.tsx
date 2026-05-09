import { useState, useCallback, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Lock, ArrowRight, AlertCircle } from 'lucide-react';
import {
  getConfiguredStaffPin,
  isStaffSessionValid,
  setStaffSessionValid,
  verifyStaffPin,
} from '../lib/staffAuth';

export default function StaffPinGuard() {
  const navigate = useNavigate();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [authed, setAuthed] = useState(() => isStaffSessionValid());

  const expectedConfigured = getConfiguredStaffPin();

  useEffect(() => {
    setAuthed(isStaffSessionValid());
  }, []);

  const submit = useCallback(() => {
    setError(null);
    if (!expectedConfigured) {
      setError('PIN non configurato: imposta VITE_STAFF_PIN per la produzione.');
      return;
    }
    if (!verifyStaffPin(pin)) {
      setError('PIN non valido');
      setPin('');
      return;
    }
    setStaffSessionValid();
    setAuthed(true);
    setPin('');
  }, [pin, expectedConfigured]);

  if (!expectedConfigured) {
    return (
      <div className="min-h-screen bg-charcoal flex flex-col items-center justify-center p-8 text-center">
        <AlertCircle className="text-amber-500 mb-4" size={48} />
        <h1 className="text-2xl font-black text-white uppercase italic mb-2">Accesso staff non configurato</h1>
        <p className="text-gray-400 max-w-md mb-6">
          Aggiungi <code className="text-gold">VITE_STAFF_PIN</code> nel file{' '}
          <code className="text-gold">.env</code> e ricostruisci l&apos;app. In sviluppo il default è{' '}
          <code className="text-gold">1234</code> se la variabile manca.
        </p>
        <button
          type="button"
          onClick={() => navigate('/asporto', { replace: true })}
          className="text-gold text-sm font-bold underline"
        >
          Vai alla vista cliente
        </button>
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-charcoal flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm bg-surface border border-surface-light rounded-[32px] p-10 shadow-2xl">
          <div className="flex justify-center mb-8">
            <div className="p-5 bg-gold/10 rounded-3xl text-gold border border-gold/20">
              <Lock size={40} strokeWidth={2.5} />
            </div>
          </div>
          <h1 className="text-2xl font-black text-white text-center uppercase italic tracking-tight mb-1">
            Area <span className="text-gold">Staff</span>
          </h1>
          <p className="text-center text-gray-500 text-xs font-bold uppercase tracking-widest mb-8">
            Inserisci il PIN operatore
          </p>

          <input
            type="password"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={pin}
            onChange={e => {
              setPin(e.target.value);
              setError(null);
            }}
            onKeyDown={e => e.key === 'Enter' && submit()}
            placeholder="••••"
            className="w-full bg-charcoal border border-surface-light rounded-2xl px-5 py-4 text-center text-2xl font-black tracking-[0.5em] text-white placeholder:text-gray-600 outline-none focus:border-gold mb-4"
          />

          {error && (
            <p className="text-red-400 text-xs font-bold text-center mb-4 uppercase tracking-wide">{error}</p>
          )}

          <button
            type="button"
            onClick={submit}
            className="w-full bg-gold hover:bg-gold-hover text-charcoal font-black py-4 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          >
            Accedi <ArrowRight size={20} />
          </button>

          <p className="mt-8 text-[10px] text-gray-600 text-center font-bold uppercase tracking-widest">
            Sessione su questo dispositivo (chiudi il browser per uscire)
          </p>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
