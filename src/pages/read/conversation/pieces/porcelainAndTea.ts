/**
 * @color-literals. The two colours on the on-photo block (`ink`, `accent`)
 * are measured against one photograph, the pale wall behind the gold-mended
 * bowl, and do not change with the theme any more than the photograph does.
 */
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
 * Eight pull quotes run through every part, and all 25 photographs in the
 * image folder are placed (Adrian: "you reduced the image amount a lot").
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
 * The opening line the page carried from 2026-09-28, "I learned restoration
 * from Yan Jinwen. I took his class in Wuyi…", was written by an AI session and
 * was never Adrian's ("this didn't happen"). It is gone; do not restore it.
 */
import type { ConversationSpec, Shot } from '../spec';

const S = {
  portrait: { slot: 'portrait', file: 'portrait.jpg', alt: 'Yan Jinwen seated in his studio', y: 0.4 },
  classTable: { slot: 'class-table', file: 'class-at-the-table.jpg', alt: 'Adrian at the repair table during the class, seen through the studio window', y: 0.4 },
  goldSeam: { slot: 'gold-seam', file: 'gold-seam-bowl.jpg', alt: 'A dark bowl with a gold seam along its rim' },
  cupOnWood: { slot: 'cup-on-wood', file: 'cup-on-wood.jpg', alt: 'An old cup on wood' },
  jar: { slot: 'jar', file: 'jar-in-hand.jpg', alt: 'A hand turning an old glazed jar with a repaired rim' },
  stapledLid: { slot: 'stapled-lid', file: 'stapled-lid.jpg', alt: 'A lid mended with staples' },
  stapledBowl: { slot: 'stapled-bowl', file: 'stapled-bowl.jpg', alt: 'A bowl mended with a row of staples' },
  shelves: { slot: 'shelves', file: 'display-shelves.jpg', alt: 'Repaired cups and jars displayed on open shelves' },
  kettle: { slot: 'kettle', file: 'kettle-over-charcoal.jpg', alt: 'An iron kettle steaming over a charcoal stove, calligraphy behind' },
  classCupDish: { slot: 'class-cup-and-dish', file: 'class-cup-and-dish.jpg', alt: 'A cup and dish at the repair class' },
  liningHand: { slot: 'lining-hand', file: 'lining-in-hand.jpg', alt: 'Hands shaping the metal lining of a green cup' },
  liningClose: { slot: 'lining-close', file: 'lining-close.jpg', alt: 'The metal lining of a cup, close' },
  classCup: { slot: 'class-cup', file: 'class-at-the-cup.jpg', alt: 'Adrian at the class, working a cup' },
  whiteBowl: { slot: 'white-bowl', file: 'white-footed-bowl.jpg', alt: 'One white footed bowl in the dark' },
  mendedDish: { slot: 'mended-dish', file: 'teapot-on-mended-dish.jpg', alt: 'A teapot on a mended dish beside a cup of tea' },
  goldDish: { slot: 'gold-dish', file: 'teapot-on-gold-dish.jpg', alt: 'A teapot on a gold-mended dish' },
  stream: { slot: 'stream', file: 'by-the-stream.jpg', alt: 'Sitting on the rocks beside a stream' },
  pouring: { slot: 'pouring', file: 'pouring.jpg', alt: 'Tea being poured' },
  settingCups: { slot: 'setting-cups', file: 'setting-cups.jpg', alt: 'Hands setting out cups at the tea table' },
  listening: { slot: 'listening', file: 'listening.jpg', alt: 'Listening at the tea table, hand at his chin' },
  courtyard: { slot: 'courtyard', file: 'courtyard-table.jpg', alt: 'A tea table in the courtyard' },
  studio: { slot: 'studio', file: 'studio-table.jpg', alt: 'The studio table by candlelight, cups, bowls and pots laid out' },
  classBench: { slot: 'class-bench', file: 'class-at-the-bench.jpg', alt: 'Adrian at the workbench, working a cup' },
  goldBowl: { slot: 'gold-bowl', file: 'gold-mended-bowl.jpg', alt: 'A dark tea bowl with gold repair lines, alone on a pale ground', y: 1 },
  lastBowl: { slot: 'last-bowl', file: 'stapled-bowl-grasses.jpg', alt: 'A stapled tea bowl on a dark shelf, dry grasses lit behind it' },
} satisfies Record<string, Shot>;

