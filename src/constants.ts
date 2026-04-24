

import { ContentType, Story, Person, LearnModule, LearnPath, StarterSet } from './types';

// Soft-launch mode — hides unfinished sections from public visitors.
// Set to false to restore each route. See docs/LAUNCH_CHECKLIST.md for what's hidden and how to restore.
export const PREVIEW_MODE = false;

// Import stories and people from content directory
export { STORIES } from './content';
export { PEOPLE, PEOPLE_DIRECTORY } from './content/people';

// Re-declare PEOPLE for use in this file's exports
import { PEOPLE } from './content/people';

// Navigation Configuration
export const MAIN_NAV_ITEMS = [
  { id: 'MAGAZINE', label: 'Read', icon: 'Book', hint: 'Editorial space: interviews, visual stories, contributor pieces' },
  { id: 'LEARN', label: 'Learn', icon: 'School', hint: 'Education hub: structured courses and reference library' },
  { id: 'OFFERINGS', label: 'Partner', icon: 'Sparkles', hint: 'For-hire services: tea sessions, design curation, circles' },
  { id: 'SHOP', label: 'Shop', icon: 'Bag', hint: 'Product store: teas, teaware, and curated collections' },
] as const;

export const UTILITY_NAV = {
  YOUR_TABLE: { id: 'YOUR_TABLE', label: 'Your Table', icon: 'User', position: 'topRight' },
} as const;

export const CENTER_NAV = {
  id: 'HOME',
  label: 'Teajia',
  type: 'logo',
} as const;

export const NAV_ONBOARDING_MESSAGES = {
  magazine: 'Read interviews, visual stories, and tea house building.',
  learn: 'Take courses or browse our reference library.',
  offerings: 'Book sessions, design services, or join circles.',
  shop: 'Browse and purchase teas, teaware, and starter sets.',
  center: 'Return to home and discover featured content.',
  account: 'Manage your profile, preferences, and saved items.',
} as const;


