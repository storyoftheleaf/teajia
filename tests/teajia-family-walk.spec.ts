import { test, expect, type Page, type BrowserContext } from './fixtures';
import { createHash, randomBytes } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The full walk of the Teajia family plan (todo/plans/teajia-family.md, "Done in full"),
 * on a 390-wide phone, in the practice shop. Every checklist line runs as its own step,
 * saves one screenshot under test-results/teajia-family/, and records pass or fail in
 * test-results/teajia-family/results.json. A failed line does not stop the walk; the
 * test fails at the end if any line failed.
 *
 * Run (outside the sandbox; Chromium and the local database need it):
 *   NODE_OPTIONS=--experimental-sqlite npx playwright test --config playwright.practice.config.ts tests/teajia-family-walk.spec.ts
 * The practice config starts the API on 8798 and the site on 7813 and stops both.
 *
 * Nothing metered is called. The microphone is a generated tone (getUserMedia is
 * replaced before the page loads) and the transcription answer is stubbed in the
 * browser, so the speech provider is never reached. The worker's member door for
 * voice notes is proved separately with a request it refuses before any provider call.
 *
 * Line 19 (lint, unit suites, test:mobile) is a set of commands, not a browser step;
 * its output is saved beside these screenshots as 19-*.txt by the person running the walk,
 * and results.json marks it failed here so nobody reads it as checked by the browser.
 */
const SHOTS = 'test-results/teajia-family';
const PASSWORD = 'walk-fixture-1';
const OWNER = { identifier: 'sandbox', password: 'sandbox' };
const SPOKEN = 'Honey and warm stone on the third cup';
const DAY = 86_400_000;

async function practiceDb() {
  const { DatabaseSync } = await import('node:sqlite');
  const dir = join(process.cwd(), 'worker/.wrangler/state/v3/d1/miniflare-D1DatabaseObject');
  const file = readdirSync(dir).filter(name => name.endsWith('.sqlite') && name !== 'metadata.sqlite')
    .map(name => join(dir, name)).sort((a, b) => statSync(b).size - statSync(a).size)[0];
  const db = new DatabaseSync(file);
  db.exec('PRAGMA busy_timeout = 5000');
  return db;
}

async function tokenFor(page: Page, credentials: { identifier: string; password: string }) {
  const login = await page.request.post('/api/auth/login', { data: credentials });
  expect(login.status()).toBe(200);
  return (await login.json()).token as string;
}

const noOverflow = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

/** A JPEG made in the browser (gradient plus grain, so it compresses like a photograph). */
async function jpeg(page: Page, width: number, height: number, quality = 0.9): Promise<Buffer> {
  const base64 = await page.evaluate(([w, h, q]) => {
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#6b4f2a'); grad.addColorStop(1, '#c9a96a');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 300; i += 1) { ctx.fillStyle = `rgb(${(i * 37) % 255},${(i * 91) % 255},${(i * 53) % 255})`; ctx.fillRect((i * 97) % w, (i * 61) % h, 40, 40); }
    return canvas.toDataURL('image/jpeg', q).split(',')[1];
  }, [width, height, quality] as const);
  return Buffer.from(base64, 'base64');
}

/** A large camera-sized JPEG: 6000x4000 with grain, encoded until it weighs about twelve megabytes. */
async function bigJpeg(page: Page): Promise<Buffer> {
  const base64 = await page.evaluate(async () => {
    const w = 6000, h = 4000;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#3e2c18'); grad.addColorStop(0.5, '#8a6a3c'); grad.addColorStop(1, '#d8c08e');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h);
    let seed = 7;
    for (let i = 0; i < data.data.length; i += 4) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const n = (seed % 41) - 20;
      data.data[i] += n; data.data[i + 1] += n; data.data[i + 2] += n;
    }
    ctx.putImageData(data, 0, 0);
    let best: Blob | null = null;
    for (const q of [0.98, 0.95, 0.92, 0.88, 0.84, 0.8, 0.75, 0.7, 0.6, 0.5]) {
      const blob: Blob = await new Promise(resolve => canvas.toBlob(b => resolve(b!), 'image/jpeg', q));
      best = blob;
      if (blob.size <= 13_000_000) break;
    }
    const bytes = new Uint8Array(await best!.arrayBuffer());
    let s = '';
    for (let i = 0; i < bytes.length; i += 32_768) s += String.fromCharCode(...bytes.subarray(i, i + 32_768));
    return btoa(s);
  });
  return Buffer.from(base64, 'base64');
}

/** An Exif block carrying a GPS position (Bali), as a phone camera writes it. */
function gpsExif(): Buffer {
  const entries: Buffer[] = [];
  const be16 = (n: number) => { const b = Buffer.alloc(2); b.writeUInt16BE(n); return b; };
  const be32 = (n: number) => { const b = Buffer.alloc(4); b.writeUInt32BE(n); return b; };
  // TIFF header (big endian), IFD0 at offset 8 with one entry: the GPS IFD pointer.
  const ifd0Offset = 8;
  const gpsOffset = ifd0Offset + 2 + 12 + 4;
  entries.push(Buffer.from('MM\0*', 'binary'), be32(ifd0Offset));
  entries.push(be16(1), be16(0x8825), be16(4), be32(1), be32(gpsOffset), be32(0));
  // GPS IFD: LatitudeRef 'S', Latitude 8/1 39/1 0/1, LongitudeRef 'E', Longitude 115/1 10/1 0/1.
  const gpsEntries = 4;
  const dataOffset = gpsOffset + 2 + gpsEntries * 12 + 4;
  entries.push(be16(gpsEntries));
  entries.push(be16(0x0001), be16(2), be32(2), Buffer.from('S\0\0\0', 'binary'));
  entries.push(be16(0x0002), be16(5), be32(3), be32(dataOffset));
  entries.push(be16(0x0003), be16(2), be32(2), Buffer.from('E\0\0\0', 'binary'));
  entries.push(be16(0x0004), be16(5), be32(3), be32(dataOffset + 24));
  entries.push(be32(0));
  for (const [a, b] of [[8, 1], [39, 1], [0, 1], [115, 1], [10, 1], [0, 1]]) entries.push(be32(a), be32(b));
  const tiff = Buffer.concat(entries);
  const body = Buffer.concat([Buffer.from('Exif\0\0', 'binary'), tiff]);
  return Buffer.concat([Buffer.from([0xff, 0xe1]), be16(body.length + 2), body]);
}

/** Exif blocks and GPS tags found in a JPEG's header segments. */
function locationData(jpg: Buffer): { exif: boolean; gps: boolean } {
  let exif = false; let gps = false;
  let i = 2;
  while (i + 4 <= jpg.length && jpg[i] === 0xff) {
    const marker = jpg[i + 1];
    if (marker === 0xda || marker === 0xd9) break;
    const length = jpg.readUInt16BE(i + 2);
    const segment = jpg.subarray(i + 4, i + 2 + length);
    if (marker === 0xe1 && segment.subarray(0, 4).toString('binary') === 'Exif') {
      exif = true;
      if (segment.includes(Buffer.from([0x88, 0x25])) || segment.includes(Buffer.from([0x25, 0x88]))) gps = true;
    }
    i += 2 + length;
  }
  return { exif, gps };
}

