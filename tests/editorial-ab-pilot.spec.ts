import { expect, test } from './fixtures';
import { readFileSync } from 'node:fs';
import type { TeajiaWordforgeDraftV1 } from '../worker/src/wordforgeArticleDraft';
import { hashWordforgeDraft } from '../worker/tests/helpers/wordforgeDraftHash';
import { PILOT_MEDIA, PILOT_SOURCE } from '../worker/src/articleEditorialPilot';
import { resolveArticleMeta } from '../functions/_middleware';
import { serveReadAsset } from '../functions/readAssetDelivery';

const api = process.env.TEAJIA_EDITORIAL_PILOT_API;
const site = process.env.PLAYWRIGHT_BASE_URL;
const account = 'acc_teajia_bali';
const byline = 'Synthetic Editorial Author';
const slug = 'editorial-ab-proof';
test.skip(!api || !site, 'Starts against the isolated editorial pilot sandbox.');

function edition(revision: number, authorId: string) {
  const value = JSON.parse(readFileSync('worker/tests/fixtures/teajia-wordforge-draft.v1.json', 'utf8')) as TeajiaWordforgeDraftV1;
  value.source = { system: 'wordforge', id: PILOT_SOURCE, revision, content_hash: '' };
  value.article.title = revision === 1 ? 'The Ridge Before Rain' : 'The Ridge After Rain';
  value.article.slug = revision === 1 ? slug : 'proposed-ridge-address';
  value.article.author_id = authorId;
  value.article.cover_image_url = PILOT_MEDIA;
  value.article.credits = ['Synthetic interview and illustration'];
  value.article.blocks = value.article.blocks.map(block => {
    if (block.type === 'cover') return { ...block, title: value.article.title, image: PILOT_MEDIA };
    if (block.type === 'intro') return { ...block, text: value.article.title + ' opens this synthetic edition.' };
    if (block.type === 'image') return { ...block, url: PILOT_MEDIA, caption: 'Synthetic ridge illustration' };
    return block;
  });
  value.source.content_hash = hashWordforgeDraft(value);
  return value;
}

