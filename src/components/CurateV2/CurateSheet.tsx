import React from 'react';
import { BottomSheet as SharedBottomSheet, SheetOption } from '../shared/BottomSheet';

/**
 * The shared bottom sheet, dressed for Curate: the title in Cormorant, the
 * subtitle in Lora, rows with dividers instead of tinted tiles. The look lives
 * in card-utilities.css under `.curate-v2-sheet`; the shared sheet itself is
 * unchanged for everything outside Curate.
 */
export const BottomSheet: React.FC<React.ComponentProps<typeof SharedBottomSheet>> = ({ className, ...props }) => (
  <SharedBottomSheet {...props} className={`curate-v2 curate-v2-sheet${className ? ` ${className}` : ''}`} />
);

export { SheetOption };
