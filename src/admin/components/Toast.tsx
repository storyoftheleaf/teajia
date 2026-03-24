import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

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
      <div className="fixed bottom-6 right-6 z-toast flex flex-col gap-3 pointer-events-none" aria-live="polite" aria-atomic="true" role="status">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto min-w-[240px] p-4 rounded-xl shadow-2xl flex items-center gap-3 border animate-in slide-in-from-right-full duration-300 fade-in ${
              t.type === 'success'
                ? 'bg-tea-surface border-tea-accent-sub text-tea-text'
                : t.type === 'error'
                ? 'bg-tea-surface border-tea-accent-sub text-tea-accent'
                : 'bg-tea-surface border-tea-accent-sub text-tea-text'
            }`}
          >
            {t.type === 'success' && <CheckCircle size={16} />}
            {t.type === 'error' && <AlertCircle size={16} />}
            {t.type === 'info' && <Info size={16} />}
            <span className="text-xs font-medium tracking-wide font-sans">{t.message}</span>
            {t.action && (
              <button
                onClick={() => { t.action!.onClick(); setToasts((prev) => prev.filter((x) => x.id !== t.id)); }}
                className="ml-auto text-[10px] font-bold uppercase tracking-[0.15em] text-tea-accent hover:text-tea-text transition-colors px-2 py-0.5"
              >
                {t.action.label}
              </button>
            )}
            <button
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
              className={`${t.action ? '' : 'ml-auto '}opacity-50 hover:opacity-100 transition-opacity`}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};