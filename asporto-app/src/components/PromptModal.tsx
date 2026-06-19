import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface PromptOptions {
  title: string;
  message: string;
  defaultValue?: string;
  placeholder?: string;
}

interface PromptContextValue {
  prompt: (opts: PromptOptions) => Promise<string | null>;
}

const PromptContext = createContext<PromptContextValue | null>(null);

export function usePrompt() {
  const ctx = useContext(PromptContext);
  if (!ctx) throw new Error('usePrompt must be used within PromptProvider');
  return ctx;
}

export function PromptProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{
    options: PromptOptions;
    resolve: (val: string | null) => void;
  } | null>(null);
  const [value, setValue] = useState('');

  const prompt = useCallback((opts: PromptOptions): Promise<string | null> => {
    return new Promise(resolve => {
      setState({ options: opts, resolve });
      setValue(opts.defaultValue || '');
    });
  }, []);

  const handleConfirm = useCallback(() => {
    state?.resolve(value.trim() || null);
    setState(null);
  }, [state, value]);

  const handleCancel = useCallback(() => {
    state?.resolve(null);
    setState(null);
  }, [state]);

  return (
    <PromptContext.Provider value={{ prompt }}>
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
              <h2 className="text-lg font-black text-white uppercase tracking-tighter">
                {state.options.title}
              </h2>
              <button onClick={handleCancel} className="p-2 bg-charcoal border border-surface-light rounded-xl text-gray-500 hover:text-white transition-all active:scale-90">
                <X size={18} />
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-300 font-bold leading-relaxed mb-4">{state.options.message}</p>
              <input
                type="text"
                value={value}
                onChange={e => setValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleConfirm(); }}
                className="w-full bg-charcoal border border-surface-light rounded-2xl p-4 text-white font-bold text-base outline-none focus:border-gold transition-colors"
                placeholder={state.options.placeholder || ''}
                autoFocus
                onFocus={e => e.target.select()}
              />
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
    </PromptContext.Provider>
  );
}
