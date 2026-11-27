import { Button } from '../shared/Button';
import { Bookmark, Camera, Check, Coffee } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * The one strip on the shop's tea page that belongs to the person who bought
 * the tea (Adrian, 2026-11-27: "the shop exactly", plus what is theirs): what
 * they have of it, and the three things to do with it. It sits on top of the
 * same page wherever the tea is opened, from an invoice or in the shop, so
 * there is one tea page. The words are placeholders until Adrian names them.
 */
export function YoursStrip({ line, note, noteBy, kept = false, onTaste, onPhoto, onKeep }: {
  line: string;
  /** The sender's own words about this tea, on a collection link. */
  note?: string | null;
  noteBy?: string;
  kept?: boolean;
  onTaste?: () => void;
  onPhoto?: () => void;
  onKeep?: () => void;
}) {
  const acts = Boolean(onTaste || onPhoto || onKeep);
  return (
    <div className="border-b border-tea-border bg-tea-elevated px-5 py-3 lg:px-10" data-testid="link-tea-top">
      <p className="label-caps text-tea-gold">{line}</p>
      {note?.trim() && (
        <p className="mt-1.5 font-body text-ui-15 italic leading-[1.6] text-tea-text" data-testid="collection-tea-writing">
          “{note.trim()}”{noteBy && <span className="not-italic text-ui-12 text-tea-text-dim">, {noteBy}</span>}
        </p>
      )}
      {acts && (
        <div className="mt-2.5 flex max-w-md flex-wrap gap-2" data-testid="yours-actions">
          {onTaste && <Act onClick={onTaste} icon={<Coffee size={18} aria-hidden="true" />}>Taste</Act>}
          {onPhoto && <Act onClick={onPhoto} icon={<Camera size={18} aria-hidden="true" />}>Photo</Act>}
          {onKeep && (
            <Act onClick={onKeep} pressed={kept} icon={kept ? <Check size={18} aria-hidden="true" /> : <Bookmark size={18} aria-hidden="true" />}>
              {kept ? 'Kept' : 'Keep'}
            </Act>
          )}
        </div>
      )}
    </div>
  );
}

function Act({ onClick, icon, pressed, children }: { onClick: () => void; icon: ReactNode; pressed?: boolean; children: ReactNode }) {
  return (
    <Button
      variant="plain"
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      className="flex min-h-14 min-w-20 flex-1 flex-col items-center justify-center gap-1 rounded-md border border-tea-border bg-tea-bg px-3 py-2 font-sans text-ui-12 text-tea-text transition-colors hover:border-tea-gold focus-visible:border-tea-gold"
    >
      <span className="text-tea-gold">{icon}</span>
      {children}
    </Button>
  );
}
