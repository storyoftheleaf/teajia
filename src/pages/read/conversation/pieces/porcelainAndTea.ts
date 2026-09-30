/**
 * Yan Jinwen, of the Shanyin Qiwu studio: Porcelain and Tea.
 *
 * His name and the studio's were corrected by Adrian (2026-09-29): the
 * transcript's "Shangyin Qiwu, 上隐器物" is the studio, and it is Shanyin Qiwu,
 * 缮隐漆物. His person page moved to /people/yan-jinwen (migration 0029).
 *
 * Told as a story, not an interview (Adrian, 2026-09-29: "it reads as an
 * interview, not a story from an interview"). Built from the magazine draft
 * DEV - Shanyin Qiwu (story) in Adrian's vault: his opening and his close are
 * his own words from his context note; every answer and large line is Yan
 * Jinwen's, from the transcript (SRC - Ceramicist (Porcelain Restoration)),
 * held in Mandarin and translated; two of Adrian's own spoken lines stay as
 * questions; the lines of Adrian's telling (`n`) are the draft's connecting
 * lines. conversation.test.ts traces every answer and question back to the
 * transcript whenever it is on the machine running the tests.
 *
 * The story itself (its words, pull quotes and every photograph) is GENERATED
 * from that draft by mag-send into porcelainAndTea.story.ts (2026-09-29): the
 * draft is the one source, so the page can no longer drift from what was
 * checked. This file holds only the page facts: title, byline, credit, share
 * card and what to read next. To change the story, change the draft and send it.
 *
 * The dek, byline and credit were reworded on 2026-09-29 with Adrian's permission
 * ("give you permission to add the small bits") so the frame no longer calls
 * the piece an interview; the story's own words are untouched.
 *
 * Two saved page edits are left behind on purpose: "intro" (the line below)
 * and "p3-a4" (his studio-name answer, which this version tells instead). The
 * intro now saves under "intro-2", and no block here uses "p3-a4", so neither
 * can reach the page again.
 *
 * Read as a story (2026-09-29, after the magazine audit): no speaker names in
 * the margin, his words in quotation marks, and his hook on the cover in place
 * of the dek. The hook is lifted out of his first answer, so it is printed once;
 * the gold-seam photograph it sat beside stays, on its own. Adrian's line about
 * hiding his skills is his telling (`n`), as the draft sets it, not a question.
 * The saved edit key "p1-l1" (the hook, when it sat in the body) no longer
 * reaches the page.
 *
 * The opening line the page carried from 2026-09-28, "I learned restoration
 * from Yan Jinwen. I took his class in Wuyi…", was written by an AI session and
 * was never Adrian's ("this didn't happen"). It is gone; do not restore it.
 */
import type { ConversationSpec } from '../spec';
import { shots, story } from './porcelainAndTea.story.ts';

export const porcelainAndTea: ConversationSpec = {
  slug: 'porcelain-and-tea',
  path: '/read/porcelain-and-tea',
  images: '/read/porcelain-and-tea/',
  source: 'SRC - Ceramicist (Porcelain Restoration).md',
  pageTitle: 'Yan Jinwen · Porcelain and Tea · Teajia',
  title: ['Porcelain', 'and Tea'],
  dek: 'Old tea ware, lacquer, and a restorer at the foot of the Wuyi Mountains.',
  subject: { name: 'Yan Jinwen', nameCn: '严金文', role: 'Porcelain restorer', href: '/people/yan-jinwen', words: 'his' },
  speakers: { author: 'Adrian', subject: 'Jinwen' },
  form: 'story',
  ...story,
  author: {
    name: 'Adrian Rasmussen',
    links: [
      { label: 'Teajia page', href: '/people/adrian-rasmussen' },
      { label: 'Instagram', href: 'https://www.instagram.com/technicianofthesacred/' },
      { label: 'Portfolio', href: 'https://adrianrasmussen.com' },
    ],
  },
  share: { line: 'p4-l1', photo: shots.goldBowl },
  credit: [
    'His words were spoken in Mandarin in Wuyi, translated into English and lightly trimmed.',
  ],
  next: [
    { to: '/read/earth-water-fire', kicker: 'Conversation', title: 'Earth, Water, Fire', blurb: 'A Jingdezhen potter on the vessels that hold the tea.' },
    { to: '/read/rock-remembers', kicker: 'Conversation', title: 'The Rock Remembers', blurb: 'A Wuyi roaster on fire, patience and lineage.' },
    { to: '/read/ritual', kicker: 'Ritual', title: 'Seven Steeps', blurb: 'The same leaves, brewed seven ways, scroll to pour.' },
    { to: '/read/tasting', kicker: 'Tasting', title: 'The Vocabulary of Taste', blurb: 'A turning flavour wheel and a tasting radar.' },
  ],
};
