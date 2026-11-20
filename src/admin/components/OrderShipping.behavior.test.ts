import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';
let server: ViteDevServer; let browser: Browser; let page: Page; let origin: string;
beforeAll(async()=>{
 server=await createServer({root:process.cwd(),cacheDir:'/tmp/teajia-shipping-notice-ui-cache',logLevel:'silent',server:{host:'127.0.0.1',port:17943,strictPort:true,watch:{ignored:['**/outputs/**','**/.claude/**','**/.worktrees/**']}},plugins:[{name:'shipping-notice-test-page',configureServer(vite){vite.middlewares.use('/__shipping-notice-test',async(_req,res)=>{res.setHeader('Content-Type','text/html');res.end(await vite.transformIndexHtml('/__shipping-notice-test','<div id="root"></div><script type="module" src="/src/admin/components/OrderShipping.behavior.harness.tsx"></script>'));});}}]});
 await server.listen();origin='http://127.0.0.1:17943';browser=await chromium.launch({headless:true});
},30000);
afterAll(async()=>{await page?.close();await browser?.close();await server?.close();},30000);
beforeEach(async()=>{await page?.close();page=await browser.newPage({viewport:{width:390,height:844}});await page.route('**/api/**',route=>route.fulfill({json:[]}));await page.goto(origin+'/__shipping-notice-test');await page.waitForFunction(()=>!!(window as any).shippingTest);},30000);
async function save(next:Record<string,unknown>){await page.evaluate(value=>(window as any).shippingTest.mount(value),next);await page.getByLabel('Shipping quote (USD)').fill('8');await page.getByRole('button',{name:'Save shipping',exact:true}).click();}
it('shows an accepted email request after saving the quote',async()=>{
 await save({state:'accepted',channel:'email',accepted_at:'2026-11-20T00:00:00Z'});
 await expect.poll(()=>page.getByText('Shipping payment request sent by email.',{exact:true}).count()).toBe(1);
 expect(await page.evaluate(()=>(window as any).shippingTest.calls())).toEqual([{shipping_cost_usd:8,shipping_destination:null,tracking_number:null}]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'/Users/adrianrasmussen/.codex/visualizations/2026/11/20/shipping-notification-ui/email-accepted-TEST-PREVIEW.png',fullPage:true});
});
it('keeps a blocked WhatsApp request explicitly unsent after the quote is saved',async()=>{
 await save({state:'config_required',channel:'whatsapp',code:'whatsapp_setup_required'});
 await expect.poll(()=>page.getByText('Shipping saved. WhatsApp sending is not ready, so the payment request has not been sent.',{exact:true}).count()).toBe(1);
 expect(await page.getByText('Shipping payment request sent by WhatsApp.',{exact:true}).count()).toBe(0);
 await page.screenshot({path:'/Users/adrianrasmussen/.codex/visualizations/2026/11/20/shipping-notification-ui/whatsapp-unavailable-TEST-PREVIEW.png',fullPage:true});
});
it('discards a send status that arrives after switching the active account',async()=>{
 await page.evaluate(()=>(window as any).shippingTest.mount({state:'accepted',channel:'whatsapp'}));
 await page.evaluate(()=>(window as any).shippingTest.deferStatus());
 await page.getByLabel('Shipping quote (USD)').fill('8');await page.getByRole('button',{name:'Save shipping',exact:true}).click();
 await page.evaluate(()=>(window as any).shippingTest.switchAccount());
 await page.evaluate(()=>(window as any).shippingTest.resolveStatus({state:'accepted',channel:'email'}));
 await expect.poll(()=>page.getByText('Shipping payment request sent by email.',{exact:true}).count()).toBe(0);
});
