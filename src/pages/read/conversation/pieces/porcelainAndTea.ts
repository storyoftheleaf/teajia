/**
 * @color-literals. The two colours on the on-photo block (`ink`, `accent`)
 * are measured against one photograph, the pale wall behind the gold-mended
 * bowl, and do not change with the theme any more than the photograph does.
 */
/**
 * Yan Jinwen (严金文): Porcelain and Tea. His studio is 缮隐漆物, Shanyin
 * Qiwu, Shanyin Lacquerware. An earlier version named him "Shangyin Qiwu
 * 上隐器物", a mistranslation of the studio name; corrected 2026-09-29.
 *
 * Every answer is his and every question is Adrian's, from the interview
 * transcript (Adrian's Obsidian source note, SRC - Ceramicist (Porcelain
 * Restoration)), held in Mandarin, translated, and lightly trimmed.
 * conversation.test.ts traces each line back to that note whenever it is on
 * the machine running the tests.
 *
 * Reworked 2026-09-29 into the conversation template: a sentence set large is
 * lifted out of its paragraph rather than repeated beside it; "When we repair
 * objects" is set once, on the pale wall, where he says it; the In Brief box
 * became two lines in the cover credits; eight photographs came out so no
 * more than one image sits between exchanges. The eight are still in the
 * image folder: class-at-the-cup, stapled-lid, pouring, cup-on-wood,
 * lining-close, courtyard-table, teapot-on-gold-dish, class-cup-and-dish.
 */
import type { ConversationSpec, Shot } from '../spec';

const S = {
  portrait: { slot: 'portrait', file: 'portrait.jpg', alt: 'Yan Jinwen seated in his studio', y: 0.4 },
  classTable: { slot: 'class-table', file: 'class-at-the-table.jpg', alt: 'Adrian at the repair table during the class, seen through the studio window', y: 0.4 },
  goldSeam: { slot: 'gold-seam', file: 'gold-seam-bowl.jpg', alt: 'A dark bowl with a gold seam along its rim' },
  jar: { slot: 'jar', file: 'jar-in-hand.jpg', alt: 'A hand turning an old glazed jar with a repaired rim' },
  stapledBowl: { slot: 'stapled-bowl', file: 'stapled-bowl.jpg', alt: 'A bowl mended with a row of staples' },
  shelves: { slot: 'shelves', file: 'display-shelves.jpg', alt: 'Repaired cups and jars displayed on open shelves' },
  goldBowl: { slot: 'gold-bowl', file: 'gold-mended-bowl.jpg', alt: 'A dark tea bowl with gold repair lines, alone on a pale ground', y: 1 },
  kettle: { slot: 'kettle', file: 'kettle-over-charcoal.jpg', alt: 'An iron kettle steaming over a charcoal stove, calligraphy behind' },
  mendedDish: { slot: 'mended-dish', file: 'teapot-on-mended-dish.jpg', alt: 'A teapot on a mended dish beside a cup of tea' },
  liningHand: { slot: 'lining-hand', file: 'lining-in-hand.jpg', alt: 'Hands shaping the metal lining of a green cup' },
  whiteBowl: { slot: 'white-bowl', file: 'white-footed-bowl.jpg', alt: 'One white footed bowl in the dark' },
  settingCups: { slot: 'setting-cups', file: 'setting-cups.jpg', alt: 'Hands setting out cups at the tea table' },
  listening: { slot: 'listening', file: 'listening.jpg', alt: 'Listening at the tea table, hand at his chin' },
  stream: { slot: 'stream', file: 'by-the-stream.jpg', alt: 'Sitting on the rocks beside a stream' },
  studio: { slot: 'studio', file: 'studio-table.jpg', alt: 'The studio table by candlelight, cups, bowls and pots laid out' },
  classBench: { slot: 'class-bench', file: 'class-at-the-bench.jpg', alt: 'Adrian at the workbench, working a cup' },
  lastBowl: { slot: 'last-bowl', file: 'stapled-bowl-grasses.jpg', alt: 'A stapled tea bowl on a dark shelf, dry grasses lit behind it' },
} satisfies Record<string, Shot>;

