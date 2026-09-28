// Tea Atlas: the pictures in saved web pages, for scripts/atlas-web-sources.mjs.
//
// The same choices the Add source page makes in the browser
// (src/atlas/add/readPdf.ts), in Node: at least 200 px on the short side, not
// a thin strip, not a flat tint, not drawn on three or more pages,
// at most 1600 px on the long side (never enlarged), JPEG quality 80. The
// near-plain test is left out: it was measured on Global Tea Hut's parchment,
// and a clean product photo on white (a teapot) reads as plain to it, while a
// web page has no paper backgrounds to catch. One more rule for a shop's
// pages: a picture that turns up in three or more of the shop's articles is the
// shop's own (logo, banner, product tile), not the article's.
//
// Node has no canvas, so each picture is written as a plain bitmap and macOS's
// `sips` makes the JPEG. This script runs on Adrian's Mac, where sips always is.

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const MIN_SIDE = 200;
export const MAX_ASPECT = 3.5;
export const MAX_SIDE = 1600;
const MIN_DETAIL = 12;
const PLAIN_DETAIL = 6;
export const REPEATED_ON = 3;

/** Decoded pdf.js pixels → RGB bytes on white. kind 1: 1-bit, 2: RGB, 3: RGBA. */
export function rgbOf({ width, height, data, kind }) {
  if (!data) return null;
  const out = Buffer.alloc(width * height * 3);
  if (kind === 2) {
    out.set(data.subarray(0, out.length));
  } else if (kind === 3) {
    for (let i = 0, j = 0; j < out.length; i += 4, j += 3) {
      const a = data[i + 3] / 255;
      out[j] = Math.round(data[i] * a + 255 * (1 - a));
      out[j + 1] = Math.round(data[i + 1] * a + 255 * (1 - a));
      out[j + 2] = Math.round(data[i + 2] * a + 255 * (1 - a));
    }
  } else if (kind === 1) {
    const rowBytes = (width + 7) >> 3;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const v = ((data[y * rowBytes + (x >> 3)] >> (7 - (x & 7))) & 1) ? 255 : 0;
        out.fill(v, (y * width + x) * 3, (y * width + x) * 3 + 3);
      }
    }
  } else {
    return null;
  }
  return out;
}

/** Flat, plain and a look-alike fingerprint, from a 64 x 64 average (readPdf.ts's `look`). */
export function look(rgb, width, height) {
  const lum = new Float64Array(64 * 64);
  const count = new Uint32Array(64 * 64);
  for (let y = 0; y < height; y++) {
    const cy = Math.min(63, Math.floor((y * 64) / height));
    for (let x = 0; x < width; x++) {
      const cx = Math.min(63, Math.floor((x * 64) / width));
      const i = (y * width + x) * 3;
      lum[cy * 64 + cx] += 0.299 * rgb[i] + 0.587 * rgb[i + 1] + 0.114 * rgb[i + 2];
      count[cy * 64 + cx]++;
    }
  }
  let sum = 0;
  let sq = 0;
  for (let k = 0; k < lum.length; k++) {
    lum[k] = count[k] ? lum[k] / count[k] : 255;
    sum += lum[k];
    sq += lum[k] * lum[k];
  }
  const mean = sum / lum.length;
  const flat = Math.sqrt(Math.max(0, sq / lum.length - mean * mean)) < MIN_DETAIL;
  let steps = 0;
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      if (x) steps += Math.abs(lum[y * 64 + x] - lum[y * 64 + x - 1]);
      if (y) steps += Math.abs(lum[y * 64 + x] - lum[(y - 1) * 64 + x]);
    }
  }
  const plain = steps / (2 * 63 * 64) < PLAIN_DETAIL;
  let bits = '';
  for (let cy = 0; cy < 8; cy++) {
    for (let cx = 0; cx < 8; cx++) {
      let cell = 0;
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) cell += lum[(cy * 8 + y) * 64 + cx * 8 + x];
      bits += cell / 64 > mean ? '1' : '0';
    }
  }
  return { flat, plain, print: `${bits}:${Math.round(mean / 16)}` };
}

/** Big enough, and not a strip. */
export const worthLooking = (w, h) => Math.min(w, h) >= MIN_SIDE && Math.max(w, h) / Math.min(w, h) <= MAX_ASPECT;

/** 24-bit BMP, the simplest file sips reads. */
function bmp(rgb, width, height) {
  const row = Math.ceil((width * 3) / 4) * 4;
  const buf = Buffer.alloc(54 + row * height);
  buf.write('BM', 0);
  buf.writeUInt32LE(buf.length, 2);
  buf.writeUInt32LE(54, 10);
  buf.writeUInt32LE(40, 14);
  buf.writeInt32LE(width, 18);
  buf.writeInt32LE(height, 22);
  buf.writeUInt16LE(1, 26);
  buf.writeUInt16LE(24, 28);
  buf.writeUInt32LE(row * height, 34);
  for (let y = 0; y < height; y++) {
    const dst = 54 + (height - 1 - y) * row;
    for (let x = 0; x < width; x++) {
      const s = (y * width + x) * 3;
      buf[dst + x * 3] = rgb[s + 2];
      buf[dst + x * 3 + 1] = rgb[s + 1];
      buf[dst + x * 3 + 2] = rgb[s];
    }
  }
  return buf;
}

/** Write one picture as a JPEG, at most 1600 px on the long side. */
export function writeJpeg(rgb, width, height, file) {
  mkdirSync(join(file, '..'), { recursive: true });
  const tmp = `${file}.bmp`;
  writeFileSync(tmp, bmp(rgb, width, height));
  const shrink = Math.max(width, height) > MAX_SIDE ? ['-Z', String(MAX_SIDE)] : [];
  execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '80', ...shrink, tmp, '--out', file], { stdio: 'ignore' });
  execFileSync('rm', ['-f', tmp]);
}

/**
 * Which pictures each article keeps, once every article has been read.
 * `docs`: per article, `{ pages: Map<pageIndex, Array<{name, print}>> }`.
 * Returns per article a Map<pageIndex, names[]>.
 */
export function choosePictures(docs) {
  const articlesByLook = new Map();
  docs.forEach((d, i) => {
    for (const refs of d.pages.values()) {
      for (const r of refs) {
        if (!articlesByLook.has(r.print)) articlesByLook.set(r.print, new Set());
        articlesByLook.get(r.print).add(i);
      }
    }
  });
  return docs.map(d => {
    const pagesByName = new Map();
    const pagesByLook = new Map();
    for (const [p, refs] of d.pages) {
      for (const r of refs) {
        pagesByName.set(r.name, (pagesByName.get(r.name) ?? 0) + 1);
        if (!pagesByLook.has(r.print)) pagesByLook.set(r.print, new Set());
        pagesByLook.get(r.print).add(p);
      }
    }
    const placed = new Set();
    const kept = new Map();
    for (const [p, refs] of [...d.pages].sort((a, b) => a[0] - b[0])) {
      const names = [];
      for (const r of refs) {
        if (placed.has(r.name) || placed.has(r.print)) continue;
        if (pagesByName.get(r.name) >= REPEATED_ON || pagesByLook.get(r.print).size >= REPEATED_ON) continue;
        if (articlesByLook.get(r.print).size >= REPEATED_ON) continue;
        placed.add(r.name);
        placed.add(r.print);
        names.push(r.name);
      }
      if (names.length) kept.set(p, names);
    }
    return kept;
  });
}
