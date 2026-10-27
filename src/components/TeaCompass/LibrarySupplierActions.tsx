import React, { useState } from 'react';
import { Pencil } from 'lucide-react';
import { SupplierSheet } from '../shared/SupplierSheet';

interface LibrarySupplierActionsProps {
  supplierId?: string | null;
  supplierName: string;
  onRenamed?: (newName: string) => void;
  disabled?: boolean;
}

/** Edits the shared supplier record; this never reassigns an individual tea. */
export const LibrarySupplierActions: React.FC<LibrarySupplierActionsProps> = ({
  supplierId, supplierName, onRenamed, disabled = false,
}) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        aria-label={`Edit supplier ${supplierName}`}
        aria-haspopup="dialog"
        title="Edit this supplier's shared name and details"
        onClick={(event) => { event.stopPropagation(); setOpen(true); }}
        className="tap-target library-supplier-edit shrink-0 text-ui-11 text-tea-text-sec hover:text-tea-text disabled:opacity-50"
      >
        <Pencil size={16} aria-hidden="true" />
      </button>
      {open && !disabled && (
        <SupplierSheet
          vendorId={supplierId}
          vendorName={supplierName}
          open
          onClose={() => setOpen(false)}
          onRenamed={onRenamed}
        />
      )}
    </>
  );
};
