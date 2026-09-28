import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { SiteNotFound } from '../components/SiteNotFound';
import { useAtlasJson, type AtlasLoad } from './useAtlas';
import { TopicIndex } from './AtlasIndex';
import { ATLAS_ROOT } from './atlasPaths';
import type { AtlasHome } from './types';

export { ATLAS_ROOT };

/**
 * The search field: a line to write on, not a box. Used large on the home
 * page and small in every other page's header.
 */
export const AtlasSearchBox: React.FC<{ large?: boolean; autoFocus?: boolean }> = ({ large = false, autoFocus = false }) => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  useEffect(() => { setQ(params.get('q') ?? ''); }, [params]);
  const id = large ? 'atlas-search-large' : 'atlas-search';
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
      <label className="sr-only" htmlFor={id}>Search the Tea Atlas</label>
      <input
        id={id}
        type="search"
        value={q}
        onChange={e => setQ(e.target.value)}
        autoFocus={autoFocus}
        enterKeyHint="search"
        placeholder={large ? 'Search by title, author, topic or word' : 'Search the library'}
        className={`w-full bg-transparent rounded-none border-0 border-b border-tea-border px-0 font-body text-tea-text placeholder:text-tea-text-dim transition-[border-color,box-shadow] duration-200 focus:outline-none focus:border-tea-gold focus:!shadow-[0_1px_0_0_rgb(var(--tea-gold-rgb))] focus:!animate-none ${
          large ? 'py-3 text-ui-16 md:text-ui-20' : 'py-2 text-ui-15'
        }`}
      />
    </form>
  );
};

export interface AtlasCrumb { label: string; to?: string }

/** Width of the page's content. Reading is a book column; lists are a little wider. */
type Measure = 'read' | 'list' | 'wide';
const MEASURE: Record<Measure, string> = {
  read: 'max-w-[680px] xl:max-w-[1080px]',
  list: 'max-w-[760px]',
  wide: 'max-w-[1080px]',
};

/** What the page is showing, so the topic index can mark it. */
export interface AtlasHere { topic?: string }

/**
 * Every topic, one click from every page. The Atlas is read by subject, so
 * topics are the way in: "Topics" opens the whole list under the header, and
 * picking one, pressing Escape or leaving the page closes it.
 */
const TopicsPanel: React.FC<{ here: AtlasHere; close: () => void }> = ({ here, close }) => {
  const home = useAtlasJson<AtlasHome>('home.json');
  if (home.state !== 'ready') return null;
  return (
    <div id="atlas-topics-panel" className="mb-10 pb-6 border-b border-tea-border">
      <TopicIndex topics={home.data.topics} currentId={here.topic} onPick={close} className="columns-2 md:columns-3 lg:columns-4 gap-x-8" />
    </div>
  );
};

/**
 * The issues are a secondary way in and live on their own page: this is the
 * plain link to it. With one source it reads "Issues"; with several, each
 * source is named.
 */
const IssuesLinks: React.FC<{ className: (active: boolean) => string }> = ({ className }) => {
  const home = useAtlasJson<AtlasHome>('home.json');
  const { pathname } = useLocation();
  if (home.state !== 'ready') return null;
  const sources = home.data.sources;
  const onIssues = pathname.startsWith(`${ATLAS_ROOT}/source/`) || pathname.startsWith(`${ATLAS_ROOT}/issue/`);
  return (
    <>
      {sources.map(s => (
        <Link key={s.id} to={`${ATLAS_ROOT}/source/${s.id}`} className={className(onIssues)}>
          {sources.length === 1 ? 'Issues' : s.name}
        </Link>
      ))}
    </>
  );
};

/**
 * Page chrome: private-library head tags, a path back up (Tea Atlas, then the
 * source, then the issue), Topics and Issues, and the header search. The path
 * replaces a label above the heading: it says where you are and is also the
 * way back.
 */
