import { describe, expect, it, vi } from 'vitest';
import { closeIntensityOnEscape } from './ObservationIntensity';

const key = (k: string) => ({ key: k, stopPropagation: vi.fn() });

describe('Escape with an intensity slider open', () => {
  it('closes the slider and stops the key there, so the tasting stays open', () => {
    const event = key('Escape');
    const close = vi.fn();
    expect(closeIntensityOnEscape(event, close)).toBe(true);
    expect(close).toHaveBeenCalledOnce();
    expect(event.stopPropagation).toHaveBeenCalledOnce();
  });
  it('leaves every other key alone', () => {
    const event = key('a');
    const close = vi.fn();
    expect(closeIntensityOnEscape(event, close)).toBe(false);
    expect(close).not.toHaveBeenCalled();
    expect(event.stopPropagation).not.toHaveBeenCalled();
  });
});
