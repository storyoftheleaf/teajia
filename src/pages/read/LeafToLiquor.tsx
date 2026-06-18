/**
 * From Leaf to Liquor — The Craft of Tea, N°01
 * A tea-education explainer in five switchable directions:
 *   I  Manuscript — classical, narrow column, drop caps, marginalia
 *   II Gallery     — expressive, full-bleed plates, big asymmetric type
 *   III Folio      — structured editorial reference, figures, data table
 *   IV Thread      — meditative vertical journey, a gold thread that draws as you scroll
 *   V  Reverie     — cinematic full-screen sections that snap, one idea per screen
 * Ported pixel-faithfully from the tea-article-redesign mockup.
 */
import React, { useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  C, F, ImmersiveRoot, ProgressTrack,
  useReadingProgress, useImmersiveChrome, grainCss, ACCENTS,
} from './immersive';

type Direction = 'manuscript' | 'gallery' | 'folio' | 'thread' | 'reverie';
const DIRECTIONS: { key: Direction; numeral: string; label: string }[] = [
  { key: 'manuscript', numeral: 'I', label: 'Manuscript' },
  { key: 'gallery', numeral: 'II', label: 'Gallery' },
  { key: 'folio', numeral: 'III', label: 'Folio' },
  { key: 'thread', numeral: 'IV', label: 'Thread' },
  { key: 'reverie', numeral: 'V', label: 'Reverie' },
];

// ─── Six-colours data ────────────────────────────────────────────────────────
const SIX = [
  { name: 'Green', dot: '#859F85', ox: '~0%', char: 'Fixed by heat the moment it is plucked. The leaf stays green, fresh, and vegetal.', short: 'Fixed by heat at once. Fresh, vegetal.', tableOx: '~0%' },
  { name: 'White', dot: '#D6D3CD', ox: '5–15%', char: 'Barely handled. Sun-withered and dried — the gentlest tea of all.', short: 'Barely handled. Sun-withered.', tableOx: '5–15%' },
  { name: 'Yellow', dot: '#D4C586', ox: '~10%', char: 'Green tea’s rare cousin, gently sealed and “yellowed” to round its edges.', short: 'Green’s rare cousin, gently sealed.', tableOx: '~10%' },
  { name: 'Oolong', dot: '#C4A484', ox: '15–80%', char: 'The connoisseur’s spectrum — partially oxidised, from floral to roasted.', short: 'Partial. Floral to roasted.', tableOx: '15–80%' },
  { name: 'Red', dot: '#A67B70', ox: '~100%', char: 'Fully oxidised — what the West calls “black”. Malt, honey, stone fruit.', short: 'Fully oxidised. Malt & honey.', tableOx: '~100%' },
  { name: 'Dark', dot: '#8B8C89', ox: 'Post-ferment', char: 'The only living tea — aged and fermented by microbes for years. Pu’er.', short: 'The only living tea. Pu’er.', tableOx: 'Aged' },
];

const oxBar = 'linear-gradient(90deg,#7d8f5a 0%,#c9b061 26%,#bf8f4a 52%,#9a5a3a 78%,#3a2820 100%)';

