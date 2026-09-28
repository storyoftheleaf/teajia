import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { ATLAS_ROOT, AtlasFrame, AtlasLoadState } from '../AtlasFrame';
import { AtlasArticleRow } from '../AtlasArticleRow';
import { AtlasImage } from '../AtlasImage';
import { useAtlasJson } from '../useAtlas';
import type { AtlasIssue } from '../types';

export default function AtlasIssuePage() {
  const { issueId = '' } = useParams();
  const load = useAtlasJson<AtlasIssue>(`issues/${issueId}.json`);
  return (
    <AtlasFrame title={load.state === 'ready' ? `${load.data.source.name}, ${load.data.issue.label}` : undefined}>
      <AtlasLoadState load={load}>
        {({ source, issue, prev, next, articles }) => (
          <>
            <Link to={`${ATLAS_ROOT}/source/${source.id}`} className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-sec hover:text-tea-text transition-colors`}>
              {source.name}
            </Link>
            <h1 className={`${TYPOGRAPHY_CLASSES.h1} text-tea-text mt-2 mb-8`}>{issue.label}</h1>
            <div className="flex flex-col sm:flex-row gap-8">
              {issue.cover && (
                <AtlasImage src={issue.cover} alt={`${source.name}, ${issue.label}`} eager className="w-40 shrink-0 rounded-[2px] overflow-hidden self-start" />
              )}
              <ol className="flex-1 min-w-0">
                {articles.map(a => (
                  <AtlasArticleRow key={a.id} id={a.id} title={a.title} author={a.author} pages={a.pages} />
                ))}
              </ol>
            </div>
            <nav className="flex flex-wrap justify-between gap-4 mt-12 pt-6 border-t border-tea-border text-ui-14" aria-label="Other issues">
              {prev
                ? <Link to={`${ATLAS_ROOT}/issue/${prev.id}`} className="text-tea-text-sec hover:text-tea-text transition-colors">Previous issue: {prev.label}</Link>
                : <span />}
              {next && <Link to={`${ATLAS_ROOT}/issue/${next.id}`} className="text-tea-text-sec hover:text-tea-text transition-colors">Next issue: {next.label}</Link>}
            </nav>
          </>
        )}
      </AtlasLoadState>
    </AtlasFrame>
  );
}
