import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { X, Lock } from 'lucide-react';
import { getManagerPin, setPinPromptHandler } from '../lib/staffAuth';

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
    resolve: (val: boolean) => void;
  } | null>(null);
  const [pinValue, setPinValue] = useState('');
  const [pinError, setPinError] = useState(false);

  const requestPin = useCallback((actionLabel: string): Promise<boolean> => {
    return new Promise(resolve => {
      setState({ actionLabel, resolve });
      setPinValue('');
      setPinError(false);
    });
  }, []);

  const handleConfirm = useCallback(() => {
    if (pinValue.trim() === getManagerPin()) {
      state?.resolve(true);
      setState(null);
    } else {
      setPinError(true);
    }
  }, [state, pinValue]);

  const handleCancel = useCallback(() => {
    state?.resolve(false);
    setState(null);
  }, [state]);

  useEffect(() => {
    setPinPromptHandler(requestPin);
  }, [requestPin]);

  return (
    <PinContext.Provider value={{ requestPin }}>
      {children}
      {state && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={handleCancel}
        >
          <div
            className="bg-surface border border-surface-light w-full max-w-sm rounded-[32px] shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden"
            onClick={e => e.stopPropagation()}
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
              <button onClick={handleCancel} className="p-2 bg-charcoal border border-surface-light rounded-xl text-gray-500 hover:text-white transition-all active:scale-90">
                <X size={18} />
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-300 font-bold leading-relaxed mb-4">
                Inserisci il PIN per {state.actionLabel}
              </p>
              <input
                type="password"
                value={pinValue}
                onChange={e => { setPinValue(e.target.value); setPinError(false); }}
                onKeyDown={e => { if (e.key === 'Enter') handleConfirm(); }}
                className={`w-full bg-charcoal border rounded-2xl p-4 text-white font-bold text-center text-2xl tracking-[0.3em] outline-none transition-colors ${pinError ? 'border-red-500 focus:border-red-500' : 'border-surface-light focus:border-gold'}`}
                placeholder="● ● ● ●"
                autoFocus
              />
              {pinError && (
                <p className="text-red-400 text-xs font-bold mt-2 text-center animate-in slide-in-from-top-1 duration-200">PIN non valido</p>
              )}
              <div className="mt-6 grid grid-cols-2 gap-3">
                <button
                  onClick={handleCancel}
                  className="py-3 px-4 rounded-2xl font-black text-sm bg-charcoal border border-surface-light text-gray-400 hover:text-white hover:border-gray-600 transition-all active:scale-95"
                >
                  Annulla
                </button>
                <button
                  onClick={handleConfirm}
                  className="py-3 px-4 rounded-2xl font-black text-sm bg-gold hover:bg-gold-hover text-black transition-all active:scale-95 shadow-lg shadow-gold/20"
                >
                  Conferma
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </PinContext.Provider>
  );
}
