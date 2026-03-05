// Community Wisdom — curated reflections, tips, and rituals from the tea community

export type WisdomType = 'reflection' | 'tip' | 'ritual' | 'photo';

export interface CommunityWisdomEntry {
  id: string;
  authorName: string;
  authorImageUrl?: string;
  type: WisdomType;
  title: string;
  body: string;
  imageUrl?: string;
  teaReferenced?: string;
  tags: string[];
  dateSubmitted: string;
}

export const WISDOM_TYPE_LABELS: Record<WisdomType, string> = {
  reflection: 'Reflection',
  tip: 'Tip',
  ritual: 'Ritual',
  photo: 'Photo',
};

export const COMMUNITY_WISDOM: CommunityWisdomEntry[] = [
  {
    id: 'cw-1',
    authorName: 'Mei Chen',
    type: 'reflection',
    title: 'The Morning I Stopped Rushing',
    body: 'For years I drank tea while checking emails. One morning the power went out, and I sat with my gaiwan in silence. The tea was the same longjing I always brew, but it tasted completely different — sweeter, more layered. That morning changed my entire practice. Now the first cup is always in silence.',
    teaReferenced: 'Longjing',
    tags: ['morning-ritual', 'mindfulness', 'green-tea'],
    dateSubmitted: '2025-11-15',
  },
  {
    id: 'cw-2',
    authorName: 'James Whitfield',
    type: 'tip',
    title: 'Water Temperature Without a Thermometer',
    body: 'If you don\'t have a variable temp kettle, here\'s what I do: boil the water, then pour it between two cups. Each transfer drops the temperature roughly 5-8°C. Two transfers gets you from boiling to around 85°C — perfect for most oolongs. Three transfers puts you in green tea range.',
    tags: ['brewing', 'beginner', 'practical'],
    dateSubmitted: '2025-12-03',
  },
  {
    id: 'cw-3',
    authorName: 'Yuki Tanaka',
    type: 'ritual',
    title: 'My Sunday Afternoon Ceremony',
    body: 'Every Sunday I lay out a clean cloth, arrange my teaware, and brew three different teas from the same region. No phone, no music. Just the sound of water and the changing colors in the cup. It\'s become the anchor of my week — the one hour where time genuinely slows down.',
    tags: ['ceremony', 'weekly-practice', 'gongfu'],
    dateSubmitted: '2025-10-20',
  },
  {
    id: 'cw-4',
    authorName: 'Sofia Reyes',
    type: 'reflection',
    title: 'Tea Taught Me Patience',
    body: 'I bought a sheng puerh cake two years ago that tasted harsh and bitter. I almost gave it away. But someone told me to wait. Six months later I tried it again — softer, more rounded. A year in, honey notes appeared. Now I understand: some things only reveal themselves in time. Tea teaches you that.',
    teaReferenced: 'Sheng Puerh',
    tags: ['aging', 'patience', 'puerh'],
    dateSubmitted: '2025-09-08',
  },
  {
    id: 'cw-5',
    authorName: 'David Park',
    type: 'tip',
    title: 'Start with a Gaiwan, Not a Teapot',
    body: 'When I started my gongfu journey, everyone told me to get a Yixing pot. But a $15 porcelain gaiwan was the best investment I made. It\'s neutral — doesn\'t absorb flavors — so you taste the tea honestly. Once you know what you love, then invest in clay.',
    tags: ['beginner', 'equipment', 'gongfu'],
    dateSubmitted: '2025-11-28',
  },
  {
    id: 'cw-6',
    authorName: 'Aisha Okonkwo',
    type: 'ritual',
    title: 'Tea as a Bridge Between Cultures',
    body: 'My grandmother brewed tea with cardamom and mint in Lagos. My partner\'s family does gongfu in Guangzhou. When we host, we brew both traditions side by side. Our friends always ask questions, taste, compare. Tea opens conversations that nothing else can.',
    tags: ['community', 'culture', 'ceremony'],
    dateSubmitted: '2026-01-12',
  },
  {
    id: 'cw-7',
    authorName: 'Marcus Liu',
    type: 'photo',
    title: 'First Light Through the Steam',
    body: 'There\'s a five-minute window each morning when the sun comes through my east window at just the right angle. The steam from my first pour catches the light and turns gold. I\'ve been trying to photograph this moment for months. This was the morning it finally happened.',
    tags: ['morning-ritual', 'photography', 'beauty'],
    dateSubmitted: '2026-01-05',
  },
  {
    id: 'cw-8',
    authorName: 'Elena Volkov',
    type: 'reflection',
    title: 'Why I Brew Tea Alone Before Sharing It',
    body: 'I always drink the first cup alone before inviting anyone to join. Not out of selfishness — it\'s calibration. I need to understand how the tea is behaving that day: is it opening slowly? Does it need hotter water? By the time my guests arrive, I know the tea and can guide the session well.',
    teaReferenced: 'Wuyi Rock Oolong',
    tags: ['hosting', 'gongfu', 'oolong'],
    dateSubmitted: '2025-12-18',
  },
  {
    id: 'cw-9',
    authorName: 'Tomás Herrera',
    type: 'tip',
    title: 'The Two-Cup Tasting Method',
    body: 'Pour the same infusion into two different cups — one thin porcelain, one thick stoneware. The tea will taste noticeably different in each. The thin cup highlights aroma and top notes. The thick cup rounds the body and emphasizes texture. It\'s the fastest way to understand how vessels shape flavor.',
    tags: ['tasting', 'equipment', 'experiment'],
    dateSubmitted: '2025-10-30',
  },
  {
    id: 'cw-10',
    authorName: 'Lin Xiaoming',
    type: 'ritual',
    title: 'Seasonal Tea Rotation',
    body: 'I follow a simple seasonal rotation: green and white teas in spring, cold brews in summer, oolongs in autumn, and aged puerh in winter. It\'s not a strict rule — it\'s a rhythm. Each season I look forward to the teas I haven\'t touched in months. Absence makes the flavors sharper.',
    tags: ['seasonal', 'practice', 'collection'],
    dateSubmitted: '2026-02-01',
  },
];
