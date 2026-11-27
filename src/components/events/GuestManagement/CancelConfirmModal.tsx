import React from 'react';
import { AlertCircle } from 'lucide-react';
import { Modal } from '../../shared/Modal';

// ----------------------------------------------------------------
// Cancel Confirmation Modal
// ----------------------------------------------------------------
interface CancelConfirmModalProps {
  attendeeName: string;
  /** A person's table, not a shop's session: the guest says "I can't come". */
  personsTable?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  isPending: boolean;
}

const CancelConfirmModal: React.FC<CancelConfirmModalProps> = ({
  attendeeName,
  personsTable = false,
  onConfirm,
  onClose,
  isPending,
}) => {
  return (
    <Modal
      isOpen
      onClose={onClose}
      title={personsTable ? "You can't come?" : 'Cancel reservation?'}
      variant="center"
      disableBackdropClose
      initialFocus="container"
    >
      <div className="p-6">
        <div className="flex items-start gap-3 mb-5">
          <AlertCircle className="w-5 h-5 text-tea-error mt-0.5 shrink-0" />
          {personsTable ? (
            <p className="body-light">Your seat goes back to the host, so someone else can have it.</p>
          ) : (
            <p className="body-light">
              Are you sure you want to cancel{' '}
              <span className="text-tea-text">{attendeeName}'s</span> reservation?
            </p>
          )}
        </div>

        {/* Footer: Cancel-left ghost, primary-right destructive */}
        <div className="flex justify-between items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 text-xs font-semibold text-tea-text-sec hover:text-tea-text transition-colors"
          >
            Keep my seat
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-md bg-tea-error text-tea-bg text-xs font-semibold hover:bg-tea-error/90 disabled:opacity-50 transition-colors min-w-[140px]"
          >
            {isPending ? (
              <span className="inline-block w-4 h-4 border-2 border-tea-bg/40 border-t-tea-bg rounded-full animate-spin" />
            ) : (
              personsTable ? "I can't come" : 'Cancel reservation'
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default CancelConfirmModal;
