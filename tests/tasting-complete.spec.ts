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
  await expect(impression).toContainText('8 / 10');
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
