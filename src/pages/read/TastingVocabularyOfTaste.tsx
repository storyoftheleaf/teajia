/**
 * @color-literals. The Read section is one always-dark editorial surface.
 * Rationale, and the conditions on this exception, in read/immersive.tsx.
 */
/**
 * The Vocabulary of Taste — The Language of Tea, N°08
 * A radial flavour-wheel + switchable radar chart explorer.
 * Ported pixel-faithfully from the Claude Design mockup.
 *
 * Bespoke effects beyond the shared hooks:
 *   1. FLAVOR WHEEL — SVG built in JSX from the same families[] data + arc math
 *      (sector(), hexA(), 8 segments, gap=0.022, rIn=92, rOut=200, rMid=150)
 *      Wedge selection translates the active segment out along its radial axis.
 *   2. RADAR GRID — static 6-axis hexagonal grid (cx=180,cy=180,R=128)
 *      rendered once in JSX with 4 concentric rings + spokes + axis labels.
 *   3. RADAR POLYGON — re-drawn on tea-switch via useState + eased animation
 *      (cubic ease-out, 600ms, requestAnimationFrame). Same radarPoints() math.
 *   4. TEA SWITCHER — three buttons; clicking calls selectTea() → animateRadar().
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import {
  C, F, ImmersiveRoot, ImmersiveNav, AccentSwatches, MoreFooter,
  useReveals, useReadingProgress, useImmersiveChrome, ACCENTS,
} from './immersive';

// ─── Data ────────────────────────────────────────────────────────────────────

interface Family {
  id: string;
  en: string;
  cn: string;
  color: string;
  desc: string;
  teas: string;
  notes: string[];
}

interface TeaProfile {
  name: string;
  cn: string;
  desc: string;
  vals: number[]; // [Floral, Fruity, Sweet, Roasted, Woody, Mineral]
}

const FAMILIES: Family[] = [
  { id: 'floral', en: 'Floral', cn: '花', color: '#c8a6b0', desc: 'High, perfumed top-notes that lift off the cup before you sip.', teas: 'Tieguanyin, Dan Cong, jasmine green', notes: ['Orchid', 'Jasmine', 'Osmanthus', 'Rose', 'Lilac'] },
  { id: 'fruity', en: 'Fruity', cn: '果', color: '#c98f63', desc: 'Sweet, juicy, sometimes jammy — from fresh stone fruit to dried longan.', teas: 'Red teas, ripe oolong, aged white', notes: ['Apricot', 'Peach', 'Lychee', 'Citrus', 'Dried longan'] },
  { id: 'sweet', en: 'Sweet', cn: '甜', color: '#d8b25c', desc: 'The honeyed, sugary register — and the returning sweetness that climbs back up the throat.', teas: 'Honey black, aged white, Dian Hong', notes: ['Honey', 'Caramel', 'Brown sugar', 'Malt', 'Vanilla'] },
  { id: 'roasted', en: 'Roasted', cn: '焙', color: '#a9743f', desc: "Fire’s signature — the toasty, nutty, sometimes smoky notes a charcoal roast leaves behind.", teas: 'Wuyi yancha, roasted oolong, Lapsang', notes: ['Toasted rice', 'Hazelnut', 'Cocoa', 'Charcoal', 'Coffee'] },
  { id: 'woody', en: 'Woody', cn: '木', color: '#8a6a45', desc: 'Deep, dry, resinous — the taste of age, bark and old timber.', teas: "Aged Pu'er, dark tea, old white", notes: ['Aged wood', 'Camphor', 'Cedar', 'Bark', 'Tobacco'] },
  { id: 'mineral', en: 'Mineral', cn: '石', color: '#8f9aa0', desc: 'Stone, salt and rain on rock — the elusive yán yùn, or "rock rhyme."', teas: 'Wuyi rock oolong, high-mountain tea', notes: ['Wet stone', 'Flint', 'Slate', 'Rock', 'Saline'] },
  { id: 'vegetal', en: 'Vegetal', cn: '青', color: '#8a9f6e', desc: 'Green and growing — the fresh, leafy register of an unoxidised tea.', teas: 'Longjing, Maofeng, sencha-style greens', notes: ['Fresh grass', 'Snow pea', 'Spinach', 'Bamboo', 'Artichoke'] },
  { id: 'marine', en: 'Marine', cn: '海', color: '#6f9488', desc: 'Savoury and sea-touched — broth, kelp and a clean umami depth.', teas: 'Shaded greens, gyokuro-style, fresh white', notes: ['Seaweed', 'Nori', 'Broth', 'Chestnut', 'Umami'] },
];

const TEA_PROFILES: Record<string, TeaProfile> = {
  rougui: { name: 'Rou Gui', cn: '肉桂', desc: 'A Wuyi rock oolong: roast and cinnamon up front, orchid behind, and that long mineral "rock rhyme" that defines the cliffs.', vals: [0.5, 0.45, 0.55, 0.82, 0.55, 0.95] },
  silver: { name: 'Silver Needle', cn: '白毫银', desc: 'A Fuding white of pure buds — soft, downy, gently floral and honey-sweet, with almost no fire at all.', vals: [0.82, 0.55, 0.72, 0.08, 0.15, 0.32] },
  puer:   { name: "Aged Pu'er", cn: '老普洱', desc: 'A dark tea rested for years — deep wood and camphor, a round earthy sweetness, the forest after rain.', vals: [0.2, 0.42, 0.66, 0.4, 0.92, 0.6] },
};

const RADAR_AXES = ['Floral', 'Fruity', 'Sweet', 'Roasted', 'Woody', 'Mineral'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Convert a hex colour + alpha to rgba(...) string. */
function hexA(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

/**
 * Build an SVG arc path for one wheel segment (annular sector).
 * Exact port of the controller's sector() — same arg order, same toFixed(2).
 */
function sector(cx: number, cy: number, rIn: number, rOut: number, a0: number, a1: number): string {
  const p = (r: number, a: number): [number, number] => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  const large = (a1 - a0) > Math.PI ? 1 : 0;
  const [x1, y1] = p(rOut, a0), [x2, y2] = p(rOut, a1);
  const [x3, y3] = p(rIn, a1), [x4, y4] = p(rIn, a0);
  return `M${x1.toFixed(2)} ${y1.toFixed(2)} A${rOut} ${rOut} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} L${x3.toFixed(2)} ${y3.toFixed(2)} A${rIn} ${rIn} 0 ${large} 0 ${x4.toFixed(2)} ${y4.toFixed(2)} Z`;
}

/**
 * Compute the 6 polygon vertices for a radar chart from normalised values.
 * Exact port of the controller's radarPoints() — cx=180, cy=180, R=128.
 */
function radarPoints(vals: number[]): [number, number][] {
  const cx = 180, cy = 180, R = 128;
  const ang = (i: number) => -Math.PI / 2 + i * (Math.PI * 2 / 6);
  return vals.map((v, i) => {
    const a = ang(i);
    return [cx + R * v * Math.cos(a), cy + R * v * Math.sin(a)];
  });
}

// ─── Wheel family detail panel ────────────────────────────────────────────────

const FamilyPanel: React.FC<{ family: Family }> = ({ family: f }) => (
  <div>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
      <h2 style={{ fontFamily: F.display, fontWeight: 400, fontSize: 'clamp(30px,4vw,44px)', lineHeight: 1, color: C.cream, margin: 0 }}>{f.en}</h2>
      <span style={{ fontFamily: F.cn, fontSize: 24, color: hexA(f.color, 0.95) }}>{f.cn}</span>
    </div>
    <p style={{ fontFamily: F.body, fontStyle: 'italic', fontSize: 'clamp(15px,1.8vw,17px)', lineHeight: 1.64, color: C.taupe, margin: '18px 0 24px' }}>{f.desc}</p>
    <div style={{ fontFamily: F.ui, fontSize: 10, fontWeight: 500, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.dim, marginBottom: 13 }}>Notes you might find</div>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9, marginBottom: 26 }}>
      {f.notes.map((nt) => (
        <span
          key={nt}
          style={{
            fontFamily: F.body,
            fontSize: 14,
            color: C.ink,
            border: `1px solid ${hexA(f.color, 0.4)}`,
            borderRadius: 40,
            padding: '7px 15px',
            background: hexA(f.color, 0.08),
          }}
        >
          {nt}
        </span>
      ))}
    </div>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, paddingTop: 15, borderTop: '1px solid rgba(168,135,77,0.14)' }}>
      <span style={{ fontFamily: F.ui, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.dim }}>Shows in</span>
      <span style={{ fontFamily: F.body, fontSize: 14.5, color: C.taupe, textAlign: 'right' }}>{f.teas}</span>
    </div>
  </div>
);

