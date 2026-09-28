import React from 'react';
import { Link } from 'react-router-dom';
import { ATLAS_ROOT, AtlasFrame, AtlasLoadState, AtlasSearchBox } from '../AtlasFrame';
import { IssueCalendar, TopicIndex } from '../AtlasIndex';
import { useAtlasJson } from '../useAtlas';
import type { AtlasHome } from '../types';

// The home page is an index, not a landing page: someone opening the Atlas
// usually knows what they are after. Search first, then every topic and every
// issue in view at once, so the thing wanted is one click away without a scroll.
export default function AtlasHomePage() {
  const load = useAtlasJson<AtlasHome>('home.json');
  return (
    <AtlasFrame measure="wide" hideSearch hideIndex>
      <AtlasLoadState load={load}>
        {home => (
          <>
            <h1 className="sr-only">Tea Atlas</h1>
            <section className="max-w-[720px] mb-8 md:mb-12">
              <AtlasSearchBox large autoFocus />
              <p className="font-body text-ui-14 text-tea-text-dim mt-2">
                {home.totals.articles.toLocaleString()} articles from {home.totals.issues} issues, searchable to the word.
              </p>
            </section>

            <div className="flex flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-x-14 gap-y-10">
              <section aria-labelledby="atlas-topics" className="order-2 lg:order-1 min-w-0">
                <h2 id="atlas-topics" className="font-display text-ui-26 text-tea-text mb-4">Topics</h2>
                <TopicIndex topics={home.topics} className="columns-2 md:columns-3 gap-x-8" />
              </section>

              <section aria-labelledby="atlas-sources" className="order-1 lg:order-2 min-w-0">
                <h2 id="atlas-sources" className="font-display text-ui-26 text-tea-text mb-4">Issues</h2>
                {home.sources.map(s => (
                  <div key={s.id} className="mb-8 last:mb-0">
                    <p className="font-body text-ui-14 text-tea-text-dim mb-2">
                      <Link to={`${ATLAS_ROOT}/source/${s.id}`} className="text-tea-text-sec underline decoration-tea-border underline-offset-4 hover:text-tea-text hover:decoration-tea-gold transition-colors">
                        {s.name}
                      </Link>
                      {' · '}{s.issueCount} issues, {s.first} to {s.last}
                    </p>
                    <IssueCalendar sourceId={s.id} />
                  </div>
                ))}
              </section>
            </div>
          </>
        )}
      </AtlasLoadState>
    </AtlasFrame>
  );
}
