const API_URL = import.meta.env.VITE_API_URL || '';
const REQUEST_TIMEOUT_MS = 30_000;

function getToken(): string | null {
  return localStorage.getItem('teajia_token') || sessionStorage.getItem('teajia_token');
}

export function setToken(token: string) {
  // Always persist to localStorage so sessions survive browser restarts and deploys
  localStorage.setItem('teajia_token', token);
  sessionStorage.removeItem('teajia_token');
}

export function clearToken() {
  localStorage.removeItem('teajia_token');
  sessionStorage.removeItem('teajia_token');
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
    changePassword: async (currentPassword: string, newPassword: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/auth/change-password`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      return handleResponse(res);
    },
    updateProfile: async (data: { name?: string; email?: string }) => {
      const res = await fetchWithTimeout(`${API_URL}/api/auth/profile`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(data),
      });
      return handleResponse(res);
    },
    requestAdmin: async () => {
      const res = await fetchWithTimeout(`${API_URL}/api/auth/request-admin`, {
        method: 'POST',
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    resetPassword: async (token: string, newPassword: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });
      return handleResponse(res);
    },
  },

  users: {
    list: async () => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/users`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    updateRole: async (userId: string, data: { role?: string; admin_request_status?: string }) => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(data),
      });
      return handleResponse(res);
    },
    delete: async (userId: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    createResetToken: async (userId: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/reset-token`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ userId }),
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
    getEvents: async (id: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/products/${id}/events`);
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
    list: async (limit = 50, offset = 0, includeDeleted = false) => {
      const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
      if (includeDeleted) params.set('include_deleted', '1');
      const res = await fetchWithTimeout(`${API_URL}/api/invoices?${params}`, {
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
    updateItems: async (id: string, data: { lineItems?: { product_id: string; quantity: number; price_at_sale: number }[]; shipping_cost_usd?: number; customer_name?: string; notes?: string }) => {
      const res = await fetchWithTimeout(`${API_URL}/api/invoices/${id}/items`, {
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
    getEvents: async (id: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/customers/${id}/events`, {
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
    voidInvoice: async (invoiceId: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/rpc/void-invoice`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ invoice_id: invoiceId }),
      });
      return handleResponse(res);
    },
    splitInvoice: async (invoiceId: string, lineItemIds: string[]) => {
      const res = await fetchWithTimeout(`${API_URL}/api/rpc/split-invoice`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ invoice_id: invoiceId, line_item_ids: lineItemIds }),
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
    resetStockVerification: async () => {
      const res = await fetchWithTimeout(`${API_URL}/api/rpc/reset-stock-verification`, {
        method: 'POST',
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    reserveStock: async (invoiceId: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/rpc/reserve-stock`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ invoice_id: invoiceId }),
      });
      return handleResponse(res);
    },
    releaseStock: async (invoiceId: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/rpc/release-stock`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ invoice_id: invoiceId }),
      });
      return handleResponse(res);
    },
  },

  purchaseOrders: {
    create: async (data: {
      po_number: string;
      vendor_name: string;
      vendor_contact?: string;
      vendor_id?: string;
      items_json: string;
      total_usd: number;
      display_currency: string;
      status: 'draft' | 'sent' | 'confirmed' | 'received';
      message_text?: string;
    }) => {
      const res = await fetchWithTimeout(`${API_URL}/api/purchase-orders`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(data),
      });
      if (!res.ok) return null;
      return res.json();
    },

    list: async () => {
      const res = await fetchWithTimeout(`${API_URL}/api/purchase-orders`, {
        headers: authHeaders(),
      });
      if (!res.ok) return [];
      return res.json();
    },

    updateStatus: async (id: string, status: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/purchase-orders/${id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ status }),
      });
      return handleResponse(res);
    },
  },

  activityLogs: {
    list: async (params?: { limit?: number; offset?: number; action?: string; search?: string; entity_id?: string }) => {
      const qp = new URLSearchParams();
      if (params?.limit) qp.set('limit', String(params.limit));
      if (params?.offset) qp.set('offset', String(params.offset));
      if (params?.action) qp.set('action', params.action);
      if (params?.search) qp.set('search', params.search);
      if (params?.entity_id) qp.set('entity_id', params.entity_id);
      const res = await fetchWithTimeout(`${API_URL}/api/activity-logs?${qp}`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
  },

  stockLedger: {
    list: async (productId?: string, limit = 50, offset = 0) => {
      const qp = new URLSearchParams({ limit: String(limit), offset: String(offset) });
      if (productId) qp.set('product_id', productId);
      const res = await fetchWithTimeout(`${API_URL}/api/stock-ledger?${qp}`, {
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

  extractFromImage: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const token = localStorage.getItem('adminToken');
    const res = await fetchWithTimeout(`${API_URL}/api/extract-from-image`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });
    return handleResponse(res);
  },

  transcribeAudio: async (audioBlob: Blob): Promise<{ text: string }> => {
    const formData = new FormData();
    formData.append('file', audioBlob, 'recording.webm');
    const token = getToken();
    const res = await fetchWithTimeout(`${API_URL}/api/transcribe`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });
    return handleResponse(res);
  },

  uploadImage: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetchWithTimeout(`${API_URL}/api/upload-image`, {
      method: 'POST',
      headers: authHeaders(),
      body: formData,
    });
    const data = await handleResponse(res);
    return data.url;
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
    // V2: Attendee approval actions
    approveAttendee: async (id: string, data?: { approved_guests?: number; message?: string }) => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/attendees/${id}/approve`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(data || {}),
      });
      return handleResponse(res);
    },
    denyAttendee: async (id: string, data?: { message?: string }) => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/attendees/${id}/deny`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(data || {}),
      });
      return handleResponse(res);
    },
    waitlistAttendee: async (id: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/attendees/${id}/waitlist`, {
        method: 'PUT',
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    approveBatch: async (eventId: string, attendeeIds: string[], approvedGuestsMap?: Record<string, number>) => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/events/${eventId}/approve-batch`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ attendee_ids: attendeeIds, approved_guests_map: approvedGuestsMap }),
      });
      return handleResponse(res);
    },
    getShareMessages: async (id: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/events/${id}/share`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    sendEmailInvites: async (id: string, data: Record<string, any>) => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/events/${id}/send-emails`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(data),
      });
      return handleResponse(res);
    },
    getCustomerJourney: async (customerId: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/customers/${customerId}/journey`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    // V2: Interest capture
    registerInterest: async (slug: string, data: { name?: string; phone?: string; email?: string }) => {
      const res = await fetchWithTimeout(`${API_URL}/api/events/${slug}/interest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
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
    // V2: Cancel with optional note
    cancel: async (token: string, note?: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/rsvp/${token}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled', cancellation_note: note }),
      });
      return handleResponse(res);
    },
    // V2: Mark first-visit briefing seen
    markBriefed: async (token: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/rsvp/${token}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ first_visit_briefed: 1 }),
      });
      return handleResponse(res);
    },
  },

  // V2: Guest invite single-use links
  guestInvites: {
    get: async (token: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/guest-invite/${token}`, {
        headers: { 'Content-Type': 'application/json' },
      });
      return handleResponse(res);
    },
    claim: async (token: string, data: { name: string; phone?: string; email?: string }) => {
      const res = await fetchWithTimeout(`${API_URL}/api/guest-invite/${token}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return handleResponse(res);
    },
  },

  // V2: Verification (quiet account — phone or email, no passwords)
  verify: {
    requestCode: async (contact: string, method: 'whatsapp' | 'email') => {
      const res = await fetchWithTimeout(`${API_URL}/api/verify/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact, method }),
      });
      return handleResponse(res);
    },
    confirmCode: async (contact: string, code: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/verify/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact, code }),
      });
      return handleResponse(res);
    },
  },

  // V2: Guest journey (tea history, seals, impressions)
  journey: {
    get: async (phone: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/journey/${encodeURIComponent(phone)}`, {
        headers: { 'Content-Type': 'application/json' },
      });
      return handleResponse(res);
    },
  },

  transcribeAudio: async (audioBlob: Blob): Promise<{ text: string }> => {
    const formData = new FormData();
    formData.append('file', audioBlob, 'recording.webm');
    const res = await fetchWithTimeout(`${API_URL}/api/transcribe`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${getToken()}` },
      body: formData,
    });
    return handleResponse(res);
  },

  compass: {
    list: async (params?: { status?: string; vendor_id?: string }) => {
      const qp = new URLSearchParams();
      if (params?.status) qp.set('status', params.status);
      if (params?.vendor_id) qp.set('vendor_id', params.vendor_id);
      const qs = qp.toString();
      const res = await fetchWithTimeout(`${API_URL}/api/compass/entries${qs ? `?${qs}` : ''}`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    create: async (entry: Record<string, any>) => {
      const res = await fetchWithTimeout(`${API_URL}/api/compass/entries`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(entry),
      });
      return handleResponse(res);
    },
    update: async (id: string, updates: Record<string, any>) => {
      const res = await fetchWithTimeout(`${API_URL}/api/compass/entries/${id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(updates),
      });
      return handleResponse(res);
    },
    remove: async (id: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/compass/entries/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    sync: async (entries: Record<string, any>[]) => {
      const res = await fetchWithTimeout(`${API_URL}/api/compass/sync`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ entries }),
      });
      return handleResponse(res);
    },
  },

  inquiries: {
    create: async (data: {
      ref_number: string;
      customer_name: string;
      customer_contact: string;
      customer_location: string;
      notes?: string;
      items_json: string;
      total_estimate_usd: number;
      source: 'whatsapp' | 'email' | 'copy';
    }) => {
      const res = await fetchWithTimeout(`${API_URL}/api/inquiries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) return null;
      return res.json();
    },

    getByRef: async (ref: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/inquiries/${encodeURIComponent(ref)}`);
      if (!res.ok) return null;
      return res.json();
    },

    list: async () => {
      const res = await fetchWithTimeout(`${API_URL}/api/inquiries`, {
        headers: authHeaders(),
      });
      if (!res.ok) return [];
      return res.json();
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

  // ── Samples ──
  samples: {
    // Public: get a single sample (source info stripped for non-admin)
    get: async (id: string) => {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const token = typeof localStorage !== 'undefined' && localStorage.getItem('teajia-token');
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetchWithTimeout(`${API_URL}/api/samples/${id}`, { headers });
      return handleResponse(res);
    },
    // Public: get all samples in a set
    getSet: async (setId: string) => {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const token = typeof localStorage !== 'undefined' && localStorage.getItem('teajia-token');
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetchWithTimeout(`${API_URL}/api/samples/set/${setId}`, { headers });
      return handleResponse(res);
    },
    // Public/guest: add a tasting to a sample
    addTasting: async (sampleId: string, data: { tasting: Record<string, any>; rating?: number; verdict: string; wouldBuy: boolean; personalNote?: string; tasterName?: string }) => {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const token = typeof localStorage !== 'undefined' && localStorage.getItem('teajia-token');
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetchWithTimeout(`${API_URL}/api/samples/${sampleId}/tastings`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });
      return handleResponse(res);
    },
    // Admin: list all samples
    list: async (params?: { setId?: string; status?: string }) => {
      const qp = new URLSearchParams();
      if (params?.setId) qp.set('setId', params.setId);
      if (params?.status) qp.set('status', params.status);
      const qs = qp.toString();
      const res = await fetchWithTimeout(`${API_URL}/api/admin/samples${qs ? `?${qs}` : ''}`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    create: async (sample: Record<string, any>) => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/samples`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(sample),
      });
      return handleResponse(res);
    },
    update: async (id: string, updates: Record<string, any>) => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/samples/${id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(updates),
      });
      return handleResponse(res);
    },
    remove: async (id: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/samples/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
  },

  sampleSets: {
    list: async () => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/sample-sets`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    create: async (set: Record<string, any>) => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/sample-sets`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(set),
      });
      return handleResponse(res);
    },
    update: async (id: string, updates: Record<string, any>) => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/sample-sets/${id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(updates),
      });
      return handleResponse(res);
    },
    remove: async (id: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/sample-sets/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
  },
};
