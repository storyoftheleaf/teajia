import { ContentType, Story } from '../../types';
import { PEOPLE } from '../people';

export const vesselsAndLight: Story = {
  id: 'essay-3',
  type: ContentType.PhotoEssay,
  status: 'published',
  title: 'Vessels & Light',
  subtitle: 'Studio',
  thumbnailUrl: 'https://images.unsplash.com/photo-1511920170033-f8396924c348?w=800&h=600&fit=crop',
  durationOrTime: '11 Pages',
  origin: 'Curated',
  description: 'Studio photography exploring the beauty of teaware through light and shadow.',
  gallery: [
    { url: 'https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=800&h=600&fit=crop', caption: 'Ceramic gaiwan backlit by golden hour light, revealing translucent celadon glaze.' },
    { url: 'https://images.unsplash.com/photo-1610701596007-11502861dcfa?w=800&h=600&fit=crop', caption: 'Porcelain teapot with deep shadows defining its sculptural form and details.' },
    { url: 'https://images.unsplash.com/photo-1587825140708-dfaf72ae4b04?w=800&h=600&fit=crop', caption: 'Glaze texture magnified, showing the subtle patterns created during firing.' },
    { url: 'https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=800&h=600&fit=crop', caption: 'Complete tea set arranged with intentional spacing, ready for the ceremony.' },
  ],
  author: PEOPLE.li,
};