/** The same-origin address the site uses for a stored file (src/lib/mediaUrl.ts). */
const localMedia = (url: string) => url.replace(/^https:\/\/media\.teajia\.co\//, '/api/media/');

/** Opens the member's own tasting from the tea page: the written row opens onto Note and Edit. */
async function openMyTasting(p: Page) {
  const note = p.getByRole('button', { name: 'Note', exact: true }).first();
  if (!(await note.isVisible().catch(() => false))) {
    await p.getByRole('button').filter({ hasText: 'Yours' }).first().click({ timeout: 30_000 });
  }
  await note.click();
  await expect(p.locator('.tasting-header-controls')).toBeVisible({ timeout: 20_000 });
}

/** Both copies of one photograph, uploaded as the member's phone would. */
async function uploadPhotograph(page: Page, token: string, productId: string, hue: number) {
  return page.evaluate(async ({ token, productId, hue }) => {
    const make = async (w: number, h: number) => {
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, `hsl(${hue} 40% 30%)`); grad.addColorStop(1, `hsl(${hue + 40} 50% 60%)`);
      ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
      return new Promise<Blob>(resolve => canvas.toBlob(blob => resolve(blob!), 'image/jpeg', 0.7));
    };
    const form = new FormData();
    form.append('product_id', productId);
    form.append('full', await make(2000, 1500), 'full.jpg');
    form.append('small', await make(480, 360), 'small.jpg');
    const response = await fetch('/api/family/photographs', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
    return { status: response.status, body: await response.json() };
  }, { token, productId, hue });
}

/** The microphone, replaced by a generated tone, before any page script runs. */
const FAKE_MICROPHONE = () => {
  const fake = async () => {
    const ctx = new AudioContext();
    await ctx.resume().catch(() => undefined);
    const osc = ctx.createOscillator();
    osc.frequency.value = 220;
    const dest = ctx.createMediaStreamDestination();
    osc.connect(dest);
    osc.start();
    return dest.stream;
  };
  if (navigator.mediaDevices) Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: fake, configurable: true });
};

test.use({
  actionTimeout: 20_000,
  navigationTimeout: 45_000,
  launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] },
});

