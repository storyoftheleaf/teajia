/**
 * @color-literals. The Read section is one always-dark editorial surface.
 * Rationale, and the conditions on this exception, in read/immersive.tsx.
 */
/**
 * The Immortals' Cliff: Legend · N°13
 * The Da Hong Pao mother trees of Wuyi: six bushes, a red robe, and a retirement.
 * Ported pixel-faithfully from the tea-article-redesign mockup.
 */
import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import {
  C, F, ImmersiveRoot, ImmersiveNav, AccentSwatches, MoreFooter,
  useReveals, useReadingProgress, useImmersiveChrome, grainCss, ACCENTS,
} from './immersive';

const moreLinks = [
  { to: '/read/craft', kicker: 'The Craft · N°14', title: 'The Pot That Remembers', blurb: 'Yixing purple clay, and pots that age with you.' },
  { to: '/read/rock-remembers', kicker: 'Conversation · N°02', title: 'The Rock Remembers', blurb: 'A Wuyi roaster on the same red cliffs.' },
  { to: '/read/field-study', kicker: 'Field Study · N°12', title: 'The Water Before the Leaf', blurb: 'The overlooked half of every cup.' },
];

// ─── Shared sub-styles ───────────────────────────────────────────────────────
const pBody: React.CSSProperties = {
  fontFamily: F.body,
  fontSize: 'clamp(16px,2vw,18px)',
  lineHeight: 1.8,
  color: C.taupe,
  margin: '0 0 18px',
};
const plateLabel: React.CSSProperties = {
  position: 'absolute',
  left: 14,
  bottom: 12,
  fontFamily: F.mono,
  fontSize: 9,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  color: C.gold,
};
const cap: React.CSSProperties = {
  fontFamily: F.body,
  fontStyle: 'italic',
  fontSize: 13,
  lineHeight: 1.5,
  color: C.dim,
  marginTop: 12,
};

// ─── Section divider ─────────────────────────────────────────────────────────
const SectionDivider: React.FC<{ numeral: string; label: string; wideContainer?: boolean }> = ({ numeral, label, wideContainer }) => (
  <div
    data-reveal
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 18,
      marginBottom: 'clamp(28px,4vw,40px)',
      ...(wideContainer ? { maxWidth: 680, marginLeft: 'auto', marginRight: 'auto' } : {}),
    }}
  >
    <span style={{ fontFamily: F.display, fontStyle: 'italic', fontSize: 30, color: C.gold, lineHeight: 1 }}>{numeral}</span>
    <span style={{ flex: 1, height: 1, background: 'rgba(168,135,77,0.22)' }} />
    <span style={{ fontFamily: F.ui, fontSize: 10, fontWeight: 500, letterSpacing: '0.24em', textTransform: 'uppercase', color: C.dim }}>{label}</span>
  </div>
);

// ─── Fact row ────────────────────────────────────────────────────────────────
const FactRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <div style={{ fontFamily: F.ui, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.dim, marginBottom: 8 }}>{label}</div>
    <div style={{ fontFamily: F.body, fontSize: 15, color: C.ink }}>{value}</div>
  </div>
);

