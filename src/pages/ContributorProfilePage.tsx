import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { useContributor } from '../hooks/useContributor';
import type { ContributorPullQuote } from '../types';

// /people/:slug. Public contributor profile page.
//
// See docs/CONTRIBUTOR_PROFILES_PLAN.md for the full anatomy.
// Sections rendered here: Masthead, Origin, Now, Inspirations, Words,
// Elsewhere, Closing line. Pull-quotes, Hands on, Hosting, Voice,
// Pouring today, Where to find them are reserved for later waves.

const CHINESE_FONT_STACK = "'Ma Shan Zheng','Noto Serif SC',cursive";

// Stable, deterministic issue number from the contributor id. We don't have
// a sequential index in the data, but readers see the same number every
// visit because the hash only depends on the slug. Two-digit zero-padded.
function issueNumberFromId(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) {
    h = (h * 31 + id.charCodeAt(i)) | 0;
  }
  const n = Math.abs(h) % 99 + 1; // 1..99, never No.00
  return n.toString().padStart(2, '0');
}

// Section label: plain noun, Cormorant 400, thin divider above, generous space.
function SectionLabel({ children }: { children: string }) {
  return (
    <div
      className="border-t border-tea-border pt-6 mb-8"
      style={{ marginTop: 'clamp(80px, 12vh, 128px)' }}
    >
      <h2 className="h3">
        {children}
      </h2>
    </div>
  );
}

// Body paragraphs split on double-newlines. Lora 17 / 1.7 / 60ch on dark.
function Paragraphs({ text }: { text: string }) {
  const paras = text.split(/\n\n+/).map((s) => s.trim()).filter(Boolean);
  return (
    <>
      {paras.map((p, i) => (
        <p
          key={i}
          className="body-prose"
          style={{
            maxWidth: '60ch',
            marginBottom: i < paras.length - 1 ? '1.5rem' : 0,
          }}
        >
          {p}
        </p>
      ))}
    </>
  );
}

function ContributorPullQuoteBlock({ quote }: { quote?: ContributorPullQuote }) {
  if (!quote?.pull_quote) return null;
  return <Reveal>
    <blockquote className="my-16 border-y border-tea-border py-8 md:my-24 md:py-10">
      <p className="max-w-[52ch] font-display text-ui-26 font-light leading-snug text-tea-text md:text-[32px]">“{quote.pull_quote}”</p>
      <cite className="mt-5 block text-ui-12 not-italic text-tea-text-sec">
        <a href={`/article/${quote.article_slug}`} className="tap-target hover:text-tea-gold">{quote.article_title} →</a>
      </cite>
    </blockquote>
  </Reveal>;
}

// Map an ISO date to "Season YYYY". Dec rolls forward.
function formatSeason(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const m = d.getMonth();
  const y = d.getFullYear();
  if (m === 11) return `Winter ${y + 1}`;
  if (m <= 1) return `Winter ${y}`;
  if (m <= 4) return `Spring ${y}`;
  if (m <= 7) return `Summer ${y}`;
  return `Autumn ${y}`;
}

// Reveal-on-scroll wrapper. One-shot; collapses to a 200ms opacity fade for
// users who prefer reduced motion.
function Reveal({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setShown(true);
            io.disconnect();
          }
        });
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.05 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={`transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:duration-200 motion-reduce:transform-none ${
        shown ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      }`}
    >
      {children}
    </div>
  );
}

