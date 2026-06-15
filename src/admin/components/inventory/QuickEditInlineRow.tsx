import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Product, ExchangeRate } from '../../types';
import { QuickEditFields, type QuickEditColumn } from './QuickEditFields';

export interface QuickEditInlineRowProps {
  product: Product;
  /** True when this product's row is the expanded one. */
  expanded: boolean;
  /** The visible columns (key + width class), in order, so the editors align
   *  to the columns above. */
  cols: QuickEditColumn[];
  /** Column count to span — match the col array the parent row used. */
  colSpan: number;
  onUpdate: (id: string, field: keyof Product, value: any) => void;
  onTasting: (product: Product) => void;
  onFullEdit: (product: Product) => void;
  rates: ExchangeRate[];
  /** Collapses the panel (parent sets expandedRowId to null). */
  onClose?: () => void;
}

// The inline quick-edit panel rendered as an extra full-width table row directly
// under the long-pressed product row. It slides down (height 0 -> auto) inside a
// colSpan'd td so the animation stays smooth, and INSIDE that td it lays out a
// nested table-fixed grid mirroring the parent's column widths — so each editor
// sits directly under its real column (Stock under Stock, Year under Year).
function QuickEditInlineRowBase({
  product, expanded, cols, colSpan, onUpdate, onTasting, onFullEdit, rates, onClose,
}: QuickEditInlineRowProps) {
  return (
    <tr aria-hidden={!expanded} className="border-b-0">
      <td colSpan={colSpan} className="p-0 align-top">
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              data-quick-edit="true"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 0.61, 0.36, 1] }}
              className="overflow-hidden"
            >
              <QuickEditFields
                product={product}
                cols={cols}
                onUpdate={onUpdate}
                onTasting={onTasting}
                onFullEdit={onFullEdit}
                rates={rates}
                onClose={onClose}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </td>
    </tr>
  );
}

export const QuickEditInlineRow = React.memo(QuickEditInlineRowBase);
