// scripts/migrate-articles.ts
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// scripts/parseDirectives.ts
var BUDGETS = {
  intro: 520,
  paragraph: 560,
  section: 80,
  quote_big: 260,
  quote_min: 180,
  caption: 140,
  recipe_title: 60,
  recipe_step: 180,
  qa_q: 220,
  qa_a: 460,
  poem: 400,
  epilogue: 460,
  definition: 420,
  sidebar: 600
};
var violations = [];
var currentSlug = "";
var currentIndex = 0;
function flag(field, blockType, budget, text) {
  if (!text) return;
  if (text.length > budget) {
    violations.push({
      articleSlug: currentSlug,
      blockIndex: currentIndex,
      blockType,
      field,
      budget,
      actual: text.length,
      preview: text.slice(0, 80) + (text.length > 80 ? "..." : "")
    });
  }
}
function getViolations() {
  return violations.slice();
}
function clearViolations() {
  violations.length = 0;
}
var handlers = {
  // ── Covers ──────────────────────────────────────────────────────────────
  COVER_MAIN: (raw) => {
    const [title, subtitle, image] = raw.split("|").map((s) => s.trim());
    return { type: "cover", variant: "main", title, subtitle, image };
  },
  COVER_PHOTO_INSET: (raw) => {
    const [title, subtitle, image] = raw.split("|").map((s) => s.trim());
    return { type: "cover", variant: "photo_inset", title, subtitle, image };
  },
  COVER_MINIMAL: (raw) => {
    const [title, subtitle] = raw.split("|").map((s) => s.trim());
    return { type: "cover", variant: "minimal", title, subtitle };
  },
  COVER_MASTHEAD: (raw) => {
    const [title, subtitle, kicker] = raw.split("|").map((s) => s.trim());
    return { type: "cover", variant: "masthead", title, subtitle, kicker };
  },
  // ── Chapters ────────────────────────────────────────────────────────────
  CHAPTER_MINIMAL: (raw) => {
    const [title, subtitle] = raw.split("|").map((s) => s.trim());
    return { type: "chapter_divider", variant: "minimal", title, subtitle };
  },
  // ── Paragraph variants ──────────────────────────────────────────────────
  TEXT_SINGLE_COL: (raw) => ({ type: "paragraph", variant: "single", text: raw.trim() }),
  TEXT_DROP_CAP: (raw) => ({ type: "paragraph", variant: "drop_cap", text: raw.trim() }),
  TEXT_JUSTIFIED_NARROW: (raw) => ({ type: "paragraph", variant: "justified", text: raw.trim() }),
  TEXT_CENTER_NARROW: (raw) => ({ type: "paragraph", variant: "center", text: raw.trim() }),
  // Two-column legacy. Format: "HeadingA|BodyA\n\nHeadingB|BodyB"
  // Each column becomes section_heading + paragraph. The double-newline is
  // the column separator; the pipe is the heading/body separator within
  // a column.
  TEXT_DOUBLE_COL: (raw) => {
    const columns = raw.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
    const out = [];
    for (const col of columns) {
      const pipeIdx = col.indexOf("|");
      if (pipeIdx > 0) {
        const heading = col.slice(0, pipeIdx).trim();
        const body = col.slice(pipeIdx + 1).trim();
        if (heading) out.push({ type: "section_heading", text: heading });
        if (body) out.push({ type: "paragraph", variant: "single", text: body });
      } else {
        out.push({ type: "paragraph", variant: "single", text: col });
      }
    }
    return out.length ? out : { type: "paragraph", variant: "single", text: raw.trim() };
  },
  // ── Sidebars ────────────────────────────────────────────────────────────
  // Legacy format: title|sidebarBody  (with optional |imageUrl for SIDEBAR_IMAGE)
  // The "body" field on pull_sidebar holds the title/heading; "sidebar" holds
  // the long-form aside content. The 4:5 page renders the title prominently.
  TEXT_SIDEBAR_LEFT: (raw) => {
    const [title, sidebar] = raw.split("|").map((s) => s.trim());
    return { type: "pull_sidebar", side: "left", body: title, sidebar };
  },
  TEXT_SIDEBAR_RIGHT: (raw) => {
    const [title, sidebar] = raw.split("|").map((s) => s.trim());
    return { type: "pull_sidebar", side: "right", body: title, sidebar };
  },
  TEXT_SIDEBAR_IMAGE: (raw) => {
    const parts = raw.split("|").map((s) => s.trim());
    return { type: "pull_sidebar", side: "image", body: parts[0], sidebar: parts[1] ?? "", image: parts[2] };
  },
  // ── Images ──────────────────────────────────────────────────────────────
  IMG_FULL_BLEED: (raw) => {
    const [description, url] = raw.split("|").map((s) => s.trim());
    return { type: "image", variant: "full_bleed", url, description };
  },
  IMG_WITH_CAPTION_BOTTOM: (raw) => {
    const [description, url] = raw.split("|").map((s) => s.trim());
    return { type: "image", variant: "caption_bottom", url, description, caption: description };
  },
  IMG_SPLIT_VERTICAL: (raw) => {
    const [description, ...urls] = raw.split("|").map((s) => s.trim()).filter(Boolean);
    return { type: "image", variant: "split_vertical", images: urls, description };
  },
  IMG_FILM_STRIP_VERTICAL: (raw) => {
    const [description, ...urls] = raw.split("|").map((s) => s.trim()).filter(Boolean);
    return { type: "image", variant: "film_strip", images: urls, description };
  },
  IMG_POLAROID_SCATTER: (raw) => {
    const [description, ...urls] = raw.split("|").map((s) => s.trim()).filter(Boolean);
    return { type: "image", variant: "polaroid_scatter", images: urls, description };
  },
  IMG_CIRCLE_MASK: (raw) => {
    const [description, url] = raw.split("|").map((s) => s.trim());
    return { type: "image", variant: "circle_mask", url, description };
  },
  IMG_ARCH_MASK: (raw) => {
    const [description, url] = raw.split("|").map((s) => s.trim());
    return { type: "image", variant: "arch_mask", url, description };
  },
  // ── Quotes ──────────────────────────────────────────────────────────────
  QUOTE_BIG: (raw) => {
    const [textRaw] = raw.split("|").map((s) => s.trim());
    const splitIdx = textRaw.lastIndexOf(" \u2014 ");
    if (splitIdx > 0 && splitIdx > textRaw.length - 80) {
      return {
        type: "quote",
        variant: "big",
        text: textRaw.slice(0, splitIdx).trim(),
        attribution: textRaw.slice(splitIdx + 3).trim()
      };
    }
    return { type: "quote", variant: "big", text: textRaw };
  },
  QUOTE_MINIMAL: (raw) => {
    const [text, attribution] = raw.split("|").map((s) => s.trim());
    return { type: "quote", variant: "minimal", text, attribution };
  },
  // ── Q&A ─────────────────────────────────────────────────────────────────
  // Legacy format: pairs of lines, each prefixed by speaker:
  //   Chen|Question text
  //   Lin|Answer text
  // We group consecutive Q-A pairs into one `qa_pair` block (the new reader
  // paginates them).
  MAGAZINE_INTERVIEW_Q_A: (raw) => {
    const lines2 = raw.split("\n").map((l) => l.trim()).filter(Boolean);
    const items = [];
    let q = "";
    for (const line of lines2) {
      const idx = line.indexOf("|");
      if (idx < 0) continue;
      const content = line.slice(idx + 1).trim();
      if (!q) {
        q = content;
      } else {
        items.push({ q, a: content });
        q = "";
      }
    }
    return { type: "qa_pair", items };
  },
  // ── Recipe ──────────────────────────────────────────────────────────────
  // Format: title|step1|step2|step3...
  // Step text may include "Vessel: ..." or "Leaf: ..." prefix; we keep as-is.
  RECIPE_CARD: (raw) => {
    const parts = raw.split("|").map((s) => s.trim()).filter(Boolean);
    const [title, ...rest] = parts;
    return { type: "recipe", title, ingredients: [], steps: rest };
  },
  // ── Stat / definition ───────────────────────────────────────────────────
  STAT_BIG_NUMBER: (raw) => {
    const [value, label, context] = raw.split("|").map((s) => s.trim());
    return { type: "stat", value, label, context };
  },
  DEFINITION_LARGE: (raw) => {
    const [term, body, etymology] = raw.split("|").map((s) => s.trim());
    return { type: "definition", term, body, etymology };
  },
  // ── Tasting notes ───────────────────────────────────────────────────────
  // Format: label|note|label|note|...
  TASTING_NOTES_GRID: (raw) => {
    const parts = raw.split("|").map((s) => s.trim()).filter(Boolean);
    const items = [];
    for (let i = 0; i + 1 < parts.length; i += 2) {
      items.push({ label: parts[i], note: parts[i + 1] });
    }
    return { type: "tasting_notes", items };
  },
  // ── Lists ───────────────────────────────────────────────────────────────
  LIST_CHECKLIST: (raw) => {
    const parts = raw.split("|").map((s) => s.trim()).filter(Boolean);
    const [title, ...items] = parts;
    return { type: "list", variant: "checklist", title, items };
  },
  // ── Maps ────────────────────────────────────────────────────────────────
  // Format: title|location|location|location...
  MAP_CARTOGRAPHY: (raw) => {
    const parts = raw.split("|").map((s) => s.trim()).filter(Boolean);
    const [title, ...locations] = parts;
    return { type: "map", caption: title, locations };
  },
  // ── Embeds ──────────────────────────────────────────────────────────────
  // Format: prose|externalId|caption|description
  // The prose becomes a paragraph block (preserves the article's voice);
  // the embed becomes its own page.
  TEXT_WITH_VIDEO: (raw) => {
    const [prose, externalId, caption, description] = raw.split("|").map((s) => s.trim());
    const out = [];
    if (prose) out.push({ type: "paragraph", variant: "single", text: prose });
    if (externalId) {
      out.push({ type: "embed", platform: "youtube", externalId, caption, description });
    }
    return out;
  },
  // ── Poetry ──────────────────────────────────────────────────────────────
  POEM_CENTERED: (raw) => ({ type: "poem", variant: "centered", text: raw.trim() }),
  // ── Epilogue / dedication / copyright ──────────────────────────────────
  EPILOGUE_CENTERED: (raw) => {
    const [text, signature] = raw.split("|").map((s) => s.trim());
    return { type: "epilogue", text, signature };
  },
  DEDICATION_SIMPLE: (raw) => ({
    type: "back_matter",
    variant: "dedication",
    lines: raw.split("\n").map((s) => s.trim()).filter(Boolean)
  }),
  COPYRIGHT_PAGE: (raw) => ({
    type: "back_matter",
    variant: "copyright",
    lines: raw.split("\n").map((s) => s.trim()).filter(Boolean)
  })
};
var DIRECTIVE_RE = /^:::([A-Z_]+):::([\s\S]*)$/;
function parseStoryToBlocks(story, slug) {
  currentSlug = slug;
  const out = [];
  const content = story.content ?? [];
  if (story.description) {
    out.push({ type: "intro", text: story.description });
    flag("text", "intro", BUDGETS.intro, story.description);
  }
  content.forEach((item, idx) => {
    currentIndex = idx;
    const m = item.match(DIRECTIVE_RE);
    if (!m) {
      const text = item.trim();
      if (!text) return;
      out.push({ type: "paragraph", variant: "single", text });
      flag("text", "paragraph", BUDGETS.paragraph, text);
      return;
    }
    const [, directive, rawBody] = m;
    const handler = handlers[directive];
    if (!handler) {
      throw new Error(
        `[parseDirectives] No handler for :::${directive}::: in article "${slug}" (block ${idx}). Add a handler in scripts/parseDirectives.ts.`
      );
    }
    const result = handler(rawBody.trim());
    const blocks = Array.isArray(result) ? result : [result];
    blocks.forEach((b) => {
      validateBudgets(b);
      out.push(b);
    });
  });
  return out;
}
function validateBudgets(block) {
  switch (block.type) {
    case "intro":
      flag("text", "intro", BUDGETS.intro, block.text);
      break;
    case "paragraph":
      flag("text", `paragraph(${block.variant ?? "single"})`, BUDGETS.paragraph, block.text);
      break;
    case "section_heading":
      flag("text", "section_heading", BUDGETS.section, block.text);
      break;
    case "quote": {
      const budget = block.variant === "minimal" ? BUDGETS.quote_min : BUDGETS.quote_big;
      flag("text", `quote(${block.variant ?? "big"})`, budget, block.text);
      break;
    }
    case "image":
      if (block.caption) flag("caption", "image", BUDGETS.caption, block.caption);
      break;
    case "qa_pair":
      block.items.forEach((item, i) => {
        flag(`items[${i}].q`, "qa_pair", BUDGETS.qa_q, item.q);
        flag(`items[${i}].a`, "qa_pair", BUDGETS.qa_a, item.a);
      });
      break;
    case "recipe":
      flag("title", "recipe", BUDGETS.recipe_title, block.title);
      block.steps.forEach((s, i) => flag(`steps[${i}]`, "recipe", BUDGETS.recipe_step, s));
      break;
    case "definition":
      flag("body", "definition", BUDGETS.definition, block.body);
      break;
    case "epilogue":
      flag("text", "epilogue", BUDGETS.epilogue, block.text);
      break;
    case "poem":
      flag("text", "poem", BUDGETS.poem, block.text);
      break;
    case "pull_sidebar":
      flag("body", "pull_sidebar", BUDGETS.paragraph, block.body);
      flag("sidebar", "pull_sidebar", BUDGETS.sidebar, block.sidebar);
      break;
  }
}