// ─── Component ───────────────────────────────────────────────────────────────
const LegendImmortalsCliff: React.FC = () => {
  const [accent, setAccent] = useState<string>(ACCENTS[0]);
  useImmersiveChrome(accent);
  const rootRef = useReveals([]);
  const progress = useReadingProgress();

  return (
    <ImmersiveRoot rootRef={rootRef}>
      <Helmet><title>The Immortals' Cliff · Teajia</title></Helmet>
      <ImmersiveNav eyebrow="Legend · N°13" progress={progress} />
      <AccentSwatches accent={accent} setAccent={setAccent} />

      <article style={{ position: 'relative', zIndex: 1 }}>

        {/* ── COVER full-bleed cliff ─────────────────────────────────────── */}
        <header style={{
          position: 'relative',
          minHeight: '96vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          overflow: 'hidden',
        }}>
          {/* background gradient layers */}
          <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,#3a2418 0%,#241610 52%,#14100b 100%)' }} />
          <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 56% 50% at 64% 30%, rgba(190,96,52,0.3), transparent 62%)' }} />

          {/* cliff SVG illustration */}
          <svg viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
            <g fill="rgba(40,24,16,0.6)">
              <path d="M0 800 L0 320 C 120 300, 200 260, 240 180 L 300 200 L 360 120 L 430 220 L 520 160 L 560 360 L640 320 L 720 420 L 1200 520 L1200 800 Z" />
            </g>
            <g fill="none" stroke="rgba(190,110,60,0.2)" strokeWidth="1.2">
              <path d="M-40 360 C 200 330, 360 340, 520 300" />
              <path d="M-40 430 C 220 398, 420 408, 620 366" />
              <path d="M-40 500 C 240 466, 460 476, 700 432" />
            </g>
            <g fill="rgba(168,135,77,0.5)">
              <circle cx="300" cy="206" r="3" />
              <circle cx="334" cy="214" r="3" />
              <circle cx="368" cy="208" r="3" />
              <circle cx="402" cy="218" r="3" />
            </g>
          </svg>

          {/* bottom fade-up vignette */}
          <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(0deg, rgba(20,16,11,0.88), transparent 44%)' }} />

          {/* hero text */}
          <div style={{ position: 'relative', zIndex: 1, padding: '0 clamp(24px,6vw,84px) clamp(48px,9vw,110px)', maxWidth: 1000 }}>
            <div style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: '0.36em', textTransform: 'uppercase', color: C.gold, marginBottom: 24 }}>
              A Legend: Jiulongke, the Wuyi cliffs
            </div>
            <h1 style={{ fontFamily: F.display, fontWeight: 400, fontSize: 'clamp(46px,8.4vw,112px)', lineHeight: 0.98, letterSpacing: '-0.015em', color: C.cream, margin: 0 }}>
              The Immortals'{' '}
              <span style={{ fontStyle: 'italic', color: C.gold }}>Cliff</span>
            </h1>
            <p style={{ fontFamily: F.body, fontStyle: 'italic', fontSize: 'clamp(16px,2.1vw,21px)', lineHeight: 1.5, color: C.taupe, margin: '24px 0 0', maxWidth: 560 }}>
              Six old tea bushes cling to a ledge of red rock in Fujian. For a few grams of their leaf, men have paid more than gold. No one is allowed to pick them any more.
            </p>
          </div>

          {/* scroll arrow */}
          <div
            aria-hidden="true"
            style={{ position: 'absolute', bottom: 28, left: '50%', animation: 'tjFloat 3.4s ease-in-out infinite' }}
          >
            <svg width="13" height="20" viewBox="0 0 13 20" fill="none">
              <path d="M6.5 1v17M1 12.5l5.5 5.5 5.5-5.5" stroke="#a8874d" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </header>

        {/* ── STANDFIRST ────────────────────────────────────────────────── */}
        <section data-reveal style={{ maxWidth: 680, margin: '0 auto', padding: 'clamp(56px,9vw,116px) 24px clamp(28px,5vw,52px)' }}>
          <p style={{ fontFamily: F.body, fontSize: 'clamp(18px,2.2vw,22px)', lineHeight: 1.74, color: C.ink, margin: 0 }}>
            <span style={{ float: 'left', fontFamily: F.display, fontWeight: 600, fontSize: '5em', lineHeight: 0.78, color: C.gold, margin: '8px 16px -4px 0' }}>H</span>
            igh on a sheer face in the Wuyi mountains, reached by a narrow path and a great deal of nerve, grows the most famous tea in China:{' '}
            <span style={{ fontFamily: F.cn, color: C.taupe }}>大红袍</span>
            , Dà Hóng Páo, "Big Red Robe." Not a garden of it. Not a hillside. Six individual bushes, more than three hundred and fifty years old, growing from a crack watered by a thread of mineral spring. Every Big Red Robe on earth descends from these six. They are, in the most literal sense, the mother trees.
          </p>
        </section>

        {/* ── I: THE RED ROBE ──────────────────────────────────────────── */}
        <section style={{ maxWidth: 1100, margin: '0 auto', padding: 'clamp(20px,4vw,40px) clamp(20px,5vw,40px)' }}>
          <SectionDivider numeral="I" label="The red robe" wideContainer />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,300px),1fr))', gap: 'clamp(24px,4vw,52px)', alignItems: 'center' }}>
            {/* Plate I: mother bushes */}
            <figure data-reveal style={{ margin: 0, order: 2 }}>
              <div style={{ position: 'relative', aspectRatio: '4/5', border: '1px solid rgba(168,135,77,0.2)', borderRadius: 3, overflow: 'hidden', background: 'linear-gradient(160deg,#33201a,#14100b 82%)' }}>
                <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 60% 44% at 54% 30%, rgba(190,96,52,0.28), transparent 60%)' }} />
                <svg viewBox="0 0 320 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
                  <g fill="none" stroke="rgba(190,110,60,0.32)" strokeWidth="1.2">
                    <path d="M-20 150 C 120 130, 220 140, 340 120" />
                    <path d="M-20 210 C 120 190, 220 200, 340 178" />
                    <path d="M-20 272 C 120 250, 220 262, 340 238" />
                  </g>
                  <g fill="none" stroke="rgba(180,70,50,0.5)" strokeWidth="1.4" strokeLinecap="round">
                    <path d="M120 250 C 116 222, 120 200, 138 184 M120 250 C 124 224, 134 206, 150 196 M120 250 C 110 226, 96 210, 82 202" />
                    <path d="M210 256 C 206 230, 210 208, 226 192 M210 256 C 216 232, 228 216, 244 206" />
                  </g>
                  <g fill="none" stroke="rgba(180,70,50,0.34)" strokeWidth="1.2">
                    <ellipse cx="124" cy="180" rx="34" ry="18" />
                    <ellipse cx="216" cy="190" rx="28" ry="15" />
                  </g>
                </svg>
                <div style={plateLabel}>Plate I, the mother bushes</div>
              </div>
              <figcaption style={cap}>The original bushes on their ledge at Jiulongke, the Nine Dragons' Nest.</figcaption>
            </figure>

            {/* prose */}
            <div data-reveal style={{ order: 1 }}>
              <p style={pBody}>
                The legend is the kind a tea this famous demands. A Ming-dynasty scholar, travelling to sit the imperial examinations, falls gravely ill at the foot of the mountain. A monk brews him tea from the bushes on the cliff; he recovers, goes on, and places first in the empire. Returning to give thanks, he climbs to the bushes and drapes his scholar's red robe over them, and the name has stuck for four centuries.
              </p>
              <p style={{ ...pBody, margin: 0 }}>
                Whether or not it happened, it tells the truth that matters: this tea was treated, from the start, as something closer to medicine and miracle than to a drink.
              </p>
            </div>
          </div>
        </section>

        {/* ── PULL QUOTE ────────────────────────────────────────────────── */}
        <section data-reveal style={{ maxWidth: 900, margin: '0 auto', padding: 'clamp(50px,8vw,104px) 24px', textAlign: 'center' }}>
          <blockquote style={{ fontFamily: F.display, fontStyle: 'italic', fontWeight: 400, fontSize: 'clamp(28px,4.8vw,54px)', lineHeight: 1.18, color: C.cream, margin: '0 auto', maxWidth: 840 }}>
            "Twenty grams of it once sold for more than a small apartment. Then they decided it could not be sold at all."
          </blockquote>
          <div aria-hidden="true" style={{ width: 40, height: 1, background: C.gold, opacity: 0.5, margin: '34px auto 0' }} />
        </section>

        {/* ── II: THE LAST HARVEST ─────────────────────────────────────── */}
        <section style={{ maxWidth: 680, margin: '0 auto', padding: '0 24px' }}>
          <div data-reveal style={{ display: 'flex', alignItems: 'center', gap: 18, margin: 'clamp(20px,4vw,40px) 0 clamp(28px,4vw,40px)' }}>
            <span style={{ fontFamily: F.display, fontStyle: 'italic', fontSize: 30, color: C.gold, lineHeight: 1 }}>II</span>
            <span style={{ flex: 1, height: 1, background: 'rgba(168,135,77,0.22)' }} />
            <span style={{ fontFamily: F.ui, fontSize: 10, fontWeight: 500, letterSpacing: '0.24em', textTransform: 'uppercase', color: C.dim }}>The last harvest</span>
          </div>
          <p data-reveal style={{ ...pBody, marginBottom: 22 }}>
            For centuries the cliff's yield was counted in hundreds of grams, reserved for emperors and, later, for heads of state, a few leaves given as the rarest of gifts. As prices climbed into the absurd, so did the danger to the trees: the picking, the climbing, the relentless attention. In 2006 the authorities made a startling decision. They{' '}
            <em style={{ fontStyle: 'italic', color: C.ink }}>retired</em>
            {' '}the mother bushes.
          </p>
          <p data-reveal style={{ ...pBody, margin: 0 }}>
            The last official harvest was taken in 2005, twenty grams of it later placed, ceremonially, in the National Museum. Since then no leaf has been picked. The six bushes are watched, insured, and left, finally, to simply grow old in peace on their ledge.
          </p>
        </section>

        {/* ── FACT FILE ─────────────────────────────────────────────────── */}
        <section data-reveal style={{ maxWidth: 1040, margin: '0 auto', padding: 'clamp(40px,6vw,80px) 24px' }}>
          <div style={{ border: '1px solid rgba(168,135,77,0.2)', borderRadius: 4, background: 'linear-gradient(160deg,#211710,#15110b)', padding: 'clamp(24px,4vw,40px)' }}>
            <div style={{ fontFamily: F.ui, fontSize: 10, fontWeight: 600, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.gold, marginBottom: 24 }}>
              The mother trees, on the record
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,200px),1fr))', gap: '22px 36px' }}>
              <FactRow label="Where" value="Jiulongke, Wuyishan" />
              <FactRow label="How many" value="Six original bushes" />
              <FactRow label="Age" value="350+ years" />
              <FactRow label="Last picked" value="2005, then retired" />
              <FactRow label="Record price" value="~¥200,000 / 20g" />
              <FactRow label="Now grown by" value="Cuttings, not seed" />
            </div>
          </div>
        </section>

        {/* ── III: SIX BUSHES, TEN THOUSAND CHILDREN ───────────────────── */}
        <section style={{ maxWidth: 1100, margin: '0 auto', padding: '0 clamp(20px,5vw,40px)' }}>
          <div data-reveal style={{ display: 'flex', alignItems: 'center', gap: 18, margin: 'clamp(20px,4vw,40px) 0 clamp(28px,4vw,40px)', maxWidth: 680, marginLeft: 'auto', marginRight: 'auto' }}>
            <span style={{ fontFamily: F.display, fontStyle: 'italic', fontSize: 30, color: C.gold, lineHeight: 1 }}>III</span>
            <span style={{ flex: 1, height: 1, background: 'rgba(168,135,77,0.22)' }} />
            <span style={{ fontFamily: F.ui, fontSize: 10, fontWeight: 500, letterSpacing: '0.24em', textTransform: 'uppercase', color: C.dim }}>Six bushes, ten thousand children</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,300px),1fr))', gap: 'clamp(24px,4vw,52px)', alignItems: 'center' }}>
            {/* prose */}
            <div data-reveal>
              <p style={pBody}>
                Here is the quiet miracle: the tea did not die with its retirement. Tea bushes can be cloned exactly, by cutting, and for decades, masters had been taking cuttings from these very bushes. Every "Big Red Robe" sold today is grown from that lineage, genetically identical to the mothers, raised in gardens across the Wuyi range.
              </p>
              <p style={{ ...pBody, margin: 0 }}>
                So you can, in fact, taste them, not the originals, but their true children: the same plant, rooted in the same red rock, carrying the same mineral "rock rhyme." The mothers rest. Their tea goes on being poured.
              </p>
            </div>

            {/* Plate II: the children */}
            <figure data-reveal style={{ margin: 0 }}>
              <div style={{ position: 'relative', aspectRatio: '4/5', border: '1px solid rgba(168,135,77,0.2)', borderRadius: 3, overflow: 'hidden', background: 'linear-gradient(160deg,#2a1d12,#14100b 82%)' }}>
                <div aria-hidden="true" style={{ ...grainCss('0.8', 120), opacity: 0.07 }} />
                <svg viewBox="0 0 320 400" preserveAspectRatio="xMidYMid meet" aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
                  <g fill="none" stroke="rgba(168,135,77,0.34)" strokeWidth="1.2" strokeLinecap="round">
                    <path d="M70 300 C 66 270, 70 250, 84 238 M70 300 C 74 272, 84 256, 98 246" />
                    <path d="M160 310 C 156 276, 160 252, 176 238 M160 310 C 166 280, 180 262, 196 250 M160 310 C 150 280, 134 264, 120 254" />
                    <path d="M250 300 C 246 272, 250 252, 264 240 M250 300 C 256 274, 268 258, 282 248" />
                  </g>
                  <g fill="none" stroke="rgba(150,180,140,0.3)" strokeWidth="1">
                    <path d="M40 320 C 130 308, 200 308, 290 320" />
                    <path d="M30 348 C 130 336, 210 336, 300 348" />
                  </g>
                </svg>
                <div style={plateLabel}>Plate II, the children</div>
              </div>
              <figcaption style={cap}>Cuttings of the mother bushes, grown on across the Wuyi cliffs.</figcaption>
            </figure>
          </div>
        </section>

        {/* ── CLOSING ───────────────────────────────────────────────────── */}
        <section data-reveal style={{ maxWidth: 680, margin: '0 auto', padding: 'clamp(40px,6vw,80px) 24px clamp(40px,6vw,72px)' }}>
          <p style={{ fontFamily: F.body, fontStyle: 'italic', fontSize: 'clamp(17px,2.1vw,20px)', lineHeight: 1.72, color: C.taupe, margin: 0 }}>
            There is something fitting in a culture that decided its most precious tea was worth more left unpicked than sold, that the bushes themselves, ancient and stubborn on their ledge, mattered more than the cup. The immortals keep their cliff. We make do, very happily, with their descendants.
          </p>
          <div style={{ marginTop: 40, fontFamily: F.mono, fontSize: 10, letterSpacing: '0.24em', textTransform: 'uppercase', color: C.dim, lineHeight: 2 }}>
            A Legend, retold by Teajia &nbsp;·&nbsp; N°13
          </div>
        </section>

        <MoreFooter links={moreLinks} />
      </article>
    </ImmersiveRoot>
  );
};

export default LegendImmortalsCliff;
