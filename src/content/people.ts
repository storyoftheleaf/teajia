import { Person } from '../types';

export const PEOPLE: Record<string, Person> = {
  chen: {
    id: 'chen',
    name: 'Chen Wei',
    role: 'Senior Editor',
    bio: 'A native of Hangzhou, Chen has spent the last decade documenting the disappearing oral histories of tea farmers along the Yangtze river.',
    avatarUrl: 'https://picsum.photos/200/200?random=101'
  },
  lin: {
    id: 'lin',
    name: 'Master Lin',
    role: 'Ceramicist',
    bio: 'Born into a family of Yixing potters dating back to the Qing dynasty, Master Lin advocates for the return to raw, unpurified clay in modern teaware.',
    avatarUrl: 'https://picsum.photos/200/200?random=102'
  },
  sarah: {
    id: 'sarah',
    name: 'Sarah Jenkins',
    role: 'Cultural Anthropologist',
    bio: 'Sarah studies the intersection of ritual and community space. Her work explores how tea houses function as "third places" in modern urban China.',
    avatarUrl: 'https://picsum.photos/200/200?random=103'
  },
  zhou: {
    id: 'zhou',
    name: 'Zhou Yu',
    role: 'Tea Master',
    bio: 'Guardian of the Wuyi heritage strains, Master Zhou still processes his oolongs entirely by hand using traditional charcoal roasting techniques.',
    avatarUrl: 'https://picsum.photos/200/200?random=104'
  },
  li: {
    id: 'li',
    name: 'Li Jun',
    role: 'Filmmaker',
    bio: 'An award-winning cinematographer known for his slow-cinema approach to nature documentaries.',
    avatarUrl: 'https://picsum.photos/200/200?random=105'
  },
  barry: {
    id: 'barry',
    name: 'Barry',
    role: 'Tea Teacher',
    bio: 'Twenty-eight years of practice rooted in the Bali East Circuit, where Barry has built a quiet reputation as one of the region\'s most grounded tea teachers. His approach is steeped in traditional gongfu methodology, passed down through direct lineage and refined through years of sourcing and session work across Southeast Asia. Known within the local Bali tea community for bridging cultural depth with accessibility — making serious tea practice feel human.',
    avatarUrl: undefined,
  }
};

export const PEOPLE_DIRECTORY = Object.values(PEOPLE).map(person => ({
  ...person,
  authoredArticles: [] as string[],
  offerings: [] as string[],
  externalLink: undefined as string | undefined,
}));