// src/content/people.ts
var PEOPLE = {
  chen: {
    id: "chen",
    name: "Chen Wei",
    role: "Senior Editor",
    bio: "A native of Hangzhou, Chen has spent the last decade documenting the disappearing oral histories of tea farmers along the Yangtze river.",
    avatarUrl: "https://picsum.photos/200/200?random=101"
  },
  lin: {
    id: "lin",
    name: "Master Lin",
    role: "Ceramicist",
    bio: "Born into a family of Yixing potters dating back to the Qing dynasty, Master Lin advocates for the return to raw, unpurified clay in modern teaware.",
    avatarUrl: "https://picsum.photos/200/200?random=102"
  },
  sarah: {
    id: "sarah",
    name: "Sarah Jenkins",
    role: "Cultural Anthropologist",
    bio: 'Sarah studies the intersection of ritual and community space. Her work explores how tea houses function as "third places" in modern urban China.',
    avatarUrl: "https://picsum.photos/200/200?random=103"
  },
  zhou: {
    id: "zhou",
    name: "Zhou Yu",
    role: "Tea Master",
    bio: "Guardian of the Wuyi heritage strains, Master Zhou still processes his oolongs entirely by hand using traditional charcoal roasting techniques.",
    avatarUrl: "https://picsum.photos/200/200?random=104"
  },
  li: {
    id: "li",
    name: "Li Jun",
    role: "Filmmaker",
    bio: "An award-winning cinematographer known for his slow-cinema approach to nature documentaries.",
    avatarUrl: "https://picsum.photos/200/200?random=105"
  },
  barry: {
    id: "barry",
    name: "Barry",
    role: "Tea Teacher",
    bio: "Twenty-eight years of practice rooted in the Bali East Circuit, where Barry has built a quiet reputation as one of the region's most grounded tea teachers. His approach is steeped in traditional gongfu methodology, passed down through direct lineage and refined through years of sourcing and session work across Southeast Asia. Known within the local Bali tea community for bridging cultural depth with accessibility \u2014 making serious tea practice feel human.",
    avatarUrl: void 0
  }
};
var PEOPLE_DIRECTORY = Object.values(PEOPLE).map((person) => ({
  ...person,
  authoredArticles: [],
  offerings: [],
  externalLink: void 0
}));

