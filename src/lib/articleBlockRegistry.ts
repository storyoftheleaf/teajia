import type { ArticleBlock, ArticleTextEffect, ImageVariant } from '../types';

export type ArticleBlockType = ArticleBlock['type'];

// ─── AR.5 authoring catalogs ───────────────────────────────────────────────
// Plain-language option lists for the block-stack editor. These name the
// text-effect dials and image layouts a block can carry, with a short, human
// label (no jargon, no file names) so the dropdowns read as design choices.

export const TEXT_EFFECT_OPTIONS: { value: ArticleTextEffect; label: string }[] = [
  { value: 'scroll-highlight', label: 'Scroll highlight (words brighten)' },
  { value: 'none', label: 'None (plain reading)' },
  { value: 'word-rise', label: 'Words rise in sequence' },
  { value: 'blur-focus', label: 'Blur into focus' },
  { value: 'line-stagger', label: 'Line by line' },
  { value: 'shimmer', label: 'Gradient shimmer' },
  { value: 'scale-jump', label: 'Scale-jump opener' },
  { value: 'color-wipe', label: 'Bronze color wipe' },
  { value: 'underline-draw', label: 'Underline draws on' },
  { value: 'letter-expand', label: 'Letters spread open' },
];

// Text-effects that read well on a heading vs. on body prose. Headings have no
// continuous scroll-highlight, so that option is omitted from the heading list.
export const PROSE_TEXT_EFFECTS: ArticleTextEffect[] = [
  'scroll-highlight', 'none', 'word-rise', 'blur-focus', 'letter-expand',
];
export const HEADING_TEXT_EFFECTS: ArticleTextEffect[] = [
  'none', 'shimmer', 'scale-jump', 'color-wipe', 'underline-draw', 'letter-expand', 'line-stagger',
];

// Which block types accept a text-effect dial in the editor.
export const TEXT_EFFECT_BLOCK_TYPES: ArticleBlockType[] = ['intro', 'paragraph', 'section_heading'];

// Image layout choices, named for the immersive reader's visual family. The
// stored value is the existing ImageVariant (no new block type).
export const IMAGE_LAYOUT_OPTIONS: { value: ImageVariant; label: string }[] = [
  { value: 'full_bleed', label: 'Full-bleed (edge to edge, ken-burns)' },
  { value: 'caption_bottom', label: 'Inline (sits in the reading flow)' },
  { value: 'split_vertical', label: 'Split diptych (two side by side)' },
  { value: 'film_strip', label: 'Swipe gallery (snap-scroll row)' },
  { value: 'book_plate', label: 'Book plate (quiet fine-press frame)' },
  { value: 'pinned_hero', label: 'Pinned hero (held image, text crosses)' },
];

export function textEffectOptionsFor(type: ArticleBlockType): { value: ArticleTextEffect; label: string }[] {
  const allowed = type === 'section_heading' ? HEADING_TEXT_EFFECTS : PROSE_TEXT_EFFECTS;
  return TEXT_EFFECT_OPTIONS.filter(o => allowed.includes(o.value));
}

export type ArticleBlockEditorSupport = 'editable' | 'read_only' | 'planned';

export interface ArticleBlockRegistryEntry {
  type: ArticleBlockType;
  label: string;
  readerSupported: boolean;
  editorSupport: ArticleBlockEditorSupport;
  keeperTemplate: boolean;
  maxChars?: number;
  maxItems?: number;
  intent: string;
}

