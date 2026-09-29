import React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

// The pieces of the card-and-rows editor. Rules in docs/CONTRIBUTOR_EDITOR.md:
// a row is words, never a box; a sheet is a plain panel over the card with its
// close X on the left; nothing here carries bronze at full strength.

export type SheetId = 'words' | 'hands' | 'reach' | 'belong' | 'behind';

/**
 * One part of the page as a single line: its name, what is in it, and a state
 * word on the right. The whole line opens that part.
 */
export function EditorRow({ id, title, description, state, needed = false, thumbs, onOpen }: {
  id: SheetId;
  title: string;
  description: string;
  state: string;
  needed?: boolean;
  thumbs?: string[];
  onOpen: (id: SheetId, from: HTMLButtonElement) => void;
}) {
  return (
    <button
      type="button"
      data-testid={`row-${id}`}
      aria-haspopup="dialog"
      onClick={event => onOpen(id, event.currentTarget)}
      className="group grid min-h-[4rem] w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-5 gap-y-1 border-t border-tea-border py-4 text-left last:border-b"
    >
      <span className="font-display text-ui-26 font-light leading-tight text-tea-text transition-colors group-hover:text-tea-gold-lt">{title}</span>
      <span className="col-start-1 font-body text-ui-14 italic leading-snug text-tea-text-sec">{description}</span>
      <span className={`col-start-2 row-span-2 row-start-1 flex items-center gap-2 font-sans text-ui-12 ${needed ? 'text-tea-text' : 'text-tea-text-dim'}`}>
        {thumbs && thumbs.length > 0 && (
          <span aria-hidden className="hidden gap-1 sm:flex">
            {thumbs.map(src => <img key={src} src={src} alt="" className="h-8 w-[26px] object-cover" />)}
          </span>
        )}
        {state}
      </span>
    </button>
  );
}

/**
 * A part of the page opened over the card: from the right on a wide screen,
 * from the bottom on a phone. It stays mounted while closed, so an upload in
 * flight or a pasted photo keeps landing. In the shop's panel it sits between
 * the header and the footer so Save stays in reach; on an ordinary page
 * ('page') it covers the screen and ends with Done, which goes back to Save.
 */
export function EditorSheet({ id, title, note, open, onClose, children, mode = 'panel' }: {
  id: SheetId;
  title: string;
  note?: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  mode?: 'panel' | 'page';
}) {
  const sheet = (
    <div hidden={!open} className={mode === 'page' ? 'fixed inset-0 z-modal' : 'absolute inset-0 z-10'} data-testid={`sheet-${id}`}>
      <div className="absolute inset-0 bg-tea-bg/80" aria-hidden onClick={onClose} />
      <section
        role="dialog"
        aria-labelledby={`sheet-${id}-title`}
        className="absolute inset-x-0 bottom-0 top-6 flex flex-col rounded-t-xl border-t border-tea-border bg-tea-bg lg:inset-y-0 lg:left-auto lg:right-0 lg:w-[480px] lg:rounded-none lg:border-l lg:border-t-0"
      >
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-tea-border px-3 sm:px-5">
          <button id={`sheet-${id}-close`} type="button" onClick={onClose} aria-label={`Close ${title}`} className="tap-target rounded-md p-2 text-tea-text-sec hover:text-tea-text"><X size={18} strokeWidth={1.5} /></button>
          <h3 id={`sheet-${id}-title`} className="font-display text-ui-26 font-normal leading-none text-tea-text">{title}</h3>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-10 pt-6 sm:px-8">
          {note && <p className="mb-7 max-w-[52ch] font-body text-ui-14 italic leading-relaxed text-tea-text-sec">{note}</p>}
          {children}
          {mode === 'page' && (
            <div className="mt-10 flex justify-end pb-nav-gap lg:pb-0">
              <button type="button" onClick={onClose} className="tap-target min-h-11 rounded-md cta-solid px-6 font-sans text-ui-14">Done</button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
  // On an ordinary page the sheet goes to the end of the document, so it
  // covers the bottom bar the way Your Table does rather than sliding under it.
  return mode === 'page' && typeof document !== 'undefined' ? createPortal(sheet, document.body) : sheet;
}

