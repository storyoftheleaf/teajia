import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useShopPrice } from '../components/shop/shopPrice';
import { usePublicProducts } from '../hooks/usePublicProducts';
import { useSectionReveal } from '../hooks/useSectionReveal';
import { StoryEditProvider, type PhotoVal } from './read/storyEdit';
import EditablePhoto from './read/EditablePhoto';
import StoryEditorBar from './read/StoryEditorBar';
import type { PublicProduct } from '../types';

/**
 * The second home page. Cover C from the 2026-09-20 round, built as a route
 * of its own so it can be worked on beside the live page and swapped in when
 * Adrian says so. Nothing links here.
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

/** The one photograph the site owns today: Adrian at the table. */
const TABLE_PHOTO = 'https://res.cloudinary.com/dobbosnda/image/upload/f_auto,q_auto,w_2000/v1773837991/2021-06-27_IMG_7745_Original_ehkz30.jpg';

/** Stand-ins until the real photographs exist. Unsplash, free to use; never shipped as final. */
const TEMPLATE = {
  piece: 'https://images.unsplash.com/photo-1654738209839-571e0ff47323?w=1200&q=75&fit=crop',
  tea: 'https://images.unsplash.com/photo-1475257026007-0753d5429e10?w=1200&q=75&fit=crop',
  consult: 'https://images.unsplash.com/photo-1734333107760-7389a4f29af8?w=1200&q=75&fit=crop',
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

  // The table photograph enters the way the plates do.
  const heroReveal = useSectionReveal('fade');

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
        <meta name="description" content="A home for fine tea. Source it, study it, and share it with those who gather around the cup." />
      </Helmet>

      {/* The opener: the statement beside the photograph of the table, the
          height of the first screen. The frame is the Read pages' own: signed
          in as owner, the editor bar turns editing on, a photograph drops,
          pastes or is chosen into it, and Publish makes it live. Until one is
          published the table photograph stands in. */}
      <section aria-label="Teajia" className="grid grid-cols-1 lg:grid-cols-[var(--teajia-sidebar-w)_minmax(0,1.45fr)_minmax(0,1fr)] lg:min-h-[calc(100vh-1.5rem)]">
        <div className={`lg:col-start-2 px-6 sm:px-10 lg:pl-[4rem] lg:pr-16 pt-14 sm:pt-20 lg:pt-0 pb-10 lg:pb-0 flex flex-col justify-center`}>
          <h1
            className="font-display font-light text-tea-text max-w-[26ch] text-[clamp(38px,3.9vw,66px)] leading-[1.06] tracking-[0.005em]"
            style={{ textWrap: 'balance' }}
          >
            Tea deepens with what<br className="hidden xl:inline" /> you bring to the table<br className="hidden xl:inline" /> and what you leave behind.
          </h1>
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
                className={`group tap-target inline-flex items-baseline gap-1 whitespace-nowrap rounded-md py-0 ${BODY} tracking-[0.015em] text-tea-text-sec transition-colors duration-300 hover:text-tea-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/40 focus-visible:ring-offset-2 focus-visible:ring-offset-tea-bg`}
              >
                <span className="font-medium text-tea-gold">{item.accent}</span>
                <span className="underline decoration-tea-gold/0 underline-offset-[4px] transition-all duration-300 group-hover:decoration-tea-gold/30">{item.rest}</span>
              </Link>
            ))}
          </nav>
          {/* The opener's way in: the live page's own two. Start here goes to
              the house, where jiā is explained. */}
          <p className={`${META} mt-5 flex flex-wrap gap-x-5 gap-y-1 text-tea-text-sec`}>
            <a href="#the-house" className="hover:text-tea-gold transition-colors duration-300">New here? Start here</a>
            <Link to="/discover" className="hover:text-tea-gold transition-colors duration-300">Discover your tea</Link>
          </p>
        </div>
        <div
          ref={heroReveal.ref}
          className={`relative lg:col-start-3 min-h-[320px] sm:min-h-[420px] lg:min-h-0 overflow-hidden bg-tea-surface ${PHOTO} ${heroReveal.className}`}
          style={heroReveal.style}
        >
          <span className={`pointer-events-none absolute left-5 bottom-4 z-10 ${META} text-tea-text-sec`}>At the table, Bali</span>
          <EditablePhoto
            slot="table"
            alt="At the table"
            fill
            placeholderBg="var(--tea-surface)"
            placeholder={<img src={TABLE_PHOTO} alt="" className="absolute inset-0 w-full h-full object-cover" style={{ objectPosition: '68% 64%' }} />}
          />
        </div>
      </section>

      {/* The table: three plates of equal width. */}
      <section
        aria-label="On the table"
        className={`${MOVEMENT} ${EDGE} grid grid-cols-1 md:grid-cols-3 gap-y-8 md:gap-y-0 md:gap-x-[2px] ${PHOTO}`}
      >
        <Plate
          index={0}
          to={PIECE.to}
          title={<>Porcelain <span className="italic text-tea-gold">and Tea</span></>}
          body={PIECE.dek}
          meta={PIECE.meta}
          src={portrait?.url ?? TEMPLATE.piece}
          crop={portrait?.crop}
        />
        <Plate
          index={1}
          to={tea ? `/shop/product/${tea.slug ?? tea.id}` : '/shop'}
          title={tea ? tea.productName : 'On the shelf'}
          body={tea ? teaLine(tea) : 'Twenty teas, chosen one lot at a time.'}
          meta={tea ? <>50 g · <span className="font-body text-ui-16 text-tea-text">{shopPrice.total(tea.pricePerGramUSD * 50)}</span></> : 'On the shelf'}
          src={tea?.imageUrl || TEMPLATE.tea}
        />
        <Plate
          index={2}
          to="/advise"
          title={<>Twenty years in <span className="italic text-tea-gold">tea culture.</span></>}
          body="Taiwan, China, Japan, Bali, and beyond. Tea for your practice, your collection, your space."
          meta="The consult"
          src={TEMPLATE.consult}
        />
      </section>

      {/* The house: on the surface tone. The grounding lines and the email
          down the left, exactly as the live page sets them; the three
          characters large on the right, the house's own picture. */}
      <section
        id="the-house"
        aria-label="The house"
        className={`${MOVEMENT} scroll-mt-6 grid grid-cols-1 lg:grid-cols-[var(--teajia-sidebar-w)_1fr_1fr] bg-tea-surface`}
      >
        <div className="lg:col-start-2 px-6 sm:px-10 lg:pl-[4rem] lg:pr-16 pt-14 sm:pt-16 lg:pt-24 pb-12 lg:pb-24 flex flex-col justify-center">
          <div className="max-w-[360px]">
            <p className={`${BODY} italic tracking-[0.04em] text-tea-text-dim`}>stay connected</p>
            <p className={`${DISPLAY} italic mt-1 text-tea-text`}>it&apos;s nothing without you</p>
            <div className="mt-6">
              <EmailField />
            </div>
            <p className={`${META} mt-6 text-tea-text-dim`}>
              <Link to="/signup" className="text-tea-gold/80 hover:text-tea-gold transition-colors duration-300">Create an account</Link>
              {' · '}
              <Link to="/signin" className="text-tea-gold/80 hover:text-tea-gold transition-colors duration-300">Sign in</Link>
            </p>
          </div>
        </div>
        {/* What jiā means: the live page's own passage, whole. The two teaser
            lines, the three characters each with their two words, then the
            spirit and the motto. This is the introduction, not a decoration. */}
        <div className="lg:col-start-3 bg-tea-elevated px-6 sm:px-10 lg:px-14 py-14 sm:py-16 lg:py-24 flex flex-col justify-center">
          <p className={`${BODY} italic tracking-[0.06em] text-tea-text-sec`}>
            <span className="not-italic font-semibold text-tea-gold">tea</span> · leaf and water
          </p>
          <p className={`${BODY} italic tracking-[0.06em] text-tea-text-sec`}>
            <span className="not-italic font-semibold text-tea-gold">jiā</span> · one sound, three pillars…
          </p>
          <div className="mt-10 grid grid-cols-3 gap-x-4">
            {[
              { zi: '佳', a: 'beauty', b: 'excellence' },
              { zi: '家', a: 'home', b: 'devotion' },
              { zi: '嘉', a: 'praise', b: 'celebration' },
            ].map(c => (
              <div key={c.zi} className="flex flex-col items-center">
                <span className="text-[80px] sm:text-[104px] lg:text-[clamp(72px,8vw,160px)] leading-none text-tea-gold" style={{ fontFamily: "'Ma Shan Zheng', cursive" }}>{c.zi}</span>
                <p className="font-display mt-4 flex flex-col items-center text-center text-ui-15 leading-[1.4] tracking-[0.04em] text-tea-text-sec">
                  <span>{c.a}</span><span>{c.b}</span>
                </p>
              </div>
            ))}
          </div>
          <p className={`${BODY} mt-10 max-w-[44ch] text-tea-text-sec`}>
            A home for fine tea. A place to source it, study it, and share it with those who gather around the cup.
          </p>
          <p className={`${BODY} italic mt-3 tracking-[0.04em] text-tea-text-dim`}>
            Honor the past. Live in the present. Build for the future.
          </p>
        </div>
      </section>
      <StoryEditorBar />
    </div>
    </StoryEditProvider>
  );
};

