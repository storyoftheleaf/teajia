// Phase 1 of todo/plans/tea-wisdom-composed-entry.md: two hand-composed
// target entries on live Teajia records (read 2026-11-23 from
// /api/products/public/:id). Every sentence rests on a Wisdom claim or on the
// record's own fields; nothing is read from the name. Dev-only preview.
import type { InventoryItem } from '../../../types';
import type { ComposedEntry } from '../../../wisdom/reference/composedEntry';
import { NAKA_LIVE_ITEM } from './fixtureProducts';

export interface ComposedFixture {
  slug: 'naka' | 'ripe-brick';
  title: string;
  note: string;
  item: InventoryItem;
  entry: ComposedEntry;
}

/** Fields the entry now speaks for are cleared, so the page reads as one entry. */
const cleared = { description: '', lore: '', terroir: '', processingNotes: '' } as const;

const RIPE_BRICK_ITEM: InventoryItem = {
  id: '28436463-2272-4f68-83e1-b6d86f798be2',
  category: 'tea',
  type: 'Shou Puer',
  form: 'Brick',
  soldInWholeUnits: false,
  name: 'Ripe Puerh Brick',
  year: '1990',
  origin: 'Yunnan, China',
  variant: 'Ripe Puerh Brick',
  stock_g: 500,
  cost_price: '0',
  price_per_gram: '0.84',
  tags: ['mineral', 'woody', 'smooth'],
  image: '',
  additionalImages: [],
  chineseName: '1990年砖熟普',
  showWisdom: true,
  tasting: {},
  cultivar: null,
  ...cleared,
};

export const COMPOSED_FIXTURES: Record<ComposedFixture['slug'], ComposedFixture> = {
  naka: {
    slug: 'naka',
    title: 'Naka Gushu · composed entry',
    note: 'Place and type layers. No year on the record, so no age paragraph; no taste copy on this lot.',
    item: { ...NAKA_LIVE_ITEM, tags: [], ...cleared },
    entry: {
      productId: NAKA_LIVE_ITEM.id,
      paragraphs: [
        { layer: 'place', text: 'Naka is a Lahu village in the north of [Mengsong](menghai-county:mengsong-naka), close to Huazhu Liangzi, the highest peak in Xishuangbanna. Mengsong lies in the east of [Menghai County](menghai-county:scope), across the Liusha River from Nannuo, and Naka is the tea most tied to its name.' },
        { layer: 'type', text: 'This leaf was made into [ripe pu’er](shou:definition): heaped warm and damp in a [fermenting pile](shou:wet-piling), then pressed into a cake, so it drinks dark and soft now rather than after years of waiting.' },
        { layer: 'lot', text: 'Lahu families in Naka also make bamboo-tube tea, packing fresh leaf into bamboo and roasting it over the fire, a local way noted since the Qing period. This cake is a pressed ripe tea, made the other way.' },
      ],
      brewing: { layer: 'brewing', text: 'Ease a piece off the cake along its edge with a pick rather than snapping it. Use boiling water, about 7 grams to 100 ml, one quick rinse, then short steeps that lengthen as the leaf opens.' },
      missing: ['The year it was pressed: unlocks the age paragraph', 'A voice note on where you found it', 'Photos of the cake and the leaf'],
    },
  },
  'ripe-brick': {
    slug: 'ripe-brick',
    title: 'Ripe Puerh Brick · composed entry',
    note: 'A thin record: name, year, type, form, and one line of where it was kept. Lot, age and type layers.',
    item: RIPE_BRICK_ITEM,
    entry: {
      productId: RIPE_BRICK_ITEM.id,
      paragraphs: [
        { layer: 'lot', text: 'A brick of [ripe pu’er](shou:definition) pressed in Yunnan in 1990, which spent the decades since in Guangzhou’s tea trade. That puts it in the style’s first two decades: the [wet-pile method](shou:wet-piling) only reached production in 1973.' },
        { layer: 'age', text: 'At thirty-five years the [smell of the pile](shou:age-young) is long gone. Ripe tea of this age, kept well, grows smooth and deep, with woody, date-like or medicinal notes the trade calls [aged aroma](shou:age-aged), chén xiāng. Storage shapes it as much as the years do.' },
      ],
      brewing: { layer: 'brewing', text: 'Ease a piece off the brick along its edge with a pick rather than snapping it. Use boiling water, about 7 grams to 100 ml, one quick rinse, then short steeps that lengthen as the leaf opens. Old ripe tea like this gives eight or more good cups.' },
      notice: { layer: 'notice', styleName: 'aged ripe pu’er', text: 'A smooth, sweet cup with a dark red liquor and woody notes.' },
      missing: ['A voice note on how it drank for you', 'Photos of the brick and the liquor'],
    },
  },
};
