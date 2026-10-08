import { expect, type Page } from '@playwright/test';

const enc = (s: string) => Buffer.from(s).toString('base64url');
const memberships = [{ account_id: 'acct-bali', account_name: 'Teajia Bali', role: 'owner', slug: 'teajia-bali' }];
const unhandledByPage = new WeakMap<Page, string[]>();
const requestCounts = new WeakMap<Page, Map<string, number>>();
const createdCustomersByPage = new WeakMap<Page, Array<Record<string, any>>>();
const updatedCustomersByPage = new WeakMap<Page, Array<{ id: string; body: Record<string, any> }>>();
type RequestMatch = string | RegExp;
const failuresByPage = new WeakMap<Page, Array<{ match: RequestMatch; left: number }>>();
const delaysByPage = new WeakMap<Page, Array<{ match: RequestMatch; ms: number }>>();
type HarnessProduct = Record<string, any>;
const productsByPage = new WeakMap<Page, HarnessProduct[]>();
const matches = (match: RequestMatch, key: string) => (typeof match === 'string' ? match === key : match.test(key));
export const COMPASS_TOKEN = `${enc(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${enc(JSON.stringify({ sub: 'test-admin-uid', email: 'admin@teajia.com', name: 'Test Admin', role: 'owner', platform_role: 'platform_owner', exp: Math.floor(Date.now() / 1000) + 86400, active_account_id: 'acct-bali', memberships }))}.test`;

