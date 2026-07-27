/**
 * @color-literals. The Read section is one always-dark editorial surface.
 * Rationale, and the conditions on this exception, in read/immersive.tsx.
 */
/**
 * A Tea House — Quiet Hours · N°09
 * How a homesick cup and a stack of reclaimed timber became a tea house at the
 * far end of the world. Told by Mei and Tom Hale, Brunswick, Melbourne.
 * Ported pixel-faithfully from the tea-article-redesign mockup.
 */
import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import {
  C, F, ImmersiveRoot, ImmersiveNav, AccentSwatches, MoreFooter,
  useReveals, useReadingProgress, useImmersiveChrome, grainCss, ACCENTS,
} from './immersive';

const moreLinks = [
  { to: '/read/essay', kicker: 'Essay · N°10', title: 'The Long Way to the Cup', blurb: 'From Hong Kong to Bali, learning to taste.' },
  { to: '/read/field-notes', kicker: 'Field Notes · N°11', title: 'Two Rooms in Bali', blurb: 'Jackfruit wood, charcoal, and slow bonsai light.' },
  { to: '/read/ritual', kicker: 'The Ritual · N°05', title: 'Seven Steeps', blurb: 'The same leaves, brewed seven ways.' },
];

// ─── Shared sub-styles ───────────────────────────────────────────────────────
const pBody: React.CSSProperties = {
  fontFamily: F.body,
  fontSize: 'clamp(16px,2vw,18px)',
  lineHeight: 1.8,
  color: C.taupe,
  margin: '0 0 20px',
};

const duetQ: React.CSSProperties = {
  fontFamily: F.display,
  fontStyle: 'italic',
  fontWeight: 500,
  fontSize: 'clamp(19px,2.4vw,24px)',
  lineHeight: 1.34,
  color: C.warm,
  margin: '0 0 16px',
};

const duetFooter: React.CSSProperties = {
  fontFamily: F.ui,
  fontSize: 10,
  fontWeight: 500,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  color: C.dim,
};

// ─── Movement header ─────────────────────────────────────────────────────────
const MovementHeader: React.FC<{ numeral: string; label: string; margin?: string }> = ({ numeral, label, margin }) => (
  <div
    data-reveal
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 18,
      margin: margin ?? 'clamp(34px,5vw,56px) 0 clamp(28px,4vw,40px)',
    }}
  >
    <span style={{ fontFamily: F.display, fontStyle: 'italic', fontSize: 30, color: C.gold, lineHeight: 1 }}>{numeral}</span>
    <span style={{ flex: 1, height: 1, background: 'rgba(168,135,77,0.22)' }} />
    <span style={{ fontFamily: F.ui, fontSize: 10, fontWeight: 500, letterSpacing: '0.24em', textTransform: 'uppercase', color: C.dim }}>{label}</span>
  </div>
);

// ─── Duet blockquote pair ────────────────────────────────────────────────────
const DuetPair: React.FC<{
  left: { quote: React.ReactNode; speaker: string; borderColor: string };
  right: { quote: React.ReactNode; speaker: string; borderColor: string };
}> = ({ left, right }) => (
  <div
    data-reveal
    style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,260px),1fr))',
      gap: 'clamp(20px,3vw,32px)',
      margin: '0 auto',
    }}
  >
    <blockquote style={{ margin: 0, borderTop: `2px solid ${left.borderColor}`, padding: '20px 0 0' }}>
      <p style={duetQ}>{left.quote}</p>
      <footer style={duetFooter}>{left.speaker}</footer>
    </blockquote>
    <blockquote style={{ margin: 0, borderTop: `2px solid ${right.borderColor}`, padding: '20px 0 0' }}>
      <p style={duetQ}>{right.quote}</p>
      <footer style={duetFooter}>{right.speaker}</footer>
    </blockquote>
  </div>
);

// ─── Fact row ─────────────────────────────────────────────────────────────────
const FactRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <div style={{ fontFamily: F.ui, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.dim, marginBottom: 8 }}>{label}</div>
    <div style={{ fontFamily: F.body, fontSize: 15, color: C.ink }}>{value}</div>
  </div>
);

