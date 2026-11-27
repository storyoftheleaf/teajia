import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'needs.mjs');

test('needs.mjs prints what a tea is missing and ranks the missing pages', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'wisdom-needs-'));
  const products = path.join(dir, 'products.json');
  await fs.writeFile(products, JSON.stringify([
    { id: 'bull', product_name: 'Golden Bull Hengfengyuan Shou Cha', type: 'Shou Puer', origin_region: 'Yunnan', origin_country: 'China' },
    { id: 'mat', product_name: 'Tea Mat', type: 'Teaware', teaware_category: 'mat' },
  ]));
  const output = await new Promise((resolve, reject) => execFile(process.execPath, [SCRIPT, '--products', products], { timeout: 60_000 }, (error, stdout) => (
    error ? reject(error) : resolve(stdout)
  )));
  assert.match(output, /record\s+producer\s+Hengfengyuan/);
  assert.match(output, /covered\s+style\s+Shou/);
  assert.match(output, /1 tea\(s\) checked/);
  assert.match(output, /Hengfengyuan \(producer\): 1 tea, record only/);
  await fs.rm(dir, { recursive: true, force: true });
});
