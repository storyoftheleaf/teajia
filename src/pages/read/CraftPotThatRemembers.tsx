/**
 * @color-literals. The Read section is one always-dark editorial surface.
 * Rationale, and the conditions on this exception, in read/immersive.tsx.
 */
/**
 * The Pot That Remembers — The Craft of Tea, N°14
 * A Yixing zisha teapot essay: the clay, the seasoning, and the patina of years.
 * Ported pixel-faithfully from the tea-article-redesign mockup.
 */
import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import {
  C, F, ImmersiveRoot, ImmersiveNav, AccentSwatches, MoreFooter,
  useReveals, useReadingProgress, useImmersiveChrome, grainCss, ACCENTS,
} from './immersive';

const moreLinks = [
  { to: '/read/earth-water-fire', kicker: 'Conversation · N°03', title: 'Earth, Water, Fire', blurb: 'A Jingdezhen potter on the vessels of tea.' },
  { to: '/read/legend', kicker: 'Legend · N°13', title: "The Immortals' Cliff", blurb: 'The Da Hong Pao mother trees of Wuyi.' },
  { to: '/read/leaf-to-liquor', kicker: 'The Craft of Tea', title: 'All Fourteen Pieces', blurb: 'Back to the full contents.' },
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
const sectionDivider = (numeral: string, label: string) => (
  <div
    data-reveal
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 18,
      marginBottom: 'clamp(28px,4vw,40px)',
    }}
  >
    <span style={{ fontFamily: F.display, fontStyle: 'italic', fontSize: 30, color: C.gold, lineHeight: 1 }}>{numeral}</span>
    <span style={{ flex: 1, height: 1, background: 'rgba(168,135,77,0.22)' }} />
    <span style={{ fontFamily: F.ui, fontSize: 10, fontWeight: 500, letterSpacing: '0.24em', textTransform: 'uppercase', color: C.dim }}>{label}</span>
  </div>
);

