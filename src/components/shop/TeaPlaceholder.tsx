import React from 'react';

/**
 * Minimal SVG placeholder illustrations for each tea category.
 * Used in the Alcove card when a product has no photo.
 * Each illustration evokes the character of its tea type
 * with a single accent color derived from the theme palette.
 */

interface TeaPlaceholderProps {
  type: string;
  style?: React.CSSProperties;
  className?: string;
  size?: number;
}

const teaColors: Record<string, string> = {
  Green:   '#859F85',
  Yellow:  '#D4C586',
  White:   '#D6D3CD',
  Oolong:  '#C4A484',
  Red:     '#A67B70',
  Dark:    '#8B8C89',
  Shou:    '#5C544E',
  Sheng:   '#98A67B',
  Herbal:  '#BFA09E',
  Teaware: '#A89880',
  Misc:    '#737373',
};

function getColor(type: string): string {
  return teaColors[type] || teaColors.Misc;
}

// --- Individual tea type illustrations ---

// A curled leaf — fresh, vegetal
function GreenLeaf({ color }: { color: string }) {
  return (
    <g>
      <path d="M50 78 C42 60, 30 45, 50 22 C70 45, 58 60, 50 78Z" fill="none" stroke={color} strokeWidth="1.5" opacity="0.6" />
      <path d="M50 72 C50 55, 45 40, 50 28" fill="none" stroke={color} opacity="0.4" />
      <path d="M50 55 C44 50, 40 45, 38 38" fill="none" stroke={color} strokeWidth="0.8" opacity="0.3" />
      <path d="M50 50 C56 46, 60 40, 61 34" fill="none" stroke={color} strokeWidth="0.8" opacity="0.3" />
    </g>
  );
}

// A small bud with fine hairs — delicate, golden
function YellowBud({ color }: { color: string }) {
  return (
    <g>
      <ellipse cx="50" cy="50" rx="8" ry="18" fill="none" stroke={color} strokeWidth="1.5" opacity="0.5" />
      <path d="M50 32 C50 28, 48 24, 50 20" fill="none" stroke={color} strokeWidth="0.8" opacity="0.3" />
      <path d="M46 35 C44 30, 42 26, 40 22" fill="none" stroke={color} strokeWidth="0.6" opacity="0.25" />
      <path d="M54 35 C56 30, 58 26, 60 22" fill="none" stroke={color} strokeWidth="0.6" opacity="0.25" />
      <circle cx="50" cy="50" r="2" fill={color} opacity="0.15" />
    </g>
  );
}

// Silver needle — minimal, ethereal
function WhiteNeedle({ color }: { color: string }) {
  return (
    <g>
      <line x1="50" y1="25" x2="50" y2="75" stroke={color} strokeWidth="1.5" opacity="0.4" strokeLinecap="round" />
      <line x1="42" y1="30" x2="42" y2="70" stroke={color} opacity="0.2" strokeLinecap="round" />
      <line x1="58" y1="32" x2="58" y2="68" stroke={color} opacity="0.2" strokeLinecap="round" />
      <circle cx="50" cy="24" r="1.5" fill={color} opacity="0.3" />
      <circle cx="42" cy="29" r="1" fill={color} opacity="0.2" />
      <circle cx="58" cy="31" r="1" fill={color} opacity="0.2" />
    </g>
  );
}

// A partially rolled leaf — complex, in-between
function OolongRoll({ color }: { color: string }) {
  return (
    <g>
      <path d="M35 55 C35 40, 45 30, 55 30 C65 30, 68 40, 65 50 C62 58, 52 62, 45 58" fill="none" stroke={color} strokeWidth="1.5" opacity="0.5" />
      <path d="M42 52 C42 44, 48 38, 55 38 C60 38, 62 42, 60 48" fill="none" stroke={color} opacity="0.35" />
      <circle cx="52" cy="46" r="3" fill={color} opacity="0.1" />
    </g>
  );
}

// An oxidized leaf — warm, full
function RedLeaf({ color }: { color: string }) {
  return (
    <g>
      <path d="M50 75 C38 62, 28 48, 35 32 C42 20, 58 20, 65 32 C72 48, 62 62, 50 75Z" fill={color} opacity="0.08" />
      <path d="M50 75 C38 62, 28 48, 35 32 C42 20, 58 20, 65 32 C72 48, 62 62, 50 75Z" fill="none" stroke={color} strokeWidth="1.5" opacity="0.5" />
      <path d="M50 68 C50 52, 48 40, 50 30" fill="none" stroke={color} opacity="0.3" />
    </g>
  );
}

// A compressed brick/cake shape — aged, dense
function DarkBrick({ color }: { color: string }) {
  return (
    <g>
      <rect x="32" y="36" width="36" height="28" rx="2" fill={color} opacity="0.08" />
      <rect x="32" y="36" width="36" height="28" rx="2" fill="none" stroke={color} strokeWidth="1.5" opacity="0.45" />
      <line x1="32" y1="46" x2="68" y2="46" stroke={color} strokeWidth="0.6" opacity="0.2" />
      <line x1="32" y1="54" x2="68" y2="54" stroke={color} strokeWidth="0.6" opacity="0.2" />
      <line x1="44" y1="36" x2="44" y2="64" stroke={color} strokeWidth="0.6" opacity="0.15" />
      <line x1="56" y1="36" x2="56" y2="64" stroke={color} strokeWidth="0.6" opacity="0.15" />
    </g>
  );
}