export const LEARN_CURRICULUM: LearnModule[] = [
  {
    id: 'm1',
    title: 'Foundation',
    subtitle: 'Module 01',
    description: 'Before the brew, one must understand the leaf. We explore the botany of Camellia Sinensis.',
    lessons: [
       {
        id: 'l1-1',
        type: ContentType.Article,
        status: 'published',
        title: 'The Camellia Sinensis',
        subtitle: 'Botany',
        durationOrTime: '5 min read',
        origin: 'In-house',
        description: 'All true tea comes from one species. Everything else is processing.',
        content: [
             ":::COVER_TYPOGRAPHIC:::The Leaf|Camellia Sinensis",
             ":::TEXT_SINGLE_COL:::There is only one tea plant. Everything else is processing.",
             ":::DEFINITION_LARGE:::Camellia Sinensis (n.)\nAn evergreen shrub native to East Asia."
        ],
        drawings: true,
        author: PEOPLE.chen
      }
    ]
  },
  {
    id: 'm2',
    title: 'Brewing Fundamentals',
    subtitle: 'Module 02',
    description: 'Master the technical aspects of brewing. Learn water temperature, steeping times, and vessel selection.',
    lessons: [
       {
        id: 'l2-1',
        type: ContentType.Article,
        status: 'published',
        title: 'Water Temperature & Quality',
        subtitle: 'Brewing',
        durationOrTime: '6 min read',
        origin: 'In-house',
        description: 'The foundation of every cup begins with water.',
        content: [
             ":::COVER_TYPOGRAPHIC:::Water|The Foundation",
             ":::TEXT_SINGLE_COL:::Temperature matters. Different teas require different heat.",
             ":::DEFINITION_LARGE:::Water Temperature (n.)\nThe critical variable that affects extraction."
        ],
        drawings: true,
        author: PEOPLE.chen
      }
    ]
  },
  {
    id: 'm3',
    title: 'Flavor & Origins',
    subtitle: 'Module 03',
    description: 'Explore how terroir and processing create the world\'s flavor profiles. Journey through legendary tea regions.',
    lessons: [
       {
        id: 'l3-1',
        type: ContentType.Article,
        status: 'published',
        title: 'Geography of Taste',
        subtitle: 'Origins',
        durationOrTime: '7 min read',
        origin: 'In-house',
        description: 'Where tea grows shapes how it tastes.',
        content: [
             ":::COVER_TYPOGRAPHIC:::Origins|Geography",
             ":::TEXT_SINGLE_COL:::Tea is deeply rooted in place. Every region tells a story.",
             ":::DEFINITION_LARGE:::Terroir (n.)\nThe complete natural environment in which tea is produced."
        ],
        drawings: true,
        author: PEOPLE.chen
      }
    ]
  },
  {
    id: 'm4',
    title: 'Tea Ceremony & Mindfulness',
    subtitle: 'Module 04',
    description: 'Transform tea drinking into a practice of presence and intention. Learn traditional and modern rituals.',
    lessons: [
       {
        id: 'l4-1',
        type: ContentType.Article,
        status: 'published',
        title: 'The Practice of Presence',
        subtitle: 'Mindfulness',
        durationOrTime: '8 min read',
        origin: 'In-house',
        description: 'Tea as a path to stillness.',
        content: [
             ":::COVER_TYPOGRAPHIC:::Presence|Mindfulness",
             ":::TEXT_SINGLE_COL:::The cup is a gateway to the present moment.",
             ":::DEFINITION_LARGE:::Tea Ceremony (n.)\nA ritualized practice of intention and awareness."
        ],
        drawings: true,
        author: PEOPLE.chen
      }
    ]
  },
  {
    id: 'm5',
    title: 'Vessel Selection & Design',
    subtitle: 'Module 05',
    description: 'Understand how teaware affects the tea experience. Explore materials, forms, and the craft behind each piece.',
    lessons: [
       {
        id: 'l5-1',
        type: ContentType.Article,
        status: 'published',
        title: 'The Vessel & The Leaf',
        subtitle: 'Design',
        durationOrTime: '7 min read',
        origin: 'In-house',
        description: 'Form follows function in tea ceremony.',
        content: [
             ":::COVER_TYPOGRAPHIC:::Vessels|Design",
             ":::TEXT_SINGLE_COL:::Every vessel is a decision. Material, shape, heat retention.",
             ":::DEFINITION_LARGE:::Teaware (n.)\nCeramics and vessels designed to enhance the tea experience."
        ],
        drawings: true,
        author: PEOPLE.lin
      }
    ]
  },
  {
    id: 'm6',
    title: 'Community & Culture',
    subtitle: 'Module 06',
    description: 'Connect with others who share the tea way. Learn about global tea cultures and building meaningful community.',
    lessons: [
       {
        id: 'l6-1',
        type: ContentType.Article,
        status: 'published',
        title: 'The Tea Circle',
        subtitle: 'Community',
        durationOrTime: '6 min read',
        origin: 'In-house',
        description: 'Tea is best shared.',
        content: [
             ":::COVER_TYPOGRAPHIC:::Community|Gathering",
             ":::TEXT_SINGLE_COL:::Tea brings people together across cultures and continents.",
             ":::DEFINITION_LARGE:::Tea Circle (n.)\nA gathering of people united by tea and intention."
        ],
        drawings: true,
        author: PEOPLE.chen
      }
    ]
  }
];

export const LEARN_PATHS: LearnPath[] = [
  {
    id: 'path-beginner',
    title: 'Beginner',
    description: 'Start here. The leaf, the water, and your first cup.',
    icon: 'Leaf',
    modules: ['m1', 'm4', 'm2']
  },
  {
    id: 'path-brewing',
    title: 'Brewing Mastery',
    description: 'Master the technical craft of brewing.',
    icon: 'Teapot',
    modules: ['m1', 'm2', 'm5', 'm3']
  },
  {
    id: 'path-community',
    title: 'Community & Culture',
    description: 'Tea culture, connection, and sharing.',
    icon: 'Teapot',
    modules: ['m6', 'm4', 'm3', 'm1']
  }
];

export const LEARN_STORIES = [];

