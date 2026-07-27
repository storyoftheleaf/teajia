/**
 * @color-literals. The Read section is one always-dark editorial surface.
 * Rationale, and the conditions on this exception, in read/immersive.tsx.
 */
/**
 * A Map of Mountains: The Geography of Tea, N°06
 * An interactive terroir atlas of the great tea mountains of China.
 * Ported pixel-faithfully from the Claude Design mockup:
 *   docs/_design-import/tea-article-redesign/Atlas - A Map of Mountains.dc.html
 *
 * Bespoke interactive effects ported verbatim:
 *   1. Pin hover/click/focus → select(), region highlight, dot pulse, label colour
 *   2. Index row hover/click → select(), opacity dimming of non-active rows
 *   3. Parallax pointer-move on the map plate, 4-layer depth with lerped rAF loop
 *   4. tjPulse keyframe, injected locally (not in shared useImmersiveChrome set)
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import {
  C, F, ImmersiveRoot, ImmersiveNav, MoreFooter,
  AccentSwatches,
  useReveals, useReadingProgress, useImmersiveChrome, ACCENTS,
} from './immersive';

// ─── Region data (verbatim from source) ──────────────────────────────────────
interface Region {
  id: string;
  coord: string;
  name: string;
  cn: string;
  area: string;
  teas: string;
  note: string;
  elev: string;
  type: string;
  color: string;
  /** pin left% */
  pl: number;
  /** pin top% */
  pt: number;
  /** label side: 'r' = label right of dot, 'l' = label left of dot */
  ls: 'r' | 'l';
}

const REGIONS: Region[] = [
  { id: 'yunnan',   coord: 'N22.0 · E100.8', name: 'Yunnan',       cn: '云南', area: 'Xishuangbanna & Lincang',  teas: 'Pu\'er, Dian Hong',           note: 'Ancient big-leaf trees, some a thousand years old, on misted southern mountains, the cradle of dark tea.',                                           elev: '1,200–2,000 m',  type: 'Pu\'er / dark',         color: '#8B8C89', pl: 13, pt: 70, ls: 'r' },
  { id: 'mengding', coord: 'N30.1 · E103.3', name: 'Mengding Shan', cn: '蒙顶山', area: 'Sichuan',                 teas: 'Mengding Ganlu, Huangya',     note: 'China\'s oldest cultivated tea mountain, tribute tea to the emperor for more than a thousand years.',                                              elev: '1,000–1,400 m',  type: 'Green & yellow',        color: '#859F85', pl: 19, pt: 37, ls: 'r' },
  { id: 'junshan',  coord: 'N29.4 · E113.0', name: 'Junshan',       cn: '君山',  area: 'Dongting Lake, Hunan',    teas: 'Junshan Yinzhen',             note: 'A single island in a vast lake, source of the rarest yellow tea, needles that stand upright and dance in the glass.',                             elev: '~90 m',           type: 'Yellow tea',            color: '#D4C586', pl: 42, pt: 60, ls: 'r' },
  { id: 'huangshan',coord: 'N30.1 · E118.2', name: 'Huangshan',     cn: '黄山',  area: 'Anhui',                   teas: 'Keemun, Maofeng, Houkui',     note: 'Cloud-wreathed yellow mountains giving both a fine green and Keemun, the red the West built its breakfast on.',                                  elev: '700–1,300 m',    type: 'Red (Keemun)',          color: '#A67B70', pl: 57, pt: 42, ls: 'r' },
  { id: 'westlake', coord: 'N30.2 · E120.1', name: 'West Lake',     cn: '西湖',  area: 'Hangzhou, Zhejiang',      teas: 'Longjing (Dragon Well)',      note: 'Pan-fired by hand against the hot wok until flat as a blade, the most famous green tea in China.',                                                 elev: '50–300 m',       type: 'Green tea',             color: '#859F85', pl: 73, pt: 33, ls: 'l' },
  { id: 'fuding',   coord: 'N27.2 · E120.2', name: 'Fuding',        cn: '福鼎',  area: 'Fujian (coast)',          teas: 'Silver Needle, White Peony',  note: 'Barely made at all, sun-withered and dried. The soft, downy home of white tea, beside the sea.',                                                  elev: '500–800 m',      type: 'White tea',             color: '#D6D3CD', pl: 79, pt: 51, ls: 'l' },
  { id: 'wuyi',     coord: 'N27.7 · E118.0', name: 'Wuyishan',      cn: '武夷山', area: 'Fujian · the cliffs',    teas: 'Da Hong Pao, Rou Gui',        note: 'Bushes rooted in cracked red cliff give yancha its mineral "rock rhyme." This is also where the world\'s first black tea was made.',              elev: '200–600 m',      type: 'Rock oolong',           color: '#C4A484', pl: 62, pt: 60, ls: 'l' },
  { id: 'anxi',     coord: 'N25.1 · E117.7', name: 'Anxi',          cn: '安溪',  area: 'Fujian (south)',          teas: 'Tieguanyin',                  note: 'Home of the "Iron Goddess", oolong rolled into tight jade pellets that open to orchid and cream.',                                                  elev: '300–1,000 m',    type: 'Floral oolong',         color: '#C4A484', pl: 67, pt: 75, ls: 'l' },
  { id: 'alishan',  coord: 'N23.5 · E120.8', name: 'Alishan',       cn: '阿里山', area: 'Taiwan',                  teas: 'High-mountain oolong',        note: 'Grown in the cold and cloud above a thousand metres, buttery, floral, the prize of high-mountain tea.',                                            elev: '1,000–1,700 m',  type: 'High-mountain oolong',  color: '#C4A484', pl: 90, pt: 73, ls: 'l' },
];

