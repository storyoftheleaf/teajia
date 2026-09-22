import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useShopPrice } from '../components/shop/shopPrice';
import { usePublicProducts } from '../hooks/usePublicProducts';
import { useSectionReveal } from '../hooks/useSectionReveal';
import { LogoText } from '../components/Logos/LogoText';
import { StoryEditProvider, type PhotoVal } from './read/storyEdit';
import EditablePhoto from './read/EditablePhoto';
import StoryEditorBar from './read/StoryEditorBar';
import type { PublicProduct } from '../types';

/**
 * The home page. Cover C from the 2026-09-20 round, built beside the old
 * page at /v2 and swapped in on 2026-09-22. The old page stays in
 * components/HomePage.tsx, unrouted, until the next cleanup.
 *
 * Three movements, one spacing unit between them, no horizontal rules:
 *
 *   The opener: the statement on the left, the photograph of the table on
 *   the right, the height of the first screen. The one real photograph the
 *   site owns, used once, first and large.
 *
 *   The table: three plates of equal width, the piece to read, the tea on
 *   the table, the consult. Each is a photograph with its words under it.
 *
 *   The house: on the surface tone, the four grounding lines and the email
 *   down the left, the three characters large on the right as the house's
 *   own picture. Identity as image, not decoration.
 *
 * Every line of text starts at the same left edge, four rems past the
 * sidebar. Three sizes of type: display for titles, body for sentences and
 * for the grounding lines (which keep the live page's face exactly), meta
 * for the facts under them. The opener alone is bigger.
 *
 * STAND-IN PHOTOGRAPHS: the plates carry Unsplash pictures until the real
 * ones exist, so the structure can be judged with imagery in it. They are
 * named in TEMPLATE below and nowhere else; each is replaced by the real
 * photograph the moment one is published (the piece's portrait on its story
 * page, the tea's image in the admin, the table photograph in the opener's
 * own frame).
 */

const PIECE = {
  slug: 'porcelain-and-tea',
  to: '/read/porcelain-and-tea',
  meta: 'The Lead · N°15',
  dek: 'A porcelain restorer on repair, patience, and how mending what we love mends us in return.',
};

/** The one photograph the site owns today: Adrian at the table. Served by the
 *  same-origin media route, as every site image is since main moved off Cloudinary. */
const TABLE_PHOTO = '/api/media/site/2021-06-27_IMG_7745_Original_ehkz30.jpg';

/** Stand-ins until the real photographs exist, served from this site rather
 *  than hot-linked: the china-dependency scan refuses stock hosts under src/
 *  and public/, because a customer in China cannot load one. See
 *  public/home/README.md; they go when the real photographs arrive. */
const TEMPLATE = {
  piece: '/home/standin-piece.webp',
  tea: '/home/standin-tea.webp',
  consult: '/home/standin-consult.webp',
};

/** The home page's own slug in the story-content store, for the frames it carries. */
const HOME_SLUG = 'home';

/** The left edge every line of text on the page starts from, on desktop. */
const EDGE = 'lg:pl-[calc(var(--teajia-sidebar-w)+4rem)]';

/** The three sizes. */
const DISPLAY = 'font-display font-normal text-[clamp(26px,2.5vw,36px)] leading-[1.1] tracking-[0.01em]';
/** A plate's title: one step up from display, since a plate is a cover. */
const TITLE = 'font-display font-normal text-[clamp(28px,2.9vw,42px)] leading-[1.06] tracking-[0.005em]';
const BODY = 'font-body text-ui-16 leading-[1.65]';
const META = 'font-sans text-ui-12 leading-[1.5] tracking-[0.02em]';

/** One treatment on every photograph, so stand-ins and the night shot read as one set. Applies to the frame, so an owner's own upload gets it too. */
const PHOTO = '[&_img]:saturate-[.85]';

/** The one spacing unit between movements. */
const MOVEMENT = 'mt-16 sm:mt-20 lg:mt-24';