export async function installCompassHarness(page: Page, options?: { sampleCart?: unknown[]; preserveSamplesOnNavigation?: boolean; preserveSampleCartOnNavigation?: boolean; compassSyncLoseResponses?: number; contextEmpty?: boolean; contextFailOnce?: boolean; contextJourneyFailOnce?: boolean; contextVisitFailOnce?: boolean; products?: unknown[]; compassEntries?: unknown[]; contextByAccount?: Record<string, { journeys: unknown[]; visits: unknown[] }>; contextAfterInitial?: { journeys: unknown[]; visits: unknown[] }; contextDelayByAccount?: Record<string, number>; customers?: Array<Record<string, any>>; todos?: unknown[]; agentSuggestions?: unknown[]; pendingReceipts?: unknown[]; chineseName?: string | null; chineseNameFails?: boolean; rates?: unknown[]; saidParts?: unknown[]; drive?: Record<string, unknown>; failRequests?: Array<{ match: RequestMatch; times?: number }>; delayRequests?: Array<{ match: RequestMatch; ms: number }> }) {
  unhandledByPage.set(page, []);
  requestCounts.set(page, new Map());
  createdCustomersByPage.set(page, []);
  updatedCustomersByPage.set(page, []);
  failuresByPage.set(page, (options?.failRequests ?? []).map((f) => ({ match: f.match, left: f.times ?? Infinity })));
  delaysByPage.set(page, [...(options?.delayRequests ?? [])]);
  let uploads = 0;
  // What the real shop keeps when Curate confirms an order, proposes a receipt,
  // accepts it and puts the tea on the shelf (observed against the real worker on
  // a local sandbox database, 2026-10-09). Without these the mock answered the
  // same canned body to every call and could not tell a tea that arrives with its
  // cost from one that arrives with none.
  const purchaseOrders: Array<Record<string, any>> = [];
  const receiptProposals: Array<Record<string, any>> = [];
  const createdProducts: HarnessProduct[] = [];
  productsByPage.set(page, createdProducts);
  const acceptedStatic = new Set<string>();
  // Customers are read the way the shop sends them: contacts is an array, never a JSON string.
  const shapeCustomer = (row: Record<string, any>) => {
    let contacts: any[] = [];
    try { const v = typeof row.contacts === 'string' ? JSON.parse(row.contacts) : row.contacts; contacts = Array.isArray(v) ? v : []; } catch { contacts = []; }
    return { ...row, contacts };
  };
  // The shop's people. Vendors are the ones tagged vendor; creating one adds to this list.
  const customers: Array<Record<string, any>> = [...(options?.customers ?? [{ id: 'vendor-chen', name: 'Chen Family', tags: ['vendor'] }])];
  const sampleSets: Array<Record<string, any>> = [];
  const samples: Array<Record<string, any>> = [];
  const compassEntries: Array<Record<string, any>> = (options?.compassEntries ?? (options?.sampleCart ?? []).flatMap((raw) => {
    const item = raw as Record<string, any>;
    return item.compassEntryId ? [{
      id: item.compassEntryId, name: item.name ?? '', chinese_name: item.chineseName ?? null,
      type: item.type ?? null, vendor_name: item.vendorName ?? null, category: 'tea', status: 'noted',
      decision: null, verdict: null, sample_state: null, sample_set_id: null,
      notes: '', photos: '[]', audio_clips: '[]', created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }] : [];
  })).map((entry) => ({ ...entry }));
  await page.addInitScript(({ token, items, preserveSamplesOnNavigation, preserveSampleCartOnNavigation }) => {
    localStorage.setItem('teajia_token', token);
    localStorage.removeItem('teajia-storage');
    const hasBooted = sessionStorage.getItem('compass-harness-booted') === '1';
    if (!preserveSampleCartOnNavigation || !hasBooted) {
      localStorage.setItem('teajia-sample-cart', JSON.stringify({ state: { items }, version: 0 }));
    }
    if (!preserveSamplesOnNavigation || !hasBooted) localStorage.removeItem('teajia-samples');
    sessionStorage.setItem('compass-harness-booted', '1');
  }, {
    token: COMPASS_TOKEN,
    items: options?.sampleCart ?? [],
    preserveSamplesOnNavigation: options?.preserveSamplesOnNavigation ?? false,
    preserveSampleCartOnNavigation: options?.preserveSampleCartOnNavigation ?? false,
  });
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    const accountId = route.request().headers()['x-teajia-account'] ?? 'acct-bali';
    const requestKey = `${route.request().method()} ${path}`;
    const counts = requestCounts.get(page)!;
    counts.set(requestKey, (counts.get(requestKey) ?? 0) + 1);
    if (options?.contextFailOnce && requestKey === 'POST /api/curate/journeys' && counts.get(requestKey) === 1) {
      return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Temporary failure' }) });
    }
    if (options?.contextJourneyFailOnce && requestKey === 'GET /api/curate/journeys' && counts.get(requestKey)! <= 4) return route.fulfill({ status: 503, body: '{}' });
    if (options?.contextVisitFailOnce && requestKey === 'GET /api/curate/visits' && counts.get(requestKey)! <= 4) return route.fulfill({ status: 503, body: '{}' });
    // A request the test has told to fail answers 500, and one it has told to be slow waits first.
    const slow = delaysByPage.get(page)?.find((d) => matches(d.match, requestKey));
    if (slow) await new Promise((resolve) => setTimeout(resolve, slow.ms));
    const failing = failuresByPage.get(page)?.find((f) => f.left !== 0 && matches(f.match, requestKey));
    if (failing) {
      if (failing.left > 0) failing.left -= 1;
      return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Request failed (500)' }) });
    }
    const delay = options?.contextDelayByAccount?.[accountId] ?? 0;
    if (delay && (path === '/api/curate/journeys' || path === '/api/curate/visits')) await new Promise(resolve => setTimeout(resolve, delay));
    const scopedContext = options?.contextAfterInitial && counts.get(requestKey)! > 1
      ? options.contextAfterInitial
      : options?.contextByAccount?.[accountId];
    if (requestKey === 'POST /api/compass/sync') {
      const body = route.request().postDataJSON() as { entries?: Array<{ id: string }> };
      for (const entry of body.entries ?? []) {
        const index = compassEntries.findIndex(candidate => candidate.id === entry.id);
        if (index >= 0) compassEntries[index] = { ...compassEntries[index], ...entry };
        else compassEntries.push({ ...entry });
      }
      if (counts.get(requestKey)! <= (options?.compassSyncLoseResponses ?? 0)) {
        return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Compass sync response was lost' }) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ syncedIds: (body.entries ?? []).map(entry => entry.id) }) });
    }
    if (requestKey === 'GET /api/customers') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(customers.map(shapeCustomer)) });
    }
    if (requestKey === 'POST /api/customers') {
      const input = route.request().postDataJSON() as Record<string, any>;
      const row = { ...input, id: `customer-created-${customers.length + 1}` };
      customers.push(row);
      createdCustomersByPage.get(page)?.push(input);
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: row.id }) });
    }
    // Saving a field on a vendor: the way the shop's server does it, a handle
    // (wechat, instagram) is folded into the contacts list and a contacts list
    // sent in a body REPLACES the stored one.
    const customerPut = path.match(/^\/api\/customers\/([^/]+)$/);
    if (customerPut && route.request().method() === 'PUT') {
      const index = customers.findIndex((row) => row.id === customerPut[1]);
      if (index < 0) return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'Customer not found' }) });
      const body = { ...(route.request().postDataJSON() as Record<string, any>) };
      const parse = (raw: unknown): any[] => { try { const v = typeof raw === 'string' ? JSON.parse(raw) : raw; return Array.isArray(v) ? v : []; } catch { return []; } };
      let contacts = parse(body.contacts ?? customers[index].contacts);
      let touched = Array.isArray(body.contacts);
      for (const channel of ['wechat', 'instagram']) {
        if (!(channel in body)) continue;
        contacts = contacts.filter((c) => c.channel !== channel);
        if (body[channel]) contacts.push({ channel, handle: body[channel] });
        delete body[channel];
        touched = true;
      }
      if (touched) body.contacts = JSON.stringify(contacts);
      customers[index] = { ...customers[index], ...body };
      updatedCustomersByPage.get(page)?.push({ id: customerPut[1], body: route.request().postDataJSON() });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
    }
    // The shop's server lifts a handle back out of contacts when it reads a customer.
    const customerMatch = path.match(/^\/api\/customers\/([^/]+)$/);
    if (customerMatch && route.request().method() === 'GET') {
      const found = customers.find((row) => row.id === customerMatch[1]);
      const lifted = found ? shapeCustomer(found) : found;
      if (lifted) {
        let list: any[] = [];
        try { const v = typeof lifted.contacts === 'string' ? JSON.parse(lifted.contacts) : lifted.contacts; list = Array.isArray(v) ? v : []; } catch { list = []; }
        for (const channel of ['wechat', 'instagram']) if (!lifted[channel]) { const hit = list.find((c) => c.channel === channel && c.handle); if (hit) lifted[channel] = hit.handle; }
      }
      return route.fulfill({ status: found ? 200 : 404, contentType: 'application/json', body: JSON.stringify(lifted ?? { error: 'Customer not found' }) });
    }
    if (requestKey === 'GET /api/compass/entries') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ entries: compassEntries }) });
    }
    if (requestKey === 'GET /api/admin/sample-sets') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ sets: sampleSets }) });
    }
    if (requestKey === 'GET /api/admin/samples') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ samples }) });
    }
    if (requestKey === 'POST /api/admin/sample-sets') {
      const input = route.request().postDataJSON() as Record<string, any>;
      const now = new Date().toISOString();
      const row = { ...input, account_id: accountId, created_at: now, updated_at: now };
      sampleSets.push(row);
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(row) });
    }
    if (requestKey === 'POST /api/admin/samples') {
      const input = route.request().postDataJSON() as Record<string, any>;
      const now = new Date().toISOString();
      const entry = input.compass_entry_id ? compassEntries.find(entry => entry.id === input.compass_entry_id) : undefined;
      if (input.compass_entry_id && !entry) return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'Curate entry not found' }) });
      let setId = input.set_id;
      if (entry) {
        setId = `vendor-set-${entry.vendor_id ?? entry.vendor_name ?? 'unassigned'}`;
        if (!sampleSets.some(set => set.id === setId)) sampleSets.push({ id: setId, name: `Sample list — ${entry.vendor_name ?? 'Unassigned'}`, source_id: entry.vendor_id, source_name: entry.vendor_name, purpose: 'sourcing', account_id: accountId, created_at: now, updated_at: now });
      }
      const previous = entry ? samples.find(sample => sample.compass_entry_id === entry.id) : samples.find(sample => sample.id === input.id);
      const row = previous ?? { ...input, id: entry ? `canonical-sample-${entry.id}` : input.id, set_id: setId, account_id: accountId, created_at: now, updated_at: now, tastings: [] };
      if (!previous) samples.push(row);
      if (entry) Object.assign(entry, { sample_state: row.status === 'requested' ? 'requested' : ['received', 'untasted'].includes(row.status) ? 'received' : 'tasted', sample_set_id: row.set_id, updated_at: now });
      return route.fulfill({ status: previous ? 200 : 201, contentType: 'application/json', body: JSON.stringify(row) });
    }
    const sampleSetMatch = path.match(/^\/api\/admin\/sample-sets\/([^/]+)$/);
    if (sampleSetMatch && route.request().method() === 'PUT') {
      const index = sampleSets.findIndex(row => row.id === sampleSetMatch[1]);
      const row = { ...(sampleSets[index] ?? { id: sampleSetMatch[1], account_id: accountId }), ...route.request().postDataJSON(), updated_at: new Date().toISOString() };
      if (index >= 0) sampleSets[index] = row; else sampleSets.push(row);
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(row) });
    }
    if (sampleSetMatch && route.request().method() === 'DELETE') {
      const index = sampleSets.findIndex(row => row.id === sampleSetMatch[1]);
      if (index >= 0) sampleSets.splice(index, 1);
      for (let sampleIndex = samples.length - 1; sampleIndex >= 0; sampleIndex -= 1) {
        if (samples[sampleIndex].set_id === sampleSetMatch[1]) samples.splice(sampleIndex, 1);
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
    }
    const sampleMatch = path.match(/^\/api\/admin\/samples\/([^/]+)$/);
    if (sampleMatch && route.request().method() === 'PUT') {
      const index = samples.findIndex(row => row.id === sampleMatch[1]);
      const row = { ...(samples[index] ?? { id: sampleMatch[1], account_id: accountId }), ...route.request().postDataJSON(), updated_at: new Date().toISOString() };
      if (index >= 0) samples[index] = row; else samples.push(row);
      const entry = compassEntries.find(entry => entry.id === row.compass_entry_id);
      if (entry) Object.assign(entry, { sample_state: row.status === 'requested' ? 'requested' : ['received', 'untasted'].includes(row.status) ? 'received' : 'tasted', sample_set_id: row.set_id, updated_at: row.updated_at });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(row) });
    }
    if (sampleMatch && route.request().method() === 'DELETE') {
      const index = samples.findIndex(row => row.id === sampleMatch[1]);
      if (index >= 0) samples.splice(index, 1);
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
    }
    const publicSampleMatch = path.match(/^\/api\/samples\/([^/]+)$/);
    if (publicSampleMatch && route.request().method() === 'GET') {
      const sample = samples.find(row => row.id === publicSampleMatch[1]);
      return route.fulfill({ status: sample ? 200 : 404, contentType: 'application/json', body: JSON.stringify(sample ?? { error: 'Sample not found' }) });
    }
    const tastingMatch = path.match(/^\/api\/samples\/([^/]+)\/tastings$/);
    if (tastingMatch && route.request().method() === 'POST') {
      const input = route.request().postDataJSON() as Record<string, any>;
      const tasting = { id: input.id ?? crypto.randomUUID(), sample_id: tastingMatch[1], ...input, created_at: new Date().toISOString() };
      const sample = samples.find(row => row.id === tastingMatch[1]);
      if (sample) {
        if (!(sample.tastings ?? []).some((row: { id: string }) => row.id === tasting.id)) sample.tastings = [...(sample.tastings ?? []), tasting];
        sample.status = 'tasted';
        const entry = compassEntries.find(entry => entry.id === sample.compass_entry_id);
        if (entry) Object.assign(entry, { sample_state: 'tasted', sample_set_id: sample.set_id });
      }
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(tasting) });
    }
    const vendorProfileMatch = path.match(/^\/api\/curate\/vendors\/([^/]+)\/profile$/);
    if (vendorProfileMatch && route.request().method() === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ vendor_id: vendorProfileMatch[1], vendor_code: null, contact_people: [], addresses: [], contacts: [] }) });
    // Chinese name suggestions (never typed) and the shelf promotion.
    if (requestKey === 'POST /api/generate-chinese-name') {
      if (options?.chineseNameFails) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'AI provider unavailable', code: 'provider_unavailable' }) });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ chineseName: options?.chineseName === undefined ? '孟库古树茶' : options.chineseName, confident: true }) });
    }
    // What the page writes when an agent's find is picked, a to-do is added or
    // ticked, a recording is filed, Drive is saved, and an order is marked sent.
    if (requestKey === 'POST /api/curate/suggestions/pick') {
      const input = (route.request().postDataJSON() ?? {}) as { pick?: string[]; drop?: string[]; as?: string };
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ committed: true, in_curate: (input.pick ?? []).map((id) => ({ suggestion_id: id, tea_id: `tea-from-${id}`, name: id })), dropped: (input.drop ?? []).length, skipped: [], as: input.as ?? 'sample' }) });
    }
    if (requestKey === 'POST /api/curate/todos') {
      const input = (route.request().postDataJSON() ?? {}) as { text?: string };
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ added: true, todo_id: `todo-created-${counts.get(requestKey)}`, text: input.text ?? '' }) });
    }
    if (/^\/api\/curate\/todos\/[^/]+\/done$/.test(path) && route.request().method() === 'POST') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ done: true }) });
    if (requestKey === 'POST /api/curate/said/file') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ parts: options?.saidParts ?? [] }) });
    if (requestKey === 'POST /api/upload-image') { uploads += 1; return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ url: `https://img.test/upload-${uploads}.jpg` }) }); }
    if (requestKey === 'POST /api/curate/drive/save') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ copied: 2, teas: 1 }) });
    if (requestKey === 'POST /api/purchase-orders') {
      const input = route.request().postDataJSON() as Record<string, any>;
      let items: any[] = [];
      try { items = JSON.parse(input.items_json ?? '[]'); } catch { items = []; }
      purchaseOrders.push({ id: 'po-created', ...input, items });
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: 'po-created' }) });
    }
    if (/^\/api\/purchase-orders\/[^/]+$/.test(path) && route.request().method() === 'PUT') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
    // A receipt proposal is idempotent by its key: the same key answers the same row (200), a new one makes it (201).
    const proposalMatch = path.match(/^\/api\/compass\/entries\/([^/]+)\/receipt-proposals$/);
    if (proposalMatch && route.request().method() === 'POST') {
      const input = route.request().postDataJSON() as Record<string, any>;
      const existing = receiptProposals.find((row) => row.idempotency_key === input.idempotency_key);
      if (existing) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(existing) });
      const row = {
        id: `proposal-${proposalMatch[1]}`, account_id: accountId, compass_entry_id: proposalMatch[1], import_id: null, import_item_id: null,
        product_id: null, batch_id: null, product_type: null, status: 'pending', ledger_id: null,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(), proposed_by_user_id: 'test-admin-uid', ...input,
      };
      receiptProposals.push(row);
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(row) });
    }
    // The shop does not know a tea's cost at promotion: it writes NULL and leaves a
    // receipt, accepted against an order line, to say what was paid. First promotion
    // answers 201, a repeat answers 200 with alreadyPromoted.
    const promoteMatch = path.match(/^\/api\/compass\/entries\/([^/]+)\/promote$/);
    if (promoteMatch && route.request().method() === 'POST') {
      const entry = compassEntries.find((candidate) => candidate.id === promoteMatch[1]);
      const already = createdProducts.find((row) => row.source_compass_entry_id === promoteMatch[1]);
      if (already) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: already.id, product: already, alreadyPromoted: true }) });
      const product = {
        id: `product-${promoteMatch[1]}`, account_id: accountId, source_compass_entry_id: promoteMatch[1], given_name: entry?.name ?? '', status: 'Draft', is_public: 0,
        stock_grams: 0, cost_amount: null, cost_currency: null, cost_currency_source: null, quantity_purchased: null, shipping_rate_per_kg: null, markup_multiplier: null,
      };
      createdProducts.push(product);
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: product.id, product, alreadyPromoted: false }) });
    }
    // Accepting a receipt proposal when the tea arrives. Like the shop, the cost
    // comes from the order line the receipt's key names, and from nowhere else.
    const acceptMatch = path.match(/^\/api\/curate\/receipt-proposals\/([^/]+)\/accept$/);
    if (acceptMatch && route.request().method() === 'POST') {
      const proposal = receiptProposals.find((row) => row.id === acceptMatch[1]);
      if (proposal?.status === 'accepted') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ proposal, product_id: proposal.product_id, ledger_id: proposal.ledger_id, alreadyAccepted: true }) });
      const entryId = proposal?.compass_entry_id ?? options?.pendingReceipts?.map((row) => row as Record<string, any>).find((row) => row.id === acceptMatch[1])?.compass_entry_id ?? null;
      const key = String(proposal?.idempotency_key ?? '');
      const keyMatch = key.match(/^order:(.+):([^:]+)$/);
      const line = keyMatch ? purchaseOrders.find((po) => po.id === keyMatch[1])?.items.find((item: any) => item.compass_entry_id === keyMatch[2]) : undefined;
      const productId = `product-${entryId ?? acceptMatch[1]}`;
      if (!createdProducts.some((row) => row.id === productId)) {
        createdProducts.push({
          id: productId, account_id: accountId, source_compass_entry_id: entryId, given_name: proposal?.product_name ?? '', status: 'Draft', is_public: 0,
          stock_grams: proposal?.quantity ?? 0, quantity_purchased: line ? proposal?.quantity ?? null : null,
          cost_amount: line ? Number(line.line_total) : null, cost_currency: line ? line.currency : null, cost_currency_source: null, shipping_rate_per_kg: null, markup_multiplier: null,
        });
      }
      const accepted = proposal ?? { id: acceptMatch[1] };
      Object.assign(accepted, { status: 'accepted', product_id: productId, ledger_id: `ledger-${acceptMatch[1]}` });
      acceptedStatic.add(acceptMatch[1]);
      const entry = compassEntries.find((candidate) => candidate.id === entryId);
      if (entry) Object.assign(entry, { status: 'in_stock', draft_product_id: productId });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ proposal: accepted, product_id: productId, ledger_id: accepted.ledger_id, alreadyAccepted: false }) });
    }
    // Receipts waiting for their tea: each one carries the tea's name and vendor, joined from the entry.
    if (requestKey === 'GET /api/curate/receipt-proposals') {
      const waiting = receiptProposals.filter((row) => row.status === 'pending').map((row) => {
        const entry = compassEntries.find((candidate) => candidate.id === row.compass_entry_id);
        return { id: row.id, compass_entry_id: row.compass_entry_id, product_id: row.product_id, product_name: row.product_name, purpose: row.purpose, quantity: row.quantity, unit: row.unit, acquisition_kind: row.acquisition_kind, created_at: row.created_at, tea_name: entry?.name ?? row.product_name, vendor_name: entry?.vendor_name ?? null };
      });
      const staticRows = ((options?.pendingReceipts ?? []) as Array<Record<string, any>>).filter((row) => !acceptedStatic.has(row.id));
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ pending: [...staticRows, ...waiting] }) });
    }
    const responses: Record<string, unknown> = {
      'GET /api/curate/attachments': [], 'GET /api/curate/history': { history: [] },
      'GET /api/auth/me': { id: 'test-admin-uid', email: 'admin@teajia.com', name: 'Test Admin', role: 'owner', memberships, active_account_id: 'acct-bali' },
      'POST /api/auth/refresh': { token: COMPASS_TOKEN },
      'GET /api/accounts/me': { memberships, active_account_id: 'acct-bali' },
      'GET /api/accounts/acct-bali': { id: 'acct-bali', name: 'Teajia Bali', slug: 'teajia-bali', default_currency: 'USD' },
      'GET /api/accounts/acct-empty': { id: 'acct-empty', name: 'Empty Test Account', slug: 'empty-test', default_currency: 'USD' },
      'GET /api/products': options?.products ?? [], 'GET /api/rates': options?.rates ?? [{ currency: 'USD', rate_to_usd: 1, last_updated: new Date().toISOString() }],
      'GET /api/batches': [],
      // A photo read for a label: nothing on it to fill in.
      'POST /api/extract-from-image': {},
      // Confirming an order records the purchase order.
      'GET /api/products/public': [], 'GET /api/user/favorites': { favorites: [] },
      'PUT /api/user/favorites': { ok: true },
      'GET /api/tasting-journal': { entries: [] }, 'GET /api/tea-discovery': { profile: null },
      'POST /api/tasting-journal/sync': { syncedIds: [] },
      'GET /api/notes': { notes: [] }, 'POST /api/notes/sync': { syncedIds: [] },
      'POST /api/incidents': { ok: true },
      'GET /api/platform/incidents': { incidents: [] },
      'GET /api/customers': [{ id: 'vendor-chen', name: 'Chen Family', tags: ['vendor'] }],
      'GET /api/compass/incoming': { shares: [] },
      'GET /api/vendors': [], 'GET /api/sources': [], 'GET /api/admin/events': [],
      'GET /api/curate/journeys': { journeys: scopedContext?.journeys ?? (options?.contextEmpty ? [] : [{ id: 'journey-taiwan', account_id: 'acct-bali', name: 'Taiwan', season: 'Spring', year: 2026 }]) },
      'GET /api/curate/visits': { visits: scopedContext?.visits ?? (options?.contextEmpty ? [] : [{ id: 'visit-chen', account_id: 'acct-bali', journey_id: 'journey-taiwan', vendor_id: 'vendor-chen', vendor_name: 'Chen Family', place: 'Taipei' }]) },
      'GET /api/curate/imports': { imports: [] },
      // Curate v2's Today: nothing from an agent, no to-dos, nothing on the way, Drive not linked.
      'GET /api/curate/suggestions': { waiting: options?.agentSuggestions ?? [] },
      'GET /api/curate/todos': { todos: options?.todos ?? [] },
      'GET /api/curate/drive': options?.drive ?? { connected: false },
      'POST /api/curate/journeys': { id: 'journey-created', account_id: 'acct-bali', name: 'Yunnan', season: 'Autumn', year: 2026 },
      'PUT /api/curate/journeys/journey-created': { id: 'journey-created', account_id: 'acct-bali', name: 'Yunnan edited', season: 'Autumn', year: 2026 },
      'DELETE /api/curate/journeys/journey-created': { success: true },
      'POST /api/curate/visits': { id: 'visit-created', account_id: 'acct-bali', journey_id: 'journey-created', vendor_id: 'vendor-chen', vendor_name: 'Chen Family', place: 'Kunming' },
      'PUT /api/curate/visits/visit-created': { id: 'visit-created', account_id: 'acct-bali', journey_id: 'journey-created', vendor_id: 'vendor-chen', vendor_name: 'Chen Family', place: 'Dali' },
      'DELETE /api/curate/visits/visit-created': { success: true },
    };
    if (!(requestKey in responses)) {
      const diagnostic = requestKey;
      unhandledByPage.get(page)?.push(diagnostic);
      console.error(`[compass-harness] unhandled ${diagnostic}`);
      return route.fulfill({ status: 501, contentType: 'application/json', body: JSON.stringify({ error: `Unhandled Compass test API route: ${path}` }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(responses[requestKey]) });
  });
}

