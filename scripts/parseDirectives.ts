/**
 * parseDirectives — convert legacy Story content (`:::DIRECTIVE:::body|body|body`)
 * into structured ArticleBlock[] for the new DbArticle system.
 *
 * Scope: handles directives used by the 5 migration source articles.
 * See docs/ARCHITECTURE.md for the current article-system boundary.
 *
 * Unknown directives throw (loud failure beats silent loss). Add a handler
 * when migrating additional articles requires it.
 */

import type { ArticleBlock } from '../src/types';
import type { Story } from '../src/types';

// ── Per-block character budgets (4:5 page must fit one block) ─────────────
// Tuned to the type sizes in src/pages/ArticlePage.tsx.

// Per-block character budgets. Sized to fit one 4:5 page at the type sizes
// in src/pages/ArticlePage.tsx. Sidebars get more room than body paragraphs
// because they render at a smaller type size.
const BUDGETS = {
  intro:        520,
  paragraph:    560,
  section:      80,
  quote_big:    260,
  quote_min:    180,
  caption:      140,
  recipe_title: 60,
  recipe_step:  180,
  qa_q:         220,
  qa_a:         460,
  poem:         400,
  epilogue:     460,
  definition:   420,
  sidebar:      600,
};

export interface BudgetViolation {
  articleSlug: string;
  blockIndex: number;
  blockType: string;
  field: string;
  budget: number;
  actual: number;
  preview: string;
}

const violations: BudgetViolation[] = [];
let currentSlug = '';
let currentIndex = 0;

function flag(field: string, blockType: string, budget: number, text: string) {
  if (!text) return;
  if (text.length > budget) {
    violations.push({
      articleSlug: currentSlug,
      blockIndex: currentIndex,
      blockType,
      field,
      budget,
      actual: text.length,
      preview: text.slice(0, 80) + (text.length > 80 ? '...' : ''),
    });
  }
}

export function getViolations(): BudgetViolation[] {
  return violations.slice();
}

export function clearViolations() {
  violations.length = 0;
}

// ── Directive handlers ────────────────────────────────────────────────────
// Each handler receives the raw body (everything after ':::DIRECTIVE:::')
// and returns either a single ArticleBlock or an array (for directives that
// produce multiple pages, e.g. Q&A).

type Handler = (rawBody: string) => ArticleBlock | ArticleBlock[];

