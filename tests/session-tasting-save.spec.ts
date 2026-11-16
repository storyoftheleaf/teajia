import { expect, test } from './fixtures';
import { expectNoUnhandledCompassApi, installCompassHarness } from './helpers/compassHarness';

test('a structured tasting restores its session record and retries a failed rating save', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installCompassHarness(page);
  const session = { id: 'session-1', title: 'Oolong flight', status: 'active', created_by_user_id: 'host', account_id: 'acct-bali' };
  const tea = { id: 'tea-1', product_id: 'test-tea', tea_name: 'Charcoal oolong', position: 0, tea_metadata: {} };
  let tasting = { quality: 6, impression: 'like' };
  await page.route('**/api/sessions/session-1', route => route.fulfill({ json: {
    session, teas: [tea], members: [], my_verdicts: [{
      session_tea_id: tea.id, verdict: tasting.impression, tasting_data: JSON.stringify(tasting),
    }],
  } }));
  let writes = 0;
  await page.route('**/api/sessions/session-1/teas/tea-1/verdict', async route => {
    writes += 1;
    if (writes === 1) return route.fulfill({ status: 503, json: { error: 'Unavailable' } });
    tasting = route.request().postDataJSON().tasting_data;
    return route.fulfill({ json: { success: true } });
  });

  await page.goto('/session/session-1');
  const teaButton = page.getByRole('button', { name: /Charcoal oolong/ });
  await teaButton.click();
  await expect(page.getByText('This tasting will be saved separately for this session.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Rate 6 out of 10', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Rate 8 out of 10', exact: true }).click();
  const save = page.getByRole('button', { name: 'Save tasting', exact: true });
  await save.click();
  await expect(page.getByText('Could not save. Your edits are still here. Try Save again.')).toBeVisible();
  await save.click();
  await expect(page.getByRole('button', { name: 'Tasting saved', exact: true })).toBeVisible();

  await page.getByRole('navigation', { name: 'Tasting sections' }).getByRole('button', { name: 'Leave tasting', exact: true }).click();
  await teaButton.click();
  await expect(page.getByRole('button', { name: 'Rate 8 out of 10', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(writes).toBe(2);
  await expectNoUnhandledCompassApi(page);
});

test('ordinary sessions offer notes only after completion, without requiring a rating', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installCompassHarness(page);
  let completed = false;
  await page.route('**/api/rsvp/post-session-check', route => route.fulfill({ json: {
    event: {
      id: 'ordinary-event', slug: 'ordinary-event', title: 'Evening tea',
      status: completed ? 'completed' : 'active',
      lifecycle_status: completed ? 'completed' : 'published',
      event_date: completed ? '2099-11-01T13:00:00Z' : '2020-11-01T13:00:00Z',
    },
    attendee: { id: 'attendee', full_name: 'Guest', status: 'confirmed', attended: 1 },
    tea_menu: [{ id: 'tea-menu-1', event_id: 'ordinary-event', product_name: 'Charcoal oolong' }],
  } }));
  await page.route('**/api/rsvp/post-session-check/post-session', route => route.fulfill({ status: 404, json: { error: 'Not published yet' } }));
  let savedNotes: unknown;
  await page.route('**/api/rsvp/post-session-check/tasting-notes', async route => {
    savedNotes = route.request().postDataJSON();
    return route.fulfill({ json: { success: true } });
  });

  await page.goto('/m/post-session-check');
  await expect(page.getByText('Your seat is confirmed', { exact: true })).toBeVisible();
  const impression = page.getByRole('textbox', { name: 'Note to share with host (optional)' });
  await expect(impression).toBeHidden();

  completed = true;
  await page.reload();
  await impression.fill('Peach and a dry finish.');
  await page.getByRole('button', { name: 'Save tasting' }).click();
  await expect(page.getByRole('heading', { name: 'Tasting saved', exact: true })).toBeVisible();
  expect(savedNotes).toEqual({ notes: [{ tea_menu_id: 'tea-menu-1', impression: 'Peach and a dry finish.', is_favorite: false }] });
  await expectNoUnhandledCompassApi(page);
});


test('quick and full tasting share the same impression, wheel and journal record', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installCompassHarness(page);
  let attended = 0;
  await page.route('**/api/rsvp/quick-full', route => route.fulfill({ json: {
    event: { id: 'event-quick-full', slug: 'evening', title: 'Evening Tea', status: 'completed',
      lifecycle_status: 'completed', event_date: '2020-11-01T13:00:00Z' },
    attendee: { id: 'attendee', full_name: 'Guest', status: 'confirmed', attended },
    tea_menu: [{ id: 'menu-tea', event_id: 'event-quick-full', product_id: 'test-tea', product_name: 'Charcoal oolong' }],
  } }));
  await page.route('**/api/rsvp/quick-full/post-session', route => route.fulfill({ status: 404, json: { error: 'Not published yet' } }));
  const legacy = { aromaRating: 8, finishRating: 10, notes: [{
    id: 'personal-aroma-draft', section: 'aroma', text: 'Orchid on the hot lid.',
  }] };
  const createdAt = '2020-11-01T14:00:00Z';
  let syncedEntries: Array<{ id: string; tastings: string; [key: string]: unknown }> = [{
    id: 'previous-entry', product_id: 'test-tea', product_name: 'Charcoal oolong', account_id: 'acct-bali',
    created_at: createdAt, note: JSON.stringify({ tasting: legacy, updatedAt: createdAt }),
    tastings: JSON.stringify([{
      id: 'event-tasting:event-quick-full:menu-tea', createdAt, sourceType: 'event', eventId: 'event-quick-full', tasting: legacy,
    }]),
  }];
  let collection: string[] = [];
  await page.route('**/api/user/favorites', route => {
    if (route.request().method() === 'PUT') {
      collection = route.request().postDataJSON().favorites;
      return route.fulfill({ json: { ok: true } });
    }
    return route.fulfill({ json: { favorites: collection } });
  });
  await page.route('**/api/tasting-journal', route => route.fulfill({ json: { entries: syncedEntries } }));
  await page.route('**/api/tasting-journal/sync', route => {
    syncedEntries = route.request().postDataJSON().entries;
    return route.fulfill({ json: { syncedIds: syncedEntries.map(entry => entry.id) } });
  });
  const sharedNotes: unknown[] = [];
  await page.route('**/api/rsvp/quick-full/tasting-notes', route => {
    sharedNotes.push(route.request().postDataJSON());
    return route.fulfill({ json: { success: true } });
  });
  const quick = page.getByRole('region', { name: 'Post-session tasting' });
  const inRow = (name: string, value: number) =>
    page.getByRole('group', { name, exact: true }).getByRole('button', { name: `Rate ${value} out of 10`, exact: true });
  const savedRecords = () => page.evaluate(() => {
    const stored = JSON.parse(localStorage.getItem('teajia-storage') ?? '{}');
    return stored.state.tastingJournal.find(entry => entry.productId === 'test-tea')?.tastings ?? [];
  });

  await page.goto('/m/quick-full');
  await expect(page.getByRole('heading', { name: 'Session Complete', exact: true })).toBeVisible();
  await expect(quick).toHaveCount(0);

  attended = 1;
  await page.reload();
  await expect.poll(() => savedRecords()).toHaveLength(1);
  await expect(quick.getByRole('group', { name: 'Aroma', exact: true })).toHaveCount(0);
  await expect(quick.getByRole('group', { name: 'Finish', exact: true })).toHaveCount(0);
  await expect(quick.getByRole('button', { name: 'Favorite tea', exact: true })).toHaveCount(0);
  await expect(quick.getByRole('button', { name: 'Taste wheel', exact: true })).toHaveCount(1);
  await quick.getByRole('button', { name: 'Like', exact: true }).click();
  await quick.getByRole('button', { name: 'Want to purchase this', exact: true }).click();
  await quick.getByRole('button', { name: 'Add to my collection', exact: true }).click();
  await inRow('Overall', 9).click();
  await quick.getByRole('textbox').fill('Peach and roasted almond.');
  await quick.getByRole('button', { name: 'Save tasting' }).click();
  await expect(page.getByRole('heading', { name: 'Tasting saved' })).toBeVisible();
  const [first] = await savedRecords();
  expect(first.tasting).toMatchObject({ ...legacy, quality: 9, impression: 'like', wantToPurchase: true, inCollection: true });
  await expect.poll(() => collection).toEqual(['test-tea']);

  await page.reload();
  await expect(inRow('Overall', 9)).toHaveAttribute('aria-pressed', 'true');
  await expect(quick.getByRole('button', { name: 'Like', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(quick.getByRole('button', { name: 'Want to purchase this', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(quick.getByRole('button', { name: 'In my collection', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(quick.getByRole('textbox')).toHaveValue('Peach and roasted almond.');
  await quick.getByRole('button', { name: 'Love', exact: true }).click();
  await inRow('Overall', 7).click();
  await quick.getByRole('button', { name: 'Taste wheel', exact: true }).click();

  const tools = page.getByRole('navigation', { name: 'Session tasting tools' });
  const choose = (name: string) => tools.getByRole('button', { name, exact: true });
  const wheel = page.getByRole('region', { name: 'Taste and aroma wheel' });
  await expect(choose('Taste wheel')).toHaveAttribute('aria-pressed', 'true');
  await wheel.getByRole('button', { name: 'Explore Floral', exact: true }).press('Enter');
  await wheel.getByRole('button', { name: 'Rose · Taste', exact: true }).press('Enter');
  await wheel.getByRole('button', { name: 'Rose · Aroma', exact: true }).press('Enter');
  await expect(choose('Aroma notes')).toHaveCount(0);
  await choose('Ratings & notes').click();
  await expect(inRow('Overall', 7)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Love', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'In my collection', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('region', { name: 'Quick tasting note for the host' })).toContainText('Peach and roasted almond.');
  await expect(page.getByRole('region', { name: 'Earlier notes' })).toContainText('Orchid on the hot lid.');
  await page.getByRole('textbox', { name: 'Personal notes' }).fill('The dry finish lingered.');
  await page.getByRole('button', { name: 'Save notes' }).click();
  await expect(page.getByRole('button', { name: 'Tasting saved' })).toBeVisible();
  const records = await savedRecords();
  expect(records).toHaveLength(1);
  expect(records[0]).toMatchObject({
    id: first.id, createdAt: first.createdAt, sourceType: 'event', eventId: 'event-quick-full',
    sessionSharedNote: 'Peach and roasted almond.',
    tasting: { quality: 7, impression: 'love', wantToPurchase: true, inCollection: true, aromaRating: 8, finishRating: 10,
      flavor: ['rose'], aroma: ['rose'], notes: [legacy.notes[0], { text: 'The dry finish lingered.' }] },
  });
  expect(sharedNotes).toEqual([
    { notes: [{ tea_menu_id: 'menu-tea', impression: 'Peach and roasted almond.', is_favorite: false }] },
  ]);

  await expect.poll(() => JSON.stringify(syncedEntries)).toContain('The dry finish lingered.');
  await page.reload();
  await expect(inRow('Overall', 7)).toHaveAttribute('aria-pressed', 'true');
  await quick.getByRole('button', { name: 'Taste wheel', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Show Rose Aroma on wheel' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Show Rose Taste on wheel' })).toBeVisible();

  await page.getByRole('button', { name: 'Back to quick tasting', exact: true }).click();
  await quick.getByRole('textbox').fill('');
  await inRow('Overall', 7).click();
  await quick.getByRole('button', { name: 'Love', exact: true }).click();
  await quick.getByRole('button', { name: 'Want to purchase this', exact: true }).click();
  await quick.getByRole('button', { name: 'In my collection', exact: true }).click();
  await quick.getByRole('button', { name: 'Save tasting' }).click();
  await expect(page.getByRole('heading', { name: 'Tasting saved' })).toBeVisible();
  const [cleared] = await savedRecords();
  expect(cleared.id).toBe(first.id);
  expect(cleared.tasting).not.toHaveProperty('quality');
  expect(cleared.tasting).not.toHaveProperty('impression');
  expect(cleared.tasting).toMatchObject({ wantToPurchase: false, inCollection: false, aromaRating: 8, finishRating: 10,
    notes: [legacy.notes[0], { text: 'The dry finish lingered.' }] });
  await expect.poll(() => collection).toEqual([]);
  expect(sharedNotes).toEqual([
    { notes: [{ tea_menu_id: 'menu-tea', impression: 'Peach and roasted almond.', is_favorite: false }] },
    { notes: [{ tea_menu_id: 'menu-tea', is_favorite: false }] },
  ]);
  await expectNoUnhandledCompassApi(page);
});
