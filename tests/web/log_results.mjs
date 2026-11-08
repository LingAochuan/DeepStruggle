// Display adapter regressions: net results, ownership, privacy, headlines and escaping.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
const require = createRequire(resolve('web/ui/package.json'));
const { build } = require('esbuild');
await mkdir('scratch/log-results', { recursive: true });
await build({ stdin: { contents: `export * from './web/ui/src/game/log_results'; export * from './web/ui/src/game/view'; export * from './web/ui/src/i18n';`, resolveDir: process.cwd() },
  outfile: 'scratch/log-results/adapter.mjs', bundle: true, platform: 'node', format: 'esm', logLevel: 'silent' });
const { resultLog, resultEntryHtml, redactLogs, setLocale } = await import(pathToFileURL(resolve('scratch/log-results/adapter.mjs')));
const base = { step_index: 1, turn: 2, ar: 1, phase: 'ACTION_ROUND', player: 'USSR', text: '', details: [] };
const logs = [
  { ...base, kind: 'play', title: 'USSR plays Nuclear Test Ban (#34)', cards: [34] },
  { ...base, step_index: 2, kind: 'mode', mode: 'Ops: Coup', text: 'USSR chooses Op mode: Coup' },
  { ...base, step_index: 3, kind: 'point', text: 'USSR attempts Coup in Pakistan', details: [
    '  🎲 Coup in Pakistan: USSR rolls 5 (+4 Ops = 9) vs 4 Defense -> success',
    '  • Pakistan Influence: US: 2 -> 0 (-2), USSR: 0 -> 3 (+3)',
    '  • DEFCON: 4 -> 3', '  • USSR MilOps: 0 -> 4',
    '  • Card #34 (Nuclear Test Ban) moved: HAND_USSR_UNKNOWN -> DISCARD_PILE' ] }
];
const frozen = JSON.stringify(logs);
let rows = resultLog(logs);
assert.equal(rows.length, 1); assert.equal(rows[0].card, 34); assert.equal(rows[0].player, 'USSR');
assert.equal(rows[0].mode, 'Ops: Coup'); assert.equal(rows[0].lines.length, 3);
assert(!JSON.stringify(rows[0].lines).includes('rolls')); assert(!JSON.stringify(rows[0].lines).includes('discarded'));
assert.equal(JSON.stringify(logs), frozen);
const multistep = [...logs,
  { ...base, step_index: 4, kind: 'point', resolving: 50, details: ['  • Pakistan Influence: USSR: 3 -> 1 (-2)', '  • DEFCON: 3 -> 4'] },
  { ...base, step_index: 5, kind: 'point', resolving: 0, details: ['  • Pakistan Influence: USSR: 1 -> 2 (+1)'] }];
rows = resultLog(multistep);
assert.match(rows[0].lines[0], /USSR: 0 -> 2/); assert(!rows[0].lines.some(x => x.includes('DEFCON:')));
const setup = [{ ...base, phase: 'SETUP', kind: 'setup', title: 'US places its setup Influence', player: 'US', details: ['  • France Influence: US: 0 -> 1 (+1)'] },
  { ...base, phase: 'SETUP', kind: 'setup', player: 'US', step_index: 2, details: ['  • France Influence: US: 1 -> 2 (+1)'] }];
assert.equal(resultLog(setup).length, 1); assert.match(resultLog(setup)[0].lines[0], /0 -> 2/);
const head = { ...base, phase: 'HEADLINE', kind: 'headline', text: 'USSR commits Headline Card: Fidel (#8)' };
assert.equal(resultLog(redactLogs([head], 'US', true))[0].card, undefined);
const revealed = { ...base, step_index: 2, phase: 'HEADLINE', kind: 'headline', player: 'US', cards: [34, 8], title: 'Headlines: US Nuclear Test Ban (#34) vs USSR Fidel (#8)', details: [
  '  • Cuba Influence: US: 1 -> 0 (-1), USSR: 0 -> 3 (+3)', '  • DEFCON: 4 -> 5' ] };
