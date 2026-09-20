import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { ContributorIdentityMark } from '../components/shared/ContributorIdentityMark';
import { PLATFORM_NAMES } from '../components/people/PlatformMark';
import {
  Cover,
  Dek,
  GroupHead,
  IndexRow,
  IndexRowButton,
  Kicker,
  HubCells,
  PeopleNav,
  PeopleRoot,
  SplitName,
  StickyChrome,
  useReadingProgress,
  useReveals,
} from '../components/people/immersive';
import {
  countWord,
  coverKicker,
  formatEventLong,
  galleryPlacement,
  instagramHref,
  issueNumberFromId,
  ownLine,
  paragraphsOf,
  websiteLabel,
} from '../components/people/profileFormat';
import { useContributor } from '../hooks/useContributor';
import type {
  ContributorArticleRef,
  ContributorFeaturedRef,
  ContributorLink,
  ContributorProfile,
  ContributorPullQuote,
  ContributorTeaSelectionRef,
} from '../types';

// /people/:slug. A creator's public page, phone first: the page that goes in
// an Instagram or WeChat bio. Built to the "Profile" board of the Creator
// Profiles canvas (version 14, 2026-09-20): the Read section's design and
// interaction, in the person's own words.
//
// The sticky block at the top is the Teajia nav with the gold reading-progress
// line, alone. The portrait is a lead cover: thin gold border, fade, kicker,
// the name with an italic gold surname, one first-person line. Directly under
// it, the hub: a row of equal bordered cells in the Cinema manner, exactly
// Words, Teas and Pay, no counts, each only when the tea master has it, so
// fewer cells share the width. Then the groups, each fading and lifting in as
// it arrives: In my words, Hands on, Words, The teas, Hosting, My table, Reach
// me. Everything else is a plain row: title, italic dek, and a caps rubric
// only where one adds something (a session, a platform); tea rows carry none.
//
// Every word the tea master says is first person; the labels never speak
// about them in the third person. Every section is conditional except the
// cover; a sparse profile keeps only what it has. No arrows anywhere.

const SIDE = 'px-6';
const CHINESE_FONT_STACK = "'Noto Serif SC','Cormorant Garamond',serif";

// ── Words rows ────────────────────────────────────────────────────────────────

interface WordRow {
  key: string;
  href: string;
  title: string;
  dek: string | null;
}

function articleHref(slug: string, anchor?: string | null): string {
  return `/article/${encodeURIComponent(slug)}${anchor ? `#${anchor}` : ''}`;
}

function wordRows(data: ContributorProfile): WordRow[] {
  const authored = data.articles.map((article: ContributorArticleRef): WordRow => ({
    key: `wrote-${article.slug}`,
    href: articleHref(article.slug),
    title: article.title,
    dek: article.subtitle ?? null,
  }));
  const authoredSlugs = new Set(data.articles.map(article => article.slug));
  // A row carries no rubric and never repeats the quote: the article's
  // subtitle is the dek, and a piece where I am quoted rather than the author
  // says so inside that line, in my words, and lands on the passage.
  const passage = 'I am quoted in it; it opens at the passage.';
  const mention = 'I am in it.';
  const quoted = data.pull_quotes
    .filter((quote: ContributorPullQuote) => !authoredSlugs.has(quote.article_slug))
    .map((quote): WordRow => ({
      key: `quoted-${quote.article_slug}`,
      href: articleHref(quote.article_slug, quote.quote_anchor),
      title: quote.article_title,
      dek: [quote.article_subtitle, quote.quote_anchor ? passage : mention].filter(Boolean).join(' ') || null,
    }));
  const quotedSlugs = new Set(data.pull_quotes.map(quote => quote.article_slug));
  const featured = data.featured_in
    .filter((article: ContributorFeaturedRef) => !authoredSlugs.has(article.slug) && !quotedSlugs.has(article.slug))
    .map((article): WordRow => ({
      key: `featured-${article.slug}`,
      href: articleHref(article.slug, article.quote_anchor),
      title: article.title,
      dek: [article.subtitle, article.quote_anchor ? passage : mention].filter(Boolean).join(' ') || null,
    }));
  return [...authored, ...quoted, ...featured];
}

