import { test, expect } from './fixtures';
import { installCompassHarness, openCompass, expectNoUnhandledCompassApi } from './helpers/compassHarness';

test('complete tasting persists impression, independent senses, storage and recap links', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installCompassHarness(page);
  await openCompass(page);
  await page.getByPlaceholder('Tea name').filter({ visible: true }).fill('Complete tasting');
  await page.getByRole('button', { name: /tasting profile/i }).click();
  const nav = page.getByRole('navigation', { name: 'Tasting sections' });
  const impression = page.getByRole('button', { name: 'Open your impression', exact: true });
  await impression.click();
  await page.getByRole('button', { name: 'Love', exact: true }).click();
  await page.getByRole('button', { name: 'Want to purchase this', exact: true }).click();
  await page.getByRole('button', { name: 'Rate 8 out of 10', exact: true }).click();
  await page.getByLabel('Your notes', { exact: true }).fill('Floral, soft and quietly uplifting.');
  await expect(page.getByRole('button', { name: 'Rate 8 out of 10', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await nav.getByRole('button', { name: 'Texture', exact: true }).click();
  await page.getByRole('button', { name: 'Silky', exact: true }).click();
  await nav.getByRole('button', { name: 'Effect', exact: true }).click();
  await page.getByRole('button', { name: 'Calm', exact: true }).click();
  await nav.getByRole('button', { name: 'Taste', exact: true }).click();
  // Radial controls have clipped wedge hit regions; exercise their keyboard activation.
  await page.getByRole('button', { name: 'Explore Floral', exact: true }).focus();
  await page.keyboard.press('Enter');
  const taste = page.getByRole('button', { name: 'Rose · Taste', exact: true });
  const aroma = page.getByRole('button', { name: 'Rose · Aroma', exact: true });
  await taste.focus();
  await page.keyboard.press('Enter');
  await expect(taste).toHaveAttribute('aria-pressed', 'true');
  await expect(aroma).toHaveAttribute('aria-pressed', 'false');
  await aroma.focus();
  await page.keyboard.press('Enter');
  await expect(taste).toHaveAttribute('aria-pressed', 'true');
  await expect(aroma).toHaveAttribute('aria-pressed', 'true');
  await nav.getByRole('button', { name: 'Storage', exact: true }).click();
  const slider = page.getByRole('slider', { name: /Storage character/ });
  await slider.focus();
  await slider.press('Home');
  await page.getByRole('button', { name: 'Musty', exact: true }).click();
  await impression.click();
  const recap = page.getByRole('region', { name: 'Your tasting selections', exact: true });
  for (const word of ['Silky', 'Calm', 'Parched', 'Musty']) await expect(recap.getByRole('button', { name: `Edit ${word}`, exact: true })).toBeVisible();
  await expect(recap.getByRole('button', { name: 'Edit Rose', exact: true })).toHaveCount(2);
  await recap.getByRole('button', { name: 'Edit Silky', exact: true }).click();
  await expect(nav.getByRole('button', { name: 'Texture', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Silky', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await nav.getByRole('button', { name: 'Leave tasting', exact: true }).click();
  await page.getByRole('button', { name: 'Save and close', exact: true }).click();
  await expect(nav).toBeHidden();
  await expect.poll(() => page.evaluate(async () => {
    // @ts-expect-error Vite exposes source modules to this local browser fixture.
    const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
    const state = useTeaCompassStore.getState();
    return state.getEntry(state.activeEntryId)?.tasting;
  })).toMatchObject({ quality: 8, impression: 'love', wantToPurchase: true, body: ['silky'], feeling: ['calming'], flavor: ['rose'], aroma: ['rose'], storageCharacter: 0, storageNotes: ['Musty'] });
  await page.getByRole('button', { name: /tasting profile/i }).click();
  await impression.click();
  await expect(page.getByRole('button', { name: 'Love', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Want to purchase this', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Rate 8 out of 10', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('Your notes', { exact: true })).toHaveValue('Floral, soft and quietly uplifting.');
  await expect(recap.getByRole('button', { name: 'Edit Rose', exact: true })).toHaveCount(2);
  await expect(recap.getByRole('button', { name: 'Edit Musty', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expectNoUnhandledCompassApi(page);
});

test('two Curate openings create two history records and both Save controls update the open record', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installCompassHarness(page);
  await openCompass(page);
  await page.getByPlaceholder('Tea name').filter({ visible: true }).fill('Peach oolong');
  const openTasting = page.getByTestId('curate-taste-button').filter({ visible: true });
  const notes = page.getByRole('textbox', { name: 'Your notes', exact: true });
  const headerSave = page.getByRole('button', { name: 'Save tasting', exact: true });
  const saved = page.getByRole('button', { name: 'Tasting saved', exact: true });
  const history = () => page.evaluate(async () => {
    // @ts-expect-error Vite exposes the local fixture store.
    const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
    const state = useTeaCompassStore.getState();
    return state.getEntry(state.activeEntryId)?.tastingHistory ?? [];
  });

  await openTasting.click();
  await notes.fill('Peach on the first sip.');
  await headerSave.click();
  await expect(saved).toBeVisible();
  const firstRecord = (await history())[0];
  expect(firstRecord.id).toBeTruthy();

  await notes.fill('Peach and light honey.');
  await page.getByRole('button', { name: 'Save notes', exact: true }).click();
  await expect(saved).toBeVisible();
  expect(await history()).toMatchObject([{
    id: firstRecord.id,
    date: firstRecord.date,
    data: { notes: [{ text: 'Peach and light honey.' }] },
  }]);

  const nav = page.getByRole('navigation', { name: 'Tasting sections' });
  await nav.getByRole('button', { name: 'Leave tasting', exact: true }).click();
  await expect(nav).toBeHidden();
  await openTasting.click();
  await notes.fill('More honey in the second tasting.');
  await headerSave.click();
  await expect(saved).toBeVisible();

  const records = await history();
  expect(records).toHaveLength(2);
  expect(records[0].id).toBe(firstRecord.id);
  expect(records[1].id).not.toBe(firstRecord.id);
  expect(records.map(record => record.data.notes[0].text)).toEqual([
    'Peach and light honey.',
    'More honey in the second tasting.',
  ]);
  await expectNoUnhandledCompassApi(page);
});

test('clearing the sole saved impression can be saved and stays cleared on reopen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installCompassHarness(page);
  await openCompass(page);
  await page.getByPlaceholder('Tea name').filter({ visible: true }).fill('Clear impression');
  await page.getByRole('button', { name: /tasting profile/i }).click();
  const impression = page.getByRole('button', { name: 'Open your impression', exact: true });
  const nav = page.getByRole('navigation', { name: 'Tasting sections' });
  await impression.click();
  await page.getByRole('button', { name: 'Love', exact: true }).click();
  await nav.getByRole('button', { name: 'Leave tasting', exact: true }).click();
  await page.getByRole('button', { name: 'Save and close', exact: true }).click();
  await expect(nav).toBeHidden();
  await page.getByRole('button', { name: /tasting profile/i }).click();
  await impression.click();
  const love = page.getByRole('button', { name: 'Love', exact: true });
  await expect(love).toHaveAttribute('aria-pressed', 'true');
  await love.click();
  await expect(love).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('button', { name: 'Save notes', exact: true })).toBeEnabled();
  await nav.getByRole('button', { name: 'Leave tasting', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Save and close', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Save and close', exact: true }).click();
  await expect(nav).toBeHidden();
  await page.getByRole('button', { name: /tasting profile/i }).click();
  await impression.click();
  await expect(love).toHaveAttribute('aria-pressed', 'false');
  await expect(impression).not.toContainText('Love');
  await expectNoUnhandledCompassApi(page);
});

test('Save notes persists typed text and rating from the notes area', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await installCompassHarness(page);
  await openCompass(page);
  await page.getByPlaceholder('Tea name').filter({ visible: true }).fill('Notes save');
  await page.getByRole('button', { name: /tasting profile/i }).click();
  await page.getByLabel('Your notes', { exact: true }).fill('A long, gentle finish.');
  const choices = page.getByRole('group', {name:'Your rating',exact:true});
  const boxes = await choices.getByRole('button').evaluateAll(nodes => nodes.map(node => {
    const box = node.getBoundingClientRect();
    return {top:box.top, bottom:box.bottom};
  }));
  expect(new Set(boxes.map(box => box.top)).size).toBe(1);
  await page.getByRole('button', {name:'Rate 7 out of 10',exact:true}).click();
  const save = page.getByRole('button', {name:'Save notes',exact:true});
  await expect(save).toBeEnabled();
  await save.click();
  await expect.poll(() => page.evaluate(async () => {
    // @ts-expect-error Vite exposes source modules to this local browser fixture.
    const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
    const state = useTeaCompassStore.getState();
    return state.getEntry(state.activeEntryId)?.tasting;
  })).toMatchObject({quality:7,notes:[{id:'personal-impression-draft',text:'A long, gentle finish.'}]});
  await expectNoUnhandledCompassApi(page);
});

test('throat feel, weight and persistence replace their previous choice', async ({page}) => {
  await page.setViewportSize({width:320,height:740});
  await installCompassHarness(page);
  await openCompass(page);
  await page.getByPlaceholder('Tea name').filter({visible:true}).fill('Single choices');
  await page.getByRole('button',{name:/tasting profile/i}).click();
  await page.getByRole('navigation',{name:'Tasting sections'}).getByRole('button',{name:'Texture',exact:true}).click();
  for (const [name, first, second] of [
    ['Throat feel','Comfortable','Irritated'],
    ['Weight','Light','Full'],
    ['Persistence','Brief','Lingering'],
  ]) {
    const group=page.getByRole('group',{name,exact:true});
    await group.getByRole('button',{name:first,exact:true}).click();
    await group.getByRole('button',{name:second,exact:true}).click();
    await expect(group.getByRole('button',{name:first,exact:true})).toHaveAttribute('aria-pressed','false');
    await expect(group.getByRole('button',{name:second,exact:true})).toHaveAttribute('aria-pressed','true');
  }
});

test('wheel names grow with the wheel while sense captions remain small', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installCompassHarness(page);
  await openCompass(page);
  await page.getByRole('button', { name: /tasting profile/i }).click();
  await page.getByRole('navigation', { name: 'Tasting sections' }).getByRole('button', { name: 'Taste', exact: true }).click();
  await page.getByRole('button', { name: 'Explore Floral', exact: true }).focus();
  await page.keyboard.press('Enter');
  const label = page.locator('.split-note-label span[data-layout="arc"]').first();
  const sense = page.locator('.sense-caption').first();
  const screenFont = async () => sense.evaluate(el => parseFloat(getComputedStyle(el).fontSize) * (el as SVGGraphicsElement).getScreenCTM()!.a);
  await expect(label).toBeVisible();
  const small = Number(await label.getAttribute('data-font-size'));
  expect(await screenFont()).toBeLessThanOrEqual(11.1);
  await page.setViewportSize({ width: 820, height: 1000 });
  await expect.poll(async () => Number(await label.getAttribute('data-font-size'))).toBeGreaterThan(small);
  expect(await screenFont()).toBeLessThanOrEqual(11.1);
  await page.screenshot({ path: '/tmp/tasting-wheel-scaling-large.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(async () => Number(await label.getAttribute('data-font-size'))).toBeCloseTo(small, 1);
  await page.screenshot({ path: '/tmp/tasting-wheel-scaling-phone.png' });
});

test('site and tasting bars fold in sequence without moving the center', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 390, height: 844 });
  await installCompassHarness(page);
  await openCompass(page);
  await page.getByRole('button', { name: /tasting profile/i }).click();
  const site = page.getByTestId('bottom-tab-bar');
  const tasting = page.getByRole('navigation', { name: 'Tasting sections' });
  const seal = tasting.getByRole('button', { name: 'Leave tasting' });
  const firstPosition = await seal.boundingBox();
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('[data-testid="bottom-tab-bar"], .tasting-capsule-seal, .tasting-capsule-surface')) {
      for (const animation of el.getAnimations()) { animation.pause(); animation.currentTime = 330; }
    }
  });
  await expect(seal).toBeHidden();
  await expect(tasting.locator('.tasting-capsule-surface')).toBeHidden();
  await page.screenshot({ path: '/tmp/tasting-circle-handoff.png' });
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('[data-testid="bottom-tab-bar"], .tasting-capsule-seal, .tasting-capsule-surface')) {
      for (const animation of el.getAnimations()) animation.play();
    }
  });

  await expect(site).toHaveCSS('animation-name', 'tasting-site-fold');
  await expect(tasting.locator('.tasting-capsule-wing').first()).toHaveCSS('animation-delay', '0.92s');
  await expect(site).toBeHidden();
  await expect(tasting.locator('.tasting-capsule-wing').first()).toHaveCSS('opacity', '1');
  const settled = await seal.boundingBox();
  expect(settled!.x).toBeCloseTo(firstPosition!.x, 1);
  expect(settled!.y).toBeCloseTo(firstPosition!.y, 1);
  await page.screenshot({ path: '/tmp/tasting-fold-open.png' });
  await seal.click();
  // Return opens the site bar directly; there is no preliminary tasting fold.
  await expect(tasting).toHaveCount(0);
  await expect(tasting).toBeHidden();
  await expect(site).toHaveClass(/tasting-site-reopen/);
  await expect(site.locator('.tasting-return-emblem')).toHaveCSS('animation-name', 'tasting-emblem-depart');
  await site.evaluate(el => {
    for (const animation of el.getAnimations({ subtree: true })) { animation.pause(); animation.currentTime = 220; }
  });
  const emblemOpacity = await site.locator('.tasting-return-emblem').evaluate(el => Number(getComputedStyle(el).opacity));
  expect(emblemOpacity).toBeGreaterThan(0);
  expect(emblemOpacity).toBeLessThan(1);
  await page.screenshot({ path: '/tmp/tasting-emblem-fade.png' });
  await site.evaluate(el => { for (const animation of el.getAnimations({ subtree: true })) animation.play(); });

  await expect(site.locator(':scope > div')).toHaveCSS('animation-delay', '0.5s');
  await expect(site.locator(':scope > div')).toHaveCSS('opacity', '1');
  await page.screenshot({ path: '/tmp/tasting-fold-return.png' });
  await expect(page.locator('[data-center-leaving]')).toHaveCount(0);
  await expect(site.locator('.tasting-return-emblem')).toHaveCSS('opacity', '0');
  // Past the old 750ms cleanup: the original slide-up must never replay.
  await page.waitForTimeout(850);
  await expect(site).toHaveClass(/tasting-site-reopen/);
  await expect(site).toHaveCSS('animation-name', 'tasting-capsule-open');
  expect(await site.evaluate(el => el.getAnimations().filter(a => a.playState === 'running').length)).toBe(0);
  await page.getByRole('button', { name: /tasting profile/i }).click();
  await expect(site).not.toHaveClass(/tasting-site-reopen/);
  await page.getByRole('button', { name: 'Love', exact: true }).click();
  await seal.click();
  await expect(page.getByRole('button', { name: 'Save and close', exact: true })).toBeVisible();
  await expect(tasting).not.toHaveClass(/is-closing/);

});

