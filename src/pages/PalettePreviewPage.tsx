import React, { useState } from 'react';

// Standalone palette preview. Renders the same homepage hero + inventory
// table under different palette variants chosen from a top cycler. Every
// value here is locally scoped CSS variables; nothing in this file touches
// global tokens.

type PaletteVars = Record<string, string>;

interface Variant {
  id: string;
  name: string;
  blurb: string;
  vars: PaletteVars;
  // Optional accent secondary (for the printed-book direction's red, etc.)
  accent2Label?: string;
}

const VARIANTS: Variant[] = [
  {
    id: 'current',
    name: '0. Current: Espresso (live)',
    blurb: 'What ships today. Yellow-leaning bronze, mustard text-dim, no green.',
    vars: {
      '--bg': '#18130e',
      '--surface': '#28211a',
      '--elevated': '#3a3126',
      '--text': '#ede4d4',
      '--text-sec': '#b5a892',
      '--text-dim': '#917a55',
      '--bronze': '#a8874d',
      '--bronze-lt': '#bfa06a',
      '--border': 'rgba(139,110,68,0.28)',
      '--accent-sub': 'rgba(168,135,77,0.10)',
      '--forest': '#917a55',
      '--accent2': 'transparent',
      '--grain-strength': '0.035',
    },
  },
  {
    id: 'revised',
    name: '0b. Espresso, off-yellow + forest',
    blurb: 'Smallest change. Bronze rotated off yellow, text-dim neutralized, rare forest dot.',
    vars: {
      '--bg': '#16110d',
      '--surface': '#241e18',
      '--elevated': '#332b22',
      '--text': '#ece2d0',
      '--text-sec': '#a89e8d',
      '--text-dim': '#857c6f',
      '--bronze': '#a47a44',
      '--bronze-lt': '#b08555',
      '--border': 'rgba(120,95,60,0.24)',
      '--accent-sub': 'rgba(164,122,68,0.09)',
      '--forest': '#5a6e55',
      '--accent2': 'transparent',
      '--grain-strength': '0.035',
    },
  },
  {
    id: 'ink-rice',
    name: '1. Ink & Rice Paper',
    blurb: 'Light-mode first. Raw parchment, near-black ink, bronze used once per page.',
    vars: {
      '--bg': '#ece3d2',
      '--surface': '#e2d8c4',
      '--elevated': '#d6cab2',
      '--text': '#1a1612',
      '--text-sec': '#4a4034',
      '--text-dim': '#7a6f5d',
      '--bronze': '#8a6536',
      '--bronze-lt': '#9a7340',
      '--border': 'rgba(60,45,28,0.18)',
      '--accent-sub': 'rgba(138,101,54,0.06)',
      '--forest': '#5a6648',
      '--accent2': 'transparent',
      '--grain-strength': '0.045',
    },
  },
  {
    id: 'cellar',
    name: '2. Cellar & Lamplight',
    blurb: 'Espresso pulled deeper. Burnt-umber bronze concentrated as one warm glow.',
    vars: {
      '--bg': '#0e0a07',
      '--surface': '#1a140e',
      '--elevated': '#2a2118',
      '--text': '#e8dcc4',
      '--text-sec': '#9a8c74',
      '--text-dim': '#6e6354',
      '--bronze': '#8a6536',
      '--bronze-lt': '#a47a44',
      '--border': 'rgba(120,90,55,0.20)',
      '--accent-sub': 'rgba(212,165,84,0.06)',
      '--forest': '#6a7a5a',
      '--accent2': 'transparent',
      '--grain-strength': '0.04',
    },
  },
  {
    id: 'bone-jade',
    name: '3. Bone, Ash & Jade',
    blurb: 'Radical: bronze removed. Bone background, charcoal type, muted jade as the only color.',
    vars: {
      '--bg': '#ede5d6',
      '--surface': '#e1d8c5',
      '--elevated': '#d2c8b3',
      '--text': '#1c1a16',
      '--text-sec': '#4d4942',
      '--text-dim': '#7a766c',
      // bronze role is taken over by jade in this direction
      '--bronze': '#5e7a64',
      '--bronze-lt': '#6e8a72',
      '--border': 'rgba(60,55,45,0.16)',
      '--accent-sub': 'rgba(94,122,100,0.08)',
      '--forest': '#3f5544',
      '--accent2': 'transparent',
      '--grain-strength': '0.025',
    },
  },
  {
    id: 'ember',
    name: '4. Tea Ceremony at Dusk',
    blurb: 'Drenched. Deep oxblood lacquer ground, warm cream type, copper finally reads.',
    vars: {
      '--bg': '#321811',
      '--surface': '#3e1f17',
      '--elevated': '#4a261d',
      '--text': '#f0e2c8',
      '--text-sec': '#bba590',
      '--text-dim': '#8a7565',
      '--bronze': '#c98e4a',
      '--bronze-lt': '#d6a060',
      '--border': 'rgba(180,120,70,0.22)',
      '--accent-sub': 'rgba(201,142,74,0.10)',
      '--forest': '#7a8a6a',
      '--accent2': 'transparent',
      '--grain-strength': '0.05',
    },
  },
  {
    id: 'slate',
    name: '5. Slate & Steeped Leaf',
    blurb: 'Cool slate canvas, warm tea-brown surfaces. The only direction that breaks all-warm.',
    vars: {
      '--bg': '#181a1d',
      '--surface': '#2a221a',
      '--elevated': '#352a1f',
      '--text': '#e2dccd',
      '--text-sec': '#9a958a',
      '--text-dim': '#6a675f',
      '--bronze': '#a47a44',
      '--bronze-lt': '#b08555',
      '--border': 'rgba(150,130,100,0.16)',
      '--accent-sub': 'rgba(164,122,68,0.08)',
      '--forest': '#6a8068',
      '--accent2': 'transparent',
      '--grain-strength': '0.03',
    },
  },
  {
    id: 'aged-print',
    name: '6. The Aged Print',
    blurb: 'Parchment + ink + faded copper + rare printer\'s red. Two chromatics, both from the press.',
    vars: {
      '--bg': '#ebe2cf',
      '--surface': '#e0d6c0',
      '--elevated': '#d4c8ae',
      '--text': '#181410',
      '--text-sec': '#48403a',
      '--text-dim': '#807563',
      '--bronze': '#9c7440',
      '--bronze-lt': '#aa8048',
      '--border': 'rgba(60,40,20,0.18)',
      '--accent-sub': 'rgba(156,116,64,0.06)',
      '--forest': '#5e6a4c',
      '--accent2': '#a04030',
      '--grain-strength': '0.10',
    },
    accent2Label: "Printer's red",
  },
  {
    id: 'celadon',
    name: 'A. Celadon & Ash',
    blurb: 'Pale celadon-green ground, warm graphite type, oxblood as the sole accent. No bronze, no brown.',
    vars: {
      '--bg': '#d4dcd0',
      '--surface': '#c8d2c5',
      '--elevated': '#bcc6b8',
      '--text': '#2a2a26',
      '--text-sec': '#5a5a52',
      '--text-dim': '#86867b',
      '--bronze': '#7a2820',
      '--bronze-lt': '#8a3028',
      '--border': 'rgba(70,75,60,0.20)',
      '--accent-sub': 'rgba(122,40,32,0.06)',
      '--forest': '#5a6e55',
      '--accent2': 'transparent',
      '--grain-strength': '0.06',
    },
    accent2Label: 'Oxblood is the only accent',
  },
  {
    id: 'indigo',
    name: 'B. Indigo Workshop',
    blurb: 'Indigo-night blue ground, raw linen cream type, sun-faded persimmon. Natural-dye world.',
    vars: {
      '--bg': '#1a2438',
      '--surface': '#222e44',
      '--elevated': '#2c3a52',
      '--text': '#e8e0cc',
      '--text-sec': '#a8a08c',
      '--text-dim': '#7a7468',
      '--bronze': '#c8703e',
      '--bronze-lt': '#d68450',
      '--border': 'rgba(232,224,204,0.14)',
      '--accent-sub': 'rgba(200,112,62,0.10)',
      '--forest': '#7a9a8a',
      '--accent2': 'transparent',
      '--grain-strength': '0.04',
    },
  },
  {
    id: 'volcanic',
    name: 'C. Volcanic / Black Pottery',
    blurb: 'Pure carbon black, smoke-grey type, single rust-iron accent. Heavy, present, monolithic.',
    vars: {
      '--bg': '#0c0c0d',
      '--surface': '#16161a',
      '--elevated': '#222226',
      '--text': '#d8d4ce',
      '--text-sec': '#9a9690',
      '--text-dim': '#5e5a54',
      '--bronze': '#9c4a25',
      '--bronze-lt': '#b25830',
      '--border': 'rgba(220,212,200,0.10)',
      '--accent-sub': 'rgba(156,74,37,0.08)',
      '--forest': '#6a7268',
      '--accent2': 'transparent',
      '--grain-strength': '0.18',
    },
  },
  {
    id: 'lacquer',
    name: 'D. Lacquer & Mother-of-Pearl',
    blurb: 'True lacquer black, warm pearl type, abalone-iridescent accents on hover. Imperial decorative arts.',
    vars: {
      '--bg': '#0a0908',
      '--surface': '#14110f',
      '--elevated': '#1f1a16',
      '--text': '#ece4d0',
      '--text-sec': '#9a9388',
      '--text-dim': '#5e5a52',
      // muted teal-grey for static; gradient handled separately
      '--bronze': '#5a7878',
      '--bronze-lt': '#6a8a8a',
      '--border': 'rgba(236,228,208,0.10)',
      '--accent-sub': 'rgba(90,120,120,0.10)',
      '--forest': '#788a7a',
      // abalone iridescent gradient, only for accents that opt in
      '--accent2': 'linear-gradient(95deg,#6a8a8a 0%,#c4a8b8 38%,#b89a78 70%,#8aa898 100%)',
      '--grain-strength': '0.025',
    },
    accent2Label: 'Abalone gradient (focus/hover only)',
  },
  {
    id: 'newsprint',
    name: 'E. Documentary / Newsprint',
    blurb: 'Bleached newsprint cream, dense black type, single hot magazine-pink. Photo-essay register.',
    vars: {
      '--bg': '#f0e9d8',
      '--surface': '#e6dec9',
      '--elevated': '#dad1ba',
      '--text': '#0e0d0a',
      '--text-sec': '#3a352e',
      '--text-dim': '#7a7264',
      '--bronze': '#0e0d0a',
      '--bronze-lt': '#3a352e',
      '--border': 'rgba(20,18,14,0.18)',
      '--accent-sub': 'rgba(232,81,124,0.08)',
      '--forest': '#4a5240',
      '--accent2': '#e8517c',
      '--grain-strength': '0.12',
    },
    accent2Label: 'Magazine pink (one moment per page)',
  },
  {
    id: 'wet-stone',
    name: 'F. Moss, Stone & Water',
    blurb: 'Wet basalt cool grey-blue, mossy green accents. Cool dominant; one rare warm note.',
    vars: {
      '--bg': '#2a2e30',
      '--surface': '#22262a',
      '--elevated': '#363a3e',
      '--text': '#dce4d8',
      '--text-sec': '#9aa298',
      '--text-dim': '#6a726c',
      '--bronze': '#4a5e48',
      '--bronze-lt': '#5a7058',
      '--border': 'rgba(180,196,180,0.12)',
      '--accent-sub': 'rgba(74,94,72,0.10)',
      '--forest': '#3a4e3a',
      '--accent2': '#8a7048',
      '--grain-strength': '0.04',
    },
    accent2Label: 'Brass, used literally once per page',
  },
];

