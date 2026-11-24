import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

const credential = '6'.repeat(64);
const firstPhoto = '9dc818e0-c31e-44c5-94ec-c8014694fc1d';
const secondPhoto = '25c7cb2c-ba58-49f6-9aab-9edd5c3c4d76';
const entryKey = 'a-scoped-guest-key';
const image = 'public/read/porcelain-and-tea/teapot-on-gold-dish.jpg';
const note = 'The cups warmed our hands as the rain passed.';
const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
const token = [encode({ alg: 'HS256', typ: 'JWT' }), encode({
  sub: 'photo-guest', email: 'photo-guest@example.test', role: 'user', memberships: [],
  active_account_id: null, exp: Math.floor(Date.now() / 1000) + 3600,
}), 'signature'].join('.');

type Status = 'pending' | 'included';
type Grant = { id: string; photoId: string; status: Status };
type EntryDraft = { note?: string; photo?: { photoId: string; grantId: string } };
type Fixture = {
  note: { value: string; status: Status } | null;
  grants: Grant[];
  submissions: EntryDraft[];
  failNextSave?: boolean;
};

async function openGuestBook(page: Page, state: Fixture) {
  await page.addInitScript(jwt => localStorage.setItem('teajia_token', jwt), token);
  await page.route('**/api/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === '/api/after-sit/recap') {
      return route.fulfill({ json: {
        event: { id: 'formal-sit', title: 'Porcelain and tea', event_date: '2026-11-23' },
        host_note: null,
        teas: [{ id: 'exact-tea', name: 'Wuyi rock tea' }],
      } });
    }
    if (url.pathname === '/api/after-sit/setup') return route.fulfill({ json: { saved: true, can_add_photos: true } });
    if (url.pathname.endsWith('/personal-kept-setups/formal-sit/photos')) {
      return route.fulfill({ json: { photos: [firstPhoto, secondPhoto].map(id => ({
        id, tea_id: 'exact-tea', created_at: '2026-11-23',
      })) } });
    }
    if (url.pathname === '/api/after-sit/guest-book') {
      const { action, credential: sentCredential, ...body } = request.postDataJSON();
      expect(url.href).not.toContain(credential);
      expect(request.method()).toBe('POST');
      expect(sentCredential).toBe(credential);
      expect(request.headers().authorization).toBe(`Bearer ${token}`);
      if (action === 'read') {
        const entry = state.note && { id: 'written', note: state.note.value, display_name: 'Tea Guest', entry_key: entryKey };
        return route.fulfill({ json: {
          entries: entry && state.note?.status === 'included' ? [entry] : [],
          own: entry && { ...entry, status: state.note?.status },
        } });
      }
      if (action === 'photos-read') return route.fulfill({ json: {
        gallery: state.grants.filter(grant => grant.status === 'included').map(grant => ({
          id: grant.id, display_name: 'Tea Guest', alt_text: 'Photo of Wuyi rock tea', entry_key: entryKey,
        })),
        own: [firstPhoto, secondPhoto].map(id => {
          const grant = state.grants.find(item => item.photoId === id);
          return { id, tea_name: 'Wuyi rock tea', created_at: '2026-11-23', grant_id: grant?.id ?? null,
            status: grant?.status ?? null, alt_text: grant ? 'Photo of Wuyi rock tea' : null };
        }),
      } });
      if (action === 'private-photo-preview' || action === 'photo-bytes') {
        return route.fulfill({ path: image, contentType: 'image/jpeg' });
      }
      if (action === 'entry-save') {
        state.submissions.push(body);
        if (state.failNextSave) {
          state.failNextSave = false;
          return route.fulfill({ status: 422, json: { error: 'Synthetic send failure' } });
        }
        if (body.note) state.note = { value: body.note, status: 'pending' };
        if (body.photo) state.grants.push({ id: body.photo.grantId, photoId: body.photo.photoId, status: 'pending' });
        return route.fulfill({ json: { success: true } });
      }
      if (action === 'entry-withdraw') {
        state.note = null;
        state.grants = [];
        return route.fulfill({ json: { success: true } });
      }
      if (action === 'withdraw') {
        state.note = null;
        return route.fulfill({ json: { success: true } });
      }
      if (action === 'photo-withdraw') {
        state.grants = state.grants.filter(grant => grant.id !== body.grantId);
        return route.fulfill({ json: { success: true } });
      }
    }
    return route.fulfill({ json: [] });
  });

  await page.goto(`/after-sit#${credential}`);
  await expect(page).toHaveURL(/\/after-sit$/);
}

