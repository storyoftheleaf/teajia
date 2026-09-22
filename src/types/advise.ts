export type AdviseView = 'main' | 'projects' | 'project-detail';

export type AdviseProjectType = 'space' | 'event' | 'journey';

export interface AdviseProject {
  id: string;
  name: string;
  type: AdviseProjectType;
  location: string;
  description: string;
  work: string;
  result: string;
  featured: boolean;
  /** Hero image URL. Falls back to a coloured wash if absent. */
  heroImage?: string;
  /** Gallery image URLs. The gallery section only renders when this has items. */
  gallery?: string[];
}

export interface InquiryFormData {
  name: string;
  email: string;
  location: string;
  whatsapp: string;
  interests: string[];
  vision: string;
  referral: string;
  timestamp?: string;
}

export const INQUIRY_OPTIONS = [
  'A session or practice guidance',
  'Space design or tea integration',
  'An event or group experience',
  'Tea sourcing',
  'A sourcing journey',
  'Something else',
] as const;

export type InquiryOption = typeof INQUIRY_OPTIONS[number];
