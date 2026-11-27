import { describe, expect, it } from 'vitest';
import { compressFilm, filmFrame, recordableMp4 } from './compressFilm';

describe('a short film made smaller', () => {
  it('holds the long side to 720 and keeps the shape', () => {
    expect(filmFrame(1920, 1080)).toEqual({ width: 720, height: 406 });
    expect(filmFrame(1080, 1920)).toEqual({ width: 406, height: 720 });
    expect(filmFrame(3840, 2160)).toEqual({ width: 720, height: 406 });
  });

  it('never makes a small film larger', () => {
    expect(filmFrame(640, 360)).toEqual({ width: 640, height: 360 });
  });

  it('gives every side an even number, as an mp4 needs', () => {
    const frame = filmFrame(1281, 721);
    expect(frame.width % 2).toBe(0);
    expect(frame.height % 2).toBe(0);
  });

  it('sends the film as it was where no mp4 can be recorded', async () => {
    expect(recordableMp4()).toBeNull();
    const film = new File([new Uint8Array(8)], 'gate.mov', { type: 'video/quicktime' });
    expect(await compressFilm(film)).toBe(film);
  });
});
