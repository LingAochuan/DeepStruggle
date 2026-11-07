import { localizeLog } from "./i18n/log";
import { t, label } from "./i18n";
import { GameState, MicroAction } from "./types";
import { CARDS_METADATA } from "./metadata";
import { branchMeta } from "./game/branches";
import { ActionLayout, engineLayout, namesByValue } from "./engine/layout";
import { escapeHtml, num } from "./html";

const CARD_META = new Map(CARDS_METADATA.map(c => [c.id, c]));

/** Where a card an event offers sits, in words ("Drawn", "Discard pile", "US hand", ...). */
function whereLabel(loc: string | undefined): string {
  if (!loc) return "";
  if (loc === "PEEKED_TEMP") return t("Drawn");
  if (loc === "DISCARD_PILE") return t("Discard pile");
  if (loc.startsWith("HAND_USSR")) return t("USSR hand");
  if (loc.startsWith("HAND_US")) return t("US hand");
  if (loc === "REMOVED_FROM_GAME") return t("Removed");
  if (loc === "DRAW_DECK") return t("Draw deck");
  return loc;
}

/**
 * One button per card an event lets the player choose. The cards are often in no hand the
 * player can see -- Our Man in Tehran's five drawn cards, the discard pile for Star Wars and SALT
 * Negotiations -- so without these the choice could not be made from the page at all.
 */
