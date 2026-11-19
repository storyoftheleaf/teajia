import { test, expect } from './fixtures';
import { installCompassHarness, openCompass, expectNoUnhandledCompassApi } from './helpers/compassHarness';

test('Source Save waits for the exact tea acknowledgement and works while periodic sync is paused', async ({page})=>{
 await installCompassHarness(page);
 await page.route('**/api/compass/sync',route=>route.fulfill({status:503,json:{code:'shared_allowance_paused',reason:'background_paused'}}));
 let finish!:()=>void;
 const held=new Promise<void>(resolve=>{finish=resolve});
 let saved:any;
 await page.route('**/api/compass/entries/*/save',async route=>{saved=route.request().postDataJSON();await held;await route.fallback()});
 await openCompass(page,'flow');
 const name=page.getByPlaceholder('Tea name').filter({visible:true});
 await name.fill('Acknowledged Source tea');
 await page.getByRole('button',{name:'Save tea',exact:true}).filter({visible:true}).click();
 await expect.poll(()=>saved?.entry?.name).toBe('Acknowledged Source tea');
 await expect(name).toHaveValue('Acknowledged Source tea');
 await expect(page.getByRole('button',{name:'Save tea',exact:true}).filter({visible:true})).toBeDisabled();
 finish();
 await expect(name).toHaveValue('');
 await page.getByRole('tab',{name:'Library',exact:true}).filter({visible:true}).click();
 await expect(page.getByRole('button',{name:'Edit tea name: Acknowledged Source tea',exact:true})).toBeVisible();
 expectNoUnhandledCompassApi(page);
});

test('a refused Source Save keeps the same editor and retries the same tea ID',async({page})=>{
 await installCompassHarness(page);
 let reject=true;const ids:string[]=[];
 await page.route('**/api/compass/entries/*/save',async route=>{ids.push(route.request().postDataJSON().entry.id);if(reject)await route.fulfill({status:503,json:{error:'Save temporarily unavailable'}});else await route.fallback()});
 await openCompass(page,'flow');
 const name=page.getByPlaceholder('Tea name').filter({visible:true});await name.fill('Retained Source tea');
 const save=page.getByRole('button',{name:'Save tea',exact:true}).filter({visible:true});await save.click();
 await expect(page.getByRole('alert').filter({visible:true})).toContainText('Save temporarily unavailable');
 await expect(name).toHaveValue('Retained Source tea');
 reject=false;await save.click();await expect(name).toHaveValue('');
 expect(new Set(ids).size).toBe(1);
 expectNoUnhandledCompassApi(page);
});
