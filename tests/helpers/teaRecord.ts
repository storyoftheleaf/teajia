import { expect, type Page } from '@playwright/test';

/**
 * The tea record's tabs, and which tab now holds each part of the record.
 *
 * Until the 2026-10-25 Library redesign each part was its own collapsible
 * section; Tea, Notes, Orders and Files tabs replaced them
 * (CompassEntryDetailPanel). A test that names a part still names the part:
 * this opens the tab it lives on and hands back that part.
 */
const TAB_FOR_SECTION: Record<string, 'Tea' | 'Notes' | 'Orders' | 'Files'> = {
  'About this tea': 'Tea',
  'Story & description': 'Notes',
  'Source material': 'Notes',
  Purchasing: 'Orders',
  'Files & history': 'Files',
};

export async function openRecordSection(page: Page, name: string) {
  const tab = TAB_FOR_SECTION[name];
  if (!tab) throw new Error(`No tea record tab is known to hold "${name}"`);
  const record = page.getByTestId('library-entry-detail').filter({ visible: true });
  await record.getByRole('tablist', { name: 'Tea workspace' }).getByRole('tab', { name: tab, exact: true }).click();
  const section = record.getByRole('region', { name, exact: true });
  await expect(section).toBeVisible();
  return section;
}

/**
 * Close the tea record. From a Library card it opens embedded in the Tea details
 * sheet, which owns the close button; the record's own header (and its "Close
 * detail panel") only appears where the record is not embedded.
 */
export async function closeRecord(page: Page) {
  const sheet = page.getByRole('dialog', { name: 'Tea details' });
  if (await sheet.isVisible()) {
    await sheet.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(sheet).toBeHidden();
    return;
  }
  await page.getByRole('button', { name: 'Close detail panel' }).filter({ visible: true }).click();
}
