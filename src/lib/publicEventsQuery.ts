import { queryOptions } from '@tanstack/react-query';
import type { TeaEvent } from '../types/events';
import { api } from './api';

export const publicEventsQuery = queryOptions({
  queryKey: ['events-public-list'],
  queryFn: (): Promise<(TeaEvent & { seats_remaining?: number; confirmed_count?: number })[]> =>
    api.events.listPublic(),
  staleTime: 5 * 60_000,
});
