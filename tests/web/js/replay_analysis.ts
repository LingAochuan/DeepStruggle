import assert from "node:assert/strict";
import { WasmEngine } from "../../../web/ui/src/engine/wasm_engine";
import { GameSession } from "../../../web/ui/src/game/session";
import { ReplayAnalyzer, matchesRecordedAction } from "../../../web/ui/src/analysis/replay";
import { encodePosition } from "../../../web/ui/src/game/position";
import type { ReplayFile } from "../../../web/ui/src/replay_controls";
import type { LiveAnalysis } from "../../../web/ui/src/analysis_view";

const base = process.argv[2];
const live = await WasmEngine.load(base);
const separate = await WasmEngine.load(base);
const L = live.layout;
for (const kind of ["POINT_NODE", "CHOOSE_BRANCH", "SELECT_PLAY_MODE", "SELECT_OP_MODE"]) {
  const decoded = { decision_type: L.decision_types[kind], primary_id: 255, secondary_id: 0, flags: 128 };
  assert.ok(matchesRecordedAction(L, L.confirm_done_index, decoded, { ...decoded, primary_id: 0 }));
  assert.ok(!matchesRecordedAction(L, L.confirm_done_index, decoded, { ...decoded, primary_id: 0, flags: 0 }));
  assert.ok(!matchesRecordedAction(L, L.confirm_done_index, decoded, { ...decoded, decision_type: L.decision_types.SELECT_CARD }));
}
const pass = { decision_type: L.decision_types.SELECT_CARD, primary_id: 0, secondary_id: 0, flags: 128 };
assert.ok(matchesRecordedAction(L, L.confirm_done_index, pass, { ...pass, flags: 0 }));
const event = { decision_type: L.decision_types.SELECT_PLAY_MODE, primary_id: L.resolutions.EVENT, secondary_id: 0, flags: 0 };
assert.ok(matchesRecordedAction(L, L.offsets.play_mode, event, { ...event, secondary_id: 5 }));
assert.ok(!matchesRecordedAction(L, L.offsets.play_mode, event, { ...event, flags: 128 }));
const session = new GameSession(live);
session.newGame(42);
live.seat(1, live.currentRules); live.seat(-1, live.currentRules);
// A small deterministic opening fixture, not a self-play experiment.
for (let i = 0; i < 14; i++) assert.equal(session.applyFlat(live.mask(false).findIndex(Boolean), false), null);
assert.equal(session.setVp(3), null);
assert.equal(session.applyFlat(live.mask(false).findIndex(Boolean), false, 4), null);
const doc = session.replay() as ReplayFile;
const original = live.snapshot();
const recorded = JSON.stringify(doc);
let reads = 0;
const read = async (e: WasmEngine): Promise<LiveAnalysis> => {
  assert.notEqual(e, live); reads++;
  const decider = e.decisionPlayer();
  return { model: "test", decision_player: decider === 1 ? "US" : "USSR",
    critic: { v_win_us: .2, v_win_ussr: -.1 },
    choices: Array.from(e.mask(false)).flatMap((v, idx) => v ? [{ idx, p: .5 }] : []) };
};
const analyzer = new ReplayAnalyzer(() => {}, async () => separate);
await analyzer.run(doc, doc.steps!, read);
assert.equal(analyzer.state.phase, "complete", JSON.stringify(analyzer.state.error));
assert.equal(analyzer.state.points.length, doc.steps!.length);
assert.equal(reads, 2 * doc.steps!.length);
assert.deepEqual(live.snapshot(), original);
assert.equal(JSON.stringify(doc), recorded);
assert.ok(analyzer.state.points[0].playedIndex !== null);

// Verify the entire replay before emitting any numbers, including otherwise legal board drift.
const corrupt = structuredClone(doc);
corrupt.steps![7].state_snapshot.defcon = 1;
reads = 0;
await analyzer.run(corrupt, corrupt.steps!, read);
assert.equal(analyzer.state.phase, "error");
assert.equal(analyzer.state.error?.step, 7);
assert.equal(reads, 0);
assert.equal(analyzer.state.points.length, 0);

// Snapshot-only re-exports can still be watched, but must not be guessed into an initial state.
await analyzer.run({ steps: doc.steps }, doc.steps!, read);
assert.equal(analyzer.state.error?.code, "This replay has no starting seed or position.");

// Shared-position replays start at their save, not at an unrelated seeded deal.
const token = await encodePosition(live.saveJson());
session.loadPosition(live.saveJson(), token); // no-op on the identical position
const loaded = new GameSession(separate);
loaded.newGame(888);
loaded.loadPosition(live.saveJson(), token);
assert.equal(loaded.applyFlat(separate.mask(false).findIndex(Boolean), false), null);
const fromPosition = loaded.replay() as ReplayFile;
await analyzer.run(fromPosition, fromPosition.steps!, read);
assert.equal(analyzer.state.phase, "complete", JSON.stringify(analyzer.state.error));

// A cancelled forward may finish, but cannot publish a stale point or clobber a new job.
let release!: () => void;
let entered!: () => void;
const started = new Promise<void>(r => { entered = r; });
const blocked = analyzer.run(doc, doc.steps!, async e => {
  entered(); await new Promise<void>(r => { release = r; }); return read(e);
});
await started;
analyzer.cancel();
const next = analyzer.run(fromPosition, fromPosition.steps!, read);
release();
await Promise.all([blocked, next]);
assert.equal(analyzer.state.phase, "complete");
assert.equal(analyzer.state.points.length, 1);
assert.deepEqual(live.snapshot(), original);
console.log("Replay reconstruction, overrides, forced-die inputs, shared starts, drift rejection, cancellation and live isolation passed.");