// ─── Component ───────────────────────────────────────────────────────────────
const TeaHouseQuietHours: React.FC = () => {
  const [accent, setAccent] = useState<string>(ACCENTS[0]);
  useImmersiveChrome(accent);
  const rootRef = useReveals([]);
  const progress = useReadingProgress();

  return (
    <ImmersiveRoot rootRef={rootRef}>
      <Helmet><title>Quiet Hours · Teajia</title></Helmet>
      <ImmersiveNav eyebrow="A Tea House · N°09" progress={progress} />
      <AccentSwatches accent={accent} setAccent={setAccent} />

      <article style={{ position: 'relative', zIndex: 1 }}>

        {/* ── COVER ─────────────────────────────────────────────────────── */}
        <header style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,360px),1fr))',
          alignItems: 'stretch',
          borderBottom: '1px solid rgba(168,135,77,0.14)',
          minHeight: '90vh',
        }}>
          {/* text column */}
          <div style={{ position: 'relative', order: 2, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 'clamp(36px,6vw,84px) clamp(24px,5vw,72px)' }}>
            <div style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: '0.34em', textTransform: 'uppercase', color: C.gold, marginBottom: 26 }}>
              A Tea House · Brunswick, Melbourne
            </div>
            <h1 style={{ fontFamily: F.display, fontWeight: 400, fontSize: 'clamp(46px,7vw,92px)', lineHeight: 0.98, letterSpacing: '-0.015em', color: C.cream, margin: 0 }}>
              Quiet <span style={{ fontStyle: 'italic', color: C.gold }}>Hours</span>
            </h1>
            <p style={{ fontFamily: F.body, fontStyle: 'italic', fontSize: 'clamp(16px,2vw,20px)', lineHeight: 1.5, color: C.taupe, margin: '24px 0 0', maxWidth: 460 }}>
              How a homesick cup and a stack of reclaimed timber became a tea house at the far end of the world — told by the two people who made it.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '26px 40px', marginTop: 'clamp(30px,5vw,46px)', paddingTop: 24, borderTop: '1px solid rgba(168,135,77,0.16)' }}>
              {/* Mei */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: C.gold, marginTop: 7, flex: 'none' }} />
                <div>
                  <div style={{ fontFamily: F.display, fontSize: 23, color: C.ink, lineHeight: 1 }}>
                    Mei{' '}
                    <span style={{ fontFamily: F.cn, color: C.taupe, fontSize: 18 }}>梅</span>
                  </div>
                  <div style={{ fontFamily: F.ui, fontSize: 10, fontWeight: 500, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.dim, marginTop: 7 }}>
                    Founder &amp; host
                  </div>
                </div>
              </div>
              {/* Tom */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#8f9aa0', marginTop: 7, flex: 'none' }} />
                <div>
                  <div style={{ fontFamily: F.display, fontSize: 23, color: C.ink, lineHeight: 1 }}>Tom Hale</div>
                  <div style={{ fontFamily: F.ui, fontSize: 10, fontWeight: 500, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.dim, marginTop: 7 }}>
                    Builder &amp; joiner
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* illustration column */}
          <div style={{ position: 'relative', order: 1, overflow: 'hidden', minHeight: '48vh', background: 'linear-gradient(155deg,#241d14 0%,#14100b 80%)' }}>
            <div aria-hidden="true" style={{ ...grainCss('0.8', 150), opacity: 0.08 }} />
            <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 64% 50% at 50% 36%, rgba(168,135,77,0.14), transparent 64%)' }} />
            <div aria-hidden="true" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-54%)', fontFamily: F.cn, fontWeight: 200, fontSize: 'min(40vw,320px)', lineHeight: 1, color: 'rgba(168,135,77,0.06)' }}>茶</div>
            <svg viewBox="0 0 420 420" preserveAspectRatio="xMidYMid meet" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
              {/* tea bowl */}
              <g fill="none" stroke="rgba(168,135,77,0.34)" strokeWidth="1.2">
                <ellipse cx="150" cy="232" rx="62" ry="13" />
                <path d="M92 232 C96 280, 122 300, 150 300 C178 300, 204 280, 208 232" />
                <ellipse cx="150" cy="214" rx="48" ry="10" stroke="rgba(168,135,77,0.24)" />
              </g>
              {/* planer / timber tool */}
              <g fill="none" stroke="rgba(150,180,180,0.3)" strokeWidth="1.2">
                <rect x="232" y="206" width="118" height="34" rx="6" />
                <path d="M246 206 L264 178 L300 178" />
                <line x1="252" y1="240" x2="252" y2="252" />
                <line x1="330" y1="240" x2="330" y2="252" />
                <path d="M250 224 L300 224" stroke="rgba(150,180,180,0.5)" />
              </g>
            </svg>
            <div style={{ position: 'absolute', left: 'clamp(18px,3vw,28px)', bottom: 'clamp(18px,3vw,26px)', fontFamily: F.mono, fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.dim }}>
              The bowl &amp; the plane
            </div>
          </div>
        </header>

        {/* ── STANDFIRST ────────────────────────────────────────────────── */}
        <section data-reveal style={{ maxWidth: 680, margin: '0 auto', padding: 'clamp(56px,9vw,116px) 24px clamp(20px,4vw,44px)' }}>
          <p style={{ fontFamily: F.body, fontSize: 'clamp(18px,2.2vw,22px)', lineHeight: 1.74, color: C.ink, margin: 0 }}>
            <span style={{ float: 'left', fontFamily: F.display, fontWeight: 600, fontSize: '5em', lineHeight: 0.78, color: C.gold, margin: '8px 16px -4px 0' }}>O</span>
            n a wide grey street in Brunswick, between a tyre shop and a bakery, there is a doorway most people walk straight past. Inside, the noise of Melbourne falls away. This is Quiet Hours — a tea house that began, improbably, with a homesick woman, a year in Bali, and a builder who had never finished a pot of tea in his life. I came to ask how a room gets made. It turns out it takes two very different people, talking past each other in the most productive way.
          </p>
        </section>

        {/* ── MOVEMENT I — The Idea ─────────────────────────────────────── */}
        <section style={{ maxWidth: 760, margin: '0 auto', padding: '0 24px' }}>
          <MovementHeader numeral="I" label="The Idea" />
          <div data-reveal style={{ maxWidth: 660, margin: '0 auto' }}>
            <p style={{ ...pBody, marginBottom: 28 }}>
              Mei left southern China as a child and grew up in Hong Kong, where tea was simply the water the day was made of — always there, rarely noticed. It took moving to the other side of the world, and a long stretch in Bali, for her to fall in love with it on purpose. She came back to Melbourne wanting to build the room she had been looking for and never found.
            </p>
          </div>
          <DuetPair
            left={{
              borderColor: C.gold,
              quote: <>&#x201C;I didn&#x2019;t want a café. I wanted a room that makes you exhale the second you step in — somewhere the city has to wait outside.&#x201D;</>,
              speaker: 'Mei · Founder',
            }}
            right={{
              borderColor: '#8f9aa0',
              quote: <>&#x201C;She never gave me a brief. She gave me a feeling and a single word — <em>slow</em> — and then trusted me to find it in the timber.&#x201D;</>,
              speaker: 'Tom · Builder',
            }}
          />
        </section>

        {/* ── PULL QUOTE ────────────────────────────────────────────────── */}
        <section data-reveal style={{ maxWidth: 900, margin: '0 auto', padding: 'clamp(50px,8vw,104px) 24px', textAlign: 'center' }}>
          <blockquote style={{ fontFamily: F.display, fontStyle: 'italic', fontWeight: 400, fontSize: 'clamp(28px,4.8vw,54px)', lineHeight: 1.18, color: C.cream, margin: '0 auto', maxWidth: 840 }}>
            &#x201C;A tea house is not a menu with chairs. It is a permission to be unhurried.&#x201D;
          </blockquote>
          <div aria-hidden="true" style={{ width: 40, height: 1, background: C.gold, opacity: 0.5, margin: '34px auto 0' }} />
        </section>

        {/* ── MOVEMENT II — The Build ───────────────────────────────────── */}
        <section style={{ maxWidth: 760, margin: '0 auto', padding: '0 24px' }}>
          <MovementHeader numeral="II" label="The Build" />
          <div data-reveal style={{ maxWidth: 660, margin: '0 auto' }}>
            <p style={pBody}>
              The shell was a former mechanic&#x2019;s garage — oil-stained concrete, a roller door, fluorescent tubes. Tom spent the first month doing nothing but watching how the light moved across it through the day. Then he began, slowly, in reclaimed spotted gum and messmate pulled from a demolished woolshed.
            </p>
            <p style={{ ...pBody, marginBottom: 28 }}>
              The tea bar is a single nine-foot plank, hand-planed so the grain catches the low afternoon sun. There is a charcoal brazier at one end — Mei&#x2019;s insistence — and almost nothing on the walls. The two of them argued, gently, for months about how empty a room was allowed to be.
            </p>
          </div>
          <DuetPair
            left={{
              borderColor: '#8f9aa0',
              quote: <>&#x201C;Reclaimed timber already knows how to be old. My job was just to get out of its way and let it keep aging in front of people.&#x201D;</>,
              speaker: 'Tom · Builder',
            }}
            right={{
              borderColor: C.gold,
              quote: <>&#x201C;I watched him plane that bar for three days. I realised the room was already being brewed — just out of wood instead of leaves.&#x201D;</>,
              speaker: 'Mei · Founder',
            }}
          />
        </section>

        {/* ── FACT FILE ─────────────────────────────────────────────────── */}
        <section data-reveal style={{ maxWidth: 1040, margin: '0 auto', padding: 'clamp(40px,6vw,80px) 24px' }}>
          <div style={{ border: '1px solid rgba(168,135,77,0.2)', borderRadius: 4, background: 'linear-gradient(160deg,#1d1810,#15110b)', padding: 'clamp(24px,4vw,40px)' }}>
            <div style={{ fontFamily: F.ui, fontSize: 10, fontWeight: 600, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.gold, marginBottom: 24 }}>
              Quiet Hours — in brief
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,200px),1fr))', gap: '22px 36px' }}>
              <FactRow label="Where" value="Brunswick, Melbourne" />
              <FactRow label="Was" value="A mechanic's garage" />
              <FactRow label="Built from" value="Reclaimed spotted gum & messmate" />
              <FactRow label="Seats" value="Eighteen, no more" />
              <FactRow label="Service" value="Charcoal & gongfu, by the session" />
              <FactRow label="Took" value="Fourteen months to build" />
            </div>
          </div>
        </section>

        {/* ── MOVEMENT III — The Same Question ─────────────────────────── */}
        <section style={{ maxWidth: 760, margin: '0 auto', padding: '0 24px' }}>
          <MovementHeader numeral="III" label="The Same Question" margin="clamp(20px,4vw,40px) 0 clamp(28px,4vw,40px)" />
          <div data-reveal style={{ maxWidth: 660, margin: '0 auto' }}>
            <p style={{ ...pBody, marginBottom: 30 }}>
              Near the end, I asked each of them the same thing, separately:{' '}
              <em style={{ fontStyle: 'italic', color: C.ink }}>what is the room actually for?</em>{' '}
              They had never compared answers. I think they are the same answer, said in two languages.
            </p>
          </div>
          <DuetPair
            left={{
              borderColor: C.gold,
              quote: <>&#x201C;For people to remember they have a body, and a breath, and an afternoon. The tea is just the excuse.&#x201D;</>,
              speaker: 'Mei · Founder',
            }}
            right={{
              borderColor: '#8f9aa0',
              quote: <>&#x201C;For the wood to be touched. A bench no one sits on is just lumber. People finish the room — every day.&#x201D;</>,
              speaker: 'Tom · Builder',
            }}
          />
        </section>

        {/* ── CLOSING ───────────────────────────────────────────────────── */}
        <section data-reveal style={{ maxWidth: 680, margin: '0 auto', padding: 'clamp(48px,7vw,96px) 24px' }}>
          <p style={{ fontFamily: F.body, fontStyle: 'italic', fontSize: 'clamp(17px,2.1vw,20px)', lineHeight: 1.72, color: C.taupe, margin: 0 }}>
            When I leave, the late sun is doing exactly what Tom built it to do, sliding gold along the grain of the bar while Mei warms a pot for a stranger who has nowhere else to be. Two people who would never have met, a hemisphere from where the tea was grown, have made a small room where time runs slower. The city waits outside, as instructed.
          </p>
          <div style={{ marginTop: 40, fontFamily: F.mono, fontSize: 10, letterSpacing: '0.24em', textTransform: 'uppercase', color: C.dim, lineHeight: 2 }}>
            Interview by Teajia &nbsp;·&nbsp; A Tea House &nbsp;·&nbsp; N°09
          </div>
        </section>

        <MoreFooter links={moreLinks} />
      </article>
    </ImmersiveRoot>
  );
};

export default TeaHouseQuietHours;
