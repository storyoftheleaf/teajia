import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { TeaEvent, EventAttendee, EventNotification, TeaMenuItem, TastingNote, GuestInvite, JourneyData } from '../../types/events';

const STALE_TIME = 1000 * 60 * 5; // 5 minutes

// Fetch all events (admin)
export const useEvents = () => {
  return useQuery({
    queryKey: ['events'],
    staleTime: STALE_TIME,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const data = await api.events.listAdmin();
      return (data || []).map((e: any) => ({
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
        venueGuide: e.venue_guide ? JSON.parse(e.venue_guide) : undefined,
        totalCapacity: Number(e.total_capacity) || 0,
        claimWindowMinutes: Number(e.claim_window_minutes) || 30,
        timezone: e.timezone || 'Asia/Taipei',
        status: e.status || 'draft',
        sessionFlow: e.session_flow ? JSON.parse(e.session_flow) : undefined,
        playlistUrl: e.playlist_url || undefined,
        createdAt: e.created_at,
        updatedAt: e.updated_at,
        confirmedCount: Number(e.confirmed_count) || 0,
        waitlistCount: Number(e.waitlist_count) || 0,
        seatsRemaining: e.seats_remaining != null ? Number(e.seats_remaining) : undefined,
      })) as TeaEvent[];
    },
  });
};

// Fetch a single event by ID (admin)
export const useEvent = (id: string) => {
  return useQuery({
    queryKey: ['events', id],
    staleTime: STALE_TIME,
    refetchOnWindowFocus: false,
    enabled: !!id,
    queryFn: async () => {
      // Fetch from list and filter, or use a dedicated endpoint if available
      const data = await api.events.listAdmin();
      const e = (data || []).find((ev: any) => ev.id === id);
      if (!e) throw new Error('Event not found');
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
        venueGuide: e.venue_guide ? JSON.parse(e.venue_guide) : undefined,
        totalCapacity: Number(e.total_capacity) || 0,
        claimWindowMinutes: Number(e.claim_window_minutes) || 30,
        timezone: e.timezone || 'Asia/Taipei',
        status: e.status || 'draft',
        sessionFlow: e.session_flow ? JSON.parse(e.session_flow) : undefined,
        playlistUrl: e.playlist_url || undefined,
        createdAt: e.created_at,
        updatedAt: e.updated_at,
        confirmedCount: Number(e.confirmed_count) || 0,
        waitlistCount: Number(e.waitlist_count) || 0,
        seatsRemaining: e.seats_remaining != null ? Number(e.seats_remaining) : undefined,
      } as TeaEvent;
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
        guestRequests: a.guest_requests
          ? (typeof a.guest_requests === 'string' ? JSON.parse(a.guest_requests) : a.guest_requests)
          : undefined,
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
        favoriteTypes: a.favorite_types
          ? (typeof a.favorite_types === 'string' ? JSON.parse(a.favorite_types) : a.favorite_types)
          : undefined,
        createdAt: a.created_at,
      })) as EventAttendee[];
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

// V2: Fetch guest invites for an event (admin) — uses the attendees endpoint and
// extracts the embedded guest_invite_tokens list for each attendee.
export const useGuestInvites = (eventId: string) => {
  return useQuery({
    queryKey: ['event-guest-invites', eventId],
    staleTime: STALE_TIME,
    refetchOnWindowFocus: false,
    enabled: !!eventId,
    queryFn: async () => {
      const data = await api.events.getAttendees(eventId);
      const invites: GuestInvite[] = [];
      for (const a of (data || [])) {
        const tokens: any[] = a.guest_invite_tokens
          ? (typeof a.guest_invite_tokens === 'string'
            ? JSON.parse(a.guest_invite_tokens)
            : a.guest_invite_tokens)
          : [];
        for (const t of tokens) {
          invites.push({
            id: t.id,
            eventId: t.event_id || eventId,
            parentAttendeeId: t.parent_attendee_id || a.id,
            inviteToken: t.invite_token,
            nameHint: t.name_hint || undefined,
            claimedByName: t.claimed_by_name || undefined,
            claimedByPhone: t.claimed_by_phone || undefined,
            claimedByEmail: t.claimed_by_email || undefined,
            claimedAttendeeId: t.claimed_attendee_id || undefined,
            status: t.status || 'pending',
            createdAt: t.created_at,
            claimedAt: t.claimed_at || undefined,
          });
        }
      }
      return invites;
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
        teaTypeMap: data.tea_type_map
          ? (typeof data.tea_type_map === 'string' ? JSON.parse(data.tea_type_map) : data.tea_type_map)
          : {},
        favorites: data.favorites
          ? (typeof data.favorites === 'string' ? JSON.parse(data.favorites) : data.favorites)
          : [],
        impressions: data.impressions
          ? (typeof data.impressions === 'string' ? JSON.parse(data.impressions) : data.impressions)
          : [],
        milestones: data.milestones
          ? (typeof data.milestones === 'string' ? JSON.parse(data.milestones) : data.milestones)
          : [],
        seals: data.seals
          ? (typeof data.seals === 'string' ? JSON.parse(data.seals) : data.seals)
          : [],
        memberSince: data.member_since || undefined,
      } as JourneyData;
    },
  });
};
