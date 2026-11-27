import { describe, expect, it } from 'vitest';
import { MAX_WAY_FILM_BYTES, WAY_FILM_KEY, wayFilmExtension, wayFilmRange, wayFilmRefusal } from './wayFilm';

const mp4 = new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32, 0, 0, 0, 0]);
const webm = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

describe('a film of the way in', () => {
  it('keeps an mp4, a phone’s mov and a webm, by what the file opens with', () => {
    expect(wayFilmRefusal('video/mp4', 1000, mp4)).toBeNull();
    expect(wayFilmRefusal('video/quicktime', 1000, mp4)).toBeNull();
    expect(wayFilmRefusal('video/webm;codecs=vp9', 1000, webm)).toBeNull();
    expect(wayFilmExtension('video/quicktime')).toBe('mov');
  });

  it('refuses one too large, another kind of file, and a file that only says it is a film', () => {
    expect(wayFilmRefusal('video/mp4', MAX_WAY_FILM_BYTES + 1, mp4)).toMatchObject({ status: 413, code: 'way_film_too_large' });
    expect(wayFilmRefusal('image/jpeg', 1000, jpeg)).toMatchObject({ status: 415, code: 'way_film_type' });
    expect(wayFilmRefusal('video/mp4', 1000, jpeg)).toMatchObject({ status: 415, code: 'way_film_type' });
    expect(wayFilmRefusal('video/webm', 1000, mp4)).toMatchObject({ status: 415 });
  });

  it('names a film by its key, and never a step photograph or a file outside the way', () => {
    expect(WAY_FILM_KEY.test('accounts/a1/venue-guide/abc-123.mp4')).toBe(true);
    expect(WAY_FILM_KEY.test('accounts/a1/venue-guide/abc-123.jpg')).toBe(false);
    expect(WAY_FILM_KEY.test('accounts/a1/products/abc.mp4')).toBe(false);
  });

  it('reads the part a phone asks for', () => {
    expect(wayFilmRange('bytes=0-1', 100)).toEqual({ offset: 0, length: 2 });
    expect(wayFilmRange('bytes=50-', 100)).toEqual({ offset: 50, length: 50 });
    expect(wayFilmRange('bytes=90-500', 100)).toEqual({ offset: 90, length: 10 });
    expect(wayFilmRange('bytes=-10', 100)).toEqual({ offset: 90, length: 10 });
    expect(wayFilmRange('bytes=100-', 100)).toBeNull();
    expect(wayFilmRange('bytes=5-2', 100)).toBeNull();
    expect(wayFilmRange('items=0-1', 100)).toBeNull();
    expect(wayFilmRange(null, 100)).toBeNull();
  });
});