test('visible header Save works from Effect and preserves the same tasting', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await installCompassHarness(page);
  await openCompass(page);
  await page.getByPlaceholder('Tea name').filter({visible:true}).fill('Header save review');
  await page.getByRole('button',{name:/tasting profile/i}).click();
  const save=page.getByRole('button',{name:'Save tasting',exact:true});
  await expect(save).toBeVisible();
  await save.click();
  await expect(page.getByRole('status').filter({hasText:'Add a note'})).toBeVisible();
  await page.getByRole('button',{name:'Love',exact:true}).click();
  const nav=page.getByRole('navigation',{name:'Tasting sections'});
  await nav.getByRole('button',{name:'Effect',exact:true}).click();
  await page.getByRole('button',{name:'Calm',exact:true}).click();
  await expect(save).toBeInViewport();
  await page.waitForTimeout(1600);
  await page.screenshot({path:'/tmp/tasting-effect-refined.png'});
  await page.setViewportSize({width:320,height:740});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await expect(save).toBeInViewport();
  await page.screenshot({path:'/tmp/tasting-effect-narrow.png'});
  await save.click();
  await expect.poll(()=>page.evaluate(async()=>{
    // @ts-expect-error Vite exposes the local fixture store.
    const {useTeaCompassStore}=await import('/src/lib/teaCompassStore.ts');
    const state=useTeaCompassStore.getState();
    return state.getEntry(state.activeEntryId)?.tasting;
  })).toMatchObject({impression:'love',feeling:['calming']});
  await expectNoUnhandledCompassApi(page);
});

