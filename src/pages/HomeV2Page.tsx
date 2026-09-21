import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useShopPrice } from '../components/shop/shopPrice';
import { usePublicProducts } from '../hooks/usePublicProducts';
import { LogoText } from '../components/Logos/LogoText';
import { useTheme } from '../context/ThemeContext';
import { getTeaLedgerTones } from '../designTokens';
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
 * One page, not four bands. The statement opens it and its last line sits on
 * the lead photograph; the three plates follow, the lead twice the width and
 * a head taller than the other two; the house lines, the wordmark, the three
 * characters and the email run down one text column beside one tall
 * photograph. No horizontal rules anywhere: the verticals between columns
 * and the photographs' own edges do the dividing. Every line of text starts
 * at the same left edge, four rems past the sidebar.
 *
 * Three sizes of type: the display size for anything that is a title or a
 * line to be read as one, the body size for sentences, the meta size for the
 * facts under them. The opener is the one exception and is allowed to be
 * bigger than everything.
 *
 * The site's own nav frames it: the sidebar on desktop, the tab bar on the
 * phone. No bar of its own.
 */

const PIECE = {
  slug: 'porcelain-and-tea',
  to: '/read/porcelain-and-tea',
  meta: 'The piece to read · The Lead · N°15 · Conversations over tea',
  dek: 'A porcelain restorer on repair, patience, and how mending what we love mends us in return.',
};

/** The one photograph the site owns today: Adrian at the table. */
const TABLE_PHOTO = 'https://res.cloudinary.com/dobbosnda/image/upload/f_auto,q_auto,w_900/v1773837991/2021-06-27_IMG_7745_Original_ehkz30.jpg';

/** The home page's own slug in the story-content store, for the frames it carries. */
const HOME_SLUG = 'home';

/** The left edge every line of text on the page starts from, on desktop. */
const EDGE = 'lg:pl-[calc(var(--teajia-sidebar-w)+4rem)]';

