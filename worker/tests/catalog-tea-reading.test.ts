import { expect, it } from 'vitest';
import { serveCatalogTeaReading } from '../src/catalogTeaReading';
import { SqliteD1, seedIdentity } from './helpers/sqliteD1';

it('serves the packet only to its named owner and scopes every read to the active account', async () => {
  const db = new SqliteD1('schema');
  try {
    const accountId = 'shop';
    for (const [userId, role] of [['owner', 'owner'], ['second', 'owner'], ['staff', 'staff']] as const) {
      seedIdentity(db, { accountId, userId, role });
    }
    seedIdentity(db, { accountId: 'elsewhere', userId: 'another', role: 'owner' });
    const digest = 'a'.repeat(64);
    const base = '/api/admin/catalog-review/teas';
    const prefix = 'owner-review/shop/catalog-reading/';
    const items = [{ id: 'tea-10', title: 'Loose tea', status: 'In review', digest }];
    const files = new Map([[prefix + 'index.json', JSON.stringify({ ownerUserId: 'owner', items })],
      [prefix + 'pages/' + digest + '.json', JSON.stringify({ introduction: 'Private paragraph', photos: ['private image'] })]]);
    const env = { DB: db, ATLAS_BUCKET: {
      get: async (key: string) => files.has(key) ? new Response(files.get(key)) : null,
      head: async (key: string) => files.has(key) ? {} : null,
    } } as unknown as Parameters<typeof serveCatalogTeaReading>[1];
    const read = (path = '', user = 'owner', account = accountId, method = 'GET') => serveCatalogTeaReading(
      new Request('https://example.org' + base + path, { method }), env,
      async () => user ? { userId: user, accountId: account } : { error: new Response(null, { status: 401 }) },
    );
    expect(await (await read()).json()).toEqual([{ id: 'tea-10', title: 'Loose tea', status: 'In review' }]);
    expect(await (await read('/tea-10')).json()).toMatchObject({ introduction: 'Private paragraph', photos: ['private image'] });
    for (const method of ['GET', 'HEAD']) {
      for (const [user, account, code] of [['', 'shop', 401], ['staff', 'shop', 403], ['second', 'shop', 403],
        ['owner', 'elsewhere', 403], ['another', 'elsewhere', 404]] as const) {
        const result = await read('/tea-10', user, account, method);
        expect(result.status).toBe(code);
        expect(result.headers.get('Cache-Control')).toContain('no-store');
        expect(await result.text()).toBe('');
      }
    }
    expect((await read('/absent')).status).toBe(404);
    expect((await read('/tea-10', 'owner', accountId, 'PUT')).status).toBe(405);
    const head = await read('/tea-10', 'owner', accountId, 'HEAD');
    expect(head.status).toBe(200);
    expect(await head.text()).toBe('');
  } finally {
    db.close();
  }
});

