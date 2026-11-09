/** Reconstruct first, verify every board, then read the model in an isolated engine.
 * Display snapshots are not engine saves: they omit the RNG and pending event stack.
 * A different model must never change the rules under which a historical game was played.
 */
import { WasmEngine, type ActionLayout } from "../engine/wasm_engine";
import { decodePosition } from "../game/position";
import type { ReplayFile, ReplayStep } from "../replay_controls";
import type { LiveAnalysis } from "../analysis_view";
import type { MicroAction } from "../types";

export interface ReplayPoint {
  before: LiveAnalysis;
  after: LiveAnalysis;
  /** A historical micro-action need not be a whole action in a merged/macro policy. */
  playedIndex: number | null;
}
export interface ReplayProgress {
  phase: "idle" | "verifying" | "analysing" | "complete" | "cancelled" | "error";
  done: number;
  total: number;
  points: ReplayPoint[];
  error?: { code: string; step?: number; detail?: string };
  differentEngine?: boolean;
}
class ReplayFailure extends Error {
  constructor(readonly code: string, readonly step?: number, readonly detail?: string) { super(code); }
}
const stable = (value: unknown): string => JSON.stringify(value, (_key, v) =>
  v && typeof v === "object" && !Array.isArray(v)
    ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v);

/** Only compare engine fields, not UI annotations (logs, region scores, redaction flags). */
export function snapshotDifference(actual: object, recorded: object): string | null {
  const a = actual as Record<string, unknown>, b = recorded as Record<string, unknown>;
  for (const key of ["countries", "card_locations", "decision_context", "legal_actions", "turn", "defcon"])
    if (!(key in b)) return key;
  for (const key of Object.keys(a)) {
    if (!(key in b)) continue; // optional display fields added by a newer engine
    // Names and labels are presentation; rule IDs, counters and legal choices must match.
    const clean = (x: unknown): unknown => {
      if (Array.isArray(x)) return x.map(clean);
      if (x && typeof x === "object") return Object.fromEntries(Object.entries(x)
        .filter(([k]) => k !== "name" && !k.endsWith("_name") && k !== "valid_action_labels" && k !== "can_confirm_done")
        .map(([k, v]) => [k, clean(v)]));
      return x;
    };
    if (stable(clean(a[key])) !== stable(clean(b[key]))) return key;
  }
  return null;
}

function actionOf(step: ReplayStep, index: number): MicroAction {
  const a = step.action;
  if (!a || !Number.isInteger(a.decision_type) || !Number.isInteger(a.primary_id)
      || (a.flags !== undefined && !Number.isInteger(a.flags))
      || (a.secondary_id !== undefined && !Number.isInteger(a.secondary_id)))
    throw new ReplayFailure("Replay action data is missing.", index);
  return { decision_type: a.decision_type, primary_id: a.primary_id,
    secondary_id: a.secondary_id ?? 0, flags: a.flags ?? 0 };
}

/** Called only for legal policy choices after the recorded action has been replay-verified.
 * Older HUDs encoded stop as primary 0 + flag, while decodeFlat uses primary 255.
 * secondary_id may carry a forced die, which is not a separate policy choice. */
export function matchesRecordedAction(L: ActionLayout, idx: number, decoded: MicroAction, action: MicroAction): boolean {
  if (decoded.decision_type !== action.decision_type) return false;
  if (idx === L.confirm_done_index) {
    return !!((action.flags ?? 0) & 128) || action.primary_id === 255
      || (action.decision_type === L.decision_types.SELECT_CARD && action.primary_id === 0)
      || (action.decision_type === L.decision_types.POINT_NODE && action.primary_id === 84);
  }
  return decoded.primary_id === action.primary_id && (decoded.flags ?? 0) === (action.flags ?? 0);
}

/** A single owned job. Superseding/cancelling never publishes stale results. */
export class ReplayAnalyzer {
  state: ReplayProgress = { phase: "idle", done: 0, total: 0, points: [] };
  private generation = 0;
  private queue: Promise<void> = Promise.resolve();
  private engine: WasmEngine | null = null;
  constructor(private readonly changed: () => void,
    private readonly createEngine: () => Promise<WasmEngine> = () => WasmEngine.load()) {}

  cancel(clear = false): void {
    this.generation++;
    if (clear) this.state = { phase: "idle", done: 0, total: 0, points: [] };
    else if (this.state.phase === "verifying" || this.state.phase === "analysing") this.state.phase = "cancelled";
    this.changed();
  }

