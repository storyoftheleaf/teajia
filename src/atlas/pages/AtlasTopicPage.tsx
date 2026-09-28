import React from 'react';
import { useParams } from 'react-router-dom';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { AtlasFrame, AtlasLoadState } from '../AtlasFrame';
import { AtlasArticleRow } from '../AtlasArticleRow';
import { useAtlasJson } from '../useAtlas';
import type { AtlasTopicPage as TopicData } from '../types';

export default function AtlasTopicPage() {
  const { topicId = '' } = useParams();
  const load = useAtlasJson<TopicData>(`topics/${topicId}.json`);
  return (
    <AtlasFrame title={load.state === 'ready' ? load.data.topic.name : undefined}>
      <AtlasLoadState load={load}>
        {({ topic, articles }) => (
          <>
            <div className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-dim`}>{topic.category}</div>
            <h1 className={`${TYPOGRAPHY_CLASSES.h1} text-tea-text mt-2`}>{topic.name}</h1>
            <p className="text-tea-text-sec text-ui-14 mt-2 mb-8">
              {articles.length === 1 ? 'One article' : `${articles.length} articles`}, oldest first.
            </p>
            <ol>
              {articles.map(a => (
                <AtlasArticleRow key={a.id} id={a.id} title={a.title} author={a.author} pages={a.pages} issueLabel={a.issueLabel} />
              ))}
            </ol>
          </>
        )}
      </AtlasLoadState>
    </AtlasFrame>
  );
}
