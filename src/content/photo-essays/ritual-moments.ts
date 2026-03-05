import { ContentType, Story } from '../../types';
import { PEOPLE } from '../people';

export const ritualMoments: Story = {
  id: 'essay-4',
  type: ContentType.PhotoEssay,
  status: 'published',
  title: 'Ritual Moments',
  subtitle: 'Gatherings',
  thumbnailUrl: 'https://images.unsplash.com/photo-1544432415-6f4ee803d572?w=800&h=600&fit=crop',
  durationOrTime: '14 Pages',
  origin: 'In-house',
  description: 'Documentary-style photography capturing the intimate moments of tea ceremonies and gatherings.',
  gallery: [
    { url: 'https://images.unsplash.com/photo-1556909212-d5b604d0c90d?w=800&h=600&fit=crop', caption: 'Careful preparation of the tea ceremony space, arranging vessels and setting intentions.' },
    { url: 'https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=800&h=600&fit=crop', caption: 'Person in quiet contemplation during a solo tea moment, lost in thought and presence.' },
    { url: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=600&fit=crop', caption: 'Multi-person gathering around the tea table, sharing conversation and connection.' },
    { url: 'https://images.unsplash.com/photo-1523920290228-4f321a939b4c?w=800&h=600&fit=crop', caption: 'Outdoor tea moment in nature, brew catching the last light of day by a window.' },
  ],
  author: PEOPLE.li,
};
