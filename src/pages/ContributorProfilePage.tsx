import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { ContributorIdentityMark } from '../components/shared/ContributorIdentityMark';
import { PlatformMark, PLATFORM_NAMES } from '../components/people/PlatformMark';
import { TeaSelectionRow } from '../components/people/TeaSelectionRow';
import {
  firstName,
  formatEventMoment,
  formatReadTime,
  formatSeason,
  galleryPlacement,
  instagramHref,
  issueNumberFromId,
  paragraphsOf,
  personWords,
  websiteLabel,
} from '../components/people/profileFormat';
import { useContributor } from '../hooks/useContributor';
import type {
  ContributorArticleRef,
  ContributorFeaturedRef,
  ContributorLink,
  ContributorProfile,
  ContributorPullQuote,
} from '../types';

// /people/:slug. A creator's public page, phone first: the page that goes in
// an Instagram or WeChat bio. Built to the "Chosen · grid" board of the
// Creator Profiles canvas (2026-09-19).
//
// Top to bottom, every section conditional except the masthead:
//   masthead (portrait, fade, issue line, name, business and place),
//   the hub (a hairline grid of everything on the page),
//   their way with tea (pull quote, now, one origin paragraph),
//   the photos, words, the teas, hosting, their house, reach, the closing line.
// A sparse profile keeps only what it has and still reads finished; nothing
// renders a placeholder for a section that is not there. No arrows anywhere.
// The masthead is the only place text may sit on a photo.

const SIDE = 'px-4 md:px-6';

// ── Section chrome ────────────────────────────────────────────────────────────

function SectionHead({ id, title, aside }: { id?: string; title: string; aside?: ReactNode }) {
  return (
    <div id={id} className="mt-16 mb-6 flex items-baseline justify-between gap-4 border-t border-tea-border pt-5 scroll-mt-4">
      <h2 className="font-display text-ui-26 font-light text-tea-text">{title}</h2>
      {aside}
    </div>
  );
}

function Caps({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`font-sans text-ui-11 uppercase leading-[1.4] tracking-[0.15em] ${className}`}>{children}</span>;
}

function CapsLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} className="tap-target inline-flex min-h-[44px] items-center font-sans text-ui-11 uppercase tracking-[0.15em] text-tea-readgold hover:text-tea-gold-lt">
      {children}
    </a>
  );
}

// A 72px cover square beside a row of words. Falls back to the tea mark on a
// surface tint when the article has no cover, so the row keeps its shape.
function CoverSquare({ src, size = 72 }: { src?: string | null; size?: number }) {
  return src ? (
    <img src={src} alt="" loading="lazy" className="rounded-[2px] object-cover" style={{ width: size, height: size }} />
  ) : (
    <span aria-hidden="true" className="flex items-center justify-center rounded-[2px] bg-tea-elevated font-display text-ui-26 font-light text-tea-text-dim" style={{ width: size, height: size }}>茶</span>
  );
}

// ── Words rows ────────────────────────────────────────────────────────────────

interface WordRow {
  key: string;
  kind: 'wrote' | 'quoted' | 'featured';
  href: string;
  title: string;
  subtitle: string | null;
  season: string;
  cover: string | null;
  quote: string | null;
  landsOnPassage: boolean;
  readTime: string | null;
}

function articleHref(slug: string, anchor?: string | null): string {
  return `/article/${encodeURIComponent(slug)}${anchor ? `#${anchor}` : ''}`;
}

