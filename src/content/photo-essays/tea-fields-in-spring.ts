import { ContentType, Story } from '../../types';
import { PEOPLE } from '../people';

export const teaFieldsInSpring: Story = {
  id: 'essay-1',
  type: ContentType.PhotoEssay,
  status: 'published',
  title: 'Tea Fields in Spring',
  subtitle: 'Landscapes',
  thumbnailUrl: 'https://images.unsplash.com/photo-1545069122-7236651d5c7e?w=800&h=600&fit=crop',
  durationOrTime: '12 Pages',
  origin: 'In-house',
  description: 'A visual journey through terraced tea plantations awakening in spring.',
  gallery: [
    { url: 'https://images.unsplash.com/photo-1563822249366-7b0d8e7295cf?w=800&h=600&fit=crop', caption: 'Terraced fields at dawn with morning mist rolling through the valleys.' },
    { url: 'https://images.unsplash.com/photo-1563822249548-9a72b6353cd1?w=800&h=600&fit=crop', caption: 'Harvest hands reaching for the youngest leaves in the pale spring light.' },
    { url: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=600&fit=crop', caption: 'Freshly picked leaves in woven baskets awaiting processing.' },
    { url: 'https://images.unsplash.com/photo-1523920290228-4f321a939b4c?w=800&h=600&fit=crop', caption: 'Misty mountain landscape where the tea bushes stretch endlessly into the clouds.' },
  ],
  author: PEOPLE.li,
};