/** The tea on the table: a featured one if Adrian has flagged one, else the oldest lot on the shelf. */
const pickTea = (products: PublicProduct[]): PublicProduct | null => {
  const teas = products.filter(p => p.type !== 'Teaware' && !p.teawareCategory && p.status === 'Active' && p.stockGrams > 0);
  if (teas.length === 0) return null;
  const featured = teas.find(p => p.isFeatured);
  if (featured) return featured;
  const dated = teas.filter(p => typeof p.year === 'number');
  if (dated.length > 0) return dated.slice().sort((a, b) => (a.year as number) - (b.year as number))[0];
  return teas[0];
};

const HomeV2Page: React.FC = () => {
  // The shop's own hook, so the rows arrive normalised. A raw fetch under the
  // same key showed the tea only when another page had filled the cache first.
  const { data: products } = usePublicProducts();
  const tea = useMemo(() => pickTea(Array.isArray(products) ? products : []), [products]);
  const shopPrice = useShopPrice();

  // The piece's own cover portrait, the one Adrian drops onto the story page
  // and publishes there. The moment it is live there it is live here.
  const { data: pieceContent } = useQuery({
    queryKey: ['story-content', PIECE.slug, 'published'],
    queryFn: () => api.storyContent.get(PIECE.slug) as Promise<{ photos?: Record<string, PhotoVal> }>,
    staleTime: 5 * 60 * 1000,
  });
  const portrait = pieceContent?.photos?.portrait;


  // The page breaks out of the main column's gutter, and on desktop out of the
  // column itself, so the photographs run from the left edge of the window,
  // behind the floating sidebar, to the right edge. The text pads itself back
  // past the sidebar so nothing readable sits under it. --teajia-sidebar-w is
  // what the sidebar sets as it expands and collapses, so the page follows it.
  return (
    <StoryEditProvider slug={HOME_SLUG}>
    <div className="-mx-4 md:-mx-6 lg:-mr-10 lg:ml-[calc(-2.5rem-var(--teajia-sidebar-w))] lg:-mb-8 bg-tea-bg text-tea-text">
      <Helmet>
        <title>Teajia. Fine Tea &amp; Teaware</title>
        <meta name="description" content="A home for tea. Source it, study it, and share it with those who gather around the cup." />
        <meta property="og:title" content="Teajia. Fine Tea &amp; Teaware" />
        <meta property="og:description" content="A home for tea. Source it, study it, and share it with those who gather around the cup." />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Teajia. Fine Tea &amp; Teaware" />
        <link rel="preload" as="image" href={TABLE_PHOTO} />
        <meta name="twitter:description" content="A home for tea. Source it, study it, and share it with those who gather around the cup." />
      </Helmet>

      {/* The opener: the statement beside the photograph of the table, the
          height of the first screen. The frame is the Read pages' own: signed
          in as owner, the editor bar turns editing on, a photograph drops,
          pastes or is chosen into it, and Publish makes it live. Until one is
          published the table photograph stands in. */}
      <section aria-label="Teajia" className="grid grid-cols-1 lg:grid-cols-[var(--teajia-sidebar-w)_minmax(0,1.45fr)_minmax(0,1fr)] lg:min-h-[88vh]">
        <div className={`lg:col-start-2 px-6 sm:px-10 lg:pl-[4rem] lg:pr-16 pt-14 sm:pt-20 lg:pt-0 pb-10 lg:pb-0 flex flex-col justify-center`}>
          <h1
            className="font-display font-light text-tea-text max-w-[26ch] text-[clamp(38px,3.9vw,66px)] leading-[1.06] tracking-[0.005em]"
            style={{ textWrap: 'balance' }}
          >
            Tea deepens with what<br className="hidden xl:inline" /> you bring to the table<br className="hidden xl:inline" /> and what you leave behind.
          </h1>
          {/* No tap-target here: it sets a 44px floor per line, which read as a blank line between each. The 26px line box clears the 24px AA target size on its own. */}
          <nav aria-label="Homepage destinations" className="mt-8 flex flex-col items-start gap-0">
            {[
              { accent: 'Source', rest: ' your tea.', to: '/shop' },
              { accent: 'Discover', rest: ' the stories.', to: '/read' },
              { accent: 'Deepen', rest: ' your practice.', to: '/craft' },
              { accent: 'Create', rest: ' the spaces to share.', to: '/advise' },
            ].map(item => (
              <Link
                key={item.to}
                to={item.to}
                className={`group inline-flex items-baseline gap-1 whitespace-nowrap rounded-md py-0 ${BODY} tracking-[0.015em] text-tea-text-sec transition-colors duration-300 hover:text-tea-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/40 focus-visible:ring-offset-2 focus-visible:ring-offset-tea-bg`}
              >
                <span className="font-medium text-tea-gold">{item.accent}</span>
                <span className="underline decoration-tea-gold/0 underline-offset-[4px] transition-all duration-300 group-hover:decoration-tea-gold/30">{item.rest}</span>
              </Link>
            ))}
          </nav>
          {/* The opener's way in: the Start Here page, six paths into the
              practice. Discover your tea lives in Craft now, not here. */}
          <p className={`${BODY} italic mt-5 text-tea-text-sec`}>
            <Link to="/start" className="hover:text-tea-gold transition-colors duration-300">New here? Start here</Link>
          </p>
        </div>
        <div className={`relative lg:col-start-3 min-h-[320px] sm:min-h-[60vh] lg:min-h-0 overflow-hidden bg-tea-surface ${PHOTO}`}>
          <span className={`pointer-events-none absolute left-4 bottom-4 z-10 px-2 py-1 ${META} text-tea-text-sec`} style={{ background: 'rgb(var(--tea-bg-rgb) / 0.55)' }}>At the table, Bali</span>
          <EditablePhoto
            slot="table"
            alt="At the table"
            fill
            placeholderBg="var(--tea-surface)"
            placeholder={<img src={TABLE_PHOTO} alt="" fetchPriority="high" className="absolute inset-0 w-full h-full object-cover" style={{ objectPosition: '68% 82%' }} />}
          />
        </div>
      </section>

      {/* The table: three plates of equal width. */}
      <section
        aria-label="On the table"
        className={`mt-8 sm:mt-10 lg:mt-12 ${EDGE} grid grid-cols-1 md:grid-cols-3 gap-y-8 md:gap-y-0 md:gap-x-[2px] ${PHOTO}`}
      >
        <Plate
          to={PIECE.to}
          title={<>Porcelain <span className="italic text-tea-gold">and Tea</span></>}
          body={PIECE.dek}
          meta={PIECE.meta}
          src={portrait?.url ?? TEMPLATE.piece}
          crop={portrait?.crop}
        />
        <Plate
          to={tea ? `/shop/product/${tea.slug ?? tea.id}` : '/shop'}
          title={tea ? tea.productName : 'On the shelf'}
          body={tea ? teaLine(tea) : 'Twenty teas, chosen one lot at a time.'}
          meta={tea ? <>50 g · <span className="text-tea-gold">{shopPrice.total(tea.pricePerGramUSD * 50)}</span></> : 'On the shelf'}
          src={tea?.imageUrl || TEMPLATE.tea}
        />
        <Plate
          to="/advise"
          title="Twenty years in tea culture."
          body="Taiwan, China, Japan, Bali, and beyond. Tea for your practice, your collection, your space."
          meta="The consult"
          src={TEMPLATE.consult}
        />
      </section>

      {/* The house: one panel from the reading edge to the window's edge,
          the only tonal block on the page. What the name is, for someone who
          has never met the word: the wordmark leads; Adrian's two lines split
          it into tea and jiā; then jiā three times under three characters,
          each a facet, in his words; the spirit and the motto; and, last, the
          way to stay. Nothing is explained; the facets show themselves.
          Centred, because three pillars are a symmetric idea. The characters
          enter once, as they do on the live page: 家 first, 佳 and 嘉 from
          the sides. More air above the wordmark than below the last line. */}
      <section aria-label="The house" className={`${MOVEMENT} ${EDGE}`}>
        <div className="bg-tea-elevated px-6 sm:px-10 lg:px-16 pt-20 sm:pt-24 lg:pt-28 pb-14 sm:pb-16 lg:pb-20 flex flex-col items-center text-center">
          <LogoText size="panel" color="var(--tea-text)" />
          <p className={`${BODY} italic mt-6 tracking-[0.06em] text-tea-text-sec`}>
            <span className="not-italic font-semibold text-tea-gold">tea</span> · leaf and water
          </p>
          <p className={`${BODY} italic tracking-[0.06em] text-tea-text-sec`}>
            <span className="not-italic font-semibold text-tea-gold">jiā</span> · one sound, three pillars…
          </p>
          <div className="mt-8 w-full max-w-[880px]">
            <div className="grid grid-cols-3 gap-x-3 sm:gap-x-6">
              {FACETS.map((c, i) => (
                <Facet key={c.zi} {...c} index={i} />
              ))}
            </div>
            {/* On the phone the three sentences read as a list under the row, not a tower. */}
            <ul className="sm:hidden mt-8 flex flex-col gap-4 text-left">
              {FACETS.map(c => (
                <li key={c.zi} className={`${BODY} text-tea-text-sec`}>
                  <span className="font-display text-tea-text">{c.title}. </span>{c.text}
                </li>
              ))}
            </ul>
            <p className={`${BODY} mt-12 text-tea-text-sec`}>
              A home for tea. A place to source it, study it, and share it with those who gather around the cup.
            </p>
            <p className={`${BODY} italic mt-3 tracking-[0.04em] text-tea-text-dim`}>
              Honor the past. Live in the present. Build for the future.
            </p>
          </div>
          <div className="mt-16 w-full max-w-[360px]">
            <p className={`${BODY} italic tracking-[0.04em] text-tea-text-dim`}>stay connected</p>
            <p className={`${DISPLAY} italic mt-1 text-tea-text`}>it&apos;s nothing without you</p>
            <div className="mt-6">
              <EmailField />
            </div>
            <p className={`${META} mt-6 text-tea-text-sec`}>
              <Link to="/signup" className="text-tea-gold/80 hover:text-tea-gold transition-colors duration-300">Create an account</Link>
              {' · '}
              <Link to="/signin" className="text-tea-gold/80 hover:text-tea-gold transition-colors duration-300">Sign in</Link>
            </p>
          </div>
          {/* The footer is hidden on this page, so the way out is the panel's last line. */}
          <p className={`${META} mt-14 flex flex-wrap justify-center gap-x-5 gap-y-1 text-tea-text-sec`}>
          <Link to="/events" className="hover:text-tea-text transition-colors">sessions</Link>
          <Link to="/people" className="hover:text-tea-text transition-colors">people</Link>
          <Link to="/spaces" className="hover:text-tea-text transition-colors">spaces</Link>
          <Link to="/about" className="hover:text-tea-text transition-colors">about</Link>
          <a href="https://instagram.com/teajia.journal" className="hover:text-tea-text transition-colors">instagram</a>
          <a href="mailto:hello@teajia.com" className="hover:text-tea-text transition-colors">contact</a>
          </p>
        </div>
      </section>
      <StoryEditorBar />
    </div>
    </StoryEditProvider>
  );
};