// ─── Flavour Wheel ────────────────────────────────────────────────────────────

const FlavorWheel: React.FC<{ activeFam: string; onSelect: (id: string) => void }> = ({ activeFam, onSelect }) => {
  const n = FAMILIES.length;
  const cx = 220, cy = 220, rIn = 92, rOut = 200, rMid = 150;
  const gap = 0.022;
  const step = (Math.PI * 2) / n;

  return (
    <svg viewBox="0 0 440 440" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
      {/* outer ring guide */}
      <circle cx="220" cy="220" r="206" fill="none" stroke="rgba(168,135,77,0.14)" strokeWidth="1" />

      {FAMILIES.map((f, i) => {
        const a0 = -Math.PI / 2 + i * step + gap;
        const a1 = -Math.PI / 2 + (i + 1) * step - gap;
        const am = (a0 + a1) / 2;
        const lx = cx + rMid * Math.cos(am);
        const ly = cy + rMid * Math.sin(am);
        const ox = Math.cos(am);
        const oy = Math.sin(am);
        const isActive = f.id === activeFam;
        const tx = isActive ? (ox * 12).toFixed(1) : '0';
        const ty = isActive ? (oy * 12).toFixed(1) : '0';

        return (
          <g
            key={f.id}
            data-fam={f.id}
            style={{
              cursor: 'pointer',
              transform: `translate(${tx}px,${ty}px)`,
              transition: 'transform 360ms cubic-bezier(0.22,0.61,0.36,1)',
            }}
            onPointerEnter={() => onSelect(f.id)}
            onClick={() => onSelect(f.id)}
          >
            <path
              d={sector(cx, cy, rIn, rOut, a0, a1)}
              fill={hexA(f.color, isActive ? 0.45 : 0.16)}
              stroke={hexA(f.color, isActive ? 0.95 : 0.45)}
              strokeWidth={isActive ? 1.5 : 1}
              style={{ transition: 'fill 360ms, stroke 360ms' }}
            />
            <text
              x={lx.toFixed(1)}
              y={(ly - 4).toFixed(1)}
              textAnchor="middle"
              fontFamily="'Cormorant Garamond',serif"
              fontSize={20}
              fill="#ede4d4"
            >
              {f.en}
            </text>
            <text
              x={lx.toFixed(1)}
              y={(ly + 15).toFixed(1)}
              textAnchor="middle"
              fontFamily="'Noto Serif SC',serif"
              fontSize={13}
              fill={hexA(f.color, 0.95)}
            >
              {f.cn}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

// ─── Radar chart ─────────────────────────────────────────────────────────────

const RadarGrid: React.FC = () => {
  const cx = 180, cy = 180, R = 128;
  const ang = (i: number) => -Math.PI / 2 + i * (Math.PI * 2 / 6);

  // 4 concentric rings
  const rings = [0.25, 0.5, 0.75, 1].map((t) => {
    const pts = RADAR_AXES.map((_, i) => {
      const a = ang(i);
      return `${(cx + R * t * Math.cos(a)).toFixed(1)},${(cy + R * t * Math.sin(a)).toFixed(1)}`;
    }).join(' ');
    return { t, pts };
  });

  return (
    <>
      {rings.map(({ t, pts }) => (
        <polygon key={t} points={pts} fill="none" stroke={`rgba(168,135,77,${t === 1 ? 0.28 : 0.12})`} strokeWidth="1" />
      ))}
      {RADAR_AXES.map((lab, i) => {
        const a = ang(i);
        const x = cx + R * Math.cos(a);
        const y = cy + R * Math.sin(a);
        const lx = cx + (R + 22) * Math.cos(a);
        const ly = cy + (R + 22) * Math.sin(a);
        const anchor = Math.abs(Math.cos(a)) < 0.3 ? 'middle' : (Math.cos(a) > 0 ? 'start' : 'end');
        return (
          <React.Fragment key={lab}>
            <line x1={cx} y1={cy} x2={x.toFixed(1)} y2={y.toFixed(1)} stroke="rgba(168,135,77,0.12)" strokeWidth="1" />
            <text
              x={lx.toFixed(1)}
              y={(ly + 4).toFixed(1)}
              textAnchor={anchor}
              fontFamily="'Plus Jakarta Sans',sans-serif"
              fontSize={10.5}
              letterSpacing="0.1em"
              fill="#80735f"
            >
              {lab.toUpperCase()}
            </text>
          </React.Fragment>
        );
      })}
    </>
  );
};

/**
 * Animated radar polygon.
 * Exact port of animateRadar(): cubic ease-out, 600ms, rAF loop.
 * `activeVals` drives re-animation whenever the tea switches.
 */
const RadarPolygon: React.FC<{ activeVals: number[] }> = ({ activeVals }) => {
  const [currentPts, setCurrentPts] = useState<[number, number][]>(() => radarPoints(activeVals));
  const prevValsRef = useRef<number[]>(activeVals);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const start = prevValsRef.current.slice();
    const target = activeVals;
    const t0 = performance.now();
    const dur = 600;
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);

    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);

    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / dur);
      const e = ease(k);
      const cur = target.map((v, i) => start[i] + (v - start[i]) * e) as number[];
      setCurrentPts(radarPoints(cur));
      if (k < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        prevValsRef.current = target.slice();
      }
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [activeVals]);

  const ptsStr = currentPts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');

  return (
    <>
      <polygon
        points={ptsStr}
        fill={hexA('#a8874d', 0.18)}
        stroke="var(--tj-gold,#a8874d)"
        strokeWidth={1.6}
      />
      {currentPts.map((p, i) => (
        <circle key={i} cx={p[0].toFixed(1)} cy={p[1].toFixed(1)} r={3.2} fill="var(--tj-gold-lt,#c6a667)" />
      ))}
    </>
  );
};

// ─── More links ───────────────────────────────────────────────────────────────

const moreLinks = [
  { to: '/read/ritual', kicker: 'The Ritual · N°05', title: 'Seven Steeps', blurb: 'The same leaves, brewed seven ways.' },
  { to: '/read/atlas', kicker: 'Geography · N°06', title: 'A Map of Mountains', blurb: 'An atlas of where the great teas are born.' },
  { to: '/read/history', kicker: 'History · N°07', title: 'Ten Thousand Mornings', blurb: 'Five thousand years of tea, along one line.' },
];

// ─── Component ───────────────────────────────────────────────────────────────

const TastingVocabularyOfTaste: React.FC = () => {
  const [accent, setAccent] = useState<string>(ACCENTS[0]);
  useImmersiveChrome(accent);
  const rootRef = useReveals([]);
  const progress = useReadingProgress();

  // Wheel state
  const [activeFam, setActiveFam] = useState<string>('floral');
  const [hintVisible, setHintVisible] = useState<boolean>(true);

  const handleSelectFam = useCallback((id: string) => {
    setActiveFam(id);
    setHintVisible(false);
  }, []);

  // Radar state — `activeTea` drives the polygon animation
  const [activeTea, setActiveTea] = useState<string>('rougui');
  const activeProfile = TEA_PROFILES[activeTea];
  const activeFamData = FAMILIES.find((f) => f.id === activeFam)!;

  return (
    <ImmersiveRoot rootRef={rootRef}>
      <Helmet><title>The Vocabulary of Taste · Teajia</title></Helmet>
      <ImmersiveNav eyebrow="Tasting · N°08" progress={progress} />
      <AccentSwatches accent={accent} setAccent={setAccent} />

      <article style={{ position: 'relative', zIndex: 1 }}>

        {/* ── COVER ─────────────────────────────────────────────────────── */}
        <header style={{
          position: 'relative',
          minHeight: '74vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: 'clamp(40px,7vw,84px) 24px clamp(28px,5vw,52px)',
          overflow: 'hidden',
        }}>
          <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 72% 56% at 50% 32%, rgba(168,135,77,0.12), transparent 62%)' }} />
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%,-54%)',
              fontFamily: F.cn,
              fontWeight: 200,
              fontSize: 'min(54vw,520px)',
              lineHeight: 1,
              color: 'rgba(168,135,77,0.05)',
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          >
            味
          </div>
          <div style={{ position: 'relative', maxWidth: 840 }}>
            <div style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: '0.42em', textTransform: 'uppercase', color: C.gold, marginBottom: 28 }}>
              The Language of Tea &nbsp;·&nbsp; N°08
            </div>
            <h1 style={{ fontFamily: F.display, fontWeight: 400, fontSize: 'clamp(42px,8vw,100px)', lineHeight: 0.99, letterSpacing: '-0.015em', color: C.cream, margin: 0 }}>
              The Vocabulary <span style={{ fontStyle: 'italic', color: C.gold }}>of Taste</span>
            </h1>
            <div aria-hidden="true" style={{ width: 54, height: 1, background: C.gold, opacity: 0.6, margin: '30px auto' }} />
            <p style={{ fontFamily: F.body, fontStyle: 'italic', fontWeight: 400, fontSize: 'clamp(16px,2.3vw,21px)', lineHeight: 1.5, color: C.taupe, margin: '0 auto', maxWidth: 560 }}>
              Tea says far more than "tea." A turning wheel of the words tasters reach for — from orchid to wet stone — and how a single cup maps across them.
            </p>
          </div>
        </header>

        {/* ── STANDFIRST ────────────────────────────────────────────────── */}
        <section data-reveal style={{ maxWidth: 680, margin: '0 auto', padding: 'clamp(32px,5vw,60px) 24px clamp(28px,5vw,48px)' }}>
          <p style={{ fontFamily: F.body, fontSize: 'clamp(18px,2.2vw,22px)', lineHeight: 1.74, color: C.ink, margin: 0 }}>
            <span style={{ float: 'left', fontFamily: F.display, fontWeight: 600, fontSize: '5em', lineHeight: 0.78, color: C.gold, margin: '8px 16px -4px 0' }}>T</span>
            he hardest part of tea is not tasting it — it is finding the words. The mouth knows long before the mind can name it. A flavour wheel is a borrowed vocabulary: a way to turn a wordless impression into "orchid," "wet stone," "toasted rice." Turn the wheel below, and let the cup teach you its language.
          </p>
        </section>

        {/* ── THE WHEEL ─────────────────────────────────────────────────── */}
        <section style={{ maxWidth: 1200, margin: '0 auto', padding: 'clamp(10px,3vw,28px) clamp(16px,4vw,40px) clamp(30px,5vw,56px)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'clamp(24px,4vw,56px)', alignItems: 'center', justifyContent: 'center' }}>
            {/* Wheel SVG */}
            <div style={{ position: 'relative', flex: '1 1 360px', minWidth: 300, maxWidth: 540, aspectRatio: '1/1' }}>
              <FlavorWheel activeFam={activeFam} onSelect={handleSelectFam} />
              {/* Hub */}
              <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: '38%', height: '38%', borderRadius: '50%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', pointerEvents: 'none' }}>
                <div style={{ fontFamily: F.cn, fontWeight: 200, fontSize: 'clamp(30px,7vw,52px)', lineHeight: 1, color: activeFamData.color, transition: 'color 360ms' }}>
                  {activeFamData.cn}
                </div>
                <div style={{ fontFamily: F.display, fontSize: 'clamp(18px,3vw,24px)', color: C.cream, marginTop: 6 }}>
                  {activeFamData.en}
                </div>
              </div>
            </div>

            {/* Family detail panel */}
            <aside style={{ flex: '1 1 300px', minWidth: 280, maxWidth: 420 }}>
              <FamilyPanel family={activeFamData} />
            </aside>
          </div>

          {/* Wheel hint */}
          <p style={{
            fontFamily: F.ui,
            fontSize: 9.5,
            fontWeight: 500,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: C.dim,
            textAlign: 'center',
            margin: 'clamp(20px,3vw,32px) 0 0',
            opacity: hintVisible ? 1 : 0,
            transition: 'opacity 500ms',
          }}>
            Hover or tap a petal of the wheel
          </p>
        </section>

        {/* ── PULL QUOTE ────────────────────────────────────────────────── */}
        <section data-reveal style={{ maxWidth: 900, margin: '0 auto', padding: 'clamp(50px,8vw,104px) 24px', textAlign: 'center' }}>
          <blockquote style={{ fontFamily: F.display, fontStyle: 'italic', fontWeight: 400, fontSize: 'clamp(28px,4.8vw,54px)', lineHeight: 1.18, color: C.cream, margin: '0 auto', maxWidth: 860 }}>
            "To name a flavour is to notice it twice — once on the tongue, and once in the mind."
          </blockquote>
          <div aria-hidden="true" style={{ width: 40, height: 1, background: C.gold, opacity: 0.5, margin: '34px auto 0' }} />
        </section>

        {/* ── THE RADAR ─────────────────────────────────────────────────── */}
        <section style={{ maxWidth: 1040, margin: '0 auto', padding: 'clamp(20px,4vw,40px) 24px clamp(40px,6vw,72px)' }}>
          <div data-reveal style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 30 }}>
            {/* ◎ U+25CE BULLSEYE */}
            <span style={{ fontFamily: F.display, fontStyle: 'italic', fontSize: 30, color: C.gold, lineHeight: 1 }}>◎</span>
            <span style={{ flex: 1, height: 1, background: 'rgba(168,135,77,0.22)' }} />
            <span style={{ fontFamily: F.ui, fontSize: 10, fontWeight: 500, letterSpacing: '0.24em', textTransform: 'uppercase', color: C.dim }}>A cup, mapped</span>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'clamp(24px,4vw,56px)', alignItems: 'center' }}>
            {/* Radar SVG */}
            <div style={{ position: 'relative', flex: '1 1 300px', minWidth: 280, maxWidth: 420, aspectRatio: '1/1' }}>
              <svg viewBox="0 0 360 360" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
                <RadarGrid />
                <RadarPolygon activeVals={activeProfile.vals} />
              </svg>
            </div>

            {/* Tea info + switcher */}
            <div style={{ flex: '1 1 280px', minWidth: 260 }}>
              {/* Tab buttons */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
                {Object.entries(TEA_PROFILES).map(([id, profile]) => {
                  const isActive = id === activeTea;
                  return (
                    <button
                      key={id}
                      onClick={() => setActiveTea(id)}
                      style={{
                        background: isActive ? 'var(--tj-gold,#a8874d)' : 'none',
                        border: `1px solid ${isActive ? 'var(--tj-gold,#a8874d)' : 'rgba(168,135,77,0.3)'}`,
                        borderRadius: 40,
                        cursor: 'pointer',
                        padding: '8px 16px',
                        fontFamily: F.ui,
                        fontSize: 10,
                        fontWeight: 500,
                        letterSpacing: '0.12em',
                        textTransform: 'uppercase',
                        color: isActive ? '#14100b' : C.taupe,
                        transition: 'all 240ms',
                      }}
                    >
                      {profile.name}
                    </button>
                  );
                })}
              </div>

              {/* Active tea details */}
              <div style={{ fontFamily: F.cn, fontSize: 22, color: C.taupe, marginBottom: 4 }}>{activeProfile.cn}</div>
              <h3 style={{ fontFamily: F.display, fontWeight: 400, fontSize: 'clamp(26px,3.4vw,38px)', color: C.cream, margin: '0 0 12px' }}>
                {activeProfile.name}
              </h3>
              <p style={{ fontFamily: F.body, fontStyle: 'italic', fontSize: 'clamp(15px,1.8vw,17px)', lineHeight: 1.66, color: C.taupe, margin: 0 }}>
                {activeProfile.desc}
              </p>
            </div>
          </div>
        </section>

        {/* ── CLOSING ───────────────────────────────────────────────────── */}
        <section data-reveal style={{ maxWidth: 680, margin: '0 auto', padding: 'clamp(20px,4vw,40px) 24px clamp(40px,6vw,72px)' }}>
          <p style={{ fontFamily: F.body, fontStyle: 'italic', fontSize: 'clamp(17px,2.1vw,20px)', lineHeight: 1.72, color: C.taupe, margin: 0 }}>
            No two drinkers taste quite the same cup, and no wheel can hold every word. But a shared vocabulary lets us point at the same fleeting thing and say, "there — that." The wheel is only a beginning. The fluency is yours to drink into being.
          </p>
          <div style={{ marginTop: 40, fontFamily: F.mono, fontSize: 10, letterSpacing: '0.24em', textTransform: 'uppercase', color: C.dim, lineHeight: 2 }}>
            Words by Teajia &nbsp;·&nbsp; The Language of Tea &nbsp;·&nbsp; N°08
          </div>
        </section>

        <MoreFooter links={moreLinks} />
      </article>
    </ImmersiveRoot>
  );
};

export default TastingVocabularyOfTaste;
