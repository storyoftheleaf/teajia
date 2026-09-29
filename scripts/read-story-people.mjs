#!/usr/bin/env node
// Which Read stories each person appears in, found from the stories themselves.
//
// A Read story is a hand-built page under src/pages/read, not a row in the
// articles table, so a person's page could never list it. The tag is the link
// the story already carries: a story that links /people/<slug> features that
// person. This reads every routed Read story, collects those links, and writes
// src/pages/read/storyPeople.generated.json, which the person's page reads.
// Nobody tags anything by hand; link a person in a story and the story shows
// on their page at the next build.
//
//   node scripts/read-story-people.mjs          write the file
//   node scripts/read-story-people.mjs --check  exit 1 if the file is stale
//
// Runs before every build (package.json "build"), and a unit test fails when
// the committed file does not match the stories.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const OUTPUT = path.join(ROOT, 'src/pages/read/storyPeople.generated.json');

/** Every /read route, the file it renders, and the people that file links, with the title and line the Read index gives it. */
export function scanStoryPeople(root = ROOT) {
  const app = fs.readFileSync(path.join(root, 'src/App.tsx'), 'utf8');
  const index = fs.readFileSync(path.join(root, 'src/pages/read/ReadIndex.tsx'), 'utf8');

  const fileOf = new Map();
  for (const [, name, file] of app.matchAll(/const (\w+) = lazy\(\(\) => import\('\.\/(pages\/read\/[\w-]+)'\)\)/g)) fileOf.set(name, file);

  const listed = new Map();
  for (const [, title, dek, href] of index.matchAll(/title:\s*'([^']*)',\s*dek:\s*'([^']*)',\s*href:\s*'(\/read\/[^']+)'/g)) listed.set(href, { title: title.trim(), dek: dek.trim() });

  const stories = [];
  for (const [, href, name] of app.matchAll(/<Route path="(\/read\/[^"]+)" element=\{[\s\S]*?<(\w+) \/><\/Suspense>/g)) {
    const file = fileOf.get(name);
    if (!file) continue;
    const source = fs.readFileSync(path.join(root, 'src', `${file}.tsx`), 'utf8');
    const people = [...new Set([...source.matchAll(/["'`]\/people\/([a-z0-9]+(?:-[a-z0-9]+)*)["'`]/g)].map(match => match[1]))].sort();
    if (!people.length) continue;
    const words = listed.get(href);
    stories.push({ href, title: words?.title ?? href, dek: words?.dek ?? null, people });
  }
  return stories.sort((a, b) => a.href.localeCompare(b.href));
}

export function render(stories) {
  return `${JSON.stringify(stories, null, 2)}\n`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const next = render(scanStoryPeople());
  const current = fs.existsSync(OUTPUT) ? fs.readFileSync(OUTPUT, 'utf8') : '';
  if (process.argv.includes('--check')) {
    if (current !== next) { console.error('storyPeople.generated.json is stale. Run: node scripts/read-story-people.mjs'); process.exit(1); }
  } else if (current !== next) {
    fs.writeFileSync(OUTPUT, next);
    console.log(`read-story-people: wrote ${path.relative(ROOT, OUTPUT)}`);
  }
}
