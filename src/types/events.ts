export type EventStatus = 'draft' | 'active' | 'closed' | 'archived';
export type AttendeeStatus = 'confirmed' | 'waitlist' | 'cancelled';
export type AccessTier = 'standard' | 'golden';
export type TeaPreference = 'light_floral' | 'rich_roasted' | 'aged_earthy' | 'surprise_me';

export interface VenueGuideStep {
  description: string;
  image_url?: string;
  video_url?: string;
}

export interface VenueGuide {
  steps: VenueGuideStep[];
  parking_notes?: string;
  transit_notes?: string;
  arrival_notes?: string;
}

export interface SessionFlowItem {
  title: string;
  description?: string;
  duration_minutes?: number;
}

export interface TeaEvent {
  id: string;
  slug: string;
  title: string;
  subtitle?: string;
  description?: string;
  flyerImageUrl?: string;
  eventDate: string;
  eventEndDate?: string;
  locationName?: string;
  addressText?: string;
  mapLink?: string;
  guidelinesText?: string;
  venueGuide?: VenueGuide;
  totalCapacity: number;
  claimWindowMinutes: number;
  timezone: string;
  status: EventStatus;
  sessionFlow?: SessionFlowItem[];
  playlistUrl?: string;
  createdAt: string;
  updatedAt: string;
  // Computed fields from API
  confirmedCount?: number;
  waitlistCount?: number;
  seatsRemaining?: number;
}

export interface EventAttendee {
  id: string;
  eventId: string;
  customerId?: string;
  fullName: string;
  phoneNumber: string;
  email?: string;
  plusOne: boolean;
  plusOneName?: string;
  accessTier: AccessTier;
  status: AttendeeStatus;
  magicToken: string;
  photoConsent: boolean;
  notes?: string;
  teaPreference?: TeaPreference;
  bringingTea?: string;
  waitlistPosition?: number;
  claimedAt?: string;
  claimExpiresAt?: string;
  attended?: boolean;
  createdAt: string;
}

export interface TeaMenuItem {
  id: string;
  eventId: string;
  productId?: string;
  customName?: string;
  customDescription?: string;
  revealDate?: string;
  brewOrder?: number;
  // Joined from products table
  productName?: string;
  productType?: string;
  productImageUrl?: string;
}

export interface TastingNote {
  id: string;
  eventId: string;
  attendeeId: string;
  teaMenuId?: string;
  rating?: number;
  impression?: string;
  isFavorite: boolean;
  createdAt: string;
  // Joined fields
  attendeeName?: string;
  teaName?: string;
}

export interface EventPostSession {
  id: string;
  eventId: string;
  teaLedger?: any;
  playlistUrl?: string;
  galleryImages?: string[];
  sessionNotes?: string;
  createdAt: string;
}

export interface EventNotification {
  id: string;
  eventId: string;
  attendeeId?: string;
  type: 'checkin_reminder' | 'waitlist_promotion' | 'spot_claimed' | 'event_update';
  messageTemplate?: string;
  status: 'pending' | 'sent' | 'failed';
  createdAt: string;
  sentAt?: string;
  // Joined
  attendeeName?: string;
}

export interface EventAvailability {
  totalCapacity: number;
  confirmedCount: number;
  seatsRemaining: number;
  isFull: boolean;
}

export interface RSVPResponse {
  magicToken: string;
  status: AttendeeStatus;
  redirectUrl: string;
}

export interface GuestManagementData {
  event: TeaEvent;
  attendee: EventAttendee;
  teaMenu: TeaMenuItem[];
}

// Form data types
export interface RSVPFormData {
  fullName: string;
  phoneNumber: string;
  email?: string;
  plusOne: boolean;
  plusOneName?: string;
  photoConsent: boolean;
  notes?: string;
  teaPreference?: TeaPreference;
  bringingTea?: string;
}

export interface EventFormData {
  slug: string;
  title: string;
  subtitle?: string;
  description?: string;
  flyerImageUrl?: string;
  eventDate: string;
  eventEndDate?: string;
  locationName?: string;
  addressText?: string;
  mapLink?: string;
  guidelinesText?: string;
  venueGuide?: VenueGuide;
  totalCapacity: number;
  claimWindowMinutes?: number;
  timezone?: string;
  status?: EventStatus;
  sessionFlow?: SessionFlowItem[];
  playlistUrl?: string;
}
