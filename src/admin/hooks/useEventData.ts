import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { TeaEvent, EventAttendee, EventNotification, TeaMenuItem, TastingNote, GuestInvite, JourneyData, Venue } from '../../types/events';

export interface PendingAttendee extends EventAttendee {
  eventTitle: string;
  eventDate: string;
}

const STALE_TIME = 1000 * 60 * 5; // 5 minutes

/**
 * Parse a value that may be a JSON string, an already-parsed object, or null.
 * A malformed DB column must not throw inside a queryFn, that fails the whole
 * query and blanks the page. Falls back instead.
 */
function safeParse<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value !== 'string') return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

const eventsListQueryFn = async () => {
  const data = await api.events.listAdmin();
  return (data || []).map(mapEvent) as TeaEvent[];
};

export const eventsListQueryOptions = {
  queryKey: ['events'] as const,
  staleTime: STALE_TIME,
  queryFn: eventsListQueryFn,
};

// Fetch all events (admin)
export const useEvents = () => {
  return useQuery({
    ...eventsListQueryOptions,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  });
};

// Helper to map raw event row to TeaEvent
export function mapEvent(e: any): TeaEvent {
  return {
    id: e.id,
    slug: e.slug,
    title: e.title,
    subtitle: e.subtitle || undefined,
    description: e.description || undefined,
    flyerImageUrl: e.flyer_image_url || undefined,
    eventDate: e.event_date,
    eventEndDate: e.event_end_date || undefined,
    locationName: e.location_name || undefined,
    addressText: e.address_text || undefined,
    mapLink: e.map_link || undefined,
    guidelinesText: e.guidelines_text || undefined,
    venueGuide: e.venue_guide ? safeParse(e.venue_guide, undefined) : undefined,
    totalCapacity: Number(e.total_capacity) || 0,
    claimWindowMinutes: Number(e.claim_window_minutes) || 30,
    timezone: e.timezone || 'Asia/Taipei',
    status: e.status || 'draft',
    format: e.event_format || undefined,
    gatheringType: e.gathering_type || undefined,
    sessionFlow: e.session_flow ? safeParse(e.session_flow, undefined) : undefined,
    playlistUrl: e.playlist_url || undefined,
    briefingCards: e.briefing_cards ? safeParse(e.briefing_cards, undefined) : undefined,
    areaHint: e.area_hint || undefined,
    moodHints: e.mood_hints ? safeParse(e.mood_hints, undefined) : undefined,
    venueId: e.venue_id || undefined,
    activeSpaceIds: e.active_space_ids ? safeParse(e.active_space_ids, []) : [],
    requiresApproval: e.requires_approval == null ? true : Boolean(e.requires_approval),
    lifecycleStatus: e.lifecycle_status || undefined,
    publicVisibility: e.public_visibility || undefined,
    networkDiscovery: e.network_discovery == null ? undefined : Boolean(e.network_discovery),
    recapStatus: e.recap_status || undefined,
    createdAt: e.created_at,
    updatedAt: e.updated_at,
    confirmedCount: Number(e.confirmed_count) || 0,
    waitlistCount: Number(e.waitlist_count) || 0,
    requestedCount: Number(e.requested_count) || 0,
    interestCount: Number(e.interest_count) || 0,
    seatsRemaining: e.seats_remaining != null ? Number(e.seats_remaining) : undefined,
  };
}

// Fetch a single event by ID (admin): dedicated endpoint, no full list fetch
export const useEvent = (id: string) => {
  return useQuery({
    queryKey: ['events', id],
    staleTime: STALE_TIME,
    refetchOnWindowFocus: false,
    enabled: !!id,
    queryFn: async () => {
      const e = await api.events.getAdmin(id);
      if (!e) throw new Error('Event not found');
      return mapEvent(e);
    },
  });
};

