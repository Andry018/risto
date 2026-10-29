import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { X, Lock } from 'lucide-react';
import { verifyManagerPin, setPinPromptHandler } from '../lib/staffAuth';
import Dialog from './Dialog';

interface PinContextValue {
  requestPin: (actionLabel: string) => Promise<boolean>;
}

const PinContext = createContext<PinContextValue | null>(null);

export function usePinModal() {
  const ctx = useContext(PinContext);
  if (!ctx) throw new Error('usePinModal must be used within PinProvider');
  return ctx;
}

export function PinProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{
    actionLabel: string;
    resolve: (pin: string | null) => void;
  } | null>(null);
  const [pinValue, setPinValue] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  /** Risolve con il PIN (già verificato sul server) o null se annullato */
  const requestPinValue = useCallback((actionLabel: string): Promise<string | null> => {
    return new Promise(resolve => {
      setState({ actionLabel, resolve });
      setPinValue('');
      setPinError(null);
    });
  }, []);

  const requestPin = useCallback(
    (actionLabel: string) => requestPinValue(actionLabel).then(pin => pin !== null),
    [requestPinValue],
  );

  const handleConfirm = useCallback(async () => {
    if (!state || checking || !pinValue.trim()) return;
    setChecking(true);
    const check = await verifyManagerPin(pinValue);
    setChecking(false);
    if (check.ok) {
      state.resolve(pinValue.trim());
      setState(null);
    } else {
      setPinError(check.error || 'PIN non valido');
      setPinValue('');
    }
  }, [state, pinValue, checking]);

  const handleCancel = useCallback(() => {
    state?.resolve(null);
    setState(null);
  }, [state]);

  useEffect(() => {
    setPinPromptHandler(requestPinValue);
  }, [requestPinValue]);

  return (
    <PinContext.Provider value={{ requestPin }}>
      {children}
      {state && (
        <Dialog
          open
          onClose={handleCancel}
          label="PIN responsabile"
          overlayClassName="z-[300] items-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          panelClassName="bg-surface border border-surface-light w-full max-w-sm rounded-[32px] shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden"
        >
            <div className="p-6 border-b border-surface-light flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-gold/20">
                  <Lock size={20} className="text-gold" />
                </div>
                <h2 className="text-lg font-black text-white uppercase tracking-tighter">
                  PIN Responsabile
                </h2>
              </div>
              <button onClick={handleCancel} aria-label="Chiudi" className="p-2 bg-charcoal border border-surface-light rounded-xl text-gray-400 hover:text-white transition-all active:scale-90">
                <X size={18} />
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-300 font-bold leading-relaxed mb-4">
                Inserisci il PIN di un amministratore per {state.actionLabel}
              </p>
              <input
                type="password"
                value={pinValue}
                onChange={e => { setPinValue(e.target.value); setPinError(null); }}
                onKeyDown={e => { if (e.key === 'Enter') void handleConfirm(); }}
                className={`w-full bg-charcoal border rounded-2xl p-4 text-white font-bold text-center text-2xl tracking-[0.3em] outline-none transition-colors ${pinError ? 'border-red-500 focus:border-red-500' : 'border-surface-light focus:border-gold'}`}
                placeholder="● ● ● ●"
                autoFocus
              />
              {pinError && (
                <p className="text-red-400 text-xs font-bold mt-2 text-center animate-in slide-in-from-top-1 duration-200">{pinError}</p>
              )}
              <div className="mt-6 grid grid-cols-2 gap-3">
                <button
                  onClick={handleCancel}
                  className="py-3 px-4 rounded-2xl font-black text-sm bg-charcoal border border-surface-light text-gray-400 hover:text-white hover:border-gray-600 transition-all active:scale-95"
                >
                  Annulla
                </button>
                <button
                  onClick={() => void handleConfirm()}
                  disabled={checking}
                  className="disabled:opacity-50 py-3 px-4 rounded-2xl font-black text-sm bg-gold hover:bg-gold-hover text-black transition-all active:scale-95 shadow-lg shadow-gold/20"
                >
                  Conferma
                </button>
              </div>
            </div>
        </Dialog>
      )}
    </PinContext.Provider>
  );
}
