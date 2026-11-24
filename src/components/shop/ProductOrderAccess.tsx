import { Icons } from '../Icons';
import { Button } from '../shared/Button';
import { LABEL, NUMERAL } from '../shared/typeRoles';

interface ProductOrderAccessProps {
  onCartClick?: () => void;
  cartItemCount: number;
}

export function ProductOrderAccess({ onCartClick, cartItemCount }: ProductOrderAccessProps) {
  if (!onCartClick) return null;
  // Below 384px the words give way to the bag so the reader's name keeps its room in the top bar.
  if (cartItemCount <= 0) return <span className="shrink-0 text-tea-text-sec" aria-label="Order empty"><Icons.Bag className="mr-2 inline h-4 w-4 max-[383px]:mr-0" aria-hidden="true" /><span className="max-[383px]:sr-only">Order empty</span></span>;

  const itemLabel = cartItemCount === 1 ? 'item' : 'items';
  return (
    <Button
      variant="plain"
      type="button"
      onClick={onCartClick}
      aria-label={`Open order with ${cartItemCount} ${itemLabel}`}
      className={`${LABEL} tap-target inline-flex shrink-0 items-center gap-2 text-tea-text-sec transition-colors hover:text-tea-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50`}
    >
      <Icons.Bag className="h-4 w-4" aria-hidden="true" />
      <span className="max-[383px]:sr-only">View order</span>
      <span className={`normal-case text-tea-gold ${NUMERAL}`}>{cartItemCount}</span>
    </Button>
  );
}