// ── The teas ──────────────────────────────────────────────────────────────────

/**
 * A plain row: the tea's name with its Chinese name inline, and my note as
 * the dek. No rubric. Adrian, canvas version 20 (2026-09-20): no type, no
 * year, no tinted word on the right; the collection cover above and the
 * "And N more" line below carry the context.
 */
function TeaRow({ tea }: { tea: ContributorTeaSelectionRef }) {
  const origin = (tea.origin ?? '').split(',').map(part => part.trim()).filter(Boolean).slice(0, 2).join(', ');
  return (
    <IndexRow
      to={tea.public_path}
      testId="profile-tea-row"
      title={(
        <>
          {tea.product_name || tea.name}
          {tea.chinese_name && <span className="ml-2 text-ui-15 text-tea-text-sec" style={{ fontFamily: CHINESE_FONT_STACK }}>{tea.chinese_name}</span>}
        </>
      )}
      dek={tea.why || origin || null}
    />
  );
}

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
  if (link.platform === 'other' && link.label) return link.label;
  return link.value;
}

/** One plain row per link: the handle as the title, the platform as the rubric. WeChat copies on tap, since it has no address to open. */
function ReachRow({ link }: { link: ContributorLink }) {
  const [copied, setCopied] = useState(false);
  const href = linkHref(link);
  const rubric = link.platform === 'other' && link.label ? link.label : PLATFORM_NAMES[link.platform];
  if (link.platform === 'wechat' || !href) {
    const copy = async () => {
      try {
        await navigator.clipboard.writeText(link.value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      } catch {
        setCopied(false);
      }
    };
    return <IndexRowButton onClick={copy} title={copied ? 'Copied' : link.value} dek={link.platform === 'wechat' ? 'Tap to copy my id.' : undefined} rubric={rubric} ariaLabel={`Copy ${rubric} id ${link.value}`} testId="profile-reach-row" />;
  }
  return <IndexRow to={href} external title={linkLabel(link)} rubric={rubric} ariaLabel={`${rubric}: ${linkLabel(link)}`} testId="profile-reach-row" />;
}

function Section({ id, children, testId }: { id?: string; children: ReactNode; testId?: string }) {
  return <section id={id} data-reveal className="scroll-mt-[96px]" data-testid={testId}>{children}</section>;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ContributorProfilePage() {
  const { slug } = useParams<{ slug: string }>();
  const { data, isLoading, isError, error, refetch } = useContributor(slug);
  const rootRef = useReveals([data?.id]);
  const progress = useReadingProgress();

  useEffect(() => {
    if (data?.display_name) {
      document.title = `${data.display_name} · Teajia`;
    }
  }, [data?.display_name]);

  if (isLoading) {
    return (
      <PeopleRoot>
        <div aria-label="Loading profile" className="mx-auto w-full max-w-2xl animate-pulse px-6 pt-6">
          <div className="h-[420px] w-full bg-tea-surface" />
          <div className="mt-10 h-4 w-32 bg-tea-surface" />
          <div className="mt-6 h-40 bg-tea-surface" />
        </div>
      </PeopleRoot>
    );
  }

  if (isError || !data) {
    return (
      <PeopleRoot>
        <PeopleNav eyebrow="People" progress={0} backTo="/people" />
        <div className="mx-auto flex min-h-[60vh] w-full max-w-2xl items-center justify-center px-6 text-center">
          <div>
            <p role="alert" className="subtitle">{error instanceof Error ? error.message : 'This profile could not be loaded.'}</p>
            <button type="button" onClick={() => refetch()} className="tap-target mt-5 text-ui-13 text-tea-gold hover:text-tea-gold-lt">Retry</button>
          </div>
        </div>
      </PeopleRoot>
    );
  }

  const issueNumber = issueNumberFromId(data.id);
  const portrait = data.portrait_url || data.avatar_url || null;
  const kicker = coverKicker(data.role, data.location_line);
  const coverLine = ownLine(data);

  // In my words: the quote, then two paragraphs, now first and then where it began.
  const quote = data.pull_quotes[0]?.pull_quote
    ?? data.articles.find(article => article.pull_quote)?.pull_quote
    ?? null;
  const paragraphs = [...paragraphsOf(data.now_text), ...paragraphsOf(data.beginnings), ...paragraphsOf(data.inspirations)].slice(0, 2);
  const hasWords = Boolean(quote || paragraphs.length);

  const gallery = data.gallery_images;
  const rows = wordRows(data);
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
      return hostRow ? { id: hostRow.account_id ?? '', slug: hostRow.account_slug ?? hostRow.slug ?? '', name: hostRow.account_name ?? hostRow.name ?? '', location_city: hostRow.location_city, location_country: hostRow.location_country } : null;
    })();
  const canPay = data.has_payment_methods === true;
  const payHref = `/people/${encodeURIComponent(data.id)}/pay`;
  const links = data.links;

  const cells = [
    rows.length > 0 ? { id: 'words', label: 'Words', href: '#words' } : null,
    hasTeas ? { id: 'teas', label: 'Teas', href: '#teas' } : null,
    canPay ? { id: 'pay', label: 'Pay', href: payHref, route: true } : null,
  ].filter((cell): cell is NonNullable<typeof cell> => cell !== null);

  const collectionTitle = collection?.title ?? '';
  const [collectionFirst, ...collectionRest] = collectionTitle.split(' ');

  return (
    <PeopleRoot rootRef={rootRef} testId="creator-profile">
      <StickyChrome>
        <PeopleNav eyebrow={`People · N°${issueNumber}`} progress={progress} backTo="/people" />
      </StickyChrome>
      <article className="relative z-[1] mx-auto w-full max-w-2xl pb-nav-gap-lg">

        {/* ── The cover ──────────────────────────────────────────────────── */}
        <header className={`${SIDE} pt-6`}>
          <Cover
            to={portrait ?? '#'}
            image={portrait}
            imageAlt={`Portrait of ${data.display_name}`}
            fallback={<ContributorIdentityMark name={data.display_name} />}
            height={420}
            testId="profile-cover"
            ariaLabel={`${data.display_name}, portrait`}
          >
            {kicker && <Kicker className="mb-3">{kicker}</Kicker>}
            <h1 className="font-display text-[40px] leading-[0.98] text-tea-text"><SplitName name={data.display_name} /></h1>
            {data.chinese_name && <p className="mt-2 text-[22px] leading-none tracking-[0.08em] text-tea-readgold" style={{ fontFamily: "'Ma Shan Zheng','Noto Serif SC',cursive" }}>{data.chinese_name}</p>}
            {coverLine && <Dek className="mt-3 max-w-[30ch] text-ui-14">{coverLine}</Dek>}
          </Cover>
          {/* The hub: three cells at most, side by side, sharing the width. */}
          <HubCells cells={cells} testId="profile-hub" />
        </header>

        {/* ── In my words ────────────────────────────────────────────────── */}
        {hasWords && (
          <Section testId="profile-words-of-mine">
            <div className={SIDE}>
              <GroupHead label="In my words" />
              {quote && <p className="mt-3.5 max-w-[22ch] font-display text-ui-26 font-light leading-[1.2] text-tea-text" data-testid="profile-quote">“{quote}”</p>}
              {paragraphs.map((paragraph, index) => (
                <p key={index} className={`font-body text-ui-15 leading-[1.65] text-tea-text ${index === 0 ? 'mt-[18px]' : 'mt-3.5'}`}>{paragraph}</p>
              ))}
            </div>
          </Section>
        )}

        {/* ── Hands on ───────────────────────────────────────────────────── */}
        {gallery.length > 0 && (
          <Section testId="profile-gallery">
            <div className={SIDE}>
              <GroupHead label="Hands on" />
              <ul className="mt-3.5 grid grid-cols-2 auto-rows-[108px] gap-1 md:auto-rows-[170px]" aria-label="Photos at work">
                {gallery.map((image, index) => {
                  const place = galleryPlacement(index);
                  return (
                    <li key={image.id ?? `${image.image_url}-${index}`} style={{ gridColumn: place.columnSpan === 2 ? 'span 2' : undefined, gridRow: place.rowSpan === 2 ? 'span 2' : undefined }}>
                      <img src={image.image_url} alt={image.caption ?? ''} loading="lazy" className="h-full w-full object-cover" />
                    </li>
                  );
                })}
              </ul>
            </div>
          </Section>
        )}

        {/* ── Words ──────────────────────────────────────────────────────── */}
        {rows.length > 0 && (
          <Section id="words" testId="profile-words">
            <div className={SIDE}>
              <GroupHead label="Words" />
              {rows.map(row => (
                <IndexRow key={row.key} to={row.href} title={row.title} dek={row.dek} testId="profile-word-row" />
              ))}
            </div>
          </Section>
        )}

        {/* ── The teas ───────────────────────────────────────────────────── */}
        {hasTeas && (
          <Section id="teas" testId="profile-teas">
            <div className={SIDE}>
              <GroupHead label="The teas" />
              {collection && (
                <div className="mt-3.5">
                  <Cover to={teasHref} image={collection.hero_image_url} imageOpacity={0.55} height={128} fadeFull testId="profile-collection" ariaLabel={`Open the collection ${collection.title}`}>
                    <Kicker size={8.5} className="mb-[7px]">My collection · {countWord(collection.item_count)} teas</Kicker>
                    <span className="block font-display text-[25px] leading-none text-tea-text">
                      {collectionFirst}
                      {collectionRest.length > 0 && <> <span className="italic text-tea-readgold">{collectionRest.join(' ')}</span></>}
                    </span>
                  </Cover>
                </div>
              )}
              {shownTeas.length > 0 && (
                <div>
                  {shownTeas.map(tea => <TeaRow key={tea.tea_profile_id} tea={tea} />)}
                </div>
              )}
              {moreTeas > 0 && (
                <a href={teasHref} className="tap-target mt-1.5 inline-flex min-h-[44px] items-center font-sans text-[9.5px] uppercase tracking-[0.26em] text-tea-readgold hover:text-tea-gold-lt">
                  And {countWord(moreTeas)} more, in the {collection ? 'collection' : 'selection'}
                </a>
              )}
            </div>
          </Section>
        )}

        {/* ── Hosting ────────────────────────────────────────────────────── */}
        {hosting && (
          <Section id="hosting" testId="profile-hosting">
            <div className={SIDE}>
              <GroupHead label="Hosting" />
              <IndexRow
                to={`/event/${encodeURIComponent(hosting.slug)}`}
                title={hosting.title}
                dek={[`${formatEventLong(hosting.event_date)}, at ${hosting.location_name ?? hosting.account_name}.`, hosting.subtitle ? `${hosting.subtitle}.` : null].filter(Boolean).join(' ')}
                rubric="Session"
              />
            </div>
          </Section>
        )}

        {/* ── My table ───────────────────────────────────────────────────── */}
        {house && (
          <Section id="house" testId="profile-house">
            <div className={SIDE}>
              <GroupHead label="My table" />
              <IndexRow
                to={`/store/${encodeURIComponent(house.slug)}`}
                title={house.name}
                dek={`My shop and sessions${house.location_city ? ` in ${house.location_city}` : ''}, and how to find the door.`}
              />
            </div>
          </Section>
        )}

        {/* ── Reach me ───────────────────────────────────────────────────── */}
        {links.length > 0 && (
          <Section id="reach" testId="profile-reach">
            <div className={SIDE}>
              <GroupHead label="Reach me" />
              {links.map((link, index) => <ReachRow key={`${link.platform}-${index}`} link={link} />)}
            </div>
          </Section>
        )}

        {/* ── Closing ────────────────────────────────────────────────────── */}
        <footer data-reveal className={`${SIDE} pb-16 pt-14 text-center`}>
          {data.closing && <Dek className="text-ui-16">{data.closing}</Dek>}
          <a href="/people" className={`tap-target inline-flex min-h-[44px] items-center font-sans text-[9.5px] uppercase tracking-[0.22em] text-tea-text-dim hover:text-tea-text ${data.closing ? 'mt-5' : ''}`}>All people</a>
        </footer>
      </article>
    </PeopleRoot>
  );
}