const handlers: Record<string, Handler> = {
  // ── Covers ──────────────────────────────────────────────────────────────
  COVER_MAIN: (raw) => {
    const [title, subtitle, image] = raw.split('|').map(s => s.trim());
    return { type: 'cover', variant: 'main', title, subtitle, image };
  },
  COVER_PHOTO_INSET: (raw) => {
    const [title, subtitle, image] = raw.split('|').map(s => s.trim());
    return { type: 'cover', variant: 'photo_inset', title, subtitle, image };
  },
  COVER_MINIMAL: (raw) => {
    const [title, subtitle] = raw.split('|').map(s => s.trim());
    return { type: 'cover', variant: 'minimal', title, subtitle };
  },
  COVER_MASTHEAD: (raw) => {
    const [title, subtitle, kicker] = raw.split('|').map(s => s.trim());
    return { type: 'cover', variant: 'masthead', title, subtitle, kicker };
  },

  // ── Chapters ────────────────────────────────────────────────────────────
  CHAPTER_MINIMAL: (raw) => {
    const [title, subtitle] = raw.split('|').map(s => s.trim());
    return { type: 'chapter_divider', variant: 'minimal', title, subtitle };
  },

  // ── Paragraph variants ──────────────────────────────────────────────────
  TEXT_SINGLE_COL:      (raw) => ({ type: 'paragraph', variant: 'single',    text: raw.trim() }),
  TEXT_DROP_CAP:        (raw) => ({ type: 'paragraph', variant: 'drop_cap',  text: raw.trim() }),
  TEXT_JUSTIFIED_NARROW:(raw) => ({ type: 'paragraph', variant: 'justified', text: raw.trim() }),
  TEXT_CENTER_NARROW:   (raw) => ({ type: 'paragraph', variant: 'center',    text: raw.trim() }),

  // Two-column legacy. Format: "HeadingA|BodyA\n\nHeadingB|BodyB"
  // Each column becomes section_heading + paragraph. The double-newline is
  // the column separator; the pipe is the heading/body separator within
  // a column.
  TEXT_DOUBLE_COL: (raw) => {
    const columns = raw.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
    const out: ArticleBlock[] = [];
    for (const col of columns) {
      const pipeIdx = col.indexOf('|');
      if (pipeIdx > 0) {
        const heading = col.slice(0, pipeIdx).trim();
        const body = col.slice(pipeIdx + 1).trim();
        if (heading) out.push({ type: 'section_heading', text: heading });
        if (body) out.push({ type: 'paragraph', variant: 'single', text: body });
      } else {
        out.push({ type: 'paragraph', variant: 'single', text: col });
      }
    }
    return out.length ? out : { type: 'paragraph', variant: 'single', text: raw.trim() };
  },

  // ── Sidebars ────────────────────────────────────────────────────────────
  // Legacy format: title|sidebarBody  (with optional |imageUrl for SIDEBAR_IMAGE)
  // The "body" field on pull_sidebar holds the title/heading; "sidebar" holds
  // the long-form aside content. The 4:5 page renders the title prominently.
  TEXT_SIDEBAR_LEFT: (raw) => {
    const [title, sidebar] = raw.split('|').map(s => s.trim());
    return { type: 'pull_sidebar', side: 'left', body: title, sidebar };
  },
  TEXT_SIDEBAR_RIGHT: (raw) => {
    const [title, sidebar] = raw.split('|').map(s => s.trim());
    return { type: 'pull_sidebar', side: 'right', body: title, sidebar };
  },
  TEXT_SIDEBAR_IMAGE: (raw) => {
    const parts = raw.split('|').map(s => s.trim());
    return { type: 'pull_sidebar', side: 'image', body: parts[0], sidebar: parts[1] ?? '', image: parts[2] };
  },

  // ── Images ──────────────────────────────────────────────────────────────
  IMG_FULL_BLEED: (raw) => {
    const [description, url] = raw.split('|').map(s => s.trim());
    return { type: 'image', variant: 'full_bleed', url, description };
  },
  IMG_WITH_CAPTION_BOTTOM: (raw) => {
    const [description, url] = raw.split('|').map(s => s.trim());
    return { type: 'image', variant: 'caption_bottom', url, description, caption: description };
  },
  IMG_SPLIT_VERTICAL: (raw) => {
    const [description, ...urls] = raw.split('|').map(s => s.trim()).filter(Boolean);
    return { type: 'image', variant: 'split_vertical', images: urls, description };
  },
  IMG_FILM_STRIP_VERTICAL: (raw) => {
    const [description, ...urls] = raw.split('|').map(s => s.trim()).filter(Boolean);
    return { type: 'image', variant: 'film_strip', images: urls, description };
  },
  IMG_POLAROID_SCATTER: (raw) => {
    const [description, ...urls] = raw.split('|').map(s => s.trim()).filter(Boolean);
    return { type: 'image', variant: 'polaroid_scatter', images: urls, description };
  },
  IMG_CIRCLE_MASK: (raw) => {
    const [description, url] = raw.split('|').map(s => s.trim());
    return { type: 'image', variant: 'circle_mask', url, description };
  },
  IMG_ARCH_MASK: (raw) => {
    const [description, url] = raw.split('|').map(s => s.trim());
    return { type: 'image', variant: 'arch_mask', url, description };
  },

  // ── Quotes ──────────────────────────────────────────────────────────────
  QUOTE_BIG: (raw) => {
    const [textRaw] = raw.split('|').map(s => s.trim());
    // Legacy format sometimes appends attribution after an em-dash. Honor that.
    const splitIdx = textRaw.lastIndexOf(' — ');
    if (splitIdx > 0 && splitIdx > textRaw.length - 80) {
      return {
        type: 'quote',
        variant: 'big',
        text: textRaw.slice(0, splitIdx).trim(),
        attribution: textRaw.slice(splitIdx + 3).trim(),
      };
    }
    return { type: 'quote', variant: 'big', text: textRaw };
  },
  QUOTE_MINIMAL: (raw) => {
    const [text, attribution] = raw.split('|').map(s => s.trim());
    return { type: 'quote', variant: 'minimal', text, attribution };
  },

  // ── Q&A ─────────────────────────────────────────────────────────────────
  // Legacy format: pairs of lines, each prefixed by speaker:
  //   Chen|Question text
  //   Lin|Answer text
  // We group consecutive Q-A pairs into one `qa_pair` block (the new reader
  // paginates them).
  MAGAZINE_INTERVIEW_Q_A: (raw) => {
    const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
    const items: Array<{ q: string; a: string }> = [];
    let q = '';
    for (const line of lines) {
      const idx = line.indexOf('|');
      if (idx < 0) continue;
      const content = line.slice(idx + 1).trim();
      if (!q) {
        q = content;
      } else {
        items.push({ q, a: content });
        q = '';
      }
    }
    return { type: 'qa_pair', items };
  },

  // ── Recipe ──────────────────────────────────────────────────────────────
  // Format: title|step1|step2|step3...
  // Step text may include "Vessel: ..." or "Leaf: ..." prefix; we keep as-is.
  RECIPE_CARD: (raw) => {
    const parts = raw.split('|').map(s => s.trim()).filter(Boolean);
    const [title, ...rest] = parts;
    // Heuristic: if a step contains ':' it's an ingredient-style line
    // (Vessel, Leaf, Water). Otherwise it's a step. The legacy format
    // mixes them so we don't try to be clever — treat all as steps.
    return { type: 'recipe', title, ingredients: [], steps: rest };
  },

  // ── Stat / definition ───────────────────────────────────────────────────
  STAT_BIG_NUMBER: (raw) => {
    const [value, label, context] = raw.split('|').map(s => s.trim());
    return { type: 'stat', value, label, context };
  },
  DEFINITION_LARGE: (raw) => {
    const [term, body, etymology] = raw.split('|').map(s => s.trim());
    return { type: 'definition', term, body, etymology };
  },

  // ── Tasting notes ───────────────────────────────────────────────────────
  // Format: label|note|label|note|...
  TASTING_NOTES_GRID: (raw) => {
    const parts = raw.split('|').map(s => s.trim()).filter(Boolean);
    const items: Array<{ label: string; note: string }> = [];
    for (let i = 0; i + 1 < parts.length; i += 2) {
      items.push({ label: parts[i], note: parts[i + 1] });
    }
    return { type: 'tasting_notes', items };
  },

  // ── Lists ───────────────────────────────────────────────────────────────
  LIST_CHECKLIST: (raw) => {
    const parts = raw.split('|').map(s => s.trim()).filter(Boolean);
    const [title, ...items] = parts;
    return { type: 'list', variant: 'checklist', title, items };
  },

  // ── Maps ────────────────────────────────────────────────────────────────
  // Format: title|location|location|location...
  MAP_CARTOGRAPHY: (raw) => {
    const parts = raw.split('|').map(s => s.trim()).filter(Boolean);
    const [title, ...locations] = parts;
    return { type: 'map', caption: title, locations };
  },

  // ── Embeds ──────────────────────────────────────────────────────────────
  // Format: prose|externalId|caption|description
  // The prose becomes a paragraph block (preserves the article's voice);
  // the embed becomes its own page.
  TEXT_WITH_VIDEO: (raw) => {
    const [prose, externalId, caption, description] = raw.split('|').map(s => s.trim());
    const out: ArticleBlock[] = [];
    if (prose) out.push({ type: 'paragraph', variant: 'single', text: prose });
    if (externalId) {
      out.push({ type: 'embed', platform: 'youtube', externalId, caption, description });
    }
    return out;
  },

  // ── Poetry ──────────────────────────────────────────────────────────────
  POEM_CENTERED: (raw) => ({ type: 'poem', variant: 'centered', text: raw.trim() }),

  // ── Epilogue / dedication / copyright ──────────────────────────────────
  EPILOGUE_CENTERED: (raw) => {
    const [text, signature] = raw.split('|').map(s => s.trim());
    return { type: 'epilogue', text, signature };
  },
  DEDICATION_SIMPLE: (raw) => ({
    type: 'back_matter',
    variant: 'dedication',
    lines: raw.split('\n').map(s => s.trim()).filter(Boolean),
  }),
  COPYRIGHT_PAGE: (raw) => ({
    type: 'back_matter',
    variant: 'copyright',
    lines: raw.split('\n').map(s => s.trim()).filter(Boolean),
  }),
};