it('binds decisions to the owner, exact passage revision and current verdict without publishing', async () => {
  const db = new SqliteD1('schema');
  try {
    seedIdentity(db,{accountId:'bali',userId:'adrian',role:'owner'});
    seedIdentity(db,{accountId:'bali',userId:'colleague',role:'owner'});
    const prefix='owner-review/bali/catalog-reading/';
    const files=new Map<string,string>();
    files.set(prefix+'index.json',JSON.stringify({ownerUserId:'adrian',items:[]}));
    const packet=(revision:string)=>JSON.stringify({passages:[{id:'lot-1',revision}],histories:[],holds:[],intake:{}});
    files.set(prefix+'editorial.json',packet('one'));
    let writes=0;
    const bucket={
      get:async(key:string)=>files.has(key)?Object.assign(new Response(files.get(key)),{etag:'v'+writes}):null,
      put:async(key:string,value:string,opts:{onlyIf:{etagMatches?:string;etagDoesNotMatch?:string}})=>{
        if (files.has(key)?opts.onlyIf.etagMatches!=='v'+writes:opts.onlyIf.etagDoesNotMatch!=='*') return null;
        files.set(key,value);writes++;return {};
      },
    };
    const env={DB:db,ATLAS_BUCKET:bucket} as unknown as Parameters<typeof serveCatalogTeaReading>[1];
    const call=(path:string,body?:object,user='adrian')=>serveCatalogTeaReading(
      new Request('https://example.org/api/admin/catalog-review/teas/decisions'+path,body?{
        method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),
      }:{}),env,async()=>({userId:user,accountId:'bali'}));
    const proposal={revision:'one',version:0,decision:'declined'};
    expect((await call('/lot-1',proposal,'colleague')).status).toBe(403);
    expect((await call('/lot-1',{...proposal,revision:'wrong'})).status).toBe(409);
    expect((await call('/absent',proposal)).status).toBe(404);
    expect((await call('/lot-1',{...proposal,decision:'publish'})).status).toBe(400);
    expect(await (await call('/lot-1',proposal)).json()).toEqual({version:1,decision:'declined'});
    expect((await call('/lot-1',proposal)).status).toBe(200);
    expect((await call('/lot-1',{...proposal,decision:'approved'})).status).toBe(409);
    expect(writes).toBe(1);
    expect((await (await call('')).json() as any).verdicts['lot-1'].decision).toBe('declined');
    files.set(prefix+'editorial.json',packet('two'));
    expect((await (await call('')).json() as any).verdicts).toEqual({});
    expect((await call('/lot-1',{revision:'two',version:0,decision:'approved'})).status).toBe(200);
    expect((await call('/lot-1',{revision:'two',version:1,decision:'withdrawn'})).status).toBe(200);
    const decisions=JSON.parse(files.get(prefix+'editorial-decisions/adrian.json')!);
    expect(decisions['lot-1/one'].decision).toBe('declined');
    expect(decisions['lot-1/two'].decision).toBe('withdrawn');
  } finally {db.close();}
});

