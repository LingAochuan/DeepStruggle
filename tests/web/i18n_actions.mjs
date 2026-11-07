// Audit generated modes and real WASM result logs, not just hand-written translations.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
const require = createRequire(resolve('web/ui/package.json'));
const { build } = require('esbuild');
const artifacts = 'scratch/translation-audit';
await mkdir(artifacts, { recursive: true });
await build({ stdin: { contents: `
  export * from './web/ui/src/i18n';
  export * from './web/ui/src/i18n/log';
  export * from './web/ui/src/game/log_view';
  export * from './web/ui/src/game/log_results';
  export * from './web/ui/src/game/branches';
  export * from './web/ui/src/game/names';
  export * from './web/ui/src/game/session';
  export * from './web/ui/src/engine/wasm_engine';
`, resolveDir: process.cwd() }, outfile: artifacts + '/module.mjs', bundle: true, format: 'esm', platform: 'node', logLevel: 'silent' });
globalThis.document = { documentElement: { lang: 'en' }, querySelectorAll: () => [], getElementById: () => null };
const m = await import(pathToFileURL(resolve(artifacts, 'module.mjs')));
m.setLocale('zh-CN');
const engine = await m.WasmEngine.load(pathToFileURL(resolve('web/ui/public') + '/').href);
const session = new m.GameSession(engine);
session.newGame(6);
const state = engine.display(), L = engine.layout, modes = new Set();
for (const side of ['US', 'USSR']) for (let card = 1; card <= 110; card++) for (const resolution of Object.values(L.resolutions)) {
  const before = { ...state, current_phase_name: 'ACTION_ROUND', decision_context: {
    ...state.decision_context, decision_player: side, resolving_card: 0, pending_op_card: card,
  } };
  const info = m.clickInfo(engine, before, { decision_type: L.decision_types.SELECT_PLAY_MODE, primary_id: resolution, secondary_id: 0, flags: 0 }, side);
  modes.add(info.mode);
  if (info.mode.endsWith('then Ops')) for (const op of ['Influence', 'Coup', 'Realignment']) modes.add(info.mode.slice(0, -3) + 'Ops: ' + op);
}
for (const op of ['Influence', 'Coup', 'Realignment']) modes.add('Event, then Ops: ' + op);
assert.equal(modes.size, 22);
const chained = new Set(modes);
for (const mode of modes) for (const op of ['Influence', 'Coup', 'Realignment']) chained.add(mode + ', then Ops: ' + op);
chained.add('USSR Event First, Then Op: Coup');
chained.add('US Event First, Then Operations: Influence Placement');
const translations = [...chained].map(english => ({ english, chinese: m.localizeLog(english) }));
for (const row of translations) assert(!/[A-Za-z]{2}/.test(row.chinese), JSON.stringify(row));
assert.equal(m.localizeLog('USSR Event first, then Ops: Coup'), '先执行苏联事件，随后行动点数：政变');
assert.equal(m.localizeLog('Ops: Coup, then the US Event, then Ops: Realignment'), '行动点数：政变，随后执行美国事件，随后行动点数：调整阵营');
assert.equal(m.localizeLog('Unrecognized Event First, Then Something'), 'Unrecognized Event First, Then Something');
const visible = new Set(), choices = new Set();
let x = 6, clicks = 0;
for (let seed = 1; seed <= 6; seed++) {
  session.newGame(seed);
  let steps = 0;
  while (!engine.isTerminal() && engine.display().turn <= 4 && steps++ < 1500) {
    for (let trial = 0; trial < 25; trial++) {
      x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
      const valid = []; engine.mask(false).forEach((v, i) => { if (v) valid.push(i); });
      const position = engine.display();
      for (const i of valid) choices.add(m.actionName(engine, i, position));
      assert.equal(session.applyFlat(valid[x % valid.length], false), null);
      clicks++;
      if (!engine.isTerminal() || trial === 24) break;
      session.undo(false);
    }
  }
  const original = JSON.stringify(session.logs);
  for (const entry of m.resultLog(session.logs)) {
    if (!entry.card && !entry.headlines) visible.add(entry.title);
    if (entry.mode) visible.add(entry.mode);
    for (const line of entry.lines) visible.add(line);
  }
  assert.equal(JSON.stringify(session.logs), original, 'Display localization never edits saved records');
}
// Include late-war branch descriptions without needing random play to draw each card.
for (const key of ['WARSAW_PACT_FORMED', 'OLYMPIC_GAMES', 'WARGAMES', 'CHERNOBYL', 'SUMMIT', 'HOW_I_LEARNED_TO_STOP_WORRYING']) {
  const branches = key === 'CHERNOBYL' ? Object.values(L.regions) : ['SUMMIT', 'HOW_I_LEARNED_TO_STOP_WORRYING'].includes(key) ? [1,2,3,4,5] : [0,1];
  for (const branch of branches) for (const defcon of [2,3,4,5]) {
    const meta = m.branchMeta(L.card_ids[key], branch, { ...state, defcon });
    for (const field of ['title', 'desc', 'verb']) if (meta?.[field]) choices.add(meta[field]);
  }
}
const checked = [...new Set([...visible, ...choices])].map(english => ({ english, chinese: m.localizeLog(english) }));
const leaks = checked.filter(row => /[A-Za-z]{3}/.test(row.chinese));
await writeFile(artifacts + '/final-report.json', JSON.stringify({ modes: translations, clicks, visibleLines: visible.size, choiceLabels: choices.size, leaks }, null, 2));
assert.deepEqual(leaks, [], 'Generated action/result text has no untranslated English');
m.setLocale('en');
for (const { english } of translations) assert.equal(m.localizeLog(english), english);
console.log(JSON.stringify({ baseModes: modes.size, chainedModes: chained.size, realClicks: clicks, visibleLines: visible.size, choiceLabels: choices.size, leaks: leaks.length, englishPreserved: true }));
