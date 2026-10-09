import { test, expect } from './fixtures';
import { installCompassHarness, expectNoUnhandledCompassApi } from './helpers/compassHarness';

for (const [tree, path] of [['Curate', '/admin/compass'], ['CurateV2', '/admin/compass/v2']] as const) {
  test(`${tree} previews the chosen history entry without an automatic write`, async ({ page }, testInfo) => {
    await installCompassHarness(page, { compassEntries: [{ id: 'undo-tea', account_id: 'acct-bali', name: 'Sample for undo', category: 'tea', status: 'noted', photos: '[]', audio_clips: '[]', created_at: '2026-10-08T00:00:00Z', updated_at: '2026-10-08T00:00:00Z' }] });
    await page.route('**/api/curate/attachments?*', route => route.fulfill({ json: [] }));
    const change = { entity_type: 'tea', entity_id: 'undo-tea', before_json: JSON.stringify({name:'Old name'}), after_json: JSON.stringify({name:'Sample for undo'}) };
    await page.route('**/api/curate/history?*', route => route.fulfill({ json: { history: [{id:'old-change',agent_name:'GrokBot',command_type:'tea:edit',confirmed_at:'2026-10-08T00:00:00Z',records:[change]}] } }));
    const writes: any[] = [];
    await page.route('**/api/curate/undo', route => {
      const input=route.request().postDataJSON();writes.push(input);
      return route.fulfill({ json: {confirmation_token:'chosen-token',preview:{changes:[{entity:'tea',id:'undo-tea',before:{name:'Sample for undo'},after:{name:'Old name'}}]}} });
    });
    await page.goto(`${path}?entry=undo-tea`);
    if(tree==='CurateV2') await page.getByRole('button',{name:'Edit all fields',exact:true}).click();
    const tools=page.getByRole('region',{name:'Files and change history'}).filter({visible:true}).first();
    await tools.getByText('Change history (1)',{exact:true}).click();
    await tools.getByRole('button',{name:'Preview undo',exact:true}).click();
    const preview=tools.getByRole('region',{name:'Confirm change'});
    await expect(preview).toContainText('Undo this change?');
    await expect(preview).toBeInViewport();
    expect(writes).toEqual([{mutation_id:'old-change'}]);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
    await page.screenshot({path:`/tmp/teajia-undo-${tree}-${testInfo.project.name.replace(/ /g,'-')}.png`});
    await preview.getByRole('button',{name:'Cancel',exact:true}).click();
    expect(writes).toHaveLength(1);
    await expectNoUnhandledCompassApi(page);
  });
}