it('persists vendor selection against the approved intake or Stock target and keeps findings private', async () => {
  const db = new SqliteD1('schema');
  try {
    seedIdentity(db, { accountId: 'bali', userId: 'adrian', role: 'owner' });
    seedIdentity(db, { accountId: 'bali', userId: 'staff', role: 'staff' });
    seedIdentity(db, { accountId: 'elsewhere', userId: 'other', role: 'owner' });
    const ids = ['a'.repeat(64), 'b'.repeat(64)];
    const url = '/shop/product/exact-tea';
    const insertProduct = db.sqlite.prepare(`INSERT INTO products (id, account_id, product_name, slug, vendor, vendor_id, type, cost_amount, cost_currency, cost_currency_source, shipping_rate_per_kg, markup_multiplier) VALUES (?, ?, ?, ?, ?, ?, 'Shou', NULL, NULL, NULL, NULL, NULL)`);
    insertProduct.run('stock-tea', 'bali', 'Exact tea', 'exact-tea', 'Stored display text', 'vendor-a');
    insertProduct.run('foreign-tea', 'elsewhere', 'Unrelated tea', 'other-tea', 'Other vendor', null);
    const insertContact = db.sqlite.prepare('INSERT INTO customers (id, account_id, name, tags, archived_at) VALUES (?, ?, ?, ?, ?)');
    for (const [id, account, name, tags, archived] of [
      ['vendor-a', 'bali', 'Vendor A', '["vendor"]', null],
      ['vendor-b', 'bali', 'Vendor B', '["vendor"]', null],
      ['buyer', 'bali', 'Buyer', '["buyer"]', null],
      ['foreign-vendor', 'elsewhere', 'Foreign vendor', '["vendor"]', null],
      ['archived-vendor', 'bali', 'Archived vendor', '["vendor"]', '2026-11-01'],
    ] as const) insertContact.run(id, account, name, tags, archived);
    const prefix = 'owner-review/bali/catalog-reading/';
    const files = new Map<string, string>([
      [prefix + 'index.json', JSON.stringify({ ownerUserId:'adrian', items: ['basket','exact'].map((id, i) => ({ id, title:id, digest:ids[i] })) })],
      [prefix + 'pages/' + ids[0] + '.json', JSON.stringify({ id:'basket', candidateStockId:'stock-tea', photos:['private'] })],
      [prefix + 'pages/' + ids[1] + '.json', JSON.stringify({ id:'exact', stockId:'stock-tea' })],
      [prefix + 'editorial.json', JSON.stringify({ holds:[{title:'Exact tea',url}], histories:[], passages:[], intake:{} })],
    ]);
    let clock=0;
    const etags = new Map<string,string>();
    const env = { DB: db, ATLAS_BUCKET: {
      get: async (key:string) => files.has(key) ? Object.assign(new Response(files.get(key)), {etag:etags.get(key)}) : null,
      put: async (key:string, value:string, {onlyIf}:{onlyIf:{etagMatches?:string; etagDoesNotMatch?:string}}) => {
        if (files.has(key) ? onlyIf.etagMatches !== etags.get(key) : onlyIf.etagDoesNotMatch !== '*') return null;
        files.set(key, value);
        etags.set(key, String(++clock));
        return {};
      },
    } } as unknown as Parameters<typeof serveCatalogTeaReading>[1];
    const call = (view:string, id:string, body?:object, user='adrian', accountId='bali') => serveCatalogTeaReading(
      new Request('https://example.org/api/admin/catalog-review/teas/connection?' + new URLSearchParams({view,id}), body ? {
        method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body),
      } : {}), env, async () => user ? { accountId, userId:user } : {error:new Response(null,{status:401})});
    const read = async (view:string,id:string) => {
      const result = await call(view,id);
      expect(result.status).toBe(200);
      expect(result.headers.get('Cache-Control')).toContain('no-store');
      return result.json();
    };
    const vendor = (expected:object, vendorId:string|null) => ({ action:'vendor', expected, vendorId });
    const basket = await read('intake','basket');
    expect(basket).toMatchObject({ stockId:null, vendorId:null, version:0 });
    const displayFields = db.sqlite.prepare('SELECT is_public, shown_in_shop, description, stock_grams FROM products WHERE id=?');
    const beforeDisplay = displayFields.get('stock-tea');
    const original = await read('intake','exact');
    expect(original).toMatchObject({ stockId:'stock-tea', vendor:{id:'vendor-a',name:'Vendor A'} });
    expect((await call('intake','basket',vendor(basket,'vendor-b'),'')).status).toBe(401);
    expect((await call('intake','basket',vendor(basket,'vendor-b'),'staff')).status).toBe(403);
    expect((await call('intake','basket',vendor(basket,'vendor-b'),'other','elsewhere')).status).toBe(404);
    expect((await call('intake','unknown',vendor(basket,'vendor-b'))).status).toBe(404);
    expect((await call('intake','basket',vendor({...basket, stockId:'stock-tea'},'vendor-b'))).status).toBe(409);
    for (const id of ['foreign-vendor','buyer','archived-vendor']) {
      expect((await call('intake','exact',vendor(original,id))).status).toBe(400);
    }
    expect((await call('intake','basket',vendor(basket,'vendor-b'))).status).toBe(200);
    expect((await read('intake','basket')).vendor).toEqual({id:'vendor-b',name:'Vendor B'});
    expect((await read('intake','exact')).vendorId).toBe('vendor-a');
    expect((await call('intake','basket',vendor(basket,null))).status).toBe(409);
    expect((await call('intake','exact',vendor(original,'vendor-b'))).status).toBe(200);
    expect(db.sqlite.prepare('SELECT vendor FROM products WHERE id=?').get('stock-tea')).toEqual({vendor:'Vendor B'});
    expect((await call('intake','exact',vendor(original,null))).status).toBe(409);
    const hold = await read('holds',url);
    expect(hold).toMatchObject({stockId:'stock-tea',vendorId:'vendor-b'});
    const saved = await call('holds',url,{action:'finding',expected:hold,text:'Supplier identified the commune.',resolved:true});
    expect(saved.status).toBe(200);
    expect((await read('holds',url)).finding).toEqual({text:'Supplier identified the commune.',resolved:true});
    expect((await read('intake','exact')).finding).toBeNull();
    expect((await call('holds',url,{action:'finding',expected:hold,text:'Outdated change',resolved:false})).status).toBe(409);
    const fresh = await read('holds',url);
    expect((await call('holds',url,vendor(fresh,null))).status).toBe(200);
    const product = db.sqlite.prepare('SELECT vendor, vendor_id FROM products WHERE id=?').get('stock-tea');
    expect(product).toEqual({vendor:null,vendor_id:null});
    expect(displayFields.get('stock-tea')).toEqual(beforeDisplay);
    expect(clock).toBe(2);
    expect(files.get(prefix + 'pages/' + ids[0] + '.json')).toContain('private');
    expect((await call('holds', '/shop/product/other-tea')).status).toBe(404);
  } finally {
    db.close();
  }
});
