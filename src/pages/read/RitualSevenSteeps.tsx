/**
 * @color-literals. The Read section is one always-dark editorial surface.
 * Rationale, and the conditions on this exception, in read/immersive.tsx.
 */
/**
 * Seven Steeps: The Ritual of Tea, N°05
 * Gongfu cha scrollytelling: a single handful of leaves brewed again and again.
 * Ported pixel-faithfully from the tea-article-redesign mockup.
 *
 * Bespoke effects carried verbatim from the design's DCLogic controller:
 *   1. Canvas steam animation , requestAnimationFrame particle loop
 *   2. Scroll-pinned cup      , scroll → discrete active steep + card highlight
 *   3. Liquor-colour morph    , continuous lerp between steep colours on scroll
 *   4. Recap strip builder    , innerHTML build of colour swatches + CN numerals
 */
import React, { useEffect, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import {
  C, F, ImmersiveRoot, ImmersiveNav, AccentSwatches, MoreFooter,
  useReveals, useReadingProgress, useImmersiveChrome, ACCENTS,
} from './immersive';

// ─── More links ──────────────────────────────────────────────────────────────
const moreLinks = [
  { to: '/read/atlas',          kicker: 'Geography · N°06',       title: 'A Map of Mountains',        blurb: 'An atlas of where the great teas are born.' },
  { to: '/read/tasting',        kicker: 'Tasting · N°08',         title: 'The Vocabulary of Taste',   blurb: 'A turning wheel of everything a cup can say.' },
  { to: '/read/leaf-to-liquor', kicker: 'The Craft of Tea · N°01',title: 'From Leaf to Liquor',       blurb: 'How a single leaf becomes the six colours of tea.' },
];

// ─── Tea datasets ─────────────────────────────────────────────────────────────
type TeaKey = 'oolong' | 'puer' | 'green';
interface TeaData {
  colors: string[];
  temps: number[];
  times: number[];
  notes: string[];
}
const TEA_SETS: Record<TeaKey, TeaData> = {
  oolong: {
    colors: ['#ead7a0','#e6c873','#ddb95b','#d2a444','#c48f3c','#b67c3c','#a4703f','#8f6741'],
    temps:  [100,95,95,92,92,90,88,85],
    times:  [5,10,12,15,20,30,45,70],
    notes: [
      'A quick rinse to wake the leaf; this first water is poured away.',
      'Aroma at its highest, orchid and warm stone, light on the tongue.',
      'The body arrives; sweetness and texture fill the mouth.',
      'The peak. Everything in balance, this is the cup to share.',
      'Fruit deepens and the rock-rhyme finish lengthens.',
      'Softening now; the edges round into honey over minerals.',
      'Pale and unhurried, the leaf giving up its last brightness.',
      'A long, faint close. Tomorrow these leaves are done.',
    ],
  },
  puer: {
    colors: ['#c98f56','#b9743a','#aa6032','#9c5530','#904d33','#854734','#774230','#6a3c2d'],
    temps:  [100,100,100,98,98,96,95,95],
    times:  [10,12,15,20,25,35,55,90],
    notes: [
      'A double rinse to loosen the compressed leaf and rinse off the years.',
      'Dark and clean, wet earth, old wood, a whisper of camphor.',
      'Thick and round; the soup coats the mouth like broth.',
      'The heart of the session, sweet bark, dates, deep calm.',
      'Settling into pure sweetness; the woodiness recedes.',
      'Soft, warming, almost medicinal in the best sense.',
      'Mellow and clear, the colour of dark amber.',
      'Still giving, an aged cake could run far past seven.',
    ],
  },
  green: {
    colors: ['#e9e6b6','#e3df9b','#dbd884','#d1d06e','#c6cb60','#bdc35a','#b4bb56','#abb253'],
    temps:  [85,80,80,78,78,75,75,72],
    times:  [3,8,10,12,15,20,30,45],
    notes: [
      'Cooler water, a brief rinse, green leaf scorches if you rush it.',
      'Fresh-cut grass and snap peas; bright, vivid, alive.',
      'Sweet corn and chestnut arrive under the green.',
      'Full and smooth, a green tea\'s short, lovely peak.',
      'Vegetal sweetness, clean and quenching.',
      'Gently fading; tender and a little buttery.',
      'Light and sweet, the green nearly spent.',
      'A pale, clean finish, green tea keeps few secrets back.',
    ],
  },
};

const CN_NUMS = ['醒','一','二','三','四','五','六','七'];
const EN_LABELS = ['Rinse','First Infusion','Second Infusion','Third Infusion','Fourth Infusion','Fifth Infusion','Sixth Infusion','Seventh Infusion'];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function hexToRgb(h: string): [number, number, number] {
  const s = h.replace('#', '');
  return [parseInt(s.slice(0,2),16), parseInt(s.slice(2,4),16), parseInt(s.slice(4,6),16)];
}
function lerpHex(a: string, b: string, t: number): string {
  const A = hexToRgb(a), B = hexToRgb(b);
  const c = A.map((v, i) => Math.round(v + (B[i] - v) * t)) as [number,number,number];
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

// ─── Component ────────────────────────────────────────────────────────────────
const RitualSevenSteeps: React.FC = () => {
  const [accent] = useState<string>(ACCENTS[0]);
  useImmersiveChrome(accent);
  const rootRef = useReveals([]);

  // refs for DOM nodes the controller manipulated
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const liquorRef    = useRef<SVGPathElement>(null);
  const steepNumRef  = useRef<HTMLSpanElement>(null);
  const steepLabelRef= useRef<HTMLDivElement>(null);
  const steepMetaRef = useRef<HTMLDivElement>(null);
  const steepNoteRef = useRef<HTMLParagraphElement>(null);
  const recapRef     = useRef<HTMLDivElement>(null);
  const pourRef      = useRef<HTMLElement>(null);
  // mutable state the scroll handler shares with the steam loop
  const steamIntensityRef = useRef<number>(0);
  const activeRef         = useRef<number>(-1);
  const steamRAFRef       = useRef<number>(0);

  // Reading progress, also drives the updatePour on scroll
  const progress = useReadingProgress();

  // ── buildRecap ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const el = recapRef.current;
    if (!el) return;
    const d = TEA_SETS['oolong'];
    el.innerHTML = d.colors.map((color, i) => `
      <div style="flex:1 1 64px; display:flex; flex-direction:column; align-items:center; gap:10px; min-width:60px;">
        <span style="width:clamp(34px,7vw,52px); height:clamp(34px,7vw,52px); border-radius:50%; background:${color}; box-shadow:0 0 0 1px rgba(168,135,77,0.3), inset 0 -6px 12px rgba(0,0,0,0.28), inset 0 5px 9px rgba(255,255,255,0.22);"></span>
        <span style="font-family:'Noto Serif SC',serif; font-size:17px; color:#cdc0a8; line-height:1;">${CN_NUMS[i]}</span>
        <span style="font-family:'IBM Plex Mono',monospace; font-size:9.5px; letter-spacing:0.08em; color:#80735f;">${d.times[i]}s</span>
      </div>`).join('');
  }, []);

  // ── setActive ──────────────────────────────────────────────────────────────
  const setActive = (i: number) => {
    if (activeRef.current === i) return;
    activeRef.current = i;
    const d = TEA_SETS['oolong'];
    if (steepNumRef.current)   steepNumRef.current.textContent   = CN_NUMS[i];
    if (steepLabelRef.current) steepLabelRef.current.textContent = EN_LABELS[i];
    if (steepMetaRef.current)  steepMetaRef.current.textContent  = `${d.times[i]}s · ${d.temps[i]}°C`;
    if (steepNoteRef.current)  steepNoteRef.current.textContent  = d.notes[i];
    const pour = pourRef.current;
    if (!pour) return;
    pour.querySelectorAll<HTMLElement>('[data-steep]').forEach((p) => {
      const card = p.querySelector<HTMLElement>('[data-steep-card]');
      if (!card) return;
      const on = Number(p.getAttribute('data-steep')) === i;
      card.style.opacity     = on ? '1' : '0.4';
      card.style.borderColor = on ? 'var(--tj-gold,#a8874d)' : 'rgba(168,135,77,0.18)';
    });
  };

  // ── updatePour ─────────────────────────────────────────────────────────────
  const updatePour = () => {
    const pour = pourRef.current;
    if (!pour) return;
    const panels = [...pour.querySelectorAll<HTMLElement>('[data-steep]')];
    if (!panels.length) return;
    const d = TEA_SETS['oolong'];
    const vc = window.innerHeight * 0.5;
    const centers = panels.map(p => { const r = p.getBoundingClientRect(); return r.top + r.height / 2; });
    let active = 0, best = Infinity;
    centers.forEach((c, i) => { const dd = Math.abs(c - vc); if (dd < best) { best = dd; active = i; } });
    setActive(active);
    // continuous fraction for colour lerp
    let f = 0;
    if (vc <= centers[0]) f = 0;
    else if (vc >= centers[centers.length - 1]) f = centers.length - 1;
    else {
      for (let i = 0; i < centers.length - 1; i++) {
        if (vc >= centers[i] && vc < centers[i + 1]) {
          f = i + (vc - centers[i]) / (centers[i + 1] - centers[i]);
          break;
        }
      }
    }
    const i0 = Math.floor(f);
    const i1 = Math.min(i0 + 1, d.colors.length - 1);
    const t = f - i0;
    if (liquorRef.current) {
      liquorRef.current.style.fill = lerpHex(d.colors[i0], d.colors[i1], t);
    }
    const temp = d.temps[i0] + (d.temps[i1] - d.temps[i0]) * t;
    steamIntensityRef.current = Math.max(0, Math.min(1, (temp - 72) / 28));
  };

  // ── scroll + resize wiring ──────────────────────────────────────────────────
  useEffect(() => {
    let pourTick = false;
    const onScroll = () => {
      if (pourTick) return;
      pourTick = true;
      requestAnimationFrame(() => { pourTick = false; updatePour(); });
    };
    const onResize = () => {
      const cv = canvasRef.current;
      if (cv) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const r = cv.getBoundingClientRect();
        cv.width  = Math.max(2, Math.round(r.width  * dpr));
        cv.height = Math.max(2, Math.round(r.height * dpr));
      }
      updatePour();
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    updatePour();
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── canvas steam animation ──────────────────────────────────────────────────
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      const r = cv.getBoundingClientRect();
      cv.width  = Math.max(2, Math.round(r.width  * dpr));
      cv.height = Math.max(2, Math.round(r.height * dpr));
    };
    resize();

    interface Particle { x:number; y:number; vy:number; life:number; max:number; sway:number; swr:number; r:number; }
    const parts: Particle[] = [];
    let last = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(40, now - last); last = now;
      ctx.clearRect(0, 0, cv.width, cv.height);
      const intensity = steamIntensityRef.current;
      const W = cv.width, H = cv.height;
      if (intensity > 0.02 && Math.random() < intensity * 0.5) {
        parts.push({
          x:    W * (0.5 + (Math.random() - 0.5) * 0.18),
          y:    H * 0.94,
          vy:   -(0.02 + Math.random() * 0.03) * H / 60,
          life: 0,
          max:  1400 + Math.random() * 1400,
          sway: Math.random() * 6.28,
          swr:  0.0012 + Math.random() * 0.0014,
          r:    (8 + Math.random() * 10) * dpr,
        });
      }
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.life += dt;
        p.y += p.vy * dt;
        p.x += Math.sin(p.life * p.swr + p.sway) * 0.22 * dpr;
        const k = p.life / p.max;
        if (k >= 1) { parts.splice(i, 1); continue; }
        const a   = Math.sin(k * Math.PI) * 0.07 * intensity;
        const rad = p.r * (1 + k * 1.7);
        const g   = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rad);
        g.addColorStop(0, `rgba(245,234,217,${a})`);
        g.addColorStop(1, 'rgba(245,234,217,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, rad, 0, 6.2832);
        ctx.fill();
      }
      steamRAFRef.current = requestAnimationFrame(tick);
    };
    steamRAFRef.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(steamRAFRef.current);
    };
  }, []);

  return (
    <ImmersiveRoot rootRef={rootRef}>
      {/* tjSpin keyframe, not in useImmersiveChrome's set */}
      <style>{`@keyframes tjSpin{ from{ transform:rotate(0deg); } to{ transform:rotate(360deg); } }`}</style>

      <Helmet><title>Seven Steeps · Teajia</title></Helmet>
      <ImmersiveNav eyebrow="The Ritual · N°05" progress={progress} />
      <AccentSwatches accent={accent} setAccent={() => undefined} />

      <article style={{ position: 'relative', zIndex: 1 }}>

        {/* COVER */}
        <header style={{ position: 'relative', minHeight: '90vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 'clamp(40px,8vw,90px) 24px', overflow: 'hidden' }}>
          <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 70% 55% at 50% 30%, rgba(168,135,77,0.13), transparent 62%)' }} />
          <div aria-hidden="true" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-54%)', fontFamily: F.cn, fontWeight: 200, fontSize: 'min(56vw,540px)', lineHeight: 1, color: 'rgba(168,135,77,0.05)', pointerEvents: 'none', userSelect: 'none' }}>沏</div>
          <div style={{ position: 'relative', maxWidth: 760 }}>
            <div style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: '0.42em', textTransform: 'uppercase', color: C.gold, marginBottom: 30 }}>The Ritual of Tea &nbsp;·&nbsp; N°05</div>
            <h1 style={{ fontFamily: F.display, fontWeight: 400, fontSize: 'clamp(54px,11vw,128px)', lineHeight: 0.96, letterSpacing: '-0.015em', color: C.cream, margin: 0 }}>
              Seven <span style={{ fontStyle: 'italic', color: C.gold }}>Steeps</span>
            </h1>
            <div aria-hidden="true" style={{ width: 54, height: 1, background: C.gold, opacity: 0.6, margin: '34px auto' }} />
            <p style={{ fontFamily: F.body, fontStyle: 'italic', fontWeight: 400, fontSize: 'clamp(17px,2.4vw,22px)', lineHeight: 1.5, color: C.taupe, margin: '0 auto', maxWidth: 540 }}>
              A single handful of leaves, brewed again and again in the gongfu way, and how each pour gives you a different tea than the last.
            </p>
          </div>
          <div style={{ position: 'absolute', bottom: 38, left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, animation: 'tjFloat 3.4s ease-in-out infinite' }}>
            <span style={{ fontFamily: F.ui, fontSize: 10, fontWeight: 500, letterSpacing: '0.28em', textTransform: 'uppercase', color: C.dim }}>Scroll to pour</span>
            <svg width="13" height="20" viewBox="0 0 13 20" fill="none">
              <path d="M6.5 1v17M1 12.5l5.5 5.5 5.5-5.5" stroke="#a8874d" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </header>

        {/* STANDFIRST */}
        <section data-reveal style={{ maxWidth: 680, margin: '0 auto', padding: 'clamp(48px,8vw,104px) 24px clamp(20px,4vw,44px)' }}>
          <p style={{ fontFamily: F.body, fontSize: 'clamp(18px,2.2vw,22px)', lineHeight: 1.74, color: C.ink, margin: 0 }}>
            <span style={{ float: 'left', fontFamily: F.display, fontWeight: 600, fontSize: '5em', lineHeight: 0.78, color: C.gold, margin: '8px 16px -4px 0' }}>G</span>
            ongfu cha, "tea made with skill", turns brewing into a conversation. A small pot is packed generously with leaf, then filled and emptied in seconds, over and over. The Western mug asks one long question and accepts one answer. The gongfu table asks the same leaves seven questions, and listens to seven different replies. Pour with us.
          </p>
        </section>

        {/* THE SCROLLYTELLING POUR */}
        <section
          id="tj-pour"
          ref={pourRef as React.RefObject<HTMLElement>}
          style={{ position: 'relative', maxWidth: 1180, margin: '0 auto', padding: 'clamp(20px,4vw,40px) clamp(20px,5vw,40px) clamp(40px,7vw,80px)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,320px),1fr))', gap: 'clamp(20px,5vw,64px)', alignItems: 'start' }}
        >
          {/* pinned visual */}
          <div style={{ position: 'sticky', top: 64, alignSelf: 'start', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 'min(72vh,580px)', padding: '10px 0' }}>
            <div style={{ position: 'relative', width: 'min(78vw,320px)', aspectRatio: '1/1' }}>
              <canvas ref={canvasRef} style={{ position: 'absolute', left: '50%', top: '-6%', transform: 'translateX(-50%)', width: '62%', height: '54%', pointerEvents: 'none' }} />
              <svg viewBox="0 0 300 300" preserveAspectRatio="xMidYMid meet" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
                <defs>
                  <radialGradient id="tj-liq-sheen" cx="40%" cy="24%" r="78%">
                    <stop offset="0%" stopColor="rgba(255,248,225,0.5)" />
                    <stop offset="46%" stopColor="rgba(255,248,225,0)" />
                  </radialGradient>
                </defs>
                <ellipse cx="150" cy="270" rx="78" ry="13" fill="rgba(0,0,0,0.34)" />
                <path
                  ref={liquorRef}
                  d="M64 156 C72 214, 108 244, 150 244 C192 244, 228 214, 236 156 Z"
                  fill="#e6c873"
                  style={{ transition: 'fill 700ms cubic-bezier(0.4,0,0.2,1)' }}
                />
                <path d="M64 156 C72 214, 108 244, 150 244 C192 244, 228 214, 236 156 Z" fill="url(#tj-liq-sheen)" />
                <ellipse cx="150" cy="156" rx="86" ry="14" fill="rgba(255,248,225,0.08)" stroke="rgba(255,248,225,0.30)" strokeWidth="1" />
                <path d="M58 150 C66 216, 106 250, 150 250 C194 250, 234 216, 242 150" fill="none" stroke="var(--tj-gold,#a8874d)" strokeWidth="1.6" strokeLinecap="round" />
                <ellipse cx="150" cy="150" rx="92" ry="18" fill="none" stroke="var(--tj-gold,#a8874d)" strokeWidth="1.6" />
              </svg>
            </div>
            <div style={{ marginTop: 'clamp(14px,3vw,28px)', textAlign: 'center', minHeight: 128 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
                <span ref={steepNumRef} style={{ fontFamily: F.cn, fontWeight: 200, fontSize: 46, lineHeight: 1, color: C.gold, transition: 'color 500ms' }}>醒</span>
                <div style={{ textAlign: 'left' }}>
                  <div ref={steepLabelRef} style={{ fontFamily: F.display, fontSize: 27, color: C.cream, lineHeight: 1 }}>Rinse</div>
                  <div ref={steepMetaRef} style={{ fontFamily: F.mono, fontSize: 10.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: C.dim, marginTop: 7 }}>5s · 100°C</div>
                </div>
              </div>
              <p ref={steepNoteRef} style={{ fontFamily: F.body, fontStyle: 'italic', fontSize: 'clamp(14px,1.7vw,16px)', lineHeight: 1.55, color: C.taupe, margin: '16px auto 0', maxWidth: 340 }}>
                A quick rinse to wake the leaf; this first water is poured away.
              </p>
            </div>
          </div>

          {/* scrolling panels */}
          <div>
            {/* steep 0, starts active */}
            <div data-steep="0" style={{ minHeight: '84vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '8px 0' }}>
              <div data-steep-card style={{ borderLeft: '2px solid var(--tj-gold,#a8874d)', padding: '6px 0 6px 24px', transition: 'opacity 500ms, border-color 500ms' }}>
                <div style={{ fontFamily: F.ui, fontSize: 10, fontWeight: 500, letterSpacing: '0.24em', textTransform: 'uppercase', color: C.dim, marginBottom: 14 }}>醒茶 · The Awakening</div>
                <h2 style={{ fontFamily: F.display, fontWeight: 400, fontSize: 'clamp(28px,4.2vw,42px)', lineHeight: 1.08, color: C.cream, margin: '0 0 18px' }}>First, we wake the leaf</h2>
                <p style={{ fontFamily: F.body, fontSize: 'clamp(16px,2vw,18px)', lineHeight: 1.78, color: C.taupe, margin: 0 }}>Boiling water is poured over the dry leaf and tipped away almost at once. It rinses, it warms the pot and cups, and, most of all, it coaxes tightly-rolled leaves to begin to open. We do not drink this water. We simply let the tea know it is time.</p>
              </div>
            </div>
            {/* steep 1 */}
            <div data-steep="1" style={{ minHeight: '84vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '8px 0' }}>
              <div data-steep-card style={{ borderLeft: '2px solid rgba(168,135,77,0.18)', padding: '6px 0 6px 24px', opacity: 0.4, transition: 'opacity 500ms, border-color 500ms' }}>
                <div style={{ fontFamily: F.ui, fontSize: 10, fontWeight: 500, letterSpacing: '0.24em', textTransform: 'uppercase', color: C.dim, marginBottom: 14 }}>第一泡 · First Infusion</div>
                <h2 style={{ fontFamily: F.display, fontWeight: 400, fontSize: 'clamp(28px,4.2vw,42px)', lineHeight: 1.08, color: C.cream, margin: '0 0 18px' }}>The first true cup</h2>
                <p style={{ fontFamily: F.body, fontSize: 'clamp(16px,2vw,18px)', lineHeight: 1.78, color: C.taupe, margin: 0 }}>Ten seconds, no more. The leaf has barely unclenched, and what it gives is all top-notes, the high, volatile aromatics that will never be this loud again. Light in the mouth, but the nose is already full. Drink it quickly; the second cup is already waiting.</p>
              </div>
            </div>
            {/* steep 2 */}
            <div data-steep="2" style={{ minHeight: '84vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '8px 0' }}>
              <div data-steep-card style={{ borderLeft: '2px solid rgba(168,135,77,0.18)', padding: '6px 0 6px 24px', opacity: 0.4, transition: 'opacity 500ms, border-color 500ms' }}>
                <div style={{ fontFamily: F.ui, fontSize: 10, fontWeight: 500, letterSpacing: '0.24em', textTransform: 'uppercase', color: C.dim, marginBottom: 14 }}>第二泡 · Second Infusion</div>
                <h2 style={{ fontFamily: F.display, fontWeight: 400, fontSize: 'clamp(28px,4.2vw,42px)', lineHeight: 1.08, color: C.cream, margin: '0 0 18px' }}>The body arrives</h2>
                <p style={{ fontFamily: F.body, fontSize: 'clamp(16px,2vw,18px)', lineHeight: 1.78, color: C.taupe, margin: 0 }}>Now the leaf is fully open and the liquor thickens. Texture fills the mouth where before there was only scent; sweetness gathers underneath. The tea stops being a fragrance and becomes a drink. This is where most teas first show you who they are.</p>
              </div>
            </div>
            {/* steep 3 */}
            <div data-steep="3" style={{ minHeight: '84vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '8px 0' }}>
              <div data-steep-card style={{ borderLeft: '2px solid rgba(168,135,77,0.18)', padding: '6px 0 6px 24px', opacity: 0.4, transition: 'opacity 500ms, border-color 500ms' }}>
                <div style={{ fontFamily: F.ui, fontSize: 10, fontWeight: 500, letterSpacing: '0.24em', textTransform: 'uppercase', color: C.dim, marginBottom: 14 }}>第三泡 · Third Infusion</div>
                <h2 style={{ fontFamily: F.display, fontWeight: 400, fontSize: 'clamp(28px,4.2vw,42px)', lineHeight: 1.08, color: C.cream, margin: '0 0 18px' }}>The peak</h2>
                <p style={{ fontFamily: F.body, fontSize: 'clamp(16px,2vw,18px)', lineHeight: 1.78, color: C.taupe, margin: 0 }}>Aroma and body meet in the middle and hold hands. Brewers speak of the third and fourth steeps as the heart of a session, nothing is rushing in, nothing is fading yet. If you are sharing this tea with someone, this is the cup you give them.</p>
              </div>
            </div>
            {/* steep 4, contains <em> */}
            <div data-steep="4" style={{ minHeight: '84vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '8px 0' }}>
              <div data-steep-card style={{ borderLeft: '2px solid rgba(168,135,77,0.18)', padding: '6px 0 6px 24px', opacity: 0.4, transition: 'opacity 500ms, border-color 500ms' }}>
                <div style={{ fontFamily: F.ui, fontSize: 10, fontWeight: 500, letterSpacing: '0.24em', textTransform: 'uppercase', color: C.dim, marginBottom: 14 }}>第四泡 · Fourth Infusion</div>
                <h2 style={{ fontFamily: F.display, fontWeight: 400, fontSize: 'clamp(28px,4.2vw,42px)', lineHeight: 1.08, color: C.cream, margin: '0 0 18px' }}>The finish lengthens</h2>
                <p style={{ fontFamily: F.body, fontSize: 'clamp(16px,2vw,18px)', lineHeight: 1.78, color: C.taupe, margin: 0 }}>We add a few seconds to the steep now, asking the leaf for a little more. The front of the cup quietens, but the <em style={{ fontStyle: 'italic', color: C.ink }}>finish</em> opens out, that long after-taste the Chinese call huí gān, the "returning sweetness" that climbs back up the throat once the cup is empty.</p>
              </div>
            </div>
            {/* steep 5 */}
            <div data-steep="5" style={{ minHeight: '84vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '8px 0' }}>
              <div data-steep-card style={{ borderLeft: '2px solid rgba(168,135,77,0.18)', padding: '6px 0 6px 24px', opacity: 0.4, transition: 'opacity 500ms, border-color 500ms' }}>
                <div style={{ fontFamily: F.ui, fontSize: 10, fontWeight: 500, letterSpacing: '0.24em', textTransform: 'uppercase', color: C.dim, marginBottom: 14 }}>第五泡 · Fifth Infusion</div>
                <h2 style={{ fontFamily: F.display, fontWeight: 400, fontSize: 'clamp(28px,4.2vw,42px)', lineHeight: 1.08, color: C.cream, margin: '0 0 18px' }}>Softening</h2>
                <p style={{ fontFamily: F.body, fontSize: 'clamp(16px,2vw,18px)', lineHeight: 1.78, color: C.taupe, margin: 0 }}>The edges round off. What was bright is now mellow; what was structured is now gentle. A good tea does not fall off a cliff here, it descends a long, easy staircase, giving honey and warm minerals where it once gave fire.</p>
              </div>
            </div>
            {/* steep 6 */}
            <div data-steep="6" style={{ minHeight: '84vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '8px 0' }}>
              <div data-steep-card style={{ borderLeft: '2px solid rgba(168,135,77,0.18)', padding: '6px 0 6px 24px', opacity: 0.4, transition: 'opacity 500ms, border-color 500ms' }}>
                <div style={{ fontFamily: F.ui, fontSize: 10, fontWeight: 500, letterSpacing: '0.24em', textTransform: 'uppercase', color: C.dim, marginBottom: 14 }}>第六泡 · Sixth Infusion</div>
                <h2 style={{ fontFamily: F.display, fontWeight: 400, fontSize: 'clamp(28px,4.2vw,42px)', lineHeight: 1.08, color: C.cream, margin: '0 0 18px' }}>Quiet sweetness</h2>
                <p style={{ fontFamily: F.body, fontSize: 'clamp(16px,2vw,18px)', lineHeight: 1.78, color: C.taupe, margin: 0 }}>We steep longer to draw out what remains. The tea is pale now, and unhurried, and quietly sweet, the kind of cup you drink without talking. The leaf has given almost everything it carried down from the mountain.</p>
              </div>
            </div>
            {/* steep 7 */}
            <div data-steep="7" style={{ minHeight: '88vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '8px 0' }}>
              <div data-steep-card style={{ borderLeft: '2px solid rgba(168,135,77,0.18)', padding: '6px 0 6px 24px', opacity: 0.4, transition: 'opacity 500ms, border-color 500ms' }}>
                <div style={{ fontFamily: F.ui, fontSize: 10, fontWeight: 500, letterSpacing: '0.24em', textTransform: 'uppercase', color: C.dim, marginBottom: 14 }}>第七泡 · Seventh Infusion</div>
                <h2 style={{ fontFamily: F.display, fontWeight: 400, fontSize: 'clamp(28px,4.2vw,42px)', lineHeight: 1.08, color: C.cream, margin: '0 0 18px' }}>A gentle goodbye</h2>
                <p style={{ fontFamily: F.body, fontSize: 'clamp(16px,2vw,18px)', lineHeight: 1.78, color: C.taupe, margin: 0 }}>A minute or more in the water for one last, faint cup, clear, soft, almost a memory of tea. A fine leaf could be pushed further still; we choose to stop here, while the ending is sweet. To know when a tea is finished is its own small skill.</p>
              </div>
            </div>
          </div>
        </section>

        {/* RECAP STRIP */}
        <section data-reveal style={{ maxWidth: 1080, margin: '0 auto', padding: 'clamp(30px,5vw,56px) 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 30 }}>
            <span style={{ fontFamily: F.display, fontStyle: 'italic', fontSize: 30, color: C.gold, lineHeight: 1 }}>ω</span>
            <span style={{ flex: 1, height: 1, background: 'rgba(168,135,77,0.22)' }} />
            <span style={{ fontFamily: F.ui, fontSize: 10, fontWeight: 500, letterSpacing: '0.24em', textTransform: 'uppercase', color: C.dim }}>The session, in colour</span>
          </div>
          <div ref={recapRef} style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 'clamp(10px,2vw,18px)' }} />
          <p style={{ fontFamily: F.body, fontStyle: 'italic', fontSize: 14, lineHeight: 1.6, color: C.dim, margin: '26px 0 0', textAlign: 'center' }}>
            One handful of leaves; eight pours of water; eight different cups. This is the whole argument for brewing tea slowly.
          </p>
        </section>

        {/* PULL QUOTE */}
        <section data-reveal style={{ maxWidth: 900, margin: '0 auto', padding: 'clamp(50px,8vw,104px) 24px', textAlign: 'center' }}>
          <blockquote style={{ fontFamily: F.display, fontStyle: 'italic', fontWeight: 400, fontSize: 'clamp(28px,4.8vw,54px)', lineHeight: 1.18, color: C.cream, margin: '0 auto', maxWidth: 840 }}>
            "A teabag asks one question. A pot asks the same leaves seven, and waits for every answer."
          </blockquote>
          <div aria-hidden="true" style={{ width: 40, height: 1, background: C.gold, opacity: 0.5, margin: '34px auto 0' }} />
        </section>

        {/* CLOSING */}
        <section data-reveal style={{ maxWidth: 680, margin: '0 auto', padding: 'clamp(40px,6vw,72px) 24px' }}>
          <p style={{ fontFamily: F.body, fontStyle: 'italic', fontSize: 'clamp(17px,2.1vw,20px)', lineHeight: 1.72, color: C.taupe, margin: 0 }}>
            The pot cools. The spent leaves, fully opened, fill it now where a small dark twist of dryness once sat. Seven cups behind us, and not one of them the same. That is the quiet promise of gongfu cha: that patience is not the price of the tea, but the better half of it.
          </p>
          <div style={{ marginTop: 40, fontFamily: F.mono, fontSize: 10, letterSpacing: '0.24em', textTransform: 'uppercase', color: C.dim, lineHeight: 2 }}>
            Words by Teajia &nbsp;·&nbsp; The Ritual of Tea &nbsp;·&nbsp; N°05
          </div>
        </section>

        <MoreFooter links={moreLinks} />
      </article>
    </ImmersiveRoot>
  );
};

export default RitualSevenSteeps;
