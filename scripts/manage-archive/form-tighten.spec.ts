import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { test } from '../../tests/fixtures';
import type { Page } from '@playwright/test';
import { installCompassHarness } from '../../tests/helpers/compassHarness';
import { ENTRIES, VENDORS, PRODUCTS, RATES } from './data';
import { fresh, warm, snap, OUT } from './lib';
import { click } from './steps';

// A measuring tool for one job: fitting the Source capture form on a phone.
// For each state it takes the screen as seen and the whole form, and writes
// the top and bottom (CSS px, page scrolled to top) of every row of the form
// beside the pictures, so a spacing change can be checked in numbers.
//
// The 'flow' form is the default. FORM=classic runs the same states on the
// earlier form (`?form=classic`). Each state also writes the form's markup,
// with run-specific ids taken out, so two runs of one layout can be compared
// exactly.

const ROOM = 'source-form';
const FLOW = process.env.FORM !== 'classic';
const QUERY = FLOW ? '' : '&form=classic';
const SOURCE = `/admin/compass?tab=sourcing${QUERY}`;
const PHONE = { n: 'phone', w: 390, h: 844 } as const;
const LAPTOP = { n: 'laptop', w: 1440, h: 950 } as const;

/** Scroll every scroller to the top (unless told not to), then read the rows. */
async function measure(page: Page, toTop = true) {
  return page.evaluate((toTop) => {
    if (toTop) {
      for (const el of Array.from(document.querySelectorAll('*'))) {
        const h = el as HTMLElement;
        if (h.scrollTop) h.scrollTop = 0;
      }
      window.scrollTo(0, 0);
    }
    const visible = (el: Element | null | undefined): el is HTMLElement => {
      if (!el) return false;
      const r = (el as HTMLElement).getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    const firstVisible = (sel: string, root: ParentNode = document) =>
      Array.from(root.querySelectorAll(sel)).find(visible) as HTMLElement | undefined;
    const box = (el: Element | null | undefined) => {
      if (!visible(el)) return null;
      const r = el.getBoundingClientRect();
      return { top: Math.round(r.top * 10) / 10, bottom: Math.round(r.bottom * 10) / 10, height: Math.round(r.height * 10) / 10 };
    };
    const rows: Record<string, unknown> = {};
    const form = firstVisible('[data-curate-source]');
    rows.formCard = box(form);
    const tablists = Array.from(document.querySelectorAll('[role=tablist]')).filter(visible);
    tablists.forEach((t, i) => { rows[`tabRow${i + 1}`] = { ...box(t), label: (t.textContent || '').trim().slice(0, 60) }; });
    if (!form) return rows;
    rows.decision = box(firstVisible('[data-testid=curate-decision-control]', form));
    const band = firstVisible('[data-testid=curate-context-band], [data-testid=curate-teaware-context-band]', form);
    rows.contextBand = box(band);
    rows.runVendorRow = box(band?.firstElementChild);
    rows.journeyScanPhotoRow = box(band?.lastElementChild);
    const identity = firstVisible('[data-testid=curate-cluster-identity]', form);
    rows.identitySection = box(identity);
    const name = firstVisible('input[placeholder="Tea name"], input[placeholder="Teaware name"]', form);
    rows.name = box(name);
    const origin = firstVisible('input[placeholder="e.g. Yiwu"]', form);
    rows.originYear = box(origin?.closest('.flex.items-end'));
    rows.chineseType = box(firstVisible('[data-testid=curate-chinese-type-row]', form));
    rows.teawareClassification = box(firstVisible('[data-testid=curate-teaware-classification-row]', form));
    rows.teawareProvenance = box(firstVisible('[data-testid=curate-teaware-provenance-row]', form));
    const buying = firstVisible('[data-testid=curate-cluster-buying]', form);
    rows.purchaseSection = box(buying);
    rows.purchaseEyebrow = box(buying?.querySelector('h2'));
    const price = firstVisible('input[aria-label=Price]', form);
    const priceRow = price?.closest('.flex.items-stretch');
    rows.priceRow = box(priceRow);
    // The gram slider is the row after the price row inside PricingRow.
    rows.slider = box(priceRow?.nextElementSibling);
    rows.costLines = box(firstVisible('[data-testid=curate-shelf-preview]', form));
    rows.details = box(firstVisible('[data-testid=structured-tea-fields]', form));
    const taste = firstVisible('[data-testid=curate-cluster-tasting]', form);
    rows.tasteSection = box(taste);
    rows.tasteLabel = box(taste?.querySelector('h2'));
    rows.tasteLink = box(taste?.querySelector('.curate-profile-entry'));
    rows.tasteQuality = box(taste?.querySelector('[aria-label="Quality rating"]'));
    rows.buyRow = box(firstVisible('[data-testid=capture-action-footer]', form));
    const notes = firstVisible('[data-testid=curate-notes-band], [data-testid=curate-cluster-notes]', form);
    rows.notesBand = box(notes);
    const label = notes ? Array.from(notes.querySelectorAll('span')).find((s) => (s.textContent || '').trim() === 'Notes') : undefined;
    rows.notesLabel = box(label);
    rows.notesBox = box(notes?.querySelector('.tasting-voice-field'));
    rows.notesMic = box(notes?.querySelector('.tasting-voice-btn'));
    rows.scanSlot = box(firstVisible('[data-testid=curate-scan-slot]', form));
    rows.photoSlot = box(firstVisible('[data-testid=curate-photo-slot]', form));
    rows.tasteButton = box(firstVisible('[data-testid=curate-taste-button]', form));
    rows.captureSection = box(firstVisible('[data-testid=curate-cluster-capture]', form));
    rows.decideSection = box(firstVisible('[data-testid=curate-cluster-decide]', form));
    rows.recordCard = box(firstVisible('[data-testid=curate-cluster-record]', form));
    rows.storage = box(Array.from(form.querySelectorAll('section h2')).find((h) => (h.textContent || '').trim() === 'Storage')?.parentElement);
    rows.buyPanel = box(firstVisible('section[id^=capture-purchase-picker]', form));
    rows.supplierHeader = box(firstVisible('[data-testid=curate-supplier-header]', form));
    rows.nameRow = box(name?.closest('.library-card-title-row'));
    rows.originTypeYear = box(firstVisible('[data-testid=curate-origin-type-year-row]', form));
    rows.photoStrip = box(firstVisible('[data-testid=curate-photo-strip]', form));
    rows.qualityRow = box(firstVisible('[data-testid=curate-quality-row]', form));
    rows.headerMic = box(firstVisible('[data-testid=curate-header-mic]'));
    rows.bottomBar = box(firstVisible('[data-testid=bottom-tab-bar]'));
    return rows;
  }, toTop);
}

function writeRows(state: string, size: string, rows: unknown) {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, `${ROOM}--${state}--${size}.json`), JSON.stringify(rows, null, 2));
}