// ─── hexA helper (verbatim from source) ──────────────────────────────────────
function hexA(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

// ─── Detail panel content (verbatim from panelHTML) ──────────────────────────
const DetailPanel: React.FC<{ region: Region }> = ({ region: r }) => (
  <>
    <div style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: '0.2em', color: C.gold, marginBottom: 18 }}>{r.coord}</div>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
      <h2 style={{ fontFamily: F.display, fontWeight: 400, fontSize: 'clamp(32px,4vw,46px)', lineHeight: 1, color: '#f3ead9', margin: 0 }}>{r.name}</h2>
      <span style={{ fontFamily: F.cn, fontSize: 24, color: '#cdc0a8' }}>{r.cn}</span>
    </div>
    <div style={{ fontFamily: F.ui, fontSize: 10.5, fontWeight: 500, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.dim, marginTop: 12 }}>{r.area}</div>
    <p style={{ fontFamily: F.body, fontStyle: 'italic', fontSize: 'clamp(15px,1.8vw,17px)', lineHeight: 1.66, color: '#cdc0a8', margin: '22px 0 26px' }}>{r.note}</p>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '13px 0', borderTop: '1px solid rgba(168,135,77,0.12)' }}>
        <span style={{ fontFamily: F.ui, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.dim }}>Signature</span>
        <span style={{ fontFamily: F.body, fontSize: 15, color: '#ede4d4', textAlign: 'right' }}>{r.teas}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '13px 0', borderTop: '1px solid rgba(168,135,77,0.12)' }}>
        <span style={{ fontFamily: F.ui, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.dim }}>Elevation</span>
        <span style={{ fontFamily: F.body, fontSize: 15, color: '#ede4d4', textAlign: 'right' }}>{r.elev}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '13px 0', borderTop: '1px solid rgba(168,135,77,0.12)' }}>
        <span style={{ fontFamily: F.ui, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.dim }}>Family</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{ width: 11, height: 11, borderRadius: '50%', background: r.color }} />
          <span style={{ fontFamily: F.body, fontSize: 15, color: '#ede4d4' }}>{r.type}</span>
        </span>
      </div>
    </div>
  </>
);

