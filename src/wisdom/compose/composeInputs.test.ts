import { describe, expect, it } from 'vitest';
import { GENERATED_DRAFT_CLAIMS, GENERATED_DRAFT_PAGES } from '../reference/generatedDraftClaims';
import type { PublicClaim } from '../reference/claims';
import { ageBand, composeInputs, entryProblems, styleName, yearOf } from './composeInputs';

const pages = GENERATED_DRAFT_PAGES;

const claims = GENERATED_DRAFT_CLAIMS.map(claim => ({ ...claim, text: claim.pendingText ?? claim.text })) as unknown as PublicClaim[];
const naka = { id: 'dddd11d2-7357-4d91-86e8-52a99bb47c51', product_name: 'Naka Gushu', type: 'Shou Puer', form: 'Cake', year: null, origin_region: 'Mengsong, Menghai, Yunnan', origin_country: 'China' };
const brick = { id: 'brick', product_name: 'Ripe Puerh Brick', type: 'Shou Puer', form: 'Brick', year: 1990, origin_region: 'Yunnan', origin_country: 'China', terroir: 'This brick rested in Guangzhou’s tea trade.' };
const ids = (list?: PublicClaim[]) => (list ?? []).map(claim => claim.claimId);

const liuBao = { id: 'liu', product_name: 'Aged Liu Bao Tea', type: 'Dark', form: 'Loose Leaf', year: 1990, origin_region: 'Guangxi, southern China', origin_country: 'China' };