// ── Main parser ───────────────────────────────────────────────────────────

const DIRECTIVE_RE = /^:::([A-Z_]+):::([\s\S]*)$/;

export function parseStoryToBlocks(story: Story, slug: string): ArticleBlock[] {
  currentSlug = slug;
  const out: ArticleBlock[] = [];
  const content = story.content ?? [];

  // Promote story.description to an intro block if present and there's no
  // explicit intro directive in the content.
  if (story.description) {
    out.push({ type: 'intro', text: story.description });
    flag('text', 'intro', BUDGETS.intro, story.description);
  }

  content.forEach((item, idx) => {
    currentIndex = idx;
    const m = item.match(DIRECTIVE_RE);
    if (!m) {
      // Plain paragraph fallback (rare in real content, but possible)
      const text = item.trim();
      if (!text) return;
      out.push({ type: 'paragraph', variant: 'single', text });
      flag('text', 'paragraph', BUDGETS.paragraph, text);
      return;
    }
    const [, directive, rawBody] = m;
    const handler = handlers[directive];
    if (!handler) {
      throw new Error(
        `[parseDirectives] No handler for :::${directive}::: in article "${slug}" (block ${idx}). ` +
        `Add a handler in scripts/parseDirectives.ts.`,
      );
    }
    const result = handler(rawBody.trim());
    const blocks = Array.isArray(result) ? result : [result];

    // Run budget validation on each block's text-bearing fields
    blocks.forEach(b => {
      validateBudgets(b);
      out.push(b);
    });
  });

  return out;
}