test('the Teajia family, walked end to end on a phone', async ({ page, browser }) => {
  test.setTimeout(900_000);
  mkdirSync(SHOTS, { recursive: true });
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(`member page: ${e.message}`));
  const results: Record<number, { title: string; pass: boolean; seen: string[]; error?: string }> = {};
  const shot = (n: number, name: string) => `${SHOTS}/${String(n).padStart(2, '0')}-${name}.png`;
  let current: Page = page;

  async function line(n: number, title: string, fn: (seen: string[]) => Promise<void>) {
    const seen: string[] = [];
    await test.step(`${n}. ${title}`, async () => {
      try {
        await fn(seen);
        results[n] = { title, pass: true, seen };
      } catch (error) {
        results[n] = { title, pass: false, seen, error: String((error as Error).message ?? error).slice(0, 800) };
        await current.screenshot({ path: shot(n, 'FAILED') }).catch(() => undefined);
      }
    });
  }

  // ── Fixtures: one shop tea made for this walk (a copy of a real one), a second member, and the stranger's address.
  const tag = randomBytes(3).toString('hex');
  const list = await (await page.request.get('/api/products/public')).json();
  const products: Array<Record<string, unknown>> = Array.isArray(list) ? list : (list?.products ?? []);
  const source = products.find(p => p.status !== 'Sold Out' && Number(p.stock_grams) > 0 && p.category !== 'ware') ?? products[0];
  const teaId = `walk-tea-${tag}`;
  const teaName = `Walk Oolong ${tag}`;
  const teaPath = `/shop/product/${encodeURIComponent(teaId)}`;
  const strangerEmail = `walk.${tag}.stranger@sandbox.local`;
  const strangerName = `Mira ${tag}`;
  const second = { userId: `sbx-walk-b-${tag}`, email: `walk.${tag}.second@sandbox.local`, name: `Tomas ${tag}` };
  {
    const db = await practiceDb();
    const columns = (db.prepare('PRAGMA table_info(products)').all() as Array<{ name: string }>).map(c => c.name);
    const row = db.prepare('SELECT * FROM products WHERE id = ?').get(String(source.id)) as Record<string, unknown>;
    const overrides: Record<string, unknown> = {
      id: teaId, slug: teaId, product_name: teaName, given_name: teaName, status: 'Active', stock_grams: 250,
      is_public: 1, shown_in_shop: 1, image_url: null, tea_key: null, source_compass_entry_id: null,
    };
    const used = columns.filter(c => c in overrides || row[c] !== undefined);
    db.prepare(`INSERT INTO products (${used.join(', ')}) VALUES (${used.map(() => '?').join(', ')})`)
      .run(...used.map(c => (c in overrides ? overrides[c] : row[c]) as never));
    db.prepare(`INSERT INTO users (id, email, name, password_hash, role, session_version, email_verified_at) VALUES (?, ?, ?, ?, 'user', 0, datetime('now'))`)
      .run(second.userId, second.email, second.name, createHash('sha256').update(PASSWORD).digest('hex'));
    db.close();
  }

  const visitor = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const owner = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const contexts: BrowserContext[] = [visitor, owner];
  let memberContext: BrowserContext = page.context();
  let strangerId = '';
  let strangerToken = '';
  let slug = '';
  let photoIds: string[] = [];
  let bigPhoto: Record<string, any> | null = null;
  let bigOriginalBytes = 0;
  let bigOriginalHadGps = false;
  const ownerPage = await owner.newPage();
  ownerPage.on('pageerror', e => errors.push(`owner page: ${e.message}`));
  const ownerToken = await tokenFor(ownerPage, OWNER);
  const ownerHeaders = { Authorization: `Bearer ${ownerToken}` };
  await ownerPage.addInitScript((t) => { localStorage.setItem('teajia_token', t); }, ownerToken);
  const mine = async () => (await (await page.request.get(`/api/family/teas/${teaId}/mine`, { headers: { Authorization: `Bearer ${strangerToken}` } })).json());

  try {
    await page.context().addInitScript(FAKE_MICROPHONE);

    await line(1, 'A stranger opens a tea, taps "Add your tasting", and joins with name, email and password only', async (seen) => {
      let code = '';
      page.on('response', async response => {
        if (response.url().endsWith('/api/auth/signup') && response.status() === 202) code = String((await response.json()).verification_code ?? '');
      });
      await page.goto(teaPath);
      await expect(page.getByText(teaName).first()).toBeVisible({ timeout: 30_000 });
      await page.getByRole('button', { name: 'Add your tasting' }).first().click();
      await expect(page).toHaveURL(/\/signup\?returnTo=/);
      const form = page.locator('form').first();
      await expect(form.locator('input')).toHaveCount(3);
      const labels = await form.locator('input').evaluateAll(inputs => inputs.map(i => (i as HTMLInputElement).labels?.[0]?.textContent?.trim() ?? (i as HTMLInputElement).name));
      seen.push(`join form fields: ${JSON.stringify(labels)}`);
      await expect(page.getByRole('link', { name: 'Continue with Google' })).toHaveAttribute('href', /\/api\/auth\/google\?return=/);
      expect(await noOverflow(page)).toBe(true);
      await page.getByLabel('Name').fill(strangerName);
      await page.getByLabel('Email').fill(strangerEmail);
      await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
      await page.screenshot({ path: shot(1, 'join-three-fields'), fullPage: true });
      await page.getByRole('button', { name: 'Create Account' }).click();
      await expect(page.getByLabel('Verification code')).toBeVisible();
      await expect.poll(() => code).toMatch(/^\d{6}$/);
      await page.getByLabel('Verification code').fill(code);
      await page.getByRole('button', { name: 'Verify email' }).click();
      await expect(page.locator('.tasting-header-controls')).toBeVisible({ timeout: 30_000 });
      expect(page.url()).toContain(teaPath);
      seen.push(`back on ${new URL(page.url()).pathname} with the tasting open`);
      strangerToken = await page.evaluate(() => localStorage.getItem('teajia_token') ?? '');
      expect(strangerToken).not.toBe('');
      const db = await practiceDb();
      strangerId = (db.prepare('SELECT id FROM users WHERE lower(email) = lower(?)').get(strangerEmail) as { id: string }).id;
      db.close();
    });

    await line(2, 'They close the browser and come back still signed in', async (seen) => {
      const state = await page.context().storageState();
      const restarted = await browser.newContext({ storageState: state, viewport: { width: 390, height: 844 } });
      try {
        const again = await restarted.newPage();
        current = again;
        await again.goto(teaPath);
        await expect(again.getByText(teaName).first()).toBeVisible({ timeout: 30_000 });
        const me = await again.evaluate(async () => {
          const r = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${localStorage.getItem('teajia_token')}` } });
          return { status: r.status, email: (await r.json()).email, inSession: Boolean(sessionStorage.getItem('teajia_token')) };
        });
        seen.push(`after a fresh browser: /api/auth/me ${me.status} as ${me.email}; token in session storage: ${me.inSession}`);
        expect(me.status).toBe(200);
        expect(me.email).toBe(strangerEmail);
        await again.getByRole('button', { name: /Add your tasting|Note/ }).first().click();
        await expect(again.locator('.tasting-header-controls')).toBeVisible();
        expect(again.url()).not.toContain('/signup');
        await again.screenshot({ path: shot(2, 'still-signed-in-after-restart') });
      } finally {
        current = page;
        await restarted.close();
      }
    });

    await line(3, 'In the tasting they tap the microphone, speak, and the words appear in the note. They are not shop staff', async (seen) => {
      const me = await (await page.request.get('/api/auth/me', { headers: { Authorization: `Bearer ${strangerToken}` } })).json();
      seen.push(`role ${me.role}; memberships ${JSON.stringify(me.memberships ?? [])}`);
      expect(['user', 'customer', undefined]).toContain(me.role);
      expect((me.memberships ?? []).length).toBe(0);
      // The worker's door: a member reaches the member path (not the staff refusal). A body that is not
      // multipart is refused there, before any speech provider is called.
      const door = await page.request.post('/api/transcribe', { headers: { Authorization: `Bearer ${strangerToken}`, 'Content-Type': 'text/plain' }, data: 'not audio' });
      const doorBody = await door.json();
      seen.push(`worker /api/transcribe as this member without audio: ${door.status()} ${doorBody.code}`);
      expect([400, 503]).toContain(door.status());
      expect(['invalid_content_type', 'provider_unavailable']).toContain(doorBody.code);
      // The speech provider's answer, stubbed in the browser. The request it replaces is checked.
      let sent: { auth: string; type: string; bytes: number } | null = null;
      await page.route('**/api/transcribe', async route => {
        const request = route.request();
        sent = { auth: request.headers().authorization ?? '', type: request.headers()['content-type'] ?? '', bytes: request.postDataBuffer()?.length ?? 0 };
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: SPOKEN, recording_id: `stub-${tag}` }) });
      });
      await page.goto(teaPath);
      await page.getByRole('button', { name: /Add your tasting|Note/ }).first().click();
      const mic = page.getByRole('button', { name: 'Record into your notes' });
      await expect(mic).toBeVisible();
      await mic.click();
      await expect(page.getByRole('button', { name: 'Stop recording' })).toBeVisible();
      await page.waitForTimeout(1500);
      await page.getByRole('button', { name: 'Stop recording' }).click();
      await expect(page.getByRole('textbox', { name: 'Your notes' })).toHaveValue(new RegExp(SPOKEN), { timeout: 20_000 });
      expect(sent).not.toBeNull();
      seen.push(`the recording went to /api/transcribe as ${sent!.type.split(';')[0]}, ${sent!.bytes} bytes, signed in: ${sent!.auth.startsWith('Bearer ')}`);
      expect(sent!.auth).toBe(`Bearer ${strangerToken}`);
      expect(sent!.type).toContain('multipart/form-data');
      expect(sent!.bytes).toBeGreaterThan(100);
      await page.unroute('**/api/transcribe');
      await page.screenshot({ path: shot(3, 'spoken-words-in-the-note') });
    });

    await line(4, 'They tap the camera on the Impression page and again on the taste page; both show in "Your photographs", above "Your notes"', async (seen) => {
      const row = page.getByRole('group', { name: 'Your photographs' });
      await expect(row).toBeVisible();
      const input = page.getByTestId('tasting-photo-input');
      const camera = page.getByRole('button', { name: 'Add a photograph' });
      await expect(camera).toBeVisible();
      // The first is a camera-sized picture carrying a GPS position (line 17 measures what was stored).
      const raw = await bigJpeg(page);
      const original = Buffer.concat([raw.subarray(0, 2), gpsExif(), raw.subarray(2)]);
      bigOriginalBytes = original.length;
      bigOriginalHadGps = locationData(original).gps;
      const upload = page.waitForResponse(r => r.url().includes('/api/family/photographs') && r.request().method() === 'POST', { timeout: 60_000 });
      await input.setInputFiles({ name: 'IMG_0001.jpg', mimeType: 'image/jpeg', buffer: original });
      const response = await upload;
      expect(response.status()).toBe(201);
      bigPhoto = (await response.json()).photograph;
      await expect(row.locator('img')).toHaveCount(1, { timeout: 20_000 });
      // The taste page: the same camera in the header.
      await page.getByRole('button', { name: /^Taste/ }).first().click();
      await expect(camera).toBeVisible();
      const second = page.waitForResponse(r => r.url().includes('/api/family/photographs') && r.request().method() === 'POST');
      await input.setInputFiles({ name: 'IMG_0002.jpg', mimeType: 'image/jpeg', buffer: await jpeg(page, 1600, 1200) });
      expect((await second).status()).toBe(201);
      const now = await mine();
      seen.push(`pages recorded for the two photographs: ${JSON.stringify(now.photographs.map((p: { page: string }) => p.page))}`);
      expect(now.photographs.map((p: { page: string }) => p.page).sort()).toEqual(['impression', 'taste']);
      await page.getByRole('button', { name: 'Open your impression' }).click();
      const rowAgain = page.getByRole('group', { name: 'Your photographs' });
      await expect(rowAgain.locator('img')).toHaveCount(2);
      const rowY = (await rowAgain.boundingBox())!.y;
      const notesY = (await page.getByText('Your notes', { exact: true }).boundingBox())!.y;
      seen.push(`"Your photographs" at y=${Math.round(rowY)}, "Your notes" at y=${Math.round(notesY)}`);
      expect(rowY).toBeLessThan(notesY);
      await expect(page.getByRole('group', { name: 'Your photographs' }).locator('.tasting-photo-box').getByRole('link', { name: 'How we use photographs' })).toBeVisible();
  await expect(page.getByText('may be shown on Teajia')).toHaveCount(0);
      await rowAgain.scrollIntoViewIfNeeded();
      await page.screenshot({ path: shot(4, 'two-photographs-above-notes') });
    });

    await line(5, 'A seventh photograph for that tea is refused in a plain sentence', async (seen) => {
      const input = page.getByTestId('tasting-photo-input');
      for (let i = 0; i < 4; i += 1) {
        const done = page.waitForResponse(r => r.url().includes('/api/family/photographs') && r.request().method() === 'POST');
        await input.setInputFiles({ name: `more${i}.jpg`, mimeType: 'image/jpeg', buffer: await jpeg(page, 900, 700) });
        expect((await done).status()).toBe(201);
      }
      await expect(page.getByRole('group', { name: 'Your photographs' }).locator('img')).toHaveCount(6);
      await input.setInputFiles({ name: 'seventh.jpg', mimeType: 'image/jpeg', buffer: await jpeg(page, 900, 700) });
      const alert = page.getByRole('alert').filter({ hasText: /six photographs/ });
      await expect(alert).toBeVisible();
      seen.push(`refusal shown: "${(await alert.textContent())?.trim()}"`);
      // The door itself refuses too, not only the phone.
      const direct = await uploadPhotograph(page, strangerToken, teaId, 10);
      seen.push(`a direct seventh upload to the worker: ${direct.status} "${direct.body.error}"`);
      expect(direct.status).toBe(409);
      await alert.scrollIntoViewIfNeeded();
      await page.screenshot({ path: shot(5, 'seventh-refused') });
      photoIds = (await mine()).photographs.map((p: { id: string }) => p.id);
      expect(photoIds.length).toBe(6);
    });

    // Line 7's first half: the save and the Share step, with the first sitting's words.
    let shareSeen: string[] = [];
    await test.step('save the first sitting and share it (line 7 continues below)', async () => {
      try {
        await page.getByRole('textbox', { name: 'Your notes' }).fill(`${SPOKEN}. First sitting ${tag}.`);
        await page.getByRole('button', { name: 'Save tasting' }).click();
        const share = page.getByRole('dialog', { name: 'Share this tasting' });
        await expect(share).toBeVisible({ timeout: 20_000 });
        await expect(share.getByRole('button', { name: 'Keep private' })).toHaveAttribute('aria-pressed', 'true');
        await share.getByRole('button', { name: /offer my photographs/ }).click();
        await share.getByRole('button', { name: 'Share', exact: true }).click();
        await expect(share.getByText(/On your page/)).toBeVisible({ timeout: 20_000 });
        await page.screenshot({ path: shot(7, 'a-share-step') });
        const after = await mine();
        shareSeen = [`after Share: tasting ${after.tasting_share_state}, photographs ${JSON.stringify([...new Set(after.photographs.map((p: { share_state: string }) => p.share_state))])}`];
        await share.getByRole('button', { name: 'Close' }).click().catch(() => undefined);
      } catch (error) {
        shareSeen = [`share step failed: ${String((error as Error).message).slice(0, 300)}`];
      }
    });

    await line(6, "They add a second note on another day's sitting. Both notes are there, under one tasting", async (seen) => {
      // Another day: a fresh page in the same browser with its clock one day on.
      const tomorrow = await memberContext.newPage();
      current = tomorrow;
      tomorrow.on('pageerror', e => errors.push(`member tomorrow: ${e.message}`));
      await tomorrow.clock.install({ time: new Date(Date.now() + DAY + 60_000) });
      await tomorrow.goto(teaPath);
      await expect(tomorrow.getByText(teaName).first()).toBeVisible({ timeout: 30_000 });
      await openMyTasting(tomorrow);
      await expect(tomorrow.locator('.tasting-header-controls')).toBeVisible();
      const earlier = tomorrow.getByRole('region', { name: 'Earlier notes' });
      await expect(earlier).toBeVisible();
      await expect(earlier.getByText(`First sitting ${tag}`)).toBeVisible();
      const notes = tomorrow.getByRole('textbox', { name: 'Your notes' });
      await expect(notes).toHaveValue('');
      await notes.fill(`Second sitting ${tag}: the leaf opened fully.`);
      const saved = tomorrow.waitForResponse(r => /\/api\/(me\/)?(tasting|journal|notes)/.test(r.url()) && ['PUT', 'POST'].includes(r.request().method()), { timeout: 20_000 }).catch(() => null);
      await tomorrow.getByRole('button', { name: 'Save tasting' }).click();
      await saved;
      const share = tomorrow.getByRole('dialog', { name: 'Share this tasting' });
      if (await share.isVisible().catch(() => false)) {
        await share.getByRole('button', { name: /offer my photographs/ }).click();
        await share.getByRole('button', { name: 'Share', exact: true }).click();
        await expect(share.getByText(/On your page/)).toBeVisible({ timeout: 20_000 });
        await share.getByRole('button', { name: 'Close' }).click().catch(() => undefined);
      }
      await tomorrow.getByRole('button', { name: 'Open your impression' }).click().catch(() => undefined);
      await expect(earlier.getByText(`First sitting ${tag}`)).toBeVisible();
      await expect(notes).toHaveValue(/Second sitting/);
      const dates = await earlier.locator('time').allTextContents();
      seen.push(`Earlier notes dates: ${JSON.stringify(dates)}`);
      await earlier.scrollIntoViewIfNeeded();
      await tomorrow.screenshot({ path: shot(6, 'two-sittings-one-tasting') });
      // On the server: one journal entry for this tea, holding both sittings' words.
      await expect.poll(async () => {
        const db = await practiceDb();
        const rows = db.prepare('SELECT note, tastings FROM customer_tasting_journal WHERE user_id = ? AND product_id = ?').all(strangerEmail, teaId) as Array<{ note: string; tastings: string }>;
        db.close();
        const text = rows.map(r => `${r.note}${r.tastings}`).join('');
        return `${rows.length}|${text.includes(`First sitting ${tag}`)}|${text.includes(`Second sitting ${tag}`)}`;
      }, { timeout: 20_000 }).toBe('1|true|true');
      seen.push('server: one journal entry for the tea, holding both notes');
      await tomorrow.close();
      current = page;
    });

    await line(7, 'They save and share. Their page exists at its own address with the tasting, and no score anywhere on it', async (seen) => {
      seen.push(...shareSeen);
      const profile = await (await page.request.get('/api/me/public-profile', { headers: { Authorization: `Bearer ${strangerToken}` } })).json();
      slug = profile.contributor?.id ?? profile.contributor?.slug ?? '';
      seen.push(`page address /people/${slug}`);
      expect(slug).not.toBe('');
      const visitorPage = await visitor.newPage();
      current = visitorPage;
      visitorPage.on('pageerror', e => errors.push(`visitor: ${e.message}`));
      await visitorPage.goto(`/people/${slug}`);
      await expect(visitorPage.getByRole('heading', { name: strangerName })).toBeVisible({ timeout: 30_000 });
      const section = visitorPage.getByTestId('profile-tastings');
      await section.scrollIntoViewIfNeeded();
      const tasting = section.getByTestId('profile-tasting').filter({ hasText: teaName });
      await expect(tasting).toBeVisible();
      await expect(tasting.getByText(`First sitting ${tag}`)).toBeVisible();
      await expect(tasting.getByText(/Second sitting/)).toBeVisible();
      const body = await visitorPage.locator('body').innerText();
      expect(body).not.toMatch(/\b\d+ ?(\/|of|out of) ?10\b|\bLove\b|\bDislike\b|\bNeutral\b/);
      const json = await (await page.request.get(`/api/people/${slug}`)).text();
      expect(json).not.toMatch(/"rating"|"verdict"|"impression"|"score"/);
      seen.push('no rating, verdict or score in the page text or its data');
      expect(await noOverflow(visitorPage)).toBe(true);
      await visitorPage.screenshot({ path: shot(7, 'b-person-page-tasting'), fullPage: true });
      await visitorPage.close();
      current = page;
    });

    await line(8, 'They appear under "The family" on the people list', async (seen) => {
      const people = await visitor.newPage();
      current = people;
      await people.goto('/people');
      const family = people.getByTestId('people-family');
      const rowEl = family.getByTestId('family-row').filter({ hasText: tag });
      await expect(rowEl).toBeVisible({ timeout: 30_000 });
      seen.push(`family row: "${(await rowEl.innerText()).replace(/\s+/g, ' ').trim()}"`);
      await rowEl.scrollIntoViewIfNeeded();
      await people.screenshot({ path: shot(8, 'the-family-on-people') });
      await people.close();
      current = page;
    });

    await line(9, 'Back on the tea, they see their own thumbnails, make one their cover, and it shows on the plate for them only. Signed out, the plate is as it was', async (seen) => {
      await page.goto(teaPath);
      const row = page.getByTestId('tea-photographs');
      await expect(row).toBeVisible({ timeout: 30_000 });
      const count = await row.locator('li[data-mine="true"]').count();
      seen.push(`own photographs in the row under the plaque: ${count}`);
      expect(count).toBe(6);
      await expect(page.locator('.label-plate img')).toHaveCount(0);
      const second = await row.getByTestId('tea-photograph').nth(1).locator('img').getAttribute('src');
      await row.getByTestId('tea-photograph').nth(1).click();
      const zoom = page.getByTestId('photograph-zoom');
      await expect(zoom).toBeVisible();
      await page.screenshot({ path: shot(9, 'zoom-use-as-my-cover') });
      const tapped = page.waitForResponse(r => r.url().includes('/cover') && r.request().method() === 'PUT');
      await zoom.getByRole('button', { name: 'Use as my cover' }).click();
      expect((await tapped).status()).toBe(200);
      await expect(zoom.getByRole('button', { name: 'Stop using as my cover' })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(row.locator('li').first()).toHaveAttribute('data-cover', 'true');
      expect(await row.getByTestId('tea-photograph').first().locator('img').getAttribute('src')).toBe(second);
      seen.push('the chosen photograph is first in their row, and the plaque holds no picture');
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: shot(9, 'a-cover-for-me') });
      const visitorPage = await visitor.newPage();
      current = visitorPage;
      await visitorPage.goto(teaPath);
      await expect(visitorPage.locator('.label-plate')).toBeVisible({ timeout: 30_000 });
      await expect(visitorPage.locator('.label-plate img')).toHaveCount(0);
      await expect(visitorPage.locator('[data-cover="true"]')).toHaveCount(0);
      await expect(visitorPage.locator('[data-mine="true"]')).toHaveCount(0);
      seen.push('signed out: no picture in the plaque, nobody marked as cover or as their own');
      await visitorPage.screenshot({ path: shot(9, 'b-signed-out-plate') });
      await visitorPage.close();
      current = page;
    });

    await line(10, 'A second member who shared a photograph of the same tea appears in "From the family"', async (seen) => {
      const secondToken = await tokenFor(page, { identifier: second.email, password: PASSWORD });
      const up = await uploadPhotograph(page, secondToken, teaId, 260);
      expect(up.status).toBe(201);
      const shared = await page.request.put(`/api/family/photographs/${up.body.photograph.id}/share`, { headers: { Authorization: `Bearer ${secondToken}` }, data: { share_state: 'page' } });
      expect(shared.status()).toBe(200);
      const secondPage = (await shared.json()).page_id;
      const visitorPage = await visitor.newPage();
      current = visitorPage;
      const media: string[] = [];
      visitorPage.on('request', r => { if (r.url().includes('/api/media/')) media.push(r.url()); });
      await visitorPage.goto(teaPath);
      const strip = visitorPage.getByTestId('tea-photographs');
      await expect(strip).toBeVisible({ timeout: 30_000 });
      const theirs = strip.locator(`img[src*="${up.body.photograph.id}-small"]`);
      await expect(theirs).toHaveCount(1);
      await expect(visitorPage.getByText('Photograph by')).toHaveCount(0);
      await visitorPage.waitForLoadState('networkidle');
      expect(media.filter(u => u.includes('-full.'))).toEqual([]);
      const shapes = await strip.getByTestId('tea-photograph').evaluateAll(els => els.map(el => { const b = el.getBoundingClientRect(); return Math.round((b.width / b.height) * 100) / 100; }));
      for (const ratio of shapes) expect([1, 0.67, 1.5]).toContain(ratio);
      seen.push(`row photographs: ${shapes.length}, every one square, 2:3 or 3:2 (ratios ${[...new Set(shapes)].join(', ')}); no name on the page`);
      await theirs.click();
      const zoom = visitorPage.getByTestId('photograph-zoom');
      await expect(zoom.getByTestId('photograph-credit')).toContainText('Photograph by');
      await expect(zoom.getByRole('link', { name: second.name })).toHaveAttribute('href', `/people/${secondPage}`);
      seen.push(`in the zoom: "${(await zoom.getByTestId('photograph-credit').innerText()).trim()}" linking to /people/${secondPage}`);
      await visitorPage.screenshot({ path: shot(10, 'zoom-photograph-by') });
      await visitorPage.keyboard.press('Escape');
      // A shared photograph is public only while it is on show, so its plain address must not be cached for a year.
      const plain = localMedia(String(up.body.photograph.small_url)).split('?')[0];
      const cached = await visitor.request.get(plain);
      const cacheControl = cached.headers()['cache-control'] ?? '';
      seen.push(`the shared photograph at its plain address: ${cached.status()}, Cache-Control "${cacheControl}"`);
      expect(cached.status()).toBe(200);
      expect(cacheControl).not.toContain('immutable');
      expect(cacheControl).toMatch(/max-age=60\b/);
      expect(await noOverflow(visitorPage)).toBe(true);
      await visitorPage.evaluate(() => window.scrollTo(0, 0));
      await visitorPage.screenshot({ path: shot(10, 'row-under-the-plaque') });
      await visitorPage.close();
      current = page;
    });

    await line(11, 'The shop signs in. The offered photographs and all notes are in Guest notes. The daily sheet downloads', async (seen) => {
      current = ownerPage;
      await ownerPage.goto('/admin/tasting-notes');
      await expect(ownerPage.getByRole('heading', { name: 'Guest notes' })).toBeVisible({ timeout: 30_000 });
      const photos = ownerPage.getByRole('region', { name: 'Photographs offered' });
      for (const id of photoIds) await expect(photos.locator(`[data-photograph-id="${id}"]`)).toHaveCount(1, { timeout: 20_000 });
      seen.push(`all ${photoIds.length} offered photographs of the member are listed`);
      await photos.locator(`[data-photograph-id="${photoIds[0]}"]`).scrollIntoViewIfNeeded();
      await ownerPage.screenshot({ path: shot(11, 'a-offered-photographs') });
      const feedback = ownerPage.getByRole('region', { name: 'Feedback' });
      await feedback.getByRole('button', { name: 'Read every note with its rating' }).click();
      await expect(feedback.locator('li').filter({ hasText: `Second sitting ${tag}` }).first()).toBeVisible({ timeout: 20_000 });
      const rows = await feedback.locator('li').filter({ hasText: tag }).allInnerTexts();
      seen.push(`Feedback rows for this member: ${rows.length}: ${JSON.stringify(rows.map(r => r.replace(/\s+/g, ' ').trim().slice(0, 160)))}`);
      expect(rows.some(r => r.includes(`First sitting ${tag}`))).toBe(true);
      expect(rows.some(r => r.includes(`Second sitting ${tag}`))).toBe(true);
      await feedback.locator('li').filter({ hasText: `First sitting ${tag}` }).first().scrollIntoViewIfNeeded();
      await ownerPage.screenshot({ path: shot(11, 'b-feedback-notes') });
      await ownerPage.evaluate(() => window.scrollTo(0, 0));
      const [download] = await Promise.all([
        ownerPage.waitForEvent('download'),
        ownerPage.getByRole('button', { name: "Download today's sheet" }).click(),
      ]);
      const csv = readFileSync((await download.path())!, 'utf8');
      seen.push(`sheet ${download.suggestedFilename()}, ${csv.split(/\r?\n/).filter(Boolean).length} lines, holds today's note: ${csv.includes(`First sitting ${tag}`)}`);
      expect(csv).toContain(`First sitting ${tag}`);
      await ownerPage.screenshot({ path: shot(11, 'c-sheet-downloaded') });
    });

    await line(12, 'The shop makes one photograph the lead picture. Signed out, the tea shows it with "Photograph by" linking to the person. One tap restores the earlier state', async (seen) => {
      current = ownerPage;
      const photos = ownerPage.getByRole('region', { name: 'Photographs offered' });
      const leadRow = photos.locator(`[data-photograph-id="${photoIds[2]}"]`);
      await leadRow.getByRole('button', { name: 'Make lead picture' }).click();
      await expect(leadRow.getByText('Lead picture', { exact: true })).toBeVisible();
      const visitorPage = await visitor.newPage();
      current = visitorPage;
      await visitorPage.goto(teaPath);
      const leadRowItem = visitorPage.getByTestId('tea-photographs').locator('li').first();
      await expect(leadRowItem).toHaveAttribute('data-lead', 'true', { timeout: 30_000 });
      await expect(leadRowItem.locator('img')).toHaveAttribute('src', new RegExp(`${photoIds[2]}-small`));
      await expect(visitorPage.locator('.label-plate img')).toHaveCount(0);
      await visitorPage.evaluate(() => window.scrollTo(0, 0));
      await visitorPage.screenshot({ path: shot(12, 'a-shop-picture-first') });
      await leadRowItem.getByTestId('tea-photograph').click();
      const credit = visitorPage.getByTestId('photograph-credit');
      await expect(credit).toContainText('Photograph by');
      await expect(credit.getByRole('link', { name: strangerName })).toHaveAttribute('href', `/people/${slug}`);
      seen.push(`signed out: the shop's picture is first in the row; in the zoom "${(await credit.innerText()).trim()}" linking to /people/${slug}`);
      await visitorPage.screenshot({ path: shot(12, 'a2-zoom-with-credit') });
      await visitorPage.close();
      current = ownerPage;
      await leadRow.getByRole('button', { name: 'Restore earlier picture' }).click();
      await expect(leadRow.getByText('Lead picture', { exact: true })).toHaveCount(0);
      const fresh = await browser.newContext({ viewport: { width: 390, height: 844 } });
      contexts.push(fresh);
      const after = await fresh.newPage();
      current = after;
      await after.goto(teaPath);
      await expect(after.locator('.label-plate')).toBeVisible({ timeout: 30_000 });
      await expect(after.getByTestId('tea-photographs')).toBeVisible({ timeout: 30_000 });
      await expect(after.locator('[data-lead="true"]')).toHaveCount(0);
      seen.push('after one tap on Restore earlier picture, a new visitor sees no shop picture marked in the row');
      await after.screenshot({ path: shot(12, 'b-restored') });
      current = page;
    });

    await line(13, 'The member removes a photograph from their page. It is gone from their page and still available to the shop', async (seen) => {
      const gone = photoIds[3];
      await page.goto(teaPath);
      await openMyTasting(page);
      await page.getByRole('button', { name: 'Open your impression' }).click();
      const row = page.getByRole('group', { name: 'Your photographs' });
      const thumb = row.locator(`img[src*="${gone}"]`);
      await expect(thumb).toHaveCount(1, { timeout: 20_000 });
      await expect(row).not.toContainText('Remove from my page');
      await thumb.click();
      await page.screenshot({ path: shot(13, 'zoom-remove-from-my-page') });
      const removed = page.waitForResponse(r => r.url().includes(`/api/family/photographs/${gone}/remove`));
      await page.getByTestId('photograph-zoom').getByRole('button', { name: 'Remove from my page' }).click();
      expect((await removed).status()).toBe(200);
      await expect(row.locator('img')).toHaveCount(5);
      await page.screenshot({ path: shot(13, 'a-removed-in-the-tasting') });
      const pageJson = await (await page.request.get(`/api/people/${slug}`)).text();
      expect(pageJson).not.toContain(gone);
      seen.push('the photograph id is no longer in the public page data');
      current = ownerPage;
      await ownerPage.goto('/admin/tasting-notes');
      const shopRow = ownerPage.getByRole('region', { name: 'Photographs offered' }).locator(`[data-photograph-id="${gone}"]`);
      await expect(shopRow).toHaveCount(1, { timeout: 20_000 });
      await expect(shopRow.getByText('Off their page')).toBeVisible();
      const db = await practiceDb();
      const stored = db.prepare('SELECT full_key, small_key, share_state FROM member_photographs WHERE id = ?').get(gone) as Record<string, string> | undefined;
      db.close();
      seen.push(`stored row still there: ${JSON.stringify(stored ? { share_state: stored.share_state } : null)}`);
      expect(stored).toBeTruthy();
      // The file itself: gone from the public address, still readable by the shop through its own signed address.
      const publicFetch = await visitor.request.get(`/api/media/${stored!.small_key}`);
      const pile = await (await ownerPage.request.get('/api/admin/family/photographs', { headers: ownerHeaders })).json();
      const forShop = (pile.photographs as Array<{ id: string; small_url: string }>).find(p => p.id === gone);
      expect(forShop).toBeTruthy();
      const shopFetch = await ownerPage.request.get(localMedia(forShop!.small_url));
      seen.push(`removed file at its plain address: ${publicFetch.status()}; through the shop's signed address: ${shopFetch.status()}`);
      expect(publicFetch.status()).toBe(404);
      expect(shopFetch.status()).toBe(200);
      await shopRow.scrollIntoViewIfNeeded();
      await ownerPage.screenshot({ path: shot(13, 'b-still-with-the-shop') });
      current = page;
    });

    await line(14, 'A sold-out tea still shows on their page, marked, and "find me more" reaches the shop', async (seen) => {
      const db = await practiceDb();
      db.prepare(`UPDATE products SET status = 'Sold Out', stock_grams = 0 WHERE id = ?`).run(teaId);
      db.close();
      await page.goto(`/people/${slug}`);
      const tasting = page.getByTestId('profile-tasting').filter({ hasText: teaName });
      await expect(tasting).toBeVisible({ timeout: 30_000 });
      await expect(tasting.getByText('Gone from the shop.')).toBeVisible();
      const asked = page.waitForResponse(r => r.url().includes('/restock-request'));
      await tasting.getByTestId('find-me-more').click();
      expect((await asked).status()).toBe(201);
      await expect(tasting.getByText('Asked. Teajia will look.')).toBeVisible();
      await tasting.getByText('Gone from the shop.').evaluate(el => el.scrollIntoView({ block: 'center' }));
      await page.screenshot({ path: shot(14, 'a-gone-and-asked') });
      current = ownerPage;
      await ownerPage.goto('/admin/tasting-notes');
      const restock = ownerPage.getByRole('region', { name: 'Find me more' });
      await expect(restock.getByText(teaName)).toBeVisible({ timeout: 20_000 });
      seen.push(`owner's Find me more lists "${teaName}"`);
      await restock.scrollIntoViewIfNeeded();
      await ownerPage.screenshot({ path: shot(14, 'b-owner-sees-request') });
      current = page;
    });

    await line(15, 'The owner upgrades the person to tea creator and the word on their page changes', async (seen) => {
      current = ownerPage;
      await ownerPage.goto('/admin/contributors');
      await ownerPage.getByRole('button', { name: `Edit ${strangerName}` }).click();
      await ownerPage.getByTestId('row-behind').click();
      const wordBox = ownerPage.getByTestId('section-page-word');
      await expect(wordBox.getByLabel('Teajia family')).toBeChecked();
      const upgrade = ownerPage.waitForResponse(r => r.url().includes(`/api/admin/family/pages/${slug}/tier`));
      await wordBox.getByText('Tea creator', { exact: true }).click();
      expect((await upgrade).status()).toBe(200);
      const visitorPage = await visitor.newPage();
      current = visitorPage;
      await visitorPage.goto(`/people/${slug}`);
      await expect(visitorPage.getByText('Tea creator').first()).toBeVisible({ timeout: 30_000 });
      await expect(visitorPage.getByText('Teajia family')).toHaveCount(0);
      seen.push(`public word now ${(await (await page.request.get(`/api/people/${slug}`)).json()).role}`);
      await visitorPage.screenshot({ path: shot(15, 'tea-creator') });
      await visitorPage.close();
      // Back to family for the next line (the report line sits on family pages).
      current = ownerPage;
      const back = ownerPage.waitForResponse(r => r.url().includes(`/api/admin/family/pages/${slug}/tier`));
      await wordBox.getByText('Teajia family', { exact: true }).click();
      expect((await back).status()).toBe(200);
      current = page;
    });

    await line(16, 'A visitor reports a page. The owner hides it. It is gone from the list and from its address', async (seen) => {
      const visitorPage = await visitor.newPage();
      current = visitorPage;
      await visitorPage.goto(`/people/${slug}`);
      const report = visitorPage.getByTestId('report-page');
      await expect(report).toBeVisible({ timeout: 30_000 });
      const sent = visitorPage.waitForResponse(r => r.url().includes('/api/family/reports'));
      await report.getByRole('button', { name: 'Report this page' }).click();
      expect((await sent).status()).toBe(201);
      await expect(visitorPage.getByText('Thank you. Teajia has been told.')).toBeVisible();
      await visitorPage.screenshot({ path: shot(16, 'a-reported') });
      current = ownerPage;
      await ownerPage.goto('/admin/tasting-notes');
      const reports = ownerPage.getByRole('region', { name: 'Reports' });
      const item = reports.locator('li').filter({ hasText: strangerName });
      await expect(item).toBeVisible({ timeout: 20_000 });
      await reports.scrollIntoViewIfNeeded();
      await ownerPage.screenshot({ path: shot(16, 'b-owner-report') });
      await item.getByRole('button', { name: 'Hide it' }).click();
      await expect(item).toHaveCount(0);
      current = visitorPage;
      expect((await page.request.get(`/api/people/${slug}`)).status()).toBe(404);
      await visitorPage.goto(`/people/${slug}`);
      // Wait for the page to settle on its answer (not the loading mark), then look.
      const settled = visitorPage.getByRole('alert');
      await expect(settled).toBeVisible({ timeout: 30_000 });
      seen.push(`the address now says: "${(await settled.innerText()).trim()}"`);
      await expect(visitorPage.getByRole('heading', { name: strangerName })).toHaveCount(0);
      await visitorPage.screenshot({ path: shot(16, 'c-address-gone') });
      await visitorPage.goto('/people');
      await expect(visitorPage.getByTestId('people-directory')).toBeVisible({ timeout: 30_000 });
      await expect(visitorPage.getByText(strangerName)).toHaveCount(0);
      const listed = await (await page.request.get('/api/people')).json();
      expect(listed.contributors.map((c: { id: string }) => c.id)).not.toContain(slug);
      seen.push('after Hide it: /api/people/<slug> 404, not in /api/people, not on the people list');
      await visitorPage.screenshot({ path: shot(16, 'd-gone-from-list') });
      await visitorPage.close();
      // Unhide so line 17's grid check can read the page again.
      await ownerPage.request.post('/api/admin/family/unhide', { headers: ownerHeaders, data: { target_kind: 'page', target_id: slug } });
      current = page;
    });

    await line(17, 'A 12 MB picture is stored under 1 MB, grids request the small copy, and the stored file has no location data. Numbers printed', async (seen) => {
      expect(bigPhoto).not.toBeNull();
      const db = await practiceDb();
      const row = db.prepare('SELECT full_key, small_key, full_bytes, small_bytes, full_width, full_height, small_width, small_height FROM member_photographs WHERE id = ?').get(bigPhoto!.id) as Record<string, any>;
      db.close();
      seen.push(`original ${bigOriginalBytes} bytes (${(bigOriginalBytes / 1e6).toFixed(2)} MB) with GPS in it: ${bigOriginalHadGps}`);
      seen.push(`stored full ${row.full_width}x${row.full_height} ${row.full_bytes} bytes; small ${row.small_width}x${row.small_height} ${row.small_bytes} bytes`);
      expect(bigOriginalBytes).toBeGreaterThan(10_000_000);
      expect(bigOriginalHadGps).toBe(true);
      expect(row.full_bytes).toBeLessThan(1_000_000);
      // The stored bytes themselves, read back from the local media store (not the browser, whose media is stubbed).
      const full = Buffer.from(await (await page.request.get(localMedia(String(bigPhoto!.full_url)))).body());
      const small = Buffer.from(await (await page.request.get(localMedia(String(bigPhoto!.small_url)))).body());
      const fullData = locationData(full); const smallData = locationData(small);
      seen.push(`read back: full ${full.length} bytes exif=${fullData.exif} gps=${fullData.gps}; small ${small.length} bytes exif=${smallData.exif} gps=${smallData.gps}`);
      expect(full.length).toBe(row.full_bytes);
      expect(full[0]).toBe(0xff); expect(full[1]).toBe(0xd8);
      expect(fullData.gps).toBe(false);
      expect(smallData.gps).toBe(false);
      // Grids ask for the small copy: the person page and the tea page.
      const visitorPage = await visitor.newPage();
      current = visitorPage;
      const media: string[] = [];
      visitorPage.on('request', r => { if (r.url().includes('/api/media/')) media.push(new URL(r.url()).pathname); });
      await visitorPage.goto(`/people/${slug}`);
      await expect(visitorPage.getByTestId('tasting-photographs').first()).toBeVisible({ timeout: 30_000 });
      await visitorPage.getByTestId('tasting-photographs').first().scrollIntoViewIfNeeded();
      await visitorPage.waitForLoadState('networkidle');
      const family = media.filter(u => u.includes('family'));
      seen.push(`person page media requests: ${family.length}, of which full copies: ${family.filter(u => u.includes('-full')).length}`);
      expect(family.length).toBeGreaterThan(0);
      expect(family.filter(u => u.includes('-full'))).toEqual([]);
      await visitorPage.screenshot({ path: shot(17, 'small-copies-in-the-grid') });
      await visitorPage.close();
      current = page;
    });

    await line(18, 'The owner opens a sourcing tasting. The same camera and photograph row are there', async (seen) => {
      const db = await practiceDb();
      db.prepare(`UPDATE products SET status = 'Active', stock_grams = 250 WHERE id = ?`).run(teaId);
      db.close();
      current = ownerPage;
      await ownerPage.goto(teaPath);
      await expect(ownerPage.getByText(teaName).first()).toBeVisible({ timeout: 30_000 });
      await ownerPage.getByRole('button', { name: /Add your tasting|Note/ }).first().click();
      await expect(ownerPage.locator('.tasting-header-controls')).toBeVisible({ timeout: 20_000 });
      const mic = ownerPage.getByRole('button', { name: 'Record into your notes' });
      const camera = ownerPage.getByRole('button', { name: 'Add a photograph' });
      await expect(mic).toBeVisible();
      await expect(camera).toBeVisible();
      const m = (await mic.boundingBox())!; const c = (await camera.boundingBox())!;
      seen.push(`owner's tasting header: microphone at x=${Math.round(m.x)}, camera at x=${Math.round(c.x)}, same row: ${Math.abs(m.y - c.y) < 2}`);
      expect(Math.abs(m.y - c.y)).toBeLessThan(2);
      await ownerPage.getByRole('button', { name: 'Open your impression' }).click();
      const row = ownerPage.getByRole('group', { name: 'Your photographs' });
      await expect(row).toBeVisible();
      const notesLabel = ownerPage.getByText(/^(Your notes|Notes for the host|Personal notes)$/).first();
      expect((await row.boundingBox())!.y).toBeLessThan((await notesLabel.boundingBox())!.y);
      // It works there too: one photograph from the owner's tasting.
      const up = ownerPage.waitForResponse(r => r.url().includes('/api/family/photographs') && r.request().method() === 'POST');
      await ownerPage.getByTestId('tasting-photo-input').setInputFiles({ name: 'owner.jpg', mimeType: 'image/jpeg', buffer: await jpeg(ownerPage, 1200, 900) });
      const status = (await up).status();
      seen.push(`an owner photograph from the sourcing tasting: ${status}`);
      expect(status).toBe(201);
      await expect(row.locator('img')).toHaveCount(1);
      await ownerPage.screenshot({ path: shot(18, 'owner-sourcing-tasting') });
      current = page;
    });

    // Line 19 is commands, not a browser step: recorded here as not checked by the walk.
    results[19] = {
      title: 'npm run lint, lint:colors, lint:worker-types, the unit suites and npm run test:mobile pass, with output saved',
      pass: false,
      seen: ['not a browser step; the commands are run beside the walk and their output saved as 19-*.txt in this folder'],
    };
    if (errors.length) results[0] = { title: 'page errors during the walk', pass: false, seen: errors };
  } finally {
    writeFileSync(`${SHOTS}/results.json`, JSON.stringify(results, null, 2));
    for (const context of contexts) await context.close().catch(() => undefined);
    const db = await practiceDb();
    const users = [{ id: strangerId, email: strangerEmail }, { id: second.userId, email: second.email }];
    const ownerPhotos = (db.prepare('SELECT id FROM member_photographs WHERE product_id = ?').all(teaId) as Array<{ id: string }>).map(r => r.id);
    for (const id of ownerPhotos) {
      db.prepare(`DELETE FROM family_hides WHERE target_kind = 'photograph' AND target_id = ?`).run(id);
      db.prepare('DELETE FROM family_reports WHERE target_id = ?').run(id);
    }
    db.prepare('DELETE FROM member_tea_covers WHERE product_id = ?').run(teaId);
    db.prepare('DELETE FROM member_photographs WHERE product_id = ?').run(teaId);
    db.prepare('DELETE FROM restock_requests WHERE product_id = ?').run(teaId);
    for (const user of users) {
      if (!user.id) continue;
      const ids = (db.prepare('SELECT id FROM contributors WHERE user_id = ?').all(user.id) as Array<{ id: string }>).map(r => r.id);
      for (const id of ids) {
        db.prepare(`DELETE FROM family_hides WHERE target_kind = 'page' AND target_id = ?`).run(id);
        db.prepare('DELETE FROM family_reports WHERE target_id = ?').run(id);
        db.prepare('DELETE FROM contributor_profile_drafts WHERE contributor_id = ?').run(id);
        db.prepare('DELETE FROM contributor_accounts WHERE contributor_id = ?').run(id);
        db.prepare('DELETE FROM contributors WHERE id = ?').run(id);
      }
      const journal = (db.prepare('SELECT id FROM customer_tasting_journal WHERE user_id = ?').all(user.email) as Array<{ id: string }>).map(r => r.id);
      for (const id of journal) db.prepare(`DELETE FROM family_hides WHERE target_kind = 'tasting' AND target_id = ?`).run(id);
      db.prepare('DELETE FROM member_tasting_shares WHERE author_user_id = ?').run(user.id);
      db.prepare('DELETE FROM restock_requests WHERE requester_user_id = ?').run(user.id);
      db.prepare('DELETE FROM customer_tasting_journal WHERE user_id = ?').run(user.email);
      db.prepare('DELETE FROM identity_email_verifications WHERE user_id = ?').run(user.id);
      db.prepare('DELETE FROM users WHERE id = ?').run(user.id);
    }
    db.prepare('DELETE FROM customer_tasting_journal WHERE product_id = ?').run(teaId);
    try { db.prepare('DELETE FROM tasting_note_candidates WHERE product_id = ?').run(teaId); } catch { /* no such column in this schema */ }
    db.prepare('DELETE FROM products WHERE id = ?').run(teaId);
    db.close();
  }

  const failed = Object.entries(results).filter(([, r]) => !r.pass && r.title !== results[19]?.title).map(([n, r]) => `${n}: ${r.error ?? r.seen.join('; ')}`);
  expect(failed, 'every browser line of the checklist passes').toEqual([]);
});
