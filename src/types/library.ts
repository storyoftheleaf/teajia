export type LibrarySubView = 'overview' | 'glossary' | 'playlists' | 'videos' | 'visual-guides' | 'reading';

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
}
