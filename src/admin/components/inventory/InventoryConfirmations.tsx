import { AlertOctagon, AlertTriangle, Loader2, RefreshCw, Sparkles, Trash2, X } from 'lucide-react';

type VerificationStats = {
  total: number;
  verified: number;
  remaining: number;
};

type InventoryConfirmationsProps = {
  showEnrichConfirm: boolean;
  onCloseEnrichConfirm: () => void;
  onConfirmEnrich: () => void;
  isEnriching: boolean;
  showVerificationResetConfirm: boolean;
  onCloseVerificationResetConfirm: () => void;
  onConfirmVerificationReset: () => void;
  verificationStats: VerificationStats;
  showResetConfirm: boolean;
  onCloseResetConfirm: () => void;
  resetInput: string;
  onResetInputChange: (value: string) => void;
  isResetting: boolean;
  onConfirmDatabaseReset: () => void;
  showMaintenanceModal: boolean;
  onCloseMaintenanceModal: () => void;
  onOpenDatabaseReset: () => void;
  // Permanent single-product delete (e.g. a mistyped duplicate). Irreversible,
  // so it requires typing "delete" to confirm, same floor as the DB wipe.
  deleteTarget: { id: string; name: string } | null;
  onCloseDeleteConfirm: () => void;
  deleteInput: string;
  onDeleteInputChange: (value: string) => void;
  isDeleting: boolean;
  onConfirmDelete: () => void;
};

