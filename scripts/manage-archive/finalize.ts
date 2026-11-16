import fs from 'node:fs';
import path from 'node:path';
import { OUT, ROOM_ORDER } from './lib';

// Builds index.json from index.jsonl: last write wins per file, only files that
// exist, grouped by room in viewing order, then in the order they were taken.
export default async function finalize() {
  const log = path.join(OUT, 'index.jsonl');
  if (!fs.existsSync(log)) return;
  const byFile = new Map<string, any>();
  // A screen keeps the place it had the first time it was pictured, so retaking
  // one room later does not shuffle it to the end of its section.
  const firstSeen = new Map<string, number>();
  for (const line of fs.readFileSync(log, 'utf8').split('\n').filter(Boolean)) {
    const r = JSON.parse(line);
    byFile.set(r.file, r);
    const k = `${r.room}|${r.state}`;
    if (!firstSeen.has(k) || r.t < firstSeen.get(k)!) firstSeen.set(k, r.t);
  }
  const rows = [...byFile.values()].filter((r) => fs.existsSync(path.join(OUT, r.file)));
  rows.sort((a, b) => {
    const ra = ROOM_ORDER.indexOf(a.room), rb = ROOM_ORDER.indexOf(b.room);
    if (ra !== rb) return (ra < 0 ? 99 : ra) - (rb < 0 ? 99 : rb);
    const ta = firstSeen.get(`${a.room}|${a.state}`)!, tb = firstSeen.get(`${b.room}|${b.state}`)!;
    if (ta !== tb) return ta - tb;
    return a.size === 'phone' ? -1 : 1;
  });
  fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(rows.map(({ t, ...r }) => r), null, 2));
}