// ════════════════════════════════════════════════════════════════════════════
//  I · MANUSCRIPT
// ════════════════════════════════════════════════════════════════════════════
const Manuscript: React.FC = () => (
  <article style={{ position: 'relative', zIndex: 1 }}>
    {/* COVER */}
    <header style={{ position: 'relative', minHeight: '92vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 'clamp(40px,8vw,90px) 24px', overflow: 'hidden' }}>
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 80% 60% at 50% 18%, rgba(168,135,77,0.13) 0%, transparent 62%), radial-gradient(ellipse 60% 50% at 50% 100%, rgba(168,135,77,0.06) 0%, transparent 60%)' }} />
      <div aria-hidden="true" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-54%)', fontFamily: F.cn, fontWeight: 200, fontSize: 'min(58vw,560px)', lineHeight: 1, color: 'rgba(168,135,77,0.05)', pointerEvents: 'none', userSelect: 'none' }}>茶</div>
      <div style={{ position: 'relative', maxWidth: 760 }}>
        <div style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: '0.42em', textTransform: 'uppercase', color: C.gold, marginBottom: 30 }}>The Craft of Tea &nbsp;·&nbsp; N°01</div>
        <h1 style={{ fontFamily: F.display, fontWeight: 400, fontStyle: 'italic', fontSize: 'clamp(52px,10vw,116px)', lineHeight: 0.98, letterSpacing: '-0.015em', color: C.cream, margin: 0 }}>From Leaf<br />to Liquor</h1>
        <div aria-hidden="true" style={{ width: 54, height: 1, background: C.gold, opacity: 0.6, margin: '34px auto' }} />
        <p style={{ fontFamily: F.body, fontStyle: 'italic', fontWeight: 400, fontSize: 'clamp(17px,2.4vw,22px)', lineHeight: 1.5, color: C.taupe, margin: '0 auto', maxWidth: 520 }}>
          How a single leaf becomes the six colours of tea — and why the whole craft turns on knowing when to stop.
        </p>
      </div>
      <div style={{ position: 'absolute', bottom: 40, left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, animation: 'tjFloat 3.4s ease-in-out infinite' }}>
        <span style={{ fontFamily: F.ui, fontSize: 10, fontWeight: 500, letterSpacing: '0.28em', textTransform: 'uppercase', color: C.dim }}>Begin reading</span>
        <svg width="13" height="20" viewBox="0 0 13 20" fill="none"><path d="M6.5 1v17M1 12.5l5.5 5.5 5.5-5.5" stroke="#a8874d" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </div>
    </header>

    {/* READING COLUMN */}
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: '0 24px' }}>
      {/* INTRO with drop cap */}
      <section data-reveal style={{ maxWidth: 680, margin: '0 auto', padding: 'clamp(60px,9vw,120px) 0 clamp(20px,4vw,48px)' }}>
        <p style={{ fontFamily: F.body, fontSize: 'clamp(19px,2.3vw,23px)', lineHeight: 1.74, color: C.ink, margin: 0 }}>
          <span style={{ float: 'left', fontFamily: F.display, fontWeight: 600, fontSize: '5.1em', lineHeight: 0.78, color: C.gold, margin: '8px 16px -2px 0' }}>E</span>
          very tea in the world — the grassy green of a Hangzhou spring, the honeyed dark of an aged Pu’er, the bright snap of a high Darjeeling — begins with the very same plant. <em style={{ fontStyle: 'italic', color: C.cream }}>Camellia sinensis</em>: an evergreen shrub, unremarkable to the passing eye. What separates one tea from another is not the leaf but what the maker chooses to do with it, and the precise moment they choose to stop.
        </p>
      </section>

      {/* SECTION I */}
      <section style={{ maxWidth: 680, margin: '0 auto', padding: 'clamp(40px,6vw,72px) 0 0' }}>
        <SectionRule numeral="I" label="The Pluck" />
        <aside style={{ float: 'right', width: 'clamp(150px,38%,220px)', margin: '6px 0 14px 30px', paddingLeft: 16, borderLeft: '1px solid rgba(168,135,77,0.28)' }}>
          <div style={{ fontFamily: F.cn, fontSize: 19, color: C.taupe, lineHeight: 1.4, marginBottom: 7 }}>一芽二叶</div>
          <p style={{ fontFamily: F.body, fontStyle: 'italic', fontSize: 13.5, lineHeight: 1.55, color: C.dim, margin: 0 }}>“One bud, two leaves” — the classical standard for a fine plucking. Only the tenderest tip is taken.</p>
        </aside>
        <p data-reveal style={msBody}>Tea begins in the hands. In the high gardens of Yunnan and Fujian the spring flush is gathered leaf by leaf — two slender leaves and a single unopened bud, the most tender part of the plant. A skilled picker moves through the rows at the pace of a slow conversation, taking only what the season offers and leaving the rest to grow.</p>
        <p data-reveal style={{ ...msBody, margin: 0 }}>Timing is everything. Plucked a week early, the leaf has no body; a week late, it turns coarse and bitter. The finest harvests are measured not in weeks but in mornings — the cool hours before the mountain mist burns away.</p>
      </section>

      {/* SECTION II */}
      <section style={{ maxWidth: 680, margin: '0 auto', padding: 'clamp(40px,6vw,72px) 0 0' }}>
        <SectionRule numeral="II" label="The Withering" />
        <p data-reveal style={{ ...msBody, margin: 0 }}>Once gathered, the leaf is laid out to wither. It is the quietest step, and the most important. Spread thin on bamboo trays, the leaf exhales its water into the air — softening, slackening, surrendering its stiffness. As it loses moisture it gains aroma: grass becomes flower, flower becomes fruit. The maker waits, and watches, and smells.</p>
      </section>

      {/* PULL QUOTE */}
      <section data-reveal style={{ maxWidth: 840, margin: '0 auto', padding: 'clamp(64px,9vw,120px) 24px', textAlign: 'center' }}>
        <div aria-hidden="true" style={{ fontFamily: F.display, fontSize: 90, lineHeight: 0.4, color: C.gold, opacity: 0.55 }}>“</div>
        <blockquote style={{ fontFamily: F.display, fontStyle: 'italic', fontWeight: 400, fontSize: 'clamp(30px,5vw,52px)', lineHeight: 1.18, color: C.cream, margin: '18px auto 0', maxWidth: 760 }}>
          Tea is not manufactured. It is persuaded — coaxed from one state into another by heat, air, and an unhurried hand.
        </blockquote>
        <div aria-hidden="true" style={{ width: 40, height: 1, background: C.gold, opacity: 0.5, margin: '36px auto 0' }} />
      </section>

      {/* PLATE: annotated cross-section */}
      <figure data-reveal style={{ maxWidth: 760, margin: '0 auto', padding: '0 0 clamp(20px,4vw,40px)' }}>
        <div style={{ position: 'relative', aspectRatio: '16/10', border: '1px solid rgba(168,135,77,0.2)', borderRadius: 3, overflow: 'hidden', background: 'linear-gradient(150deg,#241d14 0%,#16110b 100%)' }}>
          <div aria-hidden="true" style={{ ...grainCss('0.85', 140), opacity: 0.07 }} />
          <svg viewBox="0 0 760 475" preserveAspectRatio="xMidYMid meet" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
            <g fill="none" stroke="rgba(168,135,77,0.5)" strokeWidth="1.1">
              <path d="M150 250 C 250 140, 510 140, 610 250 C 510 360, 250 360, 150 250 Z" />
              <path d="M150 250 C 250 200, 510 200, 610 250" stroke="rgba(168,135,77,0.32)" />
              <path d="M150 250 C 250 300, 510 300, 610 250" stroke="rgba(168,135,77,0.32)" />
              <line x1="380" y1="158" x2="380" y2="342" stroke="rgba(168,135,77,0.4)" />
            </g>
            <g stroke="rgba(168,135,77,0.4)" strokeWidth="1"><line x1="300" y1="218" x2="300" y2="120" /><line x1="470" y1="290" x2="560" y2="380" /></g>
            <g fill={C.gold}><circle cx="300" cy="218" r="3.4" /><circle cx="470" cy="290" r="3.4" /></g>
          </svg>
          <div style={{ position: 'absolute', left: '6%', top: '14%', maxWidth: '30%' }}>
            <div style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: '0.18em', color: C.gold }}>01</div>
            <div style={{ fontFamily: F.body, fontStyle: 'italic', fontSize: 13, lineHeight: 1.4, color: C.taupe }}>The waxy cuticle — the leaf’s seal against the air.</div>
          </div>
          <div style={{ position: 'absolute', right: '5%', bottom: '9%', maxWidth: '32%', textAlign: 'right' }}>
            <div style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: '0.18em', color: C.gold }}>02</div>
            <div style={{ fontFamily: F.body, fontStyle: 'italic', fontSize: 13, lineHeight: 1.4, color: C.taupe }}>Enzymes within the cell, waiting to meet the air.</div>
          </div>
        </div>
        <figcaption style={{ display: 'flex', gap: 14, alignItems: 'baseline', marginTop: 16, paddingTop: 12, borderTop: '1px solid rgba(168,135,77,0.14)' }}>
          <span style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.gold, whiteSpace: 'nowrap' }}>Plate I</span>
          <span style={{ fontFamily: F.body, fontStyle: 'italic', fontSize: 14, lineHeight: 1.5, color: C.dim }}>The tea leaf in cross-section. Rupture this surface and oxidation begins — the hinge on which every category turns.</span>
        </figcaption>
      </figure>

      {/* SECTION III */}
      <section style={{ maxWidth: 680, margin: '0 auto', padding: 'clamp(40px,6vw,72px) 0 0' }}>
        <SectionRule numeral="III" label="The Turning" />
        <p data-reveal style={msBody}>Here is the secret the whole craft turns upon. Break a leaf’s surface and its enzymes meet the air; the green begins to brown, the way a cut apple does. This is <em style={{ fontStyle: 'italic', color: C.ink }}>oxidation</em>. Halt it early and the tea stays green and vegetal. Let it run, and the leaf darkens toward malt, honey, and warm stone fruit.</p>
        <p data-reveal style={{ ...msBody, margin: 0 }}>Every category of tea is, in the end, simply a decision about where along this road to stop.</p>
      </section>

      {/* OXIDATION SCALE */}
      <section data-reveal style={{ maxWidth: 760, margin: '0 auto', padding: 'clamp(40px,6vw,64px) 0' }}>
        <div style={{ position: 'relative', padding: '38px 4px 8px' }}>
          <div style={{ position: 'relative', height: 5, borderRadius: 3, background: oxBar }} />
          <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', marginTop: 14 }}>
            <div style={{ textAlign: 'left' }}><div style={{ fontFamily: F.mono, fontSize: 11, color: C.gold }}>0%</div><div style={scaleLbl}>Unoxidised</div></div>
            <div style={{ textAlign: 'right' }}><div style={{ fontFamily: F.mono, fontSize: 11, color: C.gold }}>100%</div><div style={scaleLbl}>Fully oxidised</div></div>
          </div>
          <div style={{ position: 'absolute', top: 30, left: '2%', fontFamily: F.display, fontStyle: 'italic', fontSize: 15, color: C.taupe }}>Green</div>
          <div style={{ position: 'absolute', top: 30, left: '50%', transform: 'translateX(-50%)', fontFamily: F.display, fontStyle: 'italic', fontSize: 15, color: C.taupe }}>Oolong</div>
          <div style={{ position: 'absolute', top: 30, right: '2%', fontFamily: F.display, fontStyle: 'italic', fontSize: 15, color: C.taupe }}>Red</div>
        </div>
      </section>

      {/* SIX COLOURS list */}
      <section style={{ maxWidth: 680, margin: '0 auto', padding: 'clamp(20px,4vw,40px) 0 clamp(40px,6vw,72px)' }}>
        <h2 data-reveal style={{ fontFamily: F.display, fontWeight: 400, fontSize: 'clamp(28px,4vw,42px)', lineHeight: 1.1, color: C.cream, margin: '0 0 8px', textAlign: 'center' }}>The Six Colours of Tea</h2>
        <p data-reveal style={{ fontFamily: F.body, fontStyle: 'italic', fontSize: 15, color: C.dim, textAlign: 'center', margin: '0 0 40px' }}>One plant. Six families. Each one a different answer to the same question.</p>
        <div data-reveal style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '0 22px' }}>
          <div style={{ gridColumn: '1/-1', height: 1, background: 'rgba(168,135,77,0.16)' }} />
          {SIX.map((s, i) => (
            <React.Fragment key={s.name}>
              <div style={{ display: 'contents' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '18px 0' }}>
                  <span style={{ width: 13, height: 13, borderRadius: '50%', background: s.dot, boxShadow: `0 0 0 4px ${hexA(s.dot, 0.11)}` }} />
                  <span style={{ fontFamily: F.display, fontSize: 23, color: C.ink }}>{s.name}</span>
                </div>
                <p style={{ alignSelf: 'center', fontFamily: F.body, fontSize: 14.5, lineHeight: 1.55, color: C.dim, margin: 0, padding: '18px 0' }}>{s.char}</p>
                <span style={{ alignSelf: 'center', fontFamily: F.mono, fontSize: 11, color: C.gold, padding: '18px 0', whiteSpace: 'nowrap' }}>{s.ox}</span>
              </div>
              <div style={{ gridColumn: '1/-1', height: 1, background: i === SIX.length - 1 ? 'rgba(168,135,77,0.16)' : 'rgba(168,135,77,0.10)' }} />
            </React.Fragment>
          ))}
        </div>
      </section>

      {/* CLOSING */}
      <section data-reveal style={{ maxWidth: 600, margin: '0 auto', padding: 'clamp(48px,7vw,96px) 0 clamp(64px,9vw,120px)', textAlign: 'center' }}>
        <div aria-hidden="true" style={{ fontFamily: F.cn, fontSize: 40, fontWeight: 200, color: C.gold, opacity: 0.7, marginBottom: 28 }}>止</div>
        <p style={{ fontFamily: F.display, fontStyle: 'italic', fontWeight: 400, fontSize: 'clamp(22px,3.4vw,30px)', lineHeight: 1.4, color: C.ink, margin: 0 }}>
          From a single shrub on a single hillside, six families of tea — and within them, ten thousand cups. To learn tea is to learn where to stop. The rest, the leaf will teach you.
        </p>
        <div style={{ marginTop: 44, fontFamily: F.mono, fontSize: 10, letterSpacing: '0.24em', textTransform: 'uppercase', color: C.dim, lineHeight: 2 }}>Words by Teajia<br />The Craft of Tea &nbsp;·&nbsp; N°01</div>
      </section>
    </div>
  </article>
);