/** The three facets of jiā, in Adrian's words (2026-09-22). Three characters, one size, one sound; the sound is said once in the line above them. */
const FACETS = [
  { zi: '佳', title: 'Excellence', text: 'With the commitment to doing whatever we do, well.', enter: 'left' as const, delay: 260 },
  { zi: '家', title: 'Home', text: 'Both the place we live physically and energetically, connected and devoted to who we are, authentically.', enter: 'fade' as const, delay: 0 },
  { zi: '嘉', title: 'Celebration', text: 'And the act of sharing and giving, in reverence to life.', enter: 'right' as const, delay: 420 },
];

const Facet: React.FC<(typeof FACETS)[number] & { index: number }> = ({ zi, title, text, enter, delay }) => {
  const reveal = useSectionReveal(enter);
  return (
    <div
      ref={reveal.ref}
      className={`flex flex-col items-center ${reveal.className}`}
      style={reveal.style ? { ...reveal.style, transitionDelay: `${delay}ms` } : undefined}
    >
      <span
        className="flex items-end justify-center leading-none text-tea-gold text-[64px] sm:text-[108px] lg:text-[clamp(88px,7.8vw,150px)]"
        style={{ fontFamily: "'Ma Shan Zheng', cursive" }}
      >
        {zi}
      </span>
      <p className={`${DISPLAY} mt-4 text-tea-text`}>{title}</p>
      <p className={`${BODY} hidden sm:block mt-2 max-w-[34ch] text-tea-text-sec`}>{text}</p>
    </div>
  );
};