// Fetch attendees for an event (admin)
export const useAttendees = (eventId: string) => {
  return useQuery({
    queryKey: ['event-attendees', eventId],
    staleTime: STALE_TIME,
    refetchOnWindowFocus: false,
    enabled: !!eventId,
    queryFn: async () => {
      const data = await api.events.getAttendees(eventId);
      return (data || []).map((a: any) => ({
        id: a.id,
        eventId: a.event_id,
        customerId: a.customer_id || undefined,
        fullName: a.full_name,
        phoneNumber: a.phone_number,
        email: a.email || undefined,
        contactMethod: a.contact_method || 'whatsapp',
        // V2: guest requests (parse JSON; fall back to legacy plus_one)
        guestRequests: a.guest_requests ? safeParse(a.guest_requests, undefined) : undefined,
        // Legacy (kept for backwards compat)
        plusOne: !!a.plus_one,
        plusOneName: a.plus_one_name || undefined,
        accessTier: a.access_tier || 'standard',
        status: a.status || 'confirmed',
        magicToken: a.magic_token,
        photoConsent: !!a.photo_consent,
        notes: a.notes || undefined,
        teaPreference: a.tea_preference || undefined,
        bringingTea: a.bringing_tea || undefined,
        waitlistPosition: a.waitlist_position != null ? Number(a.waitlist_position) : undefined,
        claimedAt: a.claimed_at || undefined,
        claimExpiresAt: a.claim_expires_at || undefined,
        attended: a.attended != null ? !!a.attended : undefined,
        // V2 fields
        firstVisitBriefed: a.first_visit_briefed != null ? !!a.first_visit_briefed : undefined,
        cancellationNote: a.cancellation_note || undefined,
        denialMessage: a.denial_message || undefined,
        source: a.source || undefined,
        // Computed from customer record
        sessionsAttended: a.sessions_attended != null ? Number(a.sessions_attended) : undefined,
        lastAttended: a.last_attended || undefined,
        favoriteTypes: a.favorite_types ? safeParse(a.favorite_types, undefined) : undefined,
        createdAt: a.created_at,
      })) as EventAttendee[];
    },
  });
};

// Fetch all pending RSVPs across every event (admin activity view)
export const usePendingAttendees = () => {
  return useQuery({
    queryKey: ['pending-attendees'],
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const data = await api.events.getPendingAttendees();
      return (data || []).map((a: any) => ({
        id: a.id,
        eventId: a.event_id,
        customerId: a.customer_id || undefined,
        fullName: a.full_name,
        phoneNumber: a.phone_number,
        email: a.email || undefined,
        contactMethod: a.contact_method || 'whatsapp',
        guestRequests: a.guest_requests ? safeParse(a.guest_requests, undefined) : undefined,
        plusOne: !!a.plus_one,
        plusOneName: a.plus_one_name || undefined,
        accessTier: a.access_tier || 'standard',
        status: a.status || 'requested',
        magicToken: a.magic_token || '',
        photoConsent: !!a.photo_consent,
        notes: a.notes || undefined,
        teaPreference: a.tea_preference || undefined,
        sessionsAttended: a.sessions_attended != null ? Number(a.sessions_attended) : undefined,
        lastAttended: a.last_attended || undefined,
        favoriteTypes: a.favorite_types ? safeParse(a.favorite_types, undefined) : undefined,
        createdAt: a.created_at,
        eventTitle: a.event_title,
        eventDate: a.event_date,
      })) as PendingAttendee[];
    },
  });
};

// Fetch notifications for an event (admin)
export const useEventNotifications = (eventId: string) => {
  return useQuery({
    queryKey: ['event-notifications', eventId],
    staleTime: STALE_TIME,
    refetchOnWindowFocus: false,
    enabled: !!eventId,
    queryFn: async () => {
      const data = await api.events.getNotifications(eventId);
      return (data || []).map((n: any) => ({
        id: n.id,
        eventId: n.event_id,
        attendeeId: n.attendee_id || undefined,
        type: n.type,
        messageTemplate: n.message_template || undefined,
        status: n.status || 'pending',
        createdAt: n.created_at,
        sentAt: n.sent_at || undefined,
        attendeeName: n.attendee_name || undefined,
      })) as EventNotification[];
    },
  });
};

