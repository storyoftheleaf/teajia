import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import {
  EventAvailability,
  GuestManagementData,
  GuestInvite,
  BriefingCard,
  TeaEvent,
  EventAttendee,
  TeaMenuItem,
  TastingNote,
} from '../types/events';

// --- Snake-to-camelCase mapping helpers ---

function mapEvent(e: any): TeaEvent {
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
    venueGuide: e.venue_guide
      ? typeof e.venue_guide === 'string'
        ? JSON.parse(e.venue_guide)
        : e.venue_guide
      : undefined,
    totalCapacity: Number(e.total_capacity) || 0,
    claimWindowMinutes: Number(e.claim_window_minutes) || 30,
    timezone: e.timezone || 'Asia/Taipei',
    status: e.status || 'draft',
    sessionFlow: e.session_flow
      ? typeof e.session_flow === 'string'
        ? JSON.parse(e.session_flow)
        : e.session_flow
      : undefined,
    playlistUrl: e.playlist_url || undefined,
    // V2 fields
    briefingCards: e.briefing_cards
      ? (typeof e.briefing_cards === 'string' ? JSON.parse(e.briefing_cards) : e.briefing_cards) as BriefingCard[]
      : undefined,
    areaHint: e.area_hint || undefined,
    moodHints: e.mood_hints
      ? (typeof e.mood_hints === 'string' ? JSON.parse(e.mood_hints) : e.mood_hints)
      : undefined,
    venuePhotos: Array.isArray(e.venue_photos) ? e.venue_photos : undefined,
    createdAt: e.created_at,
    updatedAt: e.updated_at,
    confirmedCount: e.confirmed_count != null ? Number(e.confirmed_count) : undefined,
    waitlistCount: e.waitlist_count != null ? Number(e.waitlist_count) : undefined,
    requestedCount: e.requested_count != null ? Number(e.requested_count) : undefined,
    interestCount: e.interest_count != null ? Number(e.interest_count) : undefined,
    seatsRemaining: e.seats_remaining != null ? Number(e.seats_remaining) : undefined,
  };
}

function mapAttendee(a: any): EventAttendee {
  return {
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
    showInGuestList: a.show_in_guest_list != null ? !!a.show_in_guest_list : undefined,
    // Computed from customer record
    sessionsAttended: a.sessions_attended != null ? Number(a.sessions_attended) : undefined,
    lastAttended: a.last_attended || undefined,
    favoriteTypes: a.favorite_types
      ? (typeof a.favorite_types === 'string' ? JSON.parse(a.favorite_types) : a.favorite_types)
      : undefined,
    createdAt: a.created_at,
  };
}

function mapTeaMenuItem(m: any): TeaMenuItem {
  return {
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
  };
}

// --- Polling hooks ---

/** Polls event seat availability every 30 seconds for the public RSVP page. */
export const useEventAvailability = (slug: string, enabled = true) => {
  return useQuery({
    queryKey: ['event-availability', slug],
    queryFn: async () => {
      const data = await api.events.getAvailability(slug);
      return {
        totalCapacity: Number(data.total_capacity),
        confirmedCount: Number(data.confirmed_count),
        seatsRemaining: Number(data.seats_remaining),
        isFull: !!data.is_full,
      } as EventAvailability;
    },
    enabled: !!slug && enabled,
    refetchInterval: 30_000,
    staleTime: 10_000,
  });
};

/** Polls guest management data every 15 seconds for the attendee portal. */
export const useGuestManagement = (token: string) => {
  return useQuery({
    queryKey: ['guest-management', token],
    queryFn: async () => {
      const data = await api.rsvp.get(token);
      // Map V2 guest invites if present
      const guestInvites: GuestInvite[] | undefined = data.guest_invites && Array.isArray(data.guest_invites)
        ? (data.guest_invites as any[]).map((t: any): GuestInvite => ({
            id: t.id,
            eventId: t.event_id,
            parentAttendeeId: t.parent_attendee_id,
            inviteToken: t.invite_token,
            nameHint: t.name_hint || undefined,
            contact: t.contact || undefined,
            claimedByName: t.claimed_by_name || undefined,
            claimedByPhone: t.claimed_by_phone || undefined,
            claimedByEmail: t.claimed_by_email || undefined,
            claimedAttendeeId: t.claimed_attendee_id || undefined,
            status: t.status || 'pending',
            createdAt: t.created_at,
            claimedAt: t.claimed_at || undefined,
          }))
        : undefined;
      // Map V2 briefing cards if present
      const briefingCards: BriefingCard[] | undefined = data.briefing_cards
        ? (typeof data.briefing_cards === 'string'
            ? JSON.parse(data.briefing_cards)
            : data.briefing_cards) as BriefingCard[]
        : undefined;
      return {
        event: mapEvent(data.event),
        attendee: mapAttendee(data.attendee),
        teaMenu: (data.tea_menu || []).map(mapTeaMenuItem),
        guestInvites,
        briefingCards,
      } as GuestManagementData;
    },
    enabled: !!token,
    refetchInterval: 15_000,
    staleTime: 5_000,
  });
};

