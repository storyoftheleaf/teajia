import { useEffect, useState } from 'react';
import { AtlasNotFound, atlasJson } from './client';

export type AtlasLoad<T> =
  | { state: 'loading' }
  | { state: 'ready'; data: T }
  | { state: 'missing' }
  | { state: 'failed' };

/** Load one Tea Atlas file. `missing` covers both "no such thing" and "not yours". */
export function useAtlasJson<T>(path: string | null): AtlasLoad<T> {
  const [load, setLoad] = useState<AtlasLoad<T>>({ state: 'loading' });
  useEffect(() => {
    if (!path) return;
    let live = true;
    setLoad({ state: 'loading' });
    atlasJson<T>(path)
      .then(data => { if (live) setLoad({ state: 'ready', data }); })
      .catch(err => { if (live) setLoad({ state: err instanceof AtlasNotFound ? 'missing' : 'failed' }); });
    return () => { live = false; };
  }, [path]);
  return load;
}
