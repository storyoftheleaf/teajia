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
  it('does not present an untouched returning-sweetness observation as a zero', () => {
    const html = render({});
    expect(html).toContain('aria-valuetext="Unrecorded"');
    expect(html).toMatch(/<p[^>]*>Unrecorded<\/p>/);
    expect(html).not.toContain('data-current="true"');
    expect(html).not.toContain('aria-label="Clear returning sweetness"');
  });

  it('presents an explicit zero as recorded and clearable', () => {
    const html = render({ huiGan: false, huiGanIntensity: 0 });
    expect(html).toContain('aria-valuetext="Not noticed"');
    expect(html).toContain('data-current="true">Not noticed');
    expect(html).toContain('aria-label="Clear returning sweetness"');
    expect(html).not.toContain('>Unrecorded</p>');
  });

  it('preserves legacy true without displaying an invented intensity', () => {
    const html = render({ huiGan: true });
    expect(html).toContain('aria-valuetext="Returning sweetness recorded; strength not specified"');
    expect(html).not.toContain('data-current="true"');
    expect(html).toContain('Previously recorded; strength not specified.');
  });

  it('retains a legacy negative observation without mislabelling it unrecorded', () => {
    const html = render({ huiGan: false });
    expect(html).toContain('aria-valuetext="Not noticed"');
    expect(html).toContain('data-current="true">Not noticed');
    expect(html).not.toContain('>Unrecorded</p>');
  });

  it('displays the saved canonical Umami observation under the accessible savory label', () => {
    const html = render({ basicTastes: ['Umami', 'Salty'], aroma: ['honey'] });
    expect(html).toMatch(/<button[^>]*aria-pressed="true"[^>]*>Savory \(umami\)<\/button>/);
    expect(html).toMatch(/<button[^>]*aria-pressed="true"[^>]*>Salty<\/button>/);
    expect(html).toMatch(/<button[^>]*aria-pressed="false"[^>]*>Sweet<\/button>/);
  });
});