export const AtlasFrame: React.FC<{
  title?: string;
  trail?: AtlasCrumb[];
  measure?: Measure;
  hideSearch?: boolean;
  /** The home page lists every topic itself, so it has no Topics button. */
  hideTopics?: boolean;
  here?: AtlasHere;
  children: React.ReactNode;
}> = ({ title, trail = [], measure = 'list', hideSearch = false, hideTopics = false, here = {}, children }) => {
  const [topicsOpen, setTopicsOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => { setTopicsOpen(false); }, [pathname]);
  useEffect(() => {
    if (!topicsOpen) return;
    const onEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') setTopicsOpen(false); };
    document.addEventListener('keydown', onEscape);
    return () => document.removeEventListener('keydown', onEscape);
  }, [topicsOpen]);

  const word = (active: boolean) => `tap-target font-body text-ui-15 underline-offset-[6px] transition-colors ${
    active ? 'text-tea-text underline decoration-tea-gold' : 'text-tea-text-sec hover:text-tea-text'
  }`;

  return (
    <div className="px-4 md:px-8 pt-6 md:pt-8 pb-nav-gap-lg">
      <Helmet>
        <title>{title ? `${title} · Tea Atlas` : 'Tea Atlas'}</title>
        <meta name="robots" content="noindex, nofollow, noarchive" />
      </Helmet>
      <div className={`mx-auto ${MEASURE[measure]}`}>
        <header className={`flex flex-wrap items-center justify-between gap-x-8 gap-y-3 ${topicsOpen ? 'mb-6' : 'mb-8 md:mb-10'}`}>
          <nav aria-label="Where you are" className="min-w-0">
            <ol className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <li>
                <Link
                  to={ATLAS_ROOT}
                  className="font-display text-ui-20 leading-none text-tea-text hover:text-tea-gold-lt transition-colors"
                >
                  Tea Atlas
                </Link>
              </li>
              {trail.map((crumb, i) => (
                <li
                  key={`${crumb.label}-${i}`}
                  // On a phone only the nearest step shows, so the path stays on one line.
                  className={`${i < trail.length - 1 ? 'hidden sm:flex' : 'flex'} items-baseline gap-x-2 min-w-0 font-body text-ui-14 text-tea-text-sec`}
                >
                  <span aria-hidden className="text-tea-text-dim">/</span>
                  {crumb.to
                    ? <Link to={crumb.to} className="hover:text-tea-text transition-colors">{crumb.label}</Link>
                    : <span>{crumb.label}</span>}
                </li>
              ))}
            </ol>
          </nav>
          <div className={`flex items-center gap-x-6 ${hideSearch ? '' : 'w-full sm:w-auto'}`}>
            <nav aria-label="Library index" className="flex items-center gap-x-5 shrink-0">
              {!hideTopics && (
                <button
                  type="button"
                  aria-expanded={topicsOpen}
                  aria-controls="atlas-topics-panel"
                  onClick={() => setTopicsOpen(o => !o)}
                  className={word(topicsOpen)}
                >
                  Topics
                </button>
              )}
              <IssuesLinks className={word} />
            </nav>
            {!hideSearch && (
              <div className="flex-1 min-w-0 sm:w-56 sm:flex-none">
                <AtlasSearchBox />
              </div>
            )}
          </div>
        </header>
        {topicsOpen && <TopicsPanel here={here} close={() => setTopicsOpen(false)} />}
        {children}
      </div>
    </div>
  );
};

/** Loading, missing and failed states for any page body. */
export function AtlasLoadState<T>({ load, children }: { load: AtlasLoad<T>; children: (data: T) => React.ReactNode }) {
  if (load.state === 'missing') return <SiteNotFound />;
  if (load.state === 'failed') {
    return <p className="font-body text-tea-text-sec text-ui-15 italic">Could not load this page. Try again in a moment.</p>;
  }
  if (load.state === 'loading') return <p className="font-body text-tea-text-dim text-ui-15 italic">Opening…</p>;
  return <>{children(load.data)}</>;
}

/** A plain count in words: "One article", "14 articles". */
export function countLabel(n: number, one: string, many: string): string {
  return n === 1 ? `One ${one}` : `${n.toLocaleString()} ${many}`;
}
