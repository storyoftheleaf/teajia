import type { ContributorLinkPlatform } from '../../types';

// Per-platform marks for a person's typed links: small inline stroke SVGs in
// the spirit of Icons.Seal, not a generic globe and not an icon-font glyph.
// Each is 16px of currentColor stroke; the tap target around it is the
// caller's job (44px, see the hub and the reach section).

interface PlatformMarkProps {
  platform: ContributorLinkPlatform;
  size?: number;
  className?: string;
}

const STROKE = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

export function PlatformMark({ platform, size = 16, className = '' }: PlatformMarkProps) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', 'aria-hidden': true, className, ...STROKE };
  switch (platform) {
    case 'wechat':
      return (
        <svg {...common}>
          <path d="M2.5 9.2c0-2.9 2.8-5.2 6.3-5.2s6.3 2.3 6.3 5.2-2.8 5.2-6.3 5.2c-.7 0-1.4-.1-2-.3L4 15.4l.7-2.1C3.3 12.3 2.5 10.8 2.5 9.2z" />
          <path d="M10.6 13.9c.5 2.3 2.8 4 5.5 4 .6 0 1.2-.1 1.7-.2l2.3 1-.6-1.8c1.1-.8 1.8-2 1.8-3.2 0-2.4-2.1-4.3-4.9-4.5" />
        </svg>
      );
    case 'instagram':
      return (
        <svg {...common}>
          <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
          <circle cx="12" cy="12" r="3.8" />
          <circle cx="17" cy="7" r="0.7" fill="currentColor" />
        </svg>
      );
    case 'website':
      return (
        <svg {...common}>
          <rect x="3" y="4.5" width="18" height="15" rx="2" />
          <path d="M3 8.5h18" />
          <circle cx="6" cy="6.5" r="0.6" fill="currentColor" />
          <circle cx="8.4" cy="6.5" r="0.6" fill="currentColor" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <path d="M10 14a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1 1" />
          <path d="M14 10a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1-1" />
        </svg>
      );
  }
}

export const PLATFORM_NAMES: Record<ContributorLinkPlatform, string> = {
  wechat: 'WeChat',
  instagram: 'Instagram',
  website: 'Website',
  other: 'Elsewhere',
};