function wordRows(data: ContributorProfile): { lead: WordRow | null; rows: WordRow[] } {
  const authored = data.articles.map((article: ContributorArticleRef): WordRow => ({
    key: `wrote-${article.slug}`,
    kind: 'wrote',
    href: articleHref(article.slug),
    title: article.title,
    subtitle: article.subtitle ?? null,
    season: formatSeason(article.published_at),
    cover: article.cover_image_url ?? null,
    quote: null,
    landsOnPassage: false,
    readTime: formatReadTime(article.reading_time_mins),
  }));
  const authoredSlugs = new Set(data.articles.map(article => article.slug));
  const quoted = data.pull_quotes
    .filter((quote: ContributorPullQuote) => !authoredSlugs.has(quote.article_slug))
    .map((quote): WordRow => ({
      key: `quoted-${quote.article_slug}`,
      kind: 'quoted',
      href: articleHref(quote.article_slug, quote.quote_anchor),
      title: quote.article_title,
      subtitle: quote.article_subtitle ?? null,
      season: formatSeason(quote.published_at),
      cover: quote.cover_image_url ?? null,
      quote: quote.pull_quote,
      landsOnPassage: Boolean(quote.quote_anchor),
      readTime: formatReadTime(quote.reading_time_mins),
    }));
  const quotedSlugs = new Set(quoted.map(row => row.key.replace(/^quoted-/, '')));
  const featured = data.featured_in
    .filter((article: ContributorFeaturedRef) => !authoredSlugs.has(article.slug) && !quotedSlugs.has(article.slug))
    .map((article): WordRow => ({
      key: `featured-${article.slug}`,
      kind: 'featured',
      href: articleHref(article.slug, article.quote_anchor),
      title: article.title,
      subtitle: article.subtitle ?? null,
      season: formatSeason(article.published_at),
      cover: article.cover_image_url ?? null,
      quote: article.pull_quote ?? null,
      landsOnPassage: Boolean(article.quote_anchor),
      readTime: formatReadTime(article.reading_time_mins),
    }));
  const [lead, ...restAuthored] = authored;
  return { lead: lead ?? null, rows: [...restAuthored, ...quoted, ...featured] };
}

const ROW_LABEL: Record<WordRow['kind'], string> = { wrote: 'Wrote', quoted: 'Quoted in', featured: 'Featured in' };

// ── Reach ─────────────────────────────────────────────────────────────────────

function linkHref(link: ContributorLink): string | null {
  if (link.platform === 'instagram') return instagramHref(link.value);
  if (link.platform === 'website') return link.value;
  if (link.platform === 'other') return /^https?:\/\//i.test(link.value) ? link.value : null;
  return null;
}

function linkLabel(link: ContributorLink): string {
  if (link.platform === 'website') return websiteLabel(link.value);
  if (link.platform === 'instagram') return link.value.startsWith('@') ? link.value : `@${link.value}`;
  return link.value;
}

