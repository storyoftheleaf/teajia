import { GLOSSARY_TERMS } from '../data/glossary';
import { PLAYLISTS } from '../data/playlists';
import { VIDEOS } from '../data/videos';
import { VISUAL_GUIDES } from '../data/visualGuides';
import { READING_LIST } from '../data/readingList';
import type { LibrarySearchResult, LibrarySubView } from '../types/library';

const SECTION_LABELS: Record<LibrarySubView, string> = {
  overview: 'Overview',
  glossary: 'Glossary',
  'tea-map': 'Tea Map',
  playlists: 'Playlists',
  videos: 'Videos',
  'visual-guides': 'Visual Guides',
  reading: 'Reading',
};

export type SearchResult = LibrarySearchResult & { type: LibrarySubView; snippet: string };

function matches(text: string | undefined, query: string): boolean {
  return !!text && text.toLowerCase().includes(query);
}

export function searchLibrary(query: string): LibrarySearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const results: LibrarySearchResult[] = [];

  for (const term of GLOSSARY_TERMS) {
    if (matches(term.term, q) || matches(term.definition, q) || matches(term.chineseCharacters, q)) {
      results.push({
        id: term.id,
        title: term.term,
        description: term.definition.slice(0, 100),
        section: 'glossary',
        sectionLabel: SECTION_LABELS.glossary,
      });
    }
  }

  for (const item of PLAYLISTS) {
    if (matches(item.title, q) || matches(item.description, q)) {
      results.push({
        id: item.id,
        title: item.title,
        description: item.description.slice(0, 100),
        section: 'playlists',
        sectionLabel: SECTION_LABELS.playlists,
      });
    }
  }

  for (const item of VIDEOS) {
    if (matches(item.title, q) || matches(item.description, q)) {
      results.push({
        id: item.id,
        title: item.title,
        description: item.description.slice(0, 100),
        section: 'videos',
        sectionLabel: SECTION_LABELS.videos,
      });
    }
  }

  for (const item of VISUAL_GUIDES) {
    if (matches(item.title, q) || matches(item.description, q)) {
      results.push({
        id: item.id,
        title: item.title,
        description: item.description.slice(0, 100),
        section: 'visual-guides',
        sectionLabel: SECTION_LABELS['visual-guides'],
      });
    }
  }

  for (const item of READING_LIST) {
    if (matches(item.title, q) || matches(item.description, q) || matches(item.author, q)) {
      results.push({
        id: item.id,
        title: item.title,
        description: item.description.slice(0, 100),
        section: 'reading',
        sectionLabel: SECTION_LABELS.reading,
      });
    }
  }

  return results;
}