// src/content/articles/travel-feature-video.ts
var travelFeatureVideo = {
  id: "template-travel-video",
  type: "Article" /* Article */,
  status: "published",
  title: "Into the Wuyi Mountains",
  subtitle: "A Tea Pilgrimage to Fujian",
  thumbnailUrl: "https://images.unsplash.com/photo-1523920290228-4f321a939b4c?w=800&h=1200&fit=crop",
  durationOrTime: "18 Pages",
  origin: "In-house",
  description: "A pilgrimage to the birthplace of rock oolong, following Master Zhou through Fujian's ancient ravines.",
  tags: ["Oolong", "China", "Fujian", "Sourcing"],
  content: [
    ":::COVER_MAIN:::Into the Wuyi Mountains|A Tea Pilgrimage to Fujian|https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=800&h=1200&fit=crop",
    ":::TEXT_DROP_CAP:::The overnight train from Fuzhou arrives at Wuyishan North Station just before dawn. Outside the window, the landscape has already changed \u2014 limestone karsts rise from the river valley like the petrified fingers of some ancient hand. The air carries a dampness that feels botanical, thick with the exhalations of ten thousand species of fern and moss and lichen.",
    ":::TEXT_SINGLE_COL:::This is the Wuyi Mountain UNESCO World Heritage Site, a place where geology and botany conspire to produce some of the most celebrated teas on earth. The locals call it yan yun \u2014 the rock rhyme \u2014 that ineffable mineral character that marks a true Wuyi oolong. I have come to understand where that flavor begins.",
    ":::IMG_FULL_BLEED:::Dawn breaks over the Nine Bend River, Wuyi Mountains|https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=800&h=1200&fit=crop",
    ":::TEXT_WITH_VIDEO:::Our first morning begins with Master Zhou Yu, a third-generation tea maker whose family has tended plots along Huiyuan Keng since the 1940s. He meets us at the trailhead wearing rubber boots and carrying a bamboo basket. The path narrows quickly, winding between moss-covered boulders. Zhou points to tea bushes growing from a crack in the cliff face. 'Rou Gui,' he says. 'But here, because of this rock, this exact angle of sun \u2014 it becomes something else entirely.'|dQw4w9WgXcQ|Master Zhou guides us through Huiyuan Keng|The narrow ravine channels moisture and minerals to the tea bushes growing from the cliff walls.",
    ":::IMG_WITH_CAPTION_BOTTOM:::Tea growing from ancient cliff faces|https://images.unsplash.com/photo-1582793988951-9aed5509eb97?w=800&h=1200&fit=crop",
    ":::TEXT_SINGLE_COL:::The concept of terroir in tea mirrors that of wine, but in Wuyi it reaches an almost absurd level of specificity. Two bushes of the same cultivar planted fifty meters apart will produce teas so different they might as well be separate varieties. This is zhengyan \u2014 true rock tea \u2014 and it commands prices ten to fifty times higher than the same cultivar grown in the flatlands below.",
    ":::TEXT_DOUBLE_COL:::The Ravines|Wuyi's named ravines \u2014 known as keng or jian \u2014 are the grand crus of Chinese oolong. The most famous include Niulan Keng, Huiyuan Keng, Liuxiang Jian, Wuyuan Jian, and Daoshui Keng. Together these form the core zhengyan production area of perhaps 70 square kilometers. Within this zone, microclimates shift dramatically with every turn of the path.\n\nThe Processing|After picking, the leaves are spread on bamboo trays for initial withering. Then begins zuoqing \u2014 alternating shaking and resting that bruises leaf edges and initiates oxidation. Zhou learned the rhythmic tossing motion from his grandfather. 'The timing is everything,' he says. 'When the fragrance shifts from green to floral, you stop.'",
    ":::QUOTE_BIG:::The mountain does not make the tea. The mountain makes the conditions. The tea makes itself. \u2014 Master Zhou Yu",
    ":::IMG_FULL_BLEED:::The misty ravines of Wuyi|https://images.unsplash.com/photo-1545069122-7236651d5c7e?w=800&h=1200&fit=crop",
    ":::TEXT_WITH_VIDEO:::The charcoal roasting stage is where Wuyi oolong diverges most dramatically from other Chinese teas. Zhou maintains a roasting room with a sunken pit filled with longan wood charcoal covered in rice ash. The temperature is controlled not by thermometer but by palm. Each session lasts six to eight hours, during which Zhou rotates bamboo baskets, occasionally pressing his face into the warm leaves to read their progress through scent. 'Roasting is a conversation,' he tells us. 'The fire speaks, and the tea answers.'|dQw4w9WgXcQ|The art of charcoal roasting in Wuyi|Master Zhou demonstrates the traditional hongbei roasting method passed down through three generations.",
    ":::IMG_SPLIT_VERTICAL:::Left: Fresh leaves after picking. Right: After the third charcoal roast.|https://images.unsplash.com/photo-1563911892437-1feda0179e1b?w=800&h=1200&fit=crop|https://images.unsplash.com/photo-1530968033775-2c92736b131e?w=800&h=1200&fit=crop",
    ":::TEXT_SINGLE_COL:::On our third day, Zhou takes us to see the mother trees \u2014 the original Da Hong Pao bushes that cling to a cliff face above Jiulong Ke. These six bushes, estimated to be over 350 years old, are the most famous tea plants in the world. The last harvest occurred in 2005, yielding just 20 grams that was placed in the National Museum in Beijing.",
    ":::TEXT_JUSTIFIED_NARROW:::Standing below them, I feel the weight of the mythology that sustains this industry. Every Da Hong Pao sold today is a cutting descended from these six plants. The original flavor exists now only in memory and legend. What remains is the aspiration toward it, carried forward in every carefully roasted batch.",
    ":::IMG_CIRCLE_MASK:::Master Zhou Yu at the entrance to Huiyuan Keng|https://images.unsplash.com/photo-1563822249548-9a72b6353cd1?w=800&h=1200&fit=crop",
    ":::RECIPE_CARD:::Wuyi Yancha Gongfu Method|Vessel: 110ml gaiwan or Yixing clay pot.|Leaf: 8g (fill vessel 2/3 with dry leaf).|Water: 100\xB0C \u2014 full boil, always.|Rinse: One quick wash, discard.|Steep 1-3: 10 seconds each.|Steep 4-6: 15 seconds each.|Steep 7+: Add 10 seconds per round.|Expect 8-12 quality steeps from true zhengyan material.",
    ":::TEXT_SIDEBAR_RIGHT:::Evening Sessions|Each night, Zhou hosts an informal tasting session on his veranda. A clay tea tray, a kettle over charcoal, and a row of small white cups. He lines up four or five teas and pours them in silence. We taste without speaking, letting the liquor coat our tongues. Only after everyone has tasted does the discussion begin. These sessions stretch past midnight, fueled by the kind of unhurried conversation possible only where the nearest city is three hours away.|https://images.unsplash.com/photo-1545579133-99bb5ab189bd?w=800&h=1200&fit=crop",
    ":::MAP_CARTOGRAPHY:::Wuyi Mountain Tea Region|Niulan Keng|Huiyuan Keng|Liuxiang Jian|Wuyuan Jian|Daoshui Keng|Zhushao|Shuilian Dong",
    ":::TEXT_DOUBLE_COL:::The Economics|True zhengyan Wuyi oolong occupies a peculiar market position. Premium Niulan Keng Rou Gui can exceed 10,000 RMB per jin ($1,400 USD). Zhou is unusual in selling directly to a small network, cutting out middlemen. 'I produce less than 40 kilograms per year,' he explains. 'I will not sell it to someone who will blend it with flatland tea.'\n\nThe Future|Zhou's daughter studied agriculture at Fujian Normal University and has returned to help. She brings scientific rigor \u2014 soil testing, weather monitoring, controlled experiments \u2014 while her father contributes intuitive knowledge. 'The mountain does not change,' he says. 'But we must learn to speak its language in new ways.'",
    ":::IMG_FULL_BLEED:::The Nine Bend River winds through Wuyi|https://images.unsplash.com/photo-1545069122-7236651d5c7e?w=800&h=1200&fit=crop",
    ":::TEXT_SINGLE_COL:::On our final morning, we hike to the summit of Tianyou Peak. The entire Wuyi landscape unfolds beneath us: the dark ribbon of the Nine Bend River, the terraced tea gardens, the scattered farmhouses sending up threads of smoke.",
    ":::TEXT_CENTER_NARROW:::From this height, the karst peaks look like calligraphy \u2014 bold vertical strokes drawn by a cosmic brush across a green canvas. I think about Zhou's phrase, yan yun, the rock rhyme. Standing here, I finally understand that it refers not just to the flavor of the tea but to the rhythm of this entire landscape \u2014 the way stone and water and leaf and human effort rhyme together across centuries.",
    ":::COPYRIGHT_PAGE:::Words by Chen Wei\nPhotography by Li Jun\nWith gratitude to Master Zhou Yu\nand the tea farmers of Wuyi Mountain\n\nTeajia Magazine"
  ],
  author: PEOPLE.chen,
  interviewee: PEOPLE.zhou
};

