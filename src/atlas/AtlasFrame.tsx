import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { TYPOGRAPHY_CLASSES } from '../designTokens';
import { SiteNotFound } from '../components/SiteNotFound';
import type { AtlasLoad } from './useAtlas';

export const ATLAS_ROOT = '/tea-atlas';

/** The search box, used on the home page and in the header. */
export const AtlasSearchBox: React.FC<{ large?: boolean; autoFocus?: boolean }> = ({ large = false, autoFocus = false }) => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  useEffect(() => { setQ(params.get('q') ?? ''); }, [params]);
  return (
    <form
      role="search"
      onSubmit={e => {
        e.preventDefault();
        const query = q.trim();
        if (query) navigate(`${ATLAS_ROOT}/search?q=${encodeURIComponent(query)}`);
      }}
      className="w-full"
    >
      <label className="sr-only" htmlFor={large ? 'atlas-search-large' : 'atlas-search'}>Search the Tea Atlas</label>
      <input
        id={large ? 'atlas-search-large' : 'atlas-search'}
        type="search"
        value={q}
        onChange={e => setQ(e.target.value)}
        autoFocus={autoFocus}
        placeholder="Search titles, authors, topics and full text"
        className={`w-full bg-tea-bg border border-tea-border rounded-md text-tea-text placeholder:text-tea-text-dim focus:border-tea-gold focus:ring-2 focus:ring-tea-gold/30 focus:outline-none ${
          large ? 'px-4 py-3 text-ui-16' : 'px-3 py-2 text-ui-14'
        }`}
      />
    </form>
  );
};

/** Page chrome: private-library head tags, the wordmark, and the header search. */
export const AtlasFrame: React.FC<{
  title?: string;
  wide?: boolean;
  hideSearch?: boolean;
  children: React.ReactNode;
}> = ({ title, wide = false, hideSearch = false, children }) => (
  <div className="px-4 md:px-6 pt-6 pb-nav-gap-lg">
    <Helmet>
      <title>{title ? `${title} · Tea Atlas` : 'Tea Atlas'}</title>
      <meta name="robots" content="noindex, nofollow, noarchive" />
    </Helmet>
    <div className={`mx-auto ${wide ? 'max-w-5xl' : 'max-w-3xl'}`}>
      <header className="flex flex-wrap items-center justify-between gap-3 mb-8">
        <Link to={ATLAS_ROOT} className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-sec hover:text-tea-text transition-colors`}>
          Tea Atlas
        </Link>
        {!hideSearch && (
          <div className="w-full sm:w-72">
            <AtlasSearchBox />
          </div>
        )}
      </header>
      {children}
    </div>
  </div>
);

/** Loading, missing and failed states for any page body. */
export function AtlasLoadState<T>({ load, children }: { load: AtlasLoad<T>; children: (data: T) => React.ReactNode }) {
  if (load.state === 'missing') return <SiteNotFound />;
  if (load.state === 'failed') {
    return <p className="text-tea-text-sec text-ui-14 italic">Could not load this page. Try again in a moment.</p>;
  }
  if (load.state === 'loading') return <p className="text-tea-text-dim text-ui-14">Loading…</p>;
  return <>{children(load.data)}</>;
}