const Swatch: React.FC<{ name: string; token: string }> = ({ name, token }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
    <div
      style={{
        width: 32,
        height: 32,
        borderRadius: 2,
        background: `var(${token})`,
        boxShadow: 'inset 0 0 0 1px var(--border)',
      }}
    />
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <span style={{ color: 'var(--text)', fontSize: 11, fontFamily: 'var(--font-display)' }}>{name}</span>
      <span style={{ color: 'var(--text-dim)', fontSize: 9, fontFamily: 'var(--font-mono)' }}>{token}</span>
    </div>
  </div>
);

const HomepagePreview: React.FC<{ hasAccent2?: boolean; accent2Label?: string; variantId?: string }> = ({ hasAccent2, variantId }) => {
  const isLacquer = variantId === 'lacquer';
  const accentTextStyle: React.CSSProperties = isLacquer
    ? {
        backgroundImage: 'var(--accent2)',
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        color: 'transparent',
        fontStyle: 'italic',
      }
    : { color: 'var(--accent2)', fontStyle: 'italic' };
  return (
  <div
    style={{
      position: 'relative',
      overflow: 'hidden',
      background: 'var(--bg)',
      color: 'var(--text)',
      minHeight: 600,
      padding: '64px 56px',
    }}
  >
    <div
      style={{
        position: 'absolute',
        inset: 0,
        opacity: 'var(--grain-strength)',
        pointerEvents: 'none',
        backgroundImage: 'radial-gradient(circle at 1px 1px, var(--text) 1px, transparent 0)',
        backgroundSize: '4px 4px',
      }}
    />

    <div style={{ position: 'relative', maxWidth: 720 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 48 }}>
        <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--bronze)' }} />
        <span
          style={{
            color: 'var(--text-dim)',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          Teajia · Spring 2026
        </span>
      </div>

      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 300,
          fontSize: 64,
          lineHeight: 1.05,
          letterSpacing: '-0.01em',
          marginBottom: 28,
          maxWidth: 560,
        }}
      >
        {hasAccent2 ? (
          <>
            Tea, kept the way<br />
            <span style={accentTextStyle}>it was meant</span> to be kept.
          </>
        ) : (
          <>Tea, kept the way<br />it was meant to be kept.</>
        )}
      </h1>

      <p
        style={{
          fontFamily: 'var(--font-serif)',
          fontSize: 18,
          lineHeight: 1.6,
          color: 'var(--text-sec)',
          maxWidth: 520,
          marginBottom: 56,
        }}
      >
        A working library of teas, sourced over fifteen years and tasted across a thousand sessions. Read the notes, host a table, or take a sample home.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontFamily: 'var(--font-display)', fontWeight: 300 }}>
        {['Source, the cellars and gardens', 'Discover, the magazine', 'Deepen, your tasting record', 'Create, host a table'].map(
          (line, i) => (
            <div
              key={line}
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 14,
                color: i === 0 ? 'var(--text)' : 'var(--text-sec)',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  color: 'var(--text-dim)',
                  minWidth: 24,
                }}
              >
                0{i + 1}
              </span>
              <span style={{ fontSize: 22 }}>{line}</span>
              {i === 0 && <span style={{ width: 28, height: 1, background: 'var(--bronze)', marginLeft: 'auto' }} />}
            </div>
          )
        )}
      </div>

      <div
        style={{
          marginTop: 80,
          paddingTop: 28,
          borderTop: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'baseline',
          gap: 24,
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 15, color: 'var(--text-sec)' }}>
          Currently pouring
        </span>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 17, color: 'var(--text)' }}>
          2008 Yiwu Mahei, autumn picking
        </span>
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--forest)' }} />
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--text-dim)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            In stock
          </span>
        </span>
      </div>
    </div>
  </div>
  );
};