/** Origin, year and the last-of-the-lot note, in one line under the tea's name. */
const teaLine = (tea: PublicProduct): string => {
  const where = [tea.originRegion, tea.originCountry].filter(Boolean).join(', ');
  const when = tea.year ? String(tea.year) : '';
  const parts = [where, when].filter(Boolean).join(', ');
  const scarce = tea.isOneOfAKind || tea.stockGrams <= 150 ? ` ${tea.stockGrams} g left, the last of the lot.` : '';
  return `${parts}.${scarce}`;
};

interface PlateProps {
  /** Position in the row, for the stagger of the one authored entrance. */
  index: number;
  to: string;
  title: React.ReactNode;
  body: React.ReactNode;
  meta: React.ReactNode;
  src: string;
  /** The focal point and zoom saved with a story photograph, when it is one. */
  crop?: { scale: number; x: number; y: number };
}

/**
 * One plate on the table: a photograph with its words under it, a hairline
 * from its neighbour, never a card. The photographs are the page's one
 * authored entrance: each fades up as it comes into view, a beat after the
 * one before. The words do not animate.
 */
const Plate: React.FC<PlateProps> = ({ index, to, title, body, meta, src, crop }) => {
  const [hover, setHover] = useState(false);
  const reveal = useSectionReveal('fade');
  const focal = crop ? `${crop.x * 100}% ${crop.y * 100}%` : undefined;
  return (
    <Link
      to={to}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="group flex flex-row md:flex-col min-h-[220px] md:min-h-0 text-tea-text-sec focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-tea-gold/40"
    >
      <div
        ref={reveal.ref}
        className={`relative shrink-0 basis-[45%] min-h-[220px] md:basis-auto md:min-h-[280px] lg:min-h-[400px] overflow-hidden bg-tea-surface ${reveal.className}`}
        style={reveal.style ? { ...reveal.style, transitionDelay: `${index * 120}ms` } : undefined}
      >
        <img
          src={src}
          alt=""
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-[600ms] ease-out group-hover:scale-[1.02] motion-reduce:transform-none"
          style={crop ? { objectPosition: focal, transform: `scale(${crop.scale})`, transformOrigin: focal } : undefined}
        />
      </div>
      <div className="flex-1 pl-5 py-6 sm:pl-6 sm:py-8 md:pl-0 md:pr-8 md:py-8">
        <h2 className={`${TITLE} transition-colors duration-300 ${hover ? 'text-tea-gold' : 'text-tea-text'}`}>
          {title}
        </h2>
        <p className={`${BODY} mt-3 max-w-[44ch] text-tea-text-sec`}>{body}</p>
        <p className={`${META} mt-3 text-tea-text-sec`}>{meta}</p>
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
        className={`font-display w-full bg-transparent text-base tracking-[0.04em] text-tea-text outline-none pb-2.5 pr-10 placeholder:italic placeholder:text-tea-text-dim disabled:opacity-50 border-0 border-b border-tea-border rounded-none focus:border-tea-gold text-left pl-0`}
      />
      <button
        type="submit"
        disabled={state === 'sending'}
        aria-label="Subscribe"
        className="tap-target absolute right-0 bottom-1 font-display italic text-ui-12 text-tea-text-dim hover:text-tea-gold transition-colors bg-transparent border-0 cursor-pointer disabled:opacity-50"
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