/** Origin, year and the last-of-the-lot note, in one line under the tea's name. */
const teaLine = (tea: PublicProduct): string => {
  const where = [tea.originRegion, tea.originCountry].filter(Boolean).join(', ');
  const when = tea.year ? String(tea.year) : '';
  const origin = where ? `From ${where}${when ? `, ${when}` : ''}.` : (when ? `From ${when}.` : '');
  const scarce = tea.isOneOfAKind || tea.stockGrams <= 150 ? ` ${tea.stockGrams} grams left, the last of the lot.` : '';
  return `${origin}${scarce}`.trim();
};

interface PlateProps {
  to: string;
  title: React.ReactNode;
  body: React.ReactNode;
  meta: React.ReactNode;
  src: string;
  /** The focal point and zoom saved with a story photograph, when it is one. */
  crop?: { scale: number; x: number; y: number };
}

/**
 * One plate on the table: a photograph with its words under it, a gutter
 * from its neighbour, never a card. Nothing here animates on entry: the
 * page's one authored entrance is the characters in the house.
 */
const Plate: React.FC<PlateProps> = ({ to, title, body, meta, src, crop }) => {
  const [hover, setHover] = useState(false);
  const focal = crop ? `${crop.x * 100}% ${crop.y * 100}%` : undefined;
  return (
    <Link
      to={to}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="group flex flex-row md:flex-col min-h-[220px] md:min-h-0 text-tea-text-sec focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-tea-gold/40"
    >
      <div className="relative shrink-0 basis-[45%] min-h-[220px] md:basis-auto md:min-h-0 md:aspect-[4/3] overflow-hidden bg-tea-surface">
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-[600ms] ease-out group-hover:scale-[1.02] motion-reduce:transform-none"
          style={crop ? { objectPosition: focal, transform: `scale(${crop.scale})`, transformOrigin: focal } : undefined}
        />
      </div>
      <div className="flex-1 flex flex-col pl-5 py-6 sm:pl-6 sm:py-8 md:pl-0 md:pr-8 md:py-8">
        <h2 className={`${TITLE} transition-colors duration-300 ${hover ? 'text-tea-gold' : 'text-tea-text'}`} style={{ textWrap: 'balance' }}>
          {title}
        </h2>
        <p className={`${BODY} mt-3 max-w-[44ch] text-tea-text-sec`}>{body}</p>
        <p className={`${META} mt-auto pt-4 text-tea-text-sec`}>{meta}</p>
      </div>
    </Link>
  );
};

