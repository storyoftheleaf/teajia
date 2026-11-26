import React from 'react';
import { Button } from '../../../../components/shared/Button';

// The open tea as one long page, in the order Adrian edits (2026-11-26): what is
// missing, the tea itself (photos, name and year, type, form, origin), price,
// stock, where it is listed, and then the later work (tasting, story, tools).
// A bar at the top jumps to each part, and the part last jumped to is where the
// next tea opens, so going through every tea's price is one press per tea.
// The rows are Curate's rows (curate-v2-line / curate-v2-label), so a tea reads
// the same here as it does in Curate.

export const TEA_PAGE_SECTIONS = [
  ['tea', 'The tea'], ['price', 'Price'], ['stock', 'Stock'], ['listed', 'Listed'], ['later', 'Later'],
] as const;
export type TeaPageSection = typeof TEA_PAGE_SECTIONS[number][0];

export const teaSectionId = (section: TeaPageSection) => `tea-page-${section}`;

/** The old room tabs, still sent by the Stock list's right-click menu, mapped to the part of the page they meant. */
export const ROOM_TAB_TO_SECTION: Record<string, TeaPageSection> = {
  shelf: 'tea', details: 'tea', money: 'price', story: 'later', links: 'listed',
};

export const sectionLabel = (section: TeaPageSection) =>
  TEA_PAGE_SECTIONS.find(([id]) => id === section)?.[1] ?? 'The tea';

export function TeaJumpBar({ value, marked, onJump }: {
  value: TeaPageSection | null;
  /** Parts with something missing get a small mark. */
  marked: Partial<Record<TeaPageSection, boolean>>;
  onJump: (section: TeaPageSection) => void;
}) {
  return <nav aria-label="Parts of this tea" data-testid="tea-page-jump" className="tea-page-jump">
    {TEA_PAGE_SECTIONS.map(([id, label]) => <Button variant="plain" key={id} type="button" aria-current={value === id ? 'true' : undefined}
      onClick={() => onJump(id)}>
      {label}{marked[id] && <span className="tea-page-mark"><span className="sr-only">, needs something</span></span>}
    </Button>)}
  </nav>;
}

export function TeaSection({ section, title, aside, children }: {
  section: TeaPageSection; title?: string; aside?: React.ReactNode; children: React.ReactNode;
}) {
  const name = title ?? sectionLabel(section);
  return <section id={teaSectionId(section)} aria-label={name} className="tea-page-section">
    <div className="tea-page-head">
      <h4 className="font-display text-ui-22 text-admin-text leading-none">{name}</h4>
      {aside}
    </div>
    {children}
  </section>;
}

/** One Curate row: what it is on the left, the value typed or shown on the right. */
export function TeaLine({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return <div className={`curate-v2-line tea-page-line ${className}`}>
    <span className="curate-v2-label">{label}</span>
    <div className="tea-page-value">{children}</div>
  </div>;
}

export interface MissingItem { key: string; label: string; section: TeaPageSection }

export function TeaMissing({ items, onJump }: { items: MissingItem[]; onJump: (section: TeaPageSection) => void }) {
  if (items.length === 0) return null;
  return <div role="group" aria-label="What's missing" data-testid="tea-page-missing" className="tea-page-missing">
    <span className="curate-v2-label">What's missing</span>
    {items.map(item => <Button variant="plain" key={item.key} type="button" onClick={() => onJump(item.section)}>
      <span>{item.label}</span><span className="curate-v2-label">Jump</span>
    </Button>)}
  </div>;
}
