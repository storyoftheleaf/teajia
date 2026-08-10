import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { TeaShopViewTabs } from './TeaShopViewTabs';

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
});
