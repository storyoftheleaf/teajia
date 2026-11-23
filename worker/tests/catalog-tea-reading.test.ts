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
