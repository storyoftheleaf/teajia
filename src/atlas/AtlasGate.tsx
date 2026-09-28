import React, { lazy, Suspense, useEffect, useState } from 'react';
import { AUTH_TOKEN_CHANGED_EVENT, hasSession } from '../lib/api';
import { EmblemLoader } from '../components/shared/EmblemLoader';
import { SiteNotFound } from '../components/SiteNotFound';
import { AtlasNotFound, atlasJson, clearAtlasCache } from './client';

// The door to the Tea Atlas (docs/TEA_ATLAS.md). Deliberately tiny, because it
// sits in the main bundle: it asks the server once, and only on a yes does the
// reader's own chunk load. Everyone else sees the site's ordinary 404, and
// never downloads a line of the reader.

const AtlasApp = lazy(() => import('./AtlasApp'));

type Door = 'asking' | 'open' | 'shut' | 'offline';

export default function AtlasGate() {
  const [door, setDoor] = useState<Door>(() => (hasSession() ? 'asking' : 'shut'));
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const onAuthChange = () => {
      clearAtlasCache();
      setAttempt(n => n + 1);
    };
    window.addEventListener(AUTH_TOKEN_CHANGED_EVENT, onAuthChange);
    return () => window.removeEventListener(AUTH_TOKEN_CHANGED_EVENT, onAuthChange);
  }, []);

  useEffect(() => {
    if (!hasSession()) {
      setDoor('shut');
      return;
    }
    let live = true;
    setDoor(current => (current === 'open' ? current : 'asking'));
    atlasJson('home.json')
      .then(() => { if (live) setDoor('open'); })
      .catch(err => { if (live) setDoor(err instanceof AtlasNotFound ? 'shut' : 'offline'); });
    return () => { live = false; };
  }, [attempt]);

  if (door === 'shut') return <SiteNotFound />;
  if (door === 'asking') return <EmblemLoader />;
  if (door === 'offline') {
    // Only a failed connection lands here, never a refusal, so it says nothing
    // about whether the library exists.
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
        <p className="text-tea-text-sec text-ui-15 mb-4">Could not reach the server.</p>
        <button
          type="button"
          onClick={() => setAttempt(n => n + 1)}
          className="text-tea-text-sec hover:text-tea-text transition-colors text-ui-14"
        >
          Try again
        </button>
      </div>
    );
  }
  return (
    <Suspense fallback={<EmblemLoader />}>
      <AtlasApp />
    </Suspense>
  );
}
