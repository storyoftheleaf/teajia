import React from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { TeaFinder } from './TeaFinder';
import { TeaShopViewRegion, TeaShopViewTabs } from './TeaShopViewTabs';

describe('TeaShopViewTabs', () => {
  it('renders the approved compact order and selected state', () => {
    const html = renderToStaticMarkup(<TeaShopViewTabs active="all" onChange={() => {}} />);

    expect(html.indexOf('All teas')).toBeLessThan(html.indexOf('My selection'));
    expect(html.indexOf('My selection')).toBeLessThan(html.indexOf('Find a tea'));
    expect(html).toContain('aria-pressed="true"');
    expect(html).not.toContain('overflow-x-auto');
  });

  it('reports the selected view', () => {
    const onChange = vi.fn();
    const view = TeaShopViewTabs({ active: 'all', onChange });

    if (!React.isValidElement<{ children: React.ReactNode }>(view)) {
      throw new Error('Expected TeaShopViewTabs to render an element');
    }

    const buttons = React.Children.toArray(view.props.children);
    const selectionButton = buttons[1];
    if (!React.isValidElement<{ onClick: () => void }>(selectionButton)) {
      throw new Error('Expected My selection to render as a button');
    }

    selectionButton.props.onClick();
    expect(onChange).toHaveBeenCalledWith('selection');
  });

  it('keeps a polite result status mounted with the finder and updates it for results', () => {
    const finderMarkup = renderToStaticMarkup(
      <TeaShopViewRegion active="find" count={0} showPast={false}>
        <TeaFinder onChoose={() => {}} />
      </TeaShopViewRegion>,
    );
    const resultMarkup = renderToStaticMarkup(
      <TeaShopViewRegion active="all" count={2} showPast={false}>
        <span>Ledger results</span>
      </TeaShopViewRegion>,
    );

    expect(finderMarkup).toContain('aria-live="polite"');
    expect(finderMarkup).toContain('Choose a direction to find a tea.');
    expect(finderMarkup).toContain('Light and fragrant');
    expect(resultMarkup).toContain('2 teas shown');
  });

  it('keeps the live region outside the Finder/ledger branch in TeaInventory', () => {
    const inventorySource = readFileSync(
      new URL('../TeaInventory.tsx', import.meta.url),
      'utf8',
    );
    const regionStart = inventorySource.indexOf('<TeaShopViewRegion');
    const viewBranch = inventorySource.indexOf("{teaView === 'find' ?", regionStart);
    const regionEnd = inventorySource.indexOf('</TeaShopViewRegion>', regionStart);

    expect(regionStart).toBeGreaterThan(-1);
    expect(viewBranch).toBeGreaterThan(regionStart);
    expect(regionEnd).toBeGreaterThan(viewBranch);
  });
});
