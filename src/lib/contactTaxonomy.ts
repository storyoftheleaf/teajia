import type { Bundle } from '../types';

export type ContactRelationshipKind =
  | 'buyer'
  | 'vendor'
  | 'event_guest'
  | 'collection_recipient'
  | 'contributor'
  | 'personal_connection';

export interface ContactRelationshipDefinition {
  kind: ContactRelationshipKind;
  label: string;
  primaryBundle: Bundle | 'personal';
  description: string;
  examples: string[];
}

export const CONTACT_RELATIONSHIP_TAXONOMY: Record<ContactRelationshipKind, ContactRelationshipDefinition> = {
  buyer: {
    kind: 'buyer',
    label: 'Buyer',
    primaryBundle: 'sell',
    description: 'A person or organization connected to orders, invoices, pricing, WhatsApp checkout, and revenue history.',
    examples: ['retail customer', 'wholesale buyer', 'repeat tea client'],
  },
  vendor: {
    kind: 'vendor',
    label: 'Vendor / Source',
    primaryBundle: 'catalog',
    description: 'A sourcing relationship connected to tea identity, procurement context, origin notes, or supplier reliability.',
    examples: ['tea farmer', 'producer', 'supplier', 'ceramicist'],
  },
  event_guest: {
    kind: 'event_guest',
    label: 'Event Guest',
    primaryBundle: 'gather',
    description: 'A person connected to hosted gatherings, attendance, RSVP state, guest history, and post-session memory.',
    examples: ['RSVP guest', 'attendee', 'waitlisted guest'],
  },
  collection_recipient: {
    kind: 'collection_recipient',
    label: 'Collection Recipient',
    primaryBundle: 'publish',
    description: 'A recipient or audience member for curated collections, shares, and editorially assembled tea lists.',
    examples: ['private collection recipient', 'shop collection audience', 'shared tasting list recipient'],
  },
  contributor: {
    kind: 'contributor',
    label: 'Contributor',
    primaryBundle: 'publish',
    description: 'A person whose authorship, expertise, photography, or tea practice appears in public editorial context.',
    examples: ['writer', 'photographer', 'tea master', 'interview subject'],
  },
  personal_connection: {
    kind: 'personal_connection',
    label: 'Personal Connection',
    primaryBundle: 'personal',
    description: 'A relationship note or memory that belongs to a person/account context rather than an operational department.',
    examples: ['friend of the practice', 'private note', 'shared tasting memory'],
  },
};

export const CONTACT_RELATIONSHIP_ORDER: ContactRelationshipKind[] = [
  'buyer',
  'vendor',
  'event_guest',
  'collection_recipient',
  'contributor',
  'personal_connection',
];
