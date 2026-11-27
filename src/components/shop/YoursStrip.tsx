import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../shared/Button';

export interface YoursStripNav {
  /** Where this tea sits among the link's teas, counted from 1. */
  index: number;
  count: number;
  onPrev?: () => void;
  onNext?: () => void;
}

/**
 * The one line under the tea page's own bar that belongs to the person it was
 * opened for: what they have of it on an invoice or in the shop, or the
 * collection it was chosen in, with the sender's words. On a link with more
 * than one tea it is also how they move through the others, one arrow each
 * way (Adrian, 2026-11-27: "maybe it's how you navigate through the other
 * samples"). It is drawn as the page's own bar is, with no fill of its own,
 * and everything under it is the live shop page, untouched.
 */
export function YoursStrip({ line, note, noteBy, nav }: {
  line: string;
  /** The sender's own words about this tea, on a collection link. */
  note?: string | null;
  noteBy?: string;
  nav?: YoursStripNav;
}) {
  const moves = nav && nav.count > 1 ? nav : undefined;
  const arrow = 'btn-quiet btn-sm tap-target shrink-0 disabled:opacity-30';
  return (
    <div className="border-b border-tea-border px-5 py-1.5 lg:px-10" data-testid="link-tea-top">
      <div className="flex items-center justify-between gap-3">
        {moves && (
          <Button variant="plain" type="button" onClick={moves.onPrev} disabled={!moves.onPrev} aria-label="The tea before" className={arrow} data-testid="link-tea-prev">
            <ChevronLeft size={16} aria-hidden="true" />
          </Button>
        )}
        <p className={`min-w-0 flex-1 label-caps text-tea-text-sec ${moves ? 'text-center' : ''}`}>
          {line}
          {moves && <span className="whitespace-nowrap text-tea-gold tabular-nums" data-testid="link-tea-place"> · {moves.index} of {moves.count}</span>}
        </p>
        {moves && (
          <Button variant="plain" type="button" onClick={moves.onNext} disabled={!moves.onNext} aria-label="The tea after" className={arrow} data-testid="link-tea-next">
            <ChevronRight size={16} aria-hidden="true" />
          </Button>
        )}
      </div>
      {note?.trim() && (
        <p className={`mx-auto mb-1.5 mt-0.5 max-w-[64ch] font-body text-ui-15 italic leading-[1.6] text-tea-text-sec ${moves ? 'text-center' : ''}`} data-testid="collection-tea-writing">
          “{note.trim()}”{noteBy && <span className="not-italic text-ui-12 text-tea-text-dim"> {noteBy}</span>}
        </p>
      )}
    </div>
  );
}
