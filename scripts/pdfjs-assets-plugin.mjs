// Serve pdf.js's data files at /vendor/pdfjs/ (dev) and copy them into the
// build. The Tea Atlas "Add a source" tool reads PDFs in the browser; pdf.js
// fetches these on demand: character maps (Chinese and Japanese text), colour
// profiles and decoders (print-colour CMYK pictures, JPEG 2000). They are
// library files, not library content, so they are served like any script.

import fs from 'node:fs';
import path from 'node:path';

const FOLDERS = ['cmaps', 'iccs', 'wasm'];
export const PDFJS_ASSET_BASE = '/vendor/pdfjs/';

const TYPES = { '.bcmap': 'application/octet-stream', '.icc': 'application/vnd.iccprofile', '.wasm': 'application/wasm', '.js': 'text/javascript' };

export function pdfjsAssetsPlugin() {
  const root = path.resolve('node_modules/pdfjs-dist');
  const files = () => FOLDERS.flatMap(folder => {
    const dir = path.join(root, folder);
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir).filter(f => !/^LICENSE/.test(f)).map(f => ({ rel: `${folder}/${f}`, abs: path.join(dir, f) }));
  });
  return {
    name: 'teajia-pdfjs-assets',
    configureServer(server) {
      server.middlewares.use(PDFJS_ASSET_BASE, (req, res, next) => {
        const rel = decodeURIComponent((req.url || '').split('?')[0]).replace(/^\/+/, '');
        const hit = files().find(f => f.rel === rel);
        if (!hit) return next();
        res.setHeader('Content-Type', TYPES[path.extname(rel)] || 'application/octet-stream');
        fs.createReadStream(hit.abs).pipe(res);
      });
    },
    generateBundle() {
      for (const f of files()) {
        this.emitFile({ type: 'asset', fileName: `${PDFJS_ASSET_BASE.slice(1)}${f.rel}`, source: fs.readFileSync(f.abs) });
      }
    },
  };
}
