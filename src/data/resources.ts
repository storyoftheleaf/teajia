// Curated Resources for the Community
// Playlists, guides, travel recommendations, and collections

export interface Resource {
  id: string;
  type: 'playlist' | 'guide' | 'restaurant' | 'travel' | 'collection';
  title: string;
  description: string;
  image?: string;
  content?: string; // URL or detailed content
  category?: string;
  location?: string; // For restaurants and travel guides
  dateAdded: string;
}

export const RESOURCES: Resource[] = [
  // Playlists
  {
    id: 'playlist-001',
    type: 'playlist',
    title: 'Tea Time Tranquility',
    description: 'Ambient music curated for mindful tea moments - gentle instrumental pieces that enhance focus and presence.',
    image: '/images/resources/playlist-tea-tranquility.jpg',
    content: 'https://open.spotify.com/playlist/example',
    dateAdded: '2024-09-15',
  },
  {
    id: 'playlist-002',
    type: 'playlist',
    title: 'Morning Tea Rituals',
    description: 'A collection of uplifting tracks perfect for starting your day with intention and a good cup of tea.',
    image: '/images/resources/playlist-morning.jpg',
    content: 'https://open.spotify.com/playlist/example',
    dateAdded: '2024-10-01',
  },
  {
    id: 'playlist-003',
    type: 'playlist',
    title: 'Afternoon Tea Jazz',
    description: 'Smooth jazz selections ideal for afternoon tea breaks and creative work sessions.',
    image: '/images/resources/playlist-jazz.jpg',
    content: 'https://open.spotify.com/playlist/example',
    dateAdded: '2024-10-05',
  },

  // Guides
  {
    id: 'guide-001',
    type: 'guide',
    title: 'Tea Brewing Temperature Reference',
    description: 'A comprehensive guide to optimal water temperatures for different tea types - from delicate whites to robust puerhs.',
    image: '/images/resources/guide-temperature.jpg',
    dateAdded: '2024-08-20',
  },
  {
    id: 'guide-002',
    type: 'guide',
    title: 'Setting Up Your First Gongfu Station',
    description: 'A beginner\'s guide to selecting essential tools and creating a functional tea brewing space at home.',
    image: '/images/resources/guide-gongfu-setup.jpg',
    dateAdded: '2024-09-10',
  },
  {
    id: 'guide-003',
    type: 'guide',
    title: 'Understanding Oolong: A Journey Through Oxidation Levels',
    description: 'Explore the fascinating spectrum of oolong teas, from light and floral to deep and complex roasts.',
    image: '/images/resources/guide-oolong.jpg',
    dateAdded: '2024-09-25',
  },

  // Tea Cities Restaurants & Tea Houses
  {
    id: 'restaurant-001',
    type: 'restaurant',
    title: 'Cha Zen - Kyoto',
    description: 'Traditional tea house in the heart of Kyoto offering ceremonial matcha and seasonal tea pairings.',
    location: 'Kyoto, Japan',
    image: '/images/resources/cha-zen-kyoto.jpg',
    dateAdded: '2024-07-15',
  },
  {
    id: 'restaurant-002',
    type: 'restaurant',
    title: 'T-Shirt Tea - Hangzhou',
    description: 'Modern tea lounge celebrating West Lake Dragon Well in its birthplace with contemporary design.',
    location: 'Hangzhou, China',
    image: '/images/resources/t-shirt-tea.jpg',
    dateAdded: '2024-08-01',
  },
  {
    id: 'restaurant-003',
    type: 'restaurant',
    title: 'The Infusionist - London',
    description: 'London\'s premier destination for specialty oolong and rare puerh with knowledgeable sommeliers.',
    location: 'London, UK',
    image: '/images/resources/infusionist-london.jpg',
    dateAdded: '2024-09-05',
  },
  {
    id: 'restaurant-004',
    type: 'restaurant',
    title: 'Cha Cha San - Taipei',
    description: 'Vibrant tea bar showcasing Taiwanese oolong with tea-infused snacks and creative brewing methods.',
    location: 'Taipei, Taiwan',
    image: '/images/resources/cha-cha-san.jpg',
    dateAdded: '2024-09-20',
  },

  // Travel Guides
  {
    id: 'travel-001',
    type: 'travel',
    title: 'Yunnan Tea Route: From Mountain to Cup',
    description: 'A detailed travel guide to visiting tea regions in Yunnan province, including farm visits and tea farmer stays.',
    location: 'Yunnan, China',
    image: '/images/resources/yunnan-route.jpg',
    dateAdded: '2024-07-20',
  },
  {
    id: 'travel-002',
    type: 'travel',
    title: 'Japan\'s Tea Prefecture: Shizuoka Exploration',
    description: 'Discover Japan\'s largest tea-growing region with farmstead accommodations and seasonal harvest experiences.',
    location: 'Shizuoka, Japan',
    image: '/images/resources/shizuoka-guide.jpg',
    dateAdded: '2024-08-10',
  },
  {
    id: 'travel-003',
    type: 'travel',
    title: 'Taiwan\'s Central Mountains: High Mountain Oolong Country',
    description: 'Journey through Taiwan\'s mist-covered tea mountains with homestays in traditional villages.',
    location: 'Taiwan',
    image: '/images/resources/taiwan-mountains.jpg',
    dateAdded: '2024-09-30',
  },

  // Collections & Discoveries
  {
    id: 'collection-001',
    type: 'collection',
    title: 'Ceramic Artists to Follow',
    description: 'A curated collection of contemporary ceramic artists creating beautiful vessels for tea practice.',
    category: 'Artist Directory',
    dateAdded: '2024-10-01',
  },
  {
    id: 'collection-002',
    type: 'collection',
    title: 'Tea Books Worth Reading',
    description: 'Essential reads covering tea history, philosophy, and practice from various perspectives.',
    category: 'Reading List',
    dateAdded: '2024-09-15',
  },
  {
    id: 'collection-003',
    type: 'collection',
    title: 'Instagram Accounts: Beautiful Tea Moments',
    description: 'Inspiring tea photographers and educators sharing daily moments of mindfulness and tea practice.',
    category: 'Social Inspiration',
    dateAdded: '2024-10-10',
  },
];