rows = resultLog([head, revealed]);
assert.equal(rows.length, 1); assert.equal(rows[0].player, 'SYSTEM');
assert.deepEqual(rows[0].headlines.map(x => [x.card, x.player]), [[34, 'US'], [8, 'USSR']]);
assert(!rows.some(x => x.pending));
assert.match(rows.at(-1).lines[0], /Cuba Influence/);
const privateDeal = { ...base, player: 'SYSTEM', details: ['  • Card #34 (Nuclear Test Ban) moved: DRAW_DECK -> HAND_US_UNKNOWN'] };
assert.deepEqual(resultLog(redactLogs([privateDeal], 'USSR'))[0].lines, []);
const names = { namesOf: () => ['Nuclear Test Ban'], idOf: () => 34 };
const html = resultEntryHtml(resultLog(logs)[0], names);
assert(html.includes('<svg class="result-arrow"')); assert(html.includes('data-card-id="34"'));
assert(!html.includes('rolls')); assert(!html.includes('data-step='));
const malicious = resultEntryHtml({ ...resultLog(logs)[0], card: undefined, title: '<img src=x onerror=alert(1)>' }, names);
assert(!malicious.includes('<img')); assert(malicious.includes('&lt;img'));
for (const id of ['17</span><img src=x onerror=alert(1)>', '17" onmouseover="alert(1)', { bad: '<svg onload=alert(1)>' }]) {
  for (const extra of [{ card: id }, { card: undefined, headlines: [{ player: 'US', card: id }] }]) {
    const rendered = resultEntryHtml({ ...resultLog(logs)[0], ...extra }, names);
    assert(!rendered.includes('<img')); assert(!rendered.includes('<svg onload'));
    assert(!rendered.includes('data-card-id='));
  }
}
globalThis.document = { documentElement: { lang: 'en' }, querySelectorAll: () => [], getElementById: () => null };
setLocale('zh-CN');
const chinese = resultEntryHtml(resultLog(logs)[0], names);
assert(chinese.includes('禁止核试验')); assert(chinese.includes('巴基斯坦影响力'));
assert(chinese.includes('苏联军事行动')); assert(chinese.includes('行动点数'));
await writeFile('scratch/log-results/fixture.json', JSON.stringify([...setup, ...logs], null, 2));
console.log('Result log: net changes, setup, ownership, hidden cards, unified neutral headline, XSS, Chinese and immutable source passed.');

// Run the existing deterministic two-turn fixture through the new presentation adapter.
const runner = (await readFile('tests/web/js/log_view.ts', 'utf8')).replace(
  'import { groupLog } from "../../../web/ui/src/game/log_view";',
  'import { resultLog as groupLog } from "../../../web/ui/src/game/log_results";');
await build({ stdin: { contents: runner, resolveDir: resolve('tests/web/js'), loader: 'ts' }, outfile: 'scratch/log-results/game.mjs',
  bundle: true, platform: 'node', format: 'esm', logLevel: 'silent' });
const game = JSON.parse(execFileSync(process.execPath, ['scratch/log-results/game.mjs', resolve('web/ui/public') + '/', '6'], { encoding: 'utf8', maxBuffer: 8e6 }));
assert(!game.terminal);
const actual = {};
for (const e of game.entries) for (const line of e.lines) {
  const country = /^  • (.+) Influence: (.+)$/.exec(line);
  if (!country) continue;
  const totals = actual[country[1]] ??= [0, 0];
  for (const side of country[2].matchAll(/(US|USSR): (\d+) -> (\d+)/g)) totals[side[1] === 'US' ? 0 : 1] += +side[3] - +side[2];
}
const nonzero = values => Object.fromEntries(Object.entries(values).filter(([, x]) => x[0] || x[1]));
assert.deepEqual(nonzero(actual), nonzero(game.influence));
assert.equal(game.entries.reduce((sum, e) => sum + e.vp_delta, 0), game.vp);
assert.equal(game.entries.filter(e => e.card && !e.pending).length, game.plays);
const hidden = game.ussr_view.flatMap(e => e.lines).filter(x => x.startsWith('  • US draws')).join('\n');
for (const name of game.unseen_us) assert(!hidden.includes(name));
console.log(`Two real WASM turns: ${game.plays} plays, all country/VP deltas conserved; private deals stay hidden.`);