// A pu-erh cake — round, compressed, dark
function ShouCake({ color }: { color: string }) {
  return (
    <g>
      <circle cx="50" cy="50" r="22" fill={color} opacity="0.08" />
      <circle cx="50" cy="50" r="22" fill="none" stroke={color} strokeWidth="1.5" opacity="0.45" />
      <circle cx="50" cy="50" r="14" fill="none" stroke={color} strokeWidth="0.8" opacity="0.2" />
      <circle cx="50" cy="50" r="6" fill="none" stroke={color} strokeWidth="0.6" opacity="0.15" />
      <circle cx="50" cy="50" r="2" fill={color} opacity="0.2" />
    </g>
  );
}

// A wild leaf — raw, living
function ShengLeaf({ color }: { color: string }) {
  return (
    <g>
      <path d="M50 78 C40 65, 25 50, 30 30 C35 18, 50 15, 55 25 C60 35, 58 55, 50 78Z" fill="none" stroke={color} strokeWidth="1.5" opacity="0.5" />
      <path d="M50 70 C48 55, 40 40, 42 28" fill="none" stroke={color} opacity="0.3" />
      <path d="M50 58 C55 50, 56 42, 54 32" fill="none" stroke={color} strokeWidth="0.8" opacity="0.25" />
      <path d="M38 38 C42 42, 46 44, 50 44" fill="none" stroke={color} strokeWidth="0.6" opacity="0.2" />
    </g>
  );
}

// Scattered petals/herbs
function HerbalScatter({ color }: { color: string }) {
  return (
    <g>
      <ellipse cx="42" cy="40" rx="6" ry="3" transform="rotate(-20 42 40)" fill="none" stroke={color} opacity="0.4" />
      <ellipse cx="58" cy="45" rx="5" ry="2.5" transform="rotate(15 58 45)" fill="none" stroke={color} opacity="0.35" />
      <ellipse cx="46" cy="55" rx="7" ry="3" transform="rotate(-10 46 55)" fill="none" stroke={color} opacity="0.3" />
      <ellipse cx="55" cy="60" rx="4" ry="2" transform="rotate(25 55 60)" fill="none" stroke={color} strokeWidth="0.8" opacity="0.25" />
      <circle cx="50" cy="48" r="1.5" fill={color} opacity="0.15" />
      <circle cx="40" cy="52" r="1" fill={color} opacity="0.12" />
    </g>
  );
}

// A vessel — gaiwan/teapot silhouette
function TeawareVessel({ color }: { color: string }) {
  return (
    <g>
      {/* Lid */}
      <path d="M40 38 C40 34, 60 34, 60 38" fill="none" stroke={color} strokeWidth="1.2" opacity="0.45" />
      <circle cx="50" cy="33" r="2" fill="none" stroke={color} opacity="0.3" />
      {/* Body */}
      <path d="M38 40 C36 50, 36 58, 42 64 L58 64 C64 58, 64 50, 62 40Z" fill={color} opacity="0.06" />
      <path d="M38 40 C36 50, 36 58, 42 64 L58 64 C64 58, 64 50, 62 40" fill="none" stroke={color} strokeWidth="1.5" opacity="0.45" />
      {/* Base */}
      <line x1="42" y1="64" x2="58" y2="64" stroke={color} strokeWidth="1.5" opacity="0.4" />
    </g>
  );
}

// A simple circle — neutral
function MiscCircle({ color }: { color: string }) {
  return (
    <g>
      <circle cx="50" cy="50" r="18" fill="none" stroke={color} strokeWidth="1.2" opacity="0.3" />
      <circle cx="50" cy="50" r="10" fill="none" stroke={color} strokeWidth="0.8" opacity="0.2" strokeDasharray="2 3" />
      <circle cx="50" cy="50" r="3" fill={color} opacity="0.15" />
    </g>
  );
}

function getIllustration(type: string, color: string) {
  switch (type) {
    case 'Green':   return <GreenLeaf color={color} />;
    case 'Yellow':  return <YellowBud color={color} />;
    case 'White':   return <WhiteNeedle color={color} />;
    case 'Oolong':  return <OolongRoll color={color} />;
    case 'Red':     return <RedLeaf color={color} />;
    case 'Dark':    return <DarkBrick color={color} />;
    case 'Shou':    return <ShouCake color={color} />;
    case 'Sheng':   return <ShengLeaf color={color} />;
    case 'Herbal':  return <HerbalScatter color={color} />;
    case 'Teaware': return <TeawareVessel color={color} />;
    default:        return <MiscCircle color={color} />;
  }
}

export const TeaPlaceholder: React.FC<TeaPlaceholderProps> = ({ type, style, className }) => {
  const color = getColor(type);

  return (
    <div
      className={className}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        ...style,
      }}
    >
      {/* Subtle radial glow behind the illustration */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: `radial-gradient(circle at 50% 50%, ${color}08 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />
      <svg
        viewBox="0 0 100 100"
        style={{
          width: '80%',
          height: '80%',
          maxWidth: '160px',
          maxHeight: '160px',
        }}
      >
        {getIllustration(type, color)}
      </svg>
    </div>
  );
};

export default TeaPlaceholder;