  run(doc: ReplayFile, steps: ReplayStep[], read: (engine: WasmEngine) => Promise<LiveAnalysis>): Promise<void> {
    const job = ++this.generation;
    const current = () => job === this.generation;
    const state: ReplayProgress = { phase: "verifying", done: 0, total: steps.length, points: [] };
    this.state = state;
    this.changed();
    const yieldUi = () => new Promise<void>(resolve => setTimeout(resolve, 0));
    // One WASM instance, one ONNX call at a time, including rapid model/file changes.
    this.queue = this.queue.then(async () => {
      if (!current()) return;
      try {
        const engine = this.engine ??= await this.createEngine();
        if (!current()) return;
        state.differentEngine = !!doc.metadata?.engine_fingerprint && doc.metadata.engine_fingerprint !== engine.fingerprint;
        if (!steps.length) throw new ReplayFailure("Load a replay to analyse it.");
        const token = doc.metadata?.start_position;
        if (token) engine.loadSaveJson(await decodePosition(token));
        else {
          const seed = doc.metadata?.seed ?? doc.initial_state?.seed ?? doc.seed;
          if (!Number.isSafeInteger(seed) || seed! < 0) throw new ReplayFailure("This replay has no starting seed or position.");
          engine.newGame(seed!);
          engine.seat(1, engine.currentRules);
          engine.seat(-1, engine.currentRules);
        }
        if (!current()) return;
        const states: Array<{ before: Uint8Array; after: Uint8Array }> = [];
        for (let i = 0; i < steps.length; i++) {
          if (!current()) return;
          for (const entry of doc.debug_overrides ?? []) if (entry.step === i) {
            const o = entry.override;
            const error = o.kind === "country" ? engine.setCountry(o.id!, o.us!, o.ussr!)
              : o.kind === "defcon" ? engine.setDefcon(o.value!)
              : o.kind === "vp" ? engine.setVp(o.value!) : "Unknown override";
            if (error) throw new ReplayFailure("Replay position could not be reconstructed.", i, error);
          }
          const step = steps[i], a = actionOf(step, i);
          if (step.seat_rules) {
            if (!Number.isInteger(step.seat_rules.US) || !Number.isInteger(step.seat_rules.USSR))
              throw new ReplayFailure("Replay action data is missing.", i);
            engine.seat(1, step.seat_rules.US);
            engine.seat(-1, step.seat_rules.USSR);
          }
          const before = engine.snapshot();
          // Old browser exports carried the manually selected die in secondary_id.
          const die = step.forced_die ?? (doc.metadata?.game_id === "workbench" ? a.secondary_id ?? 0 : 0);
          if (!Number.isInteger(die) || die < 0 || die > 6) throw new ReplayFailure("Replay action data is missing.", i);
          const refused = engine.step(a, die);
          if (refused) throw new ReplayFailure("Replay position could not be reconstructed.", i, refused);
          const diff = snapshotDifference(engine.display(), step.state_snapshot ?? {});
          if (diff) throw new ReplayFailure("Replay position differs from the recorded board.", i, diff);
          states.push({ before, after: engine.snapshot() });
          state.done = i + 1;
          if (i % 16 === 0) { this.changed(); await yieldUi(); }
        }
        if (!current()) return;
        state.phase = "analysing";
        state.done = 0;
        this.changed();
        for (let i = 0; i < states.length; i++) {
          if (!current()) return;
          engine.restore(states[i].before);
          const before = await read(engine);
          if (!current()) return;
          const a = actionOf(steps[i], i);
          const played = before.choices.filter(c => !c.composed).filter(c => {
            const decoded = engine.decodeFlat(c.idx);
            return matchesRecordedAction(engine.layout, c.idx, decoded, a);
          });
          engine.restore(states[i].after);
          const after = await read(engine);
          if (!current()) return;
          const values = [after.critic?.v_win_us, after.critic?.v_win_ussr];
          if (values.some(v => typeof v !== "number" || !Number.isFinite(v) || Math.abs(v) > 1.00001)
              || [...before.choices, ...after.choices].some(c => !Number.isFinite(c.p) || c.p < 0 || c.p > 1))
            throw new ReplayFailure("The model returned an invalid value.", i);
          state.points.push({ before, after, playedIndex: played.length === 1 ? played[0].idx : null });
          state.done = i + 1;
          this.changed();
          await yieldUi();
        }
        if (current()) { state.phase = "complete"; this.changed(); }
      } catch (e) {
        if (!current()) return;
        state.phase = "error";
        state.error = e instanceof ReplayFailure ? e : { code: "Replay analysis failed.", detail: String(e) };
        this.changed();
      }
    });
    return this.queue;
  }
}
