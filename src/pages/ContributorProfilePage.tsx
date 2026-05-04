import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { useContributor } from '../hooks/useContributor';

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
      className="border-t border-tea-border/40 pt-6 mb-8"
      style={{ marginTop: 'clamp(80px, 12vh, 128px)' }}
    >
      <h2
        className="text-tea-text text-ui-13"
        style={{ fontFamily: 'var(--font-display)', fontWeight: 400, letterSpacing: '0.01em' }}
      >
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
          className="text-tea-text"
          style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 400,
            fontSize: '17px',
            lineHeight: 1.7,
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
        className="w-full min-h-screen flex-1 mx-auto px-4 md:px-6 lg:px-10 flex items-center justify-center"
        style={{ maxWidth: 'min(880px, 100%)' }}
      >
        <p
          className="text-tea-text-sec italic text-center"
          style={{ fontFamily: 'var(--font-body)', fontSize: '15px', lineHeight: 1.6 }}
        >
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
      className="w-full min-h-screen flex-1 mx-auto px-4 md:px-6 lg:px-10"
      style={{ maxWidth: 'min(880px, 100%)' }}
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
          className="contrib-anim contrib-issue text-ui-11 text-tea-gold/60 uppercase"
          style={{
            fontFamily: 'var(--font-display)',
            letterSpacing: '0.18em',
            fontWeight: 400,
          }}
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
            className="contrib-anim contrib-chinese text-tea-gold/70"
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
            className="contrib-anim contrib-loc text-tea-text-sec italic"
            style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 300,
              fontSize: '15px',
              lineHeight: 1.6,
              maxWidth: '52ch',
              marginTop: 'clamp(32px, 5vh, 56px)',
            }}
          >
            {data.location_line}
          </p>
        )}

        {data.seasonal_line && (
          <p
            className="contrib-anim contrib-season text-tea-text-sec"
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '14px',
              opacity: 0.75,
              marginTop: '12px',
            }}
          >
            {data.seasonal_line}
          </p>
        )}
      </header>

      {/* ── Editorial body ─────────────────────────────────────────── */}
      {!hasBody ? (
        <p
          className="contrib-anim contrib-season text-tea-gold/50 italic"
          style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 300,
            fontSize: '15px',
            lineHeight: 1.6,
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

          {/* PULL_QUOTE_AFTER_ORIGIN — Wave 4A inserts here */}

          {data.now_text && (
            <Reveal>
              <SectionLabel>Now</SectionLabel>
              <Paragraphs text={data.now_text} />
              {(data.now_stamp || data.now_updated_at) && (
                <p
                  className="text-tea-text-sec italic"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 400,
                    fontSize: '12px',
                    marginTop: '1rem',
                  }}
                >
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

          {/* PULL_QUOTE_AFTER_INSPIRATIONS — Wave 4A inserts here */}

          {data.articles.length > 0 && (
            <Reveal>
              <SectionLabel>Words</SectionLabel>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {data.articles.map((article) => (
                  <li key={article.slug}>
                    <a
                      href={`/article/${article.slug}`}
                      className="group flex items-baseline gap-6 py-6 border-b border-tea-border/30 hover:border-tea-gold/40 transition-[border-color] duration-300"
                    >
                      <div className="flex-1 min-w-0">
                        <div
                          className="text-tea-text-sec mb-2"
                          style={{
                            fontFamily: 'var(--font-display)',
                            fontSize: '13px',
                            fontStyle: 'italic',
                            fontWeight: 400,
                            letterSpacing: '0.01em',
                          }}
                        >
                          {formatSeason(article.published_at)}
                        </div>
                        <div
                          className="text-tea-text"
                          style={{
                            fontFamily: 'var(--font-body)',
                            fontSize: '18px',
                            fontWeight: 400,
                            lineHeight: 1.4,
                          }}
                        >
                          {article.title}
                        </div>
                        {article.subtitle && (
                          <div
                            className="text-tea-text-sec mt-2"
                            style={{
                              fontFamily: 'var(--font-body)',
                              fontStyle: 'italic',
                              fontWeight: 300,
                              fontSize: '15px',
                              lineHeight: 1.5,
                            }}
                          >
                            {article.subtitle}
                          </div>
                        )}
                      </div>
                      <span
                        className="text-tea-text-sec group-hover:text-tea-gold/80 transition-transform duration-300 group-hover:translate-x-1.5"
                        aria-hidden="true"
                        style={{
                          fontFamily: 'var(--font-display)',
                          fontSize: '20px',
                          fontWeight: 300,
                          flex: '0 0 auto',
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
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontWeight: 400,
                  fontSize: '15px',
                  lineHeight: 1.7,
                }}
                className="text-tea-text"
              >
                {data.links.map((link, i) => (
                  <span key={`${link.url}-${i}`}>
                    {i > 0 && <span className="text-tea-text-sec mx-2">·</span>}
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="border-b border-transparent hover:border-tea-gold/40 transition-[border-color] duration-200"
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
                className="border-t border-tea-gold/20"
                style={{ marginTop: 'clamp(80px, 12vh, 128px)' }}
              />
              <p
                className="text-tea-text-sec italic"
                style={{
                  fontFamily: 'var(--font-body)',
                  fontWeight: 300,
                  fontSize: '18px',
                  lineHeight: 1.5,
                  maxWidth: '50ch',
                  marginTop: 'clamp(32px, 5vh, 56px)',
                  marginBottom: 'clamp(96px, 16vh, 160px)',
                }}
              >
                {data.closing}
              </p>
            </Reveal>
          )}
        </>
      )}
    </article>
  );
}