// src/content/articles/tea-feature-article.ts
var teaFeatureArticle = {
  id: "template-tea-feature",
  type: "Article" /* Article */,
  status: "published",
  title: "Laoshan Green",
  subtitle: "Where the Mountain Meets the Sea",
  thumbnailUrl: "https://images.unsplash.com/photo-1556881286-fc6915169721?w=800&h=1200&fit=crop",
  durationOrTime: "17 Pages",
  origin: "In-house",
  description: "A coastal green tea from Shandong's granite slopes \u2014 where chestnut sweetness meets the taste of the sea.",
  tags: ["Green", "Sourcing", "China", "Tasting"],
  featured: true,
  category: "tea-feature",
  isFeatured: true,
  endOfArticleCTA: { type: "shop", text: "This tea is in our shop.", linkTarget: "shop" },
  content: [
    ":::COVER_MAIN:::Laoshan Green|\u5D02\u5C71\u7EFF\u8336 \u2014 Where the Mountain Meets the Sea|https://images.unsplash.com/photo-1556881286-fc6915169721?w=800&h=1200&fit=crop",
    ":::TEXT_DROP_CAP:::Most of China's great green teas grow in the misty interior \u2014 the lake regions of Zhejiang, the river valleys of Anhui, the mountain forests of Sichuan. Laoshan Green is the exception that proves every rule. Grown on the granite slopes of Mount Lao in Shandong Province, within sight and smell of the Yellow Sea, this is a coastal tea in the fullest sense.",
    ":::TEXT_SIDEBAR_IMAGE:::The ocean fogs that roll up the mountainside each morning bathe the tea bushes in salt-tinged moisture, while the mineral-dense granite bedrock filters snowmelt through millennia of accumulated stone. The result is a green tea unlike any other \u2014 a tea with structure, with minerality, with what the Chinese call hai wei: the taste of the sea. Laoshan Green is not delicate. It is a tea that announces itself with chestnut sweetness and then reveals layers of vegetal depth, oceanic salinity, and a finish that resonates in the chest.|Coastal tea gardens|https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=800&h=1200&fit=crop",
    ":::MAP_CARTOGRAPHY:::Laoshan, Shandong Province \u2014 36.1\xB0N, 120.6\xB0E \u2014 Elevation 200-800m \u2014 Maritime climate with cold winters and humid summers",
    ":::IMG_FULL_BLEED:::Morning harvest on the eastern slopes of Mount Lao|https://images.unsplash.com/photo-1582793988951-9aed5509eb97?w=800&h=1200&fit=crop",
    ":::TEXT_SIDEBAR_RIGHT:::The Terroir of Laoshan|Laoshan's terroir is defined by three forces: granite, ocean, and altitude. The mountain is a massive granite intrusion rich in feldspar and quartz, weathering into a sandy, well-drained soil with slightly acidic pH \u2014 ideal for Camellia sinensis. The proximity to the Yellow Sea creates a maritime microclimate that moderates temperature extremes. The persistent morning fogs provide natural shade that increases amino acid content.|https://images.unsplash.com/photo-1556881286-fc6915169721?w=800&h=1200&fit=crop",
    ":::DEFINITION_LARGE:::Hai Wei (\u6D77\u5473)|The taste of the sea \u2014 a briny, mineral quality unique to coastal teas. In Laoshan Green, it manifests as a saline undertone that amplifies sweetness and extends the finish.",
    ":::IMG_FULL_BLEED:::Morning harvest on the eastern slopes of Mount Lao \u2014 the Yellow Sea visible through retreating fog|https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=800&h=1200&fit=crop",
    ":::TEXT_DOUBLE_COL:::A History in Brief|Tea cultivation on Mount Lao dates to the Sui Dynasty, roughly the sixth century CE, when Taoist monks planted bushes near their mountain temples. The modern Laoshan tea industry began in 1959 when the Chinese government transplanted cultivars from Zhejiang and Anhui. Many failed \u2014 the winters were too harsh. But those that survived adapted, developing thicker leaves and deeper root systems.\n\nThe Modern Challenge|Laoshan's tea industry faces a familiar tension: artisanal quality versus commercial demand. The best Laoshan Green is picked by hand in spring, processed in small batches using traditional pan-firing. But domestic appetite has grown faster than artisanal production can supply. Our sourcing focuses exclusively on hand-picked, small-batch production from gardens above 400 meters.",
    ":::RECIPE_CARD:::Brewing Guide \u2014 Gongfu Method|5g leaf per 120ml gaiwan|Water: 80\xB0C (176\xB0F) \u2014 lower than most greens|Rinse: 5 seconds, discard|First steep: 30 seconds|Add 10 seconds each subsequent round|Good for 6-8 infusions|Note: Laoshan Green rewards patience. The third and fourth infusions are often the most complex.",
    ":::IMG_CIRCLE_MASK:::The dry leaf \u2014 tightly rolled, dark green with visible white trichomes|https://images.unsplash.com/photo-1563911892437-1feda0179e1b?w=800&h=1200&fit=crop",
    ":::QUOTE_BIG:::Where the mountain meets the sea, the leaf finds a voice that belongs to neither land nor water but to the conversation between them.",
    ":::TEXT_SINGLE_COL:::The flavor profile of Laoshan Green unfolds across multiple infusions like a conversation that deepens with each exchange. The first infusion is direct and immediate \u2014 roasted chestnut sweetness, a clean vegetal note like blanched spinach, and the first hint of that characteristic mineral undertone.",
    ":::IMG_WITH_CAPTION_BOTTOM:::Tea liquor showing the pale gold-green color|https://images.unsplash.com/photo-1530968033775-2c92736b131e?w=800&h=1200&fit=crop",
    ":::TEXT_SINGLE_COL:::By the second infusion, with the leaves now fully hydrated, the tea begins to show its depth. The vegetal notes shift from spinach to artichoke heart. The mineral quality intensifies, and a faint salinity appears \u2014 this is the hai wei, the ocean's signature. The third and fourth infusions are where Laoshan Green truly distinguishes itself, as a thick, almost oily mouthfeel emerges that coats the tongue and lingers in the throat.",
    ":::TASTING_NOTES_GRID:::Aroma: Roasted chestnut, sea breeze, fresh cut grass|Flavor: Sweet corn, artichoke, blanched spinach, mineral salt|Mouthfeel: Medium-full body, oily texture, coating|Finish: Long, saline-sweet, chest-warming|Liquor: Pale gold-green, clear, with slight opalescence|Character: Structured, confident, marine-influenced",
    ":::IMG_WITH_CAPTION_BOTTOM:::The wet leaf after six infusions \u2014 note the intact bud-and-two-leaf sets, evidence of careful hand-picking|https://images.unsplash.com/photo-1563911892437-1feda0179e1b?w=800&h=1200&fit=crop",
    ":::TEXT_SIDEBAR_LEFT:::Sourcing Notes|Our Laoshan Green comes from a family-operated garden on the eastern slope of Mount Lao, at approximately 500 meters elevation. The garden owner, Mr. Zhang, is a second-generation tea farmer. The cultivar is a Laoshan-adapted descendant of Huangshan Zhong. Mr. Zhang picks only the spring flush \u2014 typically a two-week window in late April \u2014 and processes the tea himself using a wood-fired wok. His annual production is less than 200 kilograms.|https://images.unsplash.com/photo-1563822249366-7b0d8e7295cf?w=800&h=1200&fit=crop",
    ":::STAT_BIG_NUMBER:::80,000|Individual hand-plucks required to produce one kilogram of finished Laoshan Green",
    ":::COPYRIGHT_PAGE:::Words by Chen Wei\nPhotography by Li Jun\nTeajia Journal \u2014 Tea Feature Series"
  ],
  author: PEOPLE.chen
};

