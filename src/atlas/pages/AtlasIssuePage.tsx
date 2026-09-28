import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { ATLAS_ROOT, AtlasFrame, AtlasLoadState, countLabel } from '../AtlasFrame';
import { AtlasArticleRow } from '../AtlasArticleRow';
import { AtlasImage } from '../AtlasImage';
import { useAtlasJson } from '../useAtlas';
import type { AtlasIssue } from '../types';

export default function AtlasIssuePage() {
  const { issueId = '' } = useParams();
  const load = useAtlasJson<AtlasIssue>(`issues/${issueId}.json`);
  const ready = load.state === 'ready' ? load.data : null;
  return (
    <AtlasFrame
      title={ready ? `${ready.source.name}, ${ready.issue.label}` : undefined}
      trail={ready ? [{ label: ready.source.name, to: `${ATLAS_ROOT}/source/${ready.source.id}` }] : []}
      measure="wide"
      here={{ issue: issueId }}
    >
      <AtlasLoadState load={load}>
        {({ source, issue, prev, next, articles }) => (
          <div className="md:grid md:grid-cols-[200px_minmax(0,1fr)] lg:grid-cols-[240px_minmax(0,1fr)] md:gap-x-12 lg:gap-x-16">
            <div className="flex md:block items-end gap-5 mb-8 md:mb-0">
              {issue.cover && (
                <AtlasImage
                  src={issue.cover}
                  alt={`Cover of ${source.name}, ${issue.label}`}
                  eager
                  fit="cover"
                  className="w-28 md:w-full shrink-0 md:sticky md:top-8"
                />
              )}
              <div className="md:hidden">
                <h1 className="font-display text-[34px] leading-[1.1] text-tea-text">{issue.label}</h1>
                <p className="font-body text-ui-14 text-tea-text-sec mt-2">{countLabel(articles.length, 'article', 'articles')}</p>
              </div>
            </div>

            <div className="min-w-0 max-w-[720px]">
              <div className="hidden md:block mb-8">
                <h1 className="font-display text-[46px] leading-[1.1] text-tea-text">{issue.label}</h1>
                <p className="font-body text-ui-15 text-tea-text-sec mt-3">
                  {source.name} · {countLabel(articles.length, 'article', 'articles')}
                </p>
              </div>
              <ol className="border-t border-tea-border">
                {articles.map(a => (
                  <AtlasArticleRow key={a.id} id={a.id} title={a.title} author={a.author} pages={a.pages} />
                ))}
              </ol>

              <nav className="grid grid-cols-2 gap-6 mt-12 pt-6 border-t border-tea-border" aria-label="Other issues">
                {prev ? (
                  <Link to={`${ATLAS_ROOT}/issue/${prev.id}`} className="group block">
                    <span className="block font-body text-ui-13 text-tea-text-dim">Previous issue</span>
                    <span className="block font-display text-ui-20 text-tea-text group-hover:text-tea-gold-lt transition-colors mt-1">{prev.label}</span>
                  </Link>
                ) : <span />}
                {next && (
                  <Link to={`${ATLAS_ROOT}/issue/${next.id}`} className="group block text-right">
                    <span className="block font-body text-ui-13 text-tea-text-dim">Next issue</span>
                    <span className="block font-display text-ui-20 text-tea-text group-hover:text-tea-gold-lt transition-colors mt-1">{next.label}</span>
                  </Link>
                )}
              </nav>
            </div>
          </div>
        )}
      </AtlasLoadState>
    </AtlasFrame>
  );
}
