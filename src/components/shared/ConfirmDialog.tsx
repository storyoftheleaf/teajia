import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Icons } from '../Icons';
import { useFocusTrap } from '../../hooks/useFocusTrap';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: 'danger' | 'primary';
  requireTyping?: boolean;
  typeToConfirm?: string;
  onConfirm: () => void;
  onCancel: () => void;
  preview?: React.ReactNode;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmVariant = 'primary',
  requireTyping = false,
  typeToConfirm = '',
  onConfirm,
  onCancel,
  preview,
}) => {
  const [typedText, setTypedText] = useState('');
  const trapRef = useFocusTrap<HTMLDivElement>(isOpen);

  if (!isOpen) return null;

  const isTypingValid = !requireTyping || typedText === typeToConfirm;

  const handleConfirm = () => {
    if (!isTypingValid) return;
    onConfirm();
    setTypedText('');
  };

  const handleCancel = () => {
    onCancel();
    setTypedText('');
  };

  const confirmButtonClass =
    confirmVariant === 'danger'
      ? 'bg-red-600 hover:bg-red-700 dark:bg-red-700'
      : 'bg-tea-gold hover:bg-tea-gold/90';

  return createPortal(
    <div
      className="fixed inset-0 z-modal bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]"
      onClick={handleCancel}
    >
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="bg-tea-surface border border-tea-border rounded-xl shadow-lg w-full max-w-md max-h-[90vh] overflow-y-auto animate-[slideUp_0.3s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ boxShadow: '0 1px 0 var(--tea-border)' }}>
          <h2 id="confirm-dialog-title" className="text-xl font-serif text-tea-text">{title}</h2>
          <button
            onClick={handleCancel}
            className="p-2 hover:bg-tea-text/10 rounded-xl transition-colors"
            aria-label="Close dialog"
          >
            <Icons.Close className="w-5 h-5 text-tea-text-sec" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          {preview && (
            <div className="bg-tea-text/5 rounded-xl p-4" style={{ boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.2), inset 0 1px 0 var(--tea-accent-sub)' }}>
              {preview}
            </div>
          )}

          <p className="text-tea-text/80 text-sm leading-relaxed">{message}</p>

          {requireTyping && typeToConfirm && (
            <div>
              <label className="block text-xs uppercase tracking-wider text-tea-text/70 mb-2">
                Type <span className="font-mono font-bold text-tea-text">{typeToConfirm}</span> to
                confirm:
              </label>
              <input
                type="text"
                value={typedText}
                onChange={(e) => setTypedText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && isTypingValid && handleConfirm()}
                className="w-full bg-tea-surface p-3 text-tea-text text-sm outline-none focus:ring-1 focus:ring-tea-gold/20 rounded-xl"
                style={{ boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.2), inset 0 1px 0 var(--tea-accent-sub)' }}
                placeholder={typeToConfirm}
                autoFocus
              />
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between gap-3 px-6 py-4" style={{ boxShadow: 'inset 0 1px 0 var(--tea-accent-sub)' }}>
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-tea-text-sec hover:text-tea-text text-sm uppercase tracking-wider font-medium transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            disabled={!isTypingValid}
            className={`px-6 py-2 ${confirmButtonClass} text-tea-bg text-sm uppercase tracking-wider font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
