/**
 * @color-literals. The Read section is one always-dark editorial surface.
 * Rationale, and the conditions on this exception, in read/immersive.tsx.
 */
/**
 * The Long Way to the Cup: Essay · First Person, N°10
 * A personal essay on growing up surrounded by tea without ever tasting it,
 * and the journey, literally to Bali, that finally brought it home.
 * Ported pixel-faithfully from the tea-article-redesign mockup.
 */
import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import {
  C, F, ImmersiveRoot, ImmersiveNav, AccentSwatches, MoreFooter,
  useReveals, useReadingProgress, useImmersiveChrome, ACCENTS,
} from './immersive';

const moreLinks = [
  { to: '/read/field-notes', kicker: 'Field Notes · N°11', title: 'Two Rooms in Bali', blurb: 'Jackfruit wood, charcoal, and slow bonsai light.' },
  { to: '/read/tea-house', kicker: 'A Tea House · N°09', title: 'Quiet Hours', blurb: 'The Melbourne room Mei went on to build.' },
  { to: '/read/atlas', kicker: 'Geography · N°06', title: 'A Map of Mountains', blurb: "Where the teas she's learning come from." },
];

// ─── Shared sub-styles ───────────────────────────────────────────────────────
const pBody: React.CSSProperties = {
  fontFamily: F.body,
  fontSize: 'clamp(16px,2vw,18px)',
  lineHeight: 1.84,
  color: C.taupe,
  margin: '0 0 22px',
};

// ─── Section divider (Chinese numeral + label) ───────────────────────────────
const SectionDivider: React.FC<{ numeral: string; label: string; marginTop?: string }> = ({
  numeral,
  label,
  marginTop = 'clamp(40px,6vw,72px)',
}) => (
  <div
    data-reveal
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 18,
      margin: `${marginTop} 0 clamp(28px,4vw,40px)`,
    }}
  >
    <span style={{ fontFamily: F.cn, fontWeight: 400, fontSize: 26, color: C.gold, lineHeight: 1 }}>{numeral}</span>
    <span style={{ flex: 1, height: 1, background: 'rgba(168,135,77,0.22)' }} />
    <span style={{ fontFamily: F.ui, fontSize: 10, fontWeight: 500, letterSpacing: '0.24em', textTransform: 'uppercase', color: C.dim }}>{label}</span>
  </div>
);

// ─── Three-cups figure ───────────────────────────────────────────────────────
const CupFigure: React.FC<{ bg: string; title: string; caption: string }> = ({ bg, title, caption }) => (
  <figure style={{ margin: 0, textAlign: 'center' }}>
    <div style={{
      width: 'clamp(70px,14vw,96px)',
      height: 'clamp(70px,14vw,96px)',
      margin: '0 auto 18px',
      borderRadius: '50%',
      background: bg,
      boxShadow: '0 0 0 1px rgba(168,135,77,0.3), inset 0 -7px 14px rgba(0,0,0,0.22), inset 0 6px 10px rgba(255,255,255,0.25)',
    }} />
    <div style={{ fontFamily: F.display, fontSize: 21, color: C.ink, marginBottom: 6 }}>{title}</div>
    <p style={{ fontFamily: F.body, fontStyle: 'italic', fontSize: 13.5, lineHeight: 1.55, color: C.dim, margin: 0 }}>{caption}</p>
  </figure>
);

