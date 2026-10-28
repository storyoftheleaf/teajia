import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { TastingData } from '../../types';
import { TasteQualities } from './TasteQualities';

function render(value: TastingData) {
  const onChange = vi.fn();
  const html = renderToStaticMarkup(<TasteQualities value={value} onChange={onChange} />);
  expect(onChange).not.toHaveBeenCalled();
  return html;
}

describe('taste observation states', () => {
  it('omits returning sweetness for fresh and saved tastings without changing saved data', () => {
    for (const value of [{}, { huiGan: true }, { huiGan: false, huiGanIntensity: 0 }, { huiGan: true, huiGanIntensity: 3 }]) {
      const before = structuredClone(value);
      const html = render(value);
      expect(html).not.toContain('Returning sweetness');
      expect(html).not.toContain('type="range"');
      expect(value).toEqual(before);
    }
  });

  it('displays the saved canonical Umami observation under the accessible savory label', () => {
    const html = render({ basicTastes: ['Umami', 'Salty'], aroma: ['honey'] });
    expect(html).toMatch(/<button[^>]*aria-pressed="true"[^>]*>Savory \(umami\)<\/button>/);
    expect(html).toMatch(/<button[^>]*aria-pressed="true"[^>]*>Salty<\/button>/);
    expect(html).toMatch(/<button[^>]*aria-pressed="false"[^>]*>Sweet<\/button>/);
  });
});
