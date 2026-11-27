import { createLucideIcon } from 'lucide-react';

/**
 * A Chinese teacup: small, no handle, a foot, a thread of steam. The site's
 * one cup. Never a coffee cup (Adrian, 2026-11-27: "You can do a Chinese
 * teacup, never a coffee cup. Completely remove that from this website").
 * Drawn on lucide's grid so it takes size, className and strokeWidth like the
 * other icons.
 */
export const TeaCup = createLucideIcon('TeaCup', [
  ['path', { d: 'M5 10h14l-1.3 5.4a4 4 0 0 1-3.9 3.1h-3.6a4 4 0 0 1-3.9-3.1L5 10z', key: 'bowl' }],
  ['path', { d: 'M9.5 18.5V21h5v-2.5', key: 'foot' }],
  ['path', { d: 'M10 3c0 1.4 1.2 1.6 1.2 3', key: 'steam-a' }],
  ['path', { d: 'M13.5 3c0 1.4 1.2 1.6 1.2 3', key: 'steam-b' }],
]);
