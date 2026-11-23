import React from 'react';
import { mediaUrl } from '../../lib/mediaUrl';
import { vendorInitials } from './vendorFaces';

/**
 * A vendor's face: their photo when there is one, else their initials on the
 * measured gold fill (--tea-gold-solid with --tea-bg letters, 4.8:1 in both
 * modes, the same pair the primary buttons use).
 *
 * `shape="round"` is the small avatar beside a name; `shape="tile"` is the big
 * square used in the face grids, where the face is the thing being read.
 */
export const VendorFace: React.FC<{
  name: string;
  photo?: string;
  size?: number;
  shape?: 'round' | 'tile';
  className?: string;
}> = ({ name, photo, size = 40, shape = 'round', className = '' }) => {
  const tile = shape === 'tile';
  const box = tile ? undefined : { width: size, height: size };
  return (
    <span
      className={`relative block overflow-hidden border border-tea-border flex-shrink-0 ${tile ? 'w-full aspect-square rounded-xl' : 'rounded-full'} ${className}`}
      style={box}
    >
      {photo ? (
        <img src={mediaUrl(photo)} alt={name} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
      ) : (
        <span
          className="absolute inset-0 flex items-center justify-center font-display text-tea-bg"
          style={{
            background: 'var(--tea-gold-solid)',
            fontSize: tile ? 'clamp(18px, 6vw, 32px)' : Math.max(10, Math.round(size * 0.32)),
            letterSpacing: '0.04em',
          }}
          aria-hidden="true"
        >
          {vendorInitials(name)}
        </span>
      )}
    </span>
  );
};
