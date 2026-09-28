import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { ATLAS_ROOT, AtlasFrame, AtlasLoadState } from '../AtlasFrame';
import { AtlasImage } from '../AtlasImage';
import { useAtlasJson } from '../useAtlas';
import type { AtlasSource } from '../types';

// A source's issues as a ledger by year: the year in the margin, each issue a
// line with its cover small beside it. Covers are cropped to one frame so the
// lines hold their rhythm; they help you recognise an issue, they are not the
// point of the page.
export default function AtlasSourcePage() {
  const { sourceId = '' } = useParams();
  const load = useAtlasJson<AtlasSource>(`sources/${sourceId}.json`);
  return (
    <AtlasFrame measure="wide" title={load.state === 'ready' ? load.data.source.name : undefined}>
      <AtlasLoadState load={load}>
        {({ source, years }) => (
          <>
            <h1 className="font-display text-[40px] md:text-[56px] leading-[1.05] text-tea-text">{source.name}</h1>
            {source.subtitle && <p className="font-body italic text-ui-15 md:text-ui-17 text-tea-text-sec mt-3 mb-12 md:mb-14">{source.subtitle}</p>}
            {years.map(({ year, issues }) => (
              <section
                key={year}
                aria-labelledby={`year-${year}`}
                className="md:grid md:grid-cols-[96px_minmax(0,1fr)] md:gap-x-8 border-t border-tea-border pt-4 mb-8 md:mb-10"
              >
                <h2 id={`year-${year}`} className="font-display text-ui-28 leading-none text-tea-text-sec tabular-nums mb-3 md:mb-0 md:pt-2">
                  {year}
                </h2>
                <ul className="grid grid-cols-2 lg:grid-cols-3 gap-x-4 sm:gap-x-8">
                  {issues.map(issue => (
                    <li key={issue.id}>
                      <Link to={`${ATLAS_ROOT}/issue/${issue.id}`} className="group flex items-center gap-3 sm:gap-4 py-2">
                        {issue.cover
                          ? <AtlasImage src={issue.cover} alt="" fit="cover" className="w-10 sm:w-11 shrink-0" />
                          : <span aria-hidden className="w-10 sm:w-11 aspect-[3/4] shrink-0 bg-tea-elevated" />}
                        <span className="min-w-0">
                          <span className="block font-display text-ui-17 sm:text-ui-20 leading-[1.2] text-tea-text group-hover:text-tea-gold-lt transition-colors">
                            {issue.label.replace(new RegExp(`\\s*${year}$`), '') || issue.label}
                          </span>
                          <span className="block font-body text-ui-13 text-tea-text-dim mt-0.5">{issue.count} articles</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </>
        )}
      </AtlasLoadState>
    </AtlasFrame>
  );
}
