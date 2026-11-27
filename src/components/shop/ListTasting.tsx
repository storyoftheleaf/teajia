import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { TastingSession } from '../tasting/TastingSession';
import { Button } from '../shared/Button';
import { TeaCup } from '../TeaCupIcon';
import type { InventoryItem } from '../../types';

/**
 * The tasting opened from a tea's row on a link, without going into the tea
 * (Adrian, 2026-11-27: "so they don't have to click into the description to do
 * the tasting"). Signed out, the tasting shows behind one card that asks them
 * to log in or make an account, with the teas that come with them; joining
 * brings them back here with the tasting open.
 */
export function ListTasting({ item, signedIn, teas, onClose, onJoin }: {
  item: InventoryItem;
  signedIn: boolean;
  /** The link's teas, shown on the card as what the account will hold. */
  teas: readonly { name: string; amount?: string }[];
  onClose: () => void;
  onJoin: (mode: 'signup' | 'signin') => void;
}) {
  useEffect(() => {
    if (signedIn) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [signedIn, onClose]);

  if (signedIn) {
    return <TastingSession item={{ ...item, sourceType: 'product' }} startOnNotes onClose={onClose} />;
  }
  return (
    <>
      <TastingSession previewOnly className="pointer-events-none" item={{ ...item, sourceType: 'product' }} onClose={onClose} />
      {createPortal(
        <div className="fixed inset-0 z-takeover flex items-center justify-center bg-tea-bg/70 px-4" onClick={onClose} data-testid="taste-join">
          <div role="dialog" aria-modal="true" aria-labelledby="taste-join-title" onClick={event => event.stopPropagation()}
            className="w-full max-w-sm rounded-md border border-tea-border bg-tea-elevated px-5 py-5 shadow-lg">
            <TeaCup size={22} strokeWidth={1.5} className="text-tea-gold" aria-hidden="true" />
            <h2 id="taste-join-title" className="mt-2 font-display text-ui-22 leading-tight text-tea-text">
              Log in or create an account to make and save your tasting
            </h2>
            {teas.length > 0 && (
              <ul className="mt-3 border-t border-tea-border">
                {teas.map((tea, index) => (
                  <li key={`${tea.name}-${index}`} className="flex items-baseline justify-between gap-3 border-b border-tea-border py-2">
                    <span className="min-w-0 truncate font-body text-ui-14 text-tea-text">{tea.name}</span>
                    {tea.amount && <span className="num shrink-0 text-ui-12 tabular-nums text-tea-text-sec">{tea.amount}</span>}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <Button variant="plain" type="button" onClick={onClose} className="tap-target font-sans text-ui-13 text-tea-text-sec hover:text-tea-text">Cancel</Button>
              <span className="flex flex-wrap items-center gap-2">
                <Button variant="secondary" type="button" onClick={() => onJoin('signin')} className="tap-target" data-testid="taste-join-signin">Log in</Button>
                <Button variant="primary" type="button" onClick={() => onJoin('signup')} className="tap-target" data-testid="taste-join-signup">Create account</Button>
              </span>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