describe('composeInputs for any kit', () => {
  it('names a style the way a sentence needs it', () => {
    expect(styleName('Shou (ripe pu’er)')).toBe('ripe pu’er');
    expect(styleName('Dark tea (hei cha)')).toBe('dark tea');
    expect(styleName('Liu Bao')).toBe('Liu Bao');
    expect(styleName('Taiwan oolong')).toBe('Taiwan oolong');
    expect(styleName('Oolong (wulong)')).toBe('oolong');
  });

  it('gives a 1990 Liu Bao its own kit first and the dark tea family behind it', () => {
    const inputs = composeInputs(liuBao, claims, { thisYear: 2026, pages });
    const type = ids(inputs.layers.type);
    expect(type[0]).toBe('liu-bao:definition');
    expect(type).toContain('liu-bao:nanyang-trade');
    expect(type).toContain('dark:definition');
    expect(type).not.toContain('dark:making');
    expect(ids(inputs.layers.age)).toEqual(['liu-bao:age-aged']);
    expect(inputs.fixed.brewing?.text).toBe(claims.find(claim => claim.claimId === 'liu-bao:brewing')!.text);
    expect(inputs.fixed.notice?.styleName).toBe('aged Liu Bao');
    expect(inputs.fixed.claimIds).toEqual(['liu-bao:brewing', 'liu-bao:notice-aged']);
  });

  it('gives an aged raw pu’er the general ageing section and the aged style line', () => {
    const raw = { id: 'raw', product_name: 'Yiwu Raw Puerh', type: 'Sheng Puer', form: 'Cake', year: 2004, origin_region: 'Yiwu, Yunnan', origin_country: 'China' };
    const inputs = composeInputs(raw, claims, { thisYear: 2026, pages });
    expect(ids(inputs.layers.age)).toEqual(['sheng:ageing']);
    expect(inputs.fixed.notice?.styleName).toBe('aged Sheng Pu’er');
    expect(inputs.fixed.claimIds).toContain('sheng:notice-aged');
    const young = composeInputs({ ...raw, year: 2023 }, claims, { thisYear: 2026, pages });
    expect(ids(young.layers.age)).toEqual(['sheng:age-young']);
    expect(young.fixed.claimIds).toContain('sheng:common-impressions');
  });

  it('gives an aged Taiwan oolong its style kit first, the oolong family behind it, and the aged style line', () => {
    const dongDing = { id: 'dd', product_name: 'Dong Ding Aged', type: 'Oolong', form: 'Rolled', year: 1996, origin_region: 'Lugu, Nantou', origin_country: 'Taiwan' };
    const inputs = composeInputs(dongDing, claims, { thisYear: 2026, pages });
    const type = ids(inputs.layers.type);
    expect(type[0]).toBe('taiwan-oolong:definition');
    expect(type).toContain('oolong:definition');
    expect(ids(inputs.layers.age)).toEqual(['taiwan-oolong:ageing']);
    expect(inputs.fixed.notice?.styleName).toBe('aged Taiwan oolong');
    const anxi = composeInputs({ ...dongDing, id: 'dc', product_name: 'Mi Lan Xiang', origin_region: 'Phoenix, Guangdong', origin_country: 'China' }, claims, { thisYear: 2026, pages });
    expect(ids(anxi.layers.type)[0]).toBe('oolong:definition');
    expect(ids(anxi.layers.age)).toEqual(['oolong:ageing']);
    expect(anxi.fixed.notice?.styleName).toBe('aged oolong');
  });

  it('gives a Yunnan white its style kit and an aged Fuding cake only the white family', () => {
    const yecong = { id: 'yc', product_name: 'Yecong Ancient Forest', type: 'White', form: 'Loose Leaf', year: 2018, origin_region: 'Yunnan', origin_country: 'China' };
    const inputs = composeInputs(yecong, claims, { thisYear: 2026, pages });
    const type = ids(inputs.layers.type);
    expect(type[0]).toBe('yunnan-white:definition');
    expect(type).toContain('white:definition');
    expect(type).not.toContain('yunnan-white:yabao');
    expect(ids(inputs.layers.age)).toEqual(['yunnan-white:ageing']);
    const fuding = composeInputs({ ...yecong, id: 'fd', product_name: 'Fuding Eco', form: 'Cake', year: 2009, origin_region: 'Fuding, Fujian' }, claims, { thisYear: 2026, pages });
    expect(ids(fuding.layers.type)[0]).toBe('white:definition');
    expect(ids(fuding.layers.age)).toEqual(['white:ageing']);
    expect(fuding.fixed.notice?.styleName).toBe('aged white tea');
  });

  it('gives a Wuyi Rougui the rock tea kit with its own named section only', () => {
    const rougui = { id: 'rg', product_name: 'Lotus Rougui', type: 'Oolong', form: 'Loose Leaf', year: null, origin_region: 'Wuyi Mountains, Fujian', origin_country: 'China' };
    const type = ids(composeInputs(rougui, claims, { thisYear: 2026, pages }).layers.type);
    expect(type[0]).toBe('yancha:definition');
    expect(type).toContain('yancha:rougui');
    expect(type).not.toContain('yancha:da-hong-pao');
    expect(type).toContain('oolong:definition');
    const meizhan = composeInputs({ ...rougui, id: 'mz', product_name: 'Meizhan Yancha', year: 1990 }, claims, { thisYear: 2026, pages });
    expect(ids(meizhan.layers.age)).toEqual(['yancha:ageing']);
    expect(meizhan.fixed.notice?.styleName).toBe('aged Wuyi rock tea');
  });

  it('gives an Anxi Tieguanyin its kit, osmanthus only when scented, and Muzha only the Muzha section', () => {
    const anxi = { id: 'tgy', product_name: 'Tie Guan Yin', type: 'Oolong', form: 'Rolled', year: 1988, origin_region: 'Anxi, Fujian', origin_country: 'China' };
    const inputs = composeInputs(anxi, claims, { thisYear: 2026, pages });
    const type = ids(inputs.layers.type);
    expect(type[0]).toBe('tieguanyin:definition');
    expect(type).toContain('oolong:definition');
    expect(type).not.toContain('tieguanyin:osmanthus');
    expect(type).not.toContain('taiwan-oolong:muzha');
    expect(ids(inputs.layers.age)).toEqual(['tieguanyin:ageing']);
    expect(inputs.fixed.notice?.styleName).toBe('aged Tieguanyin');
    const scented = ids(composeInputs({ ...anxi, id: 'os', product_name: 'Osmanthus Tieguanyin', year: null }, claims, { thisYear: 2026, pages }).layers.type);
    expect(scented).toContain('tieguanyin:osmanthus');
    const muzha = ids(composeInputs({ ...anxi, id: 'mz', product_name: 'Taiwan Tie Guan Yin', year: 1972, origin_region: 'Muzha, Taipei', origin_country: 'Taiwan' }, claims, { thisYear: 2026, pages }).layers.type);
    expect(muzha).toContain('taiwan-oolong:definition');
    expect(muzha).toContain('taiwan-oolong:muzha');
    expect(muzha).not.toContain('tieguanyin:definition');
  });

  it('gives a 1920 Wuyi Lapsang the Lapsang kit, whose ageing replaces the red family line', () => {
    const lapsang = { id: 'ls', product_name: 'Lapsang Souchong', type: 'Red', form: 'Loose', year: 1920, origin_region: 'Wuyi Mountains, Fujian', origin_country: 'China' };
    const inputs = composeInputs(lapsang, claims, { thisYear: 2026, pages });
    const type = ids(inputs.layers.type);
    expect(type[0]).toBe('lapsang:definition');
    expect(type).toContain('lapsang:smoke');
    expect(type).toContain('red:definition');
    expect(ids(inputs.layers.age)).toEqual(['lapsang:ageing']);
    expect(inputs.fixed.notice?.styleName).toBe('aged Lapsang Souchong');
    const zhengshan = composeInputs({ ...lapsang, id: 'zs', product_name: 'Zhengshan Xiaozhong', year: null }, claims, { thisYear: 2026, pages });
    expect(zhengshan.fixed.claimIds).toContain('lapsang:brewing');
  });

  it('keeps the smoke out of a Wuyi red tea that is not Lapsang', () => {
    const zhuangyuan = { id: 'zy', product_name: 'Zhuangyuan Hong', type: 'Red', form: 'Loose', year: null, origin_region: 'Wuyi Mountains, Fujian', origin_country: 'China' };
    const inputs = composeInputs(zhuangyuan, claims, { thisYear: 2026, pages });
    const type = ids(inputs.layers.type);
    expect(type).toContain('lapsang:history');
    expect(type).not.toContain('lapsang:smoke');
    expect(type).not.toContain('lapsang:making');
    expect(inputs.fixed.claimIds).toEqual(expect.arrayContaining(['red:brewing', 'red:common-impressions']));
    expect(inputs.fixed.claimIds).not.toContain('lapsang:brewing');
    expect(inputs.fixed.notice?.text).not.toMatch(/smoke/i);
  });

  it('gives a dark tea outside Guangxi only the family kit', () => {
    const inputs = composeInputs({ ...liuBao, id: 'fu', product_name: 'Fu Brick', origin_region: 'Anhua, Hunan', form: 'Brick' }, claims, { thisYear: 2026, pages });
    expect(ids(inputs.layers.type)).not.toContain('liu-bao:definition');
    expect(ids(inputs.layers.type)[0]).toBe('dark:definition');
    expect(inputs.fixed.brewing?.text).toMatch(new RegExp(claims.find(claim => claim.claimId === 'dark:brewing-pressed')!.text.slice(0, 20).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  });
});

describe('composeInputs for a named tea', () => {
  const superseded = "San He, meaning Three Cranes, is the house brand of the Wuzhou Tea Factory, founded in 1953. Wuzhou is where modern liu bao production was concentrated, and the factory became the best-known name in the category, its mark widely respected across southern China and Southeast Asia.";
  const sanHe = { id: 'b11a8bad-89d9-4518-9406-25145d4c6e2c', product_name: 'San He Liu Bao', type: 'Dark', form: 'Loose Leaf', year: '1990s', origin_region: 'Wuzhou, Guangxi', origin_country: 'China', lore: superseded, processing_notes: 'anything' };

  it('leads with the named history and keeps the Liu Bao kit behind it', () => {
    const inputs = composeInputs(sanHe, claims, { thisYear: 2026, pages });
    expect(ids(inputs.layers.named)).toEqual(expect.arrayContaining(['san-he-liu-bao:three-cranes']));
    expect(ids(inputs.layers.named).every(id => id.startsWith('san-he-liu-bao:'))).toBe(true);
    expect(ids(inputs.layers.type)[0]).toBe('liu-bao:definition');
  });

  it('never feeds the writer prose the review superseded', () => {
    const inputs = composeInputs(sanHe, claims, { thisYear: 2026, pages });
    expect(inputs.record.notes).not.toContain(superseded);
    // San He's review replaces nothing in its lore, so the superseded lore is simply dropped.
    expect(inputs.record.notes).toEqual(['anything']);
  });

  it('gives a tea that is not a confirmed lot no named layer, whatever its name', () => {
    const inputs = composeInputs({ ...sanHe, id: 'someone-else' }, claims, { thisYear: 2026, pages });
    expect(inputs.layers.named).toBeUndefined();
  });
});

describe('composeInputs', () => {
  it('reads years and decades', () => {
    expect(yearOf(1990)).toEqual({ label: '1990', year: 1990 });
    expect(yearOf('1980s')).toEqual({ label: 'the 1980s', year: 1985 });
    expect(yearOf('')).toBeNull();
    expect([ageBand(2), ageBand(7), ageBand(36)]).toEqual(['age-young', 'age-settling', 'age-aged']);
  });

  it('gives Naka its place and type, no age and no notice', () => {
    const inputs = composeInputs(naka, claims, { thisYear: 2026, noNotice: [naka.id], pages });
    expect(ids(inputs.layers.place)).toContain('menghai-county:mengsong-naka');
    expect(ids(inputs.layers.type)).toEqual(expect.arrayContaining(['shou:definition', 'shou:wet-piling', 'puer:definition'].filter(id => claims.some(claim => claim.claimId === id))));
    expect(ids(inputs.layers.type).every(id => !/age-|brewing|notice|common-impressions/.test(id))).toBe(true);
    expect(inputs.layers.age).toBeUndefined();
    expect(inputs.fixed.notice).toBeUndefined();
    expect(inputs.fixed.brewing?.text).toMatch(/^From a cake, brick or tuo/);
    expect(inputs.missing[0]).toMatch(/year/);
  });

  it('gives a thin 1990 brick the aged band and brewing, and reads no place from Yunnan alone', () => {
    const inputs = composeInputs(brick, claims, { thisYear: 2026, pages });
    expect(inputs.record.ageYears).toBe(36);
    expect(ids(inputs.layers.age)).toEqual(['shou:age-aged']);
    expect(inputs.fixed.claimIds).toEqual(['shou:brewing-pressed', 'shou:brewing', 'shou:notice-aged']);
    expect(inputs.fixed.notice?.styleName).toBe('aged ripe pu’er');
    const loose = composeInputs({ ...brick, form: 'Loose Leaf', year: 2022 }, claims, { thisYear: 2026, pages });
    expect(loose.fixed.brewing?.text).not.toMatch(/pick/);
    expect(loose.fixed.notice?.styleName).toBe('ripe pu’er');
    expect(inputs.layers.place).toBeUndefined();
    expect(inputs.record.notes).toEqual([brick.terroir]);
  });

  it('flags dashes, foreign links, taste in the story and invented numbers', () => {
    const inputs = composeInputs(brick, claims, { thisYear: 2026, pages });
    const problems = entryProblems({
      productId: 'brick', missing: [],
      paragraphs: [{ layer: 'age', text: 'A [ripe](sheng:definition) brick — sweet and pressed in 1991.' }],
    }, inputs).map(problem => problem.problem);
    expect(problems).toEqual(expect.arrayContaining([
      'links sheng:definition, which was not supplied', 'uses a dash; the house style has none', 'taste word "sweet" belongs in the notice', 'the number 1991 is in no input',
    ]));
    expect(entryProblems({ productId: 'brick', missing: [], paragraphs: [{ layer: 'lot', text: 'A brick from 1990.' }], notice: { layer: 'notice', styleName: 'aged ripe pu’er', text: 'People often find it smooth.' } }, inputs)
      .map(problem => problem.problem)).toContain('the notice speaks of this lot ("it", "this"); describe the style instead');
    expect(entryProblems({ productId: 'brick', missing: [], paragraphs: [{ layer: 'lot', text: 'A [ripe pu’er](shou:definition) brick from 1990, kept in Guangzhou.' }] }, inputs)).toEqual([]);
  });
});
