import type { ArticleBlock } from '../types';

export type ArticleBlockType = ArticleBlock['type'];

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
