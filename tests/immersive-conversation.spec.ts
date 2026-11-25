// tests/immersive-conversation.spec.ts
// An interview sent in from WordForge carries question-and-answer passages and
// sidebar passages. The scrolling layout used to drop both without a word.
import { test, expect } from './fixtures';
import { fileURLToPath } from 'url';

const PHOTO = fileURLToPath(new URL('../public/craft/three-journeys.jpg', import.meta.url));

const ARTICLE = {
  id: 'test-conversation', slug: 'a-kiln-that-breathes', title: 'A Kiln That Breathes',
  status: 'published', tags: [], layout_template: 'immersive_scroll',
  created_at: '2026-11-25', updated_at: '2026-11-25',
  blocks: [
    { type: 'cover', title: 'A Kiln That Breathes', kicker: 'In conversation' },
    { type: 'intro', text: 'We sat by the firebox for most of an afternoon. What follows is a made-up exchange, written to test this page.' },
    { type: 'qa_pair', items: [
      { q: 'What does the wood give the clay that a gas kiln cannot?', a: 'Ash. It lands where the flame carries it, so one side of a pot is glassy and the other is dry. You cannot ask for that, you can only make room for it.' },
      { q: 'How long do you fire?', a: 'Four days and three nights. Somebody is feeding it every few minutes the whole time.' },
    ] },
    { type: 'pull_sidebar', side: 'right', body: 'The first night is slow on purpose. The pots are still giving up water, and a fast climb would crack them before the glaze has begun to move.', sidebar: 'A firing uses about four tonnes of split pine, cut and dried the year before.' },
    { type: 'pull_sidebar', side: 'left', image: 'https://images.unsplash.com/photo-test-kiln', body: 'By the third day the kiln is drawing air on its own. You can hear it, a low steady pull through the firebox door.', sidebar: 'The stack of pots nearest the flame takes the heaviest ash.' },
    { type: 'epilogue', text: 'The kiln cools for a week before anyone opens it.' },
  ],
};

test.beforeEach(async ({ page }) => {
  await page.route('https://images.unsplash.com/**', route => route.fulfill({
    path: PHOTO, contentType: 'image/jpeg', headers: { 'Access-Control-Allow-Origin': '*' },
  }));
  await page.route('**/api/**/articles/**', (route) => {
    if (route.request().url().includes(ARTICLE.slug) || route.request().url().includes('by-slug')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ARTICLE) });
    }
    return route.continue();
  });
});

test('a scrolling story draws its questions, answers and sidebar passages', async ({ page }, testInfo) => {
  // Reduced motion shows every passage at once, so the picture is the whole page.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`/article/${ARTICLE.slug}`);
  await expect(page.getByTestId('immersive-article')).toBeVisible();

  const question = page.getByText('What does the wood give the clay that a gas kiln cannot?');
  await question.scrollIntoViewIfNeeded();
  await expect(question).toBeVisible();
  await expect(page.getByText('Four days and three nights.', { exact: false })).toBeVisible();

  const note = page.getByText('A firing uses about four tonnes of split pine', { exact: false });
  await note.scrollIntoViewIfNeeded();
  await expect(note).toBeVisible();
  await expect(page.getByText('The first night is slow on purpose.', { exact: false })).toBeVisible();
  await expect(page.getByText('The stack of pots nearest the flame', { exact: false })).toBeVisible();

  // Nothing pushes the page sideways, on a phone or a desk.
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);

  const shots = process.env.STORY_SHOT_DIR;
  await page.getByTestId('immersive-article').screenshot({
    path: shots ? `${shots}/conversation-${testInfo.project.name.replace(/\s+/g, '-').toLowerCase()}.png` : testInfo.outputPath('conversation.png'),
  });
});
