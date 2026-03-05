// Tea Moments Gallery Images
// Collection of community member tea setups and moments

export type TeaMomentCategory = 'morning' | 'travel' | 'seasonal' | 'setup' | 'ritual';
export type TeaMomentSeason = 'spring' | 'summer' | 'autumn' | 'winter';

export interface TeaInspireInsight {
  type: 'design' | 'curation' | 'layout' | 'material' | 'philosophy' | 'story' | 'work';
  title: string;
  explanation: string;
}

export interface TeaInspireImage {
  id: string;
  imageUrl: string;
  caption: string; // One sentence describing the photo
  communityMemberId: string; // Links to community member
  dateAdded: string; // ISO date format
  insights?: TeaInspireInsight[];
  // Enhanced fields for Tea Moments redesign
  category: TeaMomentCategory;
  tags?: string[];
  teaFeatured?: string; // Tea name if identifiable
  teawareIdentified?: string[]; // Teaware in image
  location?: string;
  season?: TeaMomentSeason;
  designedByTeajia?: boolean; // For portfolio cross-link
  featured?: boolean; // Featured moment
}

export const TEA_INSPIRE_IMAGES: TeaInspireImage[] = [
  {
    id: 'tea-inspire-001',
    imageUrl: 'https://images.unsplash.com/photo-1597318158529-cf0c4b970db0?w=600&h=600&fit=crop',
    caption: 'Morning gongfu session with aged white peony in a beloved celadon gaiwan.',
    communityMemberId: 'member-001',
    dateAdded: '2024-10-15',
    category: 'morning',
    teaFeatured: 'Aged White Peony',
    teawareIdentified: ['Celadon Gaiwan', 'Cha Hai'],
    season: 'autumn',
    featured: true,
    insights: [
      {
        type: 'design',
        title: 'Celadon Elegance',
        explanation: 'The soft green glaze complements the pale liquor of aged white peony, creating visual harmony.',
      },
      {
        type: 'philosophy',
        title: 'Patience in Steeping',
        explanation: 'Each infusion reveals different layers, rewarding attentive presence.',
      },
    ],
  },
  {
    id: 'tea-inspire-002',
    imageUrl: 'https://images.unsplash.com/photo-1544432415-6f4ee803d572?w=600&h=600&fit=crop',
    caption: 'Afternoon light through the window during a solo tea moment at home.',
    communityMemberId: 'member-001',
    dateAdded: '2024-10-20',
    category: 'ritual',
    season: 'autumn',
    location: 'Home Studio',
    insights: [
      {
        type: 'curation',
        title: 'Golden Hour',
        explanation: 'The natural light transforms an ordinary moment into something contemplative.',
      },
    ],
  },
  {
    id: 'tea-inspire-003',
    imageUrl: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=600&h=600&fit=crop',
    caption: 'Hand-thrown vessels arranged before a tea gathering with close friends.',
    communityMemberId: 'member-002',
    dateAdded: '2024-10-10',
    category: 'ritual',
    teawareIdentified: ['Handmade Cups', 'Tea Tray'],
    tags: ['gathering', 'handmade', 'community'],
    insights: [
      {
        type: 'material',
        title: 'Handmade Intentionality',
        explanation: 'Each piece carries the maker\'s touch, adding warmth to the tea experience.',
      },
      {
        type: 'work',
        title: 'Craft Connection',
        explanation: 'Using self-made vessels deepens the relationship between maker, tea, and drinker.',
      },
    ],
  },
  {
    id: 'tea-inspire-004',
    imageUrl: 'https://images.unsplash.com/photo-1578365746405-da4f83b81b3b?w=600&h=600&fit=crop',
    caption: 'Studio workspace with glazes and tea test cups mid-creation.',
    communityMemberId: 'member-002',
    dateAdded: '2024-10-25',
    category: 'setup',
    tags: ['ceramics', 'studio', 'craft'],
    teawareIdentified: ['Test Cups', 'Glaze Materials'],
  },
  {
    id: 'tea-inspire-005',
    imageUrl: 'https://images.unsplash.com/photo-1545069122-7236651d5c7e?w=600&h=600&fit=crop',
    caption: 'Early morning harvest in the tea fields of Shizuoka prefecture.',
    communityMemberId: 'member-003',
    dateAdded: '2024-09-30',
    category: 'travel',
    location: 'Shizuoka, Japan',
    season: 'spring',
    tags: ['harvest', 'origin', 'japan'],
    insights: [
      {
        type: 'story',
        title: 'Seasonal Rhythm',
        explanation: 'Harvesting at dawn captures the most delicate leaves touched by morning dew.',
      },
      {
        type: 'philosophy',
        title: 'Heritage Preservation',
        explanation: 'Maintaining traditional methods ensures each tea carries generations of wisdom.',
      },
    ],
  },
  {
    id: 'tea-inspire-006',
    imageUrl: 'https://images.unsplash.com/photo-1511920170033-f8396924c348?w=600&h=600&fit=crop',
    caption: 'Minimalist tea corner in a Tokyo apartment celebrating open space and calm.',
    communityMemberId: 'member-004',
    dateAdded: '2024-10-18',
    category: 'setup',
    location: 'Tokyo, Japan',
    designedByTeajia: true,
    featured: true,
    tags: ['minimalist', 'urban', 'home'],
    insights: [
      {
        type: 'design',
        title: 'Negative Space',
        explanation: 'Empty space around the tea setup creates room for mindfulness and presence.',
      },
      {
        type: 'layout',
        title: 'Urban Zen',
        explanation: 'Bringing tea ceremony principles into contemporary city living.',
      },
    ],
  },
  {
    id: 'tea-inspire-007',
    imageUrl: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=600&h=600&fit=crop',
    caption: 'Natural wood shelving displaying a curated collection of vessels and tools.',
    communityMemberId: 'member-004',
    dateAdded: '2024-10-22',
    category: 'setup',
    teawareIdentified: ['Various Cups', 'Tea Tools', 'Display Shelf'],
    tags: ['collection', 'display', 'wood'],
    insights: [
      {
        type: 'curation',
        title: 'Thoughtful Selection',
        explanation: 'Each piece displayed has been chosen for both beauty and functional purpose.',
      },
    ],
  },
  {
    id: 'tea-inspire-008',
    imageUrl: 'https://images.unsplash.com/photo-1597318309474-5c5ab0bae24d?w=600&h=600&fit=crop',
    caption: 'Golden oolong captured mid-infusion with steam rising in the afternoon light.',
    communityMemberId: 'member-005',
    dateAdded: '2024-10-14',
    category: 'ritual',
    teaFeatured: 'High Mountain Oolong',
    season: 'autumn',
    tags: ['brewing', 'oolong', 'golden'],
    insights: [
      {
        type: 'design',
        title: 'Liquid Gold',
        explanation: 'The translucent amber tone of well-brewed oolong is a joy to behold.',
      },
    ],
  },
  {
    id: 'tea-inspire-009',
    imageUrl: 'https://images.unsplash.com/photo-1597318309474-5c5ab0bae24d?w=600&h=600&fit=crop',
    caption: 'Tea gathering ceremony with multiple people sharing an ancient puerh.',
    communityMemberId: 'member-005',
    dateAdded: '2024-10-28',
    category: 'ritual',
    teaFeatured: 'Aged Puerh',
    tags: ['gathering', 'ceremony', 'sharing'],
    insights: [
      {
        type: 'story',
        title: 'Shared Experience',
        explanation: 'Tea brings people together across different cultures and backgrounds.',
      },
      {
        type: 'philosophy',
        title: 'Time Capsule',
        explanation: 'Aged puerh connects us to the past and creates new memories for the future.',
      },
    ],
  },
  {
    id: 'tea-inspire-010',
    imageUrl: 'https://images.unsplash.com/photo-1544432415-6f4ee803d572?w=600&h=600&fit=crop',
    caption: 'Hands pouring tea during a quiet moment of solitude and reflection.',
    communityMemberId: 'member-005',
    dateAdded: '2024-11-01',
    category: 'morning',
    tags: ['pouring', 'hands', 'mindfulness'],
    insights: [
      {
        type: 'curation',
        title: 'Ritual Hands',
        explanation: 'The movement and gesture of pouring is itself a meditation.',
      },
    ],
  },
  {
    id: 'tea-inspire-011',
    imageUrl: 'https://images.unsplash.com/photo-1558160074-4d7d8bdf4256?w=600&h=600&fit=crop',
    caption: 'First spring flush gyokuro prepared in the quiet of early morning.',
    communityMemberId: 'member-003',
    dateAdded: '2024-11-05',
    category: 'seasonal',
    teaFeatured: 'Gyokuro',
    season: 'spring',
    location: 'Uji, Japan',
    tags: ['spring', 'first-flush', 'japanese'],
    insights: [
      {
        type: 'story',
        title: 'Spring Awakening',
        explanation: 'The first harvest of the year carries the energy of renewal and fresh beginnings.',
      },
    ],
  },
  {
    id: 'tea-inspire-012',
    imageUrl: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=600&h=600&fit=crop',
    caption: 'Summer iced tea session on a sunlit balcony with cold-brewed sencha.',
    communityMemberId: 'member-001',
    dateAdded: '2024-11-08',
    category: 'seasonal',
    teaFeatured: 'Cold Brew Sencha',
    season: 'summer',
    tags: ['cold-brew', 'summer', 'refreshing'],
    insights: [
      {
        type: 'design',
        title: 'Cool Clarity',
        explanation: 'Cold brewing reveals a different dimension of the same leaves - sweeter, more delicate.',
      },
    ],
  },
];
