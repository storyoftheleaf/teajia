import { Icons } from './Icons';

// ─── Nav Icon Configuration ──────────────────────────────────────────
// Lucide icons with heavier stroke, filled active, smaller size, ink indicator

const NAV_ICONS: Record<string, any> = {
  MAGAZINE: Icons.Book,
  LEARN: Icons.School,
  OFFERINGS: Icons.Sparkles,
  SHOP: Icons.Bag,
};

// Per-icon scale adjustments (Read 5% smaller, Learn 5% bigger)
const ICON_SCALE: Record<string, number> = {
  MAGAZINE: 0.95,
  LEARN: 1.05,
};

export function getNavIcon(sectionId: string) {
  return NAV_ICONS[sectionId];
}

export function getIconScale(sectionId: string): number {
  return ICON_SCALE[sectionId] ?? 1;
}
