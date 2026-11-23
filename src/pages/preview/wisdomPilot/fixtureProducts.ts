// Product fixtures for the Tea Wisdom listing pilot (dev-only preview).
// Naka and Aged Ripe Pu-erh mirror the live public records verbatim, read
// 2026-11-23 from /api/products/public/:id. Nothing here is written anywhere.
import type { InventoryItem } from '../../../types';
import type { ListingFacts } from '../../../wisdom/reference/claims';
import { listingFacts, listingFactsFromInventoryItem } from '../../../wisdom/reference/listingFacts';

export interface PilotFixture {
  slug: 'naka' | 'gong-ting-external' | 'type-only';
  title: string;
  /** What the page explains about this fixture. */
  note: string;
  item: InventoryItem;
  /** Facts the Wisdom reader is given. */
  facts: ListingFacts;
  /** Rendered fields hidden on the pilot page, with why. */
  withheld: readonly { field: string; text: string; reason: string }[];
  banner?: string;
  externalReference?: boolean;
  /** Pilot decision: show no "What people often notice" block on this listing. */
  omitStyleReferences?: boolean;
}

const NAKA_PROCESSING = 'This cake is made in the ripe puerh style, called shou in Chinese. Shou is Yunnan\'s dark, wet-piled tea. The picked leaf is heaped damp so heat and microbes ferment it, a step called wo dui, or wet piling. The method was developed in Yunnan in the early 1970s and turns the leaf dark so the tea is drinkable young. After fermentation the leaf is pressed into a cake. In the cup the liquor pours dark and drinks full-bodied and earthy; because the pile process works the leaf heavily, what carries through in a ripe tea is the quality of the starting material rather than the aromatics of the fresh leaf.';
const NAKA_PROCESSING_UNSOURCED = 'In the cup the liquor pours dark and drinks full-bodied and earthy; because the pile process works the leaf heavily, what carries through in a ripe tea is the quality of the starting material rather than the aromatics of the fresh leaf.';
const NAKA_TERROIR = 'The village sits on the eastern side of Huazhu Liangzi mountain, at roughly 1,660 metres. It keeps more than 600 mu of continuous old tea gardens (one mu is about 667 square metres). The trees run between roughly 300 and 500 years old. Leaf from trees this age is called gushu, meaning old-tree: picked from trees far older than the bushes of a plantation.';
const NAKA_TERROIR_TREE_AGE = [
  'The trees run between roughly 300 and 500 years old.',
  'Leaf from trees this age is called gushu, meaning old-tree: picked from trees far older than the bushes of a plantation.',
];
const NAKA_TAGS = ['dark floral', 'smooth sweetness', 'aged wood', 'mineral', 'clean finish'];

function without(text: string, sentences: readonly string[]): string {
  return sentences.reduce((rest, sentence) => rest.replace(sentence, ''), text).replace(/\s{2,}/g, ' ').trim();
}

/** The live Naka record as the shop maps it, before the pilot hides anything. */
export const NAKA_LIVE_ITEM: InventoryItem = {
  id: 'dddd11d2-7357-4d91-86e8-52a99bb47c51',
  slug: 'naka-gushu',
  category: 'tea',
  type: 'Shou Puer',
  form: 'Cake',
  soldInWholeUnits: false,
  name: 'Naka Gushu',
  year: '',
  origin: 'Mengsong, Menghai, Yunnan, China',
  variant: 'Naka Gushu',
  stock_g: 714,
  cost_price: '0',
  price_per_gram: '0.21',
  description: '',
  tags: NAKA_TAGS,
  image: '',
  additionalImages: [],
  chineseName: '那卡古树熟茶',
  lore: 'Naka (那卡) is a Lahu village in Mengsong township, Menghai county, in Xishuangbanna, Yunnan. Its leaf is the tea most associated with the Mengsong tea area and is known throughout Menghai county. Lahu families here also make bamboo-tube tea, a local method of packing fresh leaf into a bamboo tube and roasting it, noted since the Qing period; that tradition is not the format of this cake.',
  showWisdom: true,
  terroir: NAKA_TERROIR,
  processingNotes: NAKA_PROCESSING,
  tasting: {},
  cultivar: null,
};