/** The products the shop created while the page ran (a promotion, or an accepted receipt), as the shop would hold them. */
export function compassCreatedProducts(page: Page): HarnessProduct[] {
  return productsByPage.get(page) ?? [];
}

/** From now on, requests matching this key (METHOD /path) answer 500: the next `times`, or every one. */
export function failCompassRequests(page: Page, match: RequestMatch, times = Infinity) {
  failuresByPage.get(page)?.push({ match, left: times });
}
/** Requests matching this key answer normally again. */
export function clearCompassFailures(page: Page) {
  failuresByPage.set(page, []);
}
/** Requests matching this key wait this long before they are answered. */
export function delayCompassRequests(page: Page, match: RequestMatch, ms: number) {
  delaysByPage.get(page)?.push({ match, ms });
}

/** Every PUT /api/customers/:id the page made, as sent. */
export function compassUpdatedCustomers(page: Page): Array<{ id: string; body: Record<string, any> }> {
  return updatedCustomersByPage.get(page) ?? [];
}

/** The bodies of every customer the page created through POST /api/customers. */
export function compassCreatedCustomers(page: Page): Array<Record<string, any>> {
  return createdCustomersByPage.get(page) ?? [];
}

export function compassRequestCount(page: Page, requestKey: string): number {
  return requestCounts.get(page)?.get(requestKey) ?? 0;
}

export async function expectNoUnhandledCompassApi(page: Page) {
  expect(unhandledByPage.get(page) ?? [], 'Compass test made unhandled API requests').toEqual([]);
}

export async function openCompass(page: Page) {
  await page.goto('/admin/compass', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('tab', { name: 'Source', exact: true })).toHaveAttribute('aria-selected', 'true', { timeout: 15_000 });
}

/** Opens Curate v2 (the rebuilt Curate) on a tab the route can name: today, table, teas or orders. */
export async function openCurateV2(page: Page, tab: 'today' | 'table' | 'teas' | 'orders' = 'today') {
  await page.goto(`/admin/compass/v2${tab === 'today' ? '' : `?tab=${tab}`}`, { waitUntil: 'domcontentloaded' });
  const label = { today: 'Today', table: 'Table', teas: 'Teas', orders: 'Orders' }[tab];
  await expect(page.getByRole('tab', { name: label, exact: true })).toHaveAttribute('aria-selected', 'true', { timeout: 15_000 });
}