export const STARTER_SETS: StarterSet[] = [
  {
    id: 'set-mindful-start',
    name: 'The Mindful Start',
    shortDescription: 'Begin your tea journey with intention and presence.',
    description: 'Everything you need to begin your tea journey with intention and presence. Perfect for beginners looking to establish a daily tea practice.',
    image: 'https://picsum.photos/400/500?random=301',
    price: '$45',
    discount: 'Save $8 vs. individual items',
    items: [
      { type: 'tea', itemId: 'green-001' },
      { type: 'ware', itemId: 'infuser-basic' },
      { type: 'ware', itemId: 'scoop-bamboo' }
    ],
    tags: ['Beginner', 'Mindfulness', 'Daily Practice']
  },
  {
    id: 'set-gongfu-essentials',
    name: 'Gongfu Essentials',
    shortDescription: 'Master traditional gongfu brewing with premium oolong.',
    description: 'Master the traditional brewing method with this curated set. Includes a quality oolong, ceramic gaiwan, and all the accessories you need for proper gongfu tea ceremony.',
    image: 'https://picsum.photos/400/500?random=302',
    price: '$72',
    discount: 'Save $12 vs. individual items',
    items: [
      { type: 'tea', itemId: 'oolong-001' },
      { type: 'ware', itemId: 'gaiwan-ceramic' },
      { type: 'ware', itemId: 'teacup-small' },
      { type: 'ware', itemId: 'pitcher-fairness' }
    ],
    tags: ['Intermediate', 'Gongfu', 'Oolong']
  },
  {
    id: 'set-puerh-journey',
    name: 'The Puerh Journey',
    shortDescription: 'Discover aged Puerh with traditional clay brewing.',
    description: 'Explore the depth and complexity of aged Puerh tea. This set includes a high-quality Puerh cake, traditional Yixing clay pot, and guide to appreciating this noble tea.',
    image: 'https://picsum.photos/400/500?random=303',
    price: '$89',
    discount: 'Save $15 vs. individual items',
    items: [
      { type: 'tea', itemId: 'puerh-sheng' },
      { type: 'ware', itemId: 'yixing-pot' },
      { type: 'ware', itemId: 'knock-stick' }
    ],
    tags: ['Advanced', 'Puerh', 'Collectible']
  },
  {
    id: 'set-white-tea-elegance',
    name: 'White Tea Elegance',
    shortDescription: 'Delicate white tea with elegant brewing vessel.',
    description: 'Discover the subtle, delicate world of white tea. This minimalist set includes premium white tea, elegant brewing vessel, and everything for a refined tasting experience.',
    image: 'https://picsum.photos/400/500?random=304',
    price: '$38',
    discount: 'Save $6 vs. individual items',
    items: [
      { type: 'tea', itemId: 'white-001' },
      { type: 'ware', itemId: 'glass-infuser' },
      { type: 'ware', itemId: 'teacup-porcelain' }
    ],
    tags: ['Beginner', 'White Tea', 'Elegant']
  },
  {
    id: 'set-black-tea-afternoon',
    name: 'Afternoon Black Tea',
    shortDescription: 'Classic afternoon tea service with premium black tea.',
    description: 'Celebrate the art of afternoon tea with this classic set. Premium black tea, beautiful teapot, and traditional accessories for the perfect afternoon brew.',
    image: 'https://picsum.photos/400/500?random=305',
    price: '$55',
    discount: 'Save $10 vs. individual items',
    items: [
      { type: 'tea', itemId: 'black-001' },
      { type: 'ware', itemId: 'teapot-ceramic' },
      { type: 'ware', itemId: 'strainer-metal' },
      { type: 'ware', itemId: 'timer' }
    ],
    tags: ['Beginner', 'Black Tea', 'Social']
  },
  {
    id: 'set-travel-companion',
    name: 'Travel Companion',
    shortDescription: 'Portable tea setup for brewing on the go.',
    description: 'Bring your tea practice anywhere with this portable set. Lightweight, durable vessel and premium tea selection designed for adventure.',
    image: 'https://picsum.photos/400/500?random=306',
    price: '$42',
    discount: 'Save $7 vs. individual items',
    items: [
      { type: 'tea', itemId: 'green-001' },
      { type: 'ware', itemId: 'travel-tumbler' },
      { type: 'ware', itemId: 'tea-bag-diffuser' }
    ],
    tags: ['Portable', 'Travel', 'Convenient']
  }
];

