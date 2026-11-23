import { expect, test } from './fixtures';
import { injectAuth, mockInventoryApi } from './helpers/inventoryMocks';

const root = '/admin/catalog-review/teas';
const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/HwAAAABJRU5ErkJggg==';
const items = [
  { id: 'tea-10', title: 'Private loose tea', status: 'Confirmed Stock lot' },
  { id: 'tea-21', title: 'Handwritten bag', status: 'Identity under review' },
];

test('owner can read each intake description next to its leaf or labelled reference', async ({ page }) => {
  await injectAuth(page);
  await page.route('**/api/**', route => route.fulfill({ json: {} }));
  await mockInventoryApi(page);
  await page.route('**/api/admin/catalog-review/teas**', route => {
    expect(route.request().headers().authorization).toMatch(/^Bearer /);
    const id = new URL(route.request().url()).pathname.split('/').at(-1);
    if (id === 'decisions') return route.fulfill({json:{intake:{},passages:[],holds:[],histories:[],verdicts:{}}});
    if (id === 'teas') return route.fulfill({ json: items });
    const entry = items.find(item => item.id === id)!;
    const isPackage = entry.id === 'tea-21';
    return route.fulfill({ json: { ...entry, packageOnly: isPackage, type: isPackage ? '' : 'Dark',
      introduction: 'Introduction for ' + entry.title + '.', nextCheck: 'Verify the count.', evidence: 'Recorded from the label.',
      photos: [image], facts: [], stockId: isPackage ? undefined : 'confirmed-product',
    } });
  });
  await page.goto(root);
  for (const entry of items) {
    await page.getByRole('link', { name: new RegExp(entry.title) }).click();
    const intro = page.getByText('Introduction for ' + entry.title + '.', { exact: true });
    await expect(intro).toBeVisible();
    const photo = page.getByRole('img', { name: (entry.id === 'tea-21' ? 'Package for ' : '') + entry.title, exact: true });
    await expect(photo).toBeVisible();
    expect(await photo.evaluate(img => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    expect(await photo.evaluate((img, text) => Array.from(document.querySelectorAll('p')).some(p =>
      p.textContent === text && Boolean(img.compareDocumentPosition(p) & Node.DOCUMENT_POSITION_FOLLOWING)), await intro.textContent())).toBeTruthy();
    await expect(page.getByText('Private package reference', { exact: true })).toHaveCount(entry.id === 'tea-21' ? 1 : 0);
    await expect(page.getByRole('link', { name: 'Open Stock record' })).toHaveCount(entry.id === 'tea-10' ? 1 : 0);
    await page.getByRole('link', { name: 'All tea write-ups' }).click();
  }
});

test('owner can decide exact wording and distinguish sourcing from named histories', async ({ page }) => {
  await injectAuth(page);
  await mockInventoryApi(page);
  const passage={id:'history-basket',revision:'source-revision',kind:'Shared history',title:'River packing',text:'Packers lined baskets.',
    scope:'Historical trade in Wuzhou.',sources:[{title:'Oral history',url:'https://example.org/source'}],lots:[{title:'Basket tea',url:'/shop/product/basket'}]};
  let verdicts: Record<string,{decision:string; version:number}> = {};
  await page.route('**/api/admin/catalog-review/teas**',async route=>{
    const suffix=new URL(route.request().url()).pathname.split('/teas')[1];
    if (!suffix) return route.fulfill({json:items});
    if (suffix==='/decisions') return route.fulfill({json:{passages:[{...passage,id:'lot-1',title:'Basket tea',kind:'Lot opening'},passage],
      intake:{'tea-10':{nextCheck:'Count the tea.'}},holds:[{title:'Ginseng Puer',url:'/shop/product/ginseng',locator:'Check the ingredient label.'}],
      histories:[{title:'Y562',url:'/shop/product/y562',wisdom:'/wisdom/named/y562'}],verdicts}});
    expect(route.request().method()).toBe('PUT');
    const {decision,revision,version}=route.request().postDataJSON();
    expect(revision).toBe(passage.revision);
    verdicts={...verdicts,[passage.id]:{decision,version:version+1}};
    return route.fulfill({json:verdicts[passage.id]});
  });
  await page.goto(root);
  await expect(page.getByText('Count the tea.')).toBeVisible();
  await page.getByRole('button',{name:'Editorial review'}).click();
  await page.getByRole('button',{name:/Shared passages/}).click();
  await expect(page.getByText(passage.text)).toBeVisible();
  await page.getByRole('button',{name:'Decline',exact:true}).click();
  await expect(page.getByRole('status',{name:''}).filter({hasText:'Declined'})).toBeVisible();
  await page.reload();
  await page.getByRole('button',{name:/Shared passages/}).click();
  await expect(page.getByRole('button',{name:'Decline',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Approve wording'}).click();
  await expect(page.getByText('Approved',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Identity checks'}).click();
  await expect(page.getByText('Check the ingredient label.')).toBeVisible();
  await page.getByRole('button',{name:'Named histories'}).click();
  await expect(page.getByRole('link',{name:'Tea Wisdom'})).toHaveAttribute('href','/wisdom/named/y562');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