function validateBudgets(block: ArticleBlock) {
  switch (block.type) {
    case 'intro':
      flag('text', 'intro', BUDGETS.intro, block.text);
      break;
    case 'paragraph':
      flag('text', `paragraph(${block.variant ?? 'single'})`, BUDGETS.paragraph, block.text);
      break;
    case 'section_heading':
      flag('text', 'section_heading', BUDGETS.section, block.text);
      break;
    case 'quote': {
      const budget = block.variant === 'minimal' ? BUDGETS.quote_min : BUDGETS.quote_big;
      flag('text', `quote(${block.variant ?? 'big'})`, budget, block.text);
      break;
    }
    case 'image':
      if (block.caption) flag('caption', 'image', BUDGETS.caption, block.caption);
      break;
    case 'qa_pair':
      block.items.forEach((item, i) => {
        flag(`items[${i}].q`, 'qa_pair', BUDGETS.qa_q, item.q);
        flag(`items[${i}].a`, 'qa_pair', BUDGETS.qa_a, item.a);
      });
      break;
    case 'recipe':
      flag('title', 'recipe', BUDGETS.recipe_title, block.title);
      block.steps.forEach((s, i) => flag(`steps[${i}]`, 'recipe', BUDGETS.recipe_step, s));
      break;
    case 'definition':
      flag('body', 'definition', BUDGETS.definition, block.body);
      break;
    case 'epilogue':
      flag('text', 'epilogue', BUDGETS.epilogue, block.text);
      break;
    case 'poem':
      flag('text', 'poem', BUDGETS.poem, block.text);
      break;
    case 'pull_sidebar':
      flag('body', 'pull_sidebar', BUDGETS.paragraph, block.body);
      flag('sidebar', 'pull_sidebar', BUDGETS.sidebar, block.sidebar);
      break;
  }
}
