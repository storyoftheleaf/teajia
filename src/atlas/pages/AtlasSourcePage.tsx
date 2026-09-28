import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { ATLAS_ROOT, AtlasFrame, AtlasLoadState } from '../AtlasFrame';
import { AtlasImage } from '../AtlasImage';
import { useAtlasJson } from '../useAtlas';
import type { AtlasSource } from '../types';

export default function AtlasSourcePage() {
  const { sourceId = '' } = useParams();
  const load = useAtlasJson<AtlasSource>(`sources/${sourceId}.json`);
  return (
    <AtlasFrame wide title={load.state === 'ready' ? load.data.source.name : undefined}>
      <AtlasLoadState load={load}>
        {({ source, years }) => (
          <>
            <h1 className={`${TYPOGRAPHY_CLASSES.h1} text-tea-text mb-1`}>{source.name}</h1>
            {source.subtitle && <p className="text-tea-text-sec text-ui-15 mb-10">{source.subtitle}</p>}
            {years.map(({ year, issues }) => (
              <section key={year} className="mb-10" aria-labelledby={`year-${year}`}>
                <h2 id={`year-${year}`} className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-dim mb-4`}>{year}</h2>
                <ul className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
                  {issues.map(issue => (
                    <li key={issue.id}>
                      <Link to={`${ATLAS_ROOT}/issue/${issue.id}`} className="group block">
                        {issue.cover
                          ? <AtlasImage src={issue.cover} alt="" className="rounded-[2px] overflow-hidden mb-2" />
                          : <div className="aspect-[3/4] bg-tea-elevated/40 rounded-[2px] mb-2" />}
                        <div className="text-ui-14 text-tea-text group-hover:text-tea-gold transition-colors">{issue.label}</div>
                        <div className="text-ui-12 text-tea-text-dim">{issue.count} articles</div>
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
