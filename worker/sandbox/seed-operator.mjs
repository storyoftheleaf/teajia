/**
 * Seeds the LOCAL sandbox database with one owner-tier operator so an agent can
 * sign in to /admin and click things without touching the live shop.
 *
 * This account exists only in worker/.wrangler/state (gitignored, local disk).
 * It is never deployed, never exported, and the live database has no row like
 * it. The password is a fixed dev string on purpose: the point of the sandbox
 * is that nothing here is worth protecting.
 *
 * Run via: npm run sandbox:seed  (from worker/)
 */
import { execFileSync } from 'node:child_process';
import { sandboxAccountIds, sandboxOperatorStatements, sandboxPassword, sandboxUsername } from './operator-fixture.mjs';

for (const sql of sandboxOperatorStatements) {
  execFileSync(
    'npx',
    ['wrangler', 'd1', 'execute', 'teajia-db', '--local', '--command', sql.replace(/\s+/g, ' ')],
    { stdio: ['ignore', 'ignore', 'inherit'] },
  );
}

console.log(`Sandbox operator ready: sign in as "${sandboxUsername}" / "${sandboxPassword}" at http://localhost:7777/admin`);
console.log(`Owner on: ${sandboxAccountIds.join(', ')}`);
