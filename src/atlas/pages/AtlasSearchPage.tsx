import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { AtlasFrame } from '../AtlasFrame';
import { AtlasArticleRow } from '../AtlasArticleRow';
import { searchAtlas, type AtlasSearchResult } from '../search';

const SHOWN = 200;

export default function AtlasSearchPage() {
  const [params] = useSearchParams();
  const q = (params.get('q') ?? '').trim();
  const [result, setResult] = useState<AtlasSearchResult | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    setResult(null);
    setFailed(false);
    searchAtlas(q)
      .then(r => { if (live) setResult(r); })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [q]);

  const total = result ? result.named.length + result.text.length : 0;
  return (
    <AtlasFrame title={q ? `Search: ${q}` : 'Search'}>
      <h1 className={`${TYPOGRAPHY_CLASSES.h2} text-tea-text mb-2`}>{q ? `“${q}”` : 'Search'}</h1>
      {!q && <p className="text-tea-text-sec text-ui-14">Type a word, a name or a topic above.</p>}
      {q && failed && <p className="text-tea-text-sec text-ui-14 italic">Could not search just now. Try again in a moment.</p>}
      {q && !failed && !result && <p className="text-tea-text-dim text-ui-14">Searching…</p>}
      {q && result && (
        <>
          <p className="text-tea-text-sec text-ui-14 mb-8">
            {total === 0 ? 'Nothing found.' : total === 1 ? 'One article.' : `${total.toLocaleString()} articles.`}
          </p>
          {result.named.length > 0 && (
            <section className="mb-10" aria-labelledby="named-hits">
              <h2 id="named-hits" className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-dim mb-2`}>
                In titles, authors and topics
              </h2>
              <ol>
                {result.named.slice(0, SHOWN).map(([id, title, author, , issueLabel, , pages]) => (
                  <AtlasArticleRow key={id} id={id} title={title} author={author} pages={pages} issueLabel={issueLabel} />
                ))}
              </ol>
            </section>
          )}
          {result.text.length > 0 && (
            <section aria-labelledby="text-hits">
              <h2 id="text-hits" className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-dim mb-2`}>
                In the text
              </h2>
              <ol>
                {result.text.slice(0, SHOWN).map(([id, title, author, , issueLabel, , pages]) => (
                  <AtlasArticleRow key={id} id={id} title={title} author={author} pages={pages} issueLabel={issueLabel} />
                ))}
              </ol>
              {result.text.length > SHOWN && (
                <p className="text-ui-13 text-tea-text-dim mt-4">
                  Showing the first {SHOWN} of {result.text.length.toLocaleString()}. Add a word to narrow it.
                </p>
              )}
            </section>
          )}
        </>
      )}
    </AtlasFrame>
  );
}
