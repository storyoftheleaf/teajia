import React, { useEffect, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { SiteNotFound } from '../../components/SiteNotFound';
import { ATLAS_ROOT, AtlasFrame } from '../AtlasFrame';
import { AtlasArticleRow } from '../AtlasArticleRow';
import { AtlasImage } from '../AtlasImage';
import { useAtlasJson } from '../useAtlas';
import { pagesLabel, readingMinutes, tidyBlocks } from '../readerBlocks';
import type { AtlasArticle, AtlasBlock, AtlasHome, AtlasIssue } from '../types';

// The reading column: Lora at the magazine's own size and leading (the same
// 17 to 18px on 1.8 the Read articles use), about 66 characters to a line.
const CJK = /[\u3400-\u9fff\uf900-\ufaff]/;

const BODY = 'font-body text-ui-17 md:text-[18px] leading-[1.8] text-tea-text';

const Block: React.FC<{ block: AtlasBlock; issueLabel: string }> = ({ block, issueLabel }) => {
  switch (block.t) {
    case 'p':
      return <p className={`${BODY} mb-[1.1em]`}>{block.v}</p>;
    case 'h':
      return (
        <h2 className="font-display text-[22px] md:text-ui-26 font-medium leading-[1.25] text-tea-text mt-12 mb-4 [text-wrap:balance]">
          {block.v}
        </h2>
      );
    case 'aside':
      // Bylines, pull lines and Chinese titles set small beside the text in
      // print. Chinese is never slanted: it has no italic, only a faked one.
      return (
        <p className={`font-body text-ui-15 leading-[1.7] text-tea-text-sec my-6 ${CJK.test(block.v) ? 'tracking-[0.08em]' : 'italic'}`}>
          {block.v}
        </p>
      );
    case 'img':
      return (
        <figure className="my-8 md:my-12">
          <AtlasImage src={block.src} alt={`Picture from ${issueLabel}`} />
        </figure>
      );
    case 'page':
      // Where the printed page turns, so a passage can be cited. On a wide
      // screen it sits in the left margin and never breaks the line of text;
      // on a phone it is a small note at the right edge.
      return (
        <div
          id={`page-${block.n}`}
          aria-label={`Printed page ${block.n}`}
          className="relative flex justify-end mt-5 mb-1 lg:m-0 lg:h-0 lg:block scroll-mt-24"
        >
          <span className="font-body text-ui-12 text-tea-text-dim tabular-nums lg:absolute lg:right-full lg:mr-10 lg:top-[0.45em] lg:whitespace-nowrap">
            p.&nbsp;{block.n}
          </span>
        </div>
      );
    default:
      return null;
  }
};

/** "Global Tea Hut, globalteahut.org", with the address linked. */
const Credit: React.FC<{ text: string }> = ({ text }) => {
  const domain = /([a-z0-9-]+\.)+[a-z]{2,}$/i.exec(text.trim())?.[0];
  if (!domain) return <>{text}</>;
  const before = text.trim().slice(0, -domain.length);
  return (
    <>
      {before}
      <a href={`https://${domain}`} target="_blank" rel="noopener noreferrer" className="underline decoration-tea-border underline-offset-4 hover:text-tea-text hover:decoration-tea-gold transition-colors">
        {domain}
      </a>
    </>
  );
};

const PrevNext: React.FC<{ side: 'prev' | 'next'; to: string; label: string; title: string }> = ({ side, to, label, title }) => (
  <Link to={to} className={`group block min-w-0 py-2 ${side === 'next' ? 'sm:text-right sm:ml-auto' : ''}`}>
    <span className="block font-body text-ui-13 text-tea-text-dim">{label}</span>
    <span className="block font-display text-ui-20 leading-[1.3] text-tea-text group-hover:text-tea-gold-lt transition-colors mt-1">{title}</span>
  </Link>
);

export default function AtlasReaderPage() {
  const { articleId = '' } = useParams();
  const article = useAtlasJson<AtlasArticle>(`articles/${articleId}.json`);
  const issuePath = article.state === 'ready' ? `issues/${article.data.issue}.json` : null;
  const issue = useAtlasJson<AtlasIssue>(issuePath);
  const home = useAtlasJson<AtlasHome>('home.json');

  useEffect(() => { window.scrollTo({ top: 0 }); }, [articleId]);

  const blocks = useMemo(
    () => (article.state === 'ready' ? tidyBlocks(article.data.blocks, article.data.title) : []),
    [article],
  );

  if (article.state === 'missing') return <SiteNotFound />;
  if (article.state === 'failed') {
    return <AtlasFrame measure="read"><p className="font-body text-tea-text-sec text-ui-15 italic">Could not load this article. Try again in a moment.</p></AtlasFrame>;
  }
  if (article.state === 'loading') {
    return <AtlasFrame measure="read"><p className="font-body text-tea-text-dim text-ui-15 italic">Opening…</p></AtlasFrame>;
  }

  const a = article.data;
  const iss = issue.state === 'ready' ? issue.data : null;
  const topicNames = new Map((home.state === 'ready' ? home.data.topics : []).map(t => [t.id, t.name]));
  const issueLabel = iss?.issue.label ?? a.issue;
  const sourceName = iss?.source.name
    ?? (home.state === 'ready' ? home.data.sources.find(s => s.id === a.source)?.name : undefined);
  const credit = iss?.source.credit
    ?? (home.state === 'ready' ? home.data.sources.find(s => s.id === a.source)?.credit : undefined)
    ?? 'Global Tea Hut, globalteahut.org';
  const idx = iss ? iss.articles.findIndex(x => x.id === a.id) : -1;
  const prev = idx > 0 ? iss!.articles[idx - 1] : null;
  const next = iss && idx >= 0 && idx < iss.articles.length - 1 ? iss.articles[idx + 1] : null;

  const byline = [
    a.author,
    pagesLabel(a.pages),
    a.words > 0 ? `${readingMinutes(a.words)} min read` : '',
  ].filter(Boolean).join(' · ');

  const trail = [
    ...(sourceName ? [{ label: sourceName, to: `${ATLAS_ROOT}/source/${a.source}` }] : []),
    { label: issueLabel, to: `${ATLAS_ROOT}/issue/${a.issue}` },
  ];

  return (
    <AtlasFrame title={a.title} trail={trail} measure="read">
      <div className="xl:grid xl:grid-cols-[minmax(0,680px)_minmax(0,1fr)] xl:gap-x-20">
        <div className="min-w-0">
          <article>
            <header className="mb-12 md:mb-14">
              <h1 className="font-display text-[34px] md:text-[46px] font-normal leading-[1.1] tracking-[0.005em] text-tea-text [text-wrap:balance]">
                {a.title}
              </h1>
              {byline && <p className="font-body text-ui-15 text-tea-text-sec mt-4">{byline}</p>}
            </header>

            <div className="relative">
              {blocks.map((block, i) => <Block key={i} block={block} issueLabel={issueLabel} />)}
            </div>

            <footer className="mt-14 pt-6 border-t border-tea-border">
              <p className="font-body text-ui-14 italic text-tea-text-sec">
                From <Credit text={credit} />, {issueLabel}.
              </p>
              {a.topics.length > 0 && (
                <div className="mt-6">
                  <h2 className="font-display text-ui-17 text-tea-text mb-2">Topics in this article</h2>
                  <ul className="flex flex-wrap gap-x-5 gap-y-1.5" aria-label="Topics">
                    {a.topics.map(t => (
                      <li key={t}>
                        <Link
                          to={`${ATLAS_ROOT}/topic/${t}`}
                          className="font-body text-ui-14 text-tea-text-sec underline decoration-tea-border underline-offset-4 hover:text-tea-text hover:decoration-tea-gold transition-colors"
                        >
                          {topicNames.get(t) ?? t}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </footer>
          </article>

          <nav className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-4 mt-12 pt-6 border-t border-tea-border" aria-label="Previous and next">
            {prev
              ? <PrevNext side="prev" to={`${ATLAS_ROOT}/read/${prev.id}`} label="Previous in this issue" title={prev.title} />
              : iss?.prev
                ? <PrevNext side="prev" to={`${ATLAS_ROOT}/issue/${iss.prev.id}`} label="Previous issue" title={iss.prev.label} />
                : <span className="hidden sm:block" />}
            {next
              ? <PrevNext side="next" to={`${ATLAS_ROOT}/read/${next.id}`} label="Next in this issue" title={next.title} />
              : iss?.next && <PrevNext side="next" to={`${ATLAS_ROOT}/issue/${iss.next.id}`} label="Next issue" title={iss.next.label} />}
          </nav>
        </div>

        {iss && (
          // Beside the text on a wide screen, so the issue stays in reach
          // through a long read; after the article on anything narrower.
          <aside className="mt-16 xl:mt-0" aria-labelledby="in-this-issue">
            <div className="xl:sticky xl:top-8 xl:max-h-[calc(100vh-4rem)] xl:overflow-y-auto xl:pr-2">
              <h2 id="in-this-issue" className="font-display text-ui-20 text-tea-text mb-1">
                <Link to={`${ATLAS_ROOT}/issue/${a.issue}`} className="hover:text-tea-gold-lt transition-colors">
                  In this issue
                </Link>
              </h2>
              <p className="font-body text-ui-13 text-tea-text-dim mb-3">{issueLabel}</p>
              <ol>
                {iss.articles.map(x => (
                  <AtlasArticleRow key={x.id} id={x.id} title={x.title} pages={x.pages} current={x.id === a.id} compact />
                ))}
              </ol>
            </div>
          </aside>
        )}
      </div>
    </AtlasFrame>
  );
}
