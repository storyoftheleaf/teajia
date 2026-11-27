import { defineConfig } from '@playwright/test';
import base from '../../../tests/review/review.config';
export default defineConfig({ ...base, testDir: '.', testMatch: /W6-clicks\.spec\.ts/, outputDir: '../../../test-results/review/artifacts-w6' });
