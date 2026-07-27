/**
 * @color-literals. The Read section is one always-dark editorial surface.
 * Rationale, and the conditions on this exception, in read/immersive.tsx.
 */
/**
 * Field Notes: Two Rooms in Bali: Field Notes · N°11
 * Two tea rooms in the hills above Ubud: one dark as a drum, one open to the sky.
 * Ported pixel-faithfully from the tea-article-redesign mockup.
 */
import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import {
  C, F, ImmersiveRoot, ImmersiveNav, AccentSwatches, MoreFooter,
  useReveals, useReadingProgress, useImmersiveChrome, grainCss, ACCENTS,
} from './immersive';

const moreLinks = [
  { to: '/read/essay',   kicker: 'Essay · N°10',    title: 'The Long Way to the Cup', blurb: 'The woman this room woke, in her own words.' },
  { to: '/read/tea-house', kicker: 'A Tea House · N°09', title: 'Quiet Hours',         blurb: 'The Melbourne tea house these rooms inspired.' },
  { to: '/read/ritual',  kicker: 'The Ritual · N°05', title: 'Seven Steeps',           blurb: 'The slow brewing those rooms are built around.' },
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

// ─── Component ───────────────────────────────────────────────────────────────
const FieldNotesTwoRoomsBali: React.FC = () => {
  const [accent, setAccent] = useState<string>(ACCENTS[0]);
  useImmersiveChrome(accent);
  const rootRef = useReveals([]);
  const progress = useReadingProgress();

  return (
    <ImmersiveRoot rootRef={rootRef}>
      <Helmet><title>Two Rooms in Bali · Teajia</title></Helmet>
      <ImmersiveNav eyebrow="Field Notes · N°11" progress={progress} />
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
          <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,#2a2017 0%,#1c1610 48%,#14100b 100%)' }} />
          <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 64% 44% at 70% 32%, rgba(214,160,90,0.2), transparent 60%)' }} />
          <div aria-hidden="true" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-54%)', fontFamily: F.cn, fontWeight: 200, fontSize: 'min(52vw,500px)', lineHeight: 1, color: 'rgba(168,135,77,0.06)' }}>静</div>
          <svg viewBox="0 0 1200 760" preserveAspectRatio="xMidYMid slice" aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
            <g fill="none" stroke="rgba(168,135,77,0.12)" strokeWidth="1.2">
              <path d="M-50 540 C 300 506, 760 520, 1260 484" />
              <path d="M-50 588 C 280 556, 780 568, 1260 532" />
              <path d="M-50 640 C 320 606, 800 620, 1260 580" />
            </g>
          </svg>
          <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(0deg, rgba(20,16,11,0.86), transparent 42%)' }} />
          <div style={{ position: 'relative', zIndex: 1, padding: '0 clamp(24px,6vw,84px) clamp(48px,9vw,110px)', maxWidth: 1000 }}>
            <div style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: '0.36em', textTransform: 'uppercase', color: C.gold, marginBottom: 24 }}>
              Field Notes, the hills above Ubud, Bali
            </div>
            <h1 style={{ fontFamily: F.display, fontWeight: 400, fontSize: 'clamp(48px,9vw,114px)', lineHeight: 0.98, letterSpacing: '-0.015em', color: C.cream, margin: 0 }}>
              Two Rooms <span style={{ fontStyle: 'italic', color: C.gold }}>in Bali</span>
            </h1>
            <p style={{ fontFamily: F.body, fontStyle: 'italic', fontSize: 'clamp(16px,2.1vw,21px)', lineHeight: 1.5, color: C.taupe, margin: '24px 0 0', maxWidth: 540 }}>
              A valley apart, two tea rooms made from the island itself, jackfruit wood and charcoal in one, bonsai and daylight in the other. Both, in the end, an argument for slowness.
            </p>
          </div>
          {/* scroll indicator */}
          <div aria-hidden="true" style={{ position: 'absolute', bottom: 28, left: '50%', animation: 'tjFloat 3.4s ease-in-out infinite' }}>
            <svg width="13" height="20" viewBox="0 0 13 20" fill="none">
              <path d="M6.5 1v17M1 12.5l5.5 5.5 5.5-5.5" stroke="#a8874d" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </header>

        {/* ── STANDFIRST ────────────────────────────────────────────────── */}
        <section data-reveal style={{ maxWidth: 680, margin: '0 auto', padding: 'clamp(56px,9vw,116px) 24px clamp(28px,5vw,52px)' }}>
          <p style={{ fontFamily: F.body, fontSize: 'clamp(18px,2.2vw,22px)', lineHeight: 1.74, color: C.ink, margin: 0 }}>
            <span style={{ float: 'left', fontFamily: F.display, fontWeight: 600, fontSize: '5em', lineHeight: 0.78, color: C.gold, margin: '8px 16px -4px 0' }}>B</span>
            ali does not grow much tea of its own, yet it has become a place people come to <em style={{ fontStyle: 'italic', color: C.cream }}>learn</em> it, somewhere the climate and the culture both conspire toward unhurry. In the green hills above Ubud I found two rooms that brew it, a valley apart, and could not be more different. One is dark as the inside of a drum. One is open to the sky. I sat in both, for a long time, and took these notes.
          </p>
        </section>

        {/* ── ROOM I ────────────────────────────────────────────────────── */}
        <section style={{ maxWidth: 1180, margin: '0 auto', padding: 'clamp(20px,4vw,40px) clamp(20px,5vw,40px)' }}>
          <div data-reveal style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 'clamp(28px,4vw,44px)' }}>
            <span style={{ fontFamily: F.display, fontStyle: 'italic', fontSize: 30, color: C.gold, lineHeight: 1 }}>I</span>
            <span style={{ flex: 1, height: 1, background: 'rgba(168,135,77,0.22)' }} />
            <span style={{ fontFamily: F.ui, fontSize: 10, fontWeight: 500, letterSpacing: '0.24em', textTransform: 'uppercase', color: C.dim }}>Rumah Kayu · the jackfruit room</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,300px),1fr))', gap: 'clamp(24px,4vw,56px)', alignItems: 'center' }}>
            {/* Plate I: the brazier */}
            <figure data-reveal style={{ margin: 0 }}>
              <div style={{ position: 'relative', aspectRatio: '4/5', border: '1px solid rgba(168,135,77,0.2)', borderRadius: 3, overflow: 'hidden', background: 'linear-gradient(160deg,#2a1d10,#14100b 78%)' }}>
                <div aria-hidden="true" style={{ ...grainCss('0.8', 120), opacity: 0.08 }} />
                <svg viewBox="0 0 320 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
                  <g fill="none" stroke="rgba(196,150,86,0.34)" strokeWidth="1.1">
                    <path d="M-20 70 C 110 60, 220 60, 340 74" />
                    <path d="M-20 116 C 120 104, 230 106, 340 120" />
                    <path d="M-20 168 C 100 150, 210 156, 340 172" />
                    <path d="M-20 220 C 120 206, 220 208, 340 224" />
                    <path d="M-20 276 C 110 262, 220 262, 340 278" />
                  </g>
                  <g fill="none" stroke="rgba(196,150,86,0.22)" strokeWidth="1">
                    <ellipse cx="120" cy="142" rx="20" ry="9" />
                    <ellipse cx="232" cy="250" rx="16" ry="7" />
                  </g>
                </svg>
                {/* ember glow */}
                <div aria-hidden="true" style={{ position: 'absolute', left: '50%', bottom: '16%', transform: 'translateX(-50%)', width: '34%', aspectRatio: '1/1', borderRadius: '50%', background: 'radial-gradient(circle, rgba(228,128,46,0.55), rgba(200,90,30,0.18) 50%, transparent 72%)', animation: 'tjEmber 4s ease-in-out infinite' }} />
                <div style={plateLabel}>Plate I, the brazier</div>
              </div>
              <figcaption style={cap}>Century-old jackfruit boards, and a charcoal fire that is never quite let out.</figcaption>
            </figure>
            {/* prose column */}
            <div data-reveal>
              <h2 style={{ fontFamily: F.display, fontWeight: 400, fontSize: 'clamp(28px,4vw,44px)', lineHeight: 1.08, color: C.cream, margin: '0 0 20px' }}>
                Dark as the inside of a drum
              </h2>
              <p style={pBody}>
                You step down into it, out of the glare, and your eyes take a minute. The whole room is built of <em style={{ fontStyle: 'italic', color: C.ink }}>nangka</em>, jackfruit wood, reclaimed from a house older than anyone remembers, oiled to the colour of dark honey. It drinks the light. A charcoal brazier breathes in the corner; the air tastes faintly of smoke and resin.
              </p>
              <p style={{ ...pBody, margin: 0 }}>
                A single ancient bonsai keeps watch by the door, a knuckled little pine, older than the brewer. He sits on the floor and pours without speaking, an hour to a session, and somehow you do not think to check your phone even once.
              </p>
            </div>
          </div>
        </section>

        {/* ── ROOM II ───────────────────────────────────────────────────── */}
        <section style={{ maxWidth: 1180, margin: '0 auto', padding: 'clamp(40px,6vw,80px) clamp(20px,5vw,40px) clamp(20px,4vw,40px)' }}>
          <div data-reveal style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 'clamp(28px,4vw,44px)' }}>
            <span style={{ fontFamily: F.display, fontStyle: 'italic', fontSize: 30, color: C.gold, lineHeight: 1 }}>II</span>
            <span style={{ flex: 1, height: 1, background: 'rgba(168,135,77,0.22)' }} />
            <span style={{ fontFamily: F.ui, fontSize: 10, fontWeight: 500, letterSpacing: '0.24em', textTransform: 'uppercase', color: C.dim }}>Taman · the garden room</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,300px),1fr))', gap: 'clamp(24px,4vw,56px)', alignItems: 'center' }}>
            {/* prose column, order:2 on desktop so figure is left */}
            <div data-reveal style={{ order: 2 }}>
              <h2 style={{ fontFamily: F.display, fontWeight: 400, fontSize: 'clamp(28px,4vw,44px)', lineHeight: 1.08, color: C.cream, margin: '0 0 20px' }}>
                Open to the sky
              </h2>
              <p style={pBody}>
                A valley away, the second room has barely any walls at all. Tea is served on a weathered teak platform set into a courtyard of <em style={{ fontStyle: 'italic', color: C.ink }}>penjing</em>, bonsai arranged on volcanic stone, a thread of water running between them. Frangipani drops its flowers onto the boards. The light is green and moving; the kettle sits on a little clay stove.
              </p>
              <p style={{ ...pBody, margin: 0 }}>
                Here slowness is social, not solemn. People murmur. A gamelan practises somewhere down the hill. The tea is lighter, greens and whites that suit the daylight, and you stay for hours without deciding to.
              </p>
            </div>
            {/* Plate II: penjing on stone */}
            <figure data-reveal style={{ margin: 0, order: 1 }}>
              <div style={{ position: 'relative', aspectRatio: '4/5', border: '1px solid rgba(168,135,77,0.2)', borderRadius: 3, overflow: 'hidden', background: 'linear-gradient(160deg,#1f261c,#14100b 80%)' }}>
                <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 60% 44% at 50% 26%, rgba(150,180,140,0.22), transparent 62%)' }} />
                <svg viewBox="0 0 320 400" preserveAspectRatio="xMidYMid meet" aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
                  <g fill="none" stroke="rgba(150,180,140,0.5)" strokeWidth="1.4" strokeLinecap="round">
                    <path d="M160 250 C 152 210, 150 184, 168 150 C 176 134, 174 120, 160 108" />
                    <path d="M160 196 C 176 188, 196 188, 210 176" />
                    <path d="M160 168 C 144 162, 126 164, 114 152" />
                  </g>
                  <g fill="none" stroke="rgba(150,180,140,0.4)" strokeWidth="1.2">
                    <ellipse cx="150" cy="104" rx="40" ry="20" />
                    <ellipse cx="196" cy="150" rx="30" ry="15" />
                    <ellipse cx="116" cy="140" rx="26" ry="13" />
                  </g>
                  <g fill="none" stroke="rgba(168,135,77,0.4)" strokeWidth="1.2">
                    <path d="M108 256 L212 256 L204 286 L116 286 Z" />
                    <line x1="100" y1="256" x2="220" y2="256" />
                  </g>
                  <g fill="none" stroke="rgba(150,180,180,0.3)" strokeWidth="1">
                    <path d="M70 320 C 130 312, 190 312, 250 320" />
                    <path d="M60 344 C 130 336, 200 336, 260 344" />
                  </g>
                </svg>
                <div style={plateLabel}>Plate II, penjing on stone</div>
              </div>
              <figcaption style={cap}>A courtyard of bonsai and volcanic rock, with water threaded between.</figcaption>
            </figure>
          </div>
        </section>

        {/* ── THE INVENTORY (diptych) ───────────────────────────────────── */}
        <section data-reveal style={{ maxWidth: 1040, margin: '0 auto', padding: 'clamp(40px,6vw,80px) 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 'clamp(28px,4vw,40px)' }}>
            <span style={{ fontFamily: F.display, fontStyle: 'italic', fontSize: 30, color: C.gold, lineHeight: 1 }}>¶</span>
            <span style={{ flex: 1, height: 1, background: 'rgba(168,135,77,0.22)' }} />
            <span style={{ fontFamily: F.ui, fontSize: 10, fontWeight: 500, letterSpacing: '0.24em', textTransform: 'uppercase', color: C.dim }}>The two rooms, side by side</span>
          </div>
          <div style={{ border: '1px solid rgba(168,135,77,0.18)', borderRadius: 4, background: 'linear-gradient(160deg,#1d1810,#15110b)', overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '0.7fr 1.15fr 1.15fr' }}>
              {/* header row */}
              <div style={{ padding: 'clamp(18px,2.4vw,18px) clamp(14px,2.4vw,24px)', borderBottom: '1px solid rgba(168,135,77,0.16)' }} />
              <div style={{ padding: 'clamp(18px,2.4vw,18px) clamp(14px,2.4vw,24px)', borderBottom: '1px solid rgba(168,135,77,0.16)', borderLeft: '1px solid rgba(168,135,77,0.1)' }}>
                <div style={{ fontFamily: F.display, fontSize: 21, color: C.cream }}>Rumah Kayu</div>
                <div style={{ fontFamily: F.ui, fontSize: 9, fontWeight: 500, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.dim, marginTop: 4 }}>The jackfruit room</div>
              </div>
              <div style={{ padding: 'clamp(18px,2.4vw,18px) clamp(14px,2.4vw,24px)', borderBottom: '1px solid rgba(168,135,77,0.16)', borderLeft: '1px solid rgba(168,135,77,0.1)' }}>
                <div style={{ fontFamily: F.display, fontSize: 21, color: C.cream }}>Taman</div>
                <div style={{ fontFamily: F.ui, fontSize: 9, fontWeight: 500, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.dim, marginTop: 4 }}>The garden room</div>
              </div>
              {/* Wood row */}
              <div style={{ display: 'contents' }}>
                <div style={{ padding: '16px clamp(14px,2.4vw,24px)', fontFamily: F.ui, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.gold, alignSelf: 'center', borderBottom: '1px solid rgba(168,135,77,0.08)' }}>Wood</div>
                <div style={{ padding: '16px clamp(14px,2.4vw,24px)', fontFamily: F.body, fontSize: 15, color: C.taupe, borderLeft: '1px solid rgba(168,135,77,0.1)', borderBottom: '1px solid rgba(168,135,77,0.08)' }}>Ancient jackfruit, oiled dark gold</div>
                <div style={{ padding: '16px clamp(14px,2.4vw,24px)', fontFamily: F.body, fontSize: 15, color: C.taupe, borderLeft: '1px solid rgba(168,135,77,0.1)', borderBottom: '1px solid rgba(168,135,77,0.08)' }}>Weathered teak &amp; grey bamboo</div>
              </div>
              {/* Fire row */}
              <div style={{ display: 'contents' }}>
                <div style={{ padding: '16px clamp(14px,2.4vw,24px)', fontFamily: F.ui, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.gold, alignSelf: 'center', borderBottom: '1px solid rgba(168,135,77,0.08)' }}>Fire</div>
                <div style={{ padding: '16px clamp(14px,2.4vw,24px)', fontFamily: F.body, fontSize: 15, color: C.taupe, borderLeft: '1px solid rgba(168,135,77,0.1)', borderBottom: '1px solid rgba(168,135,77,0.08)' }}>Charcoal brazier, always lit</div>
                <div style={{ padding: '16px clamp(14px,2.4vw,24px)', fontFamily: F.body, fontSize: 15, color: C.taupe, borderLeft: '1px solid rgba(168,135,77,0.1)', borderBottom: '1px solid rgba(168,135,77,0.08)' }}>A clay stove, lit at dusk</div>
              </div>
              {/* Green row */}
              <div style={{ display: 'contents' }}>
                <div style={{ padding: '16px clamp(14px,2.4vw,24px)', fontFamily: F.ui, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.gold, alignSelf: 'center', borderBottom: '1px solid rgba(168,135,77,0.08)' }}>Green</div>
                <div style={{ padding: '16px clamp(14px,2.4vw,24px)', fontFamily: F.body, fontSize: 15, color: C.taupe, borderLeft: '1px solid rgba(168,135,77,0.1)', borderBottom: '1px solid rgba(168,135,77,0.08)' }}>One ancient bonsai, by the door</div>
                <div style={{ padding: '16px clamp(14px,2.4vw,24px)', fontFamily: F.body, fontSize: 15, color: C.taupe, borderLeft: '1px solid rgba(168,135,77,0.1)', borderBottom: '1px solid rgba(168,135,77,0.08)' }}>A whole courtyard of penjing</div>
              </div>
              {/* Light row */}
              <div style={{ display: 'contents' }}>
                <div style={{ padding: '16px clamp(14px,2.4vw,24px)', fontFamily: F.ui, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.gold, alignSelf: 'center', borderBottom: '1px solid rgba(168,135,77,0.08)' }}>Light</div>
                <div style={{ padding: '16px clamp(14px,2.4vw,24px)', fontFamily: F.body, fontSize: 15, color: C.taupe, borderLeft: '1px solid rgba(168,135,77,0.1)', borderBottom: '1px solid rgba(168,135,77,0.08)' }}>Low, amber, almost none</div>
                <div style={{ padding: '16px clamp(14px,2.4vw,24px)', fontFamily: F.body, fontSize: 15, color: C.taupe, borderLeft: '1px solid rgba(168,135,77,0.1)', borderBottom: '1px solid rgba(168,135,77,0.08)' }}>Open-air, green and moving</div>
              </div>
              {/* Pace row */}
              <div style={{ display: 'contents' }}>
                <div style={{ padding: '16px clamp(14px,2.4vw,24px)', fontFamily: F.ui, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.gold, alignSelf: 'center' }}>Pace</div>
                <div style={{ padding: '16px clamp(14px,2.4vw,24px)', fontFamily: F.body, fontSize: 15, color: C.taupe, borderLeft: '1px solid rgba(168,135,77,0.1)' }}>Glacial, an hour to a cup</div>
                <div style={{ padding: '16px clamp(14px,2.4vw,24px)', fontFamily: F.body, fontSize: 15, color: C.taupe, borderLeft: '1px solid rgba(168,135,77,0.1)' }}>Unhurried, but sociable</div>
              </div>
            </div>
          </div>
        </section>

        {/* ── PULL QUOTE ────────────────────────────────────────────────── */}
        <section data-reveal style={{ maxWidth: 900, margin: '0 auto', padding: 'clamp(40px,7vw,90px) 24px', textAlign: 'center' }}>
          <blockquote style={{ fontFamily: F.display, fontStyle: 'italic', fontWeight: 400, fontSize: 'clamp(28px,4.8vw,54px)', lineHeight: 1.18, color: C.cream, margin: '0 auto', maxWidth: 840 }}>
            "One room hides the light; the other gives it away. Both are teaching the same lesson, sit down, and stay."
          </blockquote>
          <div aria-hidden="true" style={{ width: 40, height: 1, background: C.gold, opacity: 0.5, margin: '34px auto 0' }} />
        </section>

        {/* ── CLOSING ───────────────────────────────────────────────────── */}
        <section data-reveal style={{ maxWidth: 680, margin: '0 auto', padding: 'clamp(20px,4vw,40px) 24px clamp(40px,6vw,72px)' }}>
          <p style={{ fontFamily: F.body, fontStyle: 'italic', fontSize: 'clamp(17px,2.1vw,20px)', lineHeight: 1.72, color: C.taupe, margin: 0 }}>
            It was in the dark jackfruit room that a homesick traveller named Mei first tasted tea on purpose, and decided to spend the rest of her life chasing that feeling, eventually carrying it to a converted garage in Melbourne. Two rooms in the Bali hills; one of them, quietly, the beginning of a third. That is how it spreads: one slow hour at a time.
          </p>
          <div style={{ marginTop: 40, fontFamily: F.mono, fontSize: 10, letterSpacing: '0.24em', textTransform: 'uppercase', color: C.dim, lineHeight: 2 }}>
            Pictures &amp; words by Teajia &nbsp;·&nbsp; Field Notes &nbsp;·&nbsp; N°11
          </div>
        </section>

        <MoreFooter links={moreLinks} />
      </article>
    </ImmersiveRoot>
  );
};

export default FieldNotesTwoRoomsBali;
