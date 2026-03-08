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

async function handleResponse(res: Response) {
  let data: any;
  try {
    data = await res.json();
  } catch {
    throw new Error(`Request failed (${res.status})`);
  }
  if (!res.ok) {
    // Avoid leaking raw server errors — provide generic message
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
  },

  activityLogs: {
    list: async () => {
      const res = await fetchWithTimeout(`${API_URL}/api/activity-logs`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
  },

  uploadImage: async (filename: string, filetype: string) => {
    const res = await fetchWithTimeout(`${API_URL}/api/upload-image`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ filename, filetype }),
    });
    return handleResponse(res);
  },
};