// NEW: Separate Tea-focused and Teaware-focused Starter Sets
export const STARTER_TEA_SETS: StarterSet[] = [
  {
    id: 'set-tea-tasting-journey',
    name: 'Tea Tasting Journey',
    shortDescription: 'Explore three classic teas with a versatile brewing vessel.',
    description: 'A guided introduction to the world of loose-leaf tea. This set pairs three distinct varieties — a crisp green, a fragrant oolong, and a delicate white — with a glass infuser that lets you watch the leaves unfurl. Each tea is portioned at 50g, enough for weeks of daily brewing and the kind of repeated steepings where real appreciation begins.',
    idealFor: 'First-time loose-leaf drinkers ready to move beyond tea bags',
    image: 'https://picsum.photos/400/500?random=401',
    price: '$52',
    discount: 'Save $10 vs. individual items',
    items: [
      { type: 'tea', itemId: 'green-001' },
      { type: 'tea', itemId: 'oolong-001' },
      { type: 'tea', itemId: 'white-001' },
      { type: 'ware', itemId: 'glass-infuser' }
    ],
    tags: ['Beginner', 'Variety', 'Exploration']
  },
  {
    id: 'set-puerh-experience',
    name: 'Puerh Experience',
    shortDescription: 'Discover aged Puerh with traditional Yixing clay brewing.',
    description: 'Puerh is tea at its most patient — fermented, aged, and transformed by time. This set includes a raw sheng puerh that rewards careful brewing with layers of camphor, sweetness, and stone-fruit complexity. The unglazed Yixing clay pot absorbs the tea\'s oils over time, developing a seasoned patina that improves every session. The included puerh knife lets you break cakes cleanly.',
    idealFor: 'Tea drinkers curious about aged and fermented teas',
    image: 'https://picsum.photos/400/500?random=303',
    price: '$89',
    discount: 'Save $15 vs. individual items',
    items: [
      { type: 'tea', itemId: 'puerh-sheng' },
      { type: 'ware', itemId: 'yixing-pot' },
      { type: 'ware', itemId: 'knock-stick' }
    ],
    tags: ['Advanced', 'Puerh', 'Collectible']
  },
  {
    id: 'set-ceremonial-oolong',
    name: 'Ceremonial Oolong Set',
    shortDescription: 'Master gongfu brewing with premium oolong and tools.',
    description: 'Gongfu cha — "tea with skill" — is the traditional Chinese method of brewing with small vessels, high leaf ratios, and multiple rapid infusions. This set provides everything for a proper session: a porcelain gaiwan for precise temperature control, a fairness pitcher to ensure even distribution, a tasting cup sized for contemplation, and a premium oolong that reveals new character across eight or more steepings.',
    idealFor: 'Anyone ready to learn traditional Chinese gongfu brewing',
    image: 'https://picsum.photos/400/500?random=302',
    price: '$72',
    discount: 'Save $12 vs. individual items',
    items: [
      { type: 'tea', itemId: 'oolong-001' },
      { type: 'ware', itemId: 'gaiwan-ceramic' },
      { type: 'ware', itemId: 'teacup-small' },
      { type: 'ware', itemId: 'pitcher-fairness' }
    ],
    tags: ['Intermediate', 'Gongfu', 'Oolong']
  },
  {
    id: 'set-afternoon-tea-ritual',
    name: 'Afternoon Tea Ritual',
    shortDescription: 'Classic black tea service for elegant afternoon sessions.',
    description: 'The afternoon tea tradition is one of slowing down — a deliberate pause in the day. This set includes a full-bodied black tea with malt and honey notes, a ceramic teapot that retains heat beautifully, a fine-mesh strainer for a clean pour, and a sand timer for consistent steeping. Simple enough for everyday use, refined enough for guests.',
    idealFor: 'Those who want a daily ritual or a way to host friends over tea',
    image: 'https://picsum.photos/400/500?random=305',
    price: '$55',
    discount: 'Save $10 vs. individual items',
    items: [
      { type: 'tea', itemId: 'black-001' },
      { type: 'ware', itemId: 'teapot-ceramic' },
      { type: 'ware', itemId: 'strainer-metal' },
      { type: 'ware', itemId: 'timer' }
    ],
    tags: ['Beginner', 'Black Tea', 'Social']
  },
];