// --- Mutation hooks ---

/** Toggle +1 guest. */
export function useUpdatePlusOne(token: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ plusOne, plusOneName }: { plusOne: boolean; plusOneName?: string }) =>
      api.rsvp.update(token, { plus_one: plusOne ? 1 : 0, plus_one_name: plusOneName }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guest-management', token] });
    },
  });
}

/** Cancel RSVP with optional cancellation note. */
export function useCancelRSVP(token: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (note?: string) => api.rsvp.cancel(token, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guest-management', token] });
    },
  });
}

/** Mark that the guest has seen the first-visit briefing cards. */
export function useMarkBriefed(token: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.rsvp.markBriefed(token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guest-management', token] });
    },
  });
}

/** Claim an offered seat (waitlist promotion). */
export function useClaimSeat(token: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.rsvp.claim(token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guest-management', token] });
    },
  });
}

/** Update dietary requirements / guest notes on an RSVP. */
export function useUpdateRSVPNotes(token: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notes: string) =>
      api.rsvp.update(token, { notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guest-management', token] });
    },
  });
}

/** Update plus-one count (legacy single guest toggle). */
export function useUpdateApprovedGuests(token: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ plusOne, plusOneName }: { plusOne: boolean; plusOneName?: string }) =>
      api.rsvp.update(token, { plus_one: plusOne ? 1 : 0, plus_one_name: plusOneName }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guest-management', token] });
    },
  });
}

/** Toggle show_in_guest_list, lets confirmed guests opt in/out of the public name list. */
export function useUpdateGuestListVisibility(token: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (show: boolean) =>
      api.rsvp.update(token, { show_in_guest_list: show }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guest-management', token] });
    },
  });
}

/** Submit tasting notes after session. */
export function useSubmitTastingNotes(token: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notes: Array<{ teaMenuId?: string; rating?: number; impression?: string; isFavorite: boolean }>) =>
      api.rsvp.submitTastingNotes(token, notes.map(n => ({
        tea_menu_id: n.teaMenuId,
        rating: n.rating,
        impression: n.impression,
        is_favorite: n.isFavorite,
      }))),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guest-management', token] });
    },
  });
}

// --- Named polling hooks (explicit interval overrides) ---

/**
 * Poll event availability at a configurable interval.
 * Alias of useEventAvailability with an explicit interval parameter.
 */
export const useAvailabilityPolling = (slug: string, interval = 30_000) => {
  return useQuery({
    queryKey: ['event-availability', slug],
    queryFn: async () => {
      const data = await api.events.getAvailability(slug);
      return {
        totalCapacity: Number(data.total_capacity),
        confirmedCount: Number(data.confirmed_count),
        seatsRemaining: Number(data.seats_remaining),
        isFull: !!data.is_full,
      } as EventAvailability;
    },
    enabled: !!slug,
    refetchInterval: interval,
    staleTime: Math.min(interval / 3, 10_000),
  });
};

/**
 * Poll the attendee's RSVP status at a configurable interval.
 * Useful for detecting approval/denial/waitlist promotion in real time.
 */
export const useRSVPStatusPolling = (token: string, interval = 15_000) => {
  return useQuery({
    queryKey: ['rsvp-status', token],
    queryFn: async () => {
      const data = await api.rsvp.get(token);
      return {
        status: (data.attendee?.status ?? data.status) as string,
        attendee: data.attendee ? mapAttendee(data.attendee) : undefined,
      };
    },
    enabled: !!token,
    refetchInterval: interval,
    staleTime: Math.min(interval / 3, 5_000),
  });
};
