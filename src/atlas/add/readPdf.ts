// The browser half of reading a dropped PDF: load pdf.js, extract the text
// (extract.ts), and turn each embedded picture into a screen-ready JPEG.
//
// Pictures follow ~/builds/tea-atlas-media.py: true colour, at most 1600 px on
// the long side, JPEG quality 80, and icons, thin strips and flat paper
// textures left out. pdf.js decodes print-colour (CMYK) pictures itself, with
// the colour profile served from /vendor/pdfjs/, so they do not come out as
// negatives the way a raw copy of the embedded JPEG does.

import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { extractPdf } from './extract.ts';
import type { PdfDoc } from './types.ts';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

const ASSETS = '/vendor/pdfjs/';
export const MAX_SIDE = 1600;
const QUALITY = 0.8;
const MIN_SIDE = 200;
const MAX_ASPECT = 3.5;
const MIN_DETAIL = 12;
/**
 * Below this much fine detail (average step between neighbouring pixels of a
 * 64 px copy, 0 to 255) a picture is a paper background or a soft gradient.
 * Measured on Global Tea Hut: parchment backgrounds 4 to 5, photographs 9 and
 * up. Such pictures start out left out, and one click keeps them.
 */
const PLAIN_DETAIL = 6;
/** The same picture (by name or by look) on this many pages is a logo, a background or an ornament. */
const REPEATED_ON = 3;

export interface PictureCandidate {
  /** pdf.js object name, the same across pages for a repeated picture. */
  name: string;
  /** How it looks, coarsely: equal for the same image embedded twice. */
  print: string;
  /** A paper background or soft gradient: offered, but left out unless kept. */
  plain: boolean;
  jpeg: Blob;
  url: string;
  width: number;
  height: number;
}

export interface ReadResult {
  doc: PdfDoc;
  /** Per 0-based page, the pictures worth keeping, in drawing order. */
  pictures: Map<number, PictureCandidate[]>;
}

interface DecodedImage {
  width: number;
  height: number;
  bitmap?: ImageBitmap | HTMLImageElement | null;
  data?: Uint8ClampedArray | Uint8Array;
  kind?: number;
}

function pixelsOf(img: DecodedImage): ImageData | null {
  const { width, height, data, kind } = img;
  if (!data) return null;
  const out = new ImageData(width, height);
  const px = out.data;
  if (kind === 3) {
    px.set(data.subarray(0, px.length));
  } else if (kind === 2) {
    for (let i = 0, j = 0; j < px.length; i += 3, j += 4) {
      px[j] = data[i]; px[j + 1] = data[i + 1]; px[j + 2] = data[i + 2]; px[j + 3] = 255;
    }
  } else if (kind === 1) {
    const rowBytes = (width + 7) >> 3;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const on = (data[y * rowBytes + (x >> 3)] >> (7 - (x & 7))) & 1;
        const j = (y * width + x) * 4;
        px[j] = px[j + 1] = px[j + 2] = on ? 255 : 0;
        px[j + 3] = 255;
      }
    }
  } else {
    return null;
  }
  return out;
}

/**
 * Two measures from a 64 px copy: whether it is near-solid (a paper texture or
 * tint, not a photograph), and a small fingerprint of how it looks, so the same
 * background drawn on many pages under different names is recognised as one.
 */