const msBody: React.CSSProperties = { fontFamily: F.body, fontSize: 'clamp(17px,2vw,19px)', lineHeight: 1.8, color: C.taupe, margin: '0 0 22px' };
const scaleLbl: React.CSSProperties = { fontFamily: F.ui, fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.dim, marginTop: 3 };

const SectionRule: React.FC<{ numeral: string; label: string }> = ({ numeral, label }) => (
  <div data-reveal style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 30 }}>
    <span style={{ fontFamily: F.display, fontStyle: 'italic', fontWeight: 400, fontSize: 34, color: C.gold, lineHeight: 1 }}>{numeral}</span>
    <span style={{ flex: 1, height: 1, background: 'rgba(168,135,77,0.22)' }} />
    <span style={{ fontFamily: F.ui, fontSize: 10, fontWeight: 500, letterSpacing: '0.24em', textTransform: 'uppercase', color: C.dim }}>{label}</span>
  </div>
);

// ════════════════════════════════════════════════════════════════════════════
//  II · GALLERY
// ════════════════════════════════════════════════════════════════════════════
const Gallery: React.FC = () => (
  <article style={{ position: 'relative', zIndex: 1 }}>
    {/* COVER — asymmetric */}
    <header style={{ position: 'relative', minHeight: '96vh', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,400px),1fr))', alignItems: 'stretch', overflow: 'hidden', borderBottom: '1px solid rgba(168,135,77,0.14)' }}>
      <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: 'clamp(28px,5vw,72px)', gap: 0 }}>
        <div style={{ fontFamily: F.mono, fontSize: 'clamp(60px,9vw,130px)', fontWeight: 400, lineHeight: 0.9, color: 'rgba(168,135,77,0.34)', letterSpacing: '-0.02em' }}>N°01</div>
        <div style={{ fontFamily: F.ui, fontSize: 11, fontWeight: 500, letterSpacing: '0.3em', textTransform: 'uppercase', color: C.gold, margin: '18px 0 22px' }}>The Craft of Tea</div>
        <h1 style={{ fontFamily: F.display, fontWeight: 500, fontSize: 'clamp(50px,8.2vw,108px)', lineHeight: 0.93, letterSpacing: '-0.02em', color: C.cream, margin: 0 }}>From Leaf<br /><span style={{ fontStyle: 'italic', fontWeight: 400, color: C.gold }}>to Liquor</span></h1>
        <p style={{ fontFamily: F.body, fontStyle: 'italic', fontSize: 'clamp(16px,1.9vw,20px)', lineHeight: 1.5, color: C.taupe, margin: '26px 0 0', maxWidth: 440 }}>How a single leaf becomes the six colours of tea — and why the whole craft turns on knowing when to stop.</p>
      </div>
      <div style={{ position: 'relative', overflow: 'hidden', background: 'linear-gradient(155deg,#2a2117 0%,#14100b 75%)', minHeight: '46vh' }}>
        <div aria-hidden="true" style={{ ...grainCss('0.85', 160), opacity: 0.08 }} />
        <div aria-hidden="true" style={{ position: 'absolute', top: '50%', left: '54%', transform: 'translate(-50%,-50%)', width: '74%', aspectRatio: '3/4', borderRadius: '50% 50% 48% 48%/60% 60% 40% 40%', border: '1px solid rgba(168,135,77,0.4)', background: 'radial-gradient(ellipse 70% 60% at 50% 30%, rgba(168,135,77,0.12), transparent 70%)' }} />
        <div aria-hidden="true" style={{ position: 'absolute', top: '50%', left: '54%', transform: 'translate(-50%,-50%)', width: '50%', aspectRatio: '3/4', borderRadius: '50% 50% 48% 48%/60% 60% 40% 40%', border: '1px solid rgba(168,135,77,0.26)' }} />
        <div aria-hidden="true" style={{ position: 'absolute', top: '50%', left: '54%', transform: 'translate(-50%,-50%)', width: 1, height: '62%', background: 'linear-gradient(rgba(168,135,77,0.4),transparent)' }} />
        <div style={{ position: 'absolute', bottom: 22, right: 24, fontFamily: F.mono, fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.dim }}>Plate — Camellia sinensis</div>
      </div>
    </header>

    {/* LEAD statement */}
    <section data-reveal style={{ padding: 'clamp(70px,11vw,150px) clamp(24px,6vw,96px) clamp(40px,6vw,80px)' }}>
      <p style={{ fontFamily: F.display, fontWeight: 400, fontSize: 'clamp(26px,4.2vw,52px)', lineHeight: 1.24, letterSpacing: '-0.01em', color: C.ink, margin: 0, maxWidth: 1180 }}>
        Every tea in the world begins with the same plant. <span style={{ color: C.dim }}>What separates the grassy green of a Hangzhou spring from the honeyed dark of an aged Pu’er is not the leaf, but</span> what the maker does with it — and the precise moment they choose to stop.
      </p>
    </section>

    {/* FULL-BLEED PLATE I */}
    <figure data-reveal style={{ margin: 0, padding: 'clamp(20px,4vw,48px) 0' }}>
      <div style={{ position: 'relative', height: 'clamp(380px,68vh,720px)', overflow: 'hidden', background: 'linear-gradient(160deg,#241d14 0%,#120e09 90%)', borderTop: '1px solid rgba(168,135,77,0.16)', borderBottom: '1px solid rgba(168,135,77,0.16)' }}>
        <div aria-hidden="true" style={{ ...grainCss('0.8', 150), opacity: 0.07 }} />
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(100deg, transparent 0 46px, rgba(168,135,77,0.05) 46px 47px)' }} />
        <div aria-hidden="true" style={{ position: 'absolute', left: '50%', top: '48%', transform: 'translate(-50%,-50%)', display: 'flex', gap: 'clamp(14px,3vw,42px)' }}>
          <div style={{ width: 'clamp(34px,5vw,72px)', height: 'clamp(200px,40vh,420px)', border: '1px solid rgba(168,135,77,0.3)', borderRadius: 60, background: 'linear-gradient(180deg, rgba(168,135,77,0.08), transparent)' }} />
          <div style={{ width: 'clamp(34px,5vw,72px)', height: 'clamp(200px,40vh,420px)', border: '1px solid rgba(168,135,77,0.22)', borderRadius: 60 }} />
          <div style={{ width: 'clamp(34px,5vw,72px)', height: 'clamp(200px,40vh,420px)', border: '1px solid rgba(168,135,77,0.3)', borderRadius: 60, background: 'linear-gradient(180deg, rgba(168,135,77,0.06), transparent)' }} />
        </div>
        <div style={{ position: 'absolute', left: 'clamp(24px,5vw,64px)', bottom: 'clamp(24px,4vw,56px)', maxWidth: 440 }}>
          <div style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.gold, marginBottom: 12 }}>Plate I — The Withering</div>
          <p style={{ fontFamily: F.display, fontStyle: 'italic', fontSize: 'clamp(20px,2.6vw,30px)', lineHeight: 1.3, color: C.cream, margin: 0 }}>Spread thin on bamboo trays, the leaf exhales its water into the air — softening, surrendering its stiffness.</p>
        </div>
      </div>
    </figure>

    {/* TWO-UP */}
    <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,300px),1fr))', gap: 'clamp(28px,5vw,80px)', alignItems: 'center', padding: 'clamp(50px,8vw,110px) clamp(24px,6vw,96px)' }}>
      <div data-reveal>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 26 }}>
          <span style={{ fontFamily: F.mono, fontSize: 12, color: C.gold }}>01</span>
          <span style={{ flex: 1, height: 1, background: 'rgba(168,135,77,0.2)' }} />
          <span style={{ fontFamily: F.ui, fontSize: 10, fontWeight: 500, letterSpacing: '0.24em', textTransform: 'uppercase', color: C.dim }}>The Pluck</span>
        </div>
        <h2 style={{ fontFamily: F.display, fontWeight: 400, fontSize: 'clamp(30px,4vw,46px)', lineHeight: 1.08, color: C.cream, margin: '0 0 22px' }}>Tea begins in the hands.</h2>
        <p style={{ fontFamily: F.body, fontSize: 'clamp(16px,1.9vw,18px)', lineHeight: 1.78, color: C.taupe, margin: '0 0 18px' }}>In the high gardens of Yunnan and Fujian the spring flush is gathered leaf by leaf — two slender leaves and a single unopened bud. A skilled picker moves at the pace of a slow conversation, taking only what the season offers.</p>
        <p style={{ fontFamily: F.body, fontSize: 'clamp(16px,1.9vw,18px)', lineHeight: 1.78, color: C.dim, margin: 0 }}>Plucked a week early, the leaf has no body; a week late, it turns coarse. The finest harvests are measured not in weeks but in mornings.</p>
      </div>
      <figure data-reveal style={{ margin: 0 }}>
        <div style={{ position: 'relative', aspectRatio: '4/5', border: '1px solid rgba(168,135,77,0.22)', borderRadius: 3, overflow: 'hidden', background: 'radial-gradient(ellipse 70% 50% at 50% 22%, rgba(168,135,77,0.1), transparent 65%), #1b1610' }}>
          <div aria-hidden="true" style={{ ...grainCss('0.85', 130), opacity: 0.07 }} />
          <svg viewBox="0 0 320 400" preserveAspectRatio="xMidYMid meet" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
            <g fill="none" stroke="rgba(168,135,77,0.42)" strokeWidth="1.2"><path d="M160 70 C 110 150, 110 270, 160 330 C 210 270, 210 150, 160 70 Z" /><line x1="160" y1="90" x2="160" y2="320" /><path d="M160 150 C 140 160, 130 172, 124 190" /><path d="M160 190 C 182 200, 192 214, 198 232" /><path d="M160 230 C 140 240, 132 252, 126 270" /></g>
            <circle cx="160" cy="60" r="4" fill={C.gold} />
          </svg>
          <div style={{ position: 'absolute', bottom: 16, left: 18, fontFamily: F.cn, fontSize: 20, color: 'rgba(205,192,168,0.8)' }}>一芽二叶</div>
        </div>
        <figcaption style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.dim, marginTop: 14 }}>Plate II — One bud, two leaves</figcaption>
      </figure>
    </section>

    {/* PULL QUOTE full-bleed */}
    <section data-reveal style={{ padding: 'clamp(70px,11vw,150px) clamp(24px,6vw,96px)', textAlign: 'center', background: 'radial-gradient(ellipse 70% 80% at 50% 50%, rgba(168,135,77,0.06), transparent 70%)', borderTop: '1px solid rgba(168,135,77,0.1)', borderBottom: '1px solid rgba(168,135,77,0.1)' }}>
      <blockquote style={{ fontFamily: F.display, fontStyle: 'italic', fontWeight: 400, fontSize: 'clamp(32px,6vw,76px)', lineHeight: 1.1, letterSpacing: '-0.01em', color: C.cream, margin: '0 auto', maxWidth: 1100 }}>
        Tea is not manufactured.<br /><span style={{ color: C.gold }}>It is persuaded.</span>
      </blockquote>
      <p style={{ fontFamily: F.ui, fontSize: 11, fontWeight: 500, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.dim, margin: '38px 0 0' }}>Coaxed from one state to another by heat, air &amp; an unhurried hand</p>
    </section>

    {/* OXIDATION */}
    <section style={{ padding: 'clamp(60px,9vw,130px) clamp(24px,6vw,96px)' }}>
      <div data-reveal style={{ maxWidth: 1180, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 30 }}>
          <span style={{ fontFamily: F.mono, fontSize: 12, color: C.gold }}>02</span>
          <span style={{ fontFamily: F.ui, fontSize: 10, fontWeight: 500, letterSpacing: '0.24em', textTransform: 'uppercase', color: C.dim }}>The Turning</span>
        </div>
        <h2 style={{ fontFamily: F.display, fontWeight: 400, fontSize: 'clamp(30px,5vw,60px)', lineHeight: 1.08, color: C.cream, margin: '0 0 26px', maxWidth: 880 }}>Every category of tea is a decision about where to stop.</h2>
        <p style={{ fontFamily: F.body, fontSize: 'clamp(16px,2vw,19px)', lineHeight: 1.78, color: C.taupe, margin: '0 0 56px', maxWidth: 680 }}>Break a leaf’s surface and its enzymes meet the air; the green begins to brown, the way a cut apple does. Halt it early and the tea stays vegetal. Let it run, and the leaf darkens toward malt, honey, and warm stone fruit.</p>
        <div style={{ position: 'relative', paddingTop: 34 }}>
          <div style={{ height: 10, borderRadius: 5, background: oxBar }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
            <div><div style={{ fontFamily: F.mono, fontSize: 13, color: C.gold }}>0%</div><div style={scaleLbl}>Green · unoxidised</div></div>
            <div style={{ textAlign: 'center' }}><div style={{ fontFamily: F.mono, fontSize: 13, color: C.gold }}>~50%</div><div style={scaleLbl}>Oolong</div></div>
            <div style={{ textAlign: 'right' }}><div style={{ fontFamily: F.mono, fontSize: 13, color: C.gold }}>100%</div><div style={scaleLbl}>Red · fully oxidised</div></div>
          </div>
        </div>
      </div>
    </section>

    {/* SIX COLOURS — full-bleed band */}
    <section style={{ padding: 'clamp(40px,6vw,72px) 0 clamp(60px,9vw,120px)' }}>
      <h2 data-reveal style={{ fontFamily: F.display, fontWeight: 400, fontSize: 'clamp(28px,4.5vw,48px)', lineHeight: 1.05, color: C.cream, textAlign: 'center', margin: '0 0 8px' }}>The Six Colours of Tea</h2>
      <p data-reveal style={{ fontFamily: F.body, fontStyle: 'italic', fontSize: 15, color: C.dim, textAlign: 'center', margin: '0 0 clamp(36px,5vw,60px)' }}>One plant. Six families. Six answers to the same question.</p>
      <div data-reveal className="tj-tabs" style={{ display: 'flex', gap: 2, overflowX: 'auto', scrollSnapType: 'x proximity', padding: '0 clamp(16px,3vw,40px)' }}>
        {SIX.map((s) => (
          <div key={s.name} style={{ position: 'relative', flex: '1 0 clamp(140px,22vw,190px)', scrollSnapAlign: 'start', aspectRatio: '1/2.6', minHeight: 300, padding: '22px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', background: `linear-gradient(180deg, ${hexA(s.dot, 0.16)}, transparent 60%), #1a1610`, borderTop: `2px solid ${s.dot}` }}>
            <div style={{ fontFamily: F.mono, fontSize: 10, color: C.gold, marginBottom: 10 }}>{s.tableOx}</div>
            <div style={{ fontFamily: F.display, fontSize: 'clamp(20px,2.4vw,28px)', color: C.cream }}>{s.name}</div>
            <p style={{ fontFamily: F.body, fontSize: 12.5, lineHeight: 1.5, color: C.dim, margin: '8px 0 0' }}>{s.short}</p>
          </div>
        ))}
      </div>
    </section>

    {/* CLOSING */}
    <section data-reveal style={{ padding: 'clamp(60px,9vw,120px) clamp(24px,6vw,96px) clamp(80px,11vw,150px)', textAlign: 'center', borderTop: '1px solid rgba(168,135,77,0.12)' }}>
      <div aria-hidden="true" style={{ fontFamily: F.cn, fontSize: 'clamp(44px,7vw,80px)', fontWeight: 200, color: C.gold, opacity: 0.6, lineHeight: 1, marginBottom: 30 }}>止</div>
      <p style={{ fontFamily: F.display, fontStyle: 'italic', fontWeight: 400, fontSize: 'clamp(26px,4.5vw,52px)', lineHeight: 1.22, color: C.ink, margin: '0 auto', maxWidth: 900 }}>To learn tea is to learn where to stop. The rest, the leaf will teach you.</p>
      <div style={{ marginTop: 44, fontFamily: F.mono, fontSize: 10, letterSpacing: '0.24em', textTransform: 'uppercase', color: C.dim, lineHeight: 2 }}>Words by Teajia &nbsp;·&nbsp; The Craft of Tea &nbsp;·&nbsp; N°01</div>
    </section>
  </article>
);

