import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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
    <AtlasFrame title={q ? `Search: ${q}` : 'Search'} trail={[{ label: 'Search' }]}>
      <h1 className="font-display text-[34px] md:text-[46px] leading-[1.1] text-tea-text [overflow-wrap:anywhere]">{q ? `“${q}”` : 'Search'}</h1>
      {!q && <p className="font-body text-tea-text-sec text-ui-15 mt-3">Type a word, a name or a topic above.</p>}
      {q && failed && <p className="font-body text-tea-text-sec text-ui-15 italic mt-3">Could not search just now. Try again in a moment.</p>}
      {q && !failed && !result && <p className="font-body text-tea-text-dim text-ui-15 italic mt-3">Searching…</p>}
      {q && result && (
        <>
          <p className="font-body text-tea-text-sec text-ui-15 mt-3 mb-10">
            {total === 0 ? 'Nothing found.' : total === 1 ? 'One article.' : `${total.toLocaleString()} articles.`}
          </p>
          {result.named.length > 0 && (
            <section className="mb-12" aria-labelledby="named-hits">
              <h2 id="named-hits" className="font-display text-ui-20 text-tea-text pb-2 border-b border-tea-border">
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
              <h2 id="text-hits" className="font-display text-ui-20 text-tea-text pb-2 border-b border-tea-border">
                In the text
              </h2>
              <ol>
                {result.text.slice(0, SHOWN).map(([id, title, author, , issueLabel, , pages]) => (
                  <AtlasArticleRow key={id} id={id} title={title} author={author} pages={pages} issueLabel={issueLabel} />
                ))}
              </ol>
              {result.text.length > SHOWN && (
                <p className="font-body text-ui-14 text-tea-text-sec mt-5">
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
