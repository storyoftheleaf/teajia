import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { Button } from '../../components/shared/Button';

type ToastType = 'success' | 'error' | 'info';

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  action?: ToastAction;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType, options?: { action?: ToastAction; duration?: number }) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info', options?: { action?: ToastAction; duration?: number }) => {
    const id = Math.random().toString(36).substring(7);
    setToasts((prev) => [...prev, { id, type, message, action: options?.action }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, options?.duration ?? 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed inset-x-4 z-toast flex flex-col items-end gap-3 pointer-events-none bottom-nav-gap lg:bottom-6 lg:right-6" aria-live="polite" aria-atomic="true" role="status">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto w-full max-w-sm p-4 rounded-xl shadow-2xl flex flex-wrap items-center gap-3 border animate-in fade-in duration-300 ${
              t.type === 'success'
                ? 'bg-tea-surface border-tea-accent-sub text-tea-text'
                : t.type === 'error'
                ? 'bg-tea-surface border-tea-accent-sub text-tea-gold'
                : 'bg-tea-surface border-tea-accent-sub text-tea-text'
            }`}
          >
            {t.type === 'success' && <CheckCircle size={16} />}
            {t.type === 'error' && <AlertCircle size={16} />}
            {t.type === 'info' && <Info size={16} />}
            <span className="min-w-0 flex-1 break-words text-xs font-medium tracking-wide font-sans">{t.message}</span>
            {t.action && (
              <Button variant="plain" type="button"
                onClick={() => { t.action!.onClick(); setToasts((prev) => prev.filter((x) => x.id !== t.id)); }}
                className="tap-target ml-auto text-ui-10 font-bold uppercase tracking-[0.15em] text-tea-gold hover:text-tea-text transition-colors px-2"
              >
                {t.action.label}
              </Button>
            )}
            <Button variant="icon" type="button" aria-label="Dismiss notice"
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
              className="tap-target shrink-0"
            >
              <X size={14} />
            </Button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

/**
 * Soft-fallback toast. When no ToastProvider is in the tree (admin components
 * opened from the public shop as admin), log to console for success/info and
 * surface a visible alert for errors so silent failures don't hide.
 */
const fallbackToast: ToastContextType = {
  showToast: (msg, kind = 'info') => {
    if (kind === 'error' && typeof window !== 'undefined') {
      // eslint-disable-next-line no-alert
      window.alert(`⚠ ${msg}`);
      return;
    }
    // eslint-disable-next-line no-console
    console.info(`[toast:${kind}] ${msg}`);
  },
};

export const useToast = () => {
  return useContext(ToastContext) ?? fallbackToast;
};
