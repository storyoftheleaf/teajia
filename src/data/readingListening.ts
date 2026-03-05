// Reading & Listening Lists — curated media for deepening tea knowledge

export type MediaFormat = 'book' | 'podcast' | 'article' | 'video' | 'playlist' | 'documentary';

export interface ReadingListeningItem {
  id: string;
  title: string;
  author?: string;
  format: MediaFormat;
  description: string;
  externalUrl?: string;
  duration?: string;
}

export interface CuratedList {
  id: string;
  title: string;
  subtitle: string;
  iconName: 'Book' | 'Audio' | 'Play' | 'Music' | 'BookOpen' | 'Film';
  items: ReadingListeningItem[];
}

export const FORMAT_ICONS: Record<MediaFormat, string> = {
  book: 'Book',
  podcast: 'Audio',
  article: 'BookOpen',
  video: 'Play',
  playlist: 'Music',
  documentary: 'Film',
};

export const FORMAT_COLORS: Record<MediaFormat, string> = {
  book: 'bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-400/30',
  podcast: 'bg-violet-500/10 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300 border border-violet-400/30',
  article: 'bg-pink-500/10 dark:bg-pink-500/20 text-pink-700 dark:text-pink-300 border border-pink-400/30',
  video: 'bg-blue-500/10 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-400/30',
  playlist: 'bg-purple-500/10 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-400/30',
  documentary: 'bg-teal-500/10 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300 border border-teal-400/30',
};

export const CURATED_LISTS: CuratedList[] = [
  {
    id: 'cl-1',
    title: 'Beginner Reading',
    subtitle: 'Essential books and articles to start your tea education',
    iconName: 'Book',
    items: [
      {
        id: 'rl-1',
        title: 'The Tea Book',
        author: 'Linda Gaylard',
        format: 'book',
        description: 'A comprehensive visual guide to tea varieties, regions, and brewing methods. Perfect first book for anyone entering the tea world.',
        duration: '256 pages',
      },
      {
        id: 'rl-2',
        title: 'Tea: History, Terroirs, Varieties',
        author: 'Kevin Gascoyne et al.',
        format: 'book',
        description: 'The definitive reference for understanding tea from field to cup. Dense but rewarding — treat it like an encyclopedia.',
        duration: '272 pages',
      },
      // Absorbing existing articles
      {
        id: 'a1',
        title: 'Getting Started with Tea',
        format: 'article',
        description: 'A beginner\'s guide to entering the tea world — covering the basics of types, brewing, and building your first collection.',
        duration: '10 min read',
      },
      {
        id: 'a2',
        title: 'Building Your First Collection',
        format: 'article',
        description: 'How to start curating a meaningful tea collection without breaking the bank.',
        duration: '8 min read',
      },
    ],
  },
  {
    id: 'cl-2',
    title: 'Deep Dive Podcasts',
    subtitle: 'Conversations and stories for longer listening sessions',
    iconName: 'Audio',
    items: [
      {
        id: 'rl-3',
        title: 'Tea House Ghost',
        author: 'Various hosts',
        format: 'podcast',
        description: 'Stories from tea houses around the world — the people, the places, and the traditions that keep tea culture alive.',
        duration: 'Episodes 30-60 min',
      },
      {
        id: 'rl-4',
        title: 'Steep Stories',
        author: 'Tea enthusiasts',
        format: 'podcast',
        description: 'Personal stories of discovery, transformation, and connection through tea. Each episode follows one person\'s journey.',
        duration: 'Episodes 20-40 min',
      },
      {
        id: 'rl-5',
        title: 'The Art of Tea Making',
        author: 'Artisan interviews',
        format: 'podcast',
        description: 'In-depth conversations with tea makers and farmers about craft, terroir, and the science behind great tea.',
        duration: 'Episodes 45-75 min',
      },
    ],
  },
  {
    id: 'cl-3',
    title: 'Tea Films & Documentaries',
    subtitle: 'Visual journeys through tea regions and traditions',
    iconName: 'Film',
    items: [
      // Absorbing existing videos
      {
        id: 'v1',
        title: 'Tea Processing in the Field',
        format: 'documentary',
        description: 'A visual journey through harvest and initial processing — from picking to withering to rolling.',
        duration: '45 min',
      },
      {
        id: 'v2',
        title: 'Master Tea Makers at Work',
        format: 'video',
        description: 'Artisans demonstrating traditional techniques passed down through generations.',
        duration: '30 min',
      },
      {
        id: 'v3',
        title: 'Tasting Explorations',
        format: 'video',
        description: 'Guided tastings with flavor analysis, comparing regions and processing methods.',
        duration: '25 min',
      },
      {
        id: 'v4',
        title: 'Tea House Architecture & Design',
        format: 'documentary',
        description: 'Beautiful tea spaces from around the world — the architecture, materials, and philosophy behind them.',
        duration: '50 min',
      },
    ],
  },
  {
    id: 'cl-4',
    title: 'Ceremony Music',
    subtitle: 'Curated audio for your tea practice',
    iconName: 'Music',
    items: [
      // Absorbing existing music
      {
        id: 'p1',
        title: 'Ambient Tea Hour',
        format: 'playlist',
        description: 'Gentle instrumental music for relaxed tea tasting — unobtrusive and warm.',
        duration: '90 min',
      },
      {
        id: 'p2',
        title: 'Traditional Instruments',
        format: 'playlist',
        description: 'Chinese classical and traditional music — guqin, pipa, erhu, and bamboo flute.',
        duration: '120 min',
      },
      {
        id: 'p3',
        title: 'Meditation & Mindfulness',
        format: 'playlist',
        description: 'Music for focused tea ceremony practice — minimal and meditative.',
        duration: '60 min',
      },
      {
        id: 'p4',
        title: 'Nature & Water Sounds',
        format: 'playlist',
        description: 'Flowing water and forest sounds for serene moments with tea.',
        duration: '180 min',
      },
    ],
  },
  {
    id: 'cl-5',
    title: 'Philosophy & Culture',
    subtitle: 'Deeper reading on tea as a way of life',
    iconName: 'BookOpen',
    items: [
      {
        id: 'rl-6',
        title: 'The Book of Tea',
        author: 'Kakuzo Okakura',
        format: 'book',
        description: 'The classic 1906 essay on Japanese tea aesthetics and philosophy. Short, beautiful, and still profoundly relevant.',
        duration: '96 pages',
      },
      {
        id: 'a3',
        title: 'The Philosophy of Slow Tea',
        format: 'article',
        description: 'Understanding tea as a mindfulness practice — how slowing down with a cup changes everything.',
        duration: '12 min read',
      },
      {
        id: 'a4',
        title: 'Tea and Community',
        format: 'article',
        description: 'Exploring tea as a social and cultural practice — how shared cups build bonds.',
        duration: '10 min read',
      },
      {
        id: 'rl-7',
        title: 'The Way of Tea',
        author: 'Aaron Fisher',
        format: 'book',
        description: 'A modern guide to living with tea as a daily spiritual and aesthetic practice. Bridges ancient traditions with contemporary life.',
        duration: '208 pages',
      },
    ],
  },
];
