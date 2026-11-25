import React, { useState } from 'react';
import { API_URL, authedFetch } from '../../lib/api';
import { Button } from '../../components/shared/Button';
import { useToast } from './Toast';

/**
 * "Give their own link": the host names one person under a booking and copies
 * a link only that person uses. Their guest book note is signed with this name.
 */
export const PartyLinkAction: React.FC<{ eventId: string; attendeeId: string }> = ({ eventId, attendeeId }) => {
  const { showToast } = useToast();
  const [naming, setNaming] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [busy, setBusy] = useState(false);

  const copy = async () => {
    const name = firstName.trim();
    if (!name || busy) return;
    setBusy(true);
    try {
      const issued: { credential: string; first_name: string } = await authedFetch(
        API_URL + '/api/admin/events/' + encodeURIComponent(eventId) + '/after-sit/' + encodeURIComponent(attendeeId) + '/party',
        { method: 'POST', body: JSON.stringify({ first_name: name }) },
      );
      const url = new URL('/after-sit', window.location.origin);
      url.hash = issued.credential;
      await navigator.clipboard.writeText(url.href);
      showToast('Link copied. Send it only to ' + issued.first_name + '.', 'success');
      setNaming(false);
      setFirstName('');
    } catch {
      showToast('Could not make their link. Try again.', 'error');
    } finally {
      setBusy(false);
    }
  };

  if (!naming) {
    return (
      <Button variant="quiet" size="sm" type="button" onClick={() => setNaming(true)}>
        Give their own link
      </Button>
    );
  }
  return (
    <span className="flex flex-wrap items-center gap-2">
      <input
        type="text"
        value={firstName}
        maxLength={40}
        autoFocus
        onChange={event => setFirstName(event.target.value)}
        onKeyDown={event => { if (event.key === 'Enter') void copy(); }}
        aria-label="Their first name"
        placeholder="Their first name"
        className="w-32 bg-tea-elevated rounded-md px-2 py-1 text-ui-12 text-tea-text placeholder:text-tea-text-dim outline-none"
      />
      <Button size="sm" type="button" loading={busy} disabled={!firstName.trim()} onClick={copy}>
        Copy link
      </Button>
      <Button variant="quiet" size="sm" type="button" onClick={() => { setNaming(false); setFirstName(''); }}>
        Cancel
      </Button>
    </span>
  );
};
