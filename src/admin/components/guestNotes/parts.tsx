import React from 'react';
import { Button } from '../../../components/shared/Button';

/**
 * Small pieces the Guest notes screen shares: the same plain text actions and
 * the same status chip the notes list already uses, so the added sections read
 * as part of the one screen.
 */

export function TextAction({
  children, tone = 'gold', ...props
}: React.ComponentPropsWithoutRef<'button'> & { tone?: 'gold' | 'quiet' }) {
  const colour = tone === 'gold'
    ? 'text-tea-gold hover:text-tea-gold-lt'
    : 'text-tea-text-sec hover:text-tea-text';
  return (
    <Button variant="plain" type="button" {...props} className={`tap-target text-ui-12 transition-colors disabled:opacity-50 ${colour}`}>
      {children}
    </Button>
  );
}

export function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-tea-gold/10 px-2 py-0.5 text-ui-10 uppercase tracking-[0.14em] text-tea-text-sec">
      {children}
    </span>
  );
}

export function SectionHeading({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="m-0 font-display text-ui-18 leading-tight text-tea-text">{children}</h2>
      {aside}
    </div>
  );
}

export function dayLabel(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function errorSentence(cause: unknown, fallback: string): string {
  return cause instanceof Error && cause.message ? cause.message : fallback;
}