// ════════════════════════════════════════════════════════════════════════════
//  III · FOLIO
// ════════════════════════════════════════════════════════════════════════════
const figGesture = (svg: React.ReactNode, name: string, blurb: string, strong = false) => (
  <div style={{ flex: 1, minWidth: 130, textAlign: 'center' }}>
    <div style={{ width: 58, height: 58, margin: '0 auto 16px', borderRadius: '50%', border: '1px solid rgba(168,135,77,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `radial-gradient(circle at 50% 35%, rgba(168,135,77,${strong ? 0.18 : 0.12}), transparent 70%)` }}>{svg}</div>
    <div style={{ fontFamily: F.display, fontSize: 20, color: C.ink, marginBottom: 6 }}>{name}</div>
    <div style={{ fontFamily: F.body, fontSize: 12.5, lineHeight: 1.5, color: C.dim }}>{blurb}</div>
  </div>
);

const Folio: React.FC = () => (
  <article style={{ position: 'relative', zIndex: 1, maxWidth: 1140, margin: '0 auto', padding: '0 clamp(20px,5vw,56px)' }}>
    {/* TITLE PAGE */}
    <header style={{ padding: 'clamp(60px,10vw,128px) 0 clamp(40px,5vw,64px)', borderBottom: '1px solid rgba(168,135,77,0.2)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 12, fontFamily: F.mono, fontSize: 10.5, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.dim, marginBottom: 'clamp(30px,5vw,56px)' }}>
        <span style={{ color: C.gold }}>The Craft of Tea — N°01</span>
        <span>An illustrated explainer</span>
      </div>
      <h1 style={{ fontFamily: F.display, fontWeight: 400, fontSize: 'clamp(44px,7.5vw,92px)', lineHeight: 1.0, letterSpacing: '-0.015em', color: C.cream, margin: 0, maxWidth: '13ch' }}>From Leaf to Liquor</h1>
      <p style={{ fontFamily: F.body, fontStyle: 'italic', fontSize: 'clamp(17px,2.2vw,23px)', lineHeight: 1.45, color: C.taupe, margin: '24px 0 clamp(34px,5vw,52px)', maxWidth: 560 }}>How a single leaf becomes the six colours of tea — and why the whole craft turns on knowing when to stop.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: '18px 28px', borderTop: '1px solid rgba(168,135,77,0.14)', paddingTop: 22 }}>
        {[['Words', 'The Teajia Studio'], ['Reading', '7 minutes'], ['Figures', 'Three plates'], ['Subject', 'Camellia sinensis']].map(([k, v]) => (
          <div key={k}>
            <div style={{ fontFamily: F.ui, fontSize: 9.5, fontWeight: 500, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.dim, marginBottom: 7 }}>{k}</div>
            <div style={{ fontFamily: F.body, fontSize: 15, color: C.ink }}>{v}</div>
          </div>
        ))}
      </div>
    </header>

    {/* BODY — two-column flow */}
    <section data-reveal style={{ padding: 'clamp(44px,6vw,72px) 0 0' }}>
      <div style={{ columns: '19em', columnGap: 'clamp(28px,4vw,52px)', fontFamily: F.body, fontSize: 16, lineHeight: 1.76, color: C.taupe }}>
        <p style={{ margin: '0 0 18px' }}><span style={{ float: 'left', fontFamily: F.display, fontWeight: 600, fontSize: '3.4em', lineHeight: 0.72, color: C.gold, margin: '6px 12px -2px 0' }}>E</span>very tea in the world — the grassy green of a Hangzhou spring, the honeyed dark of an aged Pu’er — begins with the same plant. <em style={{ color: C.ink }}>Camellia sinensis</em>, an evergreen shrub unremarkable to the passing eye. What separates one tea from another is not the leaf, but what the maker does with it.</p>
        <p style={{ margin: '0 0 18px' }}>Tea begins in the hands. In the high gardens of Yunnan and Fujian the spring flush is gathered leaf by leaf — two slender leaves and a single unopened bud, the most tender part of the plant. A skilled picker takes only what the season offers.</p>
        <p style={{ margin: '0 0 18px' }}>Once gathered, the leaf is laid out to wither. It is the quietest step, and the most important. Spread thin on bamboo trays, the leaf exhales its water into the air. As it loses moisture it gains aroma: grass becomes flower, flower becomes fruit.</p>
        <p style={{ margin: 0 }}>Then comes the decision that names the tea. Break the leaf’s surface and its enzymes meet the air; the green begins to brown, as a cut apple does. This is <em style={{ color: C.ink }}>oxidation</em> — and every category of tea is, in the end, a choice about where to halt it.</p>
      </div>
    </section>

    {/* FIG 1 — process flow */}
    <figure data-reveal style={{ margin: 'clamp(44px,6vw,72px) 0', border: '1px solid rgba(168,135,77,0.18)', borderRadius: 3, background: 'linear-gradient(160deg,#1d1810,#15110b)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '16px clamp(18px,3vw,28px)', borderBottom: '1px solid rgba(168,135,77,0.12)' }}>
        <span style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.gold }}>Fig. 1</span>
        <span style={{ fontFamily: F.ui, fontSize: 10, fontWeight: 500, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.dim }}>The four gestures of tea-making</span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, padding: 'clamp(28px,4vw,48px) clamp(18px,3vw,28px)' }}>
        {figGesture(<svg width="26" height="26" viewBox="0 0 26 26" fill="none"><path d="M13 3 C8 9, 8 18, 13 23 C18 18, 18 9, 13 3Z M13 6v15" stroke="#a8874d" strokeWidth="1.1" /></svg>, 'Pluck', 'Two leaves & a bud, gathered by hand.')}
        {figGesture(<svg width="26" height="26" viewBox="0 0 26 26" fill="none"><path d="M4 17h18M6 17c0-5 5-8 7-8s7 3 7 8" stroke="#a8874d" strokeWidth="1.1" /><path d="M10 6v3M16 6v3" stroke="#a8874d" strokeWidth="1.1" strokeLinecap="round" /></svg>, 'Wither', 'Moisture leaves; aroma wakes.')}
        {figGesture(<svg width="26" height="26" viewBox="0 0 26 26" fill="none"><circle cx="13" cy="13" r="9" stroke="#a8874d" strokeWidth="1.1" /><path d="M13 13 L13 5 A8 8 0 0 1 20 16 Z" fill="rgba(168,135,77,0.35)" /></svg>, 'Oxidise', 'The turning — halted, or let run.', true)}
        {figGesture(<svg width="26" height="26" viewBox="0 0 26 26" fill="none"><path d="M5 20c4-2 12-2 16 0M7 15c3-9 9-9 12 0" stroke="#a8874d" strokeWidth="1.1" strokeLinecap="round" /></svg>, 'Dry', 'Fixed in time, ready to keep.')}
      </div>
    </figure>

    {/* FIG 2 — oxidation chart */}
    <figure data-reveal style={{ margin: 'clamp(44px,6vw,72px) 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: 16, borderBottom: '1px solid rgba(168,135,77,0.14)', marginBottom: 'clamp(36px,5vw,56px)' }}>
        <span style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.gold }}>Fig. 2</span>
        <span style={{ fontFamily: F.ui, fontSize: 10, fontWeight: 500, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.dim }}>The oxidation spectrum</span>
      </div>
      <div style={{ position: 'relative', height: 118 }}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 78, height: 6, borderRadius: 3, background: 'linear-gradient(90deg,#7d8f5a 0%,#cfc18a 14%,#c9b061 26%,#bf8f4a 52%,#9a5a3a 80%,#3a2820 100%)' }} />
        <div style={{ position: 'absolute', left: '1%', top: 78 }}><div style={{ width: 1, height: 18, background: 'rgba(168,135,77,0.5)', marginTop: -12 }} /><div style={{ position: 'absolute', bottom: 34, left: 0, fontFamily: F.display, fontStyle: 'italic', fontSize: 15, color: C.ink, whiteSpace: 'nowrap' }}>Green</div><div style={{ position: 'absolute', top: 24, left: 0, fontFamily: F.mono, fontSize: 10, color: C.gold }}>0%</div></div>
        <div style={{ position: 'absolute', left: '11%', top: 78 }}><div style={{ width: 1, height: 14, background: 'rgba(168,135,77,0.4)', marginTop: -9 }} /><div style={{ position: 'absolute', bottom: 18, left: 0, transform: 'translateX(-50%)', fontFamily: F.display, fontStyle: 'italic', fontSize: 13, color: C.taupe, whiteSpace: 'nowrap' }}>White</div></div>
        <div style={{ position: 'absolute', left: '50%', top: 78 }}><div style={{ width: 1, height: 18, background: 'rgba(168,135,77,0.5)', marginTop: -12 }} /><div style={{ position: 'absolute', bottom: 34, left: 0, transform: 'translateX(-50%)', fontFamily: F.display, fontStyle: 'italic', fontSize: 15, color: C.ink, whiteSpace: 'nowrap' }}>Oolong</div><div style={{ position: 'absolute', top: 24, left: 0, transform: 'translateX(-50%)', fontFamily: F.mono, fontSize: 10, color: C.gold }}>15–80%</div></div>
        <div style={{ position: 'absolute', left: '99%', top: 78 }}><div style={{ width: 1, height: 18, background: 'rgba(168,135,77,0.5)', marginTop: -12 }} /><div style={{ position: 'absolute', bottom: 34, right: 0, fontFamily: F.display, fontStyle: 'italic', fontSize: 15, color: C.ink, whiteSpace: 'nowrap' }}>Red</div><div style={{ position: 'absolute', top: 24, right: 0, fontFamily: F.mono, fontSize: 10, color: C.gold }}>100%</div></div>
      </div>
      <figcaption style={{ fontFamily: F.body, fontStyle: 'italic', fontSize: 13.5, lineHeight: 1.55, color: C.dim, marginTop: 14, maxWidth: 620 }}>Each family of tea occupies a position on a single continuum. Dark tea (Pu’er) sits outside it — oxidised, then fermented again by microbes over years.</figcaption>
    </figure>

    {/* TABLE — six colours */}
    <section data-reveal style={{ margin: 'clamp(44px,6vw,72px) 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: 16, borderBottom: '1px solid rgba(168,135,77,0.14)', marginBottom: 6 }}>
        <h2 style={{ fontFamily: F.display, fontWeight: 400, fontSize: 'clamp(24px,3vw,34px)', color: C.cream, margin: 0 }}>The Six Colours</h2>
        <span style={{ fontFamily: F.ui, fontSize: 10, fontWeight: 500, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.dim }}>Table I</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.7fr 2fr', gap: 0, fontFamily: F.body }}>
        <div style={{ display: 'contents', fontFamily: F.ui }}>
          {['Family', 'Oxidation', 'Character'].map((h) => (
            <div key={h} style={{ padding: '14px 0 12px', fontSize: 9.5, fontWeight: 500, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.dim }}>{h}</div>
          ))}
        </div>
        <div style={{ gridColumn: '1/-1', height: 1, background: 'rgba(168,135,77,0.18)' }} />
        {SIX.map((s, i) => (
          <React.Fragment key={s.name}>
            <div style={{ display: 'contents' }}>
              <div style={{ padding: '17px 0', display: 'flex', alignItems: 'center', gap: 12 }}><span style={{ width: 11, height: 11, borderRadius: '50%', background: s.dot }} /><span style={{ fontSize: 18, color: C.ink }}>{s.name}</span></div>
              <div style={{ padding: '17px 0', alignSelf: 'center', fontFamily: F.mono, fontSize: 12, color: C.gold }}>{s.tableOx}</div>
              <div style={{ padding: '17px 0', alignSelf: 'center', fontSize: 14, color: C.dim, lineHeight: 1.5 }}>{s.char}</div>
            </div>
            <div style={{ gridColumn: '1/-1', height: 1, background: i === SIX.length - 1 ? 'rgba(168,135,77,0.18)' : 'rgba(168,135,77,0.09)' }} />
          </React.Fragment>
        ))}
      </div>
    </section>

    {/* FIG 3 — tasting panel */}
    <figure data-reveal style={{ margin: 'clamp(44px,6vw,72px) 0', border: '1px solid rgba(168,135,77,0.18)', borderRadius: 3, background: 'linear-gradient(160deg,#1d1810,#15110b)', padding: 'clamp(24px,4vw,40px)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: 18, borderBottom: '1px solid rgba(168,135,77,0.12)', marginBottom: 28 }}>
        <span style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.gold }}>Fig. 3 — Tasting</span>
        <span style={{ fontFamily: F.ui, fontSize: 10, fontWeight: 500, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.dim }}>A worked example</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 'clamp(28px,5vw,56px)' }}>
        <div>
          <div style={{ fontFamily: F.cn, fontSize: 24, color: C.taupe, marginBottom: 6 }}>肉桂</div>
          <h3 style={{ fontFamily: F.display, fontWeight: 400, fontSize: 30, color: C.cream, margin: '0 0 4px' }}>Rou Gui</h3>
          <p style={{ fontFamily: F.ui, fontSize: 10, fontWeight: 500, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.dim, margin: '0 0 18px' }}>Wuyi rock oolong · ~50% oxidised</p>
          <p style={{ fontFamily: F.body, fontStyle: 'italic', fontSize: 15, lineHeight: 1.6, color: C.taupe, margin: 0 }}>Roast cinnamon and orchid over warm stone, with the long mineral finish the Wuyi cliffs call <em style={{ color: C.gold }}>yan yun</em> — rock rhyme.</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, justifyContent: 'center' }}>
          <FolioMeter label="Body" value="Full" pct={82} />
          <FolioMeter label="Roast" value="Medium" pct={58} />
          <FolioMeter label="Florality" value="Orchid" pct={64} />
          <FolioMeter label="Finish" value="Very long" pct={90} />
        </div>
      </div>
    </figure>

    {/* CLOSING */}
    <section data-reveal style={{ padding: 'clamp(40px,6vw,64px) 0 clamp(80px,11vw,140px)', borderTop: '1px solid rgba(168,135,77,0.2)', marginTop: 'clamp(20px,4vw,40px)' }}>
      <p style={{ fontFamily: F.display, fontStyle: 'italic', fontWeight: 400, fontSize: 'clamp(22px,3.2vw,34px)', lineHeight: 1.3, color: C.ink, margin: '0 auto', maxWidth: 760, textAlign: 'center' }}>From a single shrub, six families of tea — and within them, ten thousand cups. To learn tea is to learn where to stop.</p>
      <div style={{ marginTop: 40, textAlign: 'center', fontFamily: F.mono, fontSize: 10, letterSpacing: '0.24em', textTransform: 'uppercase', color: C.dim, lineHeight: 2 }}>The Teajia Studio &nbsp;·&nbsp; The Craft of Tea &nbsp;·&nbsp; N°01</div>
    </section>
  </article>
);