// ─── Clay card ───────────────────────────────────────────────────────────────
const ClayCard: React.FC<{ bg: string; name: string; cn: string; desc: string }> = ({ bg, name, cn, desc }) => (
  <div style={{ border: '1px solid rgba(168,135,77,0.16)', borderRadius: 4, background: 'linear-gradient(160deg,#1d1810,#15110b)', padding: 'clamp(22px,3vw,30px)' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
      <span style={{ width: 30, height: 30, borderRadius: '50%', background: bg, boxShadow: 'inset 0 -4px 8px rgba(0,0,0,0.3), inset 0 4px 6px rgba(255,255,255,0.12), 0 0 0 1px rgba(168,135,77,0.25)', display: 'inline-block' }} />
      <div>
        <div style={{ fontFamily: F.display, fontSize: 23, color: C.ink, lineHeight: 1 }}>{name}</div>
        <div style={{ fontFamily: F.cn, fontSize: 13, color: C.dim }}>{cn}</div>
      </div>
    </div>
    <p style={{ fontFamily: F.body, fontSize: 14, lineHeight: 1.6, color: C.dim, margin: 0 }}>{desc}</p>
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
const CraftPotThatRemembers: React.FC = () => {
  const [accent, setAccent] = useState<string>(ACCENTS[0]);
  useImmersiveChrome(accent);
  const rootRef = useReveals([]);
  const progress = useReadingProgress();

  return (
    <ImmersiveRoot rootRef={rootRef}>
      <Helmet><title>The Pot That Remembers · Teajia</title></Helmet>
      <ImmersiveNav eyebrow="The Craft · N°14" progress={progress} />
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
              The Craft · Yixing, Jiangsu
            </div>
            <h1 style={{ fontFamily: F.display, fontWeight: 400, fontSize: 'clamp(44px,6.6vw,90px)', lineHeight: 1.0, letterSpacing: '-0.015em', color: C.cream, margin: 0 }}>
              The Pot That<br />
              <span style={{ fontStyle: 'italic', color: C.gold }}>Remembers</span>
            </h1>
            <p style={{ fontFamily: F.body, fontStyle: 'italic', fontSize: 'clamp(16px,2vw,20px)', lineHeight: 1.5, color: C.taupe, margin: '24px 0 0', maxWidth: 440 }}>
              A small unglazed teapot from a single town in China drinks in every tea it brews — until, years later, it can make tea from hot water alone.
            </p>
            <div style={{ marginTop: 'clamp(30px,5vw,46px)', paddingTop: 24, borderTop: '1px solid rgba(168,135,77,0.16)', fontFamily: F.cn, fontSize: 22, color: C.taupe }}>
              紫砂壺{' '}
              <span style={{ fontFamily: F.ui, fontSize: 10.5, fontWeight: 500, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.dim }}>
                — zǐshā hú, the purple-sand pot
              </span>
            </div>
          </div>

          {/* illustration column */}
          <div style={{ position: 'relative', order: 1, overflow: 'hidden', minHeight: '48vh', background: 'linear-gradient(155deg,#2a1d14 0%,#14100b 80%)' }}>
            <div aria-hidden="true" style={{ ...grainCss('0.8', 150), opacity: 0.08 }} />
            <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 60% 50% at 50% 44%, rgba(176,106,60,0.2), transparent 64%)' }} />
            {/* teapot SVG — xishi form */}
            <svg viewBox="0 0 420 420" preserveAspectRatio="xMidYMid meet" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
              <g fill="none" stroke="rgba(176,120,72,0.5)" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round">
                {/* body */}
                <path d="M150 232 C 150 286, 186 314, 232 314 C 278 314, 314 286, 314 232 C 314 210, 300 196, 232 194 C 164 196, 150 210, 150 232 Z" />
                {/* shoulder */}
                <path d="M168 206 C 180 192, 284 192, 296 206" />
                {/* lid */}
                <ellipse cx="232" cy="196" rx="42" ry="11" />
                <path d="M232 185 L232 196" /><circle cx="232" cy="180" r="6" />
                {/* spout */}
                <path d="M150 236 C 120 232, 104 244, 96 262 C 108 256, 128 256, 146 254" />
                {/* handle */}
                <path d="M314 224 C 344 222, 356 240, 352 268 C 340 256, 326 250, 312 250" />
              </g>
              {/* shadow ellipse */}
              <g fill="none" stroke="rgba(168,135,77,0.2)" strokeWidth="1"><ellipse cx="232" cy="324" rx="70" ry="12" /></g>
            </svg>
            <div style={{ position: 'absolute', left: 'clamp(18px,3vw,28px)', bottom: 'clamp(18px,3vw,26px)', fontFamily: F.mono, fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.dim }}>
              A xishi pot — unglazed zisha
            </div>
          </div>
        </header>

        {/* ── STANDFIRST ────────────────────────────────────────────────── */}
        <section data-reveal style={{ maxWidth: 680, margin: '0 auto', padding: 'clamp(56px,9vw,116px) 24px clamp(28px,5vw,52px)' }}>
          <p style={{ fontFamily: F.body, fontSize: 'clamp(18px,2.2vw,22px)', lineHeight: 1.74, color: C.ink, margin: 0 }}>
            <span style={{ float: 'left', fontFamily: F.display, fontWeight: 600, fontSize: '5em', lineHeight: 0.78, color: C.gold, margin: '8px 16px -4px 0' }}>M</span>
            ost teapots are inert — glazed, sealed, forgetful. The little pots of Yixing are the opposite. Thrown from a rare unglazed stoneware called{' '}
            <span style={{ fontFamily: F.cn, color: C.taupe }}>紫砂</span>
            , zǐshā or "purple sand," they are faintly{' '}
            <em style={{ fontStyle: 'italic', color: C.cream }}>porous</em>
            {' '}— riddled with microscopic pockets that, over years, drink in the oils and aromatics of the tea they hold. A Yixing pot does not just brew your tea. It remembers it.
          </p>
        </section>

        {/* ── I — PURPLE SAND ───────────────────────────────────────────── */}
        <section style={{ maxWidth: 1100, margin: '0 auto', padding: 'clamp(20px,4vw,40px) clamp(20px,5vw,40px)' }}>
          <div style={{ maxWidth: 680, margin: '0 auto', marginBottom: 'clamp(28px,4vw,40px)' }}>
            {sectionDivider('I', 'Purple sand')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,300px),1fr))', gap: 'clamp(24px,4vw,52px)', alignItems: 'center' }}>
            <div data-reveal>
              <p style={pBody}>
                The ore comes from one place on earth: the hills around Yixing, in Jiangsu, where it is mined in seams, weathered in the open air for seasons, then ground and aged for years before a maker will touch it. Fired without glaze, it sets to a stoneware that rings like a low bell and feels like warm skin.
              </p>
              <p style={{ ...pBody, margin: 0 }}>
                Its colour depends on the seam. Three are classic — the deep brown-purple of{' '}
                <em style={{ fontStyle: 'italic', color: C.ink }}>zini</em>
                , the orange-red of{' '}
                <em style={{ fontStyle: 'italic', color: C.ink }}>zhuni</em>
                , the pale buff of{' '}
                <em style={{ fontStyle: 'italic', color: C.ink }}>duanni</em>
                {' '}— and a maker reads each one like a painter reads pigment.
              </p>
            </div>
            <figure data-reveal style={{ margin: 0 }}>
              <div style={{ position: 'relative', aspectRatio: '4/5', border: '1px solid rgba(168,135,77,0.2)', borderRadius: 3, overflow: 'hidden', background: 'linear-gradient(160deg,#2c1f14,#14100b 82%)' }}>
                <div aria-hidden="true" style={{ ...grainCss('0.7', 90), opacity: 0.1 }} />
                <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 60% 50% at 46% 40%, rgba(176,106,60,0.26), transparent 64%)' }} />
                <svg viewBox="0 0 320 400" preserveAspectRatio="xMidYMid meet" aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
                  <g fill="none" stroke="rgba(176,120,72,0.3)" strokeWidth="1">
                    <path d="M40 150 C 120 138, 200 142, 280 150" />
                    <path d="M44 200 C 130 188, 210 192, 286 200" />
                    <path d="M40 252 C 120 240, 200 244, 280 252" />
                  </g>
                  <g fill="rgba(176,120,72,0.4)">
                    <circle cx="120" cy="174" r="2" />
                    <circle cx="210" cy="226" r="2.2" />
                    <circle cx="96" cy="232" r="1.8" />
                    <circle cx="230" cy="176" r="1.6" />
                  </g>
                </svg>
                <div style={plateLabel}>Plate I — the raw ore</div>
              </div>
              <figcaption style={cap}>Zisha ore, weathered and aged for years before it is worked.</figcaption>
            </figure>
          </div>
        </section>

        {/* ── THREE CLAYS ───────────────────────────────────────────────── */}
        <section data-reveal style={{ maxWidth: 1040, margin: '0 auto', padding: 'clamp(30px,5vw,56px) 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 'clamp(28px,4vw,40px)' }}>
            {/* Chinese numeral 三 (three) from the design */}
            <span style={{ fontFamily: F.display, fontStyle: 'italic', fontSize: 30, color: C.gold, lineHeight: 1 }}>三</span>
            <span style={{ flex: 1, height: 1, background: 'rgba(168,135,77,0.22)' }} />
            <span style={{ fontFamily: F.ui, fontSize: 10, fontWeight: 500, letterSpacing: '0.24em', textTransform: 'uppercase', color: C.dim }}>Three clays</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,240px),1fr))', gap: 'clamp(18px,3vw,28px)' }}>
            <ClayCard bg="#6e5040" name="Zini" cn="紫泥" desc="Deep brown-purple, the workhorse. Even, forgiving, the most common — a fine all-round pot for darker teas." />
            <ClayCard bg="#a8553a" name="Zhuni" cn="朱泥" desc="Bright orange-red, rare and high-shrinkage. Rings clear and high; prized by gongfu brewers for fragrant oolongs." />
            <ClayCard bg="#b89a64" name="Duanni" cn="段泥" desc="Pale sandy beige, often speckled. Cooler and gentler in the cup — a quiet choice for greens and lighter teas." />
          </div>
        </section>

        {/* ── PULL QUOTE ────────────────────────────────────────────────── */}
        <section data-reveal style={{ maxWidth: 900, margin: '0 auto', padding: 'clamp(50px,8vw,104px) 24px', textAlign: 'center' }}>
          <blockquote style={{ fontFamily: F.display, fontStyle: 'italic', fontWeight: 400, fontSize: 'clamp(28px,4.8vw,54px)', lineHeight: 1.18, color: C.cream, margin: '0 auto', maxWidth: 840 }}>
            "One pot, one tea. A Yixing pot is a diary you are not allowed to overwrite."
          </blockquote>
          <div aria-hidden="true" style={{ width: 40, height: 1, background: C.gold, opacity: 0.5, margin: '34px auto 0' }} />
        </section>

        {/* ── II — SEASONING ────────────────────────────────────────────── */}
        <section style={{ maxWidth: 680, margin: '0 auto', padding: '0 24px' }}>
          <div data-reveal style={{ display: 'flex', alignItems: 'center', gap: 18, margin: 'clamp(20px,4vw,40px) 0 clamp(28px,4vw,40px)' }}>
            <span style={{ fontFamily: F.display, fontStyle: 'italic', fontSize: 30, color: C.gold, lineHeight: 1 }}>II</span>
            <span style={{ flex: 1, height: 1, background: 'rgba(168,135,77,0.22)' }} />
            <span style={{ fontFamily: F.ui, fontSize: 10, fontWeight: 500, letterSpacing: '0.24em', textTransform: 'uppercase', color: C.dim }}>Seasoning a pot</span>
          </div>
          <p data-reveal style={{ ...pBody, marginBottom: 22 }}>
            Because the clay drinks in flavour, you give a Yixing pot a single job. One pot for rock oolong; one for aged Pu'er; one for fragrant green. Mix teas in a single pot and you muddy them both. Keep faith with one, and something remarkable happens: the pot slowly seasons, its pores filling with the memory of that exact tea.
          </p>
          <p data-reveal style={{ ...pBody, margin: 0 }}>
            Brewers speak, only half in jest, of pots so well seasoned that after decades you could pour in nothing but hot water and still draw out a ghost of tea. The pot has become an instrument tuned to one note — and it plays that note better every year.
          </p>
        </section>

        {/* ── III — PATINA ──────────────────────────────────────────────── */}
        <section style={{ maxWidth: 1100, margin: '0 auto', padding: 'clamp(40px,6vw,72px) clamp(20px,5vw,40px) clamp(20px,4vw,40px)' }}>
          <div style={{ maxWidth: 680, margin: '0 auto', marginBottom: 'clamp(28px,4vw,40px)' }}>
            <div data-reveal style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
              <span style={{ fontFamily: F.display, fontStyle: 'italic', fontSize: 30, color: C.gold, lineHeight: 1 }}>III</span>
              <span style={{ flex: 1, height: 1, background: 'rgba(168,135,77,0.22)' }} />
              <span style={{ fontFamily: F.ui, fontSize: 10, fontWeight: 500, letterSpacing: '0.24em', textTransform: 'uppercase', color: C.dim }}>The patina of years</span>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,300px),1fr))', gap: 'clamp(24px,4vw,52px)', alignItems: 'center' }}>
            {/* illustration — plate II */}
            <figure data-reveal style={{ margin: 0, order: 2 }}>
              <div style={{ position: 'relative', aspectRatio: '4/5', border: '1px solid rgba(168,135,77,0.2)', borderRadius: 3, overflow: 'hidden', background: 'radial-gradient(ellipse 64% 56% at 50% 44%, rgba(176,106,60,0.22), transparent 64%), linear-gradient(160deg,#241a12,#14100b)' }}>
                <svg viewBox="0 0 320 400" preserveAspectRatio="xMidYMid meet" aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
                  <g fill="none" stroke="rgba(200,150,96,0.6)" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round">
                    <path d="M104 214 C 104 270, 142 300, 190 300 C 238 300, 276 270, 276 214 C 276 192, 262 178, 190 176 C 118 178, 104 192, 104 214 Z" />
                    <ellipse cx="190" cy="178" rx="40" ry="10" /><circle cx="190" cy="162" r="6" /><path d="M190 168 L190 178" />
                    <path d="M104 218 C 76 214, 62 226, 56 244 C 70 238, 88 238, 102 236" />
                    <path d="M276 206 C 304 204, 316 222, 312 248 C 300 236, 286 232, 274 232" />
                  </g>
                  <g fill="rgba(255,225,180,0.18)"><ellipse cx="166" cy="206" rx="22" ry="34" /></g>
                </svg>
                <div style={{ ...plateLabel }}>Plate II — baojiang, the sheen</div>
              </div>
              <figcaption style={cap}>A pot polished by years of tea and handling to a soft, deep glow.</figcaption>
            </figure>

            {/* prose */}
            <div data-reveal style={{ order: 1 }}>
              <p style={pBody}>
                A used pot earns a patina the Chinese call{' '}
                <span style={{ fontFamily: F.cn, color: C.taupe }}>包浆</span>
                , bāojiāng — a low, lacquer-like sheen raised not by polish but by tea and touch. After each session the pot is rinsed with hot water, never soap, and wiped with a soft cloth. Over years the surface deepens and warms, the way a wooden bannister does under a thousand hands.
              </p>
              <p style={{ ...pBody, margin: 0 }}>
                This is why these pots are handed down. A grandmother's seasoned pot is not just an object; it is the compressed record of ten thousand cups, still faintly flavouring the next one. You do not inherit the pot. You inherit the tea inside its walls.
              </p>
            </div>
          </div>
        </section>

        {/* ── FACT FILE ─────────────────────────────────────────────────── */}
        <section data-reveal style={{ maxWidth: 1040, margin: '0 auto', padding: 'clamp(30px,5vw,56px) 24px' }}>
          <div style={{ border: '1px solid rgba(168,135,77,0.2)', borderRadius: 4, background: 'linear-gradient(160deg,#1d1810,#15110b)', padding: 'clamp(24px,4vw,40px)' }}>
            <div style={{ fontFamily: F.ui, fontSize: 10, fontWeight: 600, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.gold, marginBottom: 24 }}>
              Living with a Yixing pot
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,200px),1fr))', gap: '22px 36px' }}>
              <FactRow label="From" value="Yixing, Jiangsu" />
              <FactRow label="Material" value="Unglazed zisha stoneware" />
              <FactRow label="Rule" value="One pot, one tea" />
              <FactRow label="Never" value="Soap. Only hot water" />
              <FactRow label="Rewards" value="Patience, over years" />
              <FactRow label="Becomes" value="An heirloom" />
            </div>
          </div>
        </section>

        {/* ── CLOSING ───────────────────────────────────────────────────── */}
        <section data-reveal style={{ maxWidth: 680, margin: '0 auto', padding: 'clamp(30px,5vw,56px) 24px clamp(40px,6vw,72px)' }}>
          <p style={{ fontFamily: F.body, fontStyle: 'italic', fontSize: 'clamp(17px,2.1vw,20px)', lineHeight: 1.72, color: C.taupe, margin: 0 }}>
            In a world of objects designed to forget — wiped clean, reset, replaced — the Yixing pot insists on the opposite. It keeps everything. It asks for one tea, a little ritual, and a great deal of time, and in return it gives you something almost no other vessel can: a memory you can drink. Choose your pot, and your tea, with care. You may be choosing for your grandchildren.
          </p>
          <div style={{ marginTop: 40, fontFamily: F.mono, fontSize: 10, letterSpacing: '0.24em', textTransform: 'uppercase', color: C.dim, lineHeight: 2 }}>
            The Craft of Tea by Teajia &nbsp;·&nbsp; N°14
          </div>
        </section>

        <MoreFooter links={moreLinks} />
      </article>
    </ImmersiveRoot>
  );
};

export default CraftPotThatRemembers;
