import { useTheme } from '../../context/ThemeContext';
import { getTeaLedgerTones } from '../../designTokens';
import type { ContributorTeaSelectionRef } from '../../types';

// One tea from a person's selection, as a typographic row. The catalogue has
// no product photos, so the shop's TeaLedger row is the reference: the
// vintage sits on its liquor ground, the type word is tinted, and a wash of
// the same liquor fades across the row from the left. Same tones helper, so
// a change to the shop's palette changes this row with it.

const CHINESE_FONT_STACK = "'Noto Serif SC','Cormorant Garamond',serif";

export function TeaSelectionRow({ tea }: { tea: ContributorTeaSelectionRef }) {
  const { theme } = useTheme();
  const tones = getTeaLedgerTones(tea.type || 'Oolong', theme);
  // An origin arrives as one comma-joined string, garden first, country last.
  // The first two parts carry the weight, same as the shop's ledger row.
  const origin = (tea.origin ?? '').split(',').map(part => part.trim()).filter(Boolean).slice(0, 2).join(', ') || null;
  const meta = [tea.type, origin].filter(Boolean);
  return (
    <li
      className="border-b border-tea-border"
      /* color-data: the liquor wash is a measured tea colour from
         designTokens, the same one the shop's ledger row paints. */
      style={{ backgroundImage: `linear-gradient(to right, ${tones.wash}, transparent 38%)` }}
    >
      <a
        href={tea.public_path}
        className="grid grid-cols-[44px_minmax(0,1fr)] items-center gap-3.5 px-4 py-3 text-tea-text transition-colors hover:text-tea-gold-lt"
      >
        <span
          aria-hidden="true"
          /* color-data: vintage mark on its liquor ground, from designTokens. */
          style={{ backgroundColor: tones.markBg, color: tones.markFg }}
          className="flex h-11 w-11 items-center justify-center rounded-[2px] font-display text-ui-15 font-medium tracking-[0.03em] tabular-nums"
        >
          {tea.year || ''}
        </span>
        <span className="min-w-0">
          <span className="block font-display text-ui-20 leading-[1.15]">
            {tea.product_name || tea.name}
            {tea.chinese_name && (
              <span className="ml-2 text-ui-14 text-tea-text-sec" style={{ fontFamily: CHINESE_FONT_STACK }}>{tea.chinese_name}</span>
            )}
          </span>
          {meta.length > 0 && (
            <span className="mt-0.5 block font-sans text-ui-11 tracking-[0.04em] text-tea-text-sec">
              {tea.type && (
                <span
                  className="font-semibold uppercase"
                  /* color-data: the type word carries the tea's liquor colour. */
                  style={{ color: tones.markFg }}
                >
                  {tea.type}
                </span>
              )}
              {tea.type && origin ? ' · ' : ''}
              {origin}
            </span>
          )}
        </span>
      </a>
    </li>
  );
}