// ─── More links ───────────────────────────────────────────────────────────────
const moreLinks = [
  { to: '/read/history',     kicker: 'History · N°07',       title: 'Ten Thousand Mornings',   blurb: 'Five thousand years of tea, along one line.' },
  { to: '/read/ritual',      kicker: 'The Ritual · N°05',    title: 'Seven Steeps',             blurb: 'The same leaves, brewed seven ways.' },
  { to: '/read/leaf-to-liquor', kicker: 'The Craft of Tea · N°01', title: 'From Leaf to Liquor', blurb: 'How a single leaf becomes the six colours of tea.' },
];

// ─── Component ────────────────────────────────────────────────────────────────
const AtlasMapOfMountains: React.FC = () => {
  const [accent, setAccent] = useState<string>(ACCENTS[0]);
  useImmersiveChrome(accent);
  const rootRef = useReveals([]);
  const progress = useReadingProgress();

  // Active region state, drives pin highlight + panel + index dimming
  const [activeId, setActiveId] = useState<string>('wuyi');
  const activeRegion = REGIONS.find(r => r.id === activeId) ?? REGIONS[6]; // wuyi default

  // Whether the hint has been dismissed (first selection hides it)
  const [hintVisible, setHintVisible] = useState(true);

  // select(), mirrors source exactly: sets active id, hides hint
  const select = useCallback((id: string) => {
    setActiveId(id);
    setHintVisible(false);
  }, []);

  // ── Parallax rAF loop (verbatim from setupParallax) ────────────────────────
  // Nodes grabbed by SVG group id via refs
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapcharRef = useRef<SVGGElement | null>(null);
  const topo2Ref = useRef<SVGGElement | null>(null);
  const topoRef = useRef<SVGGElement | null>(null);
  const gridRef = useRef<SVGGElement | null>(null);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    // Skip parallax on touch/coarse-pointer devices (verbatim condition)
    if (window.matchMedia && window.matchMedia('(pointer:coarse)').matches) return;

    const layers = [
      { el: mapcharRef.current, f: 26 },
      { el: topo2Ref.current,   f: 18 },
      { el: topoRef.current,    f: 11 },
      { el: gridRef.current,    f: 5  },
    ];

    // lerp state, verbatim variable names and constants
    let tx = 0, ty = 0, cx = 0, cy = 0;
    let raf: number | null = null;

    const apply = () => {
      cx += (tx - cx) * 0.12;
      cy += (ty - cy) * 0.12;
      layers.forEach(l => {
        if (l.el) l.el.setAttribute('transform', `translate(${(cx * l.f).toFixed(2)} ${(cy * l.f).toFixed(2)})`);
      });
      if (Math.abs(tx - cx) > 0.001 || Math.abs(ty - cy) > 0.001) {
        raf = requestAnimationFrame(apply);
      } else {
        raf = null;
      }
    };

    const kick = () => { if (!raf) raf = requestAnimationFrame(apply); };

    const onPointerMove = (e: PointerEvent) => {
      const r = map.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width  - 0.5) * 2;
      ty = ((e.clientY - r.top)  / r.height - 0.5) * 2;
      kick();
    };

    const onPointerLeave = () => { tx = 0; ty = 0; kick(); };

    map.addEventListener('pointermove',  onPointerMove);
    map.addEventListener('pointerleave', onPointerLeave);

    return () => {
      map.removeEventListener('pointermove',  onPointerMove);
      map.removeEventListener('pointerleave', onPointerLeave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // ── Inject tjPulse keyframe (not in shared useImmersiveChrome set) ──────────
  useEffect(() => {
    const style = document.createElement('style');
    style.setAttribute('data-tj-atlas-pulse', '');
    style.textContent = `
      @keyframes tjPulse {
        0%   { box-shadow: 0 0 0 0   rgba(168,135,77,0.5); }
        70%  { box-shadow: 0 0 0 13px rgba(168,135,77,0); }
        100% { box-shadow: 0 0 0 0   rgba(168,135,77,0); }
      }
    `;
    document.head.appendChild(style);
    return () => { style.remove(); };
  }, []);

  return (
    <ImmersiveRoot rootRef={rootRef}>
      <Helmet><title>A Map of Mountains · Teajia</title></Helmet>
      <ImmersiveNav eyebrow="Geography · N°06" progress={progress} />
      <AccentSwatches accent={accent} setAccent={setAccent} />

      <article style={{ position: 'relative', zIndex: 1 }}>

        {/* ── COVER ──────────────────────────────────────────────────────────── */}
        <header style={{ position: 'relative', minHeight: '78vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 'clamp(40px,8vw,90px) 24px clamp(30px,5vw,60px)', overflow: 'hidden' }}>
          <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 72% 56% at 50% 32%, rgba(168,135,77,0.12), transparent 62%)' }} />
          <div aria-hidden="true" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-54%)', fontFamily: F.cn, fontWeight: 200, fontSize: 'min(54vw,520px)', lineHeight: 1, color: 'rgba(168,135,77,0.05)', pointerEvents: 'none', userSelect: 'none' }}>山</div>
          <div style={{ position: 'relative', maxWidth: 820 }}>
            <div style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: '0.42em', textTransform: 'uppercase', color: C.gold, marginBottom: 28 }}>
              The Geography of Tea &nbsp;·&nbsp; N°06
            </div>
            <h1 style={{ fontFamily: F.display, fontWeight: 400, fontSize: 'clamp(46px,9vw,108px)', lineHeight: 0.98, letterSpacing: '-0.015em', color: '#f3ead9', margin: 0 }}>
              A Map of <span style={{ fontStyle: 'italic', color: C.gold }}>Mountains</span>
            </h1>
            <div aria-hidden="true" style={{ width: 54, height: 1, background: C.gold, opacity: 0.6, margin: '30px auto' }} />
            <p style={{ fontFamily: F.body, fontStyle: 'italic', fontWeight: 400, fontSize: 'clamp(16px,2.3vw,21px)', lineHeight: 1.5, color: '#cdc0a8', margin: '0 auto', maxWidth: 560 }}>
              Half of what a tea is, it owes to a place. An atlas of the mountains that make the great teas of China, trace a peak to taste it.
            </p>
          </div>
        </header>

        {/* ── STANDFIRST ─────────────────────────────────────────────────────── */}
        <section data-reveal style={{ maxWidth: 680, margin: '0 auto', padding: 'clamp(36px,6vw,72px) 24px clamp(28px,5vw,52px)' }}>
          <p style={{ fontFamily: F.body, fontSize: 'clamp(18px,2.2vw,22px)', lineHeight: 1.74, color: '#ede4d4', margin: 0 }}>
            <span style={{ float: 'left', fontFamily: F.display, fontWeight: 600, fontSize: '5em', lineHeight: 0.78, color: C.gold, margin: '8px 16px -4px 0' }}>T</span>
            he French call it <em style={{ fontStyle: 'italic', color: '#f3ead9' }}>terroir</em>; the Chinese have known it far longer. Altitude, mist, the mineral in the rock, the angle of the morning sun, a tea drinks all of it in before a single leaf is plucked. Move a famous bush a hundred miles and it makes a stranger. Here are the places that cannot be moved.
          </p>
        </section>

        {/* ── THE ATLAS (interactive map + detail panel) ─────────────────────── */}
        <section style={{ maxWidth: 1240, margin: '0 auto', padding: 'clamp(10px,3vw,28px) clamp(16px,4vw,40px) clamp(30px,5vw,56px)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'clamp(18px,3vw,36px)', alignItems: 'stretch' }}>

            {/* ── MAP PLATE ────────────────────────────────────────────────── */}
            <div
              ref={mapRef}
              style={{ position: 'relative', flex: '1 1 460px', minWidth: 300, aspectRatio: '3/2', border: '1px solid rgba(168,135,77,0.22)', borderRadius: 4, overflow: 'hidden', background: 'linear-gradient(155deg,#1b1812 0%,#14100b 76%)', cursor: 'crosshair' }}
            >
              <svg viewBox="0 0 1000 680" preserveAspectRatio="xMidYMid slice" aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
                {/* parallax layer 0, deepest, factor 26 */}
                <g ref={mapcharRef}>
                  <text x="500" y="430" textAnchor="middle" fontFamily="'Noto Serif SC',serif" fontWeight="200" fontSize="440" fill="rgba(168,135,77,0.045)">茶</text>
                </g>
                {/* parallax layer 3, shallowest, factor 5 */}
                <g ref={gridRef} stroke="rgba(168,135,77,0.07)" strokeWidth="1">
                  <line x1="200" y1="-40" x2="200" y2="720"/>
                  <line x1="400" y1="-40" x2="400" y2="720"/>
                  <line x1="600" y1="-40" x2="600" y2="720"/>
                  <line x1="800" y1="-40" x2="800" y2="720"/>
                  <line x1="-40" y1="170" x2="1040" y2="170"/>
                  <line x1="-40" y1="340" x2="1040" y2="340"/>
                  <line x1="-40" y1="510" x2="1040" y2="510"/>
                </g>
                {/* parallax layer 2, factor 11 */}
                <g ref={topoRef} fill="none" stroke="rgba(168,135,77,0.16)" strokeWidth="1.2" strokeLinecap="round">
                  <path d="M-60 250 C 220 200, 470 214, 760 178 C 880 164, 980 158, 1060 150"/>
                  <path d="M-60 300 C 200 250, 480 266, 770 228 C 900 212, 1000 206, 1060 198"/>
                  <path d="M-60 356 C 220 302, 500 320, 780 284 C 910 268, 1000 262, 1060 256" stroke="rgba(168,135,77,0.12)"/>
                  <path d="M-60 430 C 240 372, 520 392, 800 352 C 930 334, 1010 330, 1060 326"/>
                  <path d="M-60 498 C 220 442, 520 462, 810 420 C 940 402, 1010 398, 1060 394" stroke="rgba(168,135,77,0.12)"/>
                  <path d="M-60 566 C 240 510, 540 530, 820 490 C 950 472, 1020 468, 1060 464"/>
                  <path d="M-60 628 C 240 576, 540 596, 830 556 C 960 540, 1020 536, 1060 532" stroke="rgba(168,135,77,0.1)"/>
                </g>
                {/* parallax layer 1, factor 18 */}
                <g ref={topo2Ref} fill="none" stroke="rgba(150,180,180,0.1)" strokeWidth="1">
                  <path d="M560 360 C 600 330, 700 332, 760 372 C 720 408, 600 408, 560 360 Z"/>
                  <path d="M580 366 C 612 344, 690 346, 736 376 C 704 402, 612 402, 580 366 Z"/>
                  <path d="M120 470 C 160 446, 250 448, 300 484 C 262 516, 158 516, 120 470 Z"/>
                </g>
              </svg>

              {/* compass */}
              <div aria-hidden="true" style={{ position: 'absolute', top: 'clamp(12px,2.4vw,22px)', right: 'clamp(12px,2.4vw,22px)', width: 'clamp(44px,7vw,64px)', height: 'clamp(44px,7vw,64px)', opacity: 0.7 }}>
                <svg viewBox="0 0 64 64" style={{ width: '100%', height: '100%' }}>
                  <g fill="none" stroke="rgba(168,135,77,0.4)" strokeWidth="1">
                    <circle cx="32" cy="32" r="28"/>
                    <circle cx="32" cy="32" r="20" stroke="rgba(168,135,77,0.22)"/>
                  </g>
                  <path d="M32 6 L37 32 L32 30 L27 32 Z" fill="rgba(168,135,77,0.7)"/>
                  <path d="M32 58 L27 32 L32 34 L37 32 Z" fill="rgba(168,135,77,0.3)"/>
                  <text x="32" y="20" textAnchor="middle" fontFamily="'IBM Plex Mono',monospace" fontSize="8" fill="#cdc0a8">N</text>
                </svg>
              </div>

              {/* scale bar */}
              <div aria-hidden="true" style={{ position: 'absolute', left: 'clamp(12px,2.4vw,22px)', bottom: 'clamp(12px,2.4vw,20px)', display: 'flex', flexDirection: 'column', gap: 5 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                  <span style={{ width: 34, height: 4, background: 'rgba(168,135,77,0.5)' }} />
                  <span style={{ width: 34, height: 4, background: 'rgba(168,135,77,0.16)' }} />
                </div>
                <span style={{ fontFamily: F.mono, fontSize: 8.5, letterSpacing: '0.12em', color: C.dim }}>0, 500 km</span>
              </div>

              {/* title cartouche */}
              <div aria-hidden="true" style={{ position: 'absolute', left: 'clamp(12px,2.4vw,22px)', top: 'clamp(12px,2.4vw,18px)', fontFamily: F.mono, fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.dim }}>
                Tea mountains of China, a schematic
              </div>

              {/* ── PINS ─────────────────────────────────────────────────── */}
              <div style={{ position: 'absolute', inset: 0, zIndex: 3 }}>
                {REGIONS.map(r => {
                  const on = r.id === activeId;
                  return (
                    <button
                      key={r.id}
                      aria-label={r.name}
                      onPointerEnter={() => select(r.id)}
                      onClick={() => select(r.id)}
                      onFocus={() => select(r.id)}
                      style={{
                        position: 'absolute',
                        left: `${r.pl}%`,
                        top: `${r.pt}%`,
                        transform: 'translate(-50%,-50%)',
                        background: 'none',
                        border: 'none',
                        padding: 6,
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: r.ls === 'l' ? 'row-reverse' : 'row',
                        alignItems: 'center',
                        gap: 9,
                      }}
                    >
                      {/* dot, mirrors source: scale, background, boxShadow, animation on active */}
                      <span style={{ position: 'relative', width: 13, height: 13, flex: 'none', display: 'block' }}>
                        <span style={{
                          position: 'absolute',
                          inset: 0,
                          borderRadius: '50%',
                          background: on ? C.gold : 'rgba(168,135,77,0.5)',
                          boxShadow: on
                            ? '0 0 0 1px var(--tj-gold,#a8874d), 0 0 12px 2px rgba(168,135,77,0.6)'
                            : '0 0 0 1px rgba(168,135,77,0.4)',
                          transform: on ? 'scale(1.35)' : 'scale(1)',
                          transition: 'transform 320ms, background 320ms',
                          willChange: 'transform',
                          animation: on ? 'tjPulse 2.4s ease-out infinite' : 'none',
                        }} />
                      </span>
                      {/* label */}
                      <span style={{
                        fontFamily: F.ui,
                        fontSize: 10,
                        fontWeight: 500,
                        letterSpacing: '0.12em',
                        textTransform: 'uppercase',
                        color: on ? '#f3ead9' : '#9a8b6f',
                        whiteSpace: 'nowrap',
                        transition: 'color 320ms',
                        textShadow: '0 1px 7px rgba(20,16,11,0.95)',
                      }}>
                        {r.name}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* hover hint, fades out after first selection */}
              <div style={{
                position: 'absolute',
                left: '50%',
                bottom: 'clamp(12px,2.4vw,20px)',
                transform: 'translateX(-50%)',
                fontFamily: F.ui,
                fontSize: 9.5,
                fontWeight: 500,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: C.dim,
                pointerEvents: 'none',
                transition: 'opacity 500ms',
                opacity: hintVisible ? 1 : 0,
              }}>
                Hover or tap a mountain
              </div>
            </div>

            {/* ── DETAIL PANEL ─────────────────────────────────────────────── */}
            <aside style={{ flex: '1 1 300px', minWidth: 280, maxWidth: 420, border: '1px solid rgba(168,135,77,0.18)', borderRadius: 4, background: 'linear-gradient(160deg,#1d1810,#15110b)', padding: 'clamp(24px,3vw,38px)', alignSelf: 'stretch' }}>
              <DetailPanel region={activeRegion} />
            </aside>
          </div>
        </section>

        {/* ── INDEX ──────────────────────────────────────────────────────────── */}
        <section data-reveal style={{ maxWidth: 1180, margin: '0 auto', padding: 'clamp(20px,4vw,44px) clamp(20px,5vw,40px) clamp(40px,6vw,64px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 8 }}>
            <span style={{ fontFamily: F.display, fontStyle: 'italic', fontSize: 30, color: C.gold, lineHeight: 1 }}>§</span>
            <span style={{ flex: 1, height: 1, background: 'rgba(168,135,77,0.22)' }} />
            <span style={{ fontFamily: F.ui, fontSize: 10, fontWeight: 500, letterSpacing: '0.24em', textTransform: 'uppercase', color: C.dim }}>Index of mountains</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,230px),1fr))', gap: '0 clamp(20px,3vw,40px)' }}>
            {REGIONS.map(r => {
              const on = r.id === activeId;
              return (
                <button
                  key={r.id}
                  onPointerEnter={() => select(r.id)}
                  onClick={() => select(r.id)}
                  style={{
                    textAlign: 'left',
                    background: 'none',
                    border: 'none',
                    borderTop: '1px solid rgba(168,135,77,0.14)',
                    cursor: 'pointer',
                    padding: '17px 2px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 13,
                    transition: 'opacity 240ms',
                    width: '100%',
                    opacity: on ? 1 : 0.5,
                  }}
                >
                  <span style={{ width: 11, height: 11, borderRadius: '50%', background: r.color, marginTop: 5, flex: 'none', boxShadow: `0 0 0 3px ${hexA(r.color, 0.12)}` }} />
                  <span style={{ minWidth: 0 }}>
                    <span style={{ fontFamily: F.display, fontSize: 21, color: '#ede4d4' }}>{r.name}</span>
                    <span style={{ fontFamily: F.cn, fontSize: 14, color: C.dim, marginLeft: 7 }}>{r.cn}</span>
                    <div style={{ fontFamily: F.ui, fontSize: 9.5, fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.dim, marginTop: 5 }}>{r.type}</div>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* ── PULL QUOTE ─────────────────────────────────────────────────────── */}
        <section data-reveal style={{ maxWidth: 900, margin: '0 auto', padding: 'clamp(50px,8vw,104px) 24px', textAlign: 'center' }}>
          <blockquote style={{ fontFamily: F.display, fontStyle: 'italic', fontWeight: 400, fontSize: 'clamp(28px,4.8vw,54px)', lineHeight: 1.18, color: '#f3ead9', margin: '0 auto', maxWidth: 860 }}>
            "A tea carries its mountain the way a wine carries its hill, you are not drinking a leaf, but a place."
          </blockquote>
          <div aria-hidden="true" style={{ width: 40, height: 1, background: C.gold, opacity: 0.5, margin: '34px auto 0' }} />
        </section>

        {/* ── WHAT THE MOUNTAIN GIVES ────────────────────────────────────────── */}
        <section style={{ maxWidth: 1040, margin: '0 auto', padding: 'clamp(20px,4vw,40px) 24px clamp(40px,6vw,72px)' }}>
          <div data-reveal style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 34 }}>
            <span style={{ fontFamily: F.display, fontStyle: 'italic', fontSize: 30, color: C.gold, lineHeight: 1 }}>∞</span>
            <span style={{ flex: 1, height: 1, background: 'rgba(168,135,77,0.22)' }} />
            <span style={{ fontFamily: F.ui, fontSize: 10, fontWeight: 500, letterSpacing: '0.24em', textTransform: 'uppercase', color: C.dim }}>What the mountain gives</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,300px),1fr))', gap: 'clamp(28px,5vw,56px)', alignItems: 'center' }}>
            <div data-reveal>
              <p style={{ fontFamily: F.body, fontSize: 'clamp(16px,2vw,18px)', lineHeight: 1.8, color: '#cdc0a8', margin: '0 0 18px' }}>
                Height buys a tea its slowness. Up in the cold and cloud, the leaf grows lazily, packing sugars and aromatics into a small, dense bud instead of racing to size. The mist that pools in mountain valleys filters the sun, sparing the leaf its harsher, more bitter compounds.
              </p>
              <p style={{ fontFamily: F.body, fontSize: 'clamp(16px,2vw,18px)', lineHeight: 1.8, color: '#cdc0a8', margin: 0 }}>
                And the rock itself speaks. Iron, quartz, weathered stone, the root takes up the mountain's minerals and hands them, transformed, to your cup. This is why two gardens an hour apart can taste like different countries.
              </p>
            </div>
            <figure data-reveal style={{ margin: 0, border: '1px solid rgba(168,135,77,0.18)', borderRadius: 4, background: 'linear-gradient(160deg,#1d1810,#15110b)', padding: 'clamp(22px,3vw,32px)' }}>
              <div style={{ fontFamily: F.ui, fontSize: 10, fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.gold, marginBottom: 22 }}>By altitude</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
                  <span style={{ fontFamily: F.mono, fontSize: 11, color: C.gold, width: 78, flex: 'none' }}>1500m+</span>
                  <span style={{ flex: 1, height: 1, background: 'rgba(168,135,77,0.16)' }} />
                  <span style={{ fontFamily: F.body, fontSize: 14, color: '#ede4d4' }}>Floral, delicate, slow</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
                  <span style={{ fontFamily: F.mono, fontSize: 11, color: C.gold, width: 78, flex: 'none' }}>800m</span>
                  <span style={{ flex: 1, height: 1, background: 'rgba(168,135,77,0.16)' }} />
                  <span style={{ fontFamily: F.body, fontSize: 14, color: '#ede4d4' }}>Balanced &amp; aromatic</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
                  <span style={{ fontFamily: F.mono, fontSize: 11, color: C.gold, width: 78, flex: 'none' }}>300m</span>
                  <span style={{ flex: 1, height: 1, background: 'rgba(168,135,77,0.16)' }} />
                  <span style={{ fontFamily: F.body, fontSize: 14, color: '#ede4d4' }}>Full-bodied, brisk</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
                  <span style={{ fontFamily: F.mono, fontSize: 11, color: C.dim, width: 78, flex: 'none' }}>lowland</span>
                  <span style={{ flex: 1, height: 1, background: 'rgba(168,135,77,0.1)' }} />
                  <span style={{ fontFamily: F.body, fontSize: 14, color: C.dim }}>Quick, plain, plentiful</span>
                </div>
              </div>
            </figure>
          </div>
        </section>

        {/* ── CLOSING ────────────────────────────────────────────────────────── */}
        <section data-reveal style={{ maxWidth: 680, margin: '0 auto', padding: 'clamp(20px,4vw,40px) 24px clamp(40px,6vw,72px)' }}>
          <p style={{ fontFamily: F.body, fontStyle: 'italic', fontSize: 'clamp(17px,2.1vw,20px)', lineHeight: 1.72, color: '#cdc0a8', margin: 0 }}>
            A map of tea is really a map of patience, of places remote and high enough that the modern hurry never quite arrived. Drink carefully, and the mountain comes with the cup: the cold, the cloud, the stone. Geography you can taste.
          </p>
          <div style={{ marginTop: 40, fontFamily: F.mono, fontSize: 10, letterSpacing: '0.24em', textTransform: 'uppercase', color: C.dim, lineHeight: 2 }}>
            Words by Teajia &nbsp;·&nbsp; The Geography of Tea &nbsp;·&nbsp; N°06
          </div>
        </section>

        <MoreFooter links={moreLinks} />
      </article>
    </ImmersiveRoot>
  );
};

export default AtlasMapOfMountains;
