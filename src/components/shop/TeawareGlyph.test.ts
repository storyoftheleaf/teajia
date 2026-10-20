import { describe, expect, it } from 'vitest';
import { teawareVesselFor } from './TeawareGlyph';

const vessel = (subcategory: string, name: string) => teawareVesselFor({ subcategory, name });

describe('teawareVesselFor', () => {
  it('reads the piece from its category and name', () => {
    expect(vessel('pot', 'Zisha Teapot')).toBe('yixing');
    expect(vessel('pot', 'Porcelain Teapot')).toBe('teapot');
    expect(vessel('pot', 'Silver Kettle')).toBe('kettle');
    expect(vessel('', 'Field Gaiwan')).toBe('gaiwan');
    expect(vessel('cup', 'Tasting Cup')).toBe('cup');
    expect(vessel('cup', 'Matcha Bowl')).toBe('bowl');
    expect(vessel('tray', 'Bamboo Tea Boat')).toBe('tray');
    expect(vessel('storage', 'Tin Caddy')).toBe('jar');
    expect(vessel('accessory', 'Bamboo Tongs')).toBe('tools');
    expect(vessel('decorative', 'Clay Toad')).toBe('pet');
  });

  it('files a Fair Cup as a pitcher, not a cup', () => {
    expect(vessel('Fair Cup', 'Glass Fair Cup')).toBe('pitcher');
  });

  it('leaves a piece it cannot name to the tile default', () => {
    expect(vessel('', 'Linen Runner')).toBeNull();
  });
});
