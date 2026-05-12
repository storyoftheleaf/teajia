import { Check, Loader2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { BULK_EDIT_FIELDS } from './config';

type InventoryBulkToolbarProps = {
  selectedCount: number;
  isEditMode: boolean;
  splitView: boolean;
  bulkField: string;
  bulkValue: string;
  isBulkApplying: boolean;
  onBulkFieldChange: (field: string) => void;
  onBulkValueChange: (value: string) => void;
  onApply: () => void;
  onCancel: () => void;
};

export function InventoryBulkToolbar({
  selectedCount,
  isEditMode,
  splitView,
  bulkField,
  bulkValue,
  isBulkApplying,
  onBulkFieldChange,
  onBulkValueChange,
  onApply,
  onCancel,
}: InventoryBulkToolbarProps) {
  const fieldDef = BULK_EDIT_FIELDS.find(f => f.key === bulkField);

  return (
    <AnimatePresence>
      {selectedCount > 0 && isEditMode && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          className={`fixed bottom-nav-gap left-0 mx-auto w-fit z-50 bg-tea-surface border border-tea-border shadow-2xl rounded-xl px-5 py-3 flex items-center gap-4 ${splitView ? 'right-0 md:right-[420px]' : 'right-0'}`}
        >
          <span className="text-xs text-tea-text font-bold">{selectedCount} selected</span>
          <div className="w-px h-5 bg-tea-border" />
          <select
            value={bulkField}
            onChange={(e) => onBulkFieldChange(e.target.value)}
            className="bg-tea-bg border border-tea-border rounded-md text-xs text-tea-text px-2 py-1 outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg"
          >
            {BULK_EDIT_FIELDS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select>
          {fieldDef?.type === 'select' && (
            <select value={bulkValue} onChange={(e) => onBulkValueChange(e.target.value)} className="bg-tea-bg border border-tea-border rounded-md text-xs text-tea-text px-2 py-1 outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg">
              <option value="">Select...</option>
              {fieldDef.options.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          )}
          {fieldDef?.type === 'boolean' && (
            <select value={bulkValue} onChange={(e) => onBulkValueChange(e.target.value)} className="bg-tea-bg border border-tea-border rounded-md text-xs text-tea-text px-2 py-1 outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg">
              <option value="">Select...</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          )}
          <button
            onClick={onApply}
            disabled={!bulkValue || isBulkApplying}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-tea-gold text-tea-bg text-ui-10 font-semibold rounded-lg hover:bg-tea-gold/90 transition-colors disabled:opacity-40"
          >
            {isBulkApplying ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Apply
          </button>
          <button
            onClick={onCancel}
            className="text-ui-10 text-tea-text-sec hover:text-tea-text uppercase tracking-[0.15em] transition-colors"
          >
            Cancel
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
