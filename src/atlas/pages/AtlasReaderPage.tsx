import React, { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { SiteNotFound } from '../../components/SiteNotFound';
import { ATLAS_ROOT, AtlasFrame } from '../AtlasFrame';
import { AtlasArticleRow } from '../AtlasArticleRow';
import { AtlasImage } from '../AtlasImage';
import { useAtlasJson } from '../useAtlas';
import type { AtlasArticle, AtlasBlock, AtlasHome, AtlasIssue } from '../types';

const Block: React.FC<{ block: AtlasBlock; issueLabel: string }> = ({ block, issueLabel }) => {
  switch (block.t) {
    case 'p':
      return <p className={`${TYPOGRAPHY_CLASSES.body} text-tea-text mb-5`}>{block.v}</p>;
    case 'h':
      return <h2 className={`${TYPOGRAPHY_CLASSES.h3} text-tea-text mt-10 mb-4`}>{block.v}</h2>;
    case 'aside':
      return <p className="font-body italic text-ui-14 text-tea-text-sec mb-4 leading-[1.6]">{block.v}</p>;
    case 'img':
      return (
        <figure className="my-8">
          <AtlasImage src={block.src} alt={`Picture from ${issueLabel}`} className="rounded-[2px] overflow-hidden" />
        </figure>
      );
    case 'page':
      // The printed page this text starts on, so a reading can be cited.
      return (
        <div id={`page-${block.n}`} className="flex items-center gap-3 my-6" aria-label={`Printed page ${block.n}`}>
          <span className="flex-1 border-t border-tea-border" />
          <span className="text-ui-11 text-tea-text-dim tracking-[0.1em] uppercase">p. {block.n}</span>
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
      <a href={`https://${domain}`} target="_blank" rel="noopener noreferrer" className="underline decoration-tea-border hover:text-tea-text">
        {domain}
      </a>
    </>
  );
};

export default function AtlasReaderPage() {
  const { articleId = '' } = useParams();
  const article = useAtlasJson<AtlasArticle>(`articles/${articleId}.json`);
  const issuePath = article.state === 'ready' ? `issues/${article.data.issue}.json` : null;
  const issue = useAtlasJson<AtlasIssue>(issuePath);
  const home = useAtlasJson<AtlasHome>('home.json');

  useEffect(() => { window.scrollTo({ top: 0 }); }, [articleId]);

  if (article.state === 'missing') return <SiteNotFound />;
  if (article.state === 'failed') {
    return <AtlasFrame><p className="text-tea-text-sec text-ui-14 italic">Could not load this article. Try again in a moment.</p></AtlasFrame>;
  }
  if (article.state === 'loading') {
    return <AtlasFrame><p className="text-tea-text-dim text-ui-14">Loading…</p></AtlasFrame>;
  }

  const a = article.data;
  const iss = issue.state === 'ready' ? issue.data : null;
  const topicNames = new Map((home.state === 'ready' ? home.data.topics : []).map(t => [t.id, t.name]));
  const issueLabel = iss?.issue.label ?? a.issue;
  const credit = iss?.source.credit
    ?? (home.state === 'ready' ? home.data.sources.find(s => s.id === a.source)?.credit : undefined)
    ?? 'Global Tea Hut, globalteahut.org';
  const idx = iss ? iss.articles.findIndex(x => x.id === a.id) : -1;
  const prev = idx > 0 ? iss!.articles[idx - 1] : null;
  const next = iss && idx >= 0 && idx < iss.articles.length - 1 ? iss.articles[idx + 1] : null;

  return (
    <AtlasFrame title={a.title}>
      <article>
        <header className="mb-10">
          <div className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-sec`}>
            {iss ? (
              <>
                <Link to={`${ATLAS_ROOT}/source/${iss.source.id}`} className="hover:text-tea-text transition-colors">{iss.source.name}</Link>
                <span aria-hidden> · </span>
                <Link to={`${ATLAS_ROOT}/issue/${a.issue}`} className="hover:text-tea-text transition-colors">{issueLabel}</Link>
              </>
            ) : issueLabel}
          </div>
          <h1 className={`${TYPOGRAPHY_CLASSES.h1} text-tea-text mt-3`}>{a.title}</h1>
          <div className="text-ui-14 text-tea-text-sec mt-3">
            {[a.author, a.pages && a.pages !== '0' ? `p. ${a.pages}` : ''].filter(Boolean).join(' · ')}
          </div>
          {a.topics.length > 0 && (
            <ul className="flex flex-wrap gap-x-4 gap-y-1 mt-4" aria-label="Topics">
              {a.topics.map(t => (
                <li key={t}>
                  <Link to={`${ATLAS_ROOT}/topic/${t}`} className="text-ui-13 text-tea-text-sec hover:text-tea-gold transition-colors">
                    {topicNames.get(t) ?? t}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </header>

        <div>
          {a.blocks.map((block, i) => <Block key={i} block={block} issueLabel={issueLabel} />)}
        </div>

        <p className="mt-12 text-ui-13 text-tea-text-sec italic">
          From <Credit text={credit} />.
        </p>
      </article>

      <nav className="flex flex-wrap justify-between gap-4 mt-10 pt-6 border-t border-tea-border text-ui-14" aria-label="Previous and next">
        {prev
          ? <Link to={`${ATLAS_ROOT}/read/${prev.id}`} className="text-tea-text-sec hover:text-tea-text transition-colors">Previous: {prev.title}</Link>
          : iss?.prev
            ? <Link to={`${ATLAS_ROOT}/issue/${iss.prev.id}`} className="text-tea-text-sec hover:text-tea-text transition-colors">Previous issue: {iss.prev.label}</Link>
            : <span />}
        {next
          ? <Link to={`${ATLAS_ROOT}/read/${next.id}`} className="text-tea-text-sec hover:text-tea-text transition-colors">Next: {next.title}</Link>
          : iss?.next && <Link to={`${ATLAS_ROOT}/issue/${iss.next.id}`} className="text-tea-text-sec hover:text-tea-text transition-colors">Next issue: {iss.next.label}</Link>}
      </nav>

      {iss && (
        <section className="mt-12" aria-labelledby="in-this-issue">
          <h2 id="in-this-issue" className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-dim mb-2`}>In this issue</h2>
          <ol>
            {iss.articles.map(x => (
              <AtlasArticleRow key={x.id} id={x.id} title={x.title} author={x.author} pages={x.pages} current={x.id === a.id} />
            ))}
          </ol>
        </section>
      )}
    </AtlasFrame>
  );
}