const AGED_RIPE_ITEM: InventoryItem = {
  id: 'd8b6bcc0-e5d1-4ed1-8cab-67b3bd62d0dc',
  category: 'tea',
  type: 'Shou Puer',
  form: 'Loose Leaf',
  soldInWholeUnits: false,
  name: 'Aged Ripe Pu-erh Tea',
  year: '',
  origin: 'Yunnan, China',
  variant: 'Aged Ripe Pu-erh Tea',
  stock_g: 1000,
  cost_price: '0',
  price_per_gram: '0.4',
  description: '',
  tags: ['mineral', 'woody', 'smooth'],
  image: '',
  additionalImages: [],
  chineseName: '陈年旧熟普',
  lore: 'Puerh is named for the old market town of Pu\'er, the historical trading centre where Yunnan leaf gathered before moving out along the tea-horse roads.',
  showWisdom: true,
  processingNotes: 'Ripe (shou) puerh. After picking and drying, the leaves are heaped in a warm damp pile so heat and moisture build and microbes slowly work through them. This wet-pile method was stabilized in Yunnan in the early 1970s. It shortens the long wait that raw puerh needs and gives a darker, smoother cup from the start. Then aged loose.',
  terroir: 'Born in Yunnan, in the far southwest of China, from the large-leaf tea trees that grow across the province\'s warm subtropical hills.',
  tasting: {},
  cultivar: null,
};

/** The documented external example. Never a product row, never priced. */
const JINGMAI_GONG_TING_ITEM: InventoryItem = {
  id: 'wisdom-pilot-external-jingmai-gong-ting',
  category: 'tea',
  type: 'Shou Puer',
  form: 'Loose',
  name: 'Jingmai Mountain Gong Ting',
  year: '',
  origin: 'Jingmai Mountain, Yunnan, China',
  variant: 'Jingmai Mountain Gong Ting',
  stock_g: 0,
  cost_price: '0',
  description: 'An external reference example: another seller sells this loose ripe pu\'er as Gong Ting grade. It is shown here only to illustrate the grade, and nothing here describes a Teajia lot.',
  tags: [],
  image: '',
  additionalImages: [],
  showWisdom: true,
  tasting: {},
  cultivar: null,
};

export const PILOT_FIXTURES: Record<PilotFixture['slug'], PilotFixture> = {
  naka: {
    slug: 'naka',
    title: 'Naka Gushu · live Teajia lot',
    note: 'The live record, with the fields no source supports hidden on this page only. No taste copy in this pilot.',
    omitStyleReferences: true,
    item: {
      ...NAKA_LIVE_ITEM,
      tags: [],
      processingNotes: without(NAKA_PROCESSING, [NAKA_PROCESSING_UNSOURCED]),
      terroir: without(NAKA_TERROIR, NAKA_TERROIR_TREE_AGE),
    },
    facts: listingFactsFromInventoryItem(NAKA_LIVE_ITEM),
    withheld: [
      { field: 'Tasting tags', text: NAKA_TAGS.join(', '), reason: 'tasting_source is null: nobody is named as having tasted this lot' },
      { field: 'Processing notes', text: NAKA_PROCESSING_UNSOURCED, reason: 'a sensory claim about this lot with no source' },
      { field: 'Terroir', text: NAKA_TERROIR_TREE_AGE.join(' '), reason: 'tree age has no source' },
    ],
  },
  'gong-ting-external': {
    slug: 'gong-ting-external',
    title: 'Jingmai Mountain Gong Ting · external reference example',
    note: 'Not Teajia stock. The grade comes from an explicit fixture field, never from the name.',
    item: JINGMAI_GONG_TING_ITEM,
    facts: listingFacts({
      type: JINGMAI_GONG_TING_ITEM.type,
      form: JINGMAI_GONG_TING_ITEM.form,
      originRegion: JINGMAI_GONG_TING_ITEM.origin,
      name: JINGMAI_GONG_TING_ITEM.name,
      grade: 'gong-ting',
    }),
    withheld: [],
    banner: 'External reference example. Not Teajia stock',
    externalReference: true,
  },
  'type-only': {
    slug: 'type-only',
    title: 'Aged Ripe Pu-erh · type-only fixture',
    note: 'The page shows the live record; the Wisdom reader is given only { type: \'Shou\' }. Origin (Yunnan) and form (loose) are withheld from it.',
    item: AGED_RIPE_ITEM,
    facts: listingFacts({ type: 'Shou' }),
    withheld: [],
  },
};

/** The type-only record's full facts, for the "identical with withheld fields" check. */
export const TYPE_ONLY_FULL_FACTS: ListingFacts = listingFactsFromInventoryItem(AGED_RIPE_ITEM);
