# TODO 17: Add Cache-Control Headers to Public API Endpoints

**Priority:** P0 — CRITICAL
**Impact:** Eliminates redundant D1 queries for public data; reduces TTFB by 50-200ms per cached hit
**Effort:** Low (1-2 hours)

## Problem

Every API response from the worker has **zero caching headers**. The `json()` helper only sets `Content-Type`:

```typescript
// worker/src/index.ts:94
function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
```

This means:
1. **No browser caching** — Every navigation re-fetches the same data from D1
2. **No Cloudflare edge caching** — The CDN treats every request as uncacheable
3. **React Query's 5-min staleTime helps**, but only within a single tab session. New tabs, hard refreshes, and mobile app-resume all hit D1 fresh

### Most impactful endpoints (public, hit on every page load)

| Endpoint | Frequency | Data Volatility |
|---|---|---|
| `/api/products/public` | Every visitor, every page load | Changes ~1-2x/week |
| `/api/rates` | Every admin page load | Changes ~1x/day |
| `/api/events/:slug/public` | Every event page view | Changes ~1x/week |
| `/api/events/:slug/availability` | Every event page view | Changes per RSVP |

## Solution

### 1. Create a `cachedJson()` helper alongside the existing `json()`

```typescript
function cachedJson(data: unknown, maxAge: number, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': `public, max-age=${maxAge}, s-maxage=${maxAge}`,
    },
  });
}
```

### 2. Apply to public endpoints

| Endpoint | `max-age` | Rationale |
|---|---|---|
| `/api/products/public` | 60s | Product data changes infrequently; 1 minute is safe |
| `/api/rates` | 3600s | Exchange rates refresh daily at most |
| `/api/events/:slug/public` | 30s | Event details are mostly static |
| `/api/events/:slug/availability` | 10s | Seat counts change per RSVP; short cache |

### 3. Ensure mutating endpoints bust the cache

For admin PUT/POST/DELETE on products, add a `Cache-Control: no-store` header (already the default when no header is set, but explicit is better for clarity).

### 4. Use Cloudflare Cache API for more control (optional enhancement)

```typescript
// In the fetch handler, before routing:
const cache = caches.default;
const cacheKey = new Request(url.toString(), request);

// For public GET endpoints, check cache first
const cached = await cache.match(cacheKey);
if (cached) return cors(cached, origin);

// After generating response, put in cache
const response = await match.handler(request, env, match.params);
const corsResponse = cors(response, origin);
ctx.waitUntil(cache.put(cacheKey, corsResponse.clone()));
return corsResponse;
```

## Notes

- Admin endpoints must NEVER be cached (they contain sensitive cost/vendor data behind auth)
- The CORS wrapper runs after caching — cached responses still get correct CORS headers
- `s-maxage` controls Cloudflare edge cache; `max-age` controls browser cache
- React Query's staleTime (5 min) acts as a second layer — even without HTTP caching, it prevents refetch within a tab
- Coordinate with TODO 16 (indexes) — caching reduces the number of queries, indexes speed up the ones that do hit D1
