import { Button } from '../shared/Button';
import { AnimatePresence } from 'framer-motion';
import { TastingSession } from '../tasting/TastingSession';
import type { InventoryItem } from '../../types';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Check, X } from 'lucide-react';

/**
 * The row of pictures a private link shows under its head (an invoice's pay
 * sheet, a /c/ collection): what comes next, in order, each a button, the one
 * the person is at lit (Adrian, 2026-11-27: "visual guide, not reading
 * paragraphs").
 */
export function GuideRow({ testId, error, children }: { testId: string; error?: string | null; children: ReactNode }) {
  return (
    <nav aria-label="What comes next" className="mt-3" data-testid={testId}>
      <ol className="relative mx-auto flex max-w-md flex-wrap items-start justify-between">
        <li aria-hidden="true" className="absolute inset-x-10 top-6 border-t border-tea-border" />
        {children}
      </ol>
      {error && <p role="alert" className="mt-2 text-center font-sans text-ui-12 text-tea-text-sec">{error}</p>}
    </nav>
  );
}

export function GuideStep({ label, icon, done = false, lit = false, disabled = false, onClick, to, testId }: {
  label: string;
  icon: ReactNode;
  done?: boolean;
  lit?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  to?: string;
  testId: string;
}) {
  const ring = done
    ? 'cta-solid border-tea-gold'
    : lit
      ? 'border-tea-gold bg-tea-accent-sub text-tea-gold'
      : 'border-tea-border bg-tea-bg text-tea-text-sec group-hover:border-tea-gold';
  const body = (
    <>
      <span className={`flex h-12 w-12 items-center justify-center rounded-full border transition-colors ${ring}`}>
        {done ? <Check size={20} aria-hidden="true" /> : icon}
      </span>
      <span className={`font-sans text-ui-12 ${lit || done ? 'text-tea-text' : 'text-tea-text-sec'}`}>{label}</span>
    </>
  );
  const shape = 'group relative flex w-20 flex-col items-center gap-1.5';
  return (
    <li className="relative" data-testid={testId} data-state={done ? 'done' : lit ? 'lit' : 'ahead'}>
      {to
        ? <Link to={to} className={shape}>{body}</Link>
        : <Button variant="plain" type="button" onClick={onClick} disabled={disabled} aria-current={lit ? 'step' : undefined} className={shape}>{body}</Button>}
    </li>
  );
}

/** Taste was tapped on the guide: the list asks which tea, and the next one opened goes to its tasting. */
export function ChooseTeaLine({ onCancel }: { onCancel?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-tea-gold bg-tea-accent-sub px-4 py-2" role="status" data-testid="taste-choose">
      <span className="font-display text-ui-18 text-tea-text">Which one are you drinking?</span>
      <Button variant="plain" type="button" onClick={onCancel} aria-label="Not now" className="tap-target inline-flex items-center justify-center text-tea-text-sec hover:text-tea-text"><X size={16} /></Button>
    </div>
  );
}

/**
 * The tasting, opened straight over the list of a link's teas: pick the tea,
 * taste, and saving or closing leaves the person on the list where they were
 * (Adrian, 2026-11-27).
 */
export function ListTasting({ tea, onClose }: { tea: InventoryItem | null; onClose: () => void }) {
  return (
    <AnimatePresence>
      {tea && <TastingSession item={{ ...tea, sourceType: 'product' }} startOnNotes onClose={onClose} onOrderTea={onClose} />}
    </AnimatePresence>
  );
}