/** The three sizes. */
const DISPLAY = 'font-display font-normal text-[clamp(26px,2.5vw,36px)] leading-[1.1] tracking-[0.01em]';
const BODY = 'font-body text-ui-16 leading-[1.65]';
const META = 'font-sans text-ui-12 leading-[1.5] tracking-[0.02em]';

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
  // and publishes there. The moment it is live there it is live here; until
  // then the plate shows the reading room's cover treatment.
  const { data: pieceContent } = useQuery({
    queryKey: ['story-content', PIECE.slug, 'published'],
    queryFn: () => api.storyContent.get(PIECE.slug) as Promise<{ photos?: Record<string, PhotoVal> }>,
    staleTime: 5 * 60 * 1000,
  });
  const portrait = pieceContent?.photos?.portrait;

  // The colour the tea brews, the same ground the shop's ledger rows carry.
  const { theme } = useTheme();
  const teaTones = tea ? getTeaLedgerTones(tea.type, theme, 1.6) : null;

  // The page breaks out of the main column's gutter, and on desktop out of the
  // column itself, so the photographs run from the left edge of the window,
  // behind the floating sidebar, to the right edge. The text pads itself back
  // past the sidebar so nothing readable sits under it. --teajia-sidebar-w is
  // what the sidebar sets as it expands and collapses, so the page follows it.
  return (
    <div className="-mx-4 md:-mx-6 lg:-mr-10 lg:ml-[calc(-2.5rem-var(--teajia-sidebar-w))] bg-tea-bg text-tea-text">
      <Helmet>
        <title>Teajia. Fine Tea &amp; Teaware</title>
        <meta name="description" content="A home for fine tea. Source it, study it, and share it with those who gather around the cup." />
      </Helmet>

      {/* The statement. Its last line sits on the lead photograph below, so
          the opener and the plates are one move rather than two bands. */}
      <section className={`relative z-10 px-6 sm:px-10 lg:px-16 ${EDGE} pt-14 sm:pt-20 lg:pt-24 pb-8 lg:pb-0`}>
        <h1
          className="font-display font-normal text-tea-text max-w-[760px] text-[clamp(36px,4.4vw,64px)] leading-[1.08] tracking-[0.01em]"
          style={{ textWrap: 'balance' }}
        >
          Tea deepens with what you bring to the table and what you leave behind.
        </h1>
      </section>

      {/* The three plates. The lead runs twice the width of the other two and
          a head taller, its photograph starting under the statement's last
          line; the two beside it sit lower, so the row has a ragged top and a
          ragged bottom rather than a flat strip. */}
      <section
        aria-label="On the table"
        className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-[var(--teajia-sidebar-w)_2fr_1fr_1fr] lg:-mt-10"
      >
        <Plate
          first
          index={0}
          to={PIECE.to}
          title={<>Porcelain <span className="italic text-tea-gold">and Tea</span></>}
          body={PIECE.dek}
          meta={PIECE.meta}
          artwork={portrait ? <StoryPhoto photo={portrait} /> : <PieceArtwork />}
          artworkLabel={portrait ? undefined : 'Portrait, at the repair table'}
          scrim
        />
        <Plate
          index={1}
          to={tea ? `/shop/product/${tea.slug ?? tea.id}` : '/shop'}
          title={tea ? tea.productName : 'On the shelf'}
          body={tea ? teaLine(tea) : 'Twenty teas, chosen one lot at a time.'}
          meta={tea ? (
            <>
              <span className="font-body text-ui-16 text-tea-text">{shopPrice.total(tea.pricePerGramUSD * 50)}</span>
              <span className="ml-2">for 50 g · the tea on the table</span>
            </>
          ) : 'The tea on the table'}
          artwork={tea?.imageUrl ? (
            <img src={tea.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
          ) : <TeaArtwork ground={teaTones?.markBg} />}
          artworkLabel={tea?.imageUrl ? undefined : 'The leaf, photographed edge to edge'}
          wash={teaTones?.wash}
        />
        <Plate
          index={2}
          to="/advise"
          title={<>Twenty years in <span className="italic text-tea-gold">tea culture.</span></>}
          body="Taiwan, China, Japan, Bali, and beyond. Tea for your practice, your collection, your space."
          meta="The consult · every engagement begins with a conversation"
          artwork={<img src={TABLE_PHOTO} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />}
        />
      </section>

      {/* The house. One text column, one tall photograph. The four lines,
          then the wordmark, jiā, the three characters, the mission and the
          email, all down the same edge; the photograph runs the full height
          beside them. The frame is the Read pages' own: signed in as owner,
          the editor bar turns editing on, a photograph drops, pastes or is
          chosen into it, the focal point and zoom are set, and Publish makes
          it live. Until one is published the table photograph stands in,
          cropped to the vessel so it is not the consult plate's picture again. */}
      <StoryEditProvider slug={HOME_SLUG}>
      <section
        aria-label="The house"
        className="grid grid-cols-1 lg:grid-cols-[var(--teajia-sidebar-w)_1fr_1fr] pb-nav-gap-lg lg:pb-0"
      >
        <div className="relative order-first lg:order-none lg:col-start-3 lg:row-start-1 min-h-[260px] sm:min-h-[340px] lg:min-h-0 overflow-hidden bg-tea-surface">
          <EditablePhoto
            slot="house"
            alt="The house"
            fill
            placeholderBg="var(--tea-surface)"
            placeholder={
              <img src={TABLE_PHOTO} alt="" className="absolute inset-0 w-full h-full object-cover" style={{ objectPosition: '88% 45%', transform: 'scale(1.35)', transformOrigin: '88% 45%' }} loading="lazy" />
            }
          />
        </div>
        <div className={`lg:col-start-2 lg:row-start-1 px-6 sm:px-10 lg:pl-[4rem] lg:pr-16 pt-12 sm:pt-14 lg:pt-20 pb-14 lg:pb-24`}>
          <nav aria-label="Homepage destinations" className="flex flex-col items-start gap-2 sm:gap-3">
            {[
              { accent: 'Source', rest: ' your tea.', to: '/shop' },
              { accent: 'Discover', rest: ' the stories.', to: '/read' },
              { accent: 'Deepen', rest: ' your practice.', to: '/craft' },
              { accent: 'Create', rest: ' the spaces to share.', to: '/advise' },
            ].map(item => (
              <Link
                key={item.to}
                to={item.to}
                className={`group tap-target inline-flex items-baseline gap-1 whitespace-nowrap rounded-md py-0.5 ${DISPLAY} text-tea-text-sec transition-colors duration-300 hover:text-tea-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/40 focus-visible:ring-offset-2 focus-visible:ring-offset-tea-bg`}
              >
                <span className="text-tea-gold">{item.accent}</span>
                <span className="underline decoration-tea-gold/0 underline-offset-[6px] transition-all duration-300 group-hover:decoration-tea-gold/30">{item.rest}</span>
              </Link>
            ))}
          </nav>

          <div className="mt-16 sm:mt-20 lg:mt-24">
            <LogoText size="panel" color="var(--tea-text-sec)" />
            <p className={`${BODY} italic mt-4 text-tea-text-sec`}>
              <span className="not-italic font-semibold text-tea-gold">jiā</span> · one sound, three pillars
            </p>
            <div className="mt-8 flex flex-wrap gap-x-10 sm:gap-x-14 gap-y-6">
              {[
                { zi: '佳', a: 'beauty', b: 'excellence' },
                { zi: '家', a: 'home', b: 'devotion' },
                { zi: '嘉', a: 'praise', b: 'celebration' },
              ].map(c => (
                <div key={c.zi} className="flex flex-col items-start">
                  <span className="text-[44px] sm:text-[56px] leading-none text-tea-gold" style={{ fontFamily: "'Ma Shan Zheng', cursive" }}>{c.zi}</span>
                  <p className={`${META} mt-3 flex flex-col items-start text-tea-text-sec`}>
                    <span>{c.a}</span><span>{c.b}</span>
                  </p>
                </div>
              ))}
            </div>
            <p className={`${BODY} mt-8 max-w-[52ch] text-tea-text-sec`}>
              A home for fine tea. A place to source it, study it, and share it with those who gather around the cup.
            </p>
          </div>

          <div className="mt-12 sm:mt-14 max-w-[360px]">
            <p className={`${DISPLAY} italic text-tea-text`}>it&apos;s nothing without you</p>
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
      </section>
      <StoryEditorBar />
      </StoryEditProvider>
    </div>
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
  /** The lead plate on desktop spans the sidebar's track too: its photograph runs behind the sidebar, its words start at the page's edge. */
  first?: boolean;
  /** Position in the row, for the stagger of the one authored entrance. */
  index: number;
  to: string;
  title: React.ReactNode;
  body: React.ReactNode;
  meta: React.ReactNode;
  artwork: React.ReactNode;
  artworkLabel?: string;
  /** A tonal ground behind the words, fading out to the right: the tea's own liquor colour. */
  wash?: string;
  /** Page tone over the top of the photograph, so the statement's last line reads on it. */
  scrim?: boolean;
}

/**
 * One plate on the table: a photograph with its words under it, a hairline
 * from its neighbour, never a card. The photographs are the page's one
 * authored entrance: each fades up as it comes into view, a beat after the
 * one before. The words do not animate.
 */
const Plate: React.FC<PlateProps> = ({ first, index, to, title, body, meta, artwork, artworkLabel, wash, scrim }) => {
  const [hover, setHover] = useState(false);
  const reveal = useSectionReveal('fade');
  return (
    <Link
      to={to}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={`group flex flex-row md:flex-col md:border-r border-tea-border md:last:border-r-0 text-tea-text-sec focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-tea-gold/40 ${first ? 'lg:col-span-2' : 'lg:mt-24'}`}
    >
      <div
        ref={reveal.ref}
        className={`relative shrink-0 basis-[38%] min-h-[170px] md:basis-auto md:min-h-[300px] ${first ? 'lg:min-h-[560px]' : 'lg:min-h-[400px]'} overflow-hidden bg-tea-surface ${reveal.className}`}
        style={reveal.style ? { ...reveal.style, transitionDelay: `${index * 120}ms` } : undefined}
      >
        <div className="absolute inset-0 transition-transform duration-[600ms] ease-out group-hover:scale-[1.02] motion-reduce:transform-none">
          {artwork}
        </div>
        {scrim && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-[38%] hidden lg:block"
            style={{ background: 'linear-gradient(180deg, rgb(var(--tea-bg-rgb)) 0%, rgb(var(--tea-bg-rgb) / 0) 100%)' }}
          />
        )}
        {artworkLabel && (
          <span className={`absolute left-4 bottom-3 ${META} text-tea-text-dim ${first ? 'lg:left-[calc(var(--teajia-sidebar-w)+4rem)]' : ''}`}>
            {artworkLabel}
          </span>
        )}
      </div>
      <div
        className={`flex-1 px-5 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10 ${first ? 'lg:pl-[calc(var(--teajia-sidebar-w)+4rem)]' : ''}`}
        style={wash ? { background: `linear-gradient(90deg, ${wash} 0%, transparent 78%)` } : undefined}
      >
        <h2 className={`${DISPLAY} transition-colors duration-300 ${hover ? 'text-tea-gold' : 'text-tea-text'}`}>
          {title}
        </h2>
        <p className={`${BODY} mt-4 max-w-[46ch] text-tea-text-sec`}>{body}</p>
        <p className={`${META} mt-5 text-tea-text-dim`}>{meta}</p>
      </div>
    </Link>
  );
};

