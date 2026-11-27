import { test, expect } from './fixtures';
import { installCompassHarness, openCompass } from './helpers/compassHarness';

test('bottom bar keeps the menu, the words, the logo and the account equidistant', async ({ page }, info) => {
  await installCompassHarness(page);
  for (const width of [320, 390, 430, 600, 768, 1023]) {
    await page.setViewportSize({ width, height: 844 });
    await openCompass(page);
    const bar = page.getByTestId('bottom-tab-bar');
    await expect(bar).toBeVisible();
    const metrics = await bar.evaluate(nav => {
      const rect=(element:Element)=>{const r=element.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right};};
      const center=nav.querySelector('.bottom-nav-center')!;
      const labels=[...nav.querySelectorAll('.bottom-nav-label')];
      return {nav:rect(nav), center:rect(center), labels:labels.map(rect), spacers:[...nav.querySelectorAll('.bottom-nav-spacer')].map(el=>({width:el.getBoundingClientRect().width,display:getComputedStyle(el).display})),
        dividers:['::before','::after'].map(pseudo=>getComputedStyle(center,pseudo).content),
        ink:[nav.querySelector('.bottom-nav-menu svg')!,...labels.map(l=>{const r=document.createRange();r.selectNodeContents(l);return r;}),nav.querySelector('.bottom-nav-center svg')!,nav.querySelector('.bottom-nav-account svg')!]
          .map(el=>el.getBoundingClientRect()).map(r=>({x:r.x,right:r.right})).sort((a,b)=>a.x-b.x),
        overflow:document.documentElement.scrollWidth>innerWidth};
    });
    expect(metrics.overflow).toBe(false);
    expect(metrics.dividers.every(content=>content==='none'||content==='normal')).toBe(true);
    expect(Math.abs(metrics.center.x + metrics.center.width / 2 - width / 2)).toBeLessThan(1);
    for (let i=1;i<metrics.labels.length;i++) expect(metrics.labels[i].x).toBeGreaterThan(metrics.labels[i-1].right);
    // Adrian, 2026-11-27: "it should be equidistant". The gaps between what
    // the bar draws (menu, each word, the logo, the account) match, within a
    // couple of pixels for the halves holding words of different lengths.
    expect(metrics.spacers.length).toBe(metrics.labels.length + 2);
    expect(metrics.spacers.every(spacer=>spacer.width>0)).toBe(true);
    const gaps=metrics.ink.slice(1).map((r,i)=>r.x-metrics.ink[i].right);
    expect(Math.min(...gaps)).toBeGreaterThan(4);
    expect(Math.max(...gaps)-Math.min(...gaps)).toBeLessThan(4);
    await bar.screenshot({ path:info.outputPath(`bottom-bar-${width}.png`), animations:'disabled' });
    await test.info().attach(`spacing-${width}`, { body:JSON.stringify(metrics), contentType:'application/json' });
  }
});
