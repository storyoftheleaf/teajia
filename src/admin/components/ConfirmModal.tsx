import React from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'destructive';
  isLoading?: boolean;
  children?: React.ReactNode;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen, onClose, onConfirm, title, description,
  confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  variant = 'default', isLoading = false, children,
}) => {
  if (!isOpen) return null;

  const isDestructive = variant === 'destructive';

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-tea-bg border border-tea-border rounded-xl w-full max-w-md p-6 shadow-2xl relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-tea-text-sec hover:text-tea-text transition-colors" aria-label="Close">
          <X size={20} />
        </button>

        <div className="flex items-start gap-3 mb-4">
          {isDestructive && (
            <div className="p-2 bg-tea-gold/10 rounded-full border border-tea-border shrink-0 mt-0.5">
              <AlertTriangle size={18} className="text-tea-gold" />
            </div>
          )}
          <div>
            <h3 className="text-lg font-serif text-tea-text">{title}</h3>
            {description && <p className="text-sm text-tea-text-sec mt-1">{description}</p>}
          </div>
        </div>

        {children && <div className="mb-6">{children}</div>}

        <div className="flex justify-between gap-3 pt-4 border-t border-tea-border">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-sm text-tea-text-sec hover:text-tea-text transition-colors rounded-lg hover:bg-tea-surface"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-5 py-2 text-sm font-medium rounded-lg transition-all flex items-center gap-2 ${
              isDestructive
                ? 'bg-tea-surface text-tea-text hover:bg-tea-elevated border border-tea-border'
                : 'bg-tea-gold text-tea-bg hover:bg-tea-gold/90 shadow-lg shadow-tea-gold/10'
            } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isLoading && <span className="animate-spin inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
