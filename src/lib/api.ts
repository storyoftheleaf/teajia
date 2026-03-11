const API_URL = import.meta.env.VITE_API_URL || '';
const REQUEST_TIMEOUT_MS = 30_000;

function getToken(): string | null {
  return localStorage.getItem('teajia_token');
}

export function setToken(token: string) {
  localStorage.setItem('teajia_token', token);
}

export function clearToken() {
  localStorage.removeItem('teajia_token');
}

export function hasToken(): boolean {
  return !!getToken();
}

export const isConfigured = !!API_URL;

/** Check whether the stored JWT is expired (with 60s buffer). */
export function isTokenExpired(): boolean {
  const claims = getTokenClaims();
  if (!claims?.exp) return false; // No expiry claim — let server decide
  return Date.now() >= claims.exp * 1000 - 60_000;
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  if (token && isTokenExpired()) {
    clearToken();
  }
  const currentToken = getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (currentToken) headers['Authorization'] = `Bearer ${currentToken}`;
  return headers;
}

/** Fetch with an AbortController timeout. */
async function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error('Request timed out. Please try again.');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

/** Custom event name dispatched when a 401 response indicates session expiry. */
export const SESSION_EXPIRED_EVENT = 'teajia:session-expired';

async function handleResponse(res: Response) {
  let data: any;
  try {
    data = await res.json();
  } catch {
    throw new Error(`Request failed (${res.status})`);
  }
  if (!res.ok) {
    // Detect expired/invalid session
    if (res.status === 401 && hasToken()) {
      clearToken();
      window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
    }
    const message = typeof data?.error === 'string' && data.error.length < 200
      ? data.error
      : `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data;
}

export function getTokenClaims(): { sub: string; email: string; role: string; name: string; exp?: number } | null {
  const token = getToken();
  if (!token) return null;
  try {
    const [, payload] = token.split('.');
    if (!payload) return null;
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

export const api = {
  auth: {
    login: async (email: string, password: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      return handleResponse(res);
    },
    signup: async (email: string, password: string, name: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      });
      return handleResponse(res);
    },
    me: async () => {
      const res = await fetchWithTimeout(`${API_URL}/api/auth/me`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
  },

  products: {
    list: async () => {
      const res = await fetchWithTimeout(`${API_URL}/api/products`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    listPublic: async () => {
      const res = await fetchWithTimeout(`${API_URL}/api/products/public`);
      return handleResponse(res);
    },
    create: async (data: Record<string, any>) => {
      const res = await fetchWithTimeout(`${API_URL}/api/products`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(data),
      });
      return handleResponse(res);
    },
    bulkCreate: async (products: Record<string, any>[]) => {
      const res = await fetchWithTimeout(`${API_URL}/api/products/bulk`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ products }),
      });
      return handleResponse(res);
    },
    update: async (id: string, data: Record<string, any>) => {
      const res = await fetchWithTimeout(`${API_URL}/api/products/${id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(data),
      });
      return handleResponse(res);
    },
    delete: async (id: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/products/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
  },

  rates: {
    list: async () => {
      const res = await fetchWithTimeout(`${API_URL}/api/rates`);
      return handleResponse(res);
    },
  },

  invoices: {
    list: async (limit = 50) => {
      const res = await fetchWithTimeout(`${API_URL}/api/invoices?limit=${limit}`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    create: async (invoice: Record<string, any>, lineItems: Record<string, any>[]) => {
      const res = await fetchWithTimeout(`${API_URL}/api/invoices`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ invoice, lineItems }),
      });
      return handleResponse(res);
    },
    getItems: async (id: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/invoices/${id}/items`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    update: async (id: string, data: Record<string, any>) => {
      const res = await fetchWithTimeout(`${API_URL}/api/invoices/${id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(data),
      });
      return handleResponse(res);
    },
    delete: async (id: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/invoices/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
  },

  customers: {
    list: async () => {
      const res = await fetchWithTimeout(`${API_URL}/api/customers`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    get: async (id: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/customers/${id}`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    create: async (data: Record<string, any>) => {
      const res = await fetchWithTimeout(`${API_URL}/api/customers`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(data),
      });
      return handleResponse(res);
    },
    update: async (id: string, data: Record<string, any>) => {
      const res = await fetchWithTimeout(`${API_URL}/api/customers/${id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(data),
      });
      return handleResponse(res);
    },
    delete: async (id: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/customers/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    getOrders: async (id: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/customers/${id}/orders`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    getTeas: async (id: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/customers/${id}/teas`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    getSuppliedProducts: async (id: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/customers/${id}/products`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    linkProduct: async (vendorId: string, productId: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/customers/${vendorId}/products`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ product_id: productId }),
      });
      return handleResponse(res);
    },
    unlinkProduct: async (vendorId: string, productId: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/customers/${vendorId}/products/${productId}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
  },

  rpc: {
    fulfillInvoice: async (invoiceId: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/rpc/fulfill-invoice`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ invoice_id: invoiceId }),
      });
      return handleResponse(res);
    },
    incrementStock: async (productId: string, amount: number) => {
      const res = await fetchWithTimeout(`${API_URL}/api/rpc/increment-stock`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ product_id: productId, amount }),
      });
      return handleResponse(res);
    },
    truncateAll: async () => {
      if (!window.confirm('DANGER: This will permanently delete ALL data. This action cannot be undone. Are you sure?')) {
        throw new Error('Operation cancelled by user');
      }
      const res = await fetchWithTimeout(`${API_URL}/api/rpc/truncate-all`, {
        method: 'POST',
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    backfillCustomerLinks: async () => {
      const res = await fetchWithTimeout(`${API_URL}/api/rpc/backfill-customer-links`, {
        method: 'POST',
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    autoLinkVendors: async () => {
      const res = await fetchWithTimeout(`${API_URL}/api/rpc/auto-link-vendors`, {
        method: 'POST',
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
  },

  activityLogs: {
    list: async () => {
      const res = await fetchWithTimeout(`${API_URL}/api/activity-logs`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
  },

  generateWisdom: async (prompt: string) => {
    const res = await fetchWithTimeout(`${API_URL}/api/generate-wisdom`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ prompt }),
    });
    return handleResponse(res);
  },

  uploadImage: async (filename: string, filetype: string) => {
    const res = await fetchWithTimeout(`${API_URL}/api/upload-image`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ filename, filetype }),
    });
    return handleResponse(res);
  },

  events: {
    // Admin endpoints
    listAdmin: async () => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/events`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    create: async (data: Record<string, any>) => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/events`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(data),
      });
      return handleResponse(res);
    },
    update: async (id: string, data: Record<string, any>) => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/events/${id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(data),
      });
      return handleResponse(res);
    },
    delete: async (id: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/events/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    getAttendees: async (id: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/events/${id}/attendees`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    updateAttendee: async (id: string, data: Record<string, any>) => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/attendees/${id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(data),
      });
      return handleResponse(res);
    },
    getNotifications: async (id: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/events/${id}/notifications`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    createNotifications: async (id: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/events/${id}/notifications`, {
        method: 'POST',
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    upsertPostSession: async (id: string, data: Record<string, any>) => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/events/${id}/post-session`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(data),
      });
      return handleResponse(res);
    },
    duplicate: async (id: string, newSlug: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/events/${id}/duplicate`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ slug: newSlug }),
      });
      return handleResponse(res);
    },
    batchAttendance: async (id: string, attendeeIds: string[], attended: boolean) => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/events/${id}/attendance`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ attendee_ids: attendeeIds, attended }),
      });
      return handleResponse(res);
    },
    getTeaMenu: async (id: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/events/${id}/tea-menu`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    upsertTeaMenu: async (id: string, items: Record<string, any>[]) => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/events/${id}/tea-menu`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ items }),
      });
      return handleResponse(res);
    },
    deleteTeaMenuItem: async (id: string, itemId: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/events/${id}/tea-menu/${itemId}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    getTastingNotes: async (id: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/events/${id}/tasting-notes`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    // Public endpoints
    getPublic: async (slug: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/events/${slug}/public`);
      return handleResponse(res);
    },
    getAvailability: async (slug: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/events/${slug}/availability`);
      return handleResponse(res);
    },
    uploadFlyer: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const token = localStorage.getItem('teajia_token');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetchWithTimeout(`${API_URL}/api/upload-flyer`, {
        method: 'POST',
        headers,
        body: formData,
      });
      return handleResponse(res);
    },
  },

  savedLocations: {
    list: async () => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/locations`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    create: async (data: Record<string, any>) => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/locations`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(data),
      });
      return handleResponse(res);
    },
    update: async (id: string, data: Record<string, any>) => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/locations/${id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(data),
      });
      return handleResponse(res);
    },
    delete: async (id: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/locations/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
  },

  newsletter: {
    subscribe: async (email: string, source = 'website') => {
      const res = await fetchWithTimeout(`${API_URL}/api/newsletter/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source }),
      });
      return handleResponse(res);
    },
    subscribers: async () => {
      const res = await fetchWithTimeout(`${API_URL}/api/newsletter/subscribers`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
  },

  rsvp: {
    submit: async (slug: string, data: Record<string, any>) => {
      const res = await fetchWithTimeout(`${API_URL}/api/events/${slug}/rsvp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return handleResponse(res);
    },
    get: async (token: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/rsvp/${token}`, {
        headers: { 'Content-Type': 'application/json' },
      });
      return handleResponse(res);
    },
    update: async (token: string, data: Record<string, any>) => {
      const res = await fetchWithTimeout(`${API_URL}/api/rsvp/${token}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return handleResponse(res);
    },
    claim: async (token: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/rsvp/${token}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      return handleResponse(res);
    },
    getPostSession: async (token: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/rsvp/${token}/post-session`, {
        headers: { 'Content-Type': 'application/json' },
      });
      return handleResponse(res);
    },
    submitTastingNotes: async (token: string, notes: Record<string, any>[]) => {
      const res = await fetchWithTimeout(`${API_URL}/api/rsvp/${token}/tasting-notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      });
      return handleResponse(res);
    },
    findByPhone: async (slug: string, phoneNumber: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/events/${slug}/find-rsvp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: phoneNumber }),
      });
      return handleResponse(res);
    },
  },

  favorites: {
    get: async (): Promise<{ favorites: string[] }> => {
      const res = await fetchWithTimeout(`${API_URL}/api/user/favorites`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    put: async (favorites: string[]): Promise<{ ok: boolean }> => {
      const res = await fetchWithTimeout(`${API_URL}/api/user/favorites`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ favorites }),
      });
      return handleResponse(res);
    },
  },
};
