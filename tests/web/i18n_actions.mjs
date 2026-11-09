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
// Shared policy slots must name this decision, never concatenate both contexts.
for (const [kind, offset, definitions, expected] of [
  ['SELECT_PLAY_MODE', L.offsets.play_mode, L.resolutions, {
    EVENT: '结算事件', SPACE: '尝试太空竞赛', OPS_INFLUENCE: '使用行动点：放置影响力',
    OPS_COUP: '使用行动点：尝试政变', OPS_REALIGN: '使用行动点：调整阵营',
  }],
  ['SELECT_OP_MODE', L.offsets.op_mode, L.op_modes, {
    INFLUENCE: '放置影响力', COUP: '尝试政变', REALIGN: '进行调整阵营',
  }],
]) {
  const position = { ...state, decision_context: { ...state.decision_context, decision_type: L.decision_types[kind] } };
  for (const [name, value] of Object.entries(definitions)) {
    const text = m.actionName(engine, offset + value, position);
    assert.equal(m.localizeLog(text), expected[name]);
    assert(!text.includes('/ OpMode:'), text);
  }
}
// Special stop choices are decisions, not generic passes. Exercise both locales and
// every binary/DEFCON/region branch even if the opening fixtures never draw that card.
for (const [kind, card, expected] of [
  ['SELECT_PLAY_MODE', 'GRAIN_SALES_TO_SOVIETS', "Return the drawn card to the USSR and conduct Grain Sales' 2 Ops"],
  ['SELECT_CARD', 'OUR_MAN_IN_TEHRAN', 'Done — return the rest to the deck'],
  ['SELECT_CARD', 'SALT_NEGOTIATIONS', 'Take no card'],
]) {
  const position = { ...state, decision_context: { ...state.decision_context,
    decision_type: L.decision_types[kind], resolving_card: L.card_ids[card] } };
  const text = m.actionName(engine, L.confirm_done_index, position);
  assert.equal(text, expected);
  assert(!/[A-Za-z]{3}/.test(m.localizeLog(text)), m.localizeLog(text));
}
for (const key of ['WARSAW_PACT_FORMED', 'OLYMPIC_GAMES', 'WARGAMES', 'CHERNOBYL', 'SUMMIT', 'HOW_I_LEARNED_TO_STOP_WORRYING']) {
  const levels = ['SUMMIT', 'HOW_I_LEARNED_TO_STOP_WORRYING'].includes(key);
  for (const choice of key === 'CHERNOBYL' ? Object.values(L.regions) : levels ? [1,2,3,4,5] : [0,1]) {
    const position = { ...state, decision_context: { ...state.decision_context,
      decision_type: L.decision_types.CHOOSE_BRANCH, resolving_card: L.card_ids[key] } };
    const idx = key === 'CHERNOBYL' ? L.offsets.region + choice : levels ? L.offsets.defcon_value + choice - 1 : L.offsets.branch + choice;
    const expected = m.branchMeta(L.card_ids[key], choice, position).title;
    assert.equal(m.actionName(engine, idx, position), expected);
    assert(!/[A-Za-z]{3}/.test(m.localizeLog(expected)), expected);
  }
}
for (const side of ['US', 'USSR']) for (let card = 1; card <= 110; card++) for (const resolution of Object.values(L.resolutions)) {
  const before = { ...state, current_phase_name: 'ACTION_ROUND', decision_context: {
    ...state.decision_context, decision_type: L.decision_types.SELECT_PLAY_MODE,
    decision_player: side, resolving_card: 0, pending_op_card: card,
  } };
  const info = m.clickInfo(engine, before, { decision_type: L.decision_types.SELECT_PLAY_MODE, primary_id: resolution, secondary_id: 0, flags: 0 }, side);
  modes.add(info.mode);
  const policyName = m.actionName(engine, L.offsets.play_mode + resolution, before);
  assert(!/[A-Za-z]{3}/.test(m.localizeLog(policyName)), policyName);
  if (info.mode.includes('then')) assert.equal(policyName, info.mode);
  const cancelledEvent = { ...before, decision_context: { ...before.decision_context, resolving_card: L.card_ids.UN_INTERVENTION } };
  assert.ok(!m.actionName(engine, L.offsets.play_mode + resolution, cancelledEvent).includes('then the'), 'UN Intervention must not promise an opponent event');
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
      if ([L.decision_types.SELECT_PLAY_MODE, L.decision_types.SELECT_OP_MODE].includes(engine.decisionType()))
        for (const i of valid) assert.equal(m.actionName(engine, i), m.actionName(engine, i, position));
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