export const STARTER_TEAWARE_SETS: StarterSet[] = [
  {
    id: 'set-gongfu-essentials',
    name: 'Gongfu Essentials',
    shortDescription: 'Complete gongfu brewing setup for traditional ceremony.',
    description: 'The foundation of a proper gongfu tea table. The ceramic gaiwan gives you direct control over steep time and water flow. The fairness pitcher ensures every cup from a session tastes identical. The small tasting cup concentrates aroma and invites slow sipping. The bamboo scoop completes the ritual with a tactile, natural measuring tool.',
    idealFor: 'Building a dedicated tea space at home',
    image: 'https://picsum.photos/400/500?random=402',
    price: '$58',
    discount: 'Save $9 vs. individual items',
    items: [
      { type: 'ware', itemId: 'gaiwan-ceramic' },
      { type: 'ware', itemId: 'pitcher-fairness' },
      { type: 'ware', itemId: 'teacup-small' },
      { type: 'ware', itemId: 'scoop-bamboo' }
    ],
    tags: ['Gongfu', 'Traditional', 'Complete']
  },
  {
    id: 'set-modern-brewer-kit',
    name: 'Modern Brewer Kit',
    shortDescription: 'Versatile brewing tools for everyday convenience.',
    description: 'Not everyone wants ceremony — sometimes you just want excellent tea, fast. This kit pairs two infuser styles (basket and glass) so you can match vessel to mood: quick office mug or slow weekend steep. The precision strainer catches even the finest leaves, and the bamboo scoop replaces guessing with consistency.',
    idealFor: 'Busy people who want great tea without the ritual',
    image: 'https://picsum.photos/400/500?random=403',
    price: '$42',
    discount: 'Save $7 vs. individual items',
    items: [
      { type: 'ware', itemId: 'infuser-basic' },
      { type: 'ware', itemId: 'glass-infuser' },
      { type: 'ware', itemId: 'strainer-metal' },
      { type: 'ware', itemId: 'scoop-bamboo' }
    ],
    tags: ['Modern', 'Versatile', 'Daily']
  },
  {
    id: 'set-travel-companion-ware',
    name: 'Travel Companion',
    shortDescription: 'Portable tea setup for brewing on the go.',
    description: 'Your tea practice shouldn\'t stop at the front door. The double-walled travel tumbler keeps tea hot for hours without burning your hands. The silicone bag diffuser works with any cup you find along the way. The porcelain tasting cup is small enough to pack but beautiful enough to make a hotel room feel like home.',
    idealFor: 'Frequent travelers and commuters who refuse bad tea',
    image: 'https://picsum.photos/400/500?random=306',
    price: '$38',
    discount: 'Save $6 vs. individual items',
    items: [
      { type: 'ware', itemId: 'travel-tumbler' },
      { type: 'ware', itemId: 'tea-bag-diffuser' },
      { type: 'ware', itemId: 'teacup-porcelain' }
    ],
    tags: ['Portable', 'Travel', 'Convenient']
  },
  {
    id: 'set-minimalist-elegance',
    name: 'Minimalist Elegance',
    shortDescription: 'Simple, refined pieces for mindful tea moments.',
    description: 'Sometimes less is the entire point. A single porcelain cup, a clear glass infuser that turns brewing into a visual meditation, and a hand-carved bamboo scoop. No clutter, no fuss — just the essentials for one person to sit quietly with a good tea. The kind of set that makes you want to brew more often.',
    idealFor: 'Minimalists and solo tea drinkers who value simplicity',
    image: 'https://picsum.photos/400/500?random=404',
    price: '$35',
    discount: 'Save $5 vs. individual items',
    items: [
      { type: 'ware', itemId: 'teacup-porcelain' },
      { type: 'ware', itemId: 'glass-infuser' },
      { type: 'ware', itemId: 'scoop-bamboo' }
    ],
    tags: ['Minimalist', 'Elegant', 'Simple']
  }
];