const InventoryPreview: React.FC<{ hasAccent2?: boolean; variantId?: string }> = ({ hasAccent2, variantId }) => {
  const isLacquer = variantId === 'lacquer';
  const buttonBg = isLacquer ? 'var(--accent2)' : 'var(--bronze)';
  const buttonColor = isLacquer ? '#0a0908' : 'var(--bg)';
  const rows = [
    { code: 'PE-2008-YWM', name: 'Yiwu Mahei, autumn', cat: 'Sheng pu-erh', stock: 142, price: '¥820', state: 'active' },
    { code: 'WL-2019-RGP', name: 'Rougui, Mawei pit', cat: 'Yancha', stock: 24, price: '¥640', state: 'low' },
    { code: 'GR-2024-LJN', name: 'Longjing, pre-Qingming', cat: 'Lvcha', stock: 0, price: '¥480', state: 'out' },
    { code: 'WH-2017-SBM', name: 'Shoumei cake, aged', cat: 'Baicha', stock: 88, price: '¥360', state: 'active' },
    { code: 'OO-2022-DHP', name: 'Dahongpao, traditional', cat: 'Yancha', stock: 56, price: '¥920', state: 'active' },
  ];

  const stateChip = (s: string) => {
    if (s === 'active') return { label: 'In stock', color: 'var(--forest)' };
    if (s === 'low') return { label: 'Low', color: 'var(--bronze)' };
    return { label: 'Sold out', color: 'var(--text-dim)' };
  };

  return (
    <div style={{ background: 'var(--bg)', color: 'var(--text)', padding: '40px 48px', minHeight: 600 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: 32,
          paddingBottom: 20,
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--text-dim)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginBottom: 8,
            }}
          >
            {hasAccent2 ? <span style={{ color: 'var(--accent2)' }}>§</span> : null} Inventory · Tea
          </div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 300, fontSize: 32, letterSpacing: '-0.01em' }}>
            139 references in cellar
          </h2>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 20,
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            color: 'var(--text-sec)',
          }}
        >
          <span>Filter</span>
          <span>Sort: name</span>
          <span style={{ color: 'var(--bronze)' }}>+ Add</span>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '110px 1fr 140px 80px 90px 110px',
          columnGap: 24,
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: 'var(--text-dim)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          paddingBottom: 12,
          borderBottom: '1px solid var(--border)',
        }}
      >
        <span>Code</span>
        <span>Name</span>
        <span>Category</span>
        <span style={{ textAlign: 'right' }}>Stock</span>
        <span style={{ textAlign: 'right' }}>Price</span>
        <span>State</span>
      </div>

      {rows.map((r, i) => {
        const chip = stateChip(r.state);
        return (
          <div
            key={r.code}
            style={{
              display: 'grid',
              gridTemplateColumns: '110px 1fr 140px 80px 90px 110px',
              columnGap: 24,
              alignItems: 'center',
              padding: '18px 0',
              borderBottom: i === rows.length - 1 ? 'none' : '1px solid var(--border)',
            }}
          >
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-dim)' }}>{r.code}</span>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 17 }}>{r.name}</span>
            <span style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 14, color: 'var(--text-sec)' }}>
              {r.cat}
            </span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 13,
                textAlign: 'right',
                color: r.stock === 0 ? 'var(--text-dim)' : 'var(--text)',
              }}
            >
              {r.stock}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, textAlign: 'right' }}>{r.price}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: chip.color }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-sec)', letterSpacing: '0.04em' }}>
                {chip.label}
              </span>
            </span>
          </div>
        );
      })}

      <div
        style={{
          marginTop: 40,
          padding: '20px 24px',
          background: 'var(--surface)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 14, color: 'var(--text-sec)', marginBottom: 4 }}>
            Last tasted
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 17 }}>Yiwu Mahei · 4 May, with Jesse</div>
        </div>
        <button
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 14,
            color: buttonColor,
            background: buttonBg,
            padding: '10px 22px',
            border: 'none',
            cursor: 'pointer',
            letterSpacing: '0.02em',
          }}
        >
          Open record
        </button>
      </div>
    </div>
  );
};

