import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CaptureActionFooter } from './CaptureActionFooter';
import {
  CurateActionBand,
  CurateDisclosure,
  CurateField,
  CurateRecordRow,
} from './CuratePrimitives';
import { DetailsRow } from './DetailsRow';

describe('Curate presentation primitives', () => {
  it('renders a controlled field with its label, status, helper, and Curate field roles', () => {
    const html = renderToStaticMarkup(
      <CurateField label="English name" status="Confirm" helper="Use the supplier wording when known.">
        <input aria-label="English name" value="Aged Liu Bao Tea" readOnly />
      </CurateField>,
    );

    expect(html).toContain('curate-field');
    expect(html).toContain('curate-field-with-label');
    expect(html).toContain('English name');
    expect(html).toContain('Confirm');
    expect(html).toContain('Use the supplier wording when known.');
  });

  it('keeps Confirm in the label lane as a state, and marks the field as still waiting', () => {
    const html = renderToStaticMarkup(
      <CurateField label="Tea type" status="Confirm">
        <select aria-label="Tea type" value="" onChange={() => undefined}><option value="">Choose type</option></select>
      </CurateField>,
    );

    // Confirm sits inside the label lane, not in the top-right action corner.
    const lane = html.match(/<div class="curate-field-lane">[\s\S]*?<\/div>/)?.[0] || '';
    expect(lane).toContain('curate-field-flag');
    expect(lane).toContain('Confirm');
    expect(html).not.toContain('absolute right-3 top-1');
    // The control itself shows it is unresolved, so blocked and settled differ.
    expect(html).toContain('curate-field-attention');
  });

  it('leaves a settled field without the attention treatment', () => {
    const html = renderToStaticMarkup(
      <CurateField label="Tea type">
        <select aria-label="Tea type" value="Oolong" onChange={() => undefined}><option value="Oolong">Oolong</option></select>
      </CurateField>,
    );

    expect(html).not.toContain('curate-field-attention');
    expect(html).not.toContain('curate-field-flag');
  });

  it('tells a derived fact apart from a warning in the same helper slot', () => {
    const derived = renderToStaticMarkup(
      <CurateField label="Cultivar" helper="肉桂 · Wuyi Mountains (Fujian), China">
        <input aria-label="Cultivar" value="Rou Gui" readOnly />
      </CurateField>,
    );
    const warning = renderToStaticMarkup(
      <CurateField label="Year" helper="Expected between 1950 and 2027" helperTone="warning">
        <input aria-label="Year" value="1492" readOnly />
      </CurateField>,
    );

    expect(derived).toContain('curate-field-note-derived');
    expect(derived).not.toContain('curate-field-note-warning');
    expect(derived).not.toContain('<svg');
    expect(warning).toContain('curate-field-note-warning');
    expect(warning).not.toContain('curate-field-note-derived');
    expect(warning).toContain('<svg');
  });

  it('marks a derived value and an attached suggestion list, and describes both', () => {
    const html = renderToStaticMarkup(
      <CurateField label="Cultivar" derived suggestions="79 cultivars">
        <input id="cultivar" aria-label="Cultivar" value="Rou Gui" readOnly />
      </CurateField>,
    );

    expect(html).toContain('curate-field-marks');
    expect(html).toContain('From base');
    expect(html).toContain('79 cultivars');
    expect(html).toContain('aria-describedby="cultivar-suggestions cultivar-derived"');
  });

  it('exposes a controlled disclosure relationship and hides closed content', () => {
    const closed = renderToStaticMarkup(
      <CurateDisclosure id="details" label="More tea details" open={false} onToggle={() => undefined}>
        <span>Detail controls</span>
      </CurateDisclosure>,
    );

    expect(closed).toContain('aria-expanded="false"');
    expect(closed).toContain('aria-controls="details"');
    expect(closed).not.toContain('Detail controls');

    const open = renderToStaticMarkup(
      <CurateDisclosure id="details" label="More tea details" open onToggle={() => undefined}>
        <span>Detail controls</span>
      </CurateDisclosure>,
    );

    expect(open).toContain('aria-expanded="true"');
    expect(open).toContain('id="details"');
    expect(open).toContain('Detail controls');
  });

  it('orders neutral actions before the primary action and exposes busy semantics', () => {
    const html = renderToStaticMarkup(
      <CurateActionBand
        neutral={[{ label: 'Cancel', onClick: () => undefined, ariaLabel: 'Cancel editing' }]}
        primary={{ label: 'Save tea', busyLabel: 'Saving tea…', busy: true, onClick: () => undefined }}
      />,
    );

    expect(html.indexOf('Cancel')).toBeLessThan(html.indexOf('Saving tea…'));
    expect(html).toContain('aria-label="Cancel editing"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('disabled=""');
    expect(html).toContain('curate-action-band');
  });

  it('replaces inferred columns with an explicit responsive action layout', () => {
    const html = renderToStaticMarkup(
      <CurateActionBand
        columns={{ base: 2, sm: 4 }}
        neutral={[
          { label: 'Delete', onClick: () => undefined },
          { label: 'Review later', onClick: () => undefined },
          { label: 'New import', onClick: () => undefined },
        ]}
        primary={{ label: 'Review next tea', onClick: () => undefined }}
      />,
    );

    const bandTag = html.match(/<div[^>]*class="[^"]*curate-action-band[^"]*"[^>]*>/)?.[0];
    expect(bandTag).toContain('grid-cols-2');
    expect(bandTag).toContain('sm:grid-cols-4');
    expect(bandTag).not.toContain('grid-cols-3');
  });

  it('renders separate Open and optional Delete controls for a busy record row', () => {
    const html = renderToStaticMarkup(
      <CurateRecordRow
        title="July vendor list"
        metadata="8 teas · 2 need review"
        status="In progress"
        openLabel="Open import"
        onOpen={() => undefined}
        deleteLabel="Delete import"
        onDelete={() => undefined}
        busy
      />,
    );

    expect(html).toContain('July vendor list');
    expect(html).toContain('8 teas · 2 need review');
    expect(html).toContain('In progress');
    expect(html).toContain('aria-label="Open import"');
    expect(html).toContain('aria-label="Delete import"');
    expect(html.match(/disabled=""/g)).toHaveLength(2);
  });
});

describe('Capture adapters', () => {
  it('preserves Capture footer test ids, Buy disclosure ARIA, Done state, and optional Sample', () => {
    const html = renderToStaticMarkup(
      <CaptureActionFooter
        onBuy={() => undefined}
        onDone={() => undefined}
        onSample={() => undefined}
        doneEnabled={false}
        buyExpanded
        purchasePickerId="purchase-picker"
        doneTestId="capture-done"
        className="capture-footer-shell"
      />,
    );

    expect(html).toContain('data-testid="capture-action-footer"');
    expect(html).toContain('data-testid="capture-done"');
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('aria-controls="purchase-picker"');
    expect(html).toContain('data-visual-state="disabled-neutral"');
    expect(html).toContain('>Sample</span>');
    expect(html.indexOf('Buy')).toBeLessThan(html.indexOf('Done'));
    expect(html.indexOf('Done')).toBeLessThan(html.indexOf('Sample'));

    const footerTag = html.match(/<div[^>]*data-testid="capture-action-footer"[^>]*>/)?.[0];
    expect(footerTag).toContain('grid');
    expect(footerTag).toContain('grid-cols-3');
    expect(footerTag).toContain('gap-2');
    expect(footerTag).toContain('capture-footer-shell');
    expect(footerTag).not.toContain('curate-action-band');
  });

  it('keeps the two-column Buy then Done layout when Sample is absent', () => {
    const html = renderToStaticMarkup(
      <CaptureActionFooter
        onBuy={() => undefined}
        onDone={() => undefined}
        doneEnabled
        buyExpanded={false}
        purchasePickerId="purchase-picker"
      />,
    );

    const footerTag = html.match(/<div[^>]*data-testid="capture-action-footer"[^>]*>/)?.[0];
    expect(footerTag).toContain('grid-cols-2');
    expect(html.indexOf('Buy')).toBeLessThan(html.indexOf('Done'));
    expect(html).not.toContain('Sample');
  });

  it('renders Capture details through the shared controlled disclosure', () => {
    const html = renderToStaticMarkup(
      <DetailsRow
        storage="Dry"
        originRegion="Yiwu"
        hasTasting={false}
        onYearChange={() => undefined}
        onSeasonChange={() => undefined}
        onStorageChange={() => undefined}
        onRegionChange={() => undefined}
        onChineseNameChange={() => undefined}
        onOpenTasting={() => undefined}
        onTastingStripRemove={() => undefined}
      />,
    );

    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-controls=');
    expect(html).toContain('Details · Dry / Yiwu');
  });
});
