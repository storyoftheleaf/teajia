/**
 * Publish and Unpublish, at the end of the story itself.
 *
 * Adrian, 2026-10-01: "I would rather not have to do it in manage. I should be
 * right on the page ... if I'm reading one not published, there's a button at
 * the end of it when I finish it that says published. Then it goes." And the
 * same day: an Unpublish on a live story, so a piece can come back down.
 *
 * Shown only to Teajia's own editors (the same `useIsReadOwner` the gate
 * uses), only on a curated Read path, and only once the stored states are
 * known, so the button always names the state the story is really in. The
 * worker checks again on every press; this component deciding to render is a
 * convenience, never the gate.
 *
 * A draft gets one solid button, Publish, which takes effect at once. A live
 * story gets a quiet Unpublish that asks once before taking a public page down.
 */
import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { isCuratedReadPath, isReadPathPublic } from './articleLive';
import { useIsReadOwner, useReadPublishState } from './publishGate';
import { setReadPublishState } from './readPublishState';
import './publishControl.css';

const PublishControl: React.FC = () => {
  const isOwner = useIsReadOwner();
  const { states, settled } = useReadPublishState();
  const { pathname } = useLocation();
  const path = pathname.replace(/\/+$/, '');
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOwner || !isCuratedReadPath(path) || !settled) return null;
  const live = isReadPathPublic(path, states);

  const press = async (state: 'live' | 'draft') => {
    setBusy(true);
    setError(null);
    try {
      await setReadPublishState(path, state);
      setConfirming(false);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'That did not go through. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="tj-publish" data-testid="read-publish" data-state={live ? 'live' : 'draft'} aria-label="Publishing">
      {live ? (
        <>
          <p className="tj-publish-line" role="status">Live. Anyone can read this story.</p>
          {confirming ? (
            <div className="tj-publish-confirm">
              <p className="tj-publish-note">Take it down? Visitors will see a not-found page until you publish it again.</p>
              <div className="tj-publish-pair">
                <button type="button" className="tj-publish-quiet tap-target" onClick={() => setConfirming(false)} disabled={busy}>
                  Cancel
                </button>
                <button type="button" className="tj-publish-quiet tj-publish-commit tap-target" onClick={() => press('draft')} disabled={busy} data-testid="read-unpublish-confirm">
                  {busy ? 'Taking it down' : 'Take it down'}
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="tj-publish-quiet tap-target" onClick={() => setConfirming(true)} data-testid="read-unpublish">
              Unpublish
            </button>
          )}
        </>
      ) : (
        <>
          <p className="tj-publish-line" role="status">Draft. Only Teajia&rsquo;s editors can see this story.</p>
          <button type="button" className="tj-publish-button cta-solid" onClick={() => press('live')} disabled={busy} data-testid="read-publish-button">
            {busy ? 'Publishing' : 'Publish'}
          </button>
        </>
      )}
      {error && <p className="tj-publish-error" role="alert">{error}</p>}
    </section>
  );
};

export default PublishControl;
