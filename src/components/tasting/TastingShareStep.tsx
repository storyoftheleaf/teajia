import React, { useState } from 'react';
import { ApiError } from '../../lib/api';
import { familyApi } from '../../lib/familyApi';
import type { FamilyShareState } from '../../lib/familyContract';
import { syncTastingJournal } from '../../lib/tastingJournalSync';
import { Button } from '../shared/Button';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { teaTableOpen } from '../../lib/teaTable';

type Choice = 'private' | 'page' | 'offered';

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * After Save: where this tasting goes. Keep private is the default, and Done
 * writes it; Not now leaves things as they were. The score never travels with
 * a share; words and photographs only.
 */
export function TastingShareStep({ productId, photographCount, onClose }: {
  productId: string;
  photographCount: number;
  onClose: () => void;
}) {
  const [choice, setChoice] = useState<Choice>('private');
  const [state, setState] = useState<'idle' | 'sharing' | 'shared' | 'error'>('idle');
  const [message, setMessage] = useState('');

  // While the Tea Table is open, one share choice covers both places, as its
  // plan decided: "On my page and the Tea Table". Only a share made under
  // these words puts the tasting on the Tea Table (worker/src/teaTable.ts).
  const table = teaTableOpen();
  const options: Array<{ id: Choice; label: string }> = [
    { id: 'private', label: 'Keep private' },
    { id: 'page', label: table ? 'On my page and the Tea Table' : 'On my page' },
    ...(photographCount > 0 ? [{ id: 'offered' as const, label: table ? 'On my page and the Tea Table, and offer my photographs to Teajia' : 'On my page, and offer my photographs to Teajia' }] : []),
  ];

  async function share() {
    // Keep private is a choice, not a way out: it is written, so a later
    // sitting of a tea already on the page goes back to private with it.
    setState('sharing');
    setMessage('');
    try {
      // The tasting must be on the server before it can be shared; the save
      // sent it, and this makes sure nothing is still waiting.
      await syncTastingJournal();
      let lastError: unknown;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          await familyApi.shareTasting(productId, choice as FamilyShareState, table);
          if (choice === 'private') { onClose(); return; }
          setState('shared');
          return;
        } catch (err) {
          lastError = err;
          const code = err instanceof ApiError ? (err.data?.code as string | undefined) : undefined;
          if (code !== 'tasting_not_saved') break;
          await wait(1200);
          await syncTastingJournal();
        }
      }
      throw lastError;
    } catch (err) {
      const code = err instanceof ApiError ? (err.data?.code as string | undefined) : undefined;
      setState('error');
      setMessage(code === 'tasting_not_saved'
        ? `Your tasting is still reaching Teajia. Try ${choice === 'private' ? 'Done' : 'Share'} again in a moment.`
        : err instanceof ApiError && err.message && !err.message.startsWith('Request failed') ? err.message
          : choice === 'private' ? 'Could not keep it private. Please try again.' : 'Could not share. Please try again.');
    }
  }

  return <section className="tasting-share-step" role="dialog" aria-label="Share this tasting">
    <h3 className={TYPOGRAPHY_CLASSES.label}>Share this tasting</h3>
    {state === 'shared'
      ? <p className={TYPOGRAPHY_CLASSES.bodyLight} role="status">{`${table ? 'On your page and the Tea Table.' : 'On your page.'}${choice === 'offered' ? ' Your photographs are offered to Teajia.' : ''}`}</p>
      : <div className="tasting-share-options" role="group" aria-label="Where this tasting goes">
          {options.map(option => <Button variant="plain" type="button" key={option.id} className="tap-target" aria-pressed={choice === option.id}
            disabled={state === 'sharing'} onClick={() => setChoice(option.id)}>{option.label}</Button>)}
        </div>}
    {message && <p className={TYPOGRAPHY_CLASSES.accountMeta} role="alert">{message}</p>}
    <div className="tasting-share-actions">
      {state === 'shared'
        ? <Button variant="plain" type="button" className="tap-target tasting-share-primary" onClick={onClose}>Close</Button>
        : <>
            <Button variant="plain" type="button" className="tap-target" onClick={onClose} disabled={state === 'sharing'}>Not now</Button>
            <Button variant="plain" type="button" className="tap-target tasting-share-primary" onClick={() => { void share(); }} disabled={state === 'sharing'}>
              {state === 'sharing' ? (choice === 'private' ? 'Saving…' : 'Sharing…') : choice === 'private' ? 'Done' : 'Share'}
            </Button>
          </>}
    </div>
  </section>;
}