const FolioMeter: React.FC<{ label: string; value: string; pct: number }> = ({ label, value, pct }) => (
  <div>
    <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: F.ui, fontSize: 10, fontWeight: 500, letterSpacing: '0.16em', textTransform: 'uppercase', color: C.taupe, marginBottom: 7 }}>
      <span>{label}</span><span style={{ color: C.dim }}>{value}</span>
    </div>
    <div style={{ height: 3, background: 'rgba(168,135,77,0.12)', borderRadius: 2 }}><div style={{ height: '100%', width: `${pct}%`, background: C.gold, borderRadius: 2 }} /></div>
  </div>
);

// ════════════════════════════════════════════════════════════════════════════
//  IV · THREAD
// ════════════════════════════════════════════════════════════════════════════
const Thread: React.FC = () => {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const fillRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onScroll = () => {
      const track = trackRef.current;
      const fill = fillRef.current;
      if (!track || !fill) return;
      const r = track.getBoundingClientRect();
      const anchor = window.innerHeight * 0.55;
      const prog = Math.max(0, Math.min(1, (anchor - r.top) / r.height));
      fill.style.height = (prog * r.height).toFixed(1) + 'px';
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const node = (numeral: string) => (
    <div style={{ position: 'absolute', left: 'clamp(28px,7vw,46px)', top: 22, transform: 'translate(-50%,-50%)', width: 42, height: 42, borderRadius: '50%', background: '#1a140d', border: '1px solid rgba(168,135,77,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: F.cn, fontSize: 18, color: C.gold }}>{numeral}</div>
  );
  const kicker: React.CSSProperties = { fontFamily: F.ui, fontSize: 10, fontWeight: 500, letterSpacing: '0.24em', textTransform: 'uppercase', color: C.dim, marginBottom: 14 };
  const h2: React.CSSProperties = { fontFamily: F.display, fontWeight: 400, fontSize: 'clamp(28px,4.4vw,42px)', lineHeight: 1.1, color: C.cream, margin: '0 0 18px' };
  const body: React.CSSProperties = { fontFamily: F.body, fontSize: 'clamp(16px,2vw,18px)', lineHeight: 1.78, color: C.taupe, margin: 0 };
  const stepPad: React.CSSProperties = { position: 'relative', padding: '0 0 clamp(40px,7vw,72px) clamp(58px,14vw,98px)' };

  return (
    <article style={{ position: 'relative', zIndex: 1 }}>
      {/* COVER */}
      <header style={{ position: 'relative', minHeight: '88vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 'clamp(40px,8vw,90px) 24px 0', overflow: 'hidden' }}>
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 70% 50% at 50% 30%, rgba(168,135,77,0.1), transparent 62%)' }} />
        <div style={{ position: 'relative' }}>
          <div style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: '0.36em', textTransform: 'uppercase', color: C.gold, marginBottom: 28 }}>A journey in five steps</div>
          <h1 style={{ fontFamily: F.display, fontWeight: 400, fontSize: 'clamp(54px,11vw,128px)', lineHeight: 0.96, letterSpacing: '-0.015em', color: C.cream, margin: 0 }}>Leaf <span style={{ fontStyle: 'italic', color: C.gold }}>to</span> Cup</h1>
          <p style={{ fontFamily: F.body, fontStyle: 'italic', fontSize: 'clamp(16px,2.2vw,21px)', lineHeight: 1.5, color: C.taupe, margin: '26px auto 0', maxWidth: 440 }}>Follow a single leaf along the thread of its making — five quiet transformations, from the garden to your hands.</p>
        </div>
        <div aria-hidden="true" style={{ position: 'relative', marginTop: 'clamp(36px,6vw,64px)', width: 1, height: 'clamp(70px,12vh,130px)', background: 'linear-gradient(var(--tj-gold,#a8874d),transparent)' }} />
      </header>

      {/* THE THREAD */}
      <div ref={trackRef} style={{ position: 'relative', maxWidth: 840, margin: '0 auto', padding: 'clamp(10px,3vw,30px) clamp(20px,5vw,40px) clamp(40px,7vw,80px) clamp(20px,5vw,30px)' }}>
        <div aria-hidden="true" style={{ position: 'absolute', left: 'clamp(28px,7vw,46px)', top: 0, bottom: 'clamp(40px,7vw,80px)', width: 1, background: 'rgba(168,135,77,0.16)' }} />
        <div ref={fillRef} aria-hidden="true" style={{ position: 'absolute', left: 'clamp(28px,7vw,46px)', top: 0, width: 1, height: 0, background: 'linear-gradient(var(--tj-gold,#a8874d),var(--tj-gold-lt,#c6a667))', boxShadow: '0 0 9px rgba(168,135,77,0.45)', transition: 'height 120ms linear' }} />

        {/* 一 Pluck */}
        <section data-reveal style={{ position: 'relative', padding: 'clamp(28px,5vw,48px) 0 clamp(40px,7vw,72px) clamp(58px,14vw,98px)' }}>
          <div style={{ position: 'absolute', left: 'clamp(28px,7vw,46px)', top: 'clamp(30px,5vw,52px)', transform: 'translate(-50%,-50%)', width: 42, height: 42, borderRadius: '50%', background: '#1a140d', border: '1px solid rgba(168,135,77,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: F.cn, fontSize: 18, color: C.gold }}>一</div>
          <div style={kicker}>The Pluck · 采</div>
          <h2 style={h2}>It begins in the hands</h2>
          <p style={body}>In the cool hour before the mist burns away, the spring flush is gathered leaf by leaf — two slender leaves and a single unopened bud. A skilled picker takes only the tenderest tip, and only what the season offers.</p>
        </section>

        {/* 二 Wither */}
        <section data-reveal style={stepPad}>
          {node('二')}
          <div style={kicker}>The Withering · 萎凋</div>
          <h2 style={h2}>The leaf learns to breathe</h2>
          <p style={{ ...body, marginBottom: 26 }}>Spread thin on bamboo trays, the leaf exhales its water into the air — softening, slackening, surrendering its stiffness. As it loses moisture it gains aroma: grass becomes flower, flower becomes fruit.</p>
          <div style={{ position: 'relative', aspectRatio: '16/7', border: '1px solid rgba(168,135,77,0.18)', borderRadius: 3, overflow: 'hidden', background: 'linear-gradient(150deg,#241d14,#14100b)' }}>
            <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(94deg, transparent 0 34px, rgba(168,135,77,0.06) 34px 35px)' }} />
            <div style={{ position: 'absolute', left: 16, bottom: 12, fontFamily: F.mono, fontSize: 9.5, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.dim }}>Bamboo withering trays</div>
          </div>
        </section>

        {/* 三 Turn */}
        <section data-reveal style={stepPad}>
          <div style={{ position: 'absolute', left: 'clamp(28px,7vw,46px)', top: 22, transform: 'translate(-50%,-50%)', width: 42, height: 42, borderRadius: '50%', background: '#1a140d', border: '1px solid rgba(168,135,77,0.55)', boxShadow: '0 0 14px rgba(168,135,77,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: F.cn, fontSize: 18, color: C.gold }}>三</div>
          <div style={kicker}>The Turning · 氧化</div>
          <h2 style={h2}>The moment that names the tea</h2>
          <p style={{ ...body, marginBottom: 26 }}>Break the leaf’s surface and its enzymes meet the air; the green begins to brown, as a cut apple does. This is <em style={{ color: C.ink }}>oxidation</em>. Where the maker chooses to halt it decides everything — and gives us the six colours of tea.</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '18px 22px' }}>
            {SIX.map((s) => (
              <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <span style={{ width: 11, height: 11, borderRadius: '50%', background: s.dot }} />
                <span style={{ fontFamily: F.display, fontSize: 18, color: C.ink }}>{s.name}</span>
                <span style={{ fontFamily: F.mono, fontSize: 10, color: C.dim }}>{s.tableOx}</span>
              </div>
            ))}
          </div>
        </section>

        {/* 四 Fire */}
        <section data-reveal style={stepPad}>
          {node('四')}
          <div style={kicker}>The Firing · 干燥</div>
          <h2 style={h2}>Fixed in time</h2>
          <p style={body}>A last pass of heat stills the leaf where the maker wants it — arresting the turning, driving off the last moisture, and sealing in everything the journey has gathered. The tea is now ready to rest, and to travel, and to wait for water.</p>
        </section>

        {/* 五 Brew */}
        <section data-reveal style={{ position: 'relative', padding: '0 0 clamp(28px,5vw,40px) clamp(58px,14vw,98px)' }}>
          {node('五')}
          <div style={kicker}>The Brewing · 冲泡</div>
          <h2 style={h2}>Water returns the leaf to life</h2>
          <p style={{ ...body, marginBottom: 26 }}>Warmth, and patience, and the leaf unfurls — releasing in a single cup everything the mountain, the morning, and the maker put into it. The journey that began in the hands ends, at last, in yours.</p>
          <div style={{ position: 'relative', width: 'clamp(120px,30vw,150px)', aspectRatio: '1/1', margin: '0 auto' }}>
            <div aria-hidden="true" style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '1px solid rgba(168,135,77,0.4)', background: 'radial-gradient(circle at 50% 38%, rgba(168,135,77,0.22), rgba(168,135,77,0.05) 60%, transparent 72%)' }} />
            <div aria-hidden="true" style={{ position: 'absolute', left: '50%', top: '18%', transform: 'translateX(-50%)', width: 2, height: '18%', background: 'linear-gradient(transparent,rgba(168,135,77,0.5))', animation: 'tjFloat 3s ease-in-out infinite' }} />
          </div>
        </section>
      </div>

      {/* CLOSING */}
      <section data-reveal style={{ position: 'relative', padding: 'clamp(30px,5vw,56px) 24px clamp(72px,10vw,130px)', textAlign: 'center' }}>
        <div aria-hidden="true" style={{ fontFamily: F.cn, fontSize: 'clamp(40px,6vw,64px)', fontWeight: 200, color: C.gold, opacity: 0.65, lineHeight: 1, marginBottom: 26 }}>止</div>
        <p style={{ fontFamily: F.display, fontStyle: 'italic', fontWeight: 400, fontSize: 'clamp(22px,3.6vw,34px)', lineHeight: 1.32, color: C.ink, margin: '0 auto', maxWidth: 760 }}>To learn tea is to learn where to stop. The rest, the leaf will teach you.</p>
        <div style={{ marginTop: 40, fontFamily: F.mono, fontSize: 10, letterSpacing: '0.24em', textTransform: 'uppercase', color: C.dim, lineHeight: 2 }}>Words by Teajia &nbsp;·&nbsp; The Craft of Tea &nbsp;·&nbsp; N°01</div>
      </section>
    </article>
  );
};

// ════════════════════════════════════════════════════════════════════════════
//  V · REVERIE
// ════════════════════════════════════════════════════════════════════════════
const reverieSection: React.CSSProperties = { scrollSnapAlign: 'start', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '90px 24px 60px' };
const revKicker: React.CSSProperties = { fontFamily: F.ui, fontSize: 10, fontWeight: 500, letterSpacing: '0.3em', textTransform: 'uppercase', color: C.gold, marginBottom: 26 };

const Reverie: React.FC = () => (
  <article style={{ position: 'relative', zIndex: 1 }}>
    {/* S1 cover */}
    <section style={{ ...reverieSection, position: 'relative' }}>
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 60% 45% at 50% 42%, rgba(168,135,77,0.1), transparent 65%)' }} />
      <div style={{ position: 'relative' }}>
        <div style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: '0.4em', textTransform: 'uppercase', color: C.gold, marginBottom: 30 }}>The Craft of Tea · N°01</div>
        <h1 style={{ fontFamily: F.display, fontStyle: 'italic', fontWeight: 400, fontSize: 'clamp(48px,9vw,104px)', lineHeight: 1.0, letterSpacing: '-0.01em', color: C.cream, margin: 0 }}>From Leaf<br />to Liquor</h1>
        <p style={{ fontFamily: F.body, fontStyle: 'italic', fontSize: 'clamp(15px,2vw,19px)', color: C.taupe, margin: '28px auto 0', maxWidth: 380 }}>A slow read, one breath at a time.</p>
      </div>
      <div style={{ position: 'absolute', bottom: 38, left: '50%', transform: 'translateX(-50%)', animation: 'tjFloat 3.4s ease-in-out infinite' }}><svg width="13" height="22" viewBox="0 0 13 22" fill="none"><path d="M6.5 1v18M1 13.5l5.5 5.5 5.5-5.5" stroke="#a8874d" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg></div>
    </section>

    {/* S2 one plant */}
    <section style={reverieSection}>
      <div style={{ fontFamily: F.cn, fontWeight: 200, fontSize: 'clamp(70px,16vw,200px)', lineHeight: 0.9, color: 'rgba(168,135,77,0.16)', marginBottom: 10 }}>茶</div>
      <h2 style={{ fontFamily: F.display, fontWeight: 400, fontSize: 'clamp(38px,7vw,80px)', lineHeight: 1.05, color: C.cream, margin: 0 }}>One plant.</h2>
      <p style={{ fontFamily: F.body, fontSize: 'clamp(16px,2.2vw,21px)', lineHeight: 1.6, color: C.taupe, margin: '24px auto 0', maxWidth: 480 }}><em style={{ color: C.ink }}>Camellia sinensis.</em> Everything else — the six colours, the ten thousand cups — is only craft, and time.</p>
    </section>

    {/* S3 pluck */}
    <section style={reverieSection}>
      <div style={revKicker}>I · The Pluck</div>
      <h2 style={{ fontFamily: F.display, fontStyle: 'italic', fontWeight: 400, fontSize: 'clamp(32px,6vw,68px)', lineHeight: 1.12, color: C.cream, margin: 0, maxWidth: '14ch' }}>Two leaves and a bud, gathered by hand.</h2>
      <p style={{ fontFamily: F.body, fontSize: 'clamp(15px,2vw,18px)', lineHeight: 1.7, color: C.dim, margin: '28px auto 0', maxWidth: 440 }}>In the cool hour before the mountain mist burns away — only the tenderest tip, only what the season offers.</p>
    </section>

    {/* S4 wither */}
    <section style={{ ...reverieSection, background: 'radial-gradient(ellipse 70% 50% at 50% 60%, rgba(168,135,77,0.05), transparent 70%)' }}>
      <div style={revKicker}>II · The Withering</div>
      <h2 style={{ fontFamily: F.display, fontStyle: 'italic', fontWeight: 400, fontSize: 'clamp(32px,6vw,68px)', lineHeight: 1.12, color: C.cream, margin: 0, maxWidth: '13ch' }}>The leaf learns to breathe.</h2>
      <p style={{ fontFamily: F.body, fontSize: 'clamp(15px,2vw,18px)', lineHeight: 1.7, color: C.dim, margin: '28px auto 0', maxWidth: 440 }}>Grass becomes flower; flower becomes fruit. The maker waits, and watches, and smells.</p>
    </section>

    {/* S5 breathe */}
    <section style={{ ...reverieSection, position: 'relative' }}>
      <div style={{ position: 'relative', width: 'clamp(180px,42vw,260px)', height: 'clamp(180px,42vw,260px)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 40 }}>
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '1px solid rgba(168,135,77,0.22)' }} />
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'radial-gradient(circle, rgba(168,135,77,0.18), transparent 68%)', border: '1px solid rgba(168,135,77,0.45)', animation: 'tjBreath 8s ease-in-out infinite' }} />
        <div style={{ position: 'relative', fontFamily: F.cn, fontWeight: 200, fontSize: 34, color: C.gold }}>息</div>
      </div>
      <h2 style={{ fontFamily: F.display, fontWeight: 400, fontSize: 'clamp(28px,5vw,52px)', lineHeight: 1.1, color: C.cream, margin: 0 }}>Breathe with the leaf</h2>
      <p style={{ fontFamily: F.body, fontStyle: 'italic', fontSize: 'clamp(15px,2vw,18px)', lineHeight: 1.6, color: C.dim, margin: '20px auto 0', maxWidth: 380 }}>In as the circle grows, out as it falls. There is no hurry here. Tea is the art of the unhurried hand.</p>
    </section>

    {/* S6 oxidation */}
    <section style={reverieSection}>
      <div style={revKicker}>III · The Turning</div>
      <h2 style={{ fontFamily: F.display, fontWeight: 400, fontSize: 'clamp(34px,6.5vw,76px)', lineHeight: 1.06, color: C.cream, margin: 0, maxWidth: '15ch' }}>Everything turns on knowing <span style={{ fontStyle: 'italic', color: C.gold }}>when to stop.</span></h2>
      <div style={{ width: 'min(420px,82vw)', height: 5, borderRadius: 3, margin: '40px auto 0', background: oxBar }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', width: 'min(420px,82vw)', margin: '14px auto 0', fontFamily: F.mono, fontSize: 10, letterSpacing: '0.12em', color: C.dim }}><span>Green · 0%</span><span>Red · 100%</span></div>
    </section>

    {/* S7 six colours */}
    <section style={{ ...reverieSection, background: 'radial-gradient(ellipse 70% 50% at 50% 45%, rgba(168,135,77,0.05), transparent 70%)' }}>
      <h2 style={{ fontFamily: F.display, fontWeight: 400, fontSize: 'clamp(30px,5.5vw,60px)', lineHeight: 1.06, color: C.cream, margin: '0 0 44px' }}>Six colours. One plant.</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 'clamp(20px,5vw,52px)', maxWidth: 760 }}>
        {SIX.map((s) => (
          <div key={s.name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 18, height: 18, borderRadius: '50%', background: s.dot, boxShadow: `0 0 0 5px ${hexA(s.dot, 0.11)}` }} />
            <span style={{ fontFamily: F.display, fontSize: 21, color: C.ink }}>{s.name}</span>
          </div>
        ))}
      </div>
    </section>

    {/* S8 closing */}
    <section style={{ ...reverieSection, paddingBottom: 70 }}>
      <div aria-hidden="true" style={{ fontFamily: F.cn, fontSize: 'clamp(44px,7vw,72px)', fontWeight: 200, color: C.gold, opacity: 0.65, lineHeight: 1, marginBottom: 30 }}>止</div>
      <p style={{ fontFamily: F.display, fontStyle: 'italic', fontWeight: 400, fontSize: 'clamp(24px,4.4vw,46px)', lineHeight: 1.26, color: C.ink, margin: '0 auto', maxWidth: 780 }}>To learn tea is to learn where to stop. The rest, the leaf will teach you.</p>
      <div style={{ marginTop: 42, fontFamily: F.mono, fontSize: 10, letterSpacing: '0.24em', textTransform: 'uppercase', color: C.dim, lineHeight: 2 }}>Words by Teajia &nbsp;·&nbsp; The Craft of Tea &nbsp;·&nbsp; N°01</div>
    </section>
  </article>
);

