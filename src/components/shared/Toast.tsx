import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Icons } from '../Icons';
import { ADMIN_Z_INDEX } from '../../constants/admin';
import type { Toast as ToastType } from '../../hooks/useToast';

interface ToastProps {
  toast: ToastType;
  onDismiss: (id: string) => void;
}

const ToastItem: React.FC<ToastProps> = ({ toast, onDismiss }) => {
  const { id, message, type } = toast;

  const bgColor = {
    success: 'bg-green-600 dark:bg-green-700',
    error: 'bg-red-600 dark:bg-red-700',
    warning: 'bg-yellow-600 dark:bg-yellow-700',
    info: 'bg-blue-600 dark:bg-blue-700',
  }[type];

  const icon = {
    success: <Icons.Check className="w-5 h-5" />,
    error: <Icons.Close className="w-5 h-5" />,
    warning: <span className="text-lg">⚠️</span>,
    info: <span className="text-lg">ℹ️</span>,
  }[type];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 80, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className={`${bgColor} text-white px-4 py-3 rounded-sm shadow-lg flex items-center gap-3 min-w-[280px] max-w-[90vw] md:max-w-md`}
      role="alert"
    >
      <div className="shrink-0">{icon}</div>
      <div className="flex-1 text-sm font-medium">{message}</div>
      <button
        onClick={() => onDismiss(id)}
        className="shrink-0 hover:bg-tea-elevated/20 p-1 rounded-sm transition-colors"
        aria-label="Dismiss notification"
      >
        <Icons.Close className="w-4 h-4" />
      </button>
    </motion.div>
  );
};

interface ToastContainerProps {
  toasts: ToastType[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  return createPortal(
    <div
      className="fixed bottom-20 md:bottom-6 right-4 md:right-6 flex flex-col gap-2"
      style={{ zIndex: ADMIN_Z_INDEX.TOAST }}
      aria-live="polite"
      aria-atomic="true"
      role="status"
    >
      <AnimatePresence mode="popLayout">
        {toasts.map(toast => (
          <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>,
    document.body
  );
};
