import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Product, ExchangeRate } from '../../types';
import { QuickEditFields } from './QuickEditFields';

export interface QuickEditInlineRowProps {
  product: Product;
  /** True when this product's row is the expanded one. */
  expanded: boolean;
  /** Column count to span — match the col array the parent row used. */
  colSpan: number;
  onUpdate: (id: string, field: keyof Product, value: any) => void;
  onTasting: (product: Product) => void;
  onFullEdit: (product: Product) => void;
  rates: ExchangeRate[];
}

// The inline quick-edit panel rendered as an extra full-width table row
// directly under the long-pressed product row. Restores the old
// expand-under-the-tea feel: the panel slides down (height 0 -> auto) inside a
// colSpan'd td that sits outside the table-fixed grid, so it never disturbs the
// fixed column layout above it. Only ever rendered for the single expanded row.
function QuickEditInlineRowBase({
  product, expanded, colSpan, onUpdate, onTasting, onFullEdit, rates,
}: QuickEditInlineRowProps) {
  return (
    <tr aria-hidden={!expanded} className="border-b-0">
      <td colSpan={colSpan} className="p-0 align-top">
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 0.61, 0.36, 1] }}
              className="overflow-hidden"
            >
              <QuickEditFields
                product={product}
                onUpdate={onUpdate}
                onTasting={onTasting}
                onFullEdit={onFullEdit}
                rates={rates}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </td>
    </tr>
  );
}

export const QuickEditInlineRow = React.memo(QuickEditInlineRowBase);