test('reduced motion skips the restored bar sequence', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await installCompassHarness(page);
  await openCompass(page);
  await page.getByRole('button', { name: /tasting profile/i }).click();
  const nav = page.getByRole('navigation', { name: 'Tasting sections' });
  await expect(nav.locator('.tasting-capsule-surface')).toHaveCSS('animation-name', 'none');
  await nav.getByRole('button', { name: 'Leave tasting' }).click();
  await expect(nav).toBeHidden();
  await expect(page.getByTestId('bottom-tab-bar')).toHaveCSS('animation-name', 'none');
});

test('editing a stock tasting profile saves the product without writing to the personal journal', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const product = {
    id: 'edit-profile', product_name: 'Peach oolong', type: 'Oolong', status: 'Active',
    cost_currency: 'USD', cost_amount: 10, stock_grams: 100, is_public: 0, shown_in_shop: 0,
  };
  await installCompassHarness(page, { products: [product] });
  await page.route('**/api/products/edit-profile', route => route.fulfill({ json: product }));
  let productTasting: unknown;
  let journalWrites = 0;
  await page.route('**/api/products/edit-profile/catalog', async route => {
    const data = route.request().postDataJSON();
    if (data.tasting) productTasting = data.tasting;
    return route.fulfill({ json: { success: true } });
  });
  await page.route('**/api/tasting-journal/sync', async route => {
    journalWrites += 1;
    return route.fulfill({ json: { syncedIds: [] } });
  });
  await page.route('**/api/inventory/summaries', route => route.fulfill({ json: { products: [] } }));

  await page.goto('/admin/stock?panel=edit-profile');
  await page.getByRole('button', { name: 'Add tasting profile', exact: true }).click();
  await page.getByRole('button', { name: 'Rate 7 out of 10', exact: true }).click();
  await page.getByRole('button', { name: 'Save tasting', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Tasting saved', exact: true })).toBeVisible();

  expect(productTasting).toMatchObject({ quality: 7 });
  const personalJournal = await page.evaluate(async () => {
    // @ts-expect-error Vite exposes the local fixture store.
    const { useAppStore } = await import('/src/lib/store.ts');
    return useAppStore.getState().tastingJournal;
  });
  expect(personalJournal).toEqual([]);
  expect(journalWrites).toBe(0);
  await expectNoUnhandledCompassApi(page);
});