test('reviews a staged WordForge edition, replaces the live address, places it in Read and withdraws it', async ({ browser, request }, testInfo) => {
  test.setTimeout(110_000);
  for (const origin of [api!, site!]) expect(new URL(origin).hostname).toBe('127.0.0.1');
  const login = await request.post(api + '/api/auth/login', { data: { identifier: 'sandbox', password: 'sandbox' } });
  expect(login.ok()).toBe(true);
  const { token } = await login.json();
  const headers = { Authorization: `Bearer ${token}`, 'X-Teajia-Account': account };
  const created = await request.post(api + '/api/admin/contributors', { headers, data: { display_name: byline, slug: `pilot-author-${crypto.randomUUID().slice(0, 8)}`, beginnings: "A fictional contributor for the local rehearsal." } });
  expect(created.status(), await created.text()).toBe(201);
  const contributorId = (await created.json()).contributor.id;
  const publishedContributor = await request.post(api + `/api/admin/contributors/${contributorId}/publish`, { headers });
  expect(publishedContributor.ok(), await publishedContributor.text()).toBe(true);

  function intake(value: TeajiaWordforgeDraftV1) {
    return request.put(api + `/api/integrations/wordforge/articles/${PILOT_SOURCE}`, {
      headers: { Authorization: 'Bearer offline-editorial-pilot' }, data: value,
    });
  }
  const a = edition(1, contributorId);
  const b = edition(2, contributorId);
  const initial = await intake(a);
  expect(initial.status(), await initial.text()).toBe(201);
  const { article_id: id, candidate_id: aId } = await initial.json();
  const detail = api + `/api/articles/${slug}`;
  const approval = api + `/api/admin/articles/${id}/approve-edition`;
  const issue = api + '/api/read/editorial-issue';

  const admin = await browser.newContext({ viewport: { width: 1300, height: 840 } });
  const guest = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  try {
    const allowed = new Set([new URL(site!).origin, new URL(api!).origin]);
    for (const context of [admin, guest]) await context.route('**/*', route =>
      allowed.has(new URL(route.request().url()).origin) ? route.continue() : route.abort());
    await admin.addInitScript(jwt => localStorage.setItem('teajia_token', jwt), token);
    const editor = await admin.newPage();
    await editor.goto(site + '/admin/magazine');
    await editor.getByRole('button', { name: new RegExp(a.article.title) }).click();
    await editor.getByRole('button', { name: /WordForge revision 1/ }).click();
    await editor.getByRole('button', { name: 'Publish reviewed edition' }).click();
    await expect(editor.getByRole('dialog', { name: 'WordForge editions' }).getByRole('status')).toHaveText('Edition published at the existing address.');
    const original = await (await request.get(detail)).text();
    expect(JSON.parse(original)).toMatchObject({ title: a.article.title, author_name: byline });
    const originalList = await (await request.get(api + '/api/articles')).text();
    expect(await (await request.get(issue)).json()).toEqual({ story: null });

    const reviewedA = (await (await request.get(api + `/api/admin/articles/${id}`, { headers })).json()).editorial_pilot;
    const staged = await intake(b);
    expect(staged.status(), await staged.text()).toBe(200);
    const { candidate_id: bId } = await staged.json();
    expect(bId).not.toBe(aId);
    expect(await (await request.get(detail)).text()).toBe(original);
    expect(await (await request.get(api + '/api/articles')).text()).toBe(originalList);
    const stale = await request.post(approval, { headers, data: {
      review_digest: reviewedA.placement_review_digest, candidate_id: aId, place: true,
    } });
    expect(stale.status()).toBe(409);
    expect(await stale.json()).toMatchObject({ code: 'stale_article_review' });
    expect((await request.get(api + '/api/articles/proposed-ridge-address')).status()).toBe(404);
    const reviewedB = (await (await request.get(api + `/api/admin/articles/${id}`, { headers })).json()).editorial_pilot;
    const earlyPlacement = await request.post(approval, { headers, data: {
      review_digest: reviewedB.placement_review_digest, candidate_id: bId, place: true,
    } });
    expect(earlyPlacement.status()).toBe(409);
    expect(await earlyPlacement.json()).toMatchObject({ code: 'editorial_edition_required' });

    await editor.getByRole('button', { name: 'Refresh review' }).click();
    const compare = editor.getByRole('group', { name: 'Compare editions' });
    await expect(compare.getByRole('button', { name: new RegExp('Public edition.*' + a.article.title) })).toBeVisible();
    await expect(compare.getByRole('button', { name: new RegExp(b.article.title) })).toBeVisible();
    await expect(editor.getByRole('button', { name: 'Replace public edition' })).toBeDisabled();
    await editor.getByRole('button', { name: /WordForge revision 2/ }).click();
    const preview = editor.getByTestId('immersive-preview-article');
    await expect(preview.getByText('What does the mountain teach first?')).toBeVisible();
    await expect(preview.getByText('Weather at elevation')).toBeVisible();
    await expect(preview.getByText('Synthetic interview and illustration')).toBeVisible();
    await editor.getByRole('button', { name: 'Desktop', exact: true }).click();
    await preview.getByRole('heading', { name: b.article.title }).scrollIntoViewIfNeeded();
    await expect(preview.getByRole('heading', { name: b.article.title })).toBeInViewport();
    await editor.screenshot({ path: testInfo.outputPath('desktop-review.png') });
    await editor.setViewportSize({ width: 390, height: 844 });
    await editor.getByRole('button', { name: 'Phone', exact: true }).click();
    await preview.getByRole('heading', { name: b.article.title }).scrollIntoViewIfNeeded();
    await expect(preview.getByRole('heading', { name: b.article.title })).toBeInViewport();
    expect(await editor.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await editor.screenshot({ path: testInfo.outputPath('phone-review.png') });
    await editor.getByRole('button', { name: 'Replace public edition' }).click();
    await expect(editor.getByRole('dialog', { name: 'WordForge editions' }).getByRole('status')).toHaveText('Edition published at the existing address.');
    expect(await (await request.get(issue)).json()).toEqual({ story: null });
    const live = await (await request.get(detail)).json();
    expect(live).toMatchObject({ title: b.article.title, slug, published_at: JSON.parse(original).published_at });

    await editor.getByRole('button', { name: 'Place in Read' }).click();
    await expect(editor.getByRole('dialog', { name: 'WordForge editions' }).getByRole('status')).toHaveText('Approved edition placed in Read.');
    const page = await guest.newPage();
    await page.goto(site + '/read');
    await page.getByRole('link', { name: new RegExp(b.article.title) }).click();
    await expect(page).toHaveURL(new RegExp('/article/' + slug + '$'));
    await expect(page.getByRole('heading', { name: b.article.title })).toBeVisible();
    await expect(page.getByRole('link', { name: 'By ' + byline })).toHaveAttribute('href', '/people/' + contributorId);
    await expect(page.getByText('What does the mountain teach first?')).toBeVisible();
    await expect(page.getByText('Weather at elevation')).toBeVisible();
    await expect(page.getByText('Synthetic interview and illustration')).toBeVisible();
    expect(await resolveArticleMeta(slug, new URL(api!))).toMatchObject({ title: b.article.title + ' · Teajia', image: PILOT_MEDIA });
    const media = await request.get(site + PILOT_MEDIA);
    expect(media.ok()).toBe(true);
    expect(media.headers()['content-type']).toContain('image/png');
    const approvedMedia = await media.body();

    await editor.getByRole('button', { name: 'Withdraw', exact: true }).click();
    await expect(editor.getByRole('dialog', { name: 'WordForge editions' }).getByRole('status')).toHaveText('Edition withdrawn from Read and the public article.');
    expect((await request.get(detail)).status()).toBe(404);
    expect(await resolveArticleMeta(slug, new URL(api!))).toBeNull();
    const moduleRequest = new Request(site + '/read-assets/editorial-ab-proof.js');
    expect((await serveReadAsset(moduleRequest, 'https://worker.example.test', undefined)).status).toBe(404);
    expect(await (await request.get(issue)).json()).toEqual({ story: null });
    expect(await (await request.get(api + '/api/articles')).json()).not.toContainEqual(expect.objectContaining({ id }));
    expect(await (await request.get(site + PILOT_MEDIA)).body()).toEqual(approvedMedia);
    await page.reload();
    await expect(page.getByText('Article not found')).toBeVisible();
    await page.goto(site + '/read');
    await expect(page.getByRole('link', { name: new RegExp(b.article.title) })).toHaveCount(0);
    const profile = await request.get(api + '/api/people/' + contributorId);
    expect(profile.status(), await profile.text()).toBe(200);
    expect((await profile.json()).articles).toEqual([]);
  } finally {
    await admin.close();
    await guest.close();
  }
});
