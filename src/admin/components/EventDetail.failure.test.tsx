import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { EventDetail } from './EventDetail';
import { useEvent } from '../hooks/useEventData';

vi.mock('../hooks/useEventData', () => ({
  useEvent: vi.fn(),
  useAttendees: () => ({ data: [], refetch: vi.fn() }),
  useTastingNotes: () => ({ data: [] }),
}));
vi.mock('./Toast', () => ({ useToast: () => ({ showToast: vi.fn() }) }));

function renderDetail() {
  return renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={['/admin/events/event-a']}>
        <Routes><Route path="/admin/events/:id" element={<EventDetail />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => vi.clearAllMocks());

describe('event detail load states', () => {
  it('shows a retryable failure after the initial request rejects', () => {
    vi.mocked(useEvent).mockReturnValue({
      data: undefined, isLoading: false, isPending: false, isError: true, isFetching: false, refetch: vi.fn(),
    } as any);
    const html = renderDetail();
    expect(html).toContain('role="alert"');
    expect(html).toContain('Event could not be loaded');
    expect(html).toContain('Try again');
    expect(html).toContain('Back to events');
    expect(html).not.toContain('animate-spin');
  });

  it('reserves the spinner for a request that is still loading', () => {
    vi.mocked(useEvent).mockReturnValue({
      data: undefined, isLoading: true, isPending: true, isError: false, isFetching: true, refetch: vi.fn(),
    } as any);
    const html = renderDetail();
    expect(html).toContain('animate-spin');
    expect(html).not.toContain('Event could not be loaded');
  });
});
