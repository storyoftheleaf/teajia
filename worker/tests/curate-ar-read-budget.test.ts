import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { handleArBridge } from '../src/curateArBridge';
import { SqliteD1 } from './helpers/sqliteD1';

const migration = 'worker/migrations/0051_curate_ar_poll_read_indexes.sql';

it('keeps idle poll work bounded as expired archive jobs accumulate', async () => {
  const schema = 'CREATE TABLE tea_compass_entries(id TEXT PRIMARY KEY);' +
    readFileSync('worker/migrations/0045_curate_ar_bridge.sql', 'utf8') +
    readFileSync('worker/migrations/0046_curate_ar_full_transcripts.sql', 'utf8');
  const db = new SqliteD1(false);
  db.exec(schema);
  const token = 'ar1_' + 'a'.repeat(64);
  const tokenHash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)))].map(b => b.toString(16).padStart(2, '0')).join('');
  db.sqlite.prepare(`INSERT INTO curate_ar_devices(id,account_id,paired_by_user_id,secret_hash,code_hash,token_hash,created_at,pair_expires_at,paired_at,last_seen_at) VALUES('device','shop','person','secret','code',?,0,0,1,?)`).run(tokenHash, Date.now());
  const queries: Array<{ sql: string; values: unknown[] }> = [];
  const measured = { prepare(sql: string) { return { bind(...values: unknown[]) {
    if (sql.startsWith('UPDATE curate_ar_jobs')) queries.push({ sql, values });
    return db.prepare(sql).bind(...values);
  } }; } };
  try {
    const response = await handleArBridge(new Request('https://test/connector/poll', { method: 'POST', headers: { Authorization: `Bearer ${token}` } }), { DB: measured as any }, undefined, 'connector/poll');
    expect(await response.json()).toEqual({ jobs: [] });
    expect(queries).toHaveLength(2);
    // Real SQLite VM work over captured production SQL, not call counts or
    // returned rows. Tombstones last for a day but must cost no repeated scans.
    const proof = JSON.parse(execFileSync('python3', ['-c', `
import json, sqlite3, sys
f=json.load(sys.stdin)
def measure(count,indexes):
 db=sqlite3.connect(':memory:')
 db.executescript(f['schema'])
 now=f['queries'][0]['values'][0]
 db.execute("INSERT INTO curate_ar_devices(id,secret_hash,code_hash,token_hash,created_at,pair_expires_at) VALUES('device','s','c','t',0,0)")
 db.executemany("INSERT INTO curate_ar_jobs(id,account_id,created_by_user_id,kind,status,created_at,expires_at) VALUES(?,'shop','person','read','expired',?,?)", [('old-'+str(i),i,now-1000) for i in range(count)])
 db.executemany("INSERT INTO curate_ar_jobs(id,account_id,created_by_user_id,kind,status,created_at,expires_at) VALUES(?,'shop','person','read','completed',?,?)", [('completed-'+str(i),i,now+60000) for i in range(count)])
 # Different person and shop are ineligible even when their jobs are pending.
 db.execute("INSERT INTO curate_ar_jobs(id,account_id,created_by_user_id,kind,status,created_at,expires_at) VALUES('foreign','other','person','read','pending',0,?)",(now+60000,))
 db.execute("INSERT INTO curate_ar_jobs(id,account_id,created_by_user_id,kind,status,created_at,expires_at) VALUES('other-person','shop','other','read','pending',0,?)",(now+60000,))
 if indexes: db.executescript(f['indexes'])
 steps=[0]
 def tick():
  steps[0]+=1
  return 0
 plans=[]
 db.set_progress_handler(tick,1)
 for q in f['queries']: db.execute(q['sql'],q['values']).fetchall()
 db.set_progress_handler(None,0)
 for q in f['queries']: plans.append([r[3] for r in db.execute('EXPLAIN QUERY PLAN '+q['sql'],q['values'])])
 return {'steps':steps[0],'plans':plans,'foreignStatus':db.execute("SELECT status FROM curate_ar_jobs WHERE id='foreign'").fetchone()[0]}
print(json.dumps({'before':measure(1000,False),'small':measure(1000,True),'large':measure(10000,True)}))
`], { input: JSON.stringify({ schema, indexes: readFileSync(migration, 'utf8'), queries }), encoding: 'utf8' }));
    expect(proof.small.plans[0].join(' ')).toContain('idx_curate_ar_unexpired_cleanup');
    expect(proof.small.plans[1].join(' ')).toContain('idx_curate_ar_claim_active');
    expect(proof.small.steps).toBeLessThan(200);
    // SQLite versions emit different VM instructions. Require improvement,
    // an absolute idle-work ceiling, and zero growth with retained history;
    // a fixed speedup ratio is not portable between local SQLite and CI.
    expect(proof.small.steps).toBeLessThan(proof.before.steps);
    expect(proof.large.steps).toBe(proof.small.steps);
    expect(proof.large.foreignStatus).toBe('pending');
  } finally { db.close(); }
});