/** A photograph saved on a Read story page, drawn with the crop Adrian set there. */
const StoryPhoto: React.FC<{ photo: { url: string; crop: { scale: number; x: number; y: number } } }> = ({ photo }) => {
  const focal = `${photo.crop.x * 100}% ${photo.crop.y * 100}%`;
  return (
    <img
      src={photo.url}
      alt=""
      className="absolute inset-0 w-full h-full object-cover"
      style={{ objectPosition: focal, transform: `scale(${photo.crop.scale})`, transformOrigin: focal }}
      loading="lazy"
    />
  );
};

/** Until the porcelain piece has its portrait: the reading room's own cover treatment. */
const PieceArtwork: React.FC = () => (
  <>
    <div aria-hidden="true" className="absolute inset-0" style={{ background: 'linear-gradient(158deg,#2a2620 0%,#1c1810 56%,#14100b 100%)' }} />
    <div aria-hidden="true" className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 64% 56% at 60% 28%, rgba(150,180,180,0.20), transparent 64%)' }} />
    <div
      aria-hidden="true"
      className="absolute left-1/2 top-[46%] -translate-x-1/2 -translate-y-1/2 leading-none"
      style={{ fontFamily: "'Noto Serif SC', serif", fontWeight: 200, fontSize: 'min(24vw,200px)', color: 'rgba(168,135,77,0.09)' }}
    >
      缘
    </div>
  </>
);

/** Until the tea has a photograph: the plate that marks where the leaf goes. */
const TeaArtwork: React.FC<{ ground?: string }> = ({ ground }) => (
  <>
    <div aria-hidden="true" className="absolute inset-0" style={{ background: ground ?? '#26201a', backgroundImage: 'repeating-linear-gradient(135deg, rgba(168,135,77,0.06) 0 9px, transparent 9px 18px)' }} />
    <div aria-hidden="true" className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 60% 55% at 55% 40%, rgba(190,140,70,0.22), transparent 66%)' }} />
  </>
);

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