function look(canvas: HTMLCanvasElement): { flat: boolean; plain: boolean; print: string } {
  const small = document.createElement('canvas');
  small.width = small.height = 64;
  const ctx = small.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(canvas, 0, 0, 64, 64);
  const { data } = ctx.getImageData(0, 0, 64, 64);
  const lum: number[] = [];
  let sum = 0;
  let sq = 0;
  for (let i = 0; i < data.length; i += 4) {
    const l = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    lum.push(l);
    sum += l;
    sq += l * l;
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
  // 8 x 8 cells, each lighter or darker than the whole: an average hash.
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

async function toJpeg(img: DecodedImage): Promise<{ jpeg: Blob; width: number; height: number; print: string; plain: boolean } | null> {
  const full = document.createElement('canvas');
  full.width = img.width;
  full.height = img.height;
  const ctx = full.getContext('2d')!;
  // White under anything transparent, as a JPEG has no transparency.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, full.width, full.height);
  if (img.bitmap) {
    ctx.drawImage(img.bitmap as CanvasImageSource, 0, 0);
  } else {
    const pixels = pixelsOf(img);
    if (!pixels) return null;
    const layer = document.createElement('canvas');
    layer.width = img.width;
    layer.height = img.height;
    layer.getContext('2d')!.putImageData(pixels, 0, 0);
    ctx.drawImage(layer, 0, 0);
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
  const out = document.createElement('canvas');
  out.width = Math.max(1, Math.round(img.width * scale));
  out.height = Math.max(1, Math.round(img.height * scale));
  const octx = out.getContext('2d')!;
  octx.imageSmoothingQuality = 'high';
  octx.drawImage(full, 0, 0, out.width, out.height);
  // Measured on the finished picture: straight from a large original, the
  // 64 px copy keeps the paper's grain and a plain background looks detailed.
  const { flat, plain, print } = look(out);
  if (flat) return null;
  const jpeg = await new Promise<Blob | null>(res => out.toBlob(res, 'image/jpeg', QUALITY));
  return jpeg ? { jpeg, width: out.width, height: out.height, print, plain } : null;
}

export async function readPdf(file: File, onProgress: (done: number, total: number) => void): Promise<ReadResult> {
  const data = new Uint8Array(await file.arrayBuffer());
  const task = pdfjs.getDocument({
    data,
    cMapUrl: `${ASSETS}cmaps/`,
    cMapPacked: true,
    iccUrl: `${ASSETS}iccs/`,
    wasmUrl: `${ASSETS}wasm/`,
    verbosity: 0,
  });
  const pdf = await task.promise;
  const encoded = new Map<string, Promise<PictureCandidate | null>>();
  const onPages = new Map<string, number[]>();
  try {
    const doc = await extractPdf(pdf, {
      ops: pdfjs.OPS as unknown as Record<string, number>,
      onProgress,
      onPicture: async (page, ref, image) => {
        if (Math.min(ref.width, ref.height) < MIN_SIDE || Math.max(ref.width, ref.height) / Math.min(ref.width, ref.height) > MAX_ASPECT) return false;
        const pages = onPages.get(ref.name) ?? [];
        pages.push(page.pageNumber - 1);
        onPages.set(ref.name, pages);
        if (!encoded.has(ref.name)) {
          encoded.set(ref.name, toJpeg(image as DecodedImage).then(r => r && {
            name: ref.name, print: r.print, plain: r.plain, jpeg: r.jpeg, url: URL.createObjectURL(r.jpeg), width: r.width, height: r.height,
          }).catch(() => null));
        }
        return Boolean(await encoded.get(ref.name));
      },
    });
    // Pages each look appears on: a page background or ornament embedded
    // afresh on every page has a new name each time but the same look.
    const pagesByLook = new Map<string, Set<number>>();
    for (const page of doc.pages) {
      for (const ref of page.pictures) {
        const pic = await encoded.get(ref.name);
        if (!pic) continue;
        if (!pagesByLook.has(pic.print)) pagesByLook.set(pic.print, new Set());
        pagesByLook.get(pic.print)!.add(page.index);
      }
    }
    const pictures = new Map<number, PictureCandidate[]>();
    const placed = new Set<string>();
    for (const page of doc.pages) {
      const kept: PictureCandidate[] = [];
      for (const ref of page.pictures) {
        // A picture drawn again on a later page is shown once, where it first appears.
        if ((onPages.get(ref.name)?.length ?? 0) >= REPEATED_ON || placed.has(ref.name)) continue;
        placed.add(ref.name);
        const pic = await encoded.get(ref.name);
        if (pic && (pagesByLook.get(pic.print)?.size ?? 0) < REPEATED_ON) kept.push(pic);
      }
      pictures.set(page.index, kept);
    }
    // Drop the object URLs of pictures nothing uses.
    const used = new Set([...pictures.values()].flat().map(p => p.url));
    for (const pending of encoded.values()) {
      const pic = await pending;
      if (pic && !used.has(pic.url)) URL.revokeObjectURL(pic.url);
    }
    return { doc, pictures };
  } finally {
    await task.destroy();
  }
}
