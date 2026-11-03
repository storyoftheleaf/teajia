import { describe, expect, it } from 'vitest';
import { firstPhotoSlot, photoFieldUpdate } from './quickPhotoModel';
const product = { imageUrl: '', additionalImages: [] as string[], bagPhotoUrl: 'bag.jpg' };
describe('quick product photo slots', () => {
  it('uses main then the first empty additional slot', () => {
    expect(firstPhotoSlot(product)).toBe('main');
    expect(firstPhotoSlot({ ...product, imageUrl: 'main.jpg' })).toBe('1');
    expect(firstPhotoSlot({ ...product, imageUrl: 'main.jpg', additionalImages: ['one.jpg'] })).toBe('2');
    expect(firstPhotoSlot({ ...product, imageUrl: 'main.jpg', additionalImages: ['', 'two.jpg'] })).toBe('1');
  });
  it('refuses to guess an automatic replacement when all slots are full', () => {
    expect(firstPhotoSlot({ ...product, imageUrl: 'main.jpg', additionalImages: ['one.jpg', 'two.jpg'] })).toBeNull();
  });
  it('changes only the explicitly chosen slot and preserves the complete additional array', () => {
    const source = { ...product, imageUrl: 'main.jpg', additionalImages: ['one.jpg', 'two.jpg', 'legacy.jpg'] };
    expect(photoFieldUpdate(source, '1', 'new.jpg')).toEqual({ field: 'additionalImages', value: ['new.jpg', 'two.jpg', 'legacy.jpg'] });
    expect(photoFieldUpdate(source, 'main', 'new.jpg')).toEqual({ field: 'imageUrl', value: 'new.jpg' });
    expect(source.additionalImages).toEqual(['one.jpg', 'two.jpg', 'legacy.jpg']);
    expect(source.bagPhotoUrl).toBe('bag.jpg');
  });
});
