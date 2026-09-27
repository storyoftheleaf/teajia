/**
 * @color-literals. The Read section is one always-dark editorial surface.
 * Rationale, and the conditions on this exception, in read/immersive.tsx.
 */
/**
 * Before the Mist Burns Away: Field Notes, N°04
 * A photo-essay from a Yunnan spring harvest, from first grey light to first cup.
 * Ported pixel-faithfully from the tea-article-redesign mockup.
 */
import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import {
  C, F, ImmersiveRoot, ImmersiveNav, AccentSwatches, MoreFooter,
  useReveals, useReadingProgress, useImmersiveChrome, grainCss, ACCENTS,
} from './immersive';

const moreLinks = [
  { to: '/read/rock-remembers', kicker: 'Conversation · N°02', title: 'The Rock Remembers', blurb: 'A Wuyi rock-tea roaster on fire, patience & lineage.' },
  { to: '/read/earth-water-fire', kicker: 'Conversation · N°03', title: 'Earth, Water, Fire', blurb: 'A Jingdezhen potter on the vessels that hold the tea.' },
  { to: '/read/leaf-to-liquor', kicker: 'The Art of Tea · N°01', title: 'From Leaf to Liquor', blurb: 'How a single leaf becomes the six colours of tea.' },
];

const interludeBig: React.CSSProperties = { fontFamily: F.display, fontStyle: 'italic', fontWeight: 400, fontSize: 'clamp(24px,4vw,40px)', lineHeight: 1.3, color: C.ink, margin: 0 };
const interludeSub: React.CSSProperties = { fontFamily: F.body, fontSize: 'clamp(15px,1.9vw,17px)', lineHeight: 1.7, color: C.dim, margin: '24px auto 0', maxWidth: 440 };
const figTime: React.CSSProperties = { fontFamily: F.mono, fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.gold, whiteSpace: 'nowrap' };
const figCap: React.CSSProperties = { fontFamily: F.body, fontStyle: 'italic', fontSize: 14, color: C.taupe };