test('Guest Book submits one consented entry, retries it in place, and withdraws its note and photo', async ({ page }) => {
  const state: Fixture = { note: null, grants: [], submissions: [], failNextSave: true };
  await openGuestBook(page, state);
  const book = page.getByRole('region', { name: 'Guest Book', exact: true });
  const entry = book.getByRole('region', { name: 'Your Guest Book entry' });
  const submit = entry.getByRole('button', { name: 'Send for review' });

  await entry.getByLabel('Note (optional)').fill(note);
  await entry.getByLabel('Saved photo (optional)').selectOption(firstPhoto);
  await expect(entry.getByRole('button', { name: 'Open Your selected private photo' })).toBeVisible();
  await expect(submit).toBeDisabled();
  const consent = entry.getByRole('checkbox', { name: /I have permission to share this photo/ });
  await consent.check();
  await submit.click();
  await expect(entry.getByRole('alert')).toContainText('Could not send your entry');
  await expect(entry.getByLabel('Note (optional)')).toHaveValue(note);
  await expect(consent).toBeChecked();
  await submit.click();
  await expect(entry.getByText('Pending host review', { exact: true })).toBeVisible();
  await expect(book.getByRole('list', { name: 'Entries from session guests' })).toHaveCount(0);
  expect(state.submissions).toHaveLength(2);
  expect(state.submissions[0]).toEqual({ note, photo: { photoId: firstPhoto, grantId: expect.any(String) } });
  expect(state.submissions[1]).toEqual(state.submissions[0]);

  await entry.getByRole('button', { name: 'Edit entry' }).click();
  await expect(entry.getByLabel('Saved photo (optional)')).toHaveCount(0);
  await entry.getByRole('textbox', { name: 'Note', exact: true }).fill(note + ' Thank you.');
  await entry.getByRole('checkbox').check();
  await submit.click();
  await expect(entry.getByRole('button', { name: 'Edit entry' })).toBeVisible();
  expect(state.submissions[2]).toEqual({ note: note + ' Thank you.' });
  expect(state.grants).toHaveLength(1);

  if (!state.note) throw new Error('Expected the note');
  state.note.status = 'included';
  state.grants[0].status = 'included';
  await page.reload();
  await expect(page.getByText('Open the personal link from your host.', { exact: false })).toBeVisible();
  await page.goto(`/after-sit#${credential}`);
  const published = book.getByRole('list', { name: 'Entries from session guests' }).getByRole('listitem');
  await expect(published).toHaveCount(1);
  await expect(published).toContainText(note);
  await expect(published.getByRole('button', { name: 'Open Photo by Tea Guest' })).toBeVisible();
  if (process.env.GUEST_BOOK_SCREENSHOT) {
    await book.evaluate(node => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await book.screenshot({ path: process.env.GUEST_BOOK_SCREENSHOT });
  }
  await entry.getByRole('button', { name: 'Withdraw entry' }).click();
  await expect(entry.getByText('Entry withdrawn.')).toBeVisible();
  await expect(published).toHaveCount(0);
  expect(state.note).toBeNull();
  expect(state.grants).toHaveLength(0);
});

test('Guest Book keeps previously offered photos in one entry with individual withdrawal', async ({ page }) => {
  const state: Fixture = { note: { value: note, status: 'included' }, submissions: [], grants: [
    { id: 'first', photoId: firstPhoto, status: 'included' },
    { id: 'second', photoId: secondPhoto, status: 'included' },
  ] };
  await openGuestBook(page, state);
  const entry = page.getByRole('region', { name: 'Your Guest Book entry' });
  const published = page.getByRole('list', { name: 'Entries from session guests' }).getByRole('listitem');
  await expect(published).toHaveCount(1);
  await expect(published.getByRole('button', { name: 'Open Photo by Tea Guest' })).toHaveCount(2);
  await entry.getByRole('button', { name: 'Withdraw photo' }).first().click();
  await expect(published.getByRole('button', { name: 'Open Photo by Tea Guest' })).toHaveCount(1);
  await expect(published).toContainText(note);
  await expect(entry.getByRole('button', { name: 'Withdraw entry' })).toBeVisible();
  await entry.getByRole('button', { name: 'Edit entry' }).click();
  await expect(entry.getByRole('button', { name: 'Withdraw photo' })).toBeVisible();
  await entry.getByRole('button', { name: 'Withdraw note' }).click();
  await expect(entry.getByText('Note withdrawn.')).toBeVisible();
  await expect(published.getByRole('button', { name: 'Open Photo by Tea Guest' })).toHaveCount(1);
  await expect(published).not.toContainText(note);
});
