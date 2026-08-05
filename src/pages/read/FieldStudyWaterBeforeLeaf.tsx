/**
 * @color-literals. The Read section is one always-dark editorial surface.
 * Rationale, and the conditions on this exception, in read/immersive.tsx.
 */
/**
 * Field Study: The Water Before the Leaf · N°12
 * Lu Yu's forgotten half: water hardness, temperature, and the classical
 * ranking of sources.
 * Ported pixel-faithfully from the tea-article-redesign mockup.
 */
import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import {
  C, F, ImmersiveRoot, ImmersiveNav, AccentSwatches, MoreFooter,
  useReveals, useReadingProgress, useImmersiveChrome, ACCENTS,
} from './immersive';

const moreLinks = [
  { to: '/read/legend', kicker: 'Legend · N°13', title: "The Immortals' Cliff", blurb: 'The Da Hong Pao mother trees of Wuyi.' },
  { to: '/read/craft', kicker: 'The Craft · N°14', title: 'The Pot That Remembers', blurb: 'Yixing purple clay, and pots that age with you.' },
  { to: '/read/ritual', kicker: 'The Ritual · N°05', title: 'Seven Steeps', blurb: 'The same leaves, brewed seven ways.' },
];

// ─── Shared sub-styles ────────────────────────────────────────────────────────
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

// ─── Boil-stage card ──────────────────────────────────────────────────────────
const BoilStage: React.FC<{
  cn: string;
  name: string;
  temp: string;
  desc: string;
  svgContent: React.ReactNode;
  bgStyle: React.CSSProperties;
}> = ({ cn, name, temp, desc, svgContent, bgStyle }) => (
  <figure style={{ margin: 0 }}>
    <div style={{ position: 'relative', aspectRatio: '3/4', border: '1px solid rgba(168,135,77,0.18)', borderRadius: 3, overflow: 'hidden', ...bgStyle }}>
      <svg viewBox="0 0 160 213" preserveAspectRatio="xMidYMid meet" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        {svgContent}
      </svg>
      <div style={{ position: 'absolute', left: 12, bottom: 10, fontFamily: F.cn, fontSize: 16, color: C.taupe }}>{cn}</div>
    </div>
    <figcaption style={{ marginTop: 12 }}>
      <div style={{ fontFamily: F.display, fontSize: 19, color: C.ink }}>{name}</div>
      <div style={{ fontFamily: F.mono, fontSize: 10, color: C.gold, margin: '4px 0' }}>{temp}</div>
      <div style={{ fontFamily: F.body, fontStyle: 'italic', fontSize: 12.5, lineHeight: 1.5, color: C.dim }}>{desc}</div>
    </figcaption>
  </figure>
);

// ─── Temperature table row ────────────────────────────────────────────────────
const TempRow: React.FC<{ dot: string; tea: string; temp: string; why: string; strong?: boolean }> = ({ dot, tea, temp, why, strong }) => (
  <>
    <div style={{ padding: '16px 0', display: 'flex', alignItems: 'center', gap: 11 }}>
      <span style={{ width: 10, height: 10, borderRadius: '50%', background: dot, flexShrink: 0 }} />
      <span style={{ fontFamily: F.display, fontSize: 18, color: C.ink }}>{tea}</span>
    </div>
    <div style={{ padding: '16px 0', alignSelf: 'center', fontFamily: F.mono, fontSize: 12, color: C.gold }}>{temp}</div>
    <div style={{ padding: '16px 0', alignSelf: 'center', fontFamily: F.body, fontSize: 13.5, color: C.dim, lineHeight: 1.5 }}>{why}</div>
    {!strong && <div style={{ gridColumn: '1/-1', height: 1, background: 'rgba(168,135,77,0.09)' }} />}
  </>
);

// ─── Section divider ──────────────────────────────────────────────────────────
const SectionDivider: React.FC<{ numeral: string; label: string }> = ({ numeral, label }) => (
  <div
    data-reveal
    style={{ display: 'flex', alignItems: 'center', gap: 18, margin: 'clamp(20px,4vw,40px) 0 clamp(28px,4vw,40px)' }}
  >
    <span style={{ fontFamily: F.display, fontStyle: 'italic', fontSize: 30, color: C.gold, lineHeight: 1 }}>{numeral}</span>
    <span style={{ flex: 1, height: 1, background: 'rgba(168,135,77,0.22)' }} />
    <span style={{ fontFamily: F.ui, fontSize: 10, fontWeight: 500, letterSpacing: '0.24em', textTransform: 'uppercase', color: C.dim }}>{label}</span>
  </div>
);