// src/content/articles/long-form-interview.ts
var longFormInterview = {
  id: "template-interview",
  type: "Article" /* Article */,
  status: "published",
  title: "A Conversation with Master Lin",
  subtitle: "The Yixing Potter",
  thumbnailUrl: "https://images.unsplash.com/photo-1610701596007-11502861dcfa?w=800&h=1200&fit=crop",
  durationOrTime: "20 Pages",
  origin: "In-house",
  description: "Sixty years of clay and fire \u2014 the Yixing master on craft, patience, and the pots that remember.",
  tags: ["Pottery", "Teaware", "Philosophy"],
  content: [
    ":::COVER_PHOTO_INSET:::A Conversation with Master Lin|The Yixing Potter|https://images.unsplash.com/photo-1530968033775-2c92736b131e?w=800&h=1200&fit=crop",
    ":::TEXT_SINGLE_COL:::Master Lin's studio sits at the end of a dirt road on the outskirts of Dingshu, the pottery town that has been the center of Yixing purple clay teaware production for over five hundred years. The building is unremarkable from outside \u2014 a single-story concrete structure with a corrugated metal roof, indistinguishable from the dozens of small workshops that line the roads of this district.",
    ":::TEXT_SIDEBAR_IMAGE:::Inside, the air smells of damp earth and wood shavings. The walls are lined with wooden shelves holding hundreds of teapots in various stages of completion \u2014 some raw, some bisque-fired, some finished and gleaming with the deep, plummy luster that marks authentic zisha clay. Lin sits at a low workbench near the window, his hands wrapped around a cup of aged sheng puer. He is seventy-three years old, has been making teapots since the age of fourteen, and is recognized by the Chinese government as a Provincial-Level Master of Traditional Craft.|Master Lin's workshop|https://images.unsplash.com/photo-1530968033775-2c92736b131e?w=800&h=1200&fit=crop",
    ":::MAGAZINE_INTERVIEW_Q_A:::Chen Wei|You come from a family of potters. How far back does the lineage go?|Master Lin|My grandfather's grandfather was already established in Dingshu by the mid-Qing dynasty \u2014 so perhaps seven or eight generations. But I want to be honest about this. The unbroken lineage narrative is partly mythology. There were disruptions. My grandfather's kiln was destroyed during the Japanese occupation. My father was sent to a collective workshop during the Cultural Revolution.",
    ":::IMG_FULL_BLEED:::Rows of Yixing teapots in various stages of completion|https://images.unsplash.com/photo-1594631252845-29fc4cc8cde9?w=800&h=1200&fit=crop",
    ":::TEXT_CENTER_NARROW:::What survived was not technique \u2014 technique can be relearned from observation and practice. What survived was an attitude toward the clay. A way of listening to the material rather than imposing your will on it. That is the inheritance I received, and it cannot be written in a manual or taught in a school.",
    ":::IMG_SPLIT_VERTICAL:::Left: Lin's hands shaping a spout. Right: Shelves of finished work awaiting selection.|https://images.unsplash.com/photo-1610701596007-11502861dcfa?w=800&h=1200&fit=crop|https://images.unsplash.com/photo-1530968033775-2c92736b131e?w=800&h=1200&fit=crop",
    ":::MAGAZINE_INTERVIEW_Q_A:::Chen Wei|Describe your relationship with the clay itself. You've said before that you only use locally dug zisha. Why is that so important?|Master Lin|Zisha \u2014 purple sand clay \u2014 is not one material but a family of materials. The deposits around Yixing contain at least three major types: zini, the classic purple-brown; duanni, the pale golden variety; and zhuni, the rare vermillion clay. The clay I use comes from a deposit that my family has dug for generations. I know this clay the way a vintner knows their vineyard.",
    ":::QUOTE_BIG:::A teapot is not a container. It is a relationship between earth and water, mediated by fire and shaped by hand. Remove any element and you have an object. Include all four and you have something alive. \u2014 Master Lin",
    ":::TEXT_DOUBLE_COL:::The Workshop|Lin's working method is deliberately anachronistic. While many contemporary Yixing potters use plaster molds, electric wheels, and machine-mixed clay, Lin works entirely by hand using tools that his grandfather would recognize \u2014 bamboo paddles, wooden ribs, horn scrapers. A single teapot takes him three to five days to complete. His annual output is between forty and sixty pieces.\n\nThe Market|The economics of Yixing pottery have been transformed by a speculative market that treats master-crafted teapots as investment vehicles. Pots by nationally recognized masters can sell for six-figure sums. Lin views this with ambivalence. 'The money has brought attention to the craft. But it has also created incentives for fraud \u2014 fake clay, forged seals, ghost-made pots attributed to famous names.'",
    ":::IMG_CIRCLE_MASK:::Portrait of Master Lin at his workbench|https://images.unsplash.com/photo-1578365746405-da4f83b81b3b?w=800&h=1200&fit=crop",
    ":::MAGAZINE_INTERVIEW_Q_A:::Chen Wei|You mentioned ghost-made pots. Can you explain that practice?|Master Lin|It is the worst-kept secret in Yixing. A famous master cannot possibly meet the demand for their work through their own hands alone. So they employ assistants to make pots in their style, which the master then finishes, signs, and sells as their own. I have always refused. When you buy a pot with my seal, every mark on it was made by my hands. This is my promise.",
    ":::IMG_FULL_BLEED:::A row of finished zisha teapots catching afternoon light|https://images.unsplash.com/photo-1594631252845-29fc4cc8cde9?w=800&h=1200&fit=crop",
    ":::MAGAZINE_INTERVIEW_Q_A:::Chen Wei|How do you think about innovation within a traditional craft?|Master Lin|This question assumes that tradition and innovation are opposites. They are not. Tradition is a river, not a wall. It flows. It changes course. The classic Yixing forms were themselves innovations when they were first created. Someone looked at the existing vocabulary and added a new word.",
    ":::TEXT_CENTER_NARROW:::The narrow path between \u2014 where you understand the rules so deeply that you can break them meaningfully \u2014 that is where the interesting work happens. I have spent sixty years learning the rules. Only in the last ten have I felt qualified to break them.",
    ":::IMG_WITH_CAPTION_BOTTOM:::Lin's recent experimental forms \u2014 traditional clay, contemporary vision|https://images.unsplash.com/photo-1530968033775-2c92736b131e?w=800&h=1200&fit=crop",
    ":::TEXT_SIDEBAR_LEFT:::On Seasoning|One of the most discussed aspects of Yixing teaware is the concept of seasoning \u2014 yanghu in Chinese, literally 'nourishing the pot.' Because zisha clay is porous, it absorbs the oils and compounds from each brewing. Over years of use, the pot develops a patina. Lin is categorical: 'One pot, one tea. Never brew different types of tea in the same pot. The clay will become confused. I have pots that have brewed nothing but aged puer for thirty years. Pour plain hot water into them and the water comes out tasting of tea. That is a pot that has achieved its purpose.'|https://images.unsplash.com/photo-1594631252845-29fc4cc8cde9?w=800&h=1200&fit=crop",
    ":::IMG_FILM_STRIP_VERTICAL:::The making process: slab preparation, body forming, spout attachment, lid fitting|https://images.unsplash.com/photo-1530968033775-2c92736b131e?w=800&h=1200&fit=crop|https://images.unsplash.com/photo-1587825140708-dfaf72ae4b04?w=800&h=1200&fit=crop|https://images.unsplash.com/photo-1594631252845-29fc4cc8cde9?w=800&h=1200&fit=crop|https://images.unsplash.com/photo-1530968033775-2c92736b131e?w=800&h=1200&fit=crop",
    ":::TEXT_SINGLE_COL:::As the afternoon light shifts in Lin's studio, he returns to his workbench and resumes work on a pot he started that morning \u2014 a small, round-bodied piece intended for Dancong oolong. He works in silence, his hands moving with a precision that looks effortless but represents six decades of motor learning.",
    ":::TEXT_JUSTIFIED_NARROW:::The bamboo paddle strikes the clay slab with a rhythm that is almost musical \u2014 tap, rotate, tap, rotate \u2014 gradually curving the flat sheet into a cylinder. He joins the edges with a slip of liquid clay, smoothing the seam with his thumb until it vanishes. Then he begins the compression, tapping the walls thinner and thinner, coaxing the cylinder into a sphere. The clay responds to his touch like a living thing. Watching his hands, I understand what he means about listening to the material.",
    ":::MAGAZINE_INTERVIEW_Q_A:::Chen Wei|What advice would you give to a young person who wants to pursue Yixing pottery seriously?|Master Lin|First, learn to dig clay. Before you touch a tool, go to the mines and understand where the material comes from. Second, find a teacher who will let you fail. My grandfather made me throw away my first two years of work. He said: 'Those pots were made by your ambition. When you can make a pot with your patience, you will know.' Third, use your own pots. Brew tea in them every day. Live with their flaws.",
    ":::IMG_ARCH_MASK:::Master Lin's personal collection of seasoned pots, some over thirty years old|https://images.unsplash.com/photo-1594631252845-29fc4cc8cde9?w=800&h=1200&fit=crop",
    ":::QUOTE_BIG:::When you can make a pot with your patience, you will know.",
    ":::TEXT_SINGLE_COL:::We leave Lin's studio as the sun drops behind the kiln chimneys of Dingshu. He does not say goodbye. He says: 'Come back in spring. The clay dug after the New Year rains is the best. I will show you.' It is an invitation, but also a statement of continuity. Spring will come. The rains will fall. The clay will be dug. The pots will be made.",
    ":::EPILOGUE_CENTERED:::A master's hands speak\na language older than words.\nClay remembers everything.",
    ":::COPYRIGHT_PAGE:::Interview conducted by Chen Wei\nPhotography by Teajia Studios\nWith gratitude to Master Lin\nfor opening his workshop and his mind.\n\nTeajia Magazine"
  ],
  author: PEOPLE.chen,
  interviewee: PEOPLE.lin
};

