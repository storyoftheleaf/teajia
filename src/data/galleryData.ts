import { GalleryImageData } from '../components/GalleryImage';

export const GALLERY_DATA: GalleryImageData[] = [
  // Tea Spaces
  {
    id: 'tea-space-1',
    section: 'tea-spaces',
    imageUrl: 'https://images.unsplash.com/photo-1556909212-d5b604d0c90d?w=500&h=600&fit=crop',
    category: 'Home Tea Corner',
    insights: [
      {
        type: 'design',
        title: 'Natural Light Placement',
        explanation: 'Notice how natural light is positioned to highlight the delicate tea leaves and vessels. Soft, diffused light is key to appreciating tea\'s visual beauty.',
      },
      {
        type: 'layout',
        title: 'Minimalist Arrangement',
        explanation: 'This space demonstrates how less is more. Each vessel has breathing room, allowing focus on the ritual itself.',
      },
    ],
    attribution: {
      name: 'Chen Wei Photography',
      label: 'Photo by',
      link: 'https://chenweiphotography.com',
    },
  },
  {
    id: 'tea-space-2',
    section: 'tea-spaces',
    imageUrl: 'https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=500&h=700&fit=crop',
    category: 'Traditional Tea Room',
    insights: [
      {
        type: 'philosophy',
        title: 'Wabi-Sabi Aesthetics',
        explanation: 'The beauty in imperfection and impermanence. Weathered wood, aged ceramics, and natural materials tell stories of time and use.',
      },
      {
        type: 'material',
        title: 'Natural Materials',
        explanation: 'Wood, stone, and clay create warmth and connection. These materials age gracefully and enhance the tea experience.',
      },
    ],
    attribution: {
      name: 'Master Lin Archives',
      label: 'Courtesy of',
      link: 'https://masterlinteahouse.com',
    },
  },

  // Tea & Vessels
  {
    id: 'tea-vessel-1',
    section: 'tea-vessels',
    imageUrl: 'https://images.unsplash.com/photo-1610701596007-11502861dcfa?w=400&h=500&fit=crop',
    category: 'Yixing Teapot Detail',
    insights: [
      {
        type: 'material',
        title: 'Purple Clay Mastery',
        explanation: 'Yixing clay absorbs tea oils over time, creating a seasoned teapot that enhances flavor. Each pot develops its own character.',
      },
      {
        type: 'curation',
        title: 'Vessel Selection',
        explanation: 'Different teas benefit from different vessel types. Purple clay works beautifully for oolong and dark teas.',
      },
    ],
    attribution: {
      name: 'Yixing Museum Collection',
      label: 'Photo from',
      link: 'https://yixingmuseum.org',
    },
  },
  {
    id: 'tea-vessel-2',
    section: 'tea-vessels',
    imageUrl: 'https://images.unsplash.com/photo-1574943400743-bcf3c3d98459?w=400&h=500&fit=crop',
    category: 'Tea Brewing Moment',
    insights: [
      {
        type: 'story',
        title: 'The Art of Steeping',
        explanation: 'Watching tea leaves unfurl and release their essence is meditative. Temperature, timing, and water quality all matter.',
      },
      {
        type: 'philosophy',
        title: 'Mindful Brewing',
        explanation: 'This moment of focus and intention is central to tea culture. It\'s not just beverage preparation—it\'s a practice.',
      },
    ],
  },

  // What Inspires Me
  {
    id: 'inspiration-1',
    section: 'inspiration',
    imageUrl: 'https://images.unsplash.com/photo-1523920290228-4f321a939b4c?w=500&h=600&fit=crop',
    category: 'Wuyi Mountain Landscape',
    insights: [
      {
        type: 'story',
        title: 'Origin Stories Matter',
        explanation: 'Found this landscape on a trip to Wuyi Mountains. Understanding where tea grows—the altitude, climate, soil—deepens appreciation.',
      },
      {
        type: 'curation',
        title: 'Single-Origin Selection',
        explanation: 'We seek out teas from specific terroirs. Each mountain region has unique characteristics that influence flavor and aroma.',
      },
    ],
    attribution: {
      name: 'Personal travel collection',
      label: 'Found in',
    },
  },
  {
    id: 'inspiration-2',
    section: 'inspiration',
    imageUrl: 'https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=500&h=600&fit=crop',
    category: 'Market Discovery',
    insights: [
      {
        type: 'story',
        title: 'Artisan Craft Discovery',
        explanation: 'Local markets reveal incredible craftspeople and traditions. This vessel was made by a fourth-generation potter.',
      },
      {
        type: 'philosophy',
        title: 'Supporting Heritage',
        explanation: 'We source directly from makers and communities. Every purchase supports traditional crafts and cultural preservation.',
      },
    ],
  },

  // What We Do
  {
    id: 'work-1',
    section: 'our-work',
    imageUrl: 'https://images.unsplash.com/photo-1517329782449-810562a4ec2f?w=500&h=700&fit=crop',
    category: 'Space Design Project - Before',
    insights: [
      {
        type: 'work',
        title: 'Design Transformation',
        explanation: 'This was a blank corner. Through thoughtful layout, lighting, and curation, it became a functional, beautiful tea space.',
      },
      {
        type: 'design',
        title: 'Functional Beauty',
        explanation: 'Every element serves a purpose. The shelf displays vessels while maintaining visual balance.',
      },
    ],
    attribution: {
      name: 'Teajia Design Archive',
      label: 'Project by',
    },
  },
  {
    id: 'work-2',
    section: 'our-work',
    imageUrl: 'https://images.unsplash.com/photo-1587825140708-dfaf72ae4b04?w=500&h=700&fit=crop',
    category: 'Restaurant Tea Bar Installation',
    insights: [
      {
        type: 'work',
        title: 'Commercial Integration',
        explanation: 'Designed this tea service area for a restaurant. It needed to be both beautiful and practical for daily service.',
      },
      {
        type: 'curation',
        title: 'Curated Selection',
        explanation: 'We selected 12 teas that complement their cuisine and educate guests about flavor profiles and origins.',
      },
    ],
    attribution: {
      name: 'Teajia Design Archive',
      label: 'Project by',
    },
  },
];
