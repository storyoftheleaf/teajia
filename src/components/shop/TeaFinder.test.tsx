import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { TeaFinder } from './TeaFinder';

describe('TeaFinder', () => {
  it('renders only the approved finder doors', () => {
    const html = renderToStaticMarkup(<TeaFinder onChoose={() => {}} />);

    expect(html).toContain('Light and fragrant');
    expect(html).toContain('Grounding and deep');
    expect(html).toContain('Clear and focused');
    expect(html).toContain('Open all teas');
    expect(html).not.toContain('rounded-xl');
  });

  it('reports each canonical finder intent', () => {
    const onChoose = vi.fn();
    const view = TeaFinder({ onChoose });

    if (!React.isValidElement<{ children: React.ReactNode }>(view)) {
      throw new Error('Expected TeaFinder to render an element');
    }

    const buttons = React.Children.toArray(view.props.children);
    for (const button of buttons) {
      if (!React.isValidElement<{ onClick: () => void }>(button)) {
        throw new Error('Expected each finder choice to render as a button');
      }
      button.props.onClick();
    }

    expect(onChoose.mock.calls.map(([intent]) => intent)).toEqual([
      'light-fragrant',
      'grounding-deep',
      'clear-focused',
      'all',
    ]);
  });
});
