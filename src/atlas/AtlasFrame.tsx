import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { SiteNotFound } from '../components/SiteNotFound';
import { useAtlasJson, type AtlasLoad } from './useAtlas';
import { IssueCalendar, TopicIndex } from './AtlasIndex';
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

type Panel = 'topics' | 'issues' | null;

/** What the page is showing, so the index can mark it. */
export interface AtlasHere { topic?: string; issue?: string }

/**
 * The library's index, one click from every page: "Topics" and "Issues" open
 * the whole of either under the header, so moving sideways never means going
 * home and scrolling. Picking anything, pressing Escape or leaving the page
 * closes it.
 */
const QuickPanel: React.FC<{ panel: Exclude<Panel, null>; here: AtlasHere; close: () => void }> = ({ panel, here, close }) => {
  const home = useAtlasJson<AtlasHome>('home.json');
  if (home.state !== 'ready') return null;
  return (
    <div id="atlas-quick-panel" className="mb-10 pb-6 border-b border-tea-border">
      {panel === 'topics' ? (
        <TopicIndex topics={home.data.topics} currentId={here.topic} onPick={close} className="columns-2 md:columns-3 lg:columns-4 gap-x-8" />
      ) : (
        <div className="grid gap-8 md:grid-cols-2">
          {home.data.sources.map(s => (
            <section key={s.id} aria-label={s.name} className="max-w-[460px]">
              <Link to={`${ATLAS_ROOT}/source/${s.id}`} onClick={close} className="font-display text-ui-20 text-tea-text hover:text-tea-gold-lt transition-colors">
                {s.name}
              </Link>
              <div className="mt-3"><IssueCalendar sourceId={s.id} currentIssue={here.issue} onPick={close} /></div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * Page chrome: private-library head tags, a path back up (Tea Atlas, then the
 * source, then the issue), the Topics and Issues index, and the header search.
 * The path replaces a label above the heading: it says where you are and is
 * also the way back.
 */
export const AtlasFrame: React.FC<{
  title?: string;
  trail?: AtlasCrumb[];
  measure?: Measure;
  hideSearch?: boolean;
  hideIndex?: boolean;
  here?: AtlasHere;
  children: React.ReactNode;
}> = ({ title, trail = [], measure = 'list', hideSearch = false, hideIndex = false, here = {}, children }) => {
  const [panel, setPanel] = useState<Panel>(null);
  const { pathname } = useLocation();
  useEffect(() => { setPanel(null); }, [pathname]);
  useEffect(() => {
    if (!panel) return;
    const onEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') setPanel(null); };
    document.addEventListener('keydown', onEscape);
    return () => document.removeEventListener('keydown', onEscape);
  }, [panel]);

  const toggle = (which: Exclude<Panel, null>) => (
    <button
      type="button"
      aria-expanded={panel === which}
      aria-controls="atlas-quick-panel"
      onClick={() => setPanel(p => (p === which ? null : which))}
      className={`tap-target font-body text-ui-15 underline-offset-[6px] transition-colors ${
        panel === which ? 'text-tea-text underline decoration-tea-gold' : 'text-tea-text-sec hover:text-tea-text'
      }`}
    >
      {which === 'topics' ? 'Topics' : 'Issues'}
    </button>
  );

  return (
    <div className="px-4 md:px-8 pt-6 md:pt-8 pb-nav-gap-lg">
      <Helmet>
        <title>{title ? `${title} · Tea Atlas` : 'Tea Atlas'}</title>
        <meta name="robots" content="noindex, nofollow, noarchive" />
      </Helmet>
      <div className={`mx-auto ${MEASURE[measure]}`}>
        <header className={`flex flex-wrap items-center justify-between gap-x-8 gap-y-3 ${panel ? 'mb-6' : 'mb-8 md:mb-10'}`}>
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
          <div className="flex items-center gap-x-6 w-full sm:w-auto">
            {!hideIndex && (
              <nav aria-label="Library index" className="flex items-center gap-x-5 shrink-0">
                {toggle('topics')}
                {toggle('issues')}
              </nav>
            )}
            {!hideSearch && (
              <div className="flex-1 min-w-0 sm:w-56 sm:flex-none">
                <AtlasSearchBox />
              </div>
            )}
          </div>
        </header>
        {panel && <QuickPanel panel={panel} here={here} close={() => setPanel(null)} />}
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
