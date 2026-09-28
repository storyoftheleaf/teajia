import React from 'react';
import { AtlasFrame, AtlasLoadState, AtlasSearchBox } from '../AtlasFrame';
import { TopicIndex } from '../AtlasIndex';
import { useAtlasJson } from '../useAtlas';
import type { AtlasHome } from '../types';

// The Atlas is read by subject: the articles are the point, not the issues
// they were printed in. So the home page is search, then every topic, and
// nothing else. The issues have their own page, linked from the header.
export default function AtlasHomePage() {
  const load = useAtlasJson<AtlasHome>('home.json');
  return (
    <AtlasFrame measure="wide" hideSearch hideTopics>
      <AtlasLoadState load={load}>
        {home => (
          <>
            <h1 className="sr-only">Tea Atlas</h1>
            <section className="max-w-[720px] mb-8 md:mb-12">
              <AtlasSearchBox large autoFocus />
              <p className="font-body text-ui-14 text-tea-text-dim mt-2">
                {home.totals.articles.toLocaleString()} articles, searchable to the word.
              </p>
            </section>

            <section aria-labelledby="atlas-topics">
              <h2 id="atlas-topics" className="font-display text-ui-26 text-tea-text mb-4">Topics</h2>
              <TopicIndex topics={home.topics} large className="columns-2 md:columns-3 lg:columns-4 gap-x-10" />
            </section>
          </>
        )}
      </AtlasLoadState>
    </AtlasFrame>
  );
}
