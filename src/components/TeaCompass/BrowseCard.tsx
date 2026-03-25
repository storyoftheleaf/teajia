import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Pencil, Trash2, Store } from 'lucide-react';
import { TEA_TYPE_COLORS } from '../../designTokens';
import { useTeaCompassStore } from '../../lib/teaCompassStore';
import type { TeaCompassEntry } from './types';

export interface BrowseCardProps {
  entry: TeaCompassEntry;
  onEdit: (id: string) => void;
  expanded: boolean;
  onToggleExpand: () => void;
}

/** Currency symbol map for compass entries */
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  NT: 'NT$',
  Yuan: '\u00a5',
  IDR: 'Rp',
  JPY: '\u00a5',
  MYR: 'RM',
  HKD: 'HK$',
  UNK: '',
};

export function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${Math.floor(diffHours)}h ago`;
  if (diffDays < 2) return 'Yesterday';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function getDateGroup(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const entryDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = (today.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24);

  if (diffDays < 1) return 'Today';
  if (diffDays < 2) return 'Yesterday';
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function formatPrice(amount: number, currency: string): string {
  const symbol = CURRENCY_SYMBOLS[currency] || '';
  if (['IDR', 'JPY', 'NT'].includes(currency)) {
    return `${symbol}${Math.round(amount).toLocaleString()}`;
  }
  return `${symbol}${amount.toFixed(2)}`;
}

function getStatusConfig(status: string): { label: string; className: string } {
  switch (status) {
    case 'want':
      return { label: 'Want', className: 'badge-status badge-status-amber' };
    case 'bought':
      return { label: 'Bought', className: 'badge-status badge-status-gold' };
    case 'buying':
      return { label: 'Buying', className: 'badge-status badge-status-green' };
    case 'passed':
      return { label: 'Passed', className: 'badge-status badge-status-red' };
    case 'logged':
    default:
      return { label: 'Logged', className: 'badge-status badge-status-muted' };
  }
}

function getTeaTypeBadgeStyle(type: string): React.CSSProperties {
  const color = TEA_TYPE_COLORS[type as keyof typeof TEA_TYPE_COLORS]?.card ?? '#737373';
  return {
    backgroundColor: `${color}20`,
    color,
  };
}

export const BrowseCard: React.FC<BrowseCardProps> = ({
  entry,
  onEdit,
  expanded,
  onToggleExpand,
}) => {
  const removeEntry = useTeaCompassStore((s) => s.removeEntry);
  const statusConfig = getStatusConfig(entry.status);
  const hasName = entry.name.trim().length > 0;

  const hasTasting = entry.tasting && (
    (entry.tasting.flavor && entry.tasting.flavor.length > 0) ||
    (entry.tasting.body && entry.tasting.body.length > 0) ||
    (entry.tasting.finish && entry.tasting.finish.length > 0)
  );

  const tastingNotes = React.useMemo(() => {
    if (!entry.tasting) return [];
    const notes: string[] = [];
    if (entry.tasting.flavor) notes.push(...entry.tasting.flavor);
    if (entry.tasting.body) notes.push(...entry.tasting.body);
    if (entry.tasting.finish) notes.push(...entry.tasting.finish);
    return notes.slice(0, 6);
  }, [entry.tasting]);

  const metaTags = React.useMemo(() => {
    const tags: string[] = [];
    if (entry.type) tags.push(entry.type);
    if (entry.form) tags.push(entry.form);
    if (entry.year) tags.push(String(entry.year));
    if (entry.season) tags.push(entry.season);
    if (entry.storage) tags.push(entry.storage);
    if (entry.originRegion) tags.push(entry.originRegion);
    return tags;
  }, [entry.type, entry.form, entry.year, entry.season, entry.storage, entry.originRegion]);

  return (
    <div className="bg-tea-surface border border-tea-border rounded-md overflow-hidden transition-colors duration-150">
      {/* Collapsed row -- always visible */}
      <button
        type="button"
        onClick={onToggleExpand}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-tea-elevated/30 transition-colors duration-150"
      >
        {/* Name */}
        <span
          className={`flex-1 min-w-0 truncate text-sm font-sans ${
            hasName ? 'text-tea-text' : 'text-tea-text-dim italic'
          }`}
        >
          {hasName ? entry.name : 'Untitled'}
        </span>

        {/* Type badge */}
        {entry.type && (
          <span
            className="badge-status shrink-0"
            style={getTeaTypeBadgeStyle(entry.type)}
          >
            {entry.type}
          </span>
        )}

        {/* Status badge */}
        <span className={`${statusConfig.className} shrink-0`}>
          {statusConfig.label}
        </span>

        {/* Price */}
        {entry.priceAmount != null && entry.priceAmount > 0 && (
          <span className="text-xs num text-tea-gold shrink-0">
            {formatPrice(entry.priceAmount, entry.priceCurrency)}
          </span>
        )}

        {/* Date */}
        <span className="text-xs text-tea-text-dim shrink-0 tabular-nums">
          {formatRelativeDate(entry.createdAt)}
        </span>

        {/* Expand chevron */}
        <motion.span
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="shrink-0 text-tea-text-dim"
        >
          <ChevronDown size={14} />
        </motion.span>
      </button>

      {/* Expanded content */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-1 space-y-3 border-t border-tea-border">
              {/* Chinese name */}
              {entry.chineseName && (
                <p className="text-sm text-tea-text-sec font-chinese">
                  {entry.chineseName}
                </p>
              )}

              {/* Metadata tags */}
              {metaTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {metaTags.map((tag) => (
                    <span key={tag} className="tag">
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Notes preview */}
              {entry.notes.trim().length > 0 && (
                <p className="text-xs text-tea-text-sec leading-relaxed line-clamp-2">
                  {entry.notes}
                </p>
              )}

              {/* Tasting profile strip */}
              {hasTasting && tastingNotes.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {tastingNotes.map((note) => (
                    <span
                      key={note}
                      className="tag text-[10px]"
                    >
                      {note}
                    </span>
                  ))}
                </div>
              )}

              {/* Vendor */}
              {entry.vendorName && (
                <div className="flex items-center gap-1.5 text-xs text-tea-text-dim">
                  <Store size={12} />
                  <span>{entry.vendorName}</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(entry.id);
                  }}
                  className="pill-active flex items-center gap-1.5"
                >
                  <Pencil size={12} />
                  Edit
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm('Remove this entry?')) {
                      removeEntry(entry.id);
                    }
                  }}
                  className="text-xs text-tea-text-dim hover:text-red-400 transition-colors duration-150 cursor-pointer"
                >
                  <span className="flex items-center gap-1">
                    <Trash2 size={11} />
                    Delete
                  </span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BrowseCard;