// ─── Component ───────────────────────────────────────────────────────────────
const EssayLongWayToCup: React.FC = () => {
  const [accent, setAccent] = useState<string>(ACCENTS[0]);
  useImmersiveChrome(accent);
  const rootRef = useReveals([]);
  const progress = useReadingProgress();

  return (
    <ImmersiveRoot rootRef={rootRef}>
      <Helmet><title>The Long Way to the Cup · Teajia</title></Helmet>
      <ImmersiveNav eyebrow="Essay · N°10" progress={progress} />
      <AccentSwatches accent={accent} setAccent={setAccent} />

      <article style={{ position: 'relative', zIndex: 1 }}>

        {/* ── COVER ─────────────────────────────────────────────────────── */}
        <header style={{
          position: 'relative',
          minHeight: '84vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: 'clamp(40px,8vw,90px) 24px',
          overflow: 'hidden',
        }}>
          {/* radial glow */}
          <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 70% 55% at 50% 32%, rgba(168,135,77,0.12), transparent 62%)' }} />
          {/* ghosted Chinese character */}
          <div aria-hidden="true" style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%,-54%)',
            fontFamily: F.cn,
            fontWeight: 200,
            fontSize: 'min(58vw,560px)',
            lineHeight: 1,
            color: 'rgba(168,135,77,0.05)',
            pointerEvents: 'none',
            userSelect: 'none',
          }}>回</div>

          <div style={{ position: 'relative', maxWidth: 760 }}>
            <div style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: '0.42em', textTransform: 'uppercase', color: C.gold, marginBottom: 30 }}>
              First Person &nbsp;·&nbsp; N°10
            </div>
            <h1 style={{
              fontFamily: F.display,
              fontWeight: 400,
              fontSize: 'clamp(46px,8.4vw,104px)',
              lineHeight: 0.99,
              letterSpacing: '-0.015em',
              color: C.cream,
              margin: 0,
            }}>
              The Long Way{' '}
              <span style={{ fontStyle: 'italic', color: C.gold }}>to the Cup</span>
            </h1>
            <div aria-hidden="true" style={{ width: 54, height: 1, background: C.gold, opacity: 0.6, margin: '30px auto' }} />
            <p style={{
              fontFamily: F.body,
              fontStyle: 'italic',
              fontWeight: 400,
              fontSize: 'clamp(16px,2.3vw,21px)',
              lineHeight: 1.5,
              color: C.taupe,
              margin: '0 auto',
              maxWidth: 520,
            }}>
              I was born into a country of tea, and it took me thirty years and a journey to the other side of the world to taste it.
            </p>
            <div style={{ marginTop: 32, fontFamily: F.ui, fontSize: 11, fontWeight: 500, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.dim }}>
              By Mei{' '}
              <span style={{ fontFamily: F.cn, textTransform: 'none', color: C.taupe }}>梅</span>
            </div>
          </div>
        </header>

        {/* ── STANDFIRST ────────────────────────────────────────────────── */}
        <section data-reveal style={{ maxWidth: 660, margin: '0 auto', padding: 'clamp(56px,9vw,116px) 24px clamp(20px,4vw,44px)' }}>
          <p style={{ fontFamily: F.body, fontSize: 'clamp(18px,2.2vw,22px)', lineHeight: 1.76, color: C.ink, margin: 0 }}>
            <span style={{ float: 'left', fontFamily: F.display, fontWeight: 600, fontSize: '5em', lineHeight: 0.78, color: C.gold, margin: '8px 16px -4px 0' }}>T</span>
            here is a Chinese word for the sweetness that arrives{' '}
            <em style={{ fontStyle: 'italic', color: C.cream }}>after</em>{' '}
            a sip, once the cup is down and you think the taste is gone.{' '}
            <span style={{ fontFamily: F.cn, color: C.taupe }}>回甘</span>
            , huí gān: the returning sweetness. I have come to think my whole life with tea has been one long huí gān, a flavour I only learned to notice long after I'd swallowed it.
          </p>
        </section>

        {/* ── I: A mainland kitchen, age seven ─────────────────────────── */}
        <section style={{ maxWidth: 660, margin: '0 auto', padding: '0 24px' }}>
          <SectionDivider numeral="七歲" label="A mainland kitchen, age seven" marginTop="clamp(40px,6vw,72px)" />
          <p data-reveal style={pBody}>
            I left the mainland when I was seven. The last morning, my grandmother poured tea the way she always did, from a dented metal pot into small cups with no handles, the leaves left loose to swim. I drank mine too fast, the way children do, already thinking about the aeroplane. I did not know it was the last cup at that table. I did not know a cup could be a last anything.
          </p>
          <p data-reveal style={{ ...pBody, margin: 0 }}>
            For years I remembered nothing about the tea itself, not the type, not the taste. Only the steam on the cold window, and her hands. It would take me three decades to understand that the tea had been the whole point, and I had swallowed it without looking.
          </p>
        </section>

        {/* ── PULL QUOTE 1 ──────────────────────────────────────────────── */}
        <section data-reveal style={{ maxWidth: 900, margin: '0 auto', padding: 'clamp(48px,8vw,100px) 24px', textAlign: 'center' }}>
          <blockquote style={{ fontFamily: F.display, fontStyle: 'italic', fontWeight: 400, fontSize: 'clamp(26px,4.4vw,50px)', lineHeight: 1.2, color: C.cream, margin: '0 auto', maxWidth: 820 }}>
            "I was raised in tea the way a fish is raised in water, so surrounded by it I never once saw it."
          </blockquote>
          <div aria-hidden="true" style={{ width: 40, height: 1, background: C.gold, opacity: 0.5, margin: '34px auto 0' }} />
        </section>

        {/* ── II: Hong Kong, the in-between years ──────────────────────── */}
        <section style={{ maxWidth: 660, margin: '0 auto', padding: '0 24px' }}>
          <SectionDivider numeral="香港" label="Hong Kong, the in-between years" marginTop="clamp(20px,4vw,40px)" />
          <p data-reveal style={pBody}>
            Hong Kong runs on tea the way other cities run on traffic. Milk tea the colour of teak, pulled through a cloth sock in the cha chaan teng downstairs. Bottomless pots of bo lei at dim sum, slammed down and forgotten. Gongfu sets that came out only when an uncle wanted to show off. Tea was everywhere, and so it was nowhere, it was just the weather of being alive there.
          </p>
          <p data-reveal style={{ ...pBody, margin: 0 }}>
            I drank litres of it and tasted none of it. If you had asked me then whether I liked tea, I would have laughed. It was like being asked whether I liked air.
          </p>
        </section>

        {/* ── III: Bali: The room that slowed down ─────────────────────── */}
        <section style={{ maxWidth: 660, margin: '0 auto', padding: '0 24px' }}>
          <SectionDivider numeral="Bali" label="The room that slowed down" marginTop="clamp(40px,6vw,72px)" />
          <p data-reveal style={pBody}>
            I went to Bali to get away from everything, including, I thought, my own past. Instead I found a low room of dark jackfruit wood, where a man I'd never met sat me down and brewed, without hurry, for an hour. Tiny cup after tiny cup. He barely spoke. He just kept pouring, and waiting, and watching my face, the way, I realised much later, my grandmother had watched mine.
          </p>
          <p data-reveal style={pBody}>
            Somewhere around the fourth steep, something in me went quiet that had not been quiet in years. I tasted it, actually tasted it, the orchid and the warm stone and the long sweet finish climbing back up, and I started, embarrassingly, to cry. I was thirty-one years old and I was tasting tea, on purpose, for the first time.
          </p>
          <p data-reveal style={{ ...pBody, margin: 0 }}>
            It was not the tea that undid me. It was the slowness. No one had ever given me an hour to taste anything.
          </p>
        </section>

        {/* ── PULL QUOTE 2 ──────────────────────────────────────────────── */}
        <section data-reveal style={{ maxWidth: 900, margin: '0 auto', padding: 'clamp(48px,8vw,100px) 24px', textAlign: 'center' }}>
          <blockquote style={{ fontFamily: F.display, fontStyle: 'italic', fontWeight: 400, fontSize: 'clamp(26px,4.4vw,50px)', lineHeight: 1.2, color: C.cream, margin: '0 auto', maxWidth: 820 }}>
            "I had to travel three thousand miles from my heritage to finally arrive at it."
          </blockquote>
          <div aria-hidden="true" style={{ width: 40, height: 1, background: C.gold, opacity: 0.5, margin: '34px auto 0' }} />
        </section>

        {/* ── IV: Now, a beginner again ────────────────────────────────── */}
        <section style={{ maxWidth: 660, margin: '0 auto', padding: '0 24px' }}>
          <SectionDivider numeral="現在" label="Now, a beginner again" marginTop="clamp(20px,4vw,40px)" />
          <p data-reveal style={pBody}>
            These days I am learning my own inheritance backwards, from the outside in. I can finally name what I'm drinking, the rock teas, the spring greens, the aged dark cakes that taste of forest floor. I am learning the words I should have grown up with: huí gān, yán yùn, the patience to wait for the third steep. I am, at thirty-something, a complete beginner. It is the happiest I have been.
          </p>
          <p data-reveal style={{ ...pBody, margin: 0 }}>
            I think often of my grandmother's dented pot. I understand now that she wasn't making a drink. She was making a moment, and handing it to a child too young to keep it. I have spent my adult life learning to receive it, and lately, in a quiet room I am building far from where any of this began, learning to hand it on.
          </p>
        </section>

        {/* ── THREE CUPS ────────────────────────────────────────────────── */}
        <section data-reveal style={{ maxWidth: 920, margin: '0 auto', padding: 'clamp(50px,8vw,104px) 24px clamp(30px,5vw,56px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 'clamp(30px,4vw,44px)' }}>
            <span style={{ fontFamily: F.display, fontStyle: 'italic', fontSize: 30, color: C.gold, lineHeight: 1 }}>回</span>
            <span style={{ flex: 1, height: 1, background: 'rgba(168,135,77,0.22)' }} />
            <span style={{ fontFamily: F.ui, fontSize: 10, fontWeight: 500, letterSpacing: '0.24em', textTransform: 'uppercase', color: C.dim }}>Three cups</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,220px),1fr))', gap: 'clamp(24px,4vw,44px)' }}>
            <CupFigure
              bg="#e9d9a8"
              title="The cup I didn't drink"
              caption="My grandmother's table. Swallowed in a hurry, at seven."
            />
            <CupFigure
              bg="#cf9f49"
              title="The cup that woke me"
              caption="A dark room in Bali. The fourth steep, at thirty-one."
            />
            <CupFigure
              bg="#8f6741"
              title="The cup I'm learning"
              caption="My own, now. Poured slowly, and finally tasted."
            />
          </div>
        </section>

        {/* ── CLOSING ───────────────────────────────────────────────────── */}
        <section data-reveal style={{ maxWidth: 660, margin: '0 auto', padding: 'clamp(30px,5vw,56px) 24px clamp(40px,6vw,72px)', textAlign: 'center' }}>
          <p style={{
            fontFamily: F.display,
            fontStyle: 'italic',
            fontWeight: 400,
            fontSize: 'clamp(22px,3.4vw,32px)',
            lineHeight: 1.36,
            color: C.ink,
            margin: 0,
          }}>
            The sweetness comes back, if you wait for it. It just took mine a very long way around.
          </p>
          <div style={{ marginTop: 42, fontFamily: F.mono, fontSize: 10, letterSpacing: '0.24em', textTransform: 'uppercase', color: C.dim, lineHeight: 2 }}>
            By Mei &nbsp;·&nbsp; First Person &nbsp;·&nbsp; N°10
          </div>
        </section>

        <MoreFooter links={moreLinks} />
      </article>
    </ImmersiveRoot>
  );
};

export default EssayLongWayToCup;