// src/content/articles/recipe-and-pairing.ts
var recipeAndPairing = {
  id: "template-recipe",
  type: "Article" /* Article */,
  status: "published",
  title: "Tea in the Kitchen",
  subtitle: "Recipes & Pairings",
  thumbnailUrl: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=1200&fit=crop",
  durationOrTime: "18 Pages",
  origin: "In-house",
  description: "Lapsang-smoked duck, hojicha panna cotta, and a jasmine gimlet \u2014 tea belongs in the kitchen.",
  tags: ["Tasting"],
  content: [
    ":::COVER_MASTHEAD:::Tea in the Kitchen|Recipes & Pairings|https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=1200&fit=crop",
    ":::TEXT_DROP_CAP:::For most of its four-thousand-year history, tea was food before it was beverage. The earliest records from Yunnan describe tea leaves pounded with garlic, salt, and chili into a paste eaten with rice \u2014 a practice that survives today in the lahpet thoke of Myanmar and the miang of northern Thailand. Tang dynasty preparation involved grinding compressed tea cakes into powder and boiling the result with salt, dried orange peel, and ginger.",
    ":::TEXT_SIDEBAR_IMAGE:::This method would horrify modern purists but understood something essential: tea is a culinary ingredient of extraordinary versatility. Its bitterness balances fat. Its tannins cut richness. Its aromatics \u2014 floral, fruity, smoky, marine \u2014 can complement or contrast with virtually any flavor profile. The recipes that follow are explorations of tea's oldest identity: as something you eat, drink, cook with, and share at a table where the line between food and tea dissolves entirely.|Tea leaves and aromatics|https://images.unsplash.com/photo-1563911892437-1feda0179e1b?w=800&h=1200&fit=crop",
    ":::IMG_FULL_BLEED:::Mise en place: tea leaves, aromatics, and seasonal ingredients|https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=800&h=1200&fit=crop",
    ":::TEXT_DOUBLE_COL:::The Principles|Cooking with tea requires understanding a few fundamental principles. First, extraction time matters enormously. Tea releases its compounds in a predictable sequence: amino acids and light aromatics in the first thirty seconds, catechins and body in the next two minutes, heavy tannins and bitterness after three minutes. A broth steeped for sixty seconds will taste completely different from one steeped for five minutes.\n\nFat and Heat|Second, fat is tea's best friend. The aromatic compounds in tea are largely fat-soluble, meaning they bind more readily to butter, oil, and cream than to water. Infusing tea into a fat produces flavors of startling intensity. Third, heat destroys delicacy. The most nuanced aromatics in a fine tea are volatile compounds that evaporate at high temperatures. For dishes where subtlety matters, add tea at the end of cooking or use it in cold preparations.",
    ":::TEXT_SIDEBAR_IMAGE:::Building a tea cooking pantry starts with five essential teas, each chosen for a distinct culinary role. Lapsang Souchong provides deep, piney smoke that works with red meat and dark chocolate. Hojicha offers nuttiness without astringency \u2014 perfect for baking and custards. Jasmine pearl tea brings floral perfume to seafood and light desserts. Aged shou puer contributes earthiness that elevates braises. And ceremonial-grade matcha delivers vivid color and umami.|The tea pantry essentials|https://images.unsplash.com/photo-1530968033775-2c92736b131e?w=800&h=1200&fit=crop",
    ":::RECIPE_CARD:::Lapsang-Smoked Duck Breast|1. Score skin of 2 duck breasts in crosshatch pattern, season generously with salt.|2. Line a wok with foil. Combine 50g Lapsang Souchong, 50g raw rice, 30g brown sugar.|3. Place mixture in wok, set a wire rack above it.|4. Heat on high until mixture begins to smoke heavily.|5. Place duck breasts skin-side up on rack. Cover tightly.|6. Smoke for 12 minutes. Remove duck, rest 5 minutes.|7. Sear skin-side down in a cold pan, render fat on medium heat for 8-10 minutes until deeply golden.|8. Flip, cook 2 minutes for medium-rare. Rest 5 minutes, slice thin.",
    ":::TASTING_NOTES_GRID:::Pairing: Lapsang Souchong|Smoke|Pine|Dried Longan|Campfire|Leather|Caramel",
    ":::IMG_FULL_BLEED:::The art of tea-smoked duck|https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=800&h=1200&fit=crop",
    ":::TEXT_SIDEBAR_RIGHT:::Why This Works|The smoking step uses a technique borrowed from Chinese tea-smoked duck but simplifies it for home kitchens. The Lapsang Souchong leaves release a concentrated pine-tar aroma when heated. The raw rice provides bulk smoke and distributes heat evenly. The brown sugar caramelizes, adding a sweet glaze. The key insight is that the duck is not cooked during the smoking phase \u2014 it is only flavored. The actual cooking happens in the pan afterward, where the rendered fat carries the smoke flavor throughout the meat.|https://images.unsplash.com/photo-1545579133-99bb5ab189bd?w=800&h=1200&fit=crop",
    ":::TEXT_SINGLE_COL:::The result is a duck breast with the depth of a twelve-hour barbecue achieved in under thirty minutes. Serve with wilted greens dressed in sesame oil and a scatter of toasted pine nuts to echo the piney smoke of the tea.",
    ":::IMG_GRID_2x2:::Clockwise from top left: scoring the skin, the smoking setup, rendering in the pan, the finished slice|https://images.unsplash.com/photo-1563911892437-1feda0179e1b?w=800&h=1200&fit=crop|https://images.unsplash.com/photo-1530968033775-2c92736b131e?w=800&h=1200&fit=crop|https://images.unsplash.com/photo-1544432415-6f4ee803d572?w=800&h=1200&fit=crop|https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=800&h=1200&fit=crop",
    ":::RECIPE_CARD:::Hojicha Panna Cotta with Yuzu Curd|Panna Cotta:|1. Heat 400ml heavy cream to just below simmer.|2. Remove from heat, add 20g loose hojicha leaves. Steep 7 minutes.|3. Strain, return to pan. Add 60g sugar, stir to dissolve.|4. Bloom 5g gelatin in 30ml cold water, then stir into warm cream until dissolved.|5. Pour into 4 ramekins. Refrigerate at least 4 hours.|Yuzu Curd:|1. Whisk 3 egg yolks, 80g sugar, 60ml yuzu juice, zest of 2 yuzu.|2. Cook over double boiler, stirring constantly, until thick enough to coat spoon.|3. Remove from heat, whisk in 40g cold butter.|4. Cool, then spoon over set panna cotta.",
    ":::TEXT_SINGLE_COL:::The marriage of hojicha and yuzu is one of those pairings that feels inevitable once you taste it. Hojicha's roasting process eliminates the grassy astringency of green tea and replaces it with a toasty, almost chocolatey warmth \u2014 think caramelized sugar, roasted barley, and a hint of tobacco.",
    ":::TEXT_SIDEBAR_IMAGE:::Yuzu, with its electric citrus acidity and floral complexity, cuts through the richness of the cream while amplifying the tea's aromatic depth. The panna cotta itself should tremble on the spoon \u2014 just barely set, so that the first touch of the tongue causes it to collapse into silk. The hojicha flavor should be present but not aggressive: a warm background note that emerges more fully as the cream warms to body temperature. If the tea flavor is too faint, increase steeping to ten minutes. If too bitter, reduce to five.|Hojicha and yuzu \u2014 a natural pairing|https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=1200&fit=crop",
    ":::LIST_CHECKLIST:::Tea Dessert Pantry Essentials|Ceremonial-grade matcha (for vivid color and clean bitterness)|Hojicha powder (for baking \u2014 more forgiving than leaf)|Jasmine pearls (for infusing into cream and syrup)|Lapsang Souchong (for chocolate pairings and smoking)|Aged shou puer (for caramel and dark fruit desserts)|Osmanthus oolong (for stone fruit and honey desserts)|White peony (for delicate custards and ice cream)",
    ":::RECIPE_CARD:::Jasmine Gimlet|1. Prepare jasmine tea syrup: steep 15g jasmine pearl tea in 200ml hot water (80\xB0C) for 3 minutes. Strain. Dissolve 200g sugar into the warm tea. Cool completely.|2. In a shaker with ice: 60ml London dry gin, 30ml fresh lime juice, 20ml jasmine tea syrup.|3. Shake hard for 15 seconds.|4. Double strain into a chilled coupe glass.|5. Garnish with a single jasmine pearl floated on the surface.",
    ":::IMG_WITH_CAPTION_BOTTOM:::The jasmine gimlet \u2014 where the cocktail hour meets the tea ceremony|https://images.unsplash.com/photo-1544432415-6f4ee803d572?w=800&h=1200&fit=crop",
    ":::QUOTE_MINIMAL:::The best tea pairing is the one that makes you forget you are drinking tea and eating food separately. \u2014 Chen Wei",
    ":::TEXT_DOUBLE_COL:::The Cocktail Connection|Tea and spirits share more chemistry than most bartenders realize. Both are complex infusions \u2014 water passing through plant material to extract flavor. The flavor compounds in tea interact with ethanol in ways that can amplify, mute, or transform both ingredients. Gin, with its botanical backbone, is the most natural spirit partner for tea.\n\nBeyond the Gimlet|Lapsang Souchong makes a remarkable substitute for liquid smoke in whiskey cocktails. Aged puer, cold-brewed and mixed with dark rum and coconut cream, produces something like a tea-inflected Mai Tai. And matcha, whisked into a paste then shaken with vodka and elderflower liqueur, yields a vivid green drink that tastes like a garden in a glass. Treat the tea not as a novelty but as a botanical component on par with herbs and spices.",
    ":::IMG_FULL_BLEED:::The beauty of tea-infused cocktails|https://images.unsplash.com/photo-1594631252845-29fc4cc8cde9?w=800&h=1200&fit=crop",
    ":::TASTING_NOTES_GRID:::Pairing: Jasmine Pearl|Jasmine Flower|Honeysuckle|Chestnut|Sweet Cream|Citrus Peel|Green Grape",
    ":::TEXT_SINGLE_COL:::The deeper principle behind all tea cooking and pairing is this: tea is not a single flavor but a spectrum. Within the six major categories \u2014 green, white, yellow, oolong, red, and dark \u2014 there are thousands of distinct flavor profiles, each the product of cultivar, terroir, season, and processing.",
    ":::TEXT_JUSTIFIED_NARROW:::Learning to cook with tea means learning to navigate this spectrum with the same fluency that a chef applies to their spice rack. It means understanding that a delicate Silver Needle and a heavily roasted Wuyi rock oolong have almost nothing in common except their botanical origin. Start with the five essential teas outlined in this article, learn how each behaves, then begin to explore the vast territory beyond.",
    ":::COPYRIGHT_PAGE:::Recipes and text by Chen Wei\nFood photography by Teajia Studios\nCocktail development with Taipei Mixology Lab\n\nTeajia Magazine \u2014 Kitchen Series"
  ],
  author: PEOPLE.chen
};

