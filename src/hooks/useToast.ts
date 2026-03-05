import { useState, useCallback } from 'react';
import { TIMING } from '../constants/admin';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

export const useToast = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((message: string, type: ToastType = 'info', duration = TIMING.TOAST_DURATION_MS) => {
    const id = Math.random().toString(36).substring(7);
    const toast: Toast = { id, message, type, duration };

    setToasts(prev => [...prev, toast]);

    if (duration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, duration);
    }

    return id;
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const dismissAll = useCallback(() => {
    setToasts([]);
  }, []);

  return {
    toasts,
    show,
    dismiss,
    dismissAll,
    showSuccess: useCallback((message: string, duration?: number) => show(message, 'success', duration), [show]),
    showError: useCallback((message: string, duration?: number) => show(message, 'error', duration), [show]),
    showWarning: useCallback((message: string, duration?: number) => show(message, 'warning', duration), [show]),
    showInfo: useCallback((message: string, duration?: number) => show(message, 'info', duration), [show]),
  };
};
