/**
 * Readable names for flat action indices -- the port of `ActionEncoder.get_action_name`
 * (bindings/action_encoder.py), with the offsets and enum names taken from the engine's own layout rather than
 * copied, and names for the two P17 heads (DEFCON value, region) that the Python version leaves
 * as "UnknownAction".
 */
import { ActionLayout, WasmEngine } from "../engine/wasm_engine";
import { GameState } from "../types";
import { namesByValue } from "../engine/layout";
import { branchMeta, regionName } from "./branches";
import { CARDS_METADATA } from "../metadata";

// The same visible titles as the action HUD. Flat slots are reused by play-mode
// and deferred Ops decisions; the current decision determines which title applies.
const PLAY_MODE_TITLES: Record<string, string> = {
  EVENT: "Resolve the Event", SPACE: "Space Race Attempt",
  OPS_INFLUENCE: "Operations: Place Influence", OPS_COUP: "Operations: Coup Attempt",
  OPS_REALIGN: "Operations: Realignment",
};
const OP_MODE_TITLES: Record<string, string> = {
  INFLUENCE: "Place Influence", COUP: "Conduct Coup Attempt", REALIGN: "Conduct Realignment",
};

/** Names are derived from the position before the action (never the resulting board). */
export function actionName(engine: WasmEngine, idx: number, state?: GameState): string {
  const L: ActionLayout = engine.layout;
  const o = L.offsets;
  state ??= engine.display();
  const ctx = state.decision_context;
  const decision = ctx.decision_type;
  if (idx === L.confirm_done_index) {
    if (decision === L.decision_types.SELECT_PLAY_MODE && ctx.resolving_card === L.card_ids.GRAIN_SALES_TO_SOVIETS)
      return "Return the drawn card to the USSR and conduct Grain Sales' 2 Ops";
    if (decision === L.decision_types.SELECT_CARD) {
      if (ctx.resolving_card === L.card_ids.OUR_MAN_IN_TEHRAN) return "Done — return the rest to the deck";
      if (ctx.resolving_card === L.card_ids.SALT_NEGOTIATIONS) return "Take no card";
      return state.legal_actions.valid_ids.some(id => id >= 1 && id <= 110)
        ? "Pass / Confirm (Do not discard)" : "No card can be chosen — continue";
    }
    if (decision === L.decision_types.POINT_NODE)
      return ctx.allow_early_stop ? "Done / Pass Remaining" : "Done — no eligible target left";
    return "Confirm / Pass";
  }
  if (idx < o.play_mode) return `SelectCard #${idx + 1} (${engine.cardName(idx + 1)})`;
  if (idx < o.roll_die) {
    if (decision === L.decision_types.SELECT_OP_MODE && idx >= o.op_mode) {
      const op = namesByValue(L.op_modes)[idx - o.op_mode] ?? String(idx - o.op_mode);
      return OP_MODE_TITLES[op] ?? op;
    }
    const mode = idx - o.play_mode;
    const name = namesByValue(L.resolutions)[mode] ?? String(mode);
    // EVENT on an opponent card is event-first followed by our Ops, not just its event.
    // Event-granted choices (e.g. UN Intervention) use their own context instead.
    const opponent = ctx.decision_player === "US" ? "USSR" : "US";
    if (decision === L.decision_types.SELECT_PLAY_MODE && !ctx.resolving_card
        && CARDS_METADATA.find(c => c.id === ctx.pending_op_card)?.side === opponent.toLowerCase()) {
      if (name === "EVENT") return `${opponent} Event first, then Ops`;
      const op = { OPS_INFLUENCE: "Influence", OPS_COUP: "Coup", OPS_REALIGN: "Realignment" }[name];
      if (op) return `Ops: ${op}, then the ${opponent} Event`;
    }
    return PLAY_MODE_TITLES[name] ?? `Resolution: ${name}`;
  }
  if (idx === o.roll_die) return "RollDie";
  if (idx < o.node) return `Unassigned #${idx}`;
  if (idx < o.branch) return `PointNode #${idx - o.node} (${engine.countryName(idx - o.node)})`;
  const card = ctx.resolving_card || ctx.pending_op_card;
  if (idx < L.confirm_done_index) {
    const meta = state ? branchMeta(card, idx - o.branch, state) : null;
    return meta ? meta.title : `Branch #${idx - o.branch}`;
  }
  if (idx >= o.defcon_value && idx < o.region) {
    const level = idx - o.defcon_value + 1;
    const meta = state ? branchMeta(card, level, state) : null;
    return meta ? meta.title : `Set DEFCON to ${level}`;
  }
  if (idx >= o.region && idx < L.size) return regionName(idx - o.region) ?? `Region #${idx - o.region}`;
  return `UnknownAction #${idx}`;
}
