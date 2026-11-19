import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
  XCircle,
} from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const TOAST_STYLES: Record<ToastType, string> = {
  success: 'bg-zinc-900/95 border-emerald-500/40 text-emerald-100',
  error: 'bg-zinc-900/95 border-rose-500/40 text-rose-100',
  warning: 'bg-zinc-900/95 border-amber-500/40 text-amber-100',
  info: 'bg-zinc-900/95 border-zinc-700 text-zinc-100',
};

function ToastIcon({ type }: { type: ToastType }) {
  switch (type) {
    case 'success':
      return <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />;
    case 'error':
      return <XCircle className="h-5 w-5 shrink-0 text-rose-400" />;
    case 'warning':
      return <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400" />;
    default:
      return <Info className="h-5 w-5 shrink-0 text-zinc-400" />;
  }
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = 'info') => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setToasts((prev) => [...prev.slice(-3), { id, message, type }]);
      window.setTimeout(() => {
        removeToast(id);
      }, 4000);
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        aria-live="polite"
        className="top-safe-toast pointer-events-none fixed inset-x-0 z-50 mx-auto flex w-full max-w-lg flex-col gap-2 px-4"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            onClick={() => removeToast(toast.id)}
            className={`pointer-events-auto flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 shadow-lg backdrop-blur-md transition-all ${TOAST_STYLES[toast.type]}`}
          >
            <ToastIcon type={toast.type} />
            <p className="flex-1 text-sm leading-snug">{toast.message}</p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeToast(toast.id);
              }}
              className="rounded-lg p-0.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
              aria-label="Fechar aviso"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast deve ser usado dentro de ToastProvider.');
  }
  return ctx;
}
