import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

// Hoisted to module scope — defining this inside EditForm gave it a new
// component identity every render, remounting its whole subtree.
export const SectionHeader = ({
  label,
  count,
  isOpen,
  onToggle,
}: {
  label: string;
  count?: number;
  isOpen: boolean;
  onToggle: () => void;
}) => (
  <button
    type="button"
    onClick={onToggle}
    aria-expanded={isOpen}
    className="w-full flex items-center justify-between py-3 text-sm text-tea-text-sec hover:text-tea-text transition-colors"
  >
    <span className="flex items-center gap-2.5">
      <span className="label-caps text-tea-text-sec">{label}</span>
      {count !== undefined && count > 0 && (
        <span className="text-ui-10 font-mono text-tea-text-dim">{count}</span>
      )}
    </span>
    {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
  </button>
);

export default SectionHeader;