// Fetch tea menu for an event (admin)
export const useTeaMenu = (eventId: string) => {
  return useQuery({
    queryKey: ['event-tea-menu', eventId],
    staleTime: STALE_TIME,
    refetchOnWindowFocus: false,
    enabled: !!eventId,
    queryFn: async () => {
      const data = await api.events.getTeaMenu(eventId);
      return (data || []).map((m: any) => ({
        id: m.id,
        eventId: m.event_id,
        productId: m.product_id || undefined,
        customName: m.custom_name || undefined,
        customDescription: m.custom_description || undefined,
        revealDate: m.reveal_date || undefined,
        brewOrder: m.brew_order != null ? Number(m.brew_order) : undefined,
        teaType: m.tea_type || undefined,
        originRegion: m.origin_region || undefined,
        productName: m.product_name || undefined,
        productType: m.product_type || undefined,
        productImageUrl: m.product_image_url || undefined,
      })) as TeaMenuItem[];
    },
  });
};

// Fetch tasting notes for an event (admin)
export const useTastingNotes = (eventId: string) => {
  return useQuery({
    queryKey: ['event-tasting-notes', eventId],
    staleTime: STALE_TIME,
    refetchOnWindowFocus: false,
    enabled: !!eventId,
    queryFn: async () => {
      const data = await api.events.getTastingNotes(eventId);
      return (data || []).map((t: any) => ({
        id: t.id,
        eventId: t.event_id,
        attendeeId: t.attendee_id,
        teaMenuId: t.tea_menu_id || undefined,
        rating: t.rating != null ? Number(t.rating) : undefined,
        impression: t.impression || undefined,
        isFavorite: !!t.is_favorite,
        createdAt: t.created_at,
        attendeeName: t.attendee_name || undefined,
        teaName: t.tea_name || undefined,
      })) as TastingNote[];
    },
  });
};

// V2: Fetch guest invites for an event (admin).
// TODO: A dedicated admin endpoint (e.g. GET /api/events/:id/guest-invites) is needed.
// The attendees endpoint does NOT return guest_invite_tokens, so this hook returns
// an empty array until that endpoint is available.
export const useGuestInvites = (eventId: string) => {
  return useQuery({
    queryKey: ['event-guest-invites', eventId],
    staleTime: STALE_TIME,
    refetchOnWindowFocus: false,
    enabled: !!eventId,
    queryFn: async (): Promise<GuestInvite[]> => {
      // Backend does not yet expose guest invites on the attendees endpoint.
      // Return empty array to avoid crashes until a dedicated endpoint is added.
      return [];
    },
  });
};

// Fetch all venues (admin). Single shared cache: EventForm, EventDetail and
// VenueManager should all consume this rather than calling api.venues.list()
// independently. Invalidate ['venues'] after a mutation to refresh.
export const useVenues = () => {
  return useQuery({
    queryKey: ['venues'],
    staleTime: STALE_TIME,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<Venue[]> => {
      const data = await api.venues.list();
      return (data || []) as Venue[];
    },
  });
};

// V2: Fetch admin view of a customer's journey summary
export const useCustomerJourney = (customerId: string) => {
  return useQuery({
    queryKey: ['customer-journey', customerId],
    staleTime: STALE_TIME,
    refetchOnWindowFocus: false,
    enabled: !!customerId,
    queryFn: async () => {
      const data = await api.events.getCustomerJourney(customerId);
      return {
        sessionsAttended: Number(data.sessions_attended) || 0,
        totalTeas: Number(data.total_teas) || 0,
        teaTypeMap: safeParse(data.tea_type_map, {}),
        favorites: safeParse(data.favorites, []),
        impressions: safeParse(data.impressions, []),
        milestones: safeParse(data.milestones, []),
        seals: safeParse(data.seals, []),
        memberSince: data.member_since || undefined,
      } as JourneyData;
    },
  });
};
