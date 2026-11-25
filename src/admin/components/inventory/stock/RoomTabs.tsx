import { Check } from 'lucide-react';
import { Button } from '../../../../components/shared/Button';
import type { Product } from '../../../types';

// The open tea's room on a laptop (Adrian, 2026-11-25): five words across the
// top, one short page each, so nothing in the room has to be scrolled for. The
// panel marks each of its parts with the tab it belongs to (data-tab-of) and the
// stylesheet shows the chosen one. A phone keeps its one long page.

export const ROOM_TABS = [
  ['shelf', 'Shelf'], ['details', 'Details'], ['money', 'Money'], ['story', 'Story'], ['links', 'Links'],
] as const;
export type RoomTab = typeof ROOM_TABS[number][0];

export function RoomTabs({ value, onChange }: { value: RoomTab; onChange: (tab: RoomTab) => void }) {
  return <div role="tablist" aria-label="Parts of this tea" className="stock-room-tabs" data-testid="stock-room-tabs">
    {ROOM_TABS.map(([id, label]) => <Button key={id} variant="plain" type="button" role="tab" aria-selected={value === id}
      onClick={() => onChange(id)}>{label}</Button>)}
  </div>;
}

/** What the row's own editor offers, kept within reach on the Shelf tab: the
 *  shop switch, a photo, a tasting and the tasting profile. The tea's next step
 *  (Review listing, Develop in Curate) is already on this tab, just above. */
export function RoomShelfTools({ product, canPublish, onUpdate, onTasting, onPhoto, onTaste }: {
  product: Product;
  canPublish: boolean;
  onUpdate: (id: string, field: keyof Product, value: unknown) => void;
  onTasting: (product: Product) => void;
  onPhoto: (product: Product) => void;
  onTaste: (product: Product) => void;
  nextStep?: unknown;
}) {
  const blocked = !product.isPublic && !canPublish;
  return <div className="stock-room-tools" data-testid="stock-room-tools">
    <Button variant="plain" type="button" role="switch" aria-checked={!!product.isPublic} aria-label="List in shop" disabled={blocked}
      title={blocked ? 'Arrival status must be ready before publication' : undefined}
      onClick={() => { if (!blocked) onUpdate(product.id, 'isPublic', !product.isPublic); }}>
      <span aria-hidden="true" className={`stock-room-tick ${product.isPublic ? 'cta-solid' : ''}`}>{product.isPublic && <Check size={11} strokeWidth={3} />}</span>
      List in shop
    </Button>
    <Button variant="plain" type="button" onClick={() => onPhoto(product)}>Photo</Button>
    <Button variant="plain" type="button" onClick={() => onTaste(product)}>Taste</Button>
    <Button variant="plain" type="button" onClick={() => onTasting(product)}>Tasting profile</Button>
  </div>;
}