const PalettePreviewPage: React.FC = () => {
  const [activeId, setActiveId] = useState(VARIANTS[0].id);
  const active = VARIANTS.find((v) => v.id === activeId) ?? VARIANTS[0];
  const hasAccent2 = active.vars['--accent2'] !== 'transparent';

  return (
    <div style={{ background: '#0a0805', minHeight: '100dvh', paddingBottom: 80 }}>
      {/* Cycler */}
      <nav
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: 'rgba(10,8,5,0.92)',
          backdropFilter: 'blur(8px)',
          borderBottom: '1px solid rgba(168,135,77,0.14)',
          padding: '14px 24px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: '#857c6f',
              marginRight: 12,
            }}
          >
            Palette
          </span>
          {VARIANTS.map((v) => {
            const isActive = v.id === activeId;
            return (
              <button
                key={v.id}
                onClick={() => setActiveId(v.id)}
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 300,
                  fontSize: 13,
                  padding: '6px 12px',
                  background: isActive ? '#1f1812' : 'transparent',
                  color: isActive ? '#ece2d0' : '#a89e8d',
                  border: '1px solid',
                  borderColor: isActive ? 'rgba(168,135,77,0.45)' : 'rgba(168,135,77,0.16)',
                  borderRadius: 2,
                  cursor: 'pointer',
                  transition: 'all 180ms cubic-bezier(0.2, 0.7, 0.2, 1)',
                }}
              >
                {v.name}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Description bar */}
      <div
        style={{
          padding: '36px 48px 28px',
          textAlign: 'center',
          color: '#a89e8d',
          fontFamily: 'var(--font-display)',
          maxWidth: 760,
          margin: '0 auto',
        }}
      >
        <div
          style={{
            fontSize: 11,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            marginBottom: 10,
            color: '#857c6f',
          }}
        >
          {active.name}
        </div>
        <p style={{ fontSize: 15, fontStyle: 'italic', lineHeight: 1.6, color: '#c4baa9' }}>{active.blurb}</p>
        {active.accent2Label && (
          <p style={{ fontSize: 12, color: '#857c6f', marginTop: 10, fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>
            secondary accent: {active.accent2Label}
          </p>
        )}
      </div>

      {/* Variant frame */}
      <section style={active.vars as React.CSSProperties}>
        <HomepagePreview hasAccent2={hasAccent2} accent2Label={active.accent2Label} variantId={active.id} />
        <InventoryPreview hasAccent2={hasAccent2} variantId={active.id} />

        {/* Swatch strip */}
        <div
          style={{
            background: 'var(--surface)',
            padding: '32px 48px',
            borderTop: '1px solid var(--border)',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
            gap: 18,
          }}
        >
          <Swatch name="bg" token="--bg" />
          <Swatch name="surface" token="--surface" />
          <Swatch name="elevated" token="--elevated" />
          <Swatch name="text" token="--text" />
          <Swatch name="text-sec" token="--text-sec" />
          <Swatch name="text-dim" token="--text-dim" />
          <Swatch name="bronze" token="--bronze" />
          <Swatch name="bronze-lt" token="--bronze-lt" />
          <Swatch name="forest" token="--forest" />
          {hasAccent2 && <Swatch name="accent2" token="--accent2" />}
        </div>
      </section>
    </div>
  );
};

export default PalettePreviewPage;
