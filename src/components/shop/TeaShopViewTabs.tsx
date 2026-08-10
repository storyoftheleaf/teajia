import { HIT_AREA, LABEL } from '../shared/typeRoles';
import { TEA_SHOP_VIEWS, type TeaShopView } from './teaShopView';

interface TeaShopViewTabsProps {
  active: TeaShopView;
  onChange: (view: TeaShopView) => void;
}

export function TeaShopViewTabs({ active, onChange }: TeaShopViewTabsProps) {
  return (
    <div
      role="group"
      aria-label="Tea shop views"
      className="flex flex-wrap items-end gap-x-4 border-b border-tea-border sm:gap-x-6"
    >
      {TEA_SHOP_VIEWS.map(view => {
        const isActive = view.id === active;

        return (
          <button
            key={view.id}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(view.id)}
            className={`${HIT_AREA} ${LABEL} relative py-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 ${
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
