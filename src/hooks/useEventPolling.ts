import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import {
  EventAvailability,
  GuestManagementData,
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
    createdAt: e.created_at,
    updatedAt: e.updated_at,
    confirmedCount: e.confirmed_count != null ? Number(e.confirmed_count) : undefined,
    waitlistCount: e.waitlist_count != null ? Number(e.waitlist_count) : undefined,
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
      return {
        event: mapEvent(data.event),
        attendee: mapAttendee(data.attendee),
        teaMenu: (data.tea_menu || []).map(mapTeaMenuItem),
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

/** Cancel RSVP. */
export function useCancelRSVP(token: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.rsvp.update(token, { status: 'cancelled' }),
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