/** The form's markup with the ids that change per run (entry id, React ids, uploads) taken out. */
async function writeMarkup(page: Page, state: string, size: string) {
  const html = await page.evaluate(() => {
    const form = document.querySelector('[data-curate-source]');
    if (!form) return '';
    let out = form.outerHTML;
    const picker = form.querySelector('section[id^=capture-purchase-picker-]');
    const entryId = picker?.id.replace('capture-purchase-picker-', '');
    if (entryId) out = out.split(entryId).join('ENTRY');
    return out.replace(/:r[0-9a-z]+:/g, ':rID:').replace(/radix-[^"]+/g, 'radix-ID')
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, 'UUID');
  });
  fs.writeFileSync(path.join(OUT, `${ROOM}--${state}--${size}.html`), html);
}

/** A plain photo for the upload mock to serve, so attached photos show. */
const PHOTO = execFileSync('convert', ['-size', '240x240', 'gradient:#8a6d4b-#3b2f22', 'png:-']);

async function addPhotos(page: Page, count: number) {
  for (let i = 0; i < count; i += 1) {
    await page.locator('[data-curate-source] input[type=file]').first().setInputFiles({ name: `brew-${i + 1}.png`, mimeType: 'image/png', buffer: PHOTO });
    await page.waitForTimeout(1500);
  }
  await page.keyboard.press('Escape').catch(() => {});
}

async function pressBuy(page: Page) {
  await click(page, page.getByRole('button', { name: 'Buy', exact: true }), 1500);
}

async function pressSample(page: Page) {
  await click(page, page.getByRole('button', { name: 'Sample', exact: true }), 1500);
}

async function chooseType(page: Page, type: string) {
  await click(page, page.getByRole('button', { name: 'Tea type' }), 900);
  await click(page, page.getByRole('dialog').getByRole('button', { name: type }), 900);
}

/** Scroll the Source page's own scroller about half way down. */
async function scrollHalf(page: Page) {
  await page.evaluate(() => {
    const scroller = Array.from(document.querySelectorAll<HTMLElement>('[role=tabpanel]'))
      .find((el) => el.scrollHeight > el.clientHeight + 8 && el.getClientRects().length > 0);
    if (scroller) scroller.scrollTop = (scroller.scrollHeight - scroller.clientHeight) / 2;
  });
  await page.waitForTimeout(900);
}

async function fillTea(page: Page) {
  await page.getByPlaceholder('Tea name').filter({ visible: true }).fill('Dahongpao Reserve');
  // 'flow' shows the field's own word as its placeholder.
  await page.getByPlaceholder(FLOW ? 'Origin' : 'e.g. Yiwu', { exact: true }).filter({ visible: true }).fill('Wuyi');
  await page.getByTestId('curate-year-control').filter({ visible: true }).fill('2019').catch(() => {});
  await page.getByPlaceholder('Price').filter({ visible: true }).first().fill('420').catch(() => {});
  await page.getByPlaceholder('Grams').filter({ visible: true }).first().fill('250').catch(() => {});
  // Leave the field so no suggestion list is open over the form.
  await page.keyboard.press('Escape').catch(() => {});
  await page.locator('body').click({ position: { x: 5, y: 5 } }).catch(() => {});
  await page.waitForTimeout(600);
}

async function addTasting(page: Page) {
  const nav = () => page.getByRole('navigation', { name: /tasting sections/i }).filter({ visible: true }).first();
  await click(page, page.getByRole('button', { name: /tasting profile/i }), 1800);
  await click(page, page.getByRole('button', { name: 'Open your impression', exact: true }), 600);
  await click(page, page.getByRole('button', { name: 'Love', exact: true }), 600);
  await click(page, nav().getByRole('button', { name: 'Texture', exact: true }), 900);
  await click(page, page.getByRole('button', { name: 'Silky', exact: true }), 600);
  await click(page, page.getByRole('button', { name: /^(Leave tasting|Close)$/ }), 900);
  await click(page, page.getByRole('button', { name: 'Save and close', exact: true }), 1500);
}

async function fillTeaware(page: Page) {
  await page.getByPlaceholder('Teaware name').filter({ visible: true }).fill('Zhuni Xishi pot');
  await page.getByPlaceholder('Origin').filter({ visible: true }).first().fill('Yixing').catch(() => {});
  await page.getByPlaceholder('Price').filter({ visible: true }).first().fill('1800').catch(() => {});
  await page.keyboard.press('Escape').catch(() => {});
  await page.locator('body').click({ position: { x: 5, y: 5 } }).catch(() => {});
  await page.waitForTimeout(600);
}

const teawareTab = (page: Page) => click(page, page.getByRole('tab', { name: 'Teaware' }));

async function addNotes(page: Page, texts: string[]) {
  for (const text of texts) {
    const box = page.getByRole('textbox', { name: 'Notes' }).filter({ visible: true }).first();
    await box.fill(text);
    await box.press('Enter');
    await page.waitForTimeout(500);
  }
}

test('source form, phone', async ({ page }) => {
  await installCompassHarness(page, { customers: VENDORS, compassEntries: ENTRIES, products: PRODUCTS, rates: RATES });
  await page.route('https://img.test/**', (route) => route.fulfill({ status: 200, contentType: 'image/png', body: PHOTO }));
  await page.setViewportSize({ width: PHONE.w, height: PHONE.h });
  await warm(page, SOURCE);

  const state = async (name: string, step?: () => Promise<unknown>) => {
    await fresh(page, SOURCE);
    if (step) await step();
    // A finger leaves no hover behind; the test pointer would.
    await page.mouse.move(1, 1);
    writeRows(name, PHONE.n, await measure(page));
    await writeMarkup(page, name, PHONE.n);
    await snap(page, PHONE, { room: ROOM, state: `${name}-screen`, route: SOURCE, note: `${name}, as seen` });
    await snap(page, PHONE, { room: ROOM, state: `${name}-full`, route: SOURCE, note: `${name}, whole form`, full: true });
  };
  /** A state taken as the screen is seen, without scrolling back to the top first. */
  const asSeen = async (name: string, step: () => Promise<unknown>) => {
    await fresh(page, SOURCE);
    await step();
    await page.mouse.move(1, 1);
    await snap(page, PHONE, { room: ROOM, state: `${name}-screen`, route: SOURCE, note: `${name}, as seen` });
    writeRows(name, PHONE.n, await measure(page));
  };

  await state('tea-empty');
  await state('tea-filled', () => fillTea(page));
  await state('tea-filled-tasted', async () => { await fillTea(page); await addTasting(page); });
  await state('teaware-empty', () => teawareTab(page));
  await state('teaware-filled', async () => { await teawareTab(page); await fillTeaware(page); });
  await asSeen('tea-filled-buy', async () => { await fillTea(page); await pressBuy(page); });
  await state('tea-filled-photos', async () => { await fillTea(page); await addPhotos(page, 2); });
  if (FLOW) {
    await asSeen('tea-filled-sample', async () => { await fillTea(page); await pressSample(page); });
    await asSeen('teaware-filled-buy', async () => { await teawareTab(page); await fillTeaware(page); await pressBuy(page); });
    await state('tea-filled-oolong', async () => { await fillTea(page); await chooseType(page, 'Oolong'); });
    await fresh(page, SOURCE);
    await fillTea(page);
    await scrollHalf(page);
    await snap(page, PHONE, { room: ROOM, state: 'tea-filled-scrolled-screen', route: SOURCE, note: 'scrolled half way, the header and microphone stay' });
    writeRows('tea-filled-scrolled', PHONE.n, await measure(page, false));
    await state('tea-filled-notes-tasted', async () => {
      await fillTea(page);
      await addNotes(page, [
        'The seller says this came from the 2019 spring picking on the north slope.',
        'Roasted twice, the second time lighter. Rests well for a year.',
        'He offered a 50 g sample for free if we come back next week.',
      ]);
      await addTasting(page);
    });
    // The same, with a tasting of many words and a brewing line, so the one
    // quiet line of words has to cut with an ellipsis.
    await state('tea-filled-notes-tasted-many', async () => {
      await fillTea(page);
      await addNotes(page, [
        'The seller says this came from the 2019 spring picking on the north slope.',
        'Roasted twice, the second time lighter. Rests well for a year.',
        'He offered a 50 g sample for free if we come back next week.',
      ]);
      await addTasting(page);
      await page.evaluate(async () => {
        // @ts-expect-error Vite serves source modules to the browser in the dev server.
        const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
        const store = useTeaCompassStore.getState();
        const entry = store.getEntry(store.activeEntryId!);
        store.updateEntry(store.activeEntryId!, { tasting: {
          ...(entry?.tasting ?? {}),
          flavor: ['honey', 'orchid', 'roasted-nut', 'cocoa', 'stone-fruit'],
          finish: ['long'],
          brewingVessel: 'Gaiwan', brewingTemp: 95, brewingTime: '10s',
        } });
      });
      await page.waitForTimeout(600);
    });
  }
});

// The header microphone while it records (a fake microphone stands in).
test('source form, phone, microphone recording', async ({ browser }) => {
  test.skip(!FLOW, 'flow only');
  const context = await browser.newContext({ viewport: { width: PHONE.w, height: PHONE.h }, deviceScaleFactor: 2, permissions: ['microphone'] });
  const page = await context.newPage();
  await installCompassHarness(page, { customers: VENDORS, compassEntries: ENTRIES, products: PRODUCTS, rates: RATES });
  await warm(page, SOURCE);
  await fresh(page, SOURCE);
  await fillTea(page);
  await click(page, page.getByRole('button', { name: 'Record voice note' }), 1500);
  await snap(page, PHONE, { room: ROOM, state: 'mic-recording-screen', route: SOURCE, note: 'the header microphone while recording' });
  await context.close();
});

// The Library with photos on two teas (seeded on the fixtures: the photo
// control's upload path is exercised on the form above).
const SEEDED = ENTRIES.map((e) => (
  e.id === 'e3' ? { ...e, photos: JSON.stringify(['https://img.test/seed-1.png', 'https://img.test/seed-2.png']) }
    : e.id === 'e1' ? { ...e, photos: JSON.stringify(['https://img.test/seed-3.png']) } : e));
const LIBRARY = `/admin/compass?tab=library${QUERY}`;

test('library with photos, phone', async ({ page }) => {
  await installCompassHarness(page, { customers: VENDORS, compassEntries: SEEDED, products: PRODUCTS, rates: RATES });
  await page.route('https://img.test/**', (route) => route.fulfill({ status: 200, contentType: 'image/png', body: PHOTO }));
  await page.setViewportSize({ width: PHONE.w, height: PHONE.h });
  await warm(page, LIBRARY);
  await fresh(page, LIBRARY);
  // Bring the supplier with the photographed teas to the top of the list.
  await page.evaluate(() => document.querySelector('[data-testid=library-entry-e1]')?.closest('section')?.scrollIntoView({ block: 'start' }));
  await page.waitForTimeout(600);
  await snap(page, PHONE, { room: ROOM, state: 'library-photos-screen', route: LIBRARY, note: 'Library, two teas with photos' });
  writeRows('library-photos', PHONE.n, await page.evaluate(() => {
    const out: Record<string, unknown> = {};
    for (const id of ['e1', 'e3']) {
      const card = document.querySelector(`[data-testid=library-entry-${id}]`);
      const r = card?.getBoundingClientRect();
      if (r) out[`card-${id}`] = { top: r.top, bottom: r.bottom, height: r.height };
    }
    const tabs = Array.from(document.querySelectorAll('[role=tablist]')).map((t) => t.getBoundingClientRect());
    out.tabRows = tabs.filter((r) => r.height > 0).map((r) => ({ top: r.top, bottom: r.bottom, height: r.height }));
    return out;
  }));
});

test('source form, laptop', async ({ page }) => {
  await installCompassHarness(page, { customers: VENDORS, compassEntries: ENTRIES, products: PRODUCTS, rates: RATES });
  await page.setViewportSize({ width: LAPTOP.w, height: LAPTOP.h });
  await warm(page, SOURCE);
  await fresh(page, SOURCE);
  await fillTea(page);
  writeRows('tea-filled', LAPTOP.n, await measure(page));
  await writeMarkup(page, 'tea-filled', LAPTOP.n);
  await snap(page, LAPTOP, { room: ROOM, state: 'tea-filled-screen', route: SOURCE, note: 'tea-filled, laptop' });
  await pressBuy(page);
  await page.mouse.move(1, 1);
  await snap(page, LAPTOP, { room: ROOM, state: 'tea-filled-buy-screen', route: SOURCE, note: 'tea-filled, Buy pressed, laptop' });
});
