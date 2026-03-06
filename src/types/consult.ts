export type ConsultView = 'main' | 'projects' | 'project-detail';

export type ConsultProjectType = 'space' | 'event' | 'journey';

export interface ConsultProject {
  id: string;
  name: string;
  type: ConsultProjectType;
  location: string;
  description: string;
  work: string;
  result: string;
  featured: boolean;
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
