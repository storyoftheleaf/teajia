import { ContentType, Story } from '../../types';
import { PEOPLE } from '../people';

export const handsOfCraft: Story = {
  id: 'essay-2',
  type: ContentType.PhotoEssay,
  status: 'published',
  title: 'Hands of Craft',
  subtitle: 'Process',
  thumbnailUrl: 'https://images.unsplash.com/photo-1578365746405-da4f83b81b3b?w=800&h=600&fit=crop',
  durationOrTime: '10 Pages',
  origin: 'In-house',
  description: 'Close observations of artisan hands shaping clay and craft.',
  gallery: [
    { url: 'https://images.unsplash.com/photo-1610701596007-11502861dcfa?w=800&h=600&fit=crop', caption: 'Master ceramicist hands shaping teaware on the potter\'s wheel.' },
    { url: 'https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=800&h=600&fit=crop', caption: 'Mid-action pour captured in soft afternoon light, water flowing from pot to cup.' },
    { url: 'https://images.unsplash.com/photo-1563822249366-7b0d8e7295cf?w=800&h=600&fit=crop', caption: 'Delicate leaf sorting by experienced hands, separating grades for processing.' },
    { url: 'https://images.unsplash.com/photo-1587825140708-dfaf72ae4b04?w=800&h=600&fit=crop', caption: 'Vessel preparation before the kiln firing, hands arranging pottery with care.' },
  ],
  author: PEOPLE.li,
};
