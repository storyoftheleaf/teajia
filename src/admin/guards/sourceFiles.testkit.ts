import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Shared reading helpers for the source-scanning guard tests in this folder.
// Plain `fs`, no network, no timers. Files are read once per test file.

/** Absolute path of the repo's src folder. */
export const SRC_ROOT = fileURLToPath(new URL('../../', import.meta.url));
/** Absolute path of the repo root. */
export const REPO_ROOT = resolve(SRC_ROOT, '..');

export interface SourceFile {
  /** Path from the repo root, always with forward slashes: `src/admin/AdminApp.tsx`. */
  rel: string;
  abs: string;
  text: string;
}

/** Tests, their harnesses and support kits are not application code. */
export function isTestSupportFile(rel: string): boolean {
  return /\.(test|spec|behavior|harness|testkit)\.(ts|tsx)$/.test(rel)
    || /(^|\/)(__tests__|__mocks__|test-utils)\//.test(rel);
}

let cache: SourceFile[] | null = null;

/** Every .ts and .tsx file under src (tests included), read once. */
export function allSourceFiles(): SourceFile[] {
  if (cache) return cache;
  const out: SourceFile[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const abs = join(dir, name);
      const st = statSync(abs);
      if (st.isDirectory()) { walk(abs); continue; }
      if (!/\.(ts|tsx)$/.test(name) || name.endsWith('.d.ts')) continue;
      out.push({ rel: relative(REPO_ROOT, abs).split('\\').join('/'), abs, text: readFileSync(abs, 'utf8') });
    }
  };
  walk(SRC_ROOT);
  out.sort((a, b) => a.rel.localeCompare(b.rel));
  cache = out;
  return out;
}

/** Application source only: no tests, harnesses or test support. */
export function appSourceFiles(): SourceFile[] {
  return allSourceFiles().filter(f => !isTestSupportFile(f.rel));
}

export function lineOf(text: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index; i++) if (text.charCodeAt(i) === 10) line++;
  return line;
}

/** Lines that are only a comment, which describe addresses without writing them. */
export function isCommentLine(line: string): boolean {
  return /^\s*(\/\/|\/\*|\*)/.test(line);
}

// ---- import graph -------------------------------------------------------

const EXTENSIONS = ['', '.ts', '.tsx', '/index.ts', '/index.tsx'];

export function resolveImport(fromAbs: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith('.')) base = resolve(dirname(fromAbs), spec);
  else if (spec.startsWith('@/')) base = join(SRC_ROOT, spec.slice(2));
  else return null;
  for (const ext of EXTENSIONS) {
    const candidate = base + ext;
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/** Value imports and dynamic imports of a file's text (type-only imports skipped). */
export function importSpecs(text: string): string[] {
  const specs: string[] = [];
  for (const m of text.matchAll(/^\s*import\s+(?!type\b)[^;]*?from\s+['"]([^'"]+)['"]/gm)) specs.push(m[1]);
  for (const m of text.matchAll(/^\s*import\s+['"]([^'"]+)['"]/gm)) specs.push(m[1]);
  for (const m of text.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)) specs.push(m[1]);
  return specs;
}

/** The files a screen is made of: itself and what it imports, `depth` levels down. */
export function importClosure(startAbs: string, depth: number, skip: (abs: string) => boolean): string[] {
  const seen = new Set<string>([startAbs]);
  let frontier = [startAbs];
  for (let d = 0; d < depth; d++) {
    const next: string[] = [];
    for (const abs of frontier) {
      const text = readFileSync(abs, 'utf8');
      for (const spec of importSpecs(text)) {
        const target = resolveImport(abs, spec);
        if (!target || seen.has(target) || skip(target)) continue;
        seen.add(target);
        next.push(target);
      }
    }
    frontier = next;
  }
  return [...seen];
}