export const ARTICLE_BLOCK_REGISTRY: Record<ArticleBlockType, ArticleBlockRegistryEntry> = {
  cover: {
    type: 'cover',
    label: 'Cover',
    readerSupported: true,
    editorSupport: 'read_only',
    keeperTemplate: true,
    intent: 'Sets the editorial promise and first visual impression of a magazine piece.',
  },
  intro: {
    type: 'intro',
    label: 'Intro',
    readerSupported: true,
    editorSupport: 'editable',
    keeperTemplate: true,
    maxChars: 600,
    intent: 'Opens the reader into the piece with a short, authored point of view.',
  },
  paragraph: {
    type: 'paragraph',
    label: 'Paragraph',
    readerSupported: true,
    editorSupport: 'editable',
    keeperTemplate: true,
    maxChars: 600,
    intent: 'Carries the main editorial narrative one fixed page at a time.',
  },
  section_heading: {
    type: 'section_heading',
    label: 'Section Heading',
    readerSupported: true,
    editorSupport: 'editable',
    keeperTemplate: true,
    maxChars: 120,
    intent: 'Creates rhythm and lets a piece turn without becoming a long scroll.',
  },
  chapter_divider: {
    type: 'chapter_divider',
    label: 'Chapter Divider',
    readerSupported: true,
    editorSupport: 'read_only',
    keeperTemplate: true,
    maxChars: 160,
    intent: 'Gives longer editorial work a print-like pause and sense of structure.',
  },
  quote: {
    type: 'quote',
    label: 'Pull Quote',
    readerSupported: true,
    editorSupport: 'editable',
    keeperTemplate: true,
    maxChars: 280,
    intent: 'Lets one sentence carry authority, memory, or contrast.',
  },
  image: {
    type: 'image',
    label: 'Image',
    readerSupported: true,
    editorSupport: 'editable',
    keeperTemplate: true,
    intent: 'Lets the real tea, place, person, or material do part of the explaining.',
  },
  qa_pair: {
    type: 'qa_pair',
    label: 'Q&A',
    readerSupported: true,
    editorSupport: 'planned',
    keeperTemplate: true,
    maxItems: 1,
    intent: 'Preserves expert voice and interview texture without flattening it into essay prose.',
  },
  tasting_notes: {
    type: 'tasting_notes',
    label: 'Tasting Notes',
    readerSupported: true,
    editorSupport: 'planned',
    keeperTemplate: true,
    maxItems: 8,
    intent: 'Turns sensory detail into structured language while keeping the authorial palate visible.',
  },
  back_matter: {
    type: 'back_matter',
    label: 'Back Matter',
    readerSupported: true,
    editorSupport: 'planned',
    keeperTemplate: true,
    maxItems: 8,
    intent: 'Holds credits, dedication, copyright, or quiet closing notes.',
  },
  pull_sidebar: {
    type: 'pull_sidebar',
    label: 'Sidebar',
    readerSupported: true,
    editorSupport: 'read_only',
    keeperTemplate: false,
    maxChars: 420,
    intent: 'Supports a page with contextual aside material when the piece truly needs it.',
  },
  epilogue: {
    type: 'epilogue',
    label: 'Epilogue',
    readerSupported: true,
    editorSupport: 'read_only',
    keeperTemplate: false,
    maxChars: 600,
    intent: 'Closes a story in an authored register without turning every article into a letter.',
  },
  stat: {
    type: 'stat',
    label: 'Stat',
    readerSupported: true,
    editorSupport: 'read_only',
    keeperTemplate: false,
    intent: 'Highlights one concrete data point when evidence matters.',
  },
  definition: {
    type: 'definition',
    label: 'Definition',
    readerSupported: true,
    editorSupport: 'read_only',
    keeperTemplate: false,
    maxChars: 420,
    intent: 'Defines terms without making the reader leave the article.',
  },
  recipe: {
    type: 'recipe',
    label: 'Recipe',
    readerSupported: true,
    editorSupport: 'read_only',
    keeperTemplate: false,
    maxItems: 8,
    intent: 'Captures preparation when the piece needs practical craft detail.',
  },
  poem: {
    type: 'poem',
    label: 'Poem',
    readerSupported: true,
    editorSupport: 'read_only',
    keeperTemplate: false,
    maxChars: 600,
    intent: 'Allows rare lyrical pages without making lyricism the default voice.',
  },
  map: {
    type: 'map',
    label: 'Map',
    readerSupported: true,
    editorSupport: 'read_only',
    keeperTemplate: false,
    maxItems: 8,
    intent: 'Places tea in geography when origin and movement are central to the piece.',
  },
  list: {
    type: 'list',
    label: 'List',
    readerSupported: true,
    editorSupport: 'read_only',
    keeperTemplate: false,
    maxItems: 8,
    intent: 'Supports timeline or checklist pages without encouraging generic listicles.',
  },
  embed: {
    type: 'embed',
    label: 'Embed',
    readerSupported: true,
    editorSupport: 'read_only',
    keeperTemplate: false,
    intent: 'Attaches outside media only when it is essential to the article.',
  },
  divider: {
    type: 'divider',
    label: 'Divider',
    readerSupported: true,
    editorSupport: 'editable',
    keeperTemplate: false,
    intent: 'Provides a simple breath between pages.',
  },
  comparison: {
    type: 'comparison',
    label: 'Comparison Slider',
    readerSupported: true,
    editorSupport: 'editable',
    keeperTemplate: false,
    intent: 'Sets two states of a tea side by side (steep 1 vs 5) behind a draggable divider. Immersive reader only.',
  },
  audio: {
    type: 'audio',
    label: 'Listen',
    readerSupported: true,
    editorSupport: 'editable',
    keeperTemplate: false,
    intent: 'Offers a read-aloud of the passage with an animated waveform. Immersive reader only.',
  },
  product_link: {
    type: 'product_link',
    label: 'Product Cross-link',
    readerSupported: true,
    editorSupport: 'editable',
    keeperTemplate: false,
    intent: 'Links the read to a tea in the shop (material-flow reference rule: links, never copies). Immersive reader only.',
  },
};

export const EDITABLE_ARTICLE_BLOCK_TYPES = Object.values(ARTICLE_BLOCK_REGISTRY)
  .filter(entry => entry.editorSupport === 'editable')
  .map(entry => entry.type);

export const KEEPER_ARTICLE_BLOCK_TYPES = Object.values(ARTICLE_BLOCK_REGISTRY)
  .filter(entry => entry.keeperTemplate)
  .map(entry => entry.type);

export function getArticleBlockLabel(type: ArticleBlockType): string {
  return ARTICLE_BLOCK_REGISTRY[type]?.label ?? type;
}

export function getArticleBlockEditorSupport(type: ArticleBlockType): ArticleBlockEditorSupport {
  return ARTICLE_BLOCK_REGISTRY[type]?.editorSupport ?? 'read_only';
}
