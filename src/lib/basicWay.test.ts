import { describe, expect, it } from 'vitest';
import { basicWaySteps, wayWithBasics } from './basicWay';

describe('the way in from the basics alone', () => {
  it('writes plain steps from a name and an address', () => {
    const steps = basicWaySteps({ place: 'The studio', address: '12 Jalan Raya' });
    expect(steps).toHaveLength(3);
    expect(steps[0].description).toBe('Make your way to The studio, 12 Jalan Raya.');
  });

  it('sends a guest to the map when only a map link is known', () => {
    expect(basicWaySteps({ mapLink: 'https://maps.example/x' })[0].description).toBe('Open the map and make your way there.');
  });

  it('writes nothing when nothing is known', () => {
    expect(basicWaySteps({ place: ' ', address: null })).toEqual([]);
    expect(wayWithBasics(null, {})).toBeNull();
  });

  it('never touches steps a host wrote', () => {
    const guide = { steps: [{ description: 'Blue gate' }], lost_phone: '123' };
    expect(wayWithBasics(guide, { place: 'The studio' })).toBe(guide);
  });

  it('keeps the notes and the picture of a guide that has no steps', () => {
    const shown = wayWithBasics({ steps: [], parking_notes: 'On the street', space_image_url: 'a.jpg' }, { place: 'The studio' });
    expect(shown?.steps).toHaveLength(3);
    expect(shown?.parking_notes).toBe('On the street');
    expect(shown?.space_image_url).toBe('a.jpg');
  });
});
