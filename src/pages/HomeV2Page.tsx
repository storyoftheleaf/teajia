import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useShopPrice } from '../components/shop/shopPrice';
import { usePublicProducts } from '../hooks/usePublicProducts';
import { LogoText } from '../components/Logos/LogoText';
import type { PublicProduct } from '../types';

/**
 * The second home page. Cover C from the 2026-09-20 round, built as a route
 * of its own so it can be worked on beside the live page and swapped in when
 * Adrian says so. Nothing links here.
 *
 * The shape: the site's own headline, then three plates on one line (the
 * piece to read, the tea on the table with its price, the consult), then the
 * four grounding lines as the house, then the colophon the live page already
 * carries (the characters, the email field). The words are the site's words;
 * the only new sentence is the one that says everything ships from Bali.
 *
 * The site's own nav frames it: the sidebar on desktop, the tab bar on the
 * phone. No bar of its own.
 */

const PIECE = {
  slug: 'porcelain-and-tea',
  to: '/read/porcelain-and-tea',
  kicker: 'The Lead · N°15 · Conversations over tea',
  dek: 'A porcelain restorer on repair, patience, and how mending what we love mends us in return.',
};

const SHIPPING_LINE = 'Everything ships from Bali. Say where you are and the post is quoted in the same message.';

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

  // The piece's own cover portrait, the one Adrian drops onto the story page.
  // The moment it lands there it lands here too; until then the plate shows
  // the reading room's cover treatment.
  const { data: storyPhotos } = useQuery({
    queryKey: ['story-photos', PIECE.slug],
    queryFn: () => api.storyPhotos.get(PIECE.slug),
    staleTime: 5 * 60 * 1000,
  });
  const portrait = storyPhotos?.portrait;

  // The page breaks out of the main column's gutter, and on desktop out of the
  // column itself, so the plates and their hairlines run from the left edge of
  // the window, behind the floating sidebar, to the right edge. The text
  // sections pad themselves back past the sidebar so nothing readable sits
  // under it. --teajia-sidebar-w is what the sidebar sets as it expands and
  // collapses, so the page follows it live.
  return (
    <div className="-mx-4 md:-mx-6 lg:-mr-10 lg:ml-[calc(-2.5rem-var(--teajia-sidebar-w))] bg-tea-bg text-tea-text">
      <Helmet>
        <title>Teajia. Fine Tea &amp; Teaware</title>
        <meta name="description" content="A home for fine tea. Source it, study it, and share it with those who gather around the cup." />
      </Helmet>

      {/* The statement: set to the left edge of the reading column, the way a
          magazine opens, and kept short so the plates' photographs are on the
          first screen rather than a scroll below it. */}
      <section className="px-6 sm:px-10 lg:px-16 lg:pl-[calc(var(--teajia-sidebar-w)+4rem)] pt-14 sm:pt-20 lg:pt-24 pb-10 sm:pb-12 lg:pb-14">
        <h1
          className="font-display font-normal text-tea-text max-w-[760px] text-[clamp(34px,4.2vw,60px)] leading-[1.1] tracking-[0.01em]"
          style={{ textWrap: 'balance' }}
        >
          Tea deepens with what you bring to the table and what you leave behind.
        </h1>
        <p className="font-body italic text-ui-14 leading-[1.7] text-tea-text-dim max-w-[480px] mt-6">
          {SHIPPING_LINE}
        </p>
      </section>

      {/* The three plates. On desktop the lead runs twice the width of the
          other two, so the row reads as a spread with a cover, not three equal
          tiles. */}
      <section
        aria-label="On the table"
        className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-[var(--teajia-sidebar-w)_2fr_1fr_1fr] border-t border-b border-tea-border"
      >
        <Plate
          first
          to={PIECE.to}
          kicker="The piece to read"
          title={<>Porcelain <span className="italic text-tea-gold">and Tea</span></>}
          body={PIECE.dek}
          foot={PIECE.kicker}
          artwork={portrait ? <StoryPhoto photo={portrait} /> : <PieceArtwork />}
          artworkLabel={portrait ? undefined : 'Portrait, at the repair table'}
        />
        <Plate
          to={tea ? `/shop/product/${tea.slug ?? tea.id}` : '/shop'}
          kicker="The tea on the table"
          title={tea ? tea.productName : 'On the shelf'}
          body={tea ? teaLine(tea) : 'Twenty teas, chosen one lot at a time.'}
          foot={tea ? (
            <span className="font-body text-ui-20 text-tea-text">
              {shopPrice.total(tea.pricePerGramUSD * 50)}
              <span className="text-ui-12 text-tea-text-dim ml-2">50 g</span>
            </span>
          ) : 'Source your tea.'}
          artwork={tea?.imageUrl ? (
            <img src={tea.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
          ) : <TeaArtwork />}
          artworkLabel={tea?.imageUrl ? undefined : 'The leaf, photographed edge to edge'}
        />
        <Plate
          to="/advise"
          kicker="The consult"
          title={<>Twenty years in <span className="italic text-tea-gold">tea culture.</span></>}
          body="Taiwan, China, Japan, Bali, and beyond. Tea for your practice, your collection, your space."
          foot="Every engagement begins with a conversation"
          artwork={
            <img
              src="https://res.cloudinary.com/dobbosnda/image/upload/f_auto,q_auto,w_900/v1773837991/2021-06-27_IMG_7745_Original_ehkz30.jpg"
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
              loading="lazy"
            />
          }
        />
      </section>

      {/* The house: the grounding lines, exactly as the live page has them */}
      <section aria-label="Homepage destinations" className="px-6 sm:px-10 lg:px-16 lg:pl-[calc(var(--teajia-sidebar-w)+4rem)] py-14 sm:py-16 lg:py-20">
        <nav className="flex flex-col items-center gap-3 sm:gap-4 text-center">
          {[
            { accent: 'Source', rest: ' your tea.', to: '/shop' },
            { accent: 'Discover', rest: ' the stories.', to: '/read' },
            { accent: 'Deepen', rest: ' your practice.', to: '/craft' },
            { accent: 'Create', rest: ' the spaces to share.', to: '/advise' },
          ].map(item => (
            <Link
              key={item.to}
              to={item.to}
              className="group tap-target inline-flex items-baseline gap-1 whitespace-nowrap rounded-md py-0.5 font-body text-ui-20 leading-[1.16] tracking-[0.015em] text-tea-text-sec transition-colors duration-300 hover:text-tea-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/40 focus-visible:ring-offset-2 focus-visible:ring-offset-tea-bg"
            >
              <span className="font-medium text-tea-gold">{item.accent}</span>
              <span className="underline decoration-tea-gold/0 underline-offset-[4px] transition-all duration-300 group-hover:decoration-tea-gold/30">{item.rest}</span>
            </Link>
          ))}
        </nav>
        <p className="mt-8 sm:mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 font-body text-ui-14 text-tea-text-dim">
          <Link to="/events" className="hover:text-tea-text transition-colors">sessions</Link>
          <Link to="/people" className="hover:text-tea-text transition-colors">people</Link>
          <Link to="/wisdom" className="hover:text-tea-text transition-colors">tea wisdom</Link>
          <Link to="/spaces" className="hover:text-tea-text transition-colors">spaces</Link>
          <Link to="/about" className="hover:text-tea-text transition-colors">about</Link>
        </p>
      </section>

      {/* The colophon: what the live page's second act says */}
      <section className="border-t border-tea-border px-6 sm:px-10 lg:px-16 lg:pl-[calc(var(--teajia-sidebar-w)+4rem)] pt-14 sm:pt-16 lg:pt-20 pb-nav-gap-lg lg:pb-20 text-center">
        <div className="flex justify-center mb-7">
          <LogoText size="panel" color="var(--tea-text-sec)" />
        </div>
        <p className="font-body italic text-ui-15 tracking-[0.06em] text-tea-text-sec">
          <span className="not-italic font-semibold text-tea-gold">jiā</span> · one sound, three pillars
        </p>
        <div className="relative mx-auto mt-7 grid w-full max-w-[560px] grid-cols-3 border-y border-tea-border py-5 sm:py-6">
          <div className="pointer-events-none absolute inset-y-0 left-1/3 w-px bg-tea-border" aria-hidden="true" />
          <div className="pointer-events-none absolute inset-y-0 left-2/3 w-px bg-tea-border" aria-hidden="true" />
          {[
            { zi: '佳', a: 'beauty', b: 'excellence' },
            { zi: '家', a: 'home', b: 'devotion' },
            { zi: '嘉', a: 'praise', b: 'celebration' },
          ].map(c => (
            <div key={c.zi} className="flex flex-col items-center px-2 sm:px-5">
              <span className="text-[48px] sm:text-[69px] leading-none text-tea-gold" style={{ fontFamily: "'Ma Shan Zheng', cursive" }}>{c.zi}</span>
              <p className="font-display mt-3 flex flex-col items-center text-ui-14 sm:text-ui-15 leading-[1.4] tracking-[0.04em] text-tea-text-sec">
                <span>{c.a}</span><span>{c.b}</span>
              </p>
            </div>
          ))}
        </div>
        <p className="font-body mx-auto mt-8 max-w-[440px] text-ui-15 leading-[1.7] text-tea-text-sec">
          A home for fine tea. A place to source it, study it, and share it with those who gather around the cup.
        </p>
        <p className="font-body italic mt-3 text-ui-13 tracking-[0.04em] text-tea-text-dim">
          Honor the past. Live in the present. Build for the future.
        </p>
        <div className="mx-auto mt-10 w-full max-w-[300px] border-t border-tea-border pt-6">
          <EmailField />
          <p className="font-display italic mt-4 text-base tracking-[0.04em] leading-[1.5] text-tea-text-dim">
            stay connected<br />
            <span className="text-tea-text-sec">it&apos;s nothing without you</span>
          </p>
          <p className="font-body mt-6 text-ui-12 text-tea-text-dim">
            <Link to="/signup" className="text-tea-gold/80 hover:text-tea-gold transition-colors duration-300">Create an account</Link>
            {' · '}
            <Link to="/signin" className="text-tea-gold/80 hover:text-tea-gold transition-colors duration-300">Sign in</Link>
          </p>
        </div>
      </section>
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
  /** The first plate on desktop spans the sidebar's track too: its artwork runs behind the sidebar, its words start past it. */
  first?: boolean;
  to: string;
  kicker: string;
  title: React.ReactNode;
  body: React.ReactNode;
  foot: React.ReactNode;
  artwork: React.ReactNode;
  artworkLabel?: string;
}

/**
 * One plate on the table. A full-height panel, hairline-divided from its
 * neighbours, never a card: the artwork sits flush in the top of the panel and
 * the words sit under it. On the phone the three stack, artwork beside words.
 */
const Plate: React.FC<PlateProps> = ({ first, to, kicker, title, body, foot, artwork, artworkLabel }) => {
  const [hover, setHover] = useState(false);
  return (
    <Link
      to={to}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={`group flex flex-row md:flex-col border-b md:border-b-0 md:border-r border-tea-border last:border-b-0 md:last:border-r-0 text-tea-text-sec focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-tea-gold/40 ${first ? 'lg:col-span-2' : ''}`}
    >
      <div className="relative shrink-0 basis-[38%] min-h-[170px] md:basis-auto md:min-h-[300px] lg:min-h-[460px] overflow-hidden bg-tea-surface">
        {artwork}
        {artworkLabel && (
          <span className={`absolute left-4 bottom-3 font-sans text-ui-10 uppercase tracking-[0.18em] text-tea-text-dim ${first ? 'lg:left-[calc(var(--teajia-sidebar-w)+1rem)]' : ''}`}>
            {artworkLabel}
          </span>
        )}
      </div>
      <div className={`flex-1 px-5 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10 ${first ? 'lg:pl-[calc(var(--teajia-sidebar-w)+2rem)]' : ''}`}>
        <p className="font-sans text-ui-10 uppercase tracking-[0.26em] text-tea-gold">{kicker}</p>
        <h2
          className={`font-display font-normal mt-3 text-[clamp(26px,2.6vw,38px)] leading-[1.05] transition-colors duration-300 ${hover ? 'text-tea-gold' : 'text-tea-text'}`}
        >
          {title}
        </h2>
        <p className="font-body mt-4 text-ui-14 leading-[1.6] text-tea-text-dim">{body}</p>
        <p className="font-body mt-5 text-ui-14 text-tea-text-sec">{foot}</p>
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
const TeaArtwork: React.FC = () => (
  <>
    <div aria-hidden="true" className="absolute inset-0" style={{ background: '#26201a', backgroundImage: 'repeating-linear-gradient(135deg, rgba(168,135,77,0.06) 0 9px, transparent 9px 18px)' }} />
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
    return <p className="font-display text-base tracking-[0.04em] text-tea-gold">you&apos;re on the list.</p>;
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
        className="font-display w-full bg-transparent text-center text-base tracking-[0.04em] text-tea-text outline-none pb-2.5 pl-7 pr-10 placeholder:italic placeholder:text-tea-text-dim disabled:opacity-50 border-0 border-b border-tea-border rounded-none focus:border-tea-gold"
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
