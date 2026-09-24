import type { ReactNode } from 'react';
import { HIT_AREA } from '../shared/typeRoles';

// The second tier of the shop's tabs, set in the SAME face and tracking as the
// Tea / Teaware / Sets / Liked row above it, one size down and without the
// gold. It used the sans label role, so two stacked rows of tabs read as two
// different systems.
const SUB_TAB = 'text-ui-11 uppercase tracking-[0.18em]';
import { TEA_SHOP_VIEWS, type TeaShopView } from './teaShopView';

interface TeaShopViewTabsProps {
  active: TeaShopView;
  onChange: (view: TeaShopView) => void;
}

interface TeaShopResultStatusProps {
  active: TeaShopView;
  count: number;
  showPast: boolean;
}

export function TeaShopResultStatus({ active, count, showPast }: TeaShopResultStatusProps) {
  const message = active === 'find'
    ? 'Choose a direction to find a tea.'
    : `${count} ${count === 1 ? 'tea' : 'teas'} ${showPast ? 'in the archive' : active === 'selection' ? 'in My selection' : 'shown'}`;

  return (
    <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {message}
    </p>
  );
}

interface TeaShopViewRegionProps extends TeaShopResultStatusProps {
  children: ReactNode;
}

export function TeaShopViewRegion({ active, count, showPast, children }: TeaShopViewRegionProps) {
  return (
    <>
      <TeaShopResultStatus active={active} count={count} showPast={showPast} />
      {children}
    </>
  );
}

export function TeaShopViewTabs({ active, onChange }: TeaShopViewTabsProps) {
  return (
    <div
      role="group"
      aria-label="Tea shop views"
      className="flex flex-wrap items-end gap-x-4 sm:gap-x-6"
    >
      {TEA_SHOP_VIEWS.map(view => {
        const isActive = view.id === active;

        return (
          <button
            key={view.id}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(view.id)}
            className={`${HIT_AREA} ${SUB_TAB} relative py-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 ${
              isActive
                ? 'text-tea-text'
                : 'text-tea-text-sec hover:text-tea-text'
            }`}
          >
            {view.label}
            {isActive && (
              <span
                aria-hidden="true"
                className="absolute inset-x-0 bottom-[-1px] h-px bg-tea-gold"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