// WeChat has no address to open. Tapping the id copies it, and says so.
function WeChatCell({ link }: { link: ContributorLink }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link.value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Copy WeChat id ${link.value}`}
      className="flex min-h-[96px] items-center gap-3 border-b border-r border-tea-border py-3 pr-3 text-left transition-colors hover:text-tea-gold-lt"
    >
      {link.qr_image_url ? (
        <img src={link.qr_image_url} alt={`WeChat QR code`} className="h-16 w-16 flex-none rounded-[2px] object-cover" />
      ) : (
        <span className="flex h-16 w-16 flex-none items-center justify-center rounded-[2px] bg-tea-elevated text-tea-readgold"><PlatformMark platform="wechat" size={22} /></span>
      )}
      <span className="flex min-w-0 flex-col gap-0.5">
        <Caps className="text-tea-text-sec">WeChat</Caps>
        <span className="font-sans text-ui-12 text-tea-text [overflow-wrap:anywhere]">{copied ? 'Copied' : link.value}</span>
      </span>
    </button>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ContributorProfilePage() {
  const { slug } = useParams<{ slug: string }>();
  const { data, isLoading, isError, error, refetch } = useContributor(slug);

  useEffect(() => {
    if (data?.display_name) {
      document.title = `${data.display_name} · Teajia`;
    }
  }, [data?.display_name]);

  if (isLoading) {
    return (
      <article aria-label="Loading profile" className="mx-auto min-h-screen w-full max-w-2xl animate-pulse pb-nav-gap-lg">
        <div className="aspect-[4/5] w-full bg-tea-surface" />
        <div className={`${SIDE} mt-8 h-4 w-32 rounded-md bg-tea-surface`} />
        <div className={`${SIDE} mt-6 h-72 rounded-md bg-tea-surface`} />
      </article>
    );
  }

  if (isError || !data) {
    return (
      <article className="mx-auto flex min-h-screen w-full max-w-2xl flex-1 items-center justify-center px-4 md:px-6">
        <div className="text-center">
          <p role="alert" className="subtitle">{error instanceof Error ? error.message : 'This profile could not be loaded.'}</p>
          <button type="button" onClick={() => refetch()} className="tap-target mt-5 text-ui-13 text-tea-gold hover:text-tea-gold-lt">Retry</button>
        </div>
      </article>
    );
  }

  const words = personWords(data.pronouns);
  const first = firstName(data.display_name);
  const issueNumber = issueNumberFromId(data.id);
  const issueLine = data.role ? `No.${issueNumber} · ${data.role}` : `No.${issueNumber}`;
  const placeLine = [data.business_name, data.location_line].filter(Boolean).join(' · ');
  const portrait = data.portrait_url || data.avatar_url || null;

  // The way section: quote, now, and one origin paragraph.
  const quote = data.pull_quotes[0]?.pull_quote
    ?? data.articles.find(article => article.pull_quote)?.pull_quote
    ?? null;
  const nowParagraphs = paragraphsOf(data.now_text);
  const originParagraph = paragraphsOf(data.beginnings)[0] ?? null;
  const hasWay = Boolean(quote || nowParagraphs.length || originParagraph || data.inspirations);
  const stamp = data.now_stamp || (data.now_updated_at ? formatSeason(data.now_updated_at) : '');

  const gallery = data.gallery_images;
  const galleryCaption = gallery.find(image => image.caption)?.caption ?? null;

  const { lead, rows } = wordRows(data);
  const wordCount = (lead ? 1 : 0) + rows.length;

  const collection = data.collection;
  const teas = data.tea_selection;
  const shownTeas = teas.slice(0, 3);
  const teaCount = collection ? collection.item_count : teas.length;
  const teasHref = collection ? `/c/${encodeURIComponent(collection.slug)}` : `/people/${encodeURIComponent(data.id)}/favorites`;
  const moreTeas = Math.max(0, teaCount - shownTeas.length);
  const hasTeas = Boolean(collection) || teas.length > 0;

  const hosting = data.hosting;
  const house = data.host_account
    ?? (() => {
      const hostRow = (data.accounts ?? []).find(account => account.is_host) ?? null;
      return hostRow ? { id: hostRow.account_id ?? hostRow.slug ?? '', slug: hostRow.account_slug ?? hostRow.slug ?? '', name: hostRow.account_name ?? hostRow.name ?? '', location_city: hostRow.location_city, location_country: hostRow.location_country } : null;
    })();
  const houseHref = house ? `/store/${encodeURIComponent(house.slug)}` : null;
  const housePlace = [house?.location_city, house?.location_country].filter(Boolean).join(', ');

  const canPay = data.has_payment_methods === true;
  const payHref = `/people/${encodeURIComponent(data.id)}/pay`;

  const wechat = data.links.find(link => link.platform === 'wechat') ?? null;
  const otherLinks = data.links.filter(link => link.platform !== 'wechat');
  const hasReach = data.links.length > 0;

  // The hub: one cell per section that exists, in page order.
  const hubCells: Array<{ key: string; href: string; label: string }> = [];
  if (wordCount > 0) hubCells.push({ key: 'words', href: '#words', label: `Words · ${wordCount}` });
  if (hasTeas) hubCells.push({ key: 'teas', href: '#teas', label: `Teas · ${teaCount}` });
  if (hosting) hubCells.push({ key: 'hosting', href: '#hosting', label: 'Hosting' });
  if (house) hubCells.push({ key: 'house', href: '#house', label: `${words.Possessive} house` });
  if (canPay) hubCells.push({ key: 'pay', href: payHref, label: 'Pay' });
  const hubHasMarks = hasReach;
  const hubCount = hubCells.length + (hubHasMarks ? 1 : 0);

  return (
    <article className="mx-auto w-full max-w-2xl pb-nav-gap-lg" data-testid="creator-profile">
      <style>{`
        @keyframes contribFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes contribRise { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .contrib-issue { opacity: 0; animation: contribFade 600ms 0ms forwards cubic-bezier(0.2,0.8,0.2,1); }
        .contrib-name  { opacity: 0; animation: contribRise 700ms 80ms forwards cubic-bezier(0.2,0.8,0.2,1); }
        .contrib-loc   { opacity: 0; animation: contribFade 600ms 320ms forwards cubic-bezier(0.2,0.8,0.2,1); }
        .contrib-fade  { background: linear-gradient(to bottom, rgb(var(--tea-bg-rgb) / 0), rgb(var(--tea-bg-rgb) / 1)); }
        @media (prefers-reduced-motion: reduce) {
          .contrib-issue, .contrib-name, .contrib-loc { animation: contribFade 200ms ease-out forwards !important; transform: none !important; }
        }
      `}</style>

      {/* ── Masthead: the only place text sits on a photo ─────────────────── */}
      <header className="relative">
        <div className="relative aspect-[4/5] w-full max-h-[80vh] overflow-hidden bg-tea-surface">
          {portrait ? (
            <img src={portrait} alt={`Portrait of ${data.display_name}`} className="h-full w-full object-cover" />
          ) : (
            <ContributorIdentityMark name={data.display_name} />
          )}
          <div aria-hidden="true" className="contrib-fade absolute inset-x-0 bottom-0 h-[60%]" />
        </div>
        <div className={`absolute inset-x-0 bottom-6 ${SIDE}`}>
          <p className="contrib-issue"><Caps className="text-tea-readgold">{issueLine}</Caps></p>
          <h1 className="contrib-name mt-2.5 font-display text-[clamp(44px,15vw,58px)] font-light leading-[0.95] tracking-[-0.02em] text-tea-text md:text-[64px]">
            {data.display_name}
          </h1>
          {data.chinese_name && (
            <p className="contrib-loc mt-2 text-[clamp(22px,7vw,28px)] leading-none tracking-[0.08em] text-tea-readgold" style={{ fontFamily: "'Ma Shan Zheng','Noto Serif SC',cursive" }}>{data.chinese_name}</p>
          )}
          {placeLine && <p className="contrib-loc subtitle mt-3">{placeLine}</p>}
        </div>
      </header>

      {/* ── The hub ────────────────────────────────────────────────────────── */}
      {hubCount > 0 && (
        <nav aria-label="Everything on this page" className="grid grid-cols-3 border-t border-tea-border" data-testid="profile-hub">
          {hubCells.map((cell, index) => (
            <a
              key={cell.key}
              href={cell.href}
              className={`flex min-h-[52px] items-center justify-center border-b border-tea-border font-sans text-ui-11 uppercase tracking-[0.15em] text-tea-text transition-colors hover:text-tea-gold-lt ${(index + 1) % 3 === 0 ? '' : 'border-r'}`}
            >
              {cell.label}
            </a>
          ))}
          {hubHasMarks && (
            <div className={`flex min-h-[52px] items-center justify-center border-b border-tea-border ${(hubCells.length + 1) % 3 === 0 ? '' : 'border-r'}`}>
              {data.links.slice(0, 3).map((link, index) => (
                <a
                  key={`${link.platform}-${index}`}
                  href="#reach"
                  aria-label={`${PLATFORM_NAMES[link.platform]}: ${link.value}`}
                  className="inline-flex h-11 w-9 items-center justify-center text-tea-readgold hover:text-tea-gold-lt"
                >
                  <PlatformMark platform={link.platform} />
                </a>
              ))}
            </div>
          )}
        </nav>
      )}

      {/* ── Their way with tea ─────────────────────────────────────────────── */}
      {hasWay && (
        <section id="way" className={SIDE}>
            <SectionHead title={`${words.Possessive} way with tea`} />
            {quote && (
              <p className="max-w-[20ch] font-display text-ui-28 font-light leading-[1.25] text-tea-text" data-testid="profile-quote">“{quote}”</p>
            )}
            <div className={quote ? 'mt-6' : ''}>
              {nowParagraphs.map((paragraph, index) => (
                <p key={`now-${index}`} className={`body-prose max-w-[60ch] ${index > 0 ? 'mt-5' : ''}`}>{paragraph}</p>
              ))}
              {originParagraph && (
                <p className={`body-prose max-w-[60ch] ${nowParagraphs.length ? 'mt-5' : ''}`}>{originParagraph}</p>
              )}
              {!nowParagraphs.length && !originParagraph && data.inspirations && (
                <p className="body-prose max-w-[60ch]">{paragraphsOf(data.inspirations)[0]}</p>
              )}
            </div>
            {stamp && <p className="mt-3"><Caps className="text-tea-text-sec">{stamp}</Caps></p>}
        </section>
      )}

      {/* ── The photos ─────────────────────────────────────────────────────── */}
      {gallery.length > 0 && (
        <section id="photos" className="mt-10" aria-label={`Photos of ${data.display_name} at work`} data-testid="profile-gallery">
          <ul className="grid grid-cols-2 auto-rows-[128px] gap-1 md:auto-rows-[200px]">
            {gallery.map((image, index) => {
              const place = galleryPlacement(index);
              return (
                <li key={image.id ?? `${image.image_url}-${index}`} style={{ gridColumn: place.columnSpan === 2 ? 'span 2' : undefined, gridRow: place.rowSpan === 2 ? 'span 2' : undefined }}>
                  <img src={image.image_url} alt={image.caption ?? ''} loading="lazy" className="h-full w-full object-cover" />
                </li>
              );
            })}
          </ul>
          {galleryCaption && <p className={`${SIDE} mt-3`}><Caps className="text-tea-text-sec">{galleryCaption}</Caps></p>}
        </section>
      )}

      {/* ── Words ──────────────────────────────────────────────────────────── */}
      {wordCount > 0 && (
        <section className={SIDE} data-testid="profile-words">
            <SectionHead id="words" title="Words" aside={<Caps className="text-tea-readgold">{wordCount === 1 ? '1 article' : `${wordCount} articles`}</Caps>} />
            {lead && (
              <a href={lead.href} className="block text-tea-text transition-colors hover:text-tea-gold-lt">
                {lead.cover && <img src={lead.cover} alt="" loading="lazy" className="h-[150px] w-full rounded-[2px] object-cover md:h-[220px]" />}
                <span className={`block ${lead.cover ? 'mt-3.5' : ''}`}><Caps className="text-tea-readgold">Wrote · {lead.season}</Caps></span>
                <span className="mt-1.5 block font-display text-ui-26 leading-[1.15]">{lead.title}</span>
                {lead.subtitle && <span className="subtitle mt-1.5 block text-ui-15">{lead.subtitle}</span>}
                <span className="mt-2.5 block font-sans text-ui-12 text-tea-text-sec">{['Journal', lead.readTime].filter(Boolean).join(' · ')}</span>
              </a>
            )}
            {rows.map((row, index) => (
              <a
                key={row.key}
                href={row.href}
                className={`grid grid-cols-[72px_minmax(0,1fr)] items-start gap-3.5 pt-5 text-tea-text transition-colors hover:text-tea-gold-lt ${index > 0 || lead ? 'mt-7 border-t border-tea-border' : ''}`}
              >
                <CoverSquare src={row.cover} />
                <span className="min-w-0">
                  <Caps className="text-tea-readgold">{ROW_LABEL[row.kind]} · {row.season}</Caps>
                  <span className="mt-1 block font-display text-ui-20 leading-[1.2]">{row.title}</span>
                  {row.quote ? (
                    <span className="subtitle mt-2 block text-ui-14 leading-[1.45]">“{row.quote}”</span>
                  ) : row.subtitle ? (
                    <span className="subtitle mt-2 block text-ui-14 leading-[1.45]">{row.subtitle}</span>
                  ) : null}
                  <span className="mt-2 block font-sans text-ui-12 text-tea-text-sec">
                    {row.landsOnPassage ? 'Opens at the passage' : ['Journal', row.readTime].filter(Boolean).join(' · ')}
                  </span>
                </span>
              </a>
            ))}
        </section>
      )}

      {/* ── The teas ───────────────────────────────────────────────────────── */}
      {hasTeas && (
        <section className={SIDE} data-testid="profile-teas">
            <SectionHead id="teas" title="The teas" />
            {collection ? (
              <a href={teasHref} className="block text-tea-text transition-colors hover:text-tea-gold-lt">
                {collection.hero_image_url && <img src={collection.hero_image_url} alt="" loading="lazy" className="h-[170px] w-full rounded-[2px] object-cover md:h-[240px]" />}
                <span className={`block ${collection.hero_image_url ? 'mt-3.5' : ''}`}><Caps className="text-tea-readgold">Collection · {collection.item_count === 1 ? '1 tea' : `${collection.item_count} teas`}</Caps></span>
                <span className="mt-1.5 block font-display text-ui-26 leading-[1.15]">{collection.title}</span>
                {collection.note && <span className="body-light mt-1.5 block max-w-[44ch] text-ui-15">{collection.note}</span>}
              </a>
            ) : (
              <p className="body-light max-w-[44ch] text-ui-15 text-tea-text-sec">The teas {first} pours and keeps coming back to, each with a line on why.</p>
            )}
            <a href={teasHref} className="cta-solid tap-target mt-4 flex min-h-[48px] w-full items-center justify-center rounded-md px-5 font-sans text-ui-13 font-medium tracking-[0.04em]">
              {collection ? 'Open the collection' : 'See the full selection'}
            </a>
            {shownTeas.length > 0 && (
              <ol className="-mx-4 mt-6 border-t border-tea-border md:-mx-6" aria-label={`${first}'s teas`}>
                {shownTeas.map(tea => <TeaSelectionRow key={tea.tea_profile_id} tea={tea} />)}
              </ol>
            )}
            {moreTeas > 0 && (
              <CapsLink href={teasHref}>And {moreTeas} more, in the {collection ? 'collection' : 'selection'}</CapsLink>
            )}
        </section>
      )}

      {/* ── Hosting ────────────────────────────────────────────────────────── */}
      {hosting && (
        <section className={SIDE} data-testid="profile-hosting">
            <SectionHead id="hosting" title="Hosting" aside={<CapsLink href="/events">all sessions</CapsLink>} />
            <a href={`/event/${encodeURIComponent(hosting.slug)}`} className="grid grid-cols-[120px_minmax(0,1fr)] items-center gap-4 text-tea-text transition-colors hover:text-tea-gold-lt">
              {hosting.flyer_image_url ? (
                <img src={hosting.flyer_image_url} alt="" loading="lazy" className="h-[150px] w-[120px] rounded-[2px] object-cover" />
              ) : (
                <span aria-hidden="true" className="flex h-[150px] w-[120px] items-center justify-center rounded-[2px] bg-tea-elevated font-display text-ui-28 font-light text-tea-text-dim">茶</span>
              )}
              <span>
                <Caps className="text-tea-readgold">{formatEventMoment(hosting.event_date)}</Caps>
                <span className="mt-1.5 block font-display text-[24px] leading-[1.15]">{hosting.title}</span>
                <span className="mt-1.5 block font-sans text-ui-13 text-tea-text-sec">{[hosting.account_name, hosting.location_name].filter(Boolean).join(' · ')}</span>
              </span>
            </a>
        </section>
      )}

      {/* ── Their house ────────────────────────────────────────────────────── */}
      {house && houseHref && (
        <section className={SIDE} data-testid="profile-house">
            <SectionHead id="house" title={`${words.Possessive} house`} aside={<CapsLink href={houseHref}>the store</CapsLink>} />
            <a href={houseHref} className="grid grid-cols-[72px_minmax(0,1fr)] items-center gap-3.5 text-tea-text transition-colors hover:text-tea-gold-lt">
              <span className="block h-[72px] w-[72px] overflow-hidden rounded-[2px]"><ContributorIdentityMark name={house.name} /></span>
              <span>
                <span className="block font-display text-[22px] leading-[1.15]">{house.name}</span>
                <span className="mt-1 block font-sans text-ui-12 text-tea-text-sec">{['Shop', 'events', 'about', housePlace].filter(Boolean).join(' · ')}</span>
              </span>
            </a>
        </section>
      )}

      {/* ── Reach ──────────────────────────────────────────────────────────── */}
      {hasReach && (
        <section className={SIDE} data-testid="profile-reach">
            <SectionHead id="reach" title={`Reach ${words.object}`} />
            <div className={`grid border-t border-tea-border ${wechat && otherLinks.length ? "grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]" : "grid-cols-1"}`}>
              {wechat && <WeChatCell link={wechat} />}
              {otherLinks.length > 0 && (
                <div className={`flex flex-col justify-center gap-1 border-b border-tea-border py-3 ${wechat ? 'pl-3.5' : ''}`}>
                  {otherLinks.map((link, index) => {
                    const href = linkHref(link);
                    const inner = (
                      <>
                        <span className="flex text-tea-readgold"><PlatformMark platform={link.platform} size={15} /></span>
                        <span className="truncate">{link.label && link.platform === 'other' ? link.label : linkLabel(link)}</span>
                      </>
                    );
                    return href ? (
                      <a key={`${link.platform}-${index}`} href={href} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center gap-2 font-sans text-ui-13 text-tea-text hover:text-tea-gold-lt">{inner}</a>
                    ) : (
                      <span key={`${link.platform}-${index}`} className="inline-flex min-h-[44px] items-center gap-2 font-sans text-ui-13 text-tea-text">{inner}</span>
                    );
                  })}
                </div>
              )}
            </div>
        </section>
      )}

      {/* ── Closing ────────────────────────────────────────────────────────── */}
      <section className={`${SIDE} pt-16 pb-6`}>
        {data.closing && <p className="subtitle max-w-[30ch] text-[19px]">{data.closing}</p>}
        <p className={data.closing ? 'mt-5' : ''}><CapsLink href="/people">All people</CapsLink></p>
      </section>
    </article>
  );
}
