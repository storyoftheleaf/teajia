# TODO 21: Cache CORS Preflight Responses and Optimize CORS Handling

**Priority:** P2 — MEDIUM
**Impact:** Eliminates redundant OPTIONS round-trips (saves ~50-150ms per preflight)
**Effort:** Low (30 minutes)

## Problem

Every cross-origin API request from the frontend triggers a CORS preflight `OPTIONS` request. The current handler returns a bare `204` with no caching directive:

```typescript
// worker/src/index.ts:1790-1792
if (request.method === 'OPTIONS') {
  return cors(new Response(null, { status: 204 }), origin);
}
```

And the `cors()` helper sets minimal headers:

```typescript
// worker/src/index.ts:101-107
function cors(response: Response, origin: string): Response {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return new Response(response.body, { status: response.status, headers });
}
```

**Missing:** `Access-Control-Max-Age` header. Without it, browsers send a preflight for **every single API call** (or cache it for a browser-default short period, often 5 seconds in Chrome).

Since the frontend is a separate domain (`teajia.co` → `teajia-api.lightcodes.workers.dev`), every `fetch()` with an `Authorization` header triggers preflight. That's:

- `/api/products/public` — no auth, but POST requests from admin still trigger it
- `/api/products` — admin, every call
- `/api/rates` — every admin load
- `/api/invoices` — every admin load
- All event/customer/activity-log endpoints

## Solution

### 1. Add `Access-Control-Max-Age` to preflight responses

```typescript
if (request.method === 'OPTIONS') {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400', // 24 hours
    },
  });
}
```

This tells the browser: "You can cache this preflight result for 24 hours. Don't ask again."

### 2. Add `Vary: Origin` to all responses

```typescript
function cors(response: Response, origin: string): Response {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  headers.set('Vary', 'Origin');
  return new Response(response.body, { status: response.status, headers });
}
```

`Vary: Origin` ensures that if the Worker is accessed from different origins, the browser/CDN doesn't serve a cached CORS response meant for a different origin.

## Impact

| Scenario | Before | After |
|---|---|---|
| First admin page load (5 API calls) | 5 preflight + 5 actual = 10 requests | 5 preflight + 5 actual = 10 requests |
| Second page load (within 24h) | 5 preflight + 5 actual = 10 requests | 0 preflight + 5 actual = 5 requests |
| Navigating admin pages (10 more calls) | 10 preflight + 10 actual = 20 requests | 0 preflight + 10 actual = 10 requests |

**Total savings over a session:** ~50% fewer HTTP requests for authenticated endpoints.

## Notes

- `Access-Control-Max-Age: 86400` is the maximum Chrome will honor (Firefox allows up to 86400 too)
- Public GET requests without custom headers (like `/api/products/public` from the shop) are "simple requests" and don't trigger preflight — this fix primarily helps admin endpoints
- This is a pure performance win with no behavioral change
- Coordinate with TODO 17 (Cache-Control headers) — both reduce unnecessary network traffic