export const porcelainAndTea: ConversationSpec = {
  slug: 'porcelain-and-tea',
  path: '/read/porcelain-and-tea',
  images: '/read/porcelain-and-tea/',
  source: 'SRC - Ceramicist (Porcelain Restoration).md',
  pageTitle: 'Yan Jinwen · Porcelain and Tea · Teajia',
  title: ['Porcelain', 'and Tea'],
  dek: 'Old tea ware, lacquer, and a restorer at the foot of the Wuyi Mountains.',
  subject: { name: 'Yan Jinwen', nameCn: '严金文', role: 'Porcelain restorer', href: '/people/yan-jinwen' },
  speakers: { author: 'Adrian', subject: 'Jinwen' },
  form: 'story',
  author: {
    name: 'Adrian Rasmussen',
    links: [
      { label: 'Teajia page', href: '/people/adrian-rasmussen' },
      { label: 'Instagram', href: 'https://www.instagram.com/technicianofthesacred/' },
      { label: 'Portfolio', href: 'https://adrianrasmussen.com' },
    ],
  },
  portrait: S.portrait,
  intro: 'At the base of the Wuyi Mountains, I found my way into this shop where I just loved everything. Everything was taken care of at such a high level. Everywhere I looked, each and every piece was cared for immaculately, using skills that have been developed over many years. The first time I came here, I did not have time to learn, but the second time I created space in my schedule to pick up some of the skills and spend more time with this master.',
  opening: [
    { kind: 'n', id: 'o-n1', text: 'Yan Jinwen mends old tea ware with lacquer. It began with tea.' },
  ],
  parts: [
    {
      title: 'Marks of history',
      opener: S.classTable,
      blocks: [
        { kind: 'a', id: 'p1-a1', text: 'First of all, I quite like collecting things. Because of tea, I like to collect some tea-related utensils. Many old utensils have some damages here and there.' },
        {
          kind: 'side', shot: S.goldSeam, bleed: true, blocks: [
            { kind: 'line', id: 'p1-l1', size: 'l', text: 'As the saying goes, nine out of ten old things are damaged. ==But I think these are all marks of history.==' },
          ],
        },
        { kind: 'a', id: 'p1-a2', text: 'After I repair them, they couldn’t be used before the repair, but after repair, they can return to our lives. Some utensils may be a hundred years old, and some may be a thousand years old. Just think about it, it’s a very wonderful thing that they can meet you after thousands of years. And it’s very meaningful that they can continue to be with us now, on our tea tables or in our lives.' },
        { kind: 'a', id: 'p1-a3', text: 'So, I don’t think it’s about inspiration. It’s just that my love for these utensils themselves naturally makes me find various ways to enable them to be better passed on and better used.' },
        { kind: 'wide', shot: S.cupOnWood, aspect: '4/5', narrow: true, offset: 'right' },
        { kind: 'n', id: 'p1-n1', text: 'Plenty of tea drinkers are happy with a new gaiwan. He doesn’t argue with them.' },
        { kind: 'a', id: 'p1-a4', text: 'For instance, some people like coffee, while others like tea. I think we can only do what we like in the present, and through this, attract like-minded friends.' },
        {
          kind: 'side', shot: S.jar, flip: true, blocks: [
            { kind: 'a', id: 'p1-a5', text: 'I like them because I think they have a more natural sense of historical vicissitudes.' },
            { kind: 'line', id: 'p1-l2', size: 'm', text: 'Moreover, I can feel the state of the people who created them at that time ==through touching these utensils.==' },
          ],
        },
        {
          kind: 'glyph', glyph: '缘分', blocks: [
            { kind: 'q', id: 'p1-q1', text: 'Some people talk about karma, how old things carry a weight with them. By bringing these old things back to life, do you feel you are honoring the past?' },
            { kind: 'line', id: 'p1-l3', size: 'm', text: 'This feeling is very subtle, and ==I can’t quite put it into words.==' },
            { kind: 'a', id: 'p1-a6', text: 'It’s probably a kind of fate, 缘分. First, I’ve mastered this repair technique, and then I’ve come to love these ancient ceramics. It’s probably some kind of fate.' },
          ],
        },
      ],
    },
    {
      title: 'People cherished utensils more',
      opener: S.stapledLid,
      blocks: [
        { kind: 'a', id: 'p2-a1', text: 'Repair techniques have existed for thousands of years.' },
        {
          kind: 'side', shot: S.stapledBowl, blocks: [
            { kind: 'line', id: 'p2-l1', size: 'l', text: 'In the past, ==people cherished utensils more.==' },
            { kind: 'a', id: 'p2-a2', text: 'Many utensils in daily life that got damaged can still show traces of repair. This technique was quite common in ancient times. On the contrary, in our current society, it’s not as popular because we can easily buy new things.' },
          ],
        },
        { kind: 'a', id: 'p2-a3', text: 'For example, the repair of cracked porcelain using staples can be traced back to the Song Dynasty, with a history of more than 1,000 years.' },
        { kind: 'n', id: 'p2-n1', text: 'He takes the mended pieces out to exhibitions and markets, where people meet them for the first time.' },
        { kind: 'a', id: 'p2-a4', text: 'When these artifacts are in a damaged state, people don’t know what they can be used for. But when I repair them, people discover, “Oh, this thing can be used like this, it’s quite interesting.”' },
        { kind: 'wide', shot: S.shelves, aspect: '4/5', narrow: true, offset: 'right' },
        { kind: 'a', id: 'p2-a5', text: 'It’s the state of being dedicated to excelling at something. The ancients focused more on pursuing form, spirit, and inner expression. Nowadays, this is somewhat lacking.' },
      ],
    },
    {
      title: 'Restoration can’t be rushed',
      opener: S.kettle,
      blocks: [
        {
          kind: 'side', shot: S.classCupDish, blocks: [
            { kind: 'a', id: 'p3-a1', text: 'It’s about slowing down, devoting more energy to the thing itself.' },
          ],
        },
        { kind: 'line', id: 'p3-l1', size: 'xl', text: 'Restoration ==can’t be rushed.==', follow: { id: 'p3-a2', text: 'It requires time to polish slowly to produce a good result.' } },
        { kind: 'photos', shots: [S.liningHand, S.liningClose] },
        {
          kind: 'side', shot: S.classCup, flip: true, blocks: [
            { kind: 'a', id: 'p3-a3', text: 'I think the main thing is being able to calm oneself down, slow down, and truly focus one’s energy on _a single utensil or a single matter._ It has made my life more steady and relaxed.' },
          ],
        },
        {
          kind: 'side', shot: S.whiteBowl, bleed: true, blocks: [
            { kind: 'n', id: 'p3-n1', text: 'The friends who take a mended piece home find something of the same.' },
            { kind: 'a', id: 'p3-a5', text: 'Then they realize it helps them calm down and focus more on the present moment.' },
          ],
        },
        { kind: 'photos', shots: [S.mendedDish, S.goldDish], stagger: true },
      ],
    },
    {
      title: 'An invisible language',
      opener: S.stream,
      blocks: [
        { kind: 'a', id: 'p4-a1', text: 'Tea is an indispensable spiritual food in my life. Like a craft, it allows me to focus on the present moment, which is of great significance to me.' },
        { kind: 'wide', shot: S.pouring, aspect: '4/5', narrow: true, offset: 'left' },
        { kind: 'line', id: 'p4-l1', size: 'xl', text: 'Tea is like an ==invisible language.==', follow: { id: 'p4-a2', text: 'Just like us, from different countries, but we can sit together because of tea. Maybe the topic isn’t tea, but it brings us together.' } },
        { kind: 'photos', shots: [S.settingCups, S.listening], stagger: true },
        {
          kind: 'side', shot: S.courtyard, flip: true, blocks: [
            { kind: 'n', id: 'p4-n1', text: 'The name over the door came from the lacquer, and he wears it lightly.' },
            { kind: 'a', id: 'p4-a3', text: 'It doesn’t have too many specific meanings, it’s just like a nickname.' },
          ],
        },
        { kind: 'wide', shot: S.studio },
        { kind: 'n', id: 'p4-n2', text: 'His plan now is to teach what he knows, in paid courses, so more people can learn and help preserve the craft.' },
        {
          kind: 'side', shot: S.classBench, flip: true, blocks: [
            { kind: 'q', id: 'p4-q1', text: 'One thing I realized a long time ago is if I hide my skills or my ways of doing things, it will end with me.' },
            { kind: 'a', id: 'p4-a4', text: 'We must first get our own lives in order, then we can have better energy to spread meaningful things.' },
          ],
        },
      ],
    },
  ],
  ending: {
    blocks: [
      { kind: 'a', id: 'e-a1', text: 'A broken object is like life. Life can’t be perfect, and neither can objects.' },
      { kind: 'on-photo', id: 'e-on', shot: S.goldBowl, aspect: '4/5', ink: '#1c1712', accent: '#5a4318', text: 'When we repair objects, we are also ==repairing ourselves.==' },
      { kind: 'a', id: 'e-a2', text: 'We all have shortcomings; we identify problems, adjust them, and solve them. It’s the same with objects. Life is not afraid of difficulties. When facing them, find ways to solve them and embrace a new state of life. The saying I like is:' },
    ],
    saying: { id: 'e-saying', text: '“The world is tattered, but we are still ==mending it.==”' },
    shot: S.lastBowl,
    aspect: '1080/1618',
  },
  closing: 'Leaving this place, I felt a strong sense of the love and attention that goes into these things that we do regularly. How true, and how clearly I can see: how you do it in one place, you do it in every place. Beyond the love for those things which are old, it is about putting energy into those things which you cherish, and bringing them a new life.',
  credit: [
    'His words were spoken in Mandarin in Wuyi, translated into English and lightly trimmed.',
    'Told by Adrian Rasmussen.',
  ],
  next: [
    { to: '/read/earth-water-fire', kicker: 'Conversation', title: 'Earth, Water, Fire', blurb: 'A Jingdezhen potter on the vessels that hold the tea.' },
    { to: '/read/rock-remembers', kicker: 'Conversation', title: 'The Rock Remembers', blurb: 'A Wuyi roaster on fire, patience and lineage.' },
    { to: '/read/ritual', kicker: 'Ritual', title: 'Seven Steeps', blurb: 'The same leaves, brewed seven ways, scroll to pour.' },
    { to: '/read/tasting', kicker: 'Tasting', title: 'The Vocabulary of Taste', blurb: 'A turning flavour wheel and a tasting radar.' },
  ],
};
