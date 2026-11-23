import { expect, test } from './fixtures';
import { expectNoUnhandledCompassApi, installCompassHarness } from './helpers/compassHarness';

test('a structured tasting restores its session record and retries a failed rating save', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installCompassHarness(page);
  const session = { id: 'session-1', title: 'Oolong flight', status: 'active', created_by_user_id: 'host', account_id: 'acct-bali' };
  const tea = { id: 'tea-1', product_id: 'test-tea', tea_name: 'Charcoal oolong', position: 0, tea_metadata: {} };
  let tasting = { quality: 6, impression: 'like' };
  await page.route('**/api/sessions/session-1', route => route.fulfill({ json: {
    session, teas: [tea, { ...tea, id: 'tea-2', product_id: 'other-tea', tea_name: 'White tea', position: 1 }], members: [], my_verdicts: [{
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
  const browse = page.getByRole('navigation', { name: 'Browse tastings' });
  await browse.getByRole('button', { name: 'Next tea' }).click();
  await expect(browse.getByText('Tea 2 of 2')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open your impression' })).toContainText('White tea');
  await browse.getByRole('button', { name: 'Previous tea' }).click();
  await expect(page.getByRole('button', { name: 'Rate 8 out of 10', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(writes).toBe(2);
  await expectNoUnhandledCompassApi(page);
});

test('a signed-out guest can save one sentence for the exact tea and return to it', async ({ page }, testInfo) => {
  if (testInfo.project.use.isMobile) await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/**', route => route.fulfill({ json: {} }));
  await page.route('**/api/rsvp/naka-after-session', route => route.fulfill({ json: {
    event: { id: 'naka-event', slug: 'naka-evening', title: 'Evening tea', event_date: '2026-11-20T12:00:00Z', lifecycle_status: 'completed' },
    attendee: { id: 'attendee', full_name: 'Guest', status: 'confirmed', attended: 1 },
    tea_menu: [
      { id: 'naka-first', event_id: 'naka-event', product_id: 'naka-lot-a', product_name: 'Naka Gushu', brew_order: 1 },
      { id: 'naka-second', event_id: 'naka-event', product_id: 'naka-lot-b', product_name: 'Naka Gushu', brew_order: 2 },
    ],
  } }));
  await page.route('**/api/rsvp/naka-after-session/post-session', route => route.fulfill({ status: 404, json: {} }));
  const writes: string[] = [];
  await page.route(/\/api\/(?:rsvp\/naka-after-session\/tasting-notes|tasting-journal\/sync)$/, route => {
    writes.push(route.request().url());
    return route.fulfill({ json: { success: true } });
  });

  await page.goto('/m/naka-after-session');
  const quick = page.getByRole('region', { name: 'Post-session tasting' });
  const note = quick.getByRole('textbox', { name: 'Your experience with this tea' });
  const save = quick.getByRole('button', { name: 'Save for me' });
  await expect(quick.getByRole('heading', { name: 'Naka Gushu' })).toBeVisible();
  await expect(save).toBeDisabled();
  await note.fill('   ');
  await expect(save).toBeDisabled();
  await note.fill('I felt alert after the first tea.');
  await quick.getByRole('button', { name: 'Next tea' }).click();
  await expect(quick.getByText('Tea 2 of 2')).toBeVisible();
  await note.fill('I felt more settled after the second cup.');
  await expect(save).toBeInViewport();
  await expect(quick.getByRole('group', { name: 'Overall' })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('naka-one-sentence.png'), scale: 'css' });
  await save.click();
  await expect(page.getByText('Saved on this device', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'View journal' })).toHaveAttribute('href', /tea=naka-lot-b/);
  await page.screenshot({ path: testInfo.outputPath('naka-saved.png'), scale: 'css' });
  await page.getByRole('link', { name: 'View journal' }).click();
  await expect(page.getByText('I felt more settled after the second cup.').first()).toBeVisible();
  await page.reload();
  await expect(page.getByText('I felt more settled after the second cup.').first()).toBeVisible();
  expect(writes).toEqual([]);

  await page.goto('/m/naka-after-session');
  await expect(note).toHaveValue('I felt alert after the first tea.');
  await quick.getByRole('button', { name: 'Next tea' }).click();
  await expect(note).toHaveValue('I felt more settled after the second cup.');
  await quick.getByRole('button', { name: 'Full tasting' }).click();
  await quick.getByRole('button', { name: 'Taste wheel' }).click();
  const browse = page.getByRole('navigation', { name: 'Browse tastings' });
  await browse.getByRole('button', { name: 'Previous tea' }).click();
  await expect(browse.getByText('Tea 1 of 2')).toBeVisible();
  await page.getByRole('button', { name: 'Ratings & notes' }).click();
  await expect(page.getByRole('textbox', { name: 'Personal notes' })).toHaveValue('I felt alert after the first tea.');
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
  await page.route('**/api/rsvp/post-session-check/reflection', route => route.fulfill({
    status: 404, json: { error: 'No reflection' },
  }));
  let savedNotes: unknown;
  const syncedNotes: string[] = [];
  await page.route('**/api/tasting-journal/sync', route => {
    syncedNotes.push(route.request().postDataJSON().entries[0].note);
    return route.fulfill({ json: { synced: 1 } });
  });
  await page.route('**/api/rsvp/post-session-check/tasting-notes', async route => {
    savedNotes = route.request().postDataJSON();
    return route.fulfill({ json: { success: true } });
  });

  await page.goto('/m/post-session-check');
  await expect(page.getByText('Your seat is confirmed', { exact: true })).toBeVisible();
  const experience = page.getByRole('textbox', { name: 'Your experience with this tea' });
  await expect(experience).toBeHidden();

  completed = true;
  await page.reload();
  await expect(page.getByText('Saved to your private tasting journal.')).toBeVisible();
  await page.getByRole('textbox', { name: 'Your experience with this tea' }).fill('I felt settled.');
  await page.getByRole('button', { name: 'Save for me' }).click();
  await expect(page.getByText('Saved to your journal', { exact: true })).toBeVisible();
  expect(syncedNotes[0]).toContain('I felt settled.');
  expect(savedNotes).toBeUndefined();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('button', { name: 'Add tasting notes' }).click();
  await page.getByRole('button', { name: 'Full tasting' }).click();
  await expect(experience).toHaveValue('I felt settled.');
  await expect(page.getByRole('textbox', { name: /share with host/i })).toHaveCount(0);
  await experience.fill('Peach and a dry finish.');
  await page.getByRole('button', { name: 'Save tasting' }).click();
  await expect(page.getByRole('heading', { name: 'Tasting saved', exact: true })).toBeVisible();
  await expect.poll(() => syncedNotes.at(-1)).toContain('Peach and a dry finish.');
  expect(savedNotes).toBeUndefined();
  await expectNoUnhandledCompassApi(page);
});


test('quick and full tasting share the same impression, wheel and journal record', async ({ page }, testInfo) => {
  test.slow();
  if (testInfo.project.use.isMobile) await page.setViewportSize({ width: 390, height: 844 });
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
      sessionSharedNote: 'Earlier feedback to the host.',
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
  await quick.getByRole('button', { name: 'Full tasting' }).click();
  await expect(quick.getByRole('group', { name: 'Aroma', exact: true })).toHaveCount(0);
  await expect(quick.getByRole('group', { name: 'Finish', exact: true })).toHaveCount(0);
  await expect(quick.getByRole('button', { name: 'Favorite tea', exact: true })).toHaveCount(0);
  await expect(quick.getByRole('button', { name: 'Taste wheel', exact: true })).toHaveCount(1);
  const experience = quick.getByRole('textbox', { name: 'Your experience with this tea' });
  await expect(experience).toHaveAttribute('placeholder', /what stood out/i);
  await quick.getByRole('button', { name: 'Dislike', exact: true }).click();
  await expect(experience).toHaveAttribute('placeholder', /what didn’t you like.*source better teas/i);
  await expect(experience).toHaveValue('');
  await expect(experience.and(page.locator(':placeholder-shown'))).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('tasting-dislike-prompt.png'), scale: 'css' });
  await experience.fill('The finish was too dry for me.');
  await expect(experience.and(page.locator(':placeholder-shown'))).toHaveCount(0);
  await quick.getByRole('button', { name: 'Neutral', exact: true }).click();
  await expect(experience).toHaveAttribute('placeholder', /left you undecided/i);
  await expect(experience).toHaveValue('The finish was too dry for me.');
  await quick.getByRole('button', { name: 'Back to note' }).click();
  await expect(experience).toHaveValue('The finish was too dry for me.');
  await experience.fill('');
  await expect(experience).toHaveAttribute('placeholder', /left you undecided/i);
  await expect(experience.and(page.locator(':placeholder-shown'))).toBeVisible();
  await quick.getByRole('button', { name: 'Full tasting' }).click();
  await quick.getByRole('button', { name: 'Like', exact: true }).click();
  await expect(experience).toHaveAttribute('placeholder', /what did you enjoy/i);
  await quick.getByRole('button', { name: 'Want to purchase this', exact: true }).click();
  await expect(experience).toHaveAttribute('placeholder', /want to drink it again/i);
  await quick.getByRole('button', { name: 'Save in my collection', exact: true }).click();
  await inRow('Overall', 9).click();
  await experience.fill('Peach and roasted almond.');
  await quick.getByRole('button', { name: 'Save tasting' }).click();
  await expect(page.getByRole('heading', { name: 'Tasting saved' })).toBeVisible();
  const [first] = await savedRecords();
  expect(first.tasting).toMatchObject({ aromaRating: 8, finishRating: 10, quality: 9, impression: 'like', wantToPurchase: true, inCollection: true });
  expect(first.tasting.notes).toContainEqual(legacy.notes[0]);
  await expect.poll(() => collection).toEqual(['test-tea']);

  await page.reload();
  await quick.getByRole('button', { name: 'Full tasting' }).click();
  await expect(inRow('Overall', 9)).toHaveAttribute('aria-pressed', 'true');
  await expect(quick.getByRole('button', { name: 'Like', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(quick.getByRole('button', { name: 'Want to purchase this', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(quick.getByRole('button', { name: 'In my collection', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(experience).toHaveValue('Peach and roasted almond.');
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
  await expect(page.getByRole('region', { name: 'Quick tasting note for the host' })).toContainText('Earlier feedback to the host.');
  await expect(page.getByRole('region', { name: 'Earlier notes' })).toContainText('Orchid on the hot lid.');
  const personalNotes = page.getByRole('textbox', { name: 'Personal notes' });
  await expect(personalNotes).toHaveAttribute('placeholder', /want to drink it again/i);
  await personalNotes.fill('The dry finish lingered.');
  await page.getByRole('button', { name: 'Save notes' }).click();
  await expect(page.getByRole('button', { name: 'Tasting saved' })).toBeVisible();
  const records = await savedRecords();
  expect(records).toHaveLength(1);
  expect(records[0]).toMatchObject({
    id: first.id, createdAt: first.createdAt, sourceType: 'event', eventId: 'event-quick-full',
    sessionSharedNote: 'Earlier feedback to the host.',
    tasting: { quality: 7, impression: 'love', wantToPurchase: true, inCollection: true, aromaRating: 8, finishRating: 10,
      flavor: ['rose'], aroma: ['rose'], notes: [legacy.notes[0], { text: 'The dry finish lingered.' }] },
  });
  expect(sharedNotes).toEqual([]);

  await expect.poll(() => JSON.stringify(syncedEntries)).toContain('The dry finish lingered.');
  await page.reload();
  await quick.getByRole('button', { name: 'Full tasting' }).click();
  await expect(inRow('Overall', 7)).toHaveAttribute('aria-pressed', 'true');
  await quick.getByRole('button', { name: 'Taste wheel', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Show Rose Aroma on wheel' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Show Rose Taste on wheel' })).toBeVisible();

  await page.getByRole('button', { name: 'Back to quick tasting', exact: true }).click();
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
  expect(sharedNotes).toEqual([]);
  await expectNoUnhandledCompassApi(page);
});

test('the journal browses exact saved tastings and protects edits while switching', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/**', route => route.fulfill({ json: {} }));
  await page.addInitScript(() => {
    if (localStorage.getItem('teajia-storage')) return;
    const now = new Date().toISOString();
    const earlier = new Date(Date.now() - 60_000).toISOString();
    const notes = [
      { productId: 'naka-shop-lot', name: 'Naka Gushu', text: 'Grounded and clear.', createdAt: now },
      { productId: 'white-shop-lot', name: 'White Tea from the High Mountain Spring Harvest', text: 'Peach and hay.', createdAt: earlier },
    ].map(({ productId, name, text, createdAt }) => {
      const tasting = { notes: [{ id: 'personal-impression-draft', text, section: 'general', capturedAt: now }] };
      return {
        id: `entry-${productId}`, productId, productName: name, productType: '', createdAt,
        note: { tasting, personalNote: text, updatedAt: createdAt },
        tastings: [{ id: `sitting-${productId}`, tasting, createdAt }],
      };
    });
    localStorage.setItem('teajia-storage', JSON.stringify({ version: 2, state: { tastingJournal: notes } }));
  });
  await page.goto('/account/journal?tea=naka-shop-lot&entry=entry-naka-shop-lot');
  await page.getByRole('button', { name: 'Edit tasting note' }).press('Enter');
  const note = page.getByRole('textbox', { name: 'Your notes' });
  await expect(note).toHaveValue('Grounded and clear.');
  await note.fill('Naka had a deep, earthy finish.');

  const browse = page.getByRole('navigation', { name: 'Browse tastings' });
  await browse.getByRole('button', { name: 'Next tasting' }).click();
  const dialog = page.getByRole('dialog', { name: 'Save this tasting?' });
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(note).toHaveValue('Naka had a deep, earthy finish.');
  await browse.getByRole('button', { name: 'Next tasting' }).click();
  await dialog.getByRole('button', { name: 'Save and continue' }).click();
  await expect(note).toHaveValue('Peach and hay.');
  await expect(browse.getByText('Tasting 2 of 2')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('browse-solo-tastings.png'), scale: 'css' });

  await page.setViewportSize({ width: 320, height: 700 });
  const header = page.locator('.tasting-header-controls');
  const title = header.getByText('White Tea from the High Mountain Spring Harvest', { exact: true });
  await expect(title).toBeInViewport();
  const close = (await header.getByRole('button', { name: 'Close', exact: true }).boundingBox())!;
  const titleBounds = (await title.boundingBox())!;
  expect(titleBounds.x - (close.x + close.width)).toBeCloseTo(4);
  const titleLayout = await title.evaluate(element => ({
    overflow: getComputedStyle(element).textOverflow,
    lines: element.getBoundingClientRect().height / parseFloat(getComputedStyle(element).lineHeight),
  }));
  expect(titleLayout.overflow).toBe('ellipsis');
  expect(titleLayout.lines).toBeCloseTo(1, 1);
  await expect(header.getByRole('button', { name: 'Open your impression' }))
    .toHaveAccessibleDescription('White Tea from the High Mountain Spring Harvest');
  await expect(header.getByRole('button', { name: 'Save tasting', exact: true })).toBeInViewport();
  await expect(browse.getByRole('button', { name: 'Previous tasting' })).toBeInViewport();
  expect(await browse.evaluate(nav => nav.scrollWidth <= nav.clientWidth)).toBe(true);
  await browse.getByRole('button', { name: 'Previous tasting' }).click();
  await expect(note).toHaveValue('Naka had a deep, earthy finish.');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(browse).toHaveCount(0);
  await expect(page).toHaveURL(/\/account\/journal/);
});
