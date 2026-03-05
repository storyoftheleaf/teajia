// Community Member Profiles
// Each member can have Tea Inspire images linked to them

export interface CommunityMember {
  id: string;
  name: string;
  photo: string;
  bio: string; // One sentence
  socialLinks?: {
    instagram?: string;
    website?: string;
    [key: string]: string | undefined;
  };
  teaInspireImageIds: string[]; // Array of Tea Inspire image IDs
}

export const COMMUNITY_MEMBERS: CommunityMember[] = [
  {
    id: 'member-001',
    name: 'Sarah Chen',
    photo: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop',
    bio: 'Tea enthusiast exploring the intersection of traditional ceremonies and modern living.',
    socialLinks: {
      instagram: 'https://instagram.com/sarahteajourney',
      website: 'https://sarahchenteablog.com',
    },
    teaInspireImageIds: ['tea-inspire-001', 'tea-inspire-002'],
  },
  {
    id: 'member-002',
    name: 'Marcus Williams',
    photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop',
    bio: 'Ceramic artist and tea lover crafting vessels that honor the tea ceremony.',
    socialLinks: {
      instagram: 'https://instagram.com/marcuspottery',
    },
    teaInspireImageIds: ['tea-inspire-003', 'tea-inspire-004'],
  },
  {
    id: 'member-003',
    name: 'Yuki Tanaka',
    photo: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop',
    bio: 'Japanese tea farmer preserving heritage varieties while innovating sustainable practices.',
    socialLinks: {
      instagram: 'https://instagram.com/yukiteafarm',
      website: 'https://yukiteafarm.jp',
    },
    teaInspireImageIds: ['tea-inspire-005'],
  },
  {
    id: 'member-004',
    name: 'Amelia Rodriguez',
    photo: 'https://images.unsplash.com/photo-1489424731084-a5d8b219a5bb?w=200&h=200&fit=crop',
    bio: 'Interior designer bringing mindful tea spaces into contemporary homes.',
    socialLinks: {
      instagram: 'https://instagram.com/ameliateainteriors',
    },
    teaInspireImageIds: ['tea-inspire-006', 'tea-inspire-007'],
  },
  {
    id: 'member-005',
    name: 'David Park',
    photo: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop',
    bio: 'Tea photographer documenting rituals and moments across global tea communities.',
    socialLinks: {
      instagram: 'https://instagram.com/davidteaphoto',
      website: 'https://davidparkphotography.com',
    },
    teaInspireImageIds: ['tea-inspire-008', 'tea-inspire-009', 'tea-inspire-010'],
  },
];
