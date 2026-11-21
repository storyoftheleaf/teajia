import { test, expect } from './fixtures';
import { installCompassHarness, openCompass } from './helpers/compassHarness';

test('bottom bar preserves narrow fit and restores balanced wider spacing', async ({ page }, info) => {
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
        overflow:document.documentElement.scrollWidth>innerWidth};
    });
    expect(metrics.overflow).toBe(false);
    expect(metrics.dividers.every(content=>content==='none'||content==='normal')).toBe(true);
    expect(Math.abs(metrics.center.x + metrics.center.width / 2 - width / 2)).toBeLessThan(1);
    for (let i=1;i<metrics.labels.length;i++) expect(metrics.labels[i].x).toBeGreaterThan(metrics.labels[i-1].right);
    if(width>=400) {
      expect(metrics.spacers).toHaveLength(4);
      expect(metrics.spacers.every(spacer=>spacer.width>0)).toBe(true);
      expect(Math.max(...metrics.spacers.map(x=>x.width))-Math.min(...metrics.spacers.map(x=>x.width))).toBeLessThan(5);
    } else expect(metrics.spacers.every(spacer=>spacer.display==='none')).toBe(true);
    await bar.screenshot({ path:info.outputPath(`bottom-bar-${width}.png`), animations:'disabled' });
    await test.info().attach(`spacing-${width}`, { body:JSON.stringify(metrics), contentType:'application/json' });
  }
});