// ─── helper: hex → rgba ──────────────────────────────────────────────────────
function hexA(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

// ════════════════════════════════════════════════════════════════════════════
//  SHELL — tab switcher + scroll behaviour
// ════════════════════════════════════════════════════════════════════════════
const LeafToLiquor: React.FC = () => {
  // Each "direction" is a distinct template for the same piece. The template is
  // chosen by the URL (/read/leaf-to-liquor/<template>), so each one is its own
  // article-link in the Read index — no in-page mode switcher. Default: manuscript.
  const { template } = useParams<{ template?: string }>();
  const active: Direction =
    DIRECTIONS.some((d) => d.key === template) ? (template as Direction) : 'manuscript';
  useImmersiveChrome(ACCENTS[0]);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const progress = useReadingProgress();

  // Scroll-snap only for Reverie (one idea per screen).
  useEffect(() => {
    const root = document.documentElement;
    if (active === 'reverie') {
      root.style.scrollSnapType = 'y proximity';
      root.style.scrollPaddingTop = '54px';
    } else {
      root.style.scrollSnapType = '';
      root.style.scrollPaddingTop = '';
    }
    return () => {
      root.style.scrollSnapType = '';
      root.style.scrollPaddingTop = '';
    };
  }, [active]);

  // Re-arm reveals when the direction changes, and jump to top.
  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    try { window.scrollTo({ top: 0, behavior: 'auto' }); } catch { /* noop */ }
    if (typeof IntersectionObserver === 'undefined') {
      node.querySelectorAll<HTMLElement>('[data-reveal]').forEach((el) => { el.style.opacity = '1'; el.style.transform = 'none'; });
      return;
    }
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) {
          (e.target as HTMLElement).style.opacity = '1';
          (e.target as HTMLElement).style.transform = 'none';
          io.unobserve(e.target);
        }
      }),
      { threshold: 0.08, rootMargin: '0px 0px -7% 0px' },
    );
    const raf = requestAnimationFrame(() => {
      node.querySelectorAll<HTMLElement>('[data-reveal]').forEach((el) => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(26px)';
        el.style.transition = 'opacity 920ms cubic-bezier(0.22,0.61,0.36,1), transform 920ms cubic-bezier(0.22,0.61,0.36,1)';
        io.observe(el);
      });
    });
    return () => { cancelAnimationFrame(raf); io.disconnect(); };
  }, [active]);

  return (
    <ImmersiveRoot rootRef={rootRef}>
      <Helmet><title>From Leaf to Liquor · Teajia</title></Helmet>

      {/* NAV with direction switcher */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '13px clamp(18px,4vw,40px)', background: 'rgba(20,16,11,0.72)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', borderBottom: '1px solid rgba(168,135,77,0.12)' }}>
        <a href="/read" style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none', color: 'inherit', minWidth: 0 }}>
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M9.5 3.5L5 7.5l4.5 4" stroke="#a8874d" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <span style={{ fontFamily: F.display, fontWeight: 600, fontSize: 18, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.ink }}>Teajia</span>
        </a>
        <span style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.dim, whiteSpace: 'nowrap' }}>
          From Leaf to Liquor · {DIRECTIONS.find((d) => d.key === active)?.label}
        </span>
        <ProgressTrack progress={progress} />
      </nav>

      {active === 'manuscript' && <Manuscript />}
      {active === 'gallery' && <Gallery />}
      {active === 'folio' && <Folio />}
      {active === 'thread' && <Thread />}
      {active === 'reverie' && <Reverie />}
    </ImmersiveRoot>
  );
};

export default LeafToLiquor;
