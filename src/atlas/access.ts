import { useEffect, useState } from 'react';
import { AUTH_TOKEN_CHANGED_EVENT, hasSession } from '../lib/api';
import { AtlasNotFound, atlasJson } from './client';

// Whether the signed-in person may read the Tea Atlas, for the two doors to it
// (a tile in Your Table, a row in the Manage column). The server decides, as it
// does for every Atlas request (docs/TEA_ATLAS.md): this asks it once per
// session, the same question the Atlas itself asks, and a door appears only on
// a yes. Anyone else sees nothing, and what they were asked is the plain 404
// an unknown address answers, so no door and no request gives the library away.
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
  const [canRead, setCanRead] = useState(false);
  const [session, setSession] = useState(0);
  useEffect(() => {
    const onChange = () => setSession(n => n + 1);
    window.addEventListener(AUTH_TOKEN_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(AUTH_TOKEN_CHANGED_EVENT, onChange);
  }, []);
  useEffect(() => {
    let live = true;
    ask().then(yes => { if (live) setCanRead(yes); });
    return () => { live = false; };
  }, [session]);
  return canRead;
}
