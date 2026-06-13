import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

interface ConfirmContextValue {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{
    options: ConfirmOptions;
    resolve: (val: boolean) => void;
  } | null>(null);

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    return new Promise(resolve => {
      setState({ options: opts, resolve });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    state?.resolve(true);
    setState(null);
  }, [state]);

  const handleCancel = useCallback(() => {
    state?.resolve(false);
    setState(null);
  }, [state]);

  return (
    <ConfirmContext.Provider value={{ confirm }}>
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
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${state.options.destructive ? 'bg-red-500/20' : 'bg-gold/20'}`}>
                  <AlertTriangle size={20} className={state.options.destructive ? 'text-red-400' : 'text-gold'} />
                </div>
                <h2 className="text-lg font-black text-white uppercase tracking-tighter">
                  {state.options.title}
                </h2>
              </div>
              <button onClick={handleCancel} className="p-2 bg-charcoal border border-surface-light rounded-xl text-gray-500 hover:text-white transition-all active:scale-90">
                <X size={18} />
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-300 font-bold leading-relaxed">{state.options.message}</p>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <button
                  onClick={handleCancel}
                  className="py-3 px-4 rounded-2xl font-black text-sm bg-charcoal border border-surface-light text-gray-400 hover:text-white hover:border-gray-600 transition-all active:scale-95"
                >
                  {state.options.cancelLabel || 'Annulla'}
                </button>
                <button
                  onClick={handleConfirm}
                  className={`py-3 px-4 rounded-2xl font-black text-sm transition-all active:scale-95 ${
                    state.options.destructive
                      ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20'
                      : 'bg-gold hover:bg-gold-hover text-black shadow-lg shadow-gold/20'
                  }`}
                >
                  {state.options.confirmLabel || 'Conferma'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
