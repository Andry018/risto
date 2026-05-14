import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { X, CheckCircle, AlertCircle, Bell } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextValue {
  toasts: ToastMessage[];
  addToast: (t: Omit<ToastMessage, 'id'>) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

let toastCounter = 0;
function nextId() { return `toast-${++toastCounter}`; }

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const addToast = useCallback((t: Omit<ToastMessage, 'id'>) => {
    const id = nextId();
    setToasts(prev => [...prev, { ...t, id }]);
    const ms = t.duration ?? 4000;
    if (ms > 0) {
      setTimeout(() => removeToast(id), ms);
    }
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <div className="fixed top-4 right-4 z-[200] flex flex-col gap-3 pointer-events-none max-w-sm w-full">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`pointer-events-auto animate-in slide-in-from-right-2 fade-in duration-300 rounded-2xl border shadow-2xl p-4 flex items-start gap-3 backdrop-blur-xl ${
              toast.type === 'success' ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' :
              toast.type === 'error' ? 'bg-red-500/20 border-red-500/40 text-red-400' :
              toast.type === 'warning' ? 'bg-amber-500/20 border-amber-500/40 text-amber-400' :
              'bg-surface border-surface-light text-white'
            }`}
          >
            <div className="shrink-0 mt-0.5">
              {toast.type === 'success' ? <CheckCircle size={20} /> :
               toast.type === 'error' ? <AlertCircle size={20} /> :
               toast.type === 'warning' ? <AlertCircle size={20} /> :
               <Bell size={20} />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-black text-sm uppercase tracking-wider">{toast.title}</p>
              {toast.message && <p className="text-xs text-white/70 mt-0.5">{toast.message}</p>}
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="shrink-0 p-1 hover:bg-white/10 rounded-lg transition-colors opacity-60 hover:opacity-100"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
