// Design Portfolio - Tea Space Design Projects
// Placeholder projects showcasing Teajia's design services

export type ProjectType = 'home' | 'commercial' | 'outdoor' | 'popup';
export type ProjectStatus = 'completed' | 'in-progress' | 'concept';

export interface DesignProject {
  id: string;
  title: string;
  subtitle: string;
  projectType: ProjectType;
  status: ProjectStatus;
  location: string;
  year: number;
  description: string;
  imageUrl: string;
  galleryImages?: string[];
  features: string[];
  testimonial?: {
    quote: string;
    author: string;
    role: string;
  };
  isPlaceholder?: boolean;
}

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  home: 'Home Tea Space',
  commercial: 'Commercial Tea Room',
  outdoor: 'Garden Tea Space',
  popup: 'Pop-up Installation',
};

export const DESIGN_PROJECTS: DesignProject[] = [
  {
    id: 'project-001',
    title: 'Urban Zen Corner',
    subtitle: 'A Minimalist Tea Nook in Tokyo',
    projectType: 'home',
    status: 'completed',
    location: 'Tokyo, Japan',
    year: 2024,
    description: 'Transforming a compact apartment corner into a serene tea sanctuary. This project embraced the constraints of urban living to create a space that feels expansive through thoughtful material selection and natural light optimization.',
    imageUrl: 'https://images.unsplash.com/photo-1511920170033-f8396924c348?w=800&h=600&fit=crop',
    galleryImages: [
      'https://images.unsplash.com/photo-1511920170033-f8396924c348?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1545069122-7236651d5c7e?w=800&h=600&fit=crop',
    ],
    features: [
      'Custom low tea table with hidden storage',
      'Shoji-inspired light filtering panels',
      'Integrated water feature for ambient sound',
      'Curated teaware display shelving',
    ],
    testimonial: {
      quote: 'My small apartment now feels like a retreat. Every morning tea session is a moment of peace.',
      author: 'Yuki M.',
      role: 'Homeowner',
    },
    isPlaceholder: true,
  },
  {
    id: 'project-002',
    title: 'The Leaf Room',
    subtitle: 'Commercial Tea Tasting Space',
    projectType: 'commercial',
    status: 'completed',
    location: 'San Francisco, CA',
    year: 2024,
    description: 'A destination tea room designed for a specialty tea retailer. The space needed to serve multiple functions: retail display, tasting sessions, and private events—all while maintaining an atmosphere of calm sophistication.',
    imageUrl: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&h=600&fit=crop',
    galleryImages: [
      'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1597318309474-5c5ab0bae24d?w=800&h=600&fit=crop',
    ],
    features: [
      'Modular seating for flexible configurations',
      'Climate-controlled tea storage display',
      'Live-edge communal tasting counter',
      'Acoustic treatments for intimate conversations',
      'Water filtration system with multiple stations',
    ],
    testimonial: {
      quote: 'Our customers immediately slow down when they enter. The space itself teaches them about the tea experience.',
      author: 'Chen Wei',
      role: 'Owner, The Leaf Room',
    },
    isPlaceholder: true,
  },
  {
    id: 'project-003',
    title: 'Mountain View Pavilion',
    subtitle: 'Outdoor Tea Garden Structure',
    projectType: 'outdoor',
    status: 'completed',
    location: 'Asheville, NC',
    year: 2023,
    description: 'An open-air tea pavilion designed to frame views of the Blue Ridge Mountains. The structure honors traditional Chinese garden pavilions while incorporating modern materials for durability in the mountain climate.',
    imageUrl: 'https://images.unsplash.com/photo-1545069122-7236651d5c7e?w=800&h=600&fit=crop',
    features: [
      'Weather-resistant tatami platform',
      'Retractable screens for all-season use',
      'Natural stone pathways and seating',
      'Native plant integration for privacy',
      'Solar-powered water heating system',
    ],
    isPlaceholder: true,
  },
  {
    id: 'project-004',
    title: 'Wander Tea',
    subtitle: 'Mobile Tea Experience',
    projectType: 'popup',
    status: 'completed',
    location: 'Various Locations',
    year: 2024,
    description: 'A portable tea ceremony setup designed for festivals, markets, and corporate events. Every element packs into custom cases while creating an immersive experience wherever it lands.',
    imageUrl: 'https://images.unsplash.com/photo-1597318158529-cf0c4b970db0?w=800&h=600&fit=crop',
    features: [
      'Modular bamboo assembly system',
      'Portable water heating solution',
      'Collapsible display walls',
      'Complete teaware kit for 12 guests',
      'Ambient lighting package',
    ],
    isPlaceholder: true,
  },
  {
    id: 'project-005',
    title: 'Harmony Studio',
    subtitle: 'Private Home Tea Room',
    projectType: 'home',
    status: 'in-progress',
    location: 'Portland, OR',
    year: 2025,
    description: 'A dedicated tea room being built as part of a home renovation. The design integrates traditional Japanese tea room proportions with Pacific Northwest materials and aesthetics.',
    imageUrl: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800&h=600&fit=crop',
    features: [
      'Traditional 4.5 tatami mat layout',
      'Reclaimed cedar ceiling beams',
      'Sunken hearth (ro) for winter tea',
      'Attached preparation area (mizuya)',
      'Garden view alcove (tokonoma)',
    ],
    isPlaceholder: true,
  },
];

// Helper to get projects by type
export const getProjectsByType = (type: ProjectType): DesignProject[] => {
  return DESIGN_PROJECTS.filter(p => p.projectType === type);
};

// Helper to get featured projects
export const getFeaturedProjects = (count: number = 3): DesignProject[] => {
  return DESIGN_PROJECTS.filter(p => p.status === 'completed').slice(0, count);
};
