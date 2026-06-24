import fs from 'fs';
import path from 'path';
import https from 'https';

const OUT_DIR = 'public/fonts';
fs.mkdirSync(OUT_DIR, { recursive: true });

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': UA } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return get(res.headers.location).then(resolve, reject);
      }
      if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode + ' for ' + url));
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}

function parseBlocks(css) {
  const blocks = [];
  const re = /(\/\*[^*]*\*\/\s*)?@font-face\s*\{[^}]*\}/g;
  let m;
  while ((m = re.exec(css)) !== null) {
    const comment = (m[1] || '').match(/\/\*\s*([^*]*?)\s*\*\//);
    const subset = comment ? comment[1].trim() : '';
    blocks.push({ subset, css: m[0] });
  }
  return blocks;
}

const KEEP_SUBSETS = new Set(['latin', 'latin-ext']);
const nameCounter = {};

function localName(family, weight, style, subset) {
  const slug = family.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const s = style === 'italic' ? 'italic' : 'normal';
  return slug + '-' + weight + '-' + s + '-' + (subset || 'x') + '.woff2';
}

async function processFile(cssPath, keepLatinOnly) {
  const css = fs.readFileSync(cssPath, 'utf8');
  const blocks = parseBlocks(css);
  const outBlocks = [];
  for (const b of blocks) {
    if (keepLatinOnly && b.subset && !KEEP_SUBSETS.has(b.subset)) continue;
    const fam = (b.css.match(/font-family:\s*'([^']+)'/) || [])[1] || 'font';
    const weight = (b.css.match(/font-weight:\s*(\d+)/) || [])[1] || '400';
    const style = (b.css.match(/font-style:\s*(\w+)/) || [])[1] || 'normal';
    const url = (b.css.match(/url\(([^)]+)\)/) || [])[1];
    if (!url) continue;
    let fname = localName(fam, weight, style, b.subset);
    if (nameCounter[fname]) { nameCounter[fname]++; fname = fname.replace(/\.woff2$/, '-' + nameCounter[fname] + '.woff2'); }
    else nameCounter[fname] = 1;
    const buf = await get(url);
    fs.writeFileSync(path.join(OUT_DIR, fname), buf);
    outBlocks.push(b.css.replace(/url\([^)]+\)/, 'url(/fonts/' + fname + ')'));
    process.stdout.write('  ' + fname + ' (' + (buf.length / 1024).toFixed(1) + 'kb)\n');
  }
  return outBlocks.join('\n');
}

console.log('critical:');
const critical = await processFile('/tmp/fonts-critical.css', true);
console.log('noto:');
const noto = await processFile('/tmp/fonts-noto.css', false);
console.log('mashan:');
const mashan = await processFile('/tmp/fonts-mashan.css', false);

fs.writeFileSync(path.join(OUT_DIR, 'fonts.css'), critical + '\n' + noto + '\n' + mashan + '\n');
console.log('\nWrote public/fonts/fonts.css');
