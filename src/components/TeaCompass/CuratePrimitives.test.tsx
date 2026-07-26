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
