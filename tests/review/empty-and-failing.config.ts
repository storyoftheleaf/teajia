/** W5 config: the review rig's config, narrowed to 390 and 1280 and this spec. */
import { defineConfig } from '@playwright/test';
import base from './review.config';

export default defineConfig({
  ...base,
  testMatch: /empty-and-failing\.spec\.ts$/,
  projects: (base.projects ?? []).filter(p => p.name !== 'phone-320'),
});