function cardChoiceButtons(state: GameState, ids: number[]): string {
  const locs = (state.card_locations || {}) as Record<string, string>;
  return ids.filter(id => id >= 1 && id <= 110).map(id => {
    const meta = CARD_META.get(id);
    const name = meta?.name ?? t("Card #{0}", [id]);
    const side = meta?.side ?? "neutral";
    const where = whereLabel(locs[String(id)]);
    const text = meta?.description ? escapeHtml(meta.description) : "";
    return `
      <button class="btn btn-secondary btn-block btn-hud-action btn-choice-card card-choice side-${escapeHtml(side)}" data-primary="${id}" title="${label(text)}" style="margin-bottom: 6px; text-align: left; padding: 7px 10px;">
        <div style="display: flex; justify-content: space-between; gap: 8px; align-items: baseline;">
          <span style="font-weight: bold;">${`#${id} ${escapeHtml(name)}`}</span>
          <span style="font-size: 11px; opacity: 0.8; white-space: nowrap;">${label(meta ? t("{0} Ops · {1}", [meta.ops, escapeHtml(side.toUpperCase())]) : "")}</span>
        </div>
        ${label(where ? `<div style="font-size: 10px; opacity: 0.7; margin-top: 2px;">${label(escapeHtml(where))}</div>` : "")}
      </button>`;
  }).join("");
}

/**
 * What an event's card choice asks for, by the card resolving (its ts::card_ids name). `who` is the
 * deciding side, already HTML.
 */
const CARD_CHOICE_PROMPTS: Record<string, (who: string) => string> = {
  BLOCKADE: who => `<strong>${`${who}:`}</strong> <em>${t("Blockade")}</em> ${t("is resolving! Select and discard a card with")} <strong>${t("Operations ≥ 3")}</strong> ${t("from hand to maintain US influence in West Germany (or confirm/pass to forfeit influence):")}`,
  SALT_NEGOTIATIONS: who => `<strong>${`${who}:`}</strong> <em>${t("SALT Negotiations")}</em>${t(": Select a non-scoring card from the Discard Pile to return to hand:")}`,
  OUR_MAN_IN_TEHRAN: who => `<strong>${`${who}:`}</strong> <em>${t("Our Man in Tehran")}</em>${t(": these are the cards drawn from the deck. Discard any of them, one at a time;")} <em>${t("Done")}</em> ${t("returns the rest to the deck:")}`,
  STAR_WARS: who => `<strong>${`${who}:`}</strong> <em>${t("Star Wars")}</em>${t(": Select a non-scoring card from the Discard Pile -- its Event is played immediately:")}`,
  FIVE_YEAR_PLAN: who => `<strong>${`${who}:`}</strong> <em>${t("Five Year Plan")}</em>${t(": Select a card from hand to discard:")}`,
  MISSILE_ENVY: who => `<strong>${`${who}:`}</strong> <em>${t("Missile Envy")}</em>${t(": Select your highest Ops card to transfer to opponent:")}`,
  ALDRICH_AMES: who => `<strong>${`${who}:`}</strong> <em>${t("Aldrich Ames")}</em>${t(": Select a card from US hand to discard:")}`,
  GRAIN_SALES_TO_SOVIETS: who => `<strong>${`${who}:`}</strong> <em>${t("Grain Sales")}</em>${t(": Select a card from USSR hand:")}`,
  ASK_NOT_WHAT_YOUR_COUNTRY_CAN_DO_FOR_YOU: who => `<strong>${`${who}:`}</strong> <em>${t("Ask Not What Your Country Can Do For You")}</em>${t(": Select cards from hand to discard:")}`,
  TERRORISM: who => `<strong>${`${who}:`}</strong> <em>${t("Terrorism")}</em>${t(": Select a card from hand to discard:")}`,
  SPACE_WALK_DISCARD: who => `<strong>${`${who}:`}</strong> <em>${t("Eagle / Bear Has Landed (Space Race Box 6)")}</em>${t(": You may discard 1 card from hand at turn end (or click Pass to retain full hand):")}`,
};

/** What a CHOOSE_BRANCH event asks, by its card's ts::card_ids name; anything else "choose an option". */
const BRANCH_ASKS: Record<string, string> = {
  CHERNOBYL: "designate a region: the USSR may not place influence there with Ops for the rest of the turn",
  SUMMIT: "set DEFCON (the Summit winner may move it by 1, or leave it)",
  HOW_I_LEARNED_TO_STOP_WORRYING: "set DEFCON to any level",
};

/**
 * The play modes, by the engine's Resolution names (WasmEngine.layout.resolutions). P17 merged
 * PlayMode -> CHOOSE_TIMING_BRANCH -> SELECT_OP_MODE into this one decision; on an opponent's card
 * EVENT is the event-first branch.
 */
const MODE_LABELS: Record<string, (ops: string) => { title: string; desc: string; class: string }> = {
  EVENT: () => ({ title: t("Resolve the Event"), desc: t("Trigger the printed event. On an opponent's card this is the event-first branch — you choose how to spend the Ops afterwards."), class: "btn-primary" }),
  SPACE: ops => ({ title: t("Space Race Attempt"), desc: t("Discard the card to attempt an advance on the Space Race track ({0}).", [ops]), class: "btn-secondary" }),
  OPS_INFLUENCE: ops => ({ title: t("Operations: Place Influence"), desc: t("Spend {0} placing influence.", [ops]), class: "btn-success" }),
  OPS_COUP: ops => ({ title: t("Operations: Coup Attempt"), desc: t("Spend {0} on a coup — rolls a die.", [ops]), class: "btn-danger" }),
  OPS_REALIGN: ops => ({ title: t("Operations: Realignment"), desc: t("Spend {0} on realignment rolls — opposed dice.", [ops]), class: "btn-warning" }),
};

/** The deferred Ops choice, by the engine's OpMode names (WasmEngine.layout.op_modes). */
const OP_MODE_LABELS: Record<string, { text: string; desc: string; class: string }> = {
  INFLUENCE: { text: "Place Influence", desc: "Place influence markers in adjacent countries", class: "btn-primary" },
  COUP: { text: "Conduct Coup Attempt", desc: "Roll die to remove enemy influence and add own", class: "btn-danger" },
  REALIGN: { text: "Conduct Realignment", desc: "Opposed die rolls to remove enemy influence", class: "btn-secondary" },
};

/** The ts::card_ids name of `id`, among those the engine exports; "" for any other card. */
function cardKey(L: ActionLayout, id: number): string {
  if (!id) return "";
  for (const [name, v] of Object.entries(L.card_ids)) if (v === id) return name;
  return "";
}

export class ActionHud {
  private container: HTMLElement;
  private onAction: (action: MicroAction) => void;
  public selectedDieRoll: number = 0; // 0 = auto
  /** Called when the HUD re-renders itself (die selector), so decorations can be re-applied. */
  public onRerender: (() => void) | null = null;

  constructor(onAction: (action: MicroAction) => void) {
    this.container = document.getElementById("decision-body")!;
    this.onAction = onAction;
  }

  /**
   * The open decision's options -- exactly the engine's legal actions (`legal_actions`, the engine's
   * mask), worded. The HUD says nothing the engine did not: no odds, no rule of its own.
   *
   * In a replay the state is the file's snapshot, so every string from it is escaped.
   */
  public render(state: GameState) {
    const ctx = state.decision_context;
    const legal = state.legal_actions;
    const badgeEl = document.getElementById("decision-type-badge");
    const L = engineLayout();

    if (!ctx || !legal || state.is_terminal || !L) {
      if (badgeEl) badgeEl.textContent = label(state.is_terminal ? "TERMINAL" : "WAITING");
      this.container.innerHTML = `<div style="color: var(--text-dim); text-align: center; padding: 20px;">${label(L ? t("No active decision required.") : t("Loading the engine…"))}</div>`;
      return;
    }

    const dType = num(ctx.decision_type);
    const dTypeName = ctx.decision_type_name || namesByValue(L.decision_types)[dType] || `TYPE_${dType}`;
    const playerRaw = String(ctx.decision_player || "NONE");
    const player = escapeHtml(label(playerRaw));
    const phaseName = String(state.current_phase_name || state.phase_name || "ACTION");
    const card = (name: string) => L.card_ids[name] ?? -1;

    if (badgeEl) {
      badgeEl.textContent = label(dTypeName);
      badgeEl.className = `badge badge-${playerRaw.toLowerCase().replace(/[^a-z]/g, "")}`;
    }

    // A player's view while the other side decides (game/view.ts): its options are its own.
    if (state.view_hidden_decision) {
      this.container.innerHTML = `<div class="hud-waiting">
        <div><strong>${label(player)}</strong> ${t("to move — {0}.", [escapeHtml(phaseName.toLowerCase().replace("_", " "))])}</div>
        <div class="hud-waiting-note">${t("Its options are hidden in the {0} view; the model plays this side (auto-play).", [escapeHtml(state.view)])}</div>
      </div>`;
      return;
    }

    let promptText = "";
    let buttonsHtml = "";
    let showDieSelector = false;

    const validIds = (legal.valid_ids || []).map(num);
    const allowEarlyStop = legal.allow_early_stop || ctx.allow_early_stop;
    const DT = L.decision_types;

    if (dType === DT.SELECT_CARD) {
      const resolvingCard = num(ctx.resolving_card || 0);
      const prompt = CARD_CHOICE_PROMPTS[cardKey(L, resolvingCard)];
      if (prompt) {
        promptText = prompt(player);
      } else if (resolvingCard > 0) {
        promptText = `<strong>${`${player}:`}</strong> ${t("Resolving Event (Card #{0}): Select a card:", [resolvingCard])}`;
      } else if (phaseName === "HEADLINE") {
        let oppHeadlineBanner = "";
        if (playerRaw === "US" && state.headline_ussr_card) {
          oppHeadlineBanner = `<div class="headline-reveal-box" style="background: rgba(220,53,69,0.15); border: 1px solid rgba(220,53,69,0.4); padding: 6px 10px; border-radius: 4px; margin-bottom: 8px; font-size: 13px;">📡 <strong>${t("Space Race Privilege (Box 4):")}</strong> ${t("USSR revealed Headline: Card #{0}", [num(state.headline_ussr_card)])}</div>`;
        } else if (playerRaw === "USSR" && state.headline_us_card) {
          oppHeadlineBanner = `<div class="headline-reveal-box" style="background: rgba(13,110,253,0.15); border: 1px solid rgba(13,110,253,0.4); padding: 6px 10px; border-radius: 4px; margin-bottom: 8px; font-size: 13px;">📡 <strong>${t("Space Race Privilege (Box 4):")}</strong> ${t("US revealed Headline: Card #{0}", [num(state.headline_us_card)])}</div>`;
        }
        promptText = `${label(oppHeadlineBanner)}<strong>${t("{0} Headline Phase:", [player])}</strong> ${t("Select a card from your hand to play as your Headline:")}`;
      } else {
        promptText = `<strong>${t("{0} Action Round {1}:", [player, num(state.action_round)])}</strong> ${t("Select a card from your hand to play:")}`;
      }

      // An event's card choice lists its cards here: they are often in no hand on screen.
      if (resolvingCard > 0 && !document.getElementById("text-card-picker")) {
        buttonsHtml += cardChoiceButtons(state, validIds);
      }
      // Offered whenever the engine offers it (id 0 in valid_ids), not only when the context
      // allows an early stop: a choice with no legal card at all -- Star Wars facing a discard
      // pile of events the US cannot trigger -- is left by passing, and without this button the
      // page had nothing to click.
      if (allowEarlyStop || validIds.includes(0)) {
        const passLabel = resolvingCard === card("OUR_MAN_IN_TEHRAN") ? t("✓ Done — return the rest to the deck")
          : resolvingCard === card("SALT_NEGOTIATIONS") ? t("✓ Take no card")
          : !validIds.some(id => id >= 1 && id <= 110) ? t("✓ No card can be chosen — continue")
          : t("✓ Pass / Confirm (Do not discard)");
        buttonsHtml += `<button class="btn btn-warning btn-block btn-hud-action" data-flags="128" data-primary="0" style="margin-top: 8px;">${label(passLabel)}</button>`;
      }
    } else if (dType === DT.SELECT_PLAY_MODE) {
      const cardName = escapeHtml(ctx.pending_op_card_name || t("Card #{0}", [num(ctx.pending_op_card)]));
      // Grain Sales to Soviets resolves the card it drew on this node: play it, or hand it back to
      // the USSR and conduct Grain Sales' own 2 Ops. The engine offers the return as CONFIRM_DONE
      // (allow_early_stop), outside the play modes in valid_ids -- so without the button below the
      // page could only play the drawn card.
      const grainSales = num(ctx.resolving_card || 0) === card("GRAIN_SALES_TO_SOVIETS");
      promptText = grainSales
        ? `<strong>${`${player}:`}</strong> <em>${t("Grain Sales to Soviets")}</em> ${t("drew")} <em>${label(cardName)}</em> ${t("from the USSR hand. Play it, or return it and conduct Grain Sales' 2 Ops:")}`
        : `<strong>${`${player}:`}</strong> ${t("Choose how to play")} <em>${label(cardName)}</em>:`;
      // The Ops are known only once granted; at Grain Sales' node the drawn card has none yet.
      const opsValue = num(ctx.pending_ops_value);
      const ops = opsValue > 0 ? t("{0} Ops", [opsValue]) : t("the card's Ops");
      const modeNames = namesByValue(L.resolutions);
      validIds.forEach(m => {
        // Loud, not bland: a mode the engine has and this table has not means the Resolution enum
        // grew. The engine's own name for it is still shown.
        const modeLabel = MODE_LABELS[modeNames[m] ?? ""];
        const cfg = modeLabel ? modeLabel(ops) : {
          title: t("⚠ Unlabelled resolution mode {0} ({1})", [m, escapeHtml(modeNames[m] ?? "unknown")]),
          desc: t("The viewer has no label for this mode — the engine's Resolution enum has changed and web/ui/src/action_hud.ts was not updated."),
          class: "btn-warning",
        };
        buttonsHtml += `
          <button class="btn ${cfg.class} btn-block btn-hud-action btn-choice-card" data-primary="${m}" style="margin-bottom: 8px; text-align: left; padding: 8px 12px;">
            <div style="font-weight: bold; font-size: 13px;">${label(cfg.title)}</div>
            <div style="font-size: 11px; opacity: 0.85; margin-top: 2px;">${label(cfg.desc)}</div>
          </button>
        `;
      });
      // Any of these can roll a die -- a Space Race attempt, a coup, a realignment, an event that
      // rolls -- and a forced die is used only if one is rolled.
      showDieSelector = true;
      if (grainSales && allowEarlyStop) {
        // The engine's own decoding of this node's CONFIRM_DONE: primary 255, the done flag.
        buttonsHtml += `
          <button class="btn btn-warning btn-block btn-hud-action" data-primary="255" data-flags="128" style="margin-top: 4px; text-align: left; padding: 8px 12px;">
            <div style="font-weight: bold; font-size: 13px;">${t("↩ Return {0} to the USSR", [cardName])}</div>
            <div style="font-size: 11px; opacity: 0.85; margin-top: 2px;">${t("Hand the card back (the USSR knows you saw it) and conduct Grain Sales' 2 Ops instead.")}</div>
          </button>
        `;
      }
    } else if (dType === DT.CHOOSE_TIMING_BRANCH) {
      // RETIRED by P17 and unreachable: on an opponent card, Resolution::EVENT *is* the
      // event-first branch, so no separate timing decision is ever emitted. Kept because
      // a replay recorded before P17 can still contain one.
      const oppCardName = escapeHtml(ctx.pending_op_card_name || t("Card #{0}", [num(ctx.pending_op_card)]));
      promptText = `<strong>${`${player}:`}</strong> ${t("Opponent card")} <em>${label(oppCardName)}</em> ${t("played for Ops. Choose execution order:")}`;
      if (validIds.includes(0)) {
        buttonsHtml += `
          <button class="btn btn-primary btn-block btn-hud-action btn-choice-card" data-primary="0" style="margin-bottom: 8px; text-align: left; padding: 8px 12px;">
            <div style="font-weight: bold; font-size: 13px;">${t("Branch 0: Operations First")}</div>
            <div style="font-size: 11px; opacity: 0.85; margin-top: 2px;">${t("Conduct Operations now. Opponent event triggers afterwards.")}</div>
          </button>
        `;
      }
      if (validIds.includes(1)) {
        buttonsHtml += `
          <button class="btn btn-secondary btn-block btn-hud-action btn-choice-card" data-primary="1" style="margin-bottom: 8px; text-align: left; padding: 8px 12px;">
            <div style="font-weight: bold; font-size: 13px;">${t("Branch 1: Opponent Event First")}</div>
            <div style="font-size: 11px; opacity: 0.85; margin-top: 2px;">${t("Trigger opponent event first. Conduct your Operations afterwards.")}</div>
          </button>
        `;
      }
    } else if (dType === DT.SELECT_OP_MODE) {
      promptText = `<strong>${`${player}:`}</strong> ${t("Select Operations action with")} <strong>${t("{0} Ops", [num(ctx.pending_ops_value)])}</strong> ${t("available:")}`;
      const opNames = namesByValue(L.op_modes);
      validIds.forEach(m => {
        const cfg = OP_MODE_LABELS[opNames[m] ?? ""] || { text: t("Op Mode {0}", [m]), desc: "", class: "btn-secondary" };
        buttonsHtml += `
          <button class="btn ${cfg.class} btn-block btn-hud-action btn-choice-card" data-primary="${m}" style="margin-bottom: 8px; text-align: left; padding: 8px 12px;">
            <div style="font-weight: bold;">${label(cfg.text)}</div>
            <div style="font-size: 11px; opacity: 0.85; margin-top: 2px;">${label(cfg.desc)}</div>
          </button>
        `;
      });
    } else if (dType === DT.POINT_NODE) {
      const opMode = ctx.op_mode;
      const isCoup = opMode === L.op_modes.COUP;
      const isRealign = opMode === L.op_modes.REALIGN;
      const resolving = num(ctx.resolving_card || 0);
      const remaining = num(ctx.remaining_steps);

      if (phaseName === "SETUP") {
        const region = playerRaw === "USSR" ? t("Eastern Europe") : t("Western Europe");
        promptText = `<strong>${t("{0} Setup Phase:", [player])}</strong> ${t("Click highlighted countries in {0} to place influence (", [region])}<strong>${t("{0} remaining", [remaining])}</strong>):`;
      } else if (resolving > 0) {
        const resCard = escapeHtml(ctx.resolving_card_name || t("Card #{0}", [resolving]));
        promptText = `<strong>${`${player}:`}</strong> ${t("Resolving event")} <em>${label(resCard)}</em>${t(". Select target country (")}<strong>${t("{0} remaining", [remaining])}</strong>):`;
        // An event's target may be rolled for (a war, a coup the event grants).
        showDieSelector = true;
      } else if (isCoup) {
        promptText = `<strong>${`${player}:`}</strong> ${t("Select target country to")} <strong>${t("COUP")}</strong> ${t("with")} <strong>${t("{0} Ops", [num(ctx.pending_ops_value)])}</strong> ${t("(or click on map):")}`;
        showDieSelector = true;
      } else if (isRealign) {
        promptText = `<strong>${`${player}:`}</strong> ${t("Select target country for")} <strong>${t("REALIGNMENT")}</strong> ${t("(or click on map):")}`;
        showDieSelector = true;
      } else {
        const left = remaining > 0 ? t(" ({0} Ops remaining)", [remaining]) : "";
        promptText = `<strong>${`${player}:`}</strong> ${t("Select a target country{0}:", [left])}`;
      }

      // The targets the engine offers (its legal mask): the board's numbers for each, no more.
      if (validIds.length > 0 && (isCoup || isRealign || resolving > 0 || validIds.length <= 12)) {
        const byId = new Map(Object.values(state.countries || {}).map(c => [num(c.id), c]));
        let targetsHtml = "";
        validIds.filter(id => id < 84).forEach(cid => {
          const country = byId.get(cid);
          const cName = escapeHtml(country?.name || t("Country #{0}", [cid]));
          const cStab = num(country?.stability ?? 0);
          const isBg = !!country?.battleground;
          const usInf = num(country?.us_influence ?? 0);
          const ussrInf = num(country?.ussr_influence ?? 0);
          targetsHtml += `
            <button class="btn btn-secondary btn-block btn-hud-action btn-target-card" data-primary="${cid}" data-secondary="${this.selectedDieRoll}" style="margin-bottom: 6px; text-align: left; padding: 8px 10px; border: 1px solid rgba(255,255,255,0.12);">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-weight: bold; font-size: 13px;">${t("{0}{1} (Stab {2})", [isBg ? '★ ' : '', cName, cStab])}</span>
                <span style="font-size: 11px; opacity: 0.85;">${t("US:")}<strong>${label(usInf)}</strong> ${t("/ USSR:")}<strong>${label(ussrInf)}</strong></span>
              </div>
            </button>
          `;
        });

        if (targetsHtml) {
          buttonsHtml += `
            <div class="hud-target-list-header" style="font-size: 11px; font-weight: 700; color: var(--text-dim); margin: 8px 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px;">
              ${t("Available Target Actions ({0}):", [validIds.length])}
            </div>
            <div class="hud-targets-scroll-list" style="max-height: 200px; overflow-y: auto; padding-right: 2px;">
              ${label(targetsHtml)}
            </div>
          `;
        }
      }

      if (allowEarlyStop) {
        buttonsHtml += `<button class="btn btn-warning btn-block btn-hud-action" data-flags="128" data-primary="0" style="margin-top: 8px;">${t("✓ Done / Pass Remaining")}</button>`;
      } else if (legal.can_confirm_done) {
        // No eligible target is left for what remains (the engine's flat mask offers only
        // CONFIRM_DONE): without this the panel was empty and the game could not go on.
        promptText += ` <em>${t("No eligible target is left.")}</em>`;
        buttonsHtml += `<button class="btn btn-warning btn-block btn-hud-action" data-flags="128" data-primary="0" style="margin-top: 8px;">${t("✓ Done — no eligible target left")}</button>`;
      }
    } else if (dType === DT.CHOOSE_BRANCH) {
      const resolvingCardId = num(ctx.resolving_card || ctx.pending_op_card);
      const resolvingCardName = escapeHtml(ctx.resolving_card_name || (resolvingCardId ? t("Card #{0}", [resolvingCardId]) : "Event"));
      // What each branch means comes from game/branches.ts (a region for Chernobyl, the DEFCON level
      // for Summit and How I Learned...), the same text the action log uses -- never a bare number.
      promptText = `<strong>${`${player}:`}</strong> <em>${label(resolvingCardName)}</em>${`: ${BRANCH_ASKS[cardKey(L, resolvingCardId)] ?? t("choose an option")}:`}`;
      const actionLabels = legal.valid_action_labels || {};

      validIds.forEach(b => {
        const meta = branchMeta(resolvingCardId, b, state);
        // An event this page has no words for still shows the engine's own label, never just "Option N".
        const branchTitle = escapeHtml(localizeLog(meta ? meta.title : `${actionLabels[b.toString()] || "Option"} ${b}`));
        const branchDesc = escapeHtml(localizeLog(meta ? meta.desc : ""));

        buttonsHtml += `
          <button class="btn btn-secondary btn-block btn-hud-action btn-choice-card" data-primary="${b}" style="margin-bottom: 8px; text-align: left; padding: 8px 12px;">
            <div style="font-weight: bold; font-size: 13px;">${label(branchTitle)}</div>
            ${label(branchDesc ? `<div style="font-size: 11px; opacity: 0.85; margin-top: 2px;">${label(branchDesc)}</div>` : "")}
          </button>
        `;
      });

      if (allowEarlyStop) {
        buttonsHtml += `<button class="btn btn-warning btn-block btn-hud-action" data-flags="128" data-primary="0" style="margin-top: 8px;">${t("✓ Confirm / Pass")}</button>`;
      }
    } else if (dType === DT.NONE) {
      promptText = t("Simulation idle or transitioning.");
    } else {
      promptText = t("Waiting for decision...");
    }

    let dieSelectorHtml = "";
    if (showDieSelector) {
      dieSelectorHtml = `
        <div class="die-roll-selector-container">
          <div class="die-roll-header">
            <span>${t("🎲 Die Roll Input:")}</span>
            <span class="die-selected-text">${label(this.selectedDieRoll === 0 ? t("Auto Roll (PRNG)") : t("Manual: ") + this.selectedDieRoll)}</span>
          </div>
          <div class="die-buttons-row">
            <button class="btn-die-opt ${this.selectedDieRoll === 0 ? "active" : ""}" data-roll="0">${t("🎲 Auto")}</button>
            <button class="btn-die-opt ${this.selectedDieRoll === 1 ? "active" : ""}" data-roll="1">⚀ 1</button>
            <button class="btn-die-opt ${this.selectedDieRoll === 2 ? "active" : ""}" data-roll="2">⚁ 2</button>
            <button class="btn-die-opt ${this.selectedDieRoll === 3 ? "active" : ""}" data-roll="3">⚂ 3</button>
            <button class="btn-die-opt ${this.selectedDieRoll === 4 ? "active" : ""}" data-roll="4">⚃ 4</button>
            <button class="btn-die-opt ${this.selectedDieRoll === 5 ? "active" : ""}" data-roll="5">⚄ 5</button>
            <button class="btn-die-opt ${this.selectedDieRoll === 6 ? "active" : ""}" data-roll="6">⚅ 6</button>
          </div>
        </div>
      `;
    }

    this.container.innerHTML = `
      <div class="decision-prompt" style="font-size: 13px; line-height: 1.4; margin-bottom: 10px;">${label(promptText)}</div>
      ${label(dieSelectorHtml)}
      <div class="decision-actions">${label(buttonsHtml)}</div>
    `;

    // Attach click listeners to die buttons
    const dieButtons = this.container.querySelectorAll(".btn-die-opt");
    dieButtons.forEach(btn => {
      btn.addEventListener("click", (e) => {
        const roll = parseInt((e.currentTarget as HTMLElement).getAttribute("data-roll") || "0", 10);
        this.selectedDieRoll = roll;
        this.render(state);
        // The re-render dropped any probability badges painted on the buttons.
        this.onRerender?.();
      });
    });

    // Attach click listeners to action buttons
    const buttons = this.container.querySelectorAll(".btn-hud-action");
    buttons.forEach(btn => {
      btn.addEventListener("click", (e) => {
        const target = e.currentTarget as HTMLElement;
        const primary = parseInt(target.getAttribute("data-primary") || "0", 10);
        const secondary = parseInt(target.getAttribute("data-secondary") || this.selectedDieRoll.toString(), 10);
        const flags = parseInt(target.getAttribute("data-flags") || "0", 10);

        this.onAction({
          decision_type: dType,
          primary_id: primary,
          secondary_id: secondary,
          flags: flags
        });
      });
    });
  }
}