// src/content/articles/origin-story.ts
var originStory = {
  id: "template-origin",
  type: "Article" /* Article */,
  status: "published",
  title: "Origin Story",
  subtitle: "The Creation of Teajia",
  thumbnailUrl: "https://images.unsplash.com/photo-1556909212-d5b604d0c90d?w=800&h=1200&fit=crop",
  durationOrTime: "16 Pages",
  origin: "In-house",
  description: "The founding story of Teajia magazine, told through personal narrative and behind-the-scenes imagery.",
  tags: ["Philosophy", "Culture", "Bali"],
  startHere: true,
  content: [
    ":::COVER_MINIMAL:::The Creation of|Teajia",
    ":::TEXT_DROP_CAP:::Teajia began as a frustration. I was sitting in a small tea room in Ubud, Bali, drinking a 1990s sheng puerh that tasted like camphor and dried plums and ancient forests, and I realized that I had no idea how to share this experience with anyone who was not already a tea person. The language did not exist in English \u2014 not really. The media did not exist. Wine had its critics, its magazines, its vocabulary that let a novice walk into a shop and communicate desire.",
    ":::TEXT_SIDEBAR_IMAGE:::Coffee had undergone its third-wave revolution, with beautifully designed bags, carefully sourced single-origins, and a culture of transparency that made specialty accessible to anyone willing to pay attention. Tea had none of this. Tea had dusty tins with dragons on them, wellness blogs full of misinformation, and a handful of excellent but deeply niche forums that spoke only to the already converted. There was a vast gulf between the quality of the tea being produced and the quality of the media that represented it. Teajia was born in that gulf.|A quiet tea session in Bali|https://images.unsplash.com/photo-1545579133-99bb5ab189bd?w=800&h=1200&fit=crop",
    ":::TEXT_SINGLE_COL:::The name came first. 'Tea' for the obvious, and 'jia' (\u5BB6) \u2014 the Chinese character meaning home, family, or one who practices. A tea practitioner. A tea family. A tea home. The double meaning felt right, because what I wanted to create was not just a publication but a space \u2014 a digital home for people who cared about tea the way others cared about wine or music or architecture.",
    ":::TEXT_JUSTIFIED_NARROW:::A place where a farmer in Wuyi and a barista in Brooklyn could find common ground. Where the science of extraction and the poetry of a quiet morning cup coexisted without contradiction. Where beautiful design served as a bridge between casual curiosity and deep knowledge, rather than a barrier wrapped in exclusivity.",
    ":::IMG_FULL_BLEED:::The original Teajia workspace in Bali \u2014 a wooden table overlooking rice paddies|https://images.unsplash.com/photo-1556881286-fc6915169721?w=800&h=1200&fit=crop",
    ":::TEXT_DOUBLE_COL:::The Problem with Tea Media|When I surveyed the landscape of tea content in English, I found three distinct categories, each failing in its own way. First, there were the wellness sites \u2014 beautifully designed, heavily Instagrammed, and almost entirely wrong about the science. They told you that white tea had no caffeine, that green tea burned fat, that tea could cure anything from anxiety to cancer. Their aesthetic was aspirational but their content was misinformation dressed in linen.\n\nSecond and Third|Second, there were the enthusiast forums \u2014 deeply knowledgeable, fiercely opinionated, and utterly inaccessible to newcomers. The language was insider, the tone was gatekeeping, and the design was an afterthought. Third, there were the vendor blogs \u2014 commercial content dressed as education, where every article concluded with a link to buy something.",
    ":::IMG_WITH_CAPTION_BOTTOM:::Tea leaves drying in the afternoon sun|https://images.unsplash.com/photo-1563911892437-1feda0179e1b?w=800&h=1200&fit=crop",
    ":::TEXT_SIDEBAR_IMAGE:::What I could not find, anywhere, was tea media that combined editorial rigor with design excellence. A place that treated tea with the same seriousness and beauty that the best food magazines brought to cuisine. Content that was scientifically accurate without being dry, culturally informed without being appropriative, visually stunning without being vapid, and accessible without being condescending. This was not a gap in the market. It was a gap in the culture.|The vision takes shape|https://images.unsplash.com/photo-1530968033775-2c92736b131e?w=800&h=1200&fit=crop",
    ":::QUOTE_BIG:::I wanted to build the magazine I wished existed when I first fell in love with tea \u2014 the one that would have saved me years of confusion and misinformation.",
    ":::IMG_POLAROID_SCATTER:::Early sketches of Teajia's design system|https://images.unsplash.com/photo-1556909212-d5b604d0c90d?w=800&h=1200&fit=crop|First prototype of the reading interface|https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=800&h=1200&fit=crop|Notes from the founding brainstorm session|https://images.unsplash.com/photo-1523920290228-4f321a939b4c?w=800&h=1200&fit=crop",
    ":::TEXT_SINGLE_COL:::The design philosophy emerged from a single conviction: tea content deserved the same visual respect as the tea itself. If a farmer spent decades perfecting the craft of a single oolong, the writing and design that presented that oolong to the world should reflect a comparable level of care.",
    ":::TEXT_JUSTIFIED_NARROW:::This meant rejecting the blog format entirely \u2014 the endless scroll, the sidebar clutter, the SEO-optimized headers, the stock photography. Instead, Teajia would adopt the visual language of print magazines and art books, adapted for digital reading. Each article would be designed as a self-contained visual experience, with layout variations that responded to content type. The reading experience itself would be the product, not a wrapper around advertisements.",
    ":::CHAPTER_MINIMAL:::The Bali Principle",
    ":::IMG_FULL_BLEED:::The Bali landscape that inspired Teajia's founding|https://images.unsplash.com/photo-1523920290228-4f321a939b4c?w=800&h=1200&fit=crop",
    ":::TEXT_CENTER_NARROW:::There is a concept in Balinese Hinduism called 'Tri Hita Karana' \u2014 the three causes of well-being. Harmony with other people. Harmony with nature. Harmony with the spiritual world. I am not Balinese, and I do not practice Hinduism, but this framework resonated deeply with what I felt tea could be.",
    ":::TEXT_SIDEBAR_IMAGE:::Tea connects people \u2014 the farmer to the drinker, the host to the guest, the solitary morning practitioner to the centuries of practitioners who came before. Tea connects us to nature \u2014 to water, to fire, to the plant itself, to the seasons that shape its character. And tea, at its best, connects us to something interior and contemplative \u2014 a quality of attention that the modern world makes increasingly rare. Tri Hita Karana became, informally, the editorial compass of Teajia.|Morning light through tea leaves|https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=800&h=1200&fit=crop",
    ":::IMG_SPLIT_VERTICAL:::The Bali landscape that inspired Teajia's founding|https://images.unsplash.com/photo-1582793988951-9aed5509eb97?w=800&h=1200&fit=crop|https://images.unsplash.com/photo-1545579133-99bb5ab189bd?w=800&h=1200&fit=crop",
    ":::TEXT_SIDEBAR_RIGHT:::Why Digital, Not Print|People asked, repeatedly, why Teajia was not a print magazine. The answer was philosophical as much as practical. Print is beautiful, and I admire the craft of physical publications deeply. But print is also static, expensive, and geographically limited. I wanted Teajia to be accessible to a student in Jakarta, a retiree in Osaka, and a tea farmer in Fujian equally.|https://images.unsplash.com/photo-1594631252845-29fc4cc8cde9?w=800&h=1200&fit=crop",
    ":::TEXT_SINGLE_COL:::I wanted content to be updateable as our understanding evolved \u2014 tea science is a living field, and articles should improve over time rather than becoming dated artifacts. Most importantly, I wanted the reading experience to be immersive in ways that print cannot achieve \u2014 subtle animations, responsive layouts that adapt to your screen, and eventually, interactive elements that let you explore data and terroir maps on your own terms. Digital was not a compromise. It was the medium that best served the mission.",
    ":::POEM_CENTERED:::Before the first article was written,\nbefore the first layout was designed,\nthere was a cup of tea on a wooden table\nand a question that would not let go:\nwhat if tea had a home on the internet\nthat was worthy of tea?",
    ":::DEDICATION_SIMPLE:::For every tea drinker who felt there should be something better \u2014 this is for you. And for the farmers, the processors, the traders, and the brewers whose craft deserves to be seen clearly. Teajia is your home.",
    ":::EPILOGUE_CENTERED:::Teajia is still becoming what it will be. Every article published, every photograph selected, every layout refined brings us closer to the vision \u2014 a digital space where tea is treated with the depth it deserves, where science and poetry coexist, where beauty serves understanding rather than obscuring it. If you have read this far, you are already part of that story. Welcome home.",
    ":::COPYRIGHT_PAGE:::Teajia Editorial"
  ],
  author: PEOPLE.chen
};

