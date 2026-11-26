import { TEA_TYPES, inventoryTeaType } from '../wisdom/vocabulary';

export const TOP_TEAS_OPEN = false;

export function topTeasOpen(env?: { TOP_TEAS_OPEN?: string }): boolean {
  const site = (import.meta as { env?: Record<string, string | undefined> }).env;
  const setting = env ? env.TOP_TEAS_OPEN : site?.VITE_TOP_TEAS_OPEN;
  return setting === 'true' || (setting !== 'false' && TOP_TEAS_OPEN);
}

export const TOP_TEA_SLOTS = [...TEA_TYPES, 'own', 'elsewhere'] as const;
export type TopTeaSlot = typeof TOP_TEA_SLOTS[number];

export function isTopTeaSlot(slot: string): slot is TopTeaSlot {
  return (TOP_TEA_SLOTS as readonly string[]).includes(slot);
}

export function topTeaSlotLabel(slot: TopTeaSlot): string {
  if (slot === 'own') return 'One of my own';
  if (slot === 'elsewhere') return 'From someone else';
  return inventoryTeaType(slot);
}

export const TOP_TEA_NAME_LIMIT = 160;
export const TOP_TEA_NOTE_LIMIT = 600;

export interface TopTeaPick {
  slot: TopTeaSlot;
  name: string;
  note: string | null;
  photo_path: string;
  shop_path: string | null;
}

export interface TopTeasResponse {
  can_edit: boolean;
  picks: TopTeaPick[];
  shop_link_slots?: TopTeaSlot[];
}

export interface TopTeaShopOption {
  id: string;
  name: string;
  category: typeof TEA_TYPES[number];
  store_name: string;
}
