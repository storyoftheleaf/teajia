export type EventStatus = 'draft' | 'active' | 'closed' | 'archived' | 'completed';
export type EventFormat = 'private_tasting' | 'public_tasting' | 'workshop' | 'pop_up' | 'wholesale_showing' | 'other';
export type GatheringType = 'private' | 'semi-private' | 'open' | 'bespoke';
export type AttendeeStatus = 'requested' | 'confirmed' | 'waitlist' | 'cancelled' | 'denied';
export type AccessTier = 'standard' | 'golden';
export type TeaPreference = 'light_floral' | 'rich_roasted' | 'aged_earthy' | 'surprise_me';
export type ContactMethod = 'whatsapp' | 'email';
export type GuestInviteStatus = 'pending' | 'claimed' | 'expired';
export type SessionEnergy = 'intimate_warm' | 'lively' | 'contemplative' | 'exploratory' | 'meditative';

// ============================================================
// Location
// ============================================================

export interface SavedLocation {
  id: string;
  name: string;
  address: string;
  mapLink?: string;
  guidelines?: string;
  venueGuide?: VenueGuide;
  createdAt: string;
  updatedAt: string;
}

export interface VenueSpace {
  id: string;
  venueId: string;
  name: string;
  capacity: number;
  description?: string;
  photos: string[];
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Venue {
  id: string;
  name: string;
  address: string;
  mapLink?: string;
  areaHint?: string;
  arrivalNotes?: string;
  website?: string;
  instagram?: string;
  photos: string[];
  spaces: VenueSpace[];
  createdAt: string;
  updatedAt: string;
}

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

// ============================================================
// Event
// ============================================================

export interface SessionFlowItem {
  title: string;
  description?: string;
  duration_minutes?: number;
}

export interface BriefingCard {
  text: string;
  imageUrl?: string;
  order: number;
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
  format?: EventFormat;
  gatheringType?: GatheringType;
  sessionFlow?: SessionFlowItem[];
  playlistUrl?: string;
  // V2 fields
  briefingCards?: BriefingCard[];
  venueId?: string;
  activeSpaceIds?: string[];
  areaHint?: string;           // General area shown before approval (e.g., "Da'an District, Taipei")
  moodHints?: string[];        // Pre-session mood hints (optional)
  interestedList?: InterestSignup[];
  createdAt: string;
  updatedAt: string;
  // Computed fields from API
  confirmedCount?: number;
  waitlistCount?: number;
  requestedCount?: number;
  seatsRemaining?: number;
}

export interface EventAvailability {
  totalCapacity: number;
  confirmedCount: number;
  seatsRemaining: number;
  isFull: boolean;
}

// ============================================================
// Attendee
// ============================================================

export interface GuestRequest {
  nameHint: string;           // "my partner", "a friend new to tea"
  approved: boolean | null;   // null = pending decision
}

export interface EventAttendee {
  id: string;
  eventId: string;
  customerId?: string;
  fullName: string;
  phoneNumber: string;
  email?: string;
  contactMethod: ContactMethod;
  // V2: guest requests (replaces plusOne/plusOneName)
  guestRequests?: GuestRequest[];
  // Legacy (kept for backwards compat)
  plusOne?: boolean;
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
  firstVisitBriefed?: boolean;
  cancellationNote?: string;
  denialMessage?: string;
  source?: 'direct' | 'waitlist_notify' | 'public_page' | 'guest_invite';
  createdAt: string;
  // Computed — from customer record
  sessionsAttended?: number;
  lastAttended?: string;
  favoriteTypes?: string[];
}

// ============================================================
// Guest Invites (+guest single-use links)
// ============================================================

export interface GuestInvite {
  id: string;
  eventId: string;
  parentAttendeeId: string;
  inviteToken: string;
  nameHint?: string;
  claimedByName?: string;
  claimedByPhone?: string;
  claimedByEmail?: string;
  claimedAttendeeId?: string;
  status: GuestInviteStatus;
  createdAt: string;
  claimedAt?: string;
}

// ============================================================
// Tea Menu
// ============================================================

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

// ============================================================
// Tasting Notes
// ============================================================

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

// ============================================================
// Post-Session
// ============================================================

export interface EventPostSession {
  id: string;
  eventId: string;
  teaLedger?: any;
  playlistUrl?: string;
  galleryImages?: string[];
  sessionNotes?: string;
  // V2 fields
  hostNotes?: string;
  energy?: SessionEnergy;
  hostChanges?: string;
  createdAt: string;
}

// ============================================================
// Notifications
// ============================================================

export interface EventNotification {
  id: string;
  eventId: string;
  attendeeId?: string;
  type: 'checkin_reminder' | 'waitlist_promotion' | 'spot_claimed' | 'event_update' | 'approval' | 'denial';
  messageTemplate?: string;
  status: 'pending' | 'sent' | 'failed';
  createdAt: string;
  sentAt?: string;
  // Joined
  attendeeName?: string;
}

// ============================================================
// Journey (guest-facing tea history)
// ============================================================

export interface JourneySeal {
  eventId: string;
  title: string;
  date: string;
  flyerUrl?: string;
}

export interface JourneyImpression {
  text: string;
  teaName: string;
  eventTitle: string;
  date: string;
}

export interface JourneyData {
  sessionsAttended: number;
  totalTeas: number;
  teaTypeMap: Record<string, number>;  // { "Sheng": 4, "Oolong": 3 }
  favorites: string[];
  impressions: JourneyImpression[];
  milestones: string[];                // ['初', '七', etc.]
  seals: JourneySeal[];
  memberSince?: string;
}

// ============================================================
// Interest / "Notify Me"
// ============================================================

export interface InterestSignup {
  phone?: string;
  name?: string;
  email?: string;
  createdAt: string;
}

// ============================================================
// Share / Message Helpers
// ============================================================

export interface ShareMessage {
  whatsappText: string;
  emailSubject: string;
  emailBody: string;
  eventUrl: string;
}

export interface ReminderMilestone {
  key: '3d' | '1d' | '2h';
  label: string;
  scheduledAt: string;
  sent: boolean;
  messageTemplate: string;
}

// ============================================================
// Verification (quiet account)
// ============================================================

export interface VerifyRequest {
  contact: string;          // phone or email
  method: ContactMethod;
}

export interface VerifyConfirm {
  contact: string;
  code: string;
}

// ============================================================
// RSVP Response
// ============================================================

export interface RSVPResponse {
  magicToken: string;
  status: AttendeeStatus;
  redirectUrl: string;
}

export interface GuestManagementData {
  event: TeaEvent;
  attendee: EventAttendee;
  teaMenu: TeaMenuItem[];
  guestInvites?: GuestInvite[];
  briefingCards?: BriefingCard[];
}

// ============================================================
// Form Data Types
// ============================================================

export interface RSVPFormData {
  fullName: string;
  phoneNumber?: string;
  email?: string;
  contactMethod: ContactMethod;
  guests?: { nameHint: string }[];
  notes?: string;
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
  format?: EventFormat;
  gatheringType?: GatheringType;
  sessionFlow?: SessionFlowItem[];
  locationId?: string;
  venueId?: string;
  activeSpaceIds?: string[];
  // V2 fields
  briefingCards?: BriefingCard[];
  areaHint?: string;
  moodHints?: string[];
}

export interface ApprovalAction {
  attendeeId: string;
  action: 'approve' | 'deny' | 'waitlist';
  approvedGuests?: number;     // how many of their guest requests to approve
  message?: string;            // optional note to guest
}
