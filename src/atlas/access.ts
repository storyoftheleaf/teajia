import { useEffect, useState } from 'react';
import { AUTH_TOKEN_CHANGED_EVENT, hasSession } from '../lib/api';
import { useAppStore } from '../lib/store';
import { AtlasNotFound, atlasJson } from './client';

// Whether the signed-in person may read the Tea Atlas, for the two doors to it
// (a tile in Your Table, a row in the Manage column). The server decides every
// Atlas request (docs/TEA_ATLAS.md); this only decides whether to SHOW a door,
// and a door is never proof of anything: behind it the server asks again.
//
// It asks the server as rarely as the rule allows, because a question every
// signed-in visitor sends on every page is a cost for nobody's benefit:
//
// - the site owner always reads it, so no question is needed;
// - only members of the platform account can ever be ticked for it, so for
//   everyone else the answer is no without asking;
// - a platform-account member who is not the owner is asked once a session,
//   the same question the Atlas itself asks, and the door appears on a yes.
//
// Deliberately tiny: it sits in the main bundle beside AtlasGate.

let answer: Promise<boolean> | null = null;

function ask(): Promise<boolean> {
  if (!hasSession()) return Promise.resolve(false);
  if (!answer) {
    answer = atlasJson('home.json').then(
      () => true,
      err => {
        // A refusal is remembered for the session. A dropped connection is not:
        // the next door that mounts asks again, so a bad minute cannot hide
        // the library for the rest of the visit.
        if (!(err instanceof AtlasNotFound)) answer = null;
        return false;
      },
    );
  }
  return answer;
}

if (typeof window !== 'undefined') {
  window.addEventListener(AUTH_TOKEN_CHANGED_EVENT, () => { answer = null; });
}

export function useAtlasAccess(): boolean {
  const isSiteOwner = useAppStore(s => s.platformRole === 'platform_owner');
  const onPlatformAccount = useAppStore(s => s.memberships.some(m => m.is_platform_account));
  const mayBeTicked = !isSiteOwner && onPlatformAccount;

  const [ticked, setTicked] = useState(false);
  const [session, setSession] = useState(0);
  useEffect(() => {
    const onChange = () => setSession(n => n + 1);
    window.addEventListener(AUTH_TOKEN_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(AUTH_TOKEN_CHANGED_EVENT, onChange);
  }, []);
  useEffect(() => {
    if (!mayBeTicked) { setTicked(false); return; }
    let live = true;
    ask().then(yes => { if (live) setTicked(yes); });
    return () => { live = false; };
  }, [mayBeTicked, session]);

  return hasSession() && (isSiteOwner || (mayBeTicked && ticked));
}