export function InventoryConfirmations({
  showEnrichConfirm,
  onCloseEnrichConfirm,
  onConfirmEnrich,
  isEnriching,
  showVerificationResetConfirm,
  onCloseVerificationResetConfirm,
  onConfirmVerificationReset,
  verificationStats,
  showResetConfirm,
  onCloseResetConfirm,
  resetInput,
  onResetInputChange,
  isResetting,
  onConfirmDatabaseReset,
  showMaintenanceModal,
  onCloseMaintenanceModal,
  onOpenDatabaseReset,
  deleteTarget,
  onCloseDeleteConfirm,
  deleteInput,
  onDeleteInputChange,
  isDeleting,
  onConfirmDelete,
}: InventoryConfirmationsProps) {
  return (
    <>
      {showEnrichConfirm && (
        <div className="fixed inset-0 z-modal flex items-center justify-center bg-tea-bg/90 backdrop-blur-sm p-4 animate-in fade-in duration-200" role="presentation">
          <div className="bg-tea-bg border border-tea-border rounded-xl max-w-sm w-full p-6 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="enrich-confirm-title">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl border border-tea-border text-tea-gold bg-tea-accent-sub">
                <Sparkles size={18} />
              </div>
              <div>
                <h3 id="enrich-confirm-title" className="text-lg font-serif text-tea-text">Generate missing wisdom?</h3>
                <p className="mt-2 text-sm text-tea-text-sec">
                  This will generate draft wisdom for teas with no existing lore. You will still review it before publishing.
                </p>
              </div>
            </div>
            <div className="flex justify-between items-center gap-3 pt-6">
              <button onClick={onCloseEnrichConfirm} className="px-1 py-2 text-tea-text-sec hover:text-tea-text transition-colors text-xs uppercase tracking-[0.2em]">Cancel</button>
              <button
                onClick={onConfirmEnrich}
                disabled={isEnriching}
                className="px-4 py-2 cta-solid text-xs font-semibold rounded-md disabled:opacity-40 transition-colors"
              >
                {isEnriching ? 'Generating...' : 'Generate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showVerificationResetConfirm && (
        <div className="fixed inset-0 z-modal flex items-center justify-center bg-tea-bg/90 backdrop-blur-sm p-4 animate-in fade-in duration-200" role="presentation">
          <div className="bg-tea-bg border border-tea-border rounded-xl max-w-sm w-full p-6 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="verification-reset-title">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl border border-tea-border text-tea-gold bg-tea-accent-sub">
                <RefreshCw size={18} />
              </div>
              <div>
                <h3 id="verification-reset-title" className="text-lg font-serif text-tea-text">Reset stock check?</h3>
                <p className="mt-2 text-sm text-tea-text-sec">
                  This clears {verificationStats.verified} verification checkmark{verificationStats.verified !== 1 ? 's' : ''} so the shelf can be checked again.
                </p>
              </div>
            </div>
            <div className="flex justify-between items-center gap-3 pt-6">
              <button onClick={onCloseVerificationResetConfirm} className="px-1 py-2 text-tea-text-sec hover:text-tea-text transition-colors text-xs uppercase tracking-[0.2em]">Cancel</button>
              <button
                onClick={onConfirmVerificationReset}
                className="px-4 py-2 cta-solid text-xs font-semibold rounded-md transition-colors"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {showResetConfirm && (
        <div className="fixed inset-0 z-modal flex items-center justify-center bg-tea-bg/90 backdrop-blur-sm p-4 animate-in fade-in duration-200" role="presentation">
          <div className="bg-tea-bg border border-tea-accent-sub rounded-xl max-w-sm w-full p-8 relative shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="database-wipe-title">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="p-4 rounded-full border border-tea-accent-sub text-tea-gold bg-tea-gold/10">
                {isResetting ? <Loader2 className="animate-spin" size={32} /> : <AlertOctagon size={32} />}
              </div>
              <h3 id="database-wipe-title" className="text-xl font-serif text-tea-text">Danger Zone</h3>
              <p className="text-tea-text-sec text-sm">
                Confirm full database wipe? This is irreversible.
              </p>
              <div className="w-full pt-4">
                <input
                  type="text"
                  className="w-full input-warm rounded-xl p-3 text-center text-tea-gold num text-xs outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg focus:border-tea-gold transition-colors"
                  value={resetInput}
                  onChange={(e) => onResetInputChange(e.target.value)}
                  placeholder='Type "delete" to confirm'
                  aria-label='Type "delete" to confirm database wipe'
                  disabled={isResetting}
                />
              </div>
              <div className="flex gap-3 w-full pt-4">
                <button onClick={onCloseResetConfirm} className="flex-1 py-3 text-tea-text-sec hover:text-tea-text transition-colors text-xs uppercase tracking-[0.2em]" disabled={isResetting}>Cancel</button>
                <button
                  onClick={onConfirmDatabaseReset}
                  disabled={resetInput !== 'delete' || isResetting}
                  className="flex-1 py-3 bg-tea-gold/20 border border-tea-accent-sub text-tea-gold text-xs font-semibold rounded-md hover:bg-tea-gold/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  {isResetting ? 'Deleting...' : 'Confirm Wipe'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-modal flex items-center justify-center bg-tea-bg/90 backdrop-blur-sm p-4 animate-in fade-in duration-200" role="presentation">
          <div className="bg-tea-bg border border-tea-accent-sub rounded-xl max-w-sm w-full p-8 relative shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="product-delete-title">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="p-4 rounded-full border border-tea-accent-sub text-tea-gold bg-tea-gold/10">
                {isDeleting ? <Loader2 className="animate-spin" size={28} /> : <Trash2 size={28} />}
              </div>
              <h3 id="product-delete-title" className="text-xl font-serif text-tea-text">Delete this tea?</h3>
              <p className="text-tea-text-sec text-sm">
                You are about to permanently remove
                {' '}<span className="text-tea-text font-medium">{deleteTarget.name}</span>.
                This cannot be undone. To keep it but hide it from the shop, archive it instead.
              </p>
              <div className="w-full pt-2">
                <input
                  type="text"
                  className="w-full input-warm rounded-xl p-3 text-center text-tea-gold text-xs outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg focus:border-tea-gold transition-colors"
                  value={deleteInput}
                  onChange={(e) => onDeleteInputChange(e.target.value)}
                  placeholder='Type "delete" to confirm'
                  aria-label={`Type "delete" to confirm removing ${deleteTarget.name}`}
                  disabled={isDeleting}
                  autoFocus
                />
              </div>
              <div className="flex gap-3 w-full pt-2">
                <button onClick={onCloseDeleteConfirm} className="flex-1 py-3 text-tea-text-sec hover:text-tea-text transition-colors text-xs uppercase tracking-[0.2em]" disabled={isDeleting}>Cancel</button>
                <button
                  onClick={onConfirmDelete}
                  disabled={deleteInput.trim().toLowerCase() !== 'delete' || isDeleting}
                  className="flex-1 py-3 bg-tea-gold/20 border border-tea-accent-sub text-tea-gold text-xs font-semibold rounded-md hover:bg-tea-gold/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  {isDeleting ? 'Deleting…' : 'Delete permanently'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showMaintenanceModal && (
        <div className="fixed inset-0 z-modal flex items-center justify-center bg-tea-bg/90 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="bg-tea-bg border border-tea-border w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" role="dialog" aria-modal="true" aria-labelledby="inventory-maintenance-title">
            <div className="p-6 border-b border-tea-border flex justify-between items-center bg-tea-surface">
              <div className="flex items-center gap-3">
                <div className="p-2 border border-tea-accent-sub text-tea-gold rounded-xl bg-tea-gold/10">
                  <AlertTriangle size={16} />
                </div>
                <h3 id="inventory-maintenance-title" className="text-lg font-serif text-tea-text">Inventory Maintenance</h3>
              </div>
              <button onClick={onCloseMaintenanceModal} className="tap-target text-tea-text-sec hover:text-tea-text transition-colors" aria-label="Close maintenance">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-5">
              <section className="border border-tea-border rounded-xl p-4">
                <h4 className="text-sm font-serif text-tea-text">Import and export</h4>
                <p className="mt-1 text-sm text-tea-text-sec">CSV tools remain in the actions menu because they are routine inventory work.</p>
              </section>
              <section className="border border-tea-border rounded-xl p-4">
                <h4 className="text-sm font-serif text-tea-text">Database wipe</h4>
                <p className="mt-1 text-sm text-tea-text-sec">This is owner-only and irreversible. Keep it out of routine command flow.</p>
                <button
                  onClick={onOpenDatabaseReset}
                  className="mt-4 text-xs uppercase tracking-[0.18em] text-tea-text-sec hover:text-tea-gold transition-colors"
                >
                  Open wipe confirmation
                </button>
              </section>
            </div>
            <div className="p-4 border-t border-tea-border flex justify-end bg-tea-surface">
              <button
                onClick={onCloseMaintenanceModal}
                className="px-6 py-2 cta-solid text-xs font-semibold rounded-md transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
