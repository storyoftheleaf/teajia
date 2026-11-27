import { describe, expect, it } from 'vitest';
import { GENERATED_CLAIMS } from './generatedClaims';
import { GENERATED_TEA_REFERENCE_PAGES } from './generatedPages';
import { GENERATED_DRAFT_CLAIMS, GENERATED_DRAFT_PAGES } from './generatedDraftClaims';
import type { PublicClaim } from './claims';
import { wisdomNeeds, type WisdomNeed, type WisdomNeedsSources } from './wisdomNeeds';
import { gradeIdFor } from './teaMatching';
import { TEA_PROCESSES } from '../vocabulary';

const published = { pages: GENERATED_TEA_REFERENCE_PAGES, claims: GENERATED_CLAIMS };
const drafts = { pages: GENERATED_DRAFT_PAGES, claims: GENERATED_DRAFT_CLAIMS as unknown as PublicClaim[] };
const withDrafts: WisdomNeedsSources = { published, drafts };
const publicOnly: WisdomNeedsSources = { published };

const find = (needs: WisdomNeed[], kind: WisdomNeed['kind'], label?: string) =>
  needs.find(item => item.kind === kind && (!label || item.label === label));

// Real teas from the shop, as Adrian posted them.
const palace = { id: 'palace', product_name: 'Banzhang Palace Grade Shou Cha', type: 'Shou Puer', form: 'Loose', origin_region: 'Banzhang, Yunnan', origin_country: 'China' };
const goldenBull = { id: 'bull', product_name: 'Golden Bull Hengfengyuan Shou Cha', type: 'Shou Puer', form: 'Cake', origin_region: 'Yunnan', origin_country: 'China' };
const gaba = { id: '77175e22-e6a2-445a-9f1d-c1bad425e0c9', product_name: 'EU GABA Oolong', chinese_name: '欧盟认证GABA乌龙', type: 'Oolong', form: 'Rolled', origin_region: 'Taiwan', origin_country: null };
const teaHeads = { id: 'heads', product_name: 'Bulang Mountain Banpen Small Tea Heads', type: 'Shou Puer', form: 'Loose', origin_region: 'Bulang Mountain, Menghai, Yunnan', origin_country: 'China' };

describe('wisdomNeeds', () => {
  it('Banzhang Palace Grade: the place is written, the Gong Ting grade is only drafted', () => {
    const needs = wisdomNeeds(palace, withDrafts);
    expect(find(needs, 'place')).toMatchObject({ label: 'Banzhang', covered: true, pageId: 'banzhang' });
    expect(find(needs, 'grade')).toMatchObject({ label: 'Gong Ting', covered: false, state: 'drafted', pageId: 'gong-ting' });
    expect(find(needs, 'style')).toMatchObject({ covered: true, pageId: 'shou' });
    // Without the drafts (the shop's view) the grade is a record only, never covered.
    expect(find(wisdomNeeds(palace, publicOnly), 'grade')).toMatchObject({ covered: false, state: 'record' });
  });

  it('Golden Bull Hengfengyuan: the mark and the producer are drafted, not yet written', () => {
    const needs = wisdomNeeds(goldenBull, withDrafts);
    expect(find(needs, 'grade')).toMatchObject({ label: 'Golden Bull', covered: false, state: 'drafted' });
    expect(find(needs, 'producer')).toMatchObject({ label: 'Hengfengyuan', covered: false, state: 'drafted' });
    // Without the drafts (the shop's view) both are records only.
    expect(find(wisdomNeeds(goldenBull, publicOnly), 'grade')).toMatchObject({ covered: false, state: 'record' });
    expect(needs.filter(item => item.kind === 'producer')).toHaveLength(1);
  });

  it('EU GABA Oolong: the GABA process is covered by the gaba page, the style by the oolong kit', () => {
    const needs = wisdomNeeds(gaba, withDrafts);
    expect(find(needs, 'process')).toMatchObject({ label: 'GABA', covered: true, pageId: 'gaba' });
    expect(find(needs, 'style')?.pageId).not.toBe('gaba');
    expect(find(needs, 'style')?.covered).toBe(true);
    expect(find(needs, 'place')).toMatchObject({ label: 'Taiwan', covered: false });
  });

  it('Bulang Mountain Small Tea Heads: the place and the tea heads process are covered', () => {
    const needs = wisdomNeeds(teaHeads, withDrafts);
    expect(find(needs, 'place')).toMatchObject({ label: 'Bulang Mountain', covered: true, pageId: 'bulang-mountain' });
    expect(find(needs, 'process')).toMatchObject({ label: 'Tea heads', covered: true, pageId: 'tea-heads' });
    expect(find(needs, 'style')).toMatchObject({ covered: true, pageId: 'shou' });
  });

  it('names the broader place that is written when the specific one is not', () => {
    const banpen = { ...teaHeads, origin_region: 'Banpen, Bulang Mountain, Yunnan' };
    expect(find(wisdomNeeds(banpen, withDrafts), 'place')).toMatchObject({ label: 'Banpen', covered: false, why: expect.stringContaining('Bulang Mountain is written up') });
  });

  it('asks for the type rather than guessing Sheng or Shou from a bare pu’er', () => {
    const bare = { ...palace, type: 'Puerh' };
    expect(find(wisdomNeeds(bare, withDrafts), 'style')).toMatchObject({ covered: false, state: 'missing' });
  });

  it('shows a confirmed named tea lot', () => {
    const y562 = { id: 'cb7efd7b-9da6-4dc8-be76-3c7e69bdb02e', product_name: 'Y562 (Jixing) Black Box', type: 'Shou Puer', origin_region: 'Yunnan' };
    expect(find(wisdomNeeds(y562, withDrafts), 'named')).toMatchObject({ covered: true, pageId: 'y562' });
  });

  it('keeps every claim that matches a process in the name on a page the one word list knows', () => {
    const processPages = new Set(TEA_PROCESSES.map(process => process.pageId));
    const claimPages = new Set(drafts.claims.filter(claim => claim.appliesWhen.process_in_name).map(claim => claim.pageId));
    expect([...claimPages].filter(id => !processPages.has(id))).toEqual([]);
  });
});

describe('gradeIdFor', () => {
  it('reads Palace Grade and Gong Ting as the gong-ting grade, and a mark without a grade page as no grade', () => {
    // Golden Bull has a drafted page (2026-11-27), so the published layer is the one without it.
    expect(gradeIdFor(['Banzhang Palace Grade Shou Cha'], GENERATED_DRAFT_PAGES)).toBe('gong-ting');
    expect(gradeIdFor(['Banzhang Gongting', '班章宫廷手扎龙珠'], GENERATED_DRAFT_PAGES)).toBe('gong-ting');
    expect(gradeIdFor(['Golden Bull Hengfengyuan Shou Cha'], GENERATED_TEA_REFERENCE_PAGES)).toBeUndefined();
    expect(gradeIdFor(['Ripe Puerh Brick'], GENERATED_DRAFT_PAGES)).toBeUndefined();
  });
});