const BeforeTheMist: React.FC = () => {
  const [accent, setAccent] = useState<string>(ACCENTS[0]);
  useImmersiveChrome(accent);
  const rootRef = useReveals([]);
  const progress = useReadingProgress();

  return (
    <ImmersiveRoot rootRef={rootRef}>
      <Helmet><title>Before the Mist Burns Away · Teajia</title></Helmet>
      <ImmersiveNav eyebrow="Field Notes · N°04" progress={progress} />
      <AccentSwatches accent={accent} setAccent={setAccent} />

      <article style={{ position: 'relative', zIndex: 1 }}>
        {/* COVER, full-bleed */}
        <header style={{ position: 'relative', minHeight: '96vh', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', overflow: 'hidden' }}>
          <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,#2c2a24 0%,#1c1812 46%,var(--tj-read-bg) 100%)' }} />
          <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 70% 44% at 64% 30%, rgba(214,196,150,0.22), transparent 60%)' }} />
          <svg viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
            <g fill="none" stroke="rgb(var(--tj-read-gold-rgb) / 0.16)" strokeWidth="1.2">
              <path d="M-50 560 C 300 500, 700 520, 1260 470" />
              <path d="M-50 610 C 280 552, 720 576, 1260 520" />
              <path d="M-50 662 C 320 606, 760 628, 1260 576" />
              <path d="M-50 716 C 300 660, 740 684, 1260 632" />
            </g>
            <g fill="none" stroke="rgb(var(--tj-read-gold-rgb) / 0.1)" strokeWidth="1">
              <path d="M-50 470 C 360 430, 800 446, 1260 410" />
              <path d="M-50 426 C 340 396, 820 408, 1260 380" />
            </g>
          </svg>
          <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgb(var(--tj-read-bg-rgb) / 0.7), transparent 45%), linear-gradient(0deg, rgb(var(--tj-read-bg-rgb) / 0.85), transparent 40%)' }} />
          <div style={{ position: 'relative', zIndex: 1, padding: '0 clamp(24px,6vw,84px) clamp(48px,9vw,110px)', maxWidth: 1000 }}>
            <div style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: '0.36em', textTransform: 'uppercase', color: C.gold, marginBottom: 26 }}>Field Notes: A spring harvest, Yunnan</div>
            <h1 style={{ fontFamily: F.display, fontWeight: 400, fontSize: 'clamp(50px,9vw,116px)', lineHeight: 0.98, letterSpacing: '-0.015em', color: C.cream, margin: 0 }}>
              Before the<br /><span style={{ fontStyle: 'italic', color: C.gold }}>Mist Burns Away</span>
            </h1>
            <p style={{ fontFamily: F.body, fontStyle: 'italic', fontSize: 'clamp(16px,2.1vw,21px)', lineHeight: 1.5, color: C.taupe, margin: '26px 0 0', maxWidth: 520 }}>
              One morning on a tea mountain, from the first grey light to the first cup, told in pictures, and very few words.
            </p>
          </div>
          <div aria-hidden="true" style={{ position: 'absolute', bottom: 30, left: '50%', transform: 'translate(-50%,0)', animation: 'tjFloatX 3.4s ease-in-out infinite' }}>
            <svg width="13" height="20" viewBox="0 0 13 20" fill="none"><path d="M6.5 1v17M1 12.5l5.5 5.5 5.5-5.5" stroke="var(--tj-gold, var(--tj-read-gold-default))" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
        </header>

        {/* OPENING LINE */}
        <section data-reveal style={{ maxWidth: 620, margin: '0 auto', padding: 'clamp(60px,10vw,130px) 24px clamp(40px,6vw,80px)', textAlign: 'center' }}>
          <p style={interludeBig}>The mountain wakes before the village does.</p>
          <p style={interludeSub}>By four, the pickers are already climbing. The good leaf is plucked in the cool, before the sun draws the dew up and the day grows careless.</p>
        </section>

        {/* PLATE: the climb (full-bleed) */}
        <figure data-reveal style={{ margin: 0 }}>
          <div style={{ position: 'relative', height: 'clamp(420px,80vh,820px)', overflow: 'hidden', background: 'linear-gradient(180deg,#26241e,#1a1610 60%,var(--tj-read-bg))', borderTop: '1px solid rgb(var(--tj-read-gold-rgb) / 0.14)', borderBottom: '1px solid rgb(var(--tj-read-gold-rgb) / 0.14)' }}>
            <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,#2a2820 0%,#1a1610 70%,var(--tj-read-bg) 100%)' }} />
            <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 50% 60% at 30% 20%, rgba(214,200,160,0.18), transparent 60%)' }} />
            <svg viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
              <g fill="none" stroke="rgb(var(--tj-read-gold-rgb) / 0.14)" strokeWidth="1.2">
                <path d="M-50 520 C 300 470, 760 486, 1260 440" /><path d="M-50 575 C 320 524, 780 540, 1260 494" />
                <path d="M-50 632 C 300 580, 760 596, 1260 548" /><path d="M-50 692 C 320 638, 800 656, 1260 606" />
              </g>
              <g fill="rgba(40,33,26,0.9)"><path d="M0 800 L0 560 C 200 540, 380 548, 520 600 C 640 644, 760 700, 1200 760 L1200 800 Z" /></g>
            </svg>
            <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 60%, rgb(var(--tj-read-bg-rgb) / 0.7))' }} />
            <figcaption style={{ position: 'absolute', left: 'clamp(20px,4vw,44px)', bottom: 'clamp(20px,3vw,32px)', display: 'flex', gap: 14, alignItems: 'baseline' }}>
              <span style={figTime}>04:40</span>
              <span style={figCap}>The path up, still in shadow. Mist sits in the folds of the hills.</span>
            </figcaption>
          </div>
        </figure>

        {/* TWO-UP */}
        <section data-reveal style={{ padding: 'clamp(40px,6vw,80px) clamp(20px,5vw,56px)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,260px),1fr))', gap: 'clamp(16px,2.6vw,30px)', maxWidth: 1180, margin: '0 auto' }}>
            <figure style={{ margin: 0 }}>
              <div style={{ position: 'relative', aspectRatio: '4/5', border: '1px solid rgb(var(--tj-read-gold-rgb) / 0.18)', borderRadius: 3, overflow: 'hidden', background: 'linear-gradient(160deg,var(--tj-read-plate-from),var(--tj-read-plate-to))' }}>
                <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 60% 50% at 50% 40%, rgba(133,159,133,0.16), transparent 64%)' }} />
                <svg viewBox="0 0 240 300" preserveAspectRatio="xMidYMid meet" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
                  <g fill="none" stroke="rgba(133,159,133,0.5)" strokeWidth="1.2">
                    <path d="M120 70 C96 130, 96 210, 120 250 C144 210, 144 130, 120 70Z" />
                    <line x1="120" y1="86" x2="120" y2="242" />
                    <path d="M120 130 C104 138, 96 150, 92 166" /><path d="M120 170 C138 178, 146 190, 150 206" />
                  </g>
                  <circle cx="120" cy="62" r="3.6" fill={C.gold} />
                </svg>
                <div style={plateLabel}>Plate I</div>
              </div>
              <figcaption style={cap}>Two leaves and a bud, the only part that is taken.</figcaption>
            </figure>
            <figure style={{ margin: 0 }}>
              <div style={{ position: 'relative', aspectRatio: '4/5', border: '1px solid rgb(var(--tj-read-gold-rgb) / 0.18)', borderRadius: 3, overflow: 'hidden', background: 'linear-gradient(160deg,var(--tj-read-plate-from),var(--tj-read-plate-to))' }}>
                <div aria-hidden="true" style={grainCss('0.8', 120)} />
                <svg viewBox="0 0 240 300" preserveAspectRatio="xMidYMid meet" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
                  <g fill="none" stroke="rgb(var(--tj-read-gold-rgb) / 0.28)" strokeWidth="1">
                    <path d="M70 196 C90 150, 150 150, 170 196" /><path d="M84 196 C98 164, 142 164, 156 196" /><path d="M70 196h100" />
                  </g>
                  <circle cx="120" cy="150" r="3" fill={C.gold} />
                </svg>
                <div style={plateLabel}>Plate II</div>
              </div>
              <figcaption style={cap}>A picker’s basket, slowly filling at the hip.</figcaption>
            </figure>
          </div>
        </section>

        {/* INTERLUDE */}
        <section data-reveal style={{ maxWidth: 680, margin: '0 auto', padding: 'clamp(30px,5vw,64px) 24px', textAlign: 'center' }}>
          <p style={{ fontFamily: F.display, fontStyle: 'italic', fontWeight: 400, fontSize: 'clamp(22px,3.6vw,36px)', lineHeight: 1.32, color: C.ink, margin: 0 }}>
            No machine has ever learned this. The hand chooses; the eye decides; the basket fills one shoot at a time.
          </p>
        </section>

        {/* FULL-BLEED rows */}
        <figure data-reveal style={{ margin: 0 }}>
          <div style={{ position: 'relative', height: 'clamp(400px,72vh,760px)', overflow: 'hidden', borderTop: '1px solid rgb(var(--tj-read-gold-rgb) / 0.14)', borderBottom: '1px solid rgb(var(--tj-read-gold-rgb) / 0.14)' }}>
            <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,#222a20 0%,#18170f 70%,var(--tj-read-bg) 100%)' }} />
            <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 60% 50% at 70% 24%, rgba(214,200,150,0.16), transparent 58%)' }} />
            <svg viewBox="0 0 1200 760" preserveAspectRatio="xMidYMid slice" aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
              <g fill="none" stroke="rgba(133,159,133,0.22)" strokeWidth="1.4">
                <path d="M-50 360 C 300 330, 760 340, 1260 312" /><path d="M-60 410 C 280 376, 800 388, 1260 356" />
                <path d="M-60 466 C 320 428, 820 442, 1260 404" /><path d="M-60 528 C 300 484, 800 500, 1260 458" />
                <path d="M-60 596 C 320 548, 820 566, 1260 520" /><path d="M-60 670 C 300 616, 800 636, 1260 588" />
              </g>
              <g fill="rgb(var(--tj-read-gold-rgb) / 0.55)"><circle cx="320" cy="430" r="3.5" /><circle cx="560" cy="486" r="3.5" /><circle cx="760" cy="452" r="3.5" /><circle cx="900" cy="540" r="3.5" /></g>
            </svg>
            <figcaption style={{ position: 'absolute', left: 'clamp(20px,4vw,44px)', bottom: 'clamp(20px,3vw,32px)', display: 'flex', gap: 14, alignItems: 'baseline' }}>
              <span style={figTime}>06:15</span>
              <span style={figCap}>Sun on the high rows. The pickers are small gold marks among the green.</span>
            </figcaption>
          </div>
        </figure>

        {/* INTERLUDE 2 */}
        <section data-reveal style={{ maxWidth: 620, margin: '0 auto', padding: 'clamp(50px,8vw,110px) 24px clamp(30px,5vw,60px)', textAlign: 'center' }}>
          <p style={interludeBig}>By nine, the mist is gone.</p>
          <p style={interludeSub}>The baskets come down the mountain heavy and warm. The leaf must be spread to wither within the hour, or the day’s work is lost.</p>
        </section>

        {/* PLATE: withering */}
        <figure data-reveal style={{ margin: '0 0 clamp(20px,4vw,40px)' }}>
          <div style={{ position: 'relative', maxWidth: 1100, margin: '0 auto', aspectRatio: '16/9', border: '1px solid rgb(var(--tj-read-gold-rgb) / 0.18)', borderRadius: 3, overflow: 'hidden', background: 'linear-gradient(150deg,var(--tj-read-plate-from),var(--tj-read-bg))' }}>
            <div aria-hidden="true" style={{ ...grainCss('0.8', 140), opacity: 0.06 }} />
            <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(96deg, transparent 0 48px, rgb(var(--tj-read-gold-rgb) / 0.05) 48px 49px)' }} />
            <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 50% 60% at 24% 30%, rgba(214,200,150,0.12), transparent 60%)' }} />
            <figcaption style={{ position: 'absolute', left: 'clamp(18px,3vw,28px)', bottom: 'clamp(16px,3vw,24px)', display: 'flex', gap: 14, alignItems: 'baseline' }}>
              <span style={figTime}>10:00</span>
              <span style={figCap}>Laid thin on bamboo, the leaf begins to breathe out the night’s water.</span>
            </figcaption>
          </div>
        </figure>

        {/* CLOSING */}
        <section data-reveal style={{ maxWidth: 620, margin: '0 auto', padding: 'clamp(50px,8vw,110px) 24px clamp(40px,6vw,80px)', textAlign: 'center' }}>
          <div style={{ position: 'relative', width: 'clamp(120px,28vw,150px)', aspectRatio: '1/1', margin: '0 auto 40px' }}>
            <div aria-hidden="true" style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '1px solid rgb(var(--tj-read-gold-rgb) / 0.4)', background: 'radial-gradient(circle at 50% 38%, rgb(var(--tj-read-gold-rgb) / 0.22), rgb(var(--tj-read-gold-rgb) / 0.05) 60%, transparent 72%)' }} />
            <div aria-hidden="true" style={{ position: 'absolute', left: '50%', top: '16%', width: 2, height: '18%', background: 'linear-gradient(transparent,rgb(var(--tj-read-gold-rgb) / 0.5))', transform: 'translateX(-50%)', animation: 'tjFloat 3s ease-in-out infinite' }} />
          </div>
          <p style={{ fontFamily: F.display, fontStyle: 'italic', fontWeight: 400, fontSize: 'clamp(22px,3.6vw,36px)', lineHeight: 1.32, color: C.ink, margin: 0 }}>
            All of it, the climb, the cool, the careful hands, so that months from now, a single cup might taste of this exact morning.
          </p>
          <div style={{ marginTop: 42, fontFamily: F.mono, fontSize: 10, letterSpacing: '0.24em', textTransform: 'uppercase', color: C.dim, lineHeight: 2 }}>
            Pictures &amp; words by Teajia &nbsp;·&nbsp; Field Notes &nbsp;·&nbsp; N°04
          </div>
        </section>

        <MoreFooter links={moreLinks} />
      </article>
    </ImmersiveRoot>
  );
};

const plateLabel: React.CSSProperties = { position: 'absolute', left: 14, bottom: 12, fontFamily: F.mono, fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.gold };
const cap: React.CSSProperties = { fontFamily: F.body, fontStyle: 'italic', fontSize: 13, lineHeight: 1.5, color: C.dim, marginTop: 12 };

export default BeforeTheMist;