export const porcelainAndTea: ConversationSpec = {
  slug: 'porcelain-and-tea',
  path: '/read/porcelain-and-tea',
  images: '/read/porcelain-and-tea/',
  source: 'SRC - Ceramicist (Porcelain Restoration).md',
  pageTitle: 'Yan Jinwen · Porcelain and Tea · Teajia',
  title: ['Porcelain', 'and Tea'],
  dek: 'A conversation with a porcelain restorer in Wuyi.',
  subject: { name: 'Yan Jinwen', nameCn: '严金文', role: 'Porcelain restorer', href: '/people/shangyin-qiwu' },
  speakers: { author: 'Adrian', subject: 'Yan Jinwen' },
  author: {
    name: 'Adrian Rasmussen',
    links: [
      { label: 'Teajia page', href: '/people/adrian-rasmussen' },
      { label: 'Instagram', href: 'https://www.instagram.com/technicianofthesacred/' },
      { label: 'Portfolio', href: 'https://adrianrasmussen.com' },
    ],
  },
  facts: [['Studio', 'Shanyin Lacquerware, 缮隐漆物'], ['Craft', 'Porcelain restoration and lacquer'], ['Place', 'Wuyi, China']],
  portrait: S.portrait,
  intro: 'I learned restoration from Yan Jinwen. I took his class in Wuyi, and I was so interested that I wanted to come back and learn about his dedication to this craft, and his perspective.',
  opening: [],
  parts: [
    {
      title: 'What brought me here',
      opener: S.classTable,
      blocks: [
        { kind: 'q', id: 'p1-q1', text: 'When did you decide that you felt inspired to work with porcelain restoration?' },
        { kind: 'a', id: 'p1-a1', text: 'First of all, I quite like collecting things. Because of tea, I like to collect tea utensils. Many old utensils have some damage here and there.' },
        {
          kind: 'side', shot: S.goldSeam, bleed: true, blocks: [
            { kind: 'line', id: 'p1-l1', size: 'l', text: 'As the saying goes, nine out of ten old things are damaged. ==But I think these are all marks of history.==' },
          ],
        },
        { kind: 'a', id: 'p1-a2', text: 'Before the repair, they couldn’t be used. After repair, they can return to our lives. Some utensils may be a hundred years old, and some may be a thousand. Just think about it: it’s a very wonderful thing that they can meet you after thousands of years, and continue to be with us now, on our tea tables or in our lives.' },
        { kind: 'a', id: 'p1-a3', text: 'So I don’t think it’s about inspiration. My love for these utensils naturally makes me find ways for them to be better passed on and better used.' },
        { kind: 'q', id: 'p1-q2', text: 'Not everyone likes to use old utensils. Many people are happy using a gaiwan or some new cups. What is your connection to the past?' },
        { kind: 'a', id: 'p1-a4', text: 'Whether one likes old things or new things, everyone has different preferences. Some people like coffee, others like tea. We can only do what we like in the present, and through this, attract like-minded friends. We sit down because of these utensils or a cup of tea, and we have plenty of topics to talk about.' },
        {
          kind: 'side', shot: S.jar, flip: true, blocks: [
            { kind: 'a', id: 'p1-a5', text: 'As for old utensils, I think they carry a lot of historical and cultural elements. I like them because they have a more natural sense of historical vicissitudes.' },
            { kind: 'line', id: 'p1-l2', size: 'm', text: 'I can feel the state of the people who created them at that time, through touching these utensils.' },
          ],
        },
        {
          kind: 'glyph', glyph: '缘分', blocks: [
            { kind: 'q', id: 'p1-q3', text: 'Some people talk about karma, how old things carry a weight with them. By bringing these old things back to life, do you feel you are honoring the past?' },
            { kind: 'line', id: 'p1-l3', size: 'm', text: 'This feeling is very subtle, and I can’t quite put it into words.' },
            { kind: 'a', id: 'p1-a6', text: 'It’s probably a kind of fate, 缘分. First I mastered this repair technique, and then I came to love these ancient ceramics. It’s probably some kind of fate.' },
          ],
        },
        { kind: 'q', id: 'p1-q4', text: 'How long ago were these repair techniques developed? Maybe a thousand years ago, people would just make a new cup.' },
        { kind: 'a', id: 'p1-a7', text: 'Repair techniques have existed for thousands of years. In the past, people cherished utensils more. Many utensils from daily life that got damaged still show traces of repair. It was quite common in ancient times. In our society now it’s not as popular, because we can easily buy new things.' },
        { kind: 'photos', shots: [S.stapledBowl], narrow: true, caption: { id: 'p1-cap1', text: 'The repair of cracked porcelain using staples can be traced back to the Song Dynasty, more than 1,000 years ago.' } },
        { kind: 'q', id: 'p1-q5', text: 'What do people who aren’t into old things not understand about teaware?' },
        { kind: 'a', id: 'p1-a8', text: 'I take many of my pieces to exhibitions and markets, so more people can understand the connection between these ancient artifacts and modern life. I also share on Douyin and Xiaohongshu. When these things are damaged, people don’t know what they can be used for. But when I repair them, people discover, _“Oh, this thing can be used like this. It’s quite interesting.”_' },
        { kind: 'wide', shot: S.shelves, aspect: '4/5', narrow: true, offset: 'right' },
      ],
    },
    {
      title: 'Clay, fire, and patience',
      opener: S.kettle,
      blocks: [
            { kind: 'q', id: 'p2-q1', text: 'Do these old techniques and tools change the actual taste of tea?' },
            { kind: 'a', id: 'p2-a1', text: 'For old utensils, especially teacups and teapots, the clay of that era was likely superior to today’s. Ancient utensils were mainly fired with wood, and the temperature and transformation from wood firing are more layered and rich than modern electric firing. That’s a big reason so many people pursue old utensils and old cups.' },
        { kind: 'q', id: 'p2-q2', text: 'Does that clay no longer exist?' },
        { kind: 'a', id: 'p2-a2', text: 'Clay is a large part of the reason, and it’s possible that such clay no longer exists today. Another reason is that people now pursue speed and convenience, so they no longer calm down as they did before. Most are chasing a fast rhythm and quick gains.' },
        { kind: 'q', id: 'p2-q3', text: 'Can you feel the state of the person who made the cup? Someone making it for money, versus someone focused on mastering the craft?' },
        { kind: 'a', id: 'p2-a3', text: 'Of course. You get what you pay for. It’s not that no one today focuses deeply, but there are many choices. You can buy a stove for 50 yuan, 500 yuan, or 5,000 yuan, and the same goes for cups. Price isn’t the only standard, but it’s an important factor in judging a utensil.' },
        { kind: 'wide', shot: S.mendedDish, aspect: '4/5', narrow: true },
        { kind: 'q', id: 'p2-q4', text: 'Is there anything you would like this generation to value again, that the generations these antiques come from valued more?' },
        { kind: 'a', id: 'p2-a4', text: 'The state of being dedicated to excelling at something. The ancients focused more on pursuing form, spirit, and inner expression. Nowadays this is somewhat lacking. It’s about slowing down, and devoting more energy to the thing itself.' },
        { kind: 'line', id: 'p2-l1', size: 'xl', text: 'Restoration can’t be rushed.', follow: { id: 'p2-a5', text: 'It requires time to polish slowly to produce a good result.' } },
        { kind: 'wide', shot: S.liningHand, aspect: '4/5', narrow: true, offset: 'left' },
        {
          kind: 'side', shot: S.whiteBowl, bleed: true, flip: true, blocks: [
            { kind: 'q', id: 'p2-q5', text: 'When you take that time, polishing slowly, what do you feel it is cultivating in your life?' },
            { kind: 'a', id: 'p2-a6', text: 'I think the main thing is being able to calm oneself down, slow down, and truly focus one’s energy on _a single utensil or a single matter._ It has made my life more steady and relaxed.' },
            { kind: 'q', id: 'p2-q6', text: 'When someone brings these objects into their life, can they feel what you put into them?' },
            { kind: 'a', id: 'p2-a7', text: 'Yes. Many friends, after getting these restored objects, first feel they are meaningful and interesting. Then they realize it helps them calm down and focus more on the present moment.' },
          ],
        },
      ],
    },
    {
      title: 'Tea, and the work ahead',
      opener: S.stream,
      blocks: [
        { kind: 'q', id: 'p3-q1', text: 'Tell me what tea is for you, since all these objects are around the ritual of tea.' },
        { kind: 'a', id: 'p3-a1', text: 'Tea is an indispensable spiritual food in my life. Like a craft, it allows me to focus on the present moment, which is of great significance to me.' },
        { kind: 'q', id: 'p3-q2', text: 'And with communities, with other people?' },
        { kind: 'line', id: 'p3-l1', size: 'xl', text: 'Tea is like an ==invisible language.==', follow: { id: 'p3-a2', text: 'Just like us, from different countries, but we can sit together because of tea. Maybe the topic isn’t tea, but it brings us together. For me personally, tea is a spiritual practice and a way of life.' } },
        { kind: 'photos', shots: [S.settingCups, S.listening], stagger: true },
        { kind: 'q', id: 'p3-q3', text: 'What role does tea play in your city, and in China?' },
        { kind: 'a', id: 'p3-a3', text: 'Tea plays many roles. It is a beverage, a gift, and a medium of communication. We sit around a tea table and talk about many things. It can be generous or selfish. This leaf absorbs the essence of heaven and earth, embodying the five elements and eight trigrams. It gathers the energy of the East in China. It’s remarkable that such energy can be concentrated in a single leaf and radiated outward.' },
        { kind: 'q', id: 'p3-q4', text: 'What is your business name, and what does it mean?' },
        { kind: 'a', id: 'p3-a4', text: 'My company’s name is Shanyin Qiwu, 缮隐漆物. What I do is related to lacquer, so I named it Shanyin Qiwu. It doesn’t have too many specific meanings. It’s just like a nickname.' },
        { kind: 'wide', shot: S.studio },
        { kind: 'q', id: 'p3-q5', text: 'What are your biggest challenges right now, and what are you inspired to learn?' },
        { kind: 'a', id: 'p3-a5', text: 'My biggest challenge has been bridging reality and ideals. As artists, we invest time and energy for perfection, but sometimes fail to connect it to real life, which leads to financial problems. I’m gradually changing that, doing what I love while also creating economic benefits. My plan is to turn my skills into paid courses, so more people can learn and help preserve this craft.' },
        {
          kind: 'side', shot: S.classBench, flip: true, blocks: [
            { kind: 'q', id: 'p3-q6', text: 'One thing I realized a long time ago: if I hide my skills or my ways of doing things, it will end with me. So I have to have a way to give them, and inspire other people to feel connected to what I do, so it carries on past my life.' },
          ],
        },
        { kind: 'a', id: 'p3-a6', text: 'Yes. I think the economic base determines the superstructure. We can’t talk about ideals apart from life, nor focus on life without ideals. The bridge between the two is the economic base. As long as we obtain due rewards within our capabilities, we can make this work more meaningful and selfless. But we must first get our own lives in order. Then we can have better energy to spread meaningful things.' },
      ],
    },
  ],
  ending: {
    blocks: [
      { kind: 'q', id: 'e-q1', text: 'By dedicating yourself so deeply to this one thing, what is the most impactful thing it has inspired in your life?' },
      { kind: 'a', id: 'e-a1', text: 'A broken object is like life. Life can’t be perfect, and neither can objects.' },
      { kind: 'on-photo', id: 'e-on', shot: S.goldBowl, aspect: '4/5', ink: '#1c1712', accent: '#5a4318', text: 'When we repair objects, we are also ==repairing ourselves.==' },
      { kind: 'a', id: 'e-a2', text: 'We all have shortcomings. We identify problems, adjust them, and solve them. It’s the same with objects. Life is not afraid of difficulties. When facing them, find ways to solve them and embrace a new state of life. The saying I like is:' },
    ],
    saying: { id: 'e-saying', text: '“The world is tattered, but we are still ==mending it.==”' },
    shot: S.lastBowl,
    aspect: '1080/1618',
  },
  credit: [
    'Recorded with Yan Jinwen in Wuyi. The conversation was held in Mandarin, translated into English and lightly trimmed.',
    'Interview by Adrian Rasmussen.',
  ],
  next: [
    { to: '/read/earth-water-fire', kicker: 'Conversation', title: 'Earth, Water, Fire', blurb: 'A Jingdezhen potter on the vessels that hold the tea.' },
    { to: '/read/rock-remembers', kicker: 'Conversation', title: 'The Rock Remembers', blurb: 'A Wuyi roaster on fire, patience and lineage.' },
    { to: '/read/ritual', kicker: 'Ritual', title: 'Seven Steeps', blurb: 'The same leaves, brewed seven ways, scroll to pour.' },
    { to: '/read/tasting', kicker: 'Tasting', title: 'The Vocabulary of Taste', blurb: 'A turning flavour wheel and a tasting radar.' },
  ],
};
