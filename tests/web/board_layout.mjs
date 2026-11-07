// Geometry must cover engine IDs exactly once, without overlapping country hit areas.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const layout = read('../../web/ui/src/board/hanon-layout.json');
const rules = read('../../rules/map.json');
assert(Math.abs(layout.width / layout.height - layout.sourceWidth / layout.sourceHeight) < 1e-12);
assert.equal(layout.countries.length, 84);
assert.equal(new Set(layout.countries.map(c => c.id)).size, 84);
for (const country of rules.countries) {
  const target = layout.countries.find(c => c.id === country.id);
  assert.equal(target?.name, country.name);
  const [x, y, w, h] = target.rect;
  assert(x >= 0 && y >= 0 && x + w <= layout.width && y + h <= layout.height, country.name);
  assert(w > 35 && w < 45 && h > 23 && h < 29, country.name);
  assert(target.edgeConfidence > 0.9, `${country.name}: bottom image border`);
  for (const other of layout.countries.filter(c => c.id > country.id)) {
    const [a, b, cw, ch] = other.rect;
    const area = Math.max(0, Math.min(x + w, a + cw) - Math.max(x, a))
      * Math.max(0, Math.min(y + h, b + ch) - Math.max(y, b));
    assert(area === 0, `Overlapping targets: ${country.name}, ${other.name}`);
  }
}
console.log('Board geometry passed: all 84 engine IDs, image aspect ratio, bounds and disjoint hit areas.');
const tracks = read('../../web/ui/src/board/track-layout.json');
for (const [key, count] of Object.entries({ actionRound: 8, turn: 10, space: 9, defcon: 5, milOps: 6, victoryPoints: 41 })) {
  assert.equal(tracks[key].length, count, key);
  assert.equal(new Set(tracks[key].map(p => p.join(','))).size, count, `${key}: distinct cells`);
  for (const [x, y] of tracks[key]) {
    assert(x >= 0 && y >= 0 && x <= layout.width && y <= layout.height, key);
    for (const c of layout.countries) {
      const [cx, cy, w, h] = c.rect;
      assert(!(x + 8 > cx && x - 8 < cx + w && y + 16 > cy && y - 16 < cy + h), `${key} overlaps ${c.name}`);
    }
  }
}
// Printed VP rows read left-to-right, including the two double-width end cells and zero.
assert.equal(tracks.victoryPoints[0][1], tracks.victoryPoints[7][1]);
assert.equal(tracks.victoryPoints[8][1], tracks.victoryPoints[16][1]);
assert.equal(tracks.victoryPoints[17][1], tracks.victoryPoints[23][1]);
assert.equal(tracks.victoryPoints[24][1], tracks.victoryPoints[32][1]);
assert.equal(tracks.victoryPoints[33][1], tracks.victoryPoints[40][1]);
console.log('Track geometry passed: 79 unique track cells, complete ranges, no country overlap.');