/** The live page's email field: underline only, the word join at the end. */
const EmailField: React.FC = () => {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) { setState('error'); return; }
    setState('sending');
    try {
      await api.newsletter.subscribe(trimmed);
      setEmail('');
      setState('done');
    } catch {
      setState('error');
    }
  };

  if (state === 'done') {
    return <p className={`${BODY} text-tea-gold`}>you&apos;re on the list.</p>;
  }

  return (
    <form onSubmit={submit} className="relative w-full">
      <input
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder="your email"
        disabled={state === 'sending'}
        aria-label="Email address"
        className={`font-display w-full bg-transparent text-base tracking-[0.04em] text-tea-text outline-none pb-2.5 pr-10 placeholder:italic placeholder:text-tea-text-dim disabled:opacity-50 border-0 border-b border-tea-border rounded-none focus:border-tea-gold text-center pl-7`}
      />
      <button
        type="submit"
        disabled={state === 'sending'}
        aria-label="Subscribe"
        className="tap-target absolute right-0 bottom-1 font-display italic text-ui-12 text-tea-text-sec hover:text-tea-gold transition-colors bg-transparent border-0 cursor-pointer disabled:opacity-50"
      >
        join
      </button>
      {state === 'error' && (
        <p className="font-display mt-2 text-xs tracking-[0.04em] text-tea-text-dim">please enter a valid email.</p>
      )}
    </form>
  );
};

export default HomeV2Page;
