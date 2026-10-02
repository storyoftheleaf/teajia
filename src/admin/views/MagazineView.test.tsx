import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { StoryWorkshopLink, canSeeStoryWorkshop } from './MagazineView';

// The story workshop is a page on Adrian's own Mac, reachable only over his Tailscale. For any
// other shop's admin the address is dead, so only the platform owner may see the link.
describe('Magazine room: the story workshop link', () => {
  it('is for the platform owner only', () => {
    expect(canSeeStoryWorkshop('platform_owner')).toBe(true);
    for (const role of ['platform_admin', 'owner', null, undefined]) expect(canSeeStoryWorkshop(role)).toBe(false);
  });

  it('opens the workshop on the studio Mac in a new tab', () => {
    const html = renderToStaticMarkup(<StoryWorkshopLink />);
    expect(html).toContain('Story workshop');
    expect(html).toContain('href="http://100.90.156.97:8766/"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noreferrer"');
  });
});