// ─── Component ────────────────────────────────────────────────────────────────
const FieldStudyWaterBeforeLeaf: React.FC = () => {
  const [accent, setAccent] = useState<string>(ACCENTS[0]);
  useImmersiveChrome(accent);
  const rootRef = useReveals([]);
  const progress = useReadingProgress();

  return (
    <ImmersiveRoot rootRef={rootRef}>
      <Helmet><title>The Water Before the Leaf · Teajia</title></Helmet>
      <ImmersiveNav eyebrow="Field Study · N°12" progress={progress} />
      <AccentSwatches accent={accent} setAccent={setAccent} />

      <article style={{ position: 'relative', zIndex: 1 }}>

        {/* ── COVER full-bleed ──────────────────────────────────────────── */}
        <header style={{
          position: 'relative',
          minHeight: '94vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          overflow: 'hidden',
        }}>
          {/* background layers */}
          <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,#15201f 0%,#16140f 55%,#14100b 100%)' }} />
          <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 60% 44% at 50% 26%, rgba(120,160,160,0.22), transparent 60%)' }} />

          {/* concentric ellipses + waterline SVG */}
          <svg viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
            <g fill="none" stroke="rgba(150,180,180,0.16)" strokeWidth="1.1">
              <ellipse cx="600" cy="300" rx="120" ry="30" />
              <ellipse cx="600" cy="300" rx="230" ry="58" />
              <ellipse cx="600" cy="300" rx="360" ry="92" />
              <ellipse cx="600" cy="300" rx="510" ry="130" />
              <ellipse cx="600" cy="300" rx="680" ry="172" stroke="rgba(150,180,180,0.08)" />
            </g>
            <g fill="none" stroke="rgba(168,135,77,0.1)" strokeWidth="1">
              <path d="M-50 560 C 320 532, 760 544, 1260 512" />
              <path d="M-50 612 C 300 584, 800 596, 1260 560" />
            </g>
          </svg>

          {/* fade-up from bottom */}
          <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(0deg, rgba(20,16,11,0.86), transparent 44%)' }} />

          {/* hero text */}
          <div style={{ position: 'relative', zIndex: 1, padding: '0 clamp(24px,6vw,84px) clamp(48px,9vw,110px)', maxWidth: 1000 }}>
            <div style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: '0.36em', textTransform: 'uppercase', color: C.gold, marginBottom: 24 }}>
              A Field Study, the other half of the cup
            </div>
            <h1 style={{ fontFamily: F.display, fontWeight: 400, fontSize: 'clamp(46px,8.4vw,112px)', lineHeight: 0.98, letterSpacing: '-0.015em', color: C.cream, margin: 0 }}>
              The Water <span style={{ fontStyle: 'italic', color: C.gold }}>Before the Leaf</span>
            </h1>
            <p style={{ fontFamily: F.body, fontStyle: 'italic', fontSize: 'clamp(16px,2.1vw,21px)', lineHeight: 1.5, color: C.taupe, margin: '24px 0 0', maxWidth: 540 }}>
              A cup of tea is more than ninety-nine parts water. We obsess over the one part leaf and forget the rest. This is a study of the part we forget.
            </p>
          </div>

          {/* animated scroll indicator */}
          <div aria-hidden="true" style={{ position: 'absolute', bottom: 28, left: '50%', animation: 'tjFloatX 3.4s ease-in-out infinite' }}>
            <svg width="13" height="20" viewBox="0 0 13 20" fill="none">
              <path d="M6.5 1v17M1 12.5l5.5 5.5 5.5-5.5" stroke="#a8874d" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </header>

        {/* ── STANDFIRST ────────────────────────────────────────────────── */}
        <section data-reveal style={{ maxWidth: 680, margin: '0 auto', padding: 'clamp(56px,9vw,116px) 24px clamp(28px,5vw,52px)' }}>
          <p style={{ fontFamily: F.body, fontSize: 'clamp(18px,2.2vw,22px)', lineHeight: 1.74, color: C.ink, margin: 0 }}>
            <span style={{ float: 'left', fontFamily: F.display, fontWeight: 600, fontSize: '5em', lineHeight: 0.78, color: C.gold, margin: '8px 16px -4px 0' }}>L</span>
            ù Yù, who wrote the first book on tea twelve centuries ago, devoted an entire chapter not to leaves but to{' '}
            <em style={{ fontStyle: 'italic', color: C.cream }}>water</em>. He ranked the rivers of China by name. He sent men to fetch from particular bends of particular streams. To him the leaf was only half the craft; the water was the other, quieter half, the half that does the actual carrying. We have mostly forgotten this. The tap, we assume, is the tap. It is not.
          </p>
        </section>

        {/* ── SECTION I: The forgotten ingredient ─────────────────────── */}
        <section style={{ maxWidth: 1100, margin: '0 auto', padding: 'clamp(20px,4vw,40px) clamp(20px,5vw,40px)' }}>
          <div data-reveal style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 'clamp(28px,4vw,40px)', maxWidth: 680, marginLeft: 'auto', marginRight: 'auto' }}>
            <span style={{ fontFamily: F.display, fontStyle: 'italic', fontSize: 30, color: C.gold, lineHeight: 1 }}>I</span>
            <span style={{ flex: 1, height: 1, background: 'rgba(168,135,77,0.22)' }} />
            <span style={{ fontFamily: F.ui, fontSize: 10, fontWeight: 500, letterSpacing: '0.24em', textTransform: 'uppercase', color: C.dim }}>The forgotten ingredient</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,300px),1fr))', gap: 'clamp(24px,4vw,52px)', alignItems: 'center' }}>
            <div data-reveal>
              <p style={pBody}>
                Water is not a neutral vehicle. It arrives carrying its own dissolved cargo, calcium, magnesium, chlorine, the faint sweetness or flatness of where it has been. Brew the same leaf in two waters and you will not get the same tea twice. A bright spring green can turn dull and grey in hard tap water; a delicate white can be flattened to nothing by chlorine.
              </p>
              <p style={{ ...pBody, margin: 0 }}>
                The old masters understood the water as a frame, and the tea as the picture. The wrong frame ruins even a masterpiece.
              </p>
            </div>
            <figure data-reveal style={{ margin: 0 }}>
              <div style={{ position: 'relative', aspectRatio: '4/5', border: '1px solid rgba(168,135,77,0.2)', borderRadius: 3, overflow: 'hidden', background: 'linear-gradient(160deg,#1a2422,#14100b 80%)' }}>
                <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 60% 40% at 50% 24%, rgba(140,175,170,0.2), transparent 60%)' }} />
                <svg viewBox="0 0 320 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
                  <g fill="none" stroke="rgba(150,180,180,0.4)" strokeWidth="1.2">
                    <path d="M160 40 C 150 110, 150 150, 168 200 C 150 250, 150 300, 160 360" />
                    <path d="M120 120 C 150 140, 180 140, 200 120" />
                    <path d="M118 220 C 150 244, 188 244, 210 220" />
                  </g>
                  <g fill="none" stroke="rgba(150,180,180,0.22)" strokeWidth="1">
                    <path d="M40 300 C 130 286, 200 286, 290 300" />
                    <path d="M30 332 C 130 318, 210 318, 300 332" />
                    <path d="M40 362 C 130 348, 200 348, 290 362" />
                  </g>
                </svg>
                <div style={{ ...plateLabel }}>Plate I, the source</div>
              </div>
              <figcaption style={cap}>A mountain spring, for Lu Yu, the finest water of all, soft and alive.</figcaption>
            </figure>
          </div>
        </section>

        {/* ── PULL QUOTE ────────────────────────────────────────────────── */}
        <section data-reveal style={{ maxWidth: 900, margin: '0 auto', padding: 'clamp(50px,8vw,104px) 24px', textAlign: 'center' }}>
          <blockquote style={{ fontFamily: F.display, fontStyle: 'italic', fontWeight: 400, fontSize: 'clamp(28px,4.8vw,54px)', lineHeight: 1.18, color: C.cream, margin: '0 auto', maxWidth: 840 }}>
            "Mountain water is best, river water middling, well water the least."
          </blockquote>
          <p style={{ fontFamily: F.ui, fontSize: 11, fontWeight: 500, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.dim, margin: '30px 0 0' }}>
            Lù Yù · The Classic of Tea, c. 760
          </p>
        </section>

        {/* ── SECTION II: A ranking of waters ─────────────────────────── */}
        <section style={{ maxWidth: 680, margin: '0 auto', padding: '0 24px' }}>
          <SectionDivider numeral="II" label="A ranking of waters" />
          <p data-reveal style={{ ...pBody, marginBottom: 30 }}>
            The classical hierarchy is simple, and surprisingly close to what modern chemistry would tell you. Soft, living water from high ground, low in minerals, high in oxygen, lets a tea speak. Heavy, still, mineral-laden water muffles it.
          </p>
          <div data-reveal style={{ display: 'flex', flexDirection: 'column', gap: 0, marginBottom: 'clamp(20px,4vw,40px)' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, padding: '18px 0', borderTop: '1px solid rgba(168,135,77,0.18)' }}>
              <span style={{ fontFamily: F.mono, fontSize: 12, color: C.gold, width: 28, flexShrink: 0 }}>01</span>
              <span style={{ fontFamily: F.display, fontSize: 24, color: C.ink, width: 'clamp(120px,30%,180px)', flexShrink: 0 }}>Mountain spring</span>
              <span style={{ fontFamily: F.body, fontStyle: 'italic', fontSize: 14, lineHeight: 1.5, color: C.dim }}>Soft, oxygenated, alive. The ideal.</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, padding: '18px 0', borderTop: '1px solid rgba(168,135,77,0.1)' }}>
              <span style={{ fontFamily: F.mono, fontSize: 12, color: C.gold, width: 28, flexShrink: 0 }}>02</span>
              <span style={{ fontFamily: F.display, fontSize: 24, color: C.ink, width: 'clamp(120px,30%,180px)', flexShrink: 0 }}>River water</span>
              <span style={{ fontFamily: F.body, fontStyle: 'italic', fontSize: 14, lineHeight: 1.5, color: C.dim }}>Drawn from the slow middle, away from the banks.</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, padding: '18px 0', borderTop: '1px solid rgba(168,135,77,0.1)', borderBottom: '1px solid rgba(168,135,77,0.18)' }}>
              <span style={{ fontFamily: F.mono, fontSize: 12, color: C.gold, width: 28, flexShrink: 0 }}>03</span>
              <span style={{ fontFamily: F.display, fontSize: 24, color: C.ink, width: 'clamp(120px,30%,180px)', flexShrink: 0 }}>Well water</span>
              <span style={{ fontFamily: F.body, fontStyle: 'italic', fontSize: 14, lineHeight: 1.5, color: C.dim }}>Still and hard, usable, but the last resort.</span>
            </div>
          </div>
          <p data-reveal style={{ ...pBody, margin: 0 }}>
            Few of us live beside a mountain spring. But the principle survives the move to the kitchen: a soft, low-mineral water, filtered, or a gentle bottled spring, will almost always pour you a better cup than the tap.
          </p>
        </section>

        {/* ── FULL-BLEED: THE BOIL ─────────────────────────────────────── */}
        <section style={{ padding: 'clamp(40px,7vw,90px) 0' }}>
          <figure data-reveal style={{ margin: 0 }}>
            <div style={{ position: 'relative', padding: 'clamp(40px,6vw,80px) clamp(20px,5vw,56px)', borderTop: '1px solid rgba(168,135,77,0.16)', borderBottom: '1px solid rgba(168,135,77,0.16)', background: 'linear-gradient(180deg,#181d1c,#14100b)' }}>
              <div style={{ maxWidth: 1080, margin: '0 auto' }}>
                <div style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.gold, marginBottom: 10 }}>Plate II, reading the boil</div>
                <h2 style={{ fontFamily: F.display, fontWeight: 400, fontSize: 'clamp(28px,4.6vw,48px)', lineHeight: 1.06, color: C.cream, margin: '0 0 12px' }}>The four stages of boiling water</h2>
                <p style={{ fontFamily: F.body, fontSize: 'clamp(15px,1.9vw,17px)', lineHeight: 1.7, color: C.taupe, margin: '0 0 clamp(34px,5vw,52px)', maxWidth: 660 }}>
                  Long before thermometers, tea masters read temperature by the{' '}
                  <em style={{ fontStyle: 'italic', color: C.ink }}>look</em>{' '}
                  of the water, naming each stage of the boil for the bubbles it threw. The names are still the most useful guide there is.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,160px),1fr))', gap: 'clamp(16px,2.4vw,28px)' }}>
                  <BoilStage
                    cn="蟹眼"
                    name="Crab eyes"
                    temp="~75–80°C"
                    desc="First tiny beads. Right for delicate greens."
                    bgStyle={{ background: 'linear-gradient(180deg,#1a2120,#14100b)' }}
                    svgContent={
                      <>
                        <g fill="rgba(150,180,180,0.6)">
                          <circle cx="62" cy="168" r="2" />
                          <circle cx="86" cy="176" r="1.6" />
                          <circle cx="74" cy="184" r="1.8" />
                          <circle cx="98" cy="166" r="1.5" />
                        </g>
                        <path d="M44 120 h72" stroke="rgba(168,135,77,0.3)" strokeWidth="1" />
                      </>
                    }
                  />
                  <BoilStage
                    cn="鱼眼"
                    name="Fish eyes"
                    temp="~80–85°C"
                    desc="Larger, steady bubbles. Whites and yellows."
                    bgStyle={{ background: 'linear-gradient(180deg,#1a2120,#14100b)' }}
                    svgContent={
                      <>
                        <g fill="rgba(150,180,180,0.65)">
                          <circle cx="58" cy="166" r="3.4" />
                          <circle cx="86" cy="172" r="3" />
                          <circle cx="100" cy="160" r="2.6" />
                          <circle cx="70" cy="184" r="2.8" />
                        </g>
                        <path d="M44 116 h72" stroke="rgba(168,135,77,0.3)" strokeWidth="1" />
                      </>
                    }
                  />
                  <BoilStage
                    cn="連珠"
                    name="String of pearls"
                    temp="~90°C"
                    desc="Ropes of bubbles rising. Oolongs."
                    bgStyle={{ background: 'linear-gradient(180deg,#1a2120,#14100b)' }}
                    svgContent={
                      <>
                        <g fill="rgba(150,180,180,0.7)">
                          <circle cx="62" cy="180" r="2.4" />
                          <circle cx="62" cy="166" r="2.4" />
                          <circle cx="62" cy="150" r="2.2" />
                          <circle cx="92" cy="184" r="2.4" />
                          <circle cx="92" cy="168" r="2.2" />
                          <circle cx="92" cy="152" r="2" />
                        </g>
                        <path d="M44 120 h72" stroke="rgba(168,135,77,0.3)" strokeWidth="1" />
                      </>
                    }
                  />
                  <BoilStage
                    cn="騰波"
                    name="Raging waves"
                    temp="100°C"
                    desc="A rolling boil. Reds, dark teas, rock oolong."
                    bgStyle={{ background: 'linear-gradient(180deg,#211a14,#14100b)' }}
                    svgContent={
                      <>
                        <g fill="rgba(200,150,90,0.55)">
                          <circle cx="52" cy="176" r="3" />
                          <circle cx="72" cy="160" r="3.6" />
                          <circle cx="92" cy="178" r="3.2" />
                          <circle cx="108" cy="158" r="2.8" />
                          <circle cx="64" cy="146" r="2.6" />
                          <circle cx="98" cy="142" r="2.4" />
                        </g>
                        <path d="M40 150 C 60 138, 100 138, 120 150" fill="none" stroke="rgba(200,150,90,0.4)" strokeWidth="1.2" />
                      </>
                    }
                  />
                </div>
                <p style={{ fontFamily: F.body, fontStyle: 'italic', fontSize: 13.5, lineHeight: 1.6, color: C.dim, margin: 'clamp(28px,4vw,40px) 0 0', maxWidth: 680 }}>
                  Lu Yu warned against the "old man's water", water boiled too long and too hard, gone flat and lifeless. Bring it just to the stage your tea wants, and no further.
                </p>
              </div>
            </div>
          </figure>
        </section>

        {/* ── SECTION III: Hard, soft & the minerals between ───────────── */}
        <section style={{ maxWidth: 680, margin: '0 auto', padding: '0 24px' }}>
          <SectionDivider numeral="III" label="Hard, soft & the minerals between" />
          <p data-reveal style={{ ...pBody, marginBottom: 22 }}>
            "Hardness" is mostly dissolved calcium and magnesium. A little is good, pure distilled water tastes hollow, and brews a strangely empty tea, because some minerals are needed to pull flavour from the leaf. Too much, and the calcium binds with the tea's compounds, dulling the colour and throwing that grey scum across the surface of a cup of black tea.
          </p>
          <p data-reveal style={{ ...pBody, margin: 0 }}>
            The sweet spot is a soft-to-medium water, enough minerals to carry, not enough to smother. Chlorine, meanwhile, has no business near good tea: let tap water stand uncovered overnight, or filter it, and the worst of it leaves.
          </p>
        </section>

        {/* ── SECTION IV: Temperature table ───────────────────────────── */}
        <section data-reveal style={{ maxWidth: 760, margin: '0 auto', padding: 'clamp(40px,6vw,72px) 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: 16, borderBottom: '1px solid rgba(168,135,77,0.18)', marginBottom: 4 }}>
            <h2 style={{ fontFamily: F.display, fontWeight: 400, fontSize: 'clamp(24px,3vw,34px)', color: C.cream, margin: 0 }}>Water, by tea</h2>
            <span style={{ fontFamily: F.ui, fontSize: 10, fontWeight: 500, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.dim }}>A rough guide</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr 2fr' }}>
            {/* header row */}
            <div style={{ padding: '14px 0 12px', fontFamily: F.ui, fontSize: 9.5, fontWeight: 500, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.dim }}>Tea</div>
            <div style={{ padding: '14px 0 12px', fontFamily: F.ui, fontSize: 9.5, fontWeight: 500, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.dim }}>Temp</div>
            <div style={{ padding: '14px 0 12px', fontFamily: F.ui, fontSize: 9.5, fontWeight: 500, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.dim }}>Why</div>
            {/* top border */}
            <div style={{ gridColumn: '1/-1', height: 1, background: 'rgba(168,135,77,0.18)' }} />
            {/* data rows */}
            <TempRow dot="#859F85" tea="Green" temp="75–80°" why="Hot water scorches the leaf and turns it bitter." />
            <TempRow dot="#D6D3CD" tea="White / Yellow" temp="80–85°" why="Gentle heat for gentle, downy leaves." />
            <TempRow dot="#C4A484" tea="Oolong" temp="90–95°" why="Hot enough to lift its complex aromatics." />
            <TempRow dot="#A67B70" tea="Red / Dark" temp="95–100°" why="Robust leaves want a full, rolling boil." strong />
            {/* bottom border */}
            <div style={{ gridColumn: '1/-1', height: 1, background: 'rgba(168,135,77,0.18)' }} />
          </div>
        </section>

        {/* ── CLOSING ───────────────────────────────────────────────────── */}
        <section data-reveal style={{ maxWidth: 680, margin: '0 auto', padding: 'clamp(30px,5vw,56px) 24px clamp(40px,6vw,72px)' }}>
          <p style={{ fontFamily: F.body, fontStyle: 'italic', fontSize: 'clamp(17px,2.1vw,20px)', lineHeight: 1.72, color: C.taupe, margin: 0 }}>
            Change your water before you change your tea. It is the cheapest and most dramatic improvement a drinker can make, and the one almost no one thinks to try. The leaf gets all the attention. The water does most of the work.
          </p>
          <div style={{ marginTop: 40, fontFamily: F.mono, fontSize: 10, letterSpacing: '0.24em', textTransform: 'uppercase', color: C.dim, lineHeight: 2 }}>
            A Field Study by Teajia &nbsp;·&nbsp; N°12
          </div>
        </section>

        <MoreFooter links={moreLinks} />
      </article>
    </ImmersiveRoot>
  );
};

export default FieldStudyWaterBeforeLeaf;
