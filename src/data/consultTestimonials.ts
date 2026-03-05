export interface ConsultTestimonial {
  id: string;
  quote: string;
  name: string;
  title: string;
  projectId?: string;
}

export const consultTestimonials: ConsultTestimonial[] = [
  {
    id: 't1',
    quote: 'The tea house became the heart of our resort. Guests return specifically for the experience.',
    name: 'Resort Director',
    title: 'Intaaya Resort, Bali',
    projectId: 'intaaya-resort',
  },
  {
    id: 't2',
    quote: 'He doesn\'t just design a room — he creates a feeling. Every detail has intention behind it.',
    name: 'Private Client',
    title: 'Tea Room, Singapore',
    projectId: 'private-tea-room',
  },
  {
    id: 't3',
    quote: 'The sourcing journey changed how I understand tea. You can\'t get this from a book.',
    name: 'Collector',
    title: 'Taiwan Journey',
    projectId: 'taiwan-journey',
  },
  {
    id: 't4',
    quote: 'After one session, my entire approach to tea shifted. Simple, grounded, present.',
    name: 'Practitioner',
    title: 'Bali Studio Session',
  },
];