// scripts/migrate-articles.ts
var __dirname = dirname(fileURLToPath(import.meta.url));
var repoRoot = join(__dirname, "..");
var ARTICLES = [
  { slug: "travel-feature-video", story: travelFeatureVideo },
  { slug: "tea-feature-article", story: teaFeatureArticle },
  { slug: "long-form-interview", story: longFormInterview },
  { slug: "recipe-and-pairing", story: recipeAndPairing },
  { slug: "origin-story", story: originStory }
];
function sqlEscape(s) {
  return s.replace(/'/g, "''");
}
function authorSlug(story) {
  const a = story.author;
  if (!a) return null;
  if (a.id) return a.id;
  if (a.name) return a.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return null;
}
function readingTime(blocks) {
  const text = JSON.stringify(blocks);
  const chars = text.length;
  const minutes = Math.max(1, Math.round(chars / (200 * 5)));
  return minutes;
}
var lines = [];
lines.push("-- Migration 046: seed 5 sample articles into the new DbArticle system.");
lines.push("-- Generated by scripts/migrate-articles.ts. See docs/ARTICLE_UNIFICATION_PLAN.md.");
lines.push("-- Source articles in src/content/articles/ converted via scripts/parseDirectives.ts.");
lines.push("");
clearViolations();
for (const { slug, story } of ARTICLES) {
  const blocks = parseStoryToBlocks(story, slug);
  const cover = blocks.find((b) => b.type === "cover");
  const coverImage = (cover && "image" in cover ? cover.image : void 0) ?? story.thumbnailUrl;
  const id = `art_${slug.replace(/-/g, "_")}`;
  const accountId = "acc_teajia_bali";
  const title = story.title;
  const subtitle = story.subtitle ?? "";
  const author = authorSlug(story);
  const tags = JSON.stringify(story.tags ?? []);
  const blocksJson = JSON.stringify(blocks);
  const rt = readingTime(blocks);
  const publishedAt = "2026-04-25T00:00:00Z";
  const category = inferCategory(slug);
  lines.push(`-- \u2500\u2500\u2500 ${title} \u2500\u2500\u2500`);
  lines.push(
    `INSERT OR REPLACE INTO articles (id, account_id, title, subtitle, author_id, slug, status, category, tags, cover_image_url, blocks, reading_time_mins, published_at, created_at, updated_at) VALUES (`
  );
  lines.push(`  '${id}',`);
  lines.push(`  '${accountId}',`);
  lines.push(`  '${sqlEscape(title)}',`);
  lines.push(subtitle ? `  '${sqlEscape(subtitle)}',` : `  NULL,`);
  lines.push(author ? `  '${sqlEscape(author)}',` : `  NULL,`);
  lines.push(`  '${slug}',`);
  lines.push(`  'published',`);
  lines.push(category ? `  '${category}',` : `  NULL,`);
  lines.push(`  '${sqlEscape(tags)}',`);
  lines.push(coverImage ? `  '${sqlEscape(coverImage)}',` : `  NULL,`);
  lines.push(`  '${sqlEscape(blocksJson)}',`);
  lines.push(`  ${rt},`);
  lines.push(`  '${publishedAt}',`);
  lines.push(`  datetime('now'),`);
  lines.push(`  datetime('now')`);
  lines.push(`);`);
  lines.push("");
}
function inferCategory(slug) {
  if (slug.startsWith("tea-feature") || slug === "travel-feature-video") return "tea-feature";
  if (slug === "long-form-interview") return "interview";
  if (slug === "recipe-and-pairing") return "pairing";
  if (slug === "origin-story") return "curated";
  return null;
}
writeFileSync(join(repoRoot, "worker/migrations/046_seed_articles.sql"), lines.join("\n"));
var v = getViolations();
writeFileSync(
  join(repoRoot, "scripts/migrate-articles.violations.json"),
  JSON.stringify(v, null, 2)
);
console.log(`\u2713 Wrote worker/migrations/046_seed_articles.sql (${ARTICLES.length} articles)`);
console.log(`\u2713 Wrote scripts/migrate-articles.violations.json (${v.length} budget violations)`);
if (v.length > 0) {
  console.log("\nBudget violations:");
  for (const x of v.slice(0, 10)) {
    console.log(`  [${x.articleSlug} block ${x.blockIndex}] ${x.blockType}.${x.field}: ${x.actual}/${x.budget} chars \u2014 "${x.preview}"`);
  }
  if (v.length > 10) console.log(`  ... and ${v.length - 10} more`);
}