export default function ContributorProfilePage() {
  const { slug } = useParams<{ slug: string }>();
  const { data, isLoading, isError } = useContributor(slug);

  useEffect(() => {
    if (data?.display_name) {
      document.title = `${data.display_name} · Teajia`;
    }
  }, [data?.display_name]);

  if (isLoading) return null;

  if (isError || !data) {
    return (
      <article
        className="w-full min-h-screen flex-1 mx-auto px-4 md:px-6 max-w-3xl flex items-center justify-center"
      >
        <p className="subtitle text-center">
          This profile is not yet on file.
        </p>
      </article>
    );
  }

  const issueNumber = issueNumberFromId(data.id);
  const issueLine = data.role
    ? `No.${issueNumber} · ${data.role}`
    : `No.${issueNumber}`;

  // Empty floor: a profile with only a name renders just the masthead and a
  // single italic line. Reads as editorial reticence, not as a stub.
  const hasBody = !!(
    data.beginnings ||
    data.now_text ||
    data.inspirations ||
    data.closing ||
    (data.articles && data.articles.length > 0) ||
    (data.links && data.links.length > 0)
  );

  return (
    <article
      className="w-full min-h-screen flex-1 mx-auto px-4 md:px-6 max-w-3xl pb-nav-gap-lg"
    >
      <style>{`
        @keyframes contribFade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes contribRise {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .contrib-anim {
          opacity: 0;
          animation-fill-mode: forwards;
          animation-timing-function: cubic-bezier(0.2, 0.8, 0.2, 1);
        }
        .contrib-issue   { animation: contribFade 600ms 0ms     forwards cubic-bezier(0.2,0.8,0.2,1); }
        .contrib-name    { animation: contribRise 700ms 80ms    forwards cubic-bezier(0.2,0.8,0.2,1); }
        .contrib-chinese { animation: contribFade 600ms 220ms   forwards cubic-bezier(0.2,0.8,0.2,1); }
        .contrib-loc     { animation: contribFade 600ms 320ms   forwards cubic-bezier(0.2,0.8,0.2,1); }
        .contrib-season  { animation: contribFade 600ms 380ms   forwards cubic-bezier(0.2,0.8,0.2,1); }
        @media (prefers-reduced-motion: reduce) {
          .contrib-anim,
          .contrib-issue,
          .contrib-name,
          .contrib-chinese,
          .contrib-loc,
          .contrib-season {
            animation: contribFade 200ms ease-out forwards !important;
            transform: none !important;
          }
        }
      `}</style>

      {/* ── Masthead ───────────────────────────────────────────────── */}
      <header className="pt-12 md:pt-20 lg:pt-24">
        <p
          className="contrib-anim contrib-issue label-caps text-tea-readgold/60"
          style={{ letterSpacing: '0.18em' }}
        >
          {issueLine}
        </p>

        <h1
          className="contrib-anim contrib-name text-tea-text"
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 300,
            fontSize: 'clamp(56px, 9vw, 120px)',
            letterSpacing: '-0.02em',
            lineHeight: 0.95,
            marginTop: 'clamp(16px, 2vh, 28px)',
          }}
        >
          {data.display_name}
        </h1>

        {data.chinese_name && (
          <p
            className="contrib-anim contrib-chinese text-tea-readgold/70"
            style={{
              fontFamily: CHINESE_FONT_STACK,
              fontSize: 'clamp(28px, 3.6vw, 48px)',
              letterSpacing: '0.08em',
              lineHeight: 1,
              marginTop: 'clamp(20px, 2.5vh, 32px)',
            }}
          >
            {data.chinese_name}
          </p>
        )}

        {data.location_line && (
          <p
            className="contrib-anim contrib-loc subtitle"
            style={{
              maxWidth: '52ch',
              marginTop: 'clamp(32px, 5vh, 56px)',
            }}
          >
            {data.location_line}
          </p>
        )}

        {data.seasonal_line && (
          <p
            className="contrib-anim contrib-season body-light text-ui-14"
            style={{ marginTop: '12px' }}
          >
            {data.seasonal_line}
          </p>
        )}
      </header>

      {/* ── Editorial body ─────────────────────────────────────────── */}
      {!hasBody ? (
        <p
          className="contrib-anim contrib-season subtitle"
          style={{
            marginTop: 'clamp(96px, 16vh, 160px)',
            marginBottom: 'clamp(64px, 10vh, 120px)',
          }}
        >
          A contributor whose work is on its way.
        </p>
      ) : (
        <>
          {data.beginnings && (
            <Reveal>
              <SectionLabel>Origin</SectionLabel>
              <Paragraphs text={data.beginnings} />
            </Reveal>
          )}

          <ContributorPullQuoteBlock quote={data.pull_quotes[0]} />

          {data.now_text && (
            <Reveal>
              <SectionLabel>Now</SectionLabel>
              <Paragraphs text={data.now_text} />
              {(data.now_stamp || data.now_updated_at) && (
                <p className="label-caps text-tea-text-dim mt-4">
                  {data.now_stamp || (data.now_updated_at ? `Updated ${formatSeason(data.now_updated_at)}` : '')}
                </p>
              )}
            </Reveal>
          )}

          {data.inspirations && (
            <Reveal>
              <SectionLabel>Inspirations</SectionLabel>
              <Paragraphs text={data.inspirations} />
            </Reveal>
          )}

          <ContributorPullQuoteBlock quote={data.pull_quotes[1]} />

          {data.articles.length > 0 && (
            <Reveal>
              <SectionLabel>Words</SectionLabel>
              <ul className="divide-y divide-tea-border">
                {data.articles.map((article) => (
                  <li key={article.slug}>
                    <a
                      href={`/article/${article.slug}`}
                      className="group flex items-baseline gap-6 py-5 px-2 -mx-2 rounded-md hover:bg-tea-accent-sub/40 transition-colors"
                      style={{ textDecoration: 'none' }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-display text-ui-17 text-tea-text leading-snug" style={{ fontWeight: 400 }}>
                          {article.title}
                        </div>
                        {article.subtitle && (
                          <div className="text-ui-13 text-tea-text-sec mt-1">
                            {article.subtitle}
                          </div>
                        )}
                        <div className="label-caps text-tea-text-dim mt-2">
                          {formatSeason(article.published_at)}
                        </div>
                      </div>
                      <span
                        className="text-tea-text-dim group-hover:text-tea-readgold transition-colors shrink-0"
                        aria-hidden="true"
                        style={{
                          fontFamily: 'var(--font-display)',
                          fontSize: 18,
                          fontWeight: 300,
                        }}
                      >
                        →
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </Reveal>
          )}

          {data.links.length > 0 && (
            <Reveal>
              <SectionLabel>Elsewhere</SectionLabel>
              <p className="body-prose text-ui-15">
                {data.links.map((link, i) => (
                  <span key={`${link.url}-${i}`}>
                    {i > 0 && <span className="text-tea-text-dim mx-2">·</span>}
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="border-b border-transparent hover:border-tea-gold transition-colors"
                      style={{ color: 'inherit', textDecoration: 'none' }}
                    >
                      {link.label}
                    </a>
                  </span>
                ))}
              </p>
            </Reveal>
          )}

          {data.closing && (
            <Reveal>
              <div
                className="border-l-2 border-tea-gold pl-4"
                style={{ marginTop: 'clamp(80px, 12vh, 128px)', marginBottom: 'clamp(96px, 16vh, 160px)' }}
              >
                <p className="subtitle text-ui-17" style={{ maxWidth: '50ch' }}>
                  {data.closing}
                </p>
              </div>
            </Reveal>
          )}
        </>
      )}
    </article>
  );
}
