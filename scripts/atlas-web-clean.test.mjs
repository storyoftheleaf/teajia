import { describe, expect, it } from 'vitest';
import { cleanWebBlocks, repairWords } from './atlas-web-clean.mjs';

// Real lines from The Chinese Tea Shop and Ooika pages saved as PDF.
const p = v => ({ t: 'p', v });
const h = v => ({ t: 'h', v });

describe('a saved web page, without the shop around it', () => {
  const page = [
    h(''),
    p('(/ACCOUNT/LOGIN) $ USD'),
    p('Home (/)'),
    p('Learn (/pages/learn) Ask the Tea Wizard (/pages/ask-the-tea-wizard) About Us (/pages/about-us)'),
    p('Home  Learn  About Chinese Tea  How To Make Tea'),
    h('e Quick Way - 5 Easy Steps Step 1'),
    p('Rinse a teapot, small teacups and a small pitcher with hot water, then pour it away.'),
    h('About Types of Chinese'),
    p('Tea (/pages/chinese-teatypes)'),
    p('For detailed instructions, see Gong Fu Cha - The Complete Guide by Daniel Lui. (/pages/gong-fu-cha-the-'),
    p('Iron Buddha Oolong $149.95 USD Sold Out'),
    h('Learn Menu'),
    p('#1 size'), p('70 / 2.4'), p('#2'), p('100 / 3.4'),
    p('Rinse a teapot, small teacups and a small pitcher with hot water, then pour it away.'),
    h('Top of Page'),
    p('All content © The Chinese Tea Shop unless otherwise indicated. All rights reserved.'),
  ];
  const out = cleanWebBlocks(page).map(b => b.v);

  it('starts at the article and stops at the footer', () => {
    expect(out[0]).toBe('The Quick Way - 5 Easy Steps Step 1');
    expect(out.join('\n')).not.toMatch(/Top of Page|All rights reserved|ACCOUNT|Home/);
  });

  it('drops menus, breadcrumbs, price tags, promotions and link addresses', () => {
    const text = out.join('\n');
    expect(text).not.toMatch(/About Types of Chinese|Sold Out|Learn Menu|\(\/|/);
    expect(text).toContain('see Gong Fu Cha - The Complete Guide by Daniel Lui.');
  });

  it('keeps a table as one line and says each thing once', () => {
    expect(out).toContain('#1 size 70 / 2.4 #2 100 / 3.4');
    expect(out.filter(v => v.startsWith('Rinse a teapot'))).toHaveLength(1);
  });

  it('drops the title printed again above the text', () => {
    const blocks = cleanWebBlocks([h('How To Store Pu-Erh Tea - By Daniel Lui'), p('Pu-erh tea is one of the most famous in an entire class of Chinese teas.')], 'How To Store Pu-Erh Tea');
    expect(blocks.map(b => b.v)).toEqual(['Pu-erh tea is one of the most famous in an entire class of Chinese teas.']);
  });

  it('cuts an Ooika page at its comments and drops the dateline', () => {
    const blocks = cleanWebBlocks([
      h('CHINESE TE A AUG 22'),
      p('If you are a fan of tea, then you have probably heard of Pu Er tea by now.'),
      p('COMMENTS (0)'),
      p('© 2024 Ooika LLC. All Rights Reserved.'),
    ]);
    expect(blocks.map(b => b.v)).toEqual(['If you are a fan of tea, then you have probably heard of Pu Er tea by now.']);
  });
});

describe('letters the font drew as one glyph', () => {
  it('puts "Th" back', () => {
    expect(repairWords('Why Expensive Tea Is Cheaper an Inexpensive Tea')).toBe('Why Expensive Tea Is Cheaper Than Inexpensive Tea');
  });
});
