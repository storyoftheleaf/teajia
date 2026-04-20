export type LibrarySubView = 'overview' | 'glossary' | 'tea-map' | 'playlists' | 'videos' | 'visual-guides' | 'reading';

export interface PlaylistItem {
  id: string;
  title: string;
  description: string;
  platform: 'spotify' | 'apple-music' | 'youtube' | 'soundcloud';
  duration: string;
  externalUrl?: string;
}

export interface VideoItem {
  id: string;
  title: string;
  description: string;
  format: 'documentary' | 'video';
  duration: string;
  author?: string;
  externalUrl?: string;
}

export interface VisualGuideItem {
  id: string;
  title: string;
  description: string;
  type: 'guide' | 'reference';
  iconKey?: string;
}

export interface ReadingListItem {
  id: string;
  title: string;
  author?: string;
  format: 'book' | 'podcast' | 'article';
  description: string;
  duration?: string;
  externalUrl?: string;
  category: string;
  imageUrl?: string;
}

export interface LibrarySearchResult {
  id: string;
  title: string;
  description: string;
  section: LibrarySubView;
  sectionLabel: string;
  type?: string;
  snippet?: string;
}

export interface GlossaryTerm {
  id: string;
  term: string;
  pronunciation?: string;
  chinese?: string;
  definition: string;
  deepDive?: string;
  relatedArticleIds: string[];
  relatedProductIds: string[];
}

export interface TeaMapPin {
  id: string;
  name: string;
  lat: number;
  lng: number;
  location: string;
  note?: string;
  type: 'space' | 'tea-house' | 'farm' | 'shop' | 'market' | 'other';
}
