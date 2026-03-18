import { ContentType } from '../../types';
import { ReadableStory } from '../../types/read';
import { PEOPLE } from '../people';
import { templateShowcase } from './template-showcase';

export const allPages: ReadableStory = {
  id: 'all-pages',
  type: ContentType.Article,
  status: 'published',
  title: 'All Pages',
  subtitle: 'Every layout in the Teajia reader',
  thumbnailUrl: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=800&h=1200&fit=crop',
  durationOrTime: '94 Pages',
  origin: 'In-house',
  description: 'A complete visual reference of every page layout available in the Teajia magazine reader — covers, text, images, quotes, data, and more.',
  tags: ['Teaching', 'Culture'],
  content: templateShowcase.content,
  author: PEOPLE.chen,
};
