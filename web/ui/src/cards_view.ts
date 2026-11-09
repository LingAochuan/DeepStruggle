import { t, label, setModalRenderer, onLocaleChange } from "./i18n";
import { GameState, CardMetadata } from "./types";
import { CARDS_METADATA, ENGLISH_CARDS_METADATA } from "./metadata";
import { UNSEEN } from "./game/view";
import { engineLayout } from "./engine/layout";
import { escapeHtml, num } from "./html";
import { effectIcon, flagIcon, spaceIcon } from './effects/icons';
import { cardArtwork } from './cards/art';
import { HandPreview } from './cards/hand_preview';

export interface EffectInfo {
  name: string;
  cardId?: number;
  cardName: string;
  side: "US" | "USSR" | "BOTH" | "NEUTRAL";
  duration: "PERMANENT" | "TURN" | "CONDITIONAL" | "SPACE_PERK";
  description: string;
}

export const EFFECT_INFO_MAP: Record<string, EffectInfo> = {
  NATO_ACTIVE: {
    name: "NATO Active",
    cardId: 21,
    cardName: "NATO",
    side: "US",
    duration: "PERMANENT",
    description: "USSR cannot Coup or Realign in US-controlled Western European countries."
  },
  NATO_CANCELED_FRANCE: {
    name: "NATO (France Excluded)",
    cardId: 17,
    cardName: "De Gaulle Leads France",
    side: "NEUTRAL",
    duration: "PERMANENT",
    description: "NATO no longer protects France."
  },
  NATO_CANCELED_WEST_GERMANY: {
    name: "NATO (W. Germany Excluded)",
    cardId: 55,
    cardName: "Willy Brandt",
    side: "NEUTRAL",
    duration: "CONDITIONAL",
    description: "NATO no longer protects West Germany (canceled by Tear Down This Wall)."
  },
  MARSHALL_PLAN_PLAYED: {
    name: "Marshall Plan Played",
    cardId: 23,
    cardName: "Marshall Plan",
    side: "US",
    duration: "PERMANENT",
    description: "Prerequisite fulfilled for US to activate NATO."
  },
  WARSAW_PACT_PLAYED: {
    name: "Warsaw Pact Played",
    cardId: 16,
    cardName: "Warsaw Pact Formed",
    side: "USSR",
    duration: "PERMANENT",
    description: "Prerequisite fulfilled for US to activate NATO."
  },
  US_JAPAN_PACT_ACTIVE: {
    name: "US/Japan Defense Pact",
    cardId: 27,
    cardName: "US/Japan Mutual Defense Pact",
    side: "US",
    duration: "PERMANENT",
    description: "USSR cannot Coup or Realign in Japan. Japan is US-controlled."
  },
  CONTAINMENT_ACTIVE: {
    name: "Containment Active",
    cardId: 25,
    cardName: "Containment",
    side: "US",
    duration: "TURN",
    description: "All US Operations receive +1 Op (capped at 4 Ops)."
  },
  PURGE_US_ACTIVE: {
    name: "Red Scare (US)",
    cardId: 31,
    cardName: "Red Scare/Purge",
    side: "US",
    duration: "TURN",
    description: "All US Operations receive -1 Op (minimum 1 Op)."
  },
  PURGE_USSR_ACTIVE: {
    name: "Red Scare (USSR)",
    cardId: 31,
    cardName: "Red Scare/Purge",
    side: "USSR",
    duration: "TURN",
    description: "All USSR Operations receive -1 Op (minimum 1 Op)."
  },
  VIETNAM_REVOLTS_ACTIVE: {
    name: "Vietnam Revolts",
    cardId: 9,
    cardName: "Vietnam Revolts",
    side: "USSR",
    duration: "TURN",
    description: "All USSR Operations in Southeast Asia receive +1 Op for remainder of turn."
  },
  FORMOSAN_RESOLUTION_ACTIVE: {
    name: "Formosan Resolution",
    cardId: 35,
    cardName: "Formosan Resolution",
    side: "US",
    duration: "CONDITIONAL",
    description: "Taiwan counts as a Battleground country for Asia Scoring until China Card played."
  },
  CMC_ACTIVE_US: {
    name: "Cuban Missile Crisis (played by US)",
    cardId: 40,
    cardName: "Cuban Missile Crisis",
    side: "US",
    duration: "TURN",
    description: "A USSR Coup loses the game this turn, unless the USSR cancels the crisis by removing 2 influence from Cuba."
  },
  CMC_ACTIVE_USSR: {
    name: "Cuban Missile Crisis (played by USSR)",
    cardId: 40,
    cardName: "Cuban Missile Crisis",
    side: "USSR",
    duration: "TURN",
    description: "A US Coup loses the game this turn, unless the US cancels the crisis by removing 2 influence from West Germany or Turkey."
  },
  NUCLEAR_SUBS_ACTIVE: {
    name: "Nuclear Subs Active",
    cardId: 41,
    cardName: "Nuclear Subs",
    side: "US",
    duration: "TURN",
    description: "US Coup Attempts in battleground countries do not degrade DEFCON this turn."
  },
  QUAGMIRE_ACTIVE: {
    name: "Quagmire Active",
    cardId: 42,
    cardName: "Quagmire",
    side: "US",
    duration: "CONDITIONAL",
    description: "US must discard a 2+ Ops card and roll 5-6 on each Action Round to exit."
  },
  BEAR_TRAP_ACTIVE: {
    name: "Bear Trap Active",
    cardId: 44,
    cardName: "Bear Trap",
    side: "USSR",
    duration: "CONDITIONAL",
    description: "USSR must discard a 2+ Ops card and roll 5-6 on each Action Round to exit."
  },
  SALT_ACTIVE: {
    name: "SALT Negotiations",
    cardId: 43,
    cardName: "SALT Negotiations",
    side: "BOTH",
    duration: "TURN",
    description: "All Coup Attempts by both players suffer -1 to die rolls for remainder of turn."
  },
  WE_WILL_BURY_YOU_PENDING: {
    name: "We Will Bury You (Pending)",
    cardId: 50,
    cardName: "We Will Bury You",
    side: "USSR",
    duration: "TURN",
    description: "USSR gains 3 VP at Turn End unless UN Intervention is played by US."
  },
  BREZHNEV_DOCTRINE_ACTIVE: {
    name: "Brezhnev Doctrine",
    cardId: 51,
    cardName: "Brezhnev Doctrine",
    side: "USSR",
    duration: "TURN",
    description: "All USSR Operations receive +1 Op (capped at 4 Ops)."
  },
  FLOWER_POWER_ACTIVE: {
    name: "Flower Power Active",
    cardId: 59,
    cardName: "Flower Power",
    side: "USSR",
    duration: "CONDITIONAL",
    description: "USSR gains 2 VP for each US War card played for Operations (canceled by An Evil Empire)."
  },
  U2_INCIDENT_ACTIVE: {
    name: "U-2 Incident",
    cardId: 60,
    cardName: "U-2 Incident",
    side: "USSR",
    duration: "TURN",
    description: "USSR gains 1 VP immediately; +1 additional VP if UN Intervention played this turn."
  },
  SHUTTLE_DIPLOMACY_ACTIVE: {
    name: "Shuttle Diplomacy",
    cardId: 73,
    cardName: "Shuttle Diplomacy",
    side: "US",
    duration: "CONDITIONAL",
    description: "Subtracts 1 USSR Battleground from next Asia or Middle East Scoring."
  },
  DEATH_SQUADS_US: {
    name: "Death Squads (US)",
    cardId: 69,
    cardName: "Latin American Death Squads",
    side: "US",
    duration: "TURN",
    description: "US receives +1 to all Realignment rolls in Central and South America this turn."
  },
  DEATH_SQUADS_USSR: {
    name: "Death Squads (USSR)",
    cardId: 69,
    cardName: "Latin American Death Squads",
    side: "USSR",
    duration: "TURN",
    description: "USSR receives +1 to all Realignment rolls in Central and South America this turn."
  },
  CAMP_DAVID_PLAYED: {
    name: "Camp David Accords",
    cardId: 65,
    cardName: "Camp David Accords",
    side: "US",
    duration: "PERMANENT",
    description: "Prevents Arab-Israeli War from being played as an Event."
  },
  IRON_LADY_PLAYED: {
    name: "The Iron Lady", cardId: 83, cardName: "The Iron Lady", side: "US", duration: "PERMANENT",
    description: "Prevents #7 Socialist Governments from being played as an Event."
  },
  NORTH_SEA_OIL_PLAYED: {
    name: "North Sea Oil", cardId: 86, cardName: "North Sea Oil", side: "US", duration: "PERMANENT",
    description: "Prevents #61 OPEC from being played as an Event."
  },
  NORTH_SEA_OIL_ACTIVE: {
    name: "North Sea Oil",
    cardId: 86,
    cardName: "North Sea Oil",
    side: "US",
    duration: "TURN",
    description: "Grants US an 8th Action Round for the current turn only."
  },
  THE_REFORMER_PLAYED: {
    name: "The Reformer",
    cardId: 87,
    cardName: "The Reformer",
    side: "US",
    duration: "PERMANENT",
    description: "USSR can no longer Coup in Europe. Enables #90 Glasnost to be used for Operations."
  },
  IRAN_CONTRA_ACTIVE: {
    name: "Iran-Contra Scandal",
    cardId: 93,
    cardName: "Iran-Contra Scandal",
    side: "USSR",
    duration: "TURN",
    description: "All US Realignment rolls receive -1 to their die roll for remainder of turn."
  },
  EVIL_EMPIRE_PLAYED: {
    name: "An Evil Empire",
    cardId: 97,
    cardName: "“An Evil Empire”",
    side: "US",
    duration: "PERMANENT",
    description: "Cancels and prevents the effects of #59 Flower Power."
  },
  ALDRICH_AMES_ACTIVE: {
    name: "Aldrich Ames Remix",
    cardId: 98,
    cardName: "Aldrich Ames Remix",
    side: "USSR",
    duration: "TURN",
    description: "US hand of cards remains revealed face-up to USSR for remainder of turn."
  },
  JOHN_PAUL_II_PLAYED: {
    name: "John Paul II Elected Pope",
    cardId: 68,
    cardName: "John Paul II Elected Pope",
    side: "US",
    duration: "PERMANENT",
    description: "Prerequisite fulfilled enabling #101 Solidarity to be played as an Event."
  },
  NORAD_ACTIVE: {
    name: "NORAD Active",
    cardId: 106,
    cardName: "NORAD",
    side: "US",
    duration: "CONDITIONAL",
    description: "When Canada is US-controlled, US adds 1 Influence whenever DEFCON reaches 2 in an AR."
  },
  YURI_AND_SAMANTHA_ACTIVE: {
    name: "Yuri and Samantha",
    cardId: 109,
    cardName: "Yuri and Samantha",
    side: "USSR",
    duration: "TURN",
    description: "USSR gains 1 VP for each US Coup Attempt performed during remainder of turn."
  },
  AWACS_PLAYED: {
    name: "AWACS Sale to Saudis",
    cardId: 110,
    cardName: "AWACS Sale to Saudis",
    side: "US",
    duration: "PERMANENT",
    description: "Prevents #56 Muslim Revolution from being played as an Event."
  },
  // The engine's own name for the bit (bindings/state_json.cpp), shortened there: keyed as
  // `..._PLAYED` this entry never matched and the panel showed the raw flag instead.
  IRANIAN_HOSTAGE_CRISIS_PLAY: {
    name: "Iranian Hostage Crisis",
    cardId: 82,
    cardName: "Iranian Hostage Crisis",
    side: "USSR",
    duration: "PERMANENT",
    description: "Forces US to randomly discard 2 cards instead of 1 when #92 Terrorism is played."
  },
  WILLY_BRANDT_PLAYED: {
    name: "Willy Brandt Played",
    cardId: 55,
    cardName: "Willy Brandt",
    side: "USSR",
    duration: "CONDITIONAL",
    description: "Cancels NATO for West Germany (canceled by Tear Down This Wall)."
  },
  TEAR_DOWN_THIS_WALL_PLAYED: {
    name: "Tear Down this Wall",
    cardId: 96,
    cardName: "Tear Down this Wall",
    side: "US",
    duration: "PERMANENT",
    description: "Cancels and prevents the effects of #55 Willy Brandt."
  },
  CHERNOBYL_ACTIVE: {
    name: "Chernobyl Active",
    cardId: 94,
    cardName: "Chernobyl",
    side: "US",
    duration: "TURN",
    description: "USSR cannot add Influence using Operations points in the forbidden region this turn."
  }
};

const PILE_SIDE_ORDER: Record<CardMetadata["side"], number> = { ussr: 0, us: 1, neutral: 2 };

/** A pile's order: by side (USSR, US, Neutral), then highest Ops first, then by name. */
export function sortPile(metas: CardMetadata[]): CardMetadata[] {
  return [...metas].sort((a, b) =>
    PILE_SIDE_ORDER[a.side] - PILE_SIDE_ORDER[b.side] || b.ops - a.ops || a.name.localeCompare(b.name));
}

export class CardsView {
  private cardsMeta: Map<number, CardMetadata> = new Map();
  private onCardClick: (cardId: number) => void;
  private tooltipEl: HTMLElement;
  private readonly handPreview: HandPreview;
  private locationFilter: string = "ALL";
  private searchFilter: string = "";
  private lastState: GameState | null = null;
  private selectedPile: 'hand' | 'ussr-hand' | 'discard' | 'removed' = 'hand';
  public onRerender?: () => void;

  constructor(onCardClick: (cardId: number) => void) {
    this.onCardClick = onCardClick;
    this.tooltipEl = document.getElementById("card-tooltip")!;
    this.handPreview = new HandPreview(() => this.tooltipEl.classList.add('hidden'));
    onLocaleChange(() => this.hideTooltip());
    window.addEventListener('resize', () => this.hideTooltip());
    window.addEventListener('scroll', () => this.tooltipEl.classList.add('hidden'), true);
    this.fetchMetadata();
    this.setupTabs();
    this.setupFilters();
  }

  public setCardsMetadata(data: any) {
    const cards: CardMetadata[] = Array.isArray(data) ? data : (data.cards || []);
    cards.forEach((c: CardMetadata) => {
      this.cardsMeta.set(c.id, c);
    });
    if (this.lastState) {
      this.render(this.lastState);
    }
  }

  public fetchMetadata() {
    // Bundled from rules/cards.json (metadata.ts).
    this.setCardsMetadata(CARDS_METADATA);
  }

  private setupTabs() {
    const pileTabs = [...document.querySelectorAll<HTMLButtonElement>('[data-card-pile]')];
    pileTabs.forEach(button => {
      button.addEventListener('click', () => {
        if (button.hidden) return;
        const pile = button.dataset.cardPile;
        if (pile !== 'hand' && pile !== 'ussr-hand' && pile !== 'discard' && pile !== 'removed') return;
        this.selectedPile = pile;
        if (this.lastState) this.renderTextChoices(this.lastState);
        this.onRerender?.();
        document.getElementById('text-card-picker-list')!.scrollTop = 0;
      });
      button.addEventListener('keydown', e => {
        const visibleTabs = pileTabs.filter(tab => !tab.hidden);
        const index = visibleTabs.indexOf(button);
        const next = e.key === 'ArrowRight' ? (index + 1) % visibleTabs.length
          : e.key === 'ArrowLeft' ? (index + visibleTabs.length - 1) % visibleTabs.length
          : e.key === 'Home' ? 0 : e.key === 'End' ? visibleTabs.length - 1 : -1;
        if (next < 0) return;
        e.preventDefault(); visibleTabs[next].click(); visibleTabs[next].focus();
      });
    });
    const tabButtons = document.querySelectorAll(".tabs .tab-btn");
    tabButtons.forEach(btn => {
      btn.addEventListener("click", (e) => {
        const targetTab = (e.currentTarget as HTMLElement).getAttribute("data-tab");
        tabButtons.forEach(b => b.classList.remove("active"));
        document.querySelectorAll(".tab-content").forEach(tc => tc.classList.remove("active"));

        (e.currentTarget as HTMLElement).classList.add("active");
        if (targetTab) {
          document.getElementById(targetTab)?.classList.add("active");
        }
      });
    });
  }

  private setupFilters() {
    const searchInput = document.getElementById("all-cards-search") as HTMLInputElement;
    const filterSelect = document.getElementById("all-cards-filter") as HTMLSelectElement;

    searchInput?.addEventListener("input", (e) => {
      this.searchFilter = (e.target as HTMLInputElement).value.trim().toLowerCase();
      const state = (window as any).__CURRENT_STATE__;
      if (state) this.renderAllCardsList(state);
    });

    filterSelect?.addEventListener("change", (e) => {
      this.locationFilter = (e.target as HTMLSelectElement).value;
      const state = (window as any).__CURRENT_STATE__;
      if (state) this.renderAllCardsList(state);
    });
  }

  public render(state: GameState) {
    this.lastState = state;
    (window as any).__CURRENT_STATE__ = state;

    // Render Hand Counts in Tab Titles. A player's view withholds the other hand's unseen cards
    // (game/view.ts) but not how many there are: hand sizes are public.
    const hidden = state.hidden_cards || { US: 0, USSR: 0 };
    const ussrCount = (state.hands?.USSR || []).length + hidden.USSR;
    const usCount = (state.hands?.US || []).length + hidden.US;
    const discardCount = (state.discard_pile || []).length;
    const removedCount = (state.removed_pile || []).length;

    const china = state.china_card || { holder: "USSR", playable: true };
    const ussrCountEl = document.getElementById("ussr-hand-count");
    if (ussrCountEl) {
      ussrCountEl.textContent = label(china.holder === "USSR" ? `${ussrCount} + ${t("The China Card")}` : ussrCount.toString());
    }

    const usCountEl = document.getElementById("us-hand-count");
    if (usCountEl) {
      usCountEl.textContent = label(china.holder === "US" ? `${usCount} + ${t("The China Card")}` : usCount.toString());
    }

    const discardCountEl = document.getElementById("discard-count");
    if (discardCountEl) discardCountEl.textContent = label(discardCount.toString());

    const removedCountEl = document.getElementById("removed-count");
    if (removedCountEl) removedCountEl.textContent = label(removedCount.toString());

    // In a player's view the draw deck and the other side's unseen cards are one pile.
    const opp = this.opponent(state);
    const drawCountEl = document.getElementById("draw-count");
    if (drawCountEl) drawCountEl.textContent = label((opp ? state.unseen_count ?? 0 : state.draw_deck_count || 0).toString());
    const drawNameEl = document.getElementById("draw-count-name");
    if (drawNameEl) drawNameEl.textContent = label(opp ? t("Draw Deck + {0} hand (unseen)", [opp]) : t("Draw Deck"));
    const deckOption = document.querySelector<HTMLOptionElement>('#all-cards-filter option[value="DRAW_DECK"]');
    if (deckOption) deckOption.textContent = label(opp ? t("Draw Deck or {0} hand", [opp]) : t("Draw Deck"));

    // Render Hand Lists
    this.renderHand("tab-ussr-hand", state.hands?.USSR || [], "USSR", state);
    this.renderHand("tab-us-hand", state.hands?.US || [], "US", state);

    // Render China Card Box
    this.renderChinaCard(state);

    // The piles, drawn as the hands are
    this.renderPile("discard-cards-list", state.discard_pile || []);
    this.renderPile("removed-cards-list", state.removed_pile || []);

    // Render All Cards Explorer List
    this.renderAllCardsList(state);

    // Render Active Effects and Context Stack
    this.renderTextChoices(state);
    this.renderFlags(state);
    this.renderTurnEffects(state);
    this.renderContextStack(state);
  }

  private renderHand(containerId: string, cardIds: number[], player: "US" | "USSR", state: GameState) {
    const tabEl = document.getElementById(containerId);
    if (!tabEl) return;
    const container = tabEl.querySelector(".card-list");
    if (!container) return;

    container.innerHTML = "";

    const china = state.china_card || { holder: "USSR", playable: true };
    const holdsChina = china.holder === player;
    const isCurrentDecision = state.decision_context?.decision_player === player && state.decision_context?.decision_type === engineLayout()?.decision_types.SELECT_CARD;
    const legalCards = new Set(state.legal_actions?.valid_ids || []);

    // 1. Render China Card at top of hand if held by this player (Single-line)
    if (holdsChina) {
      const isChinaLegal = isCurrentDecision && (legalCards.has(6) || legalCards.size === 0) && china.playable;
      const chinaEl = document.createElement("div");
      chinaEl.className = `china-hand-card ${china.playable ? "face-up" : "face-down"} ${isChinaLegal ? "playable" : ""}`;

      const meta = this.cardsMeta.get(6) || {
        id: 6,
        name: t("The China Card"),
        ops: 4,
        side: "neutral",
        age: "early war",
        description: t("May be played as a normal 4 Ops card. If all Ops are spent in Asia, receive +1 Op (5 Ops total). Pass to opponent face down when played."),
        one_time: false
      };

      chinaEl.innerHTML = `
        <div class="card-item-era-bar era-early" style="background: #F59E0B;"></div>
        <div class="card-ops-badge neutral">4</div>
        <div class="card-name-single">
          ${t("#6 The China Card")}
        </div>
        <span class="china-status-pill ${china.playable ? "playable" : "face-down"}">
          ${label(china.playable ? t("Face Up") : t("Face Down"))}
        </span>
      `;

      chinaEl.addEventListener("mouseenter", (e) => this.showTooltip(e, meta));
      chinaEl.addEventListener("mouseleave", () => this.hideTooltip());
      if (isChinaLegal) {
        chinaEl.addEventListener("click", () => {
          this.onCardClick(6);
        });
      }

      container.appendChild(chinaEl);
    }

    const hiddenCount = state.hidden_cards?.[player] ?? 0;
    if (cardIds.length === 0 && !holdsChina && hiddenCount === 0) {
      container.innerHTML = `<div style="color: var(--text-dim); text-align: center; padding: 20px; font-size: 11px;">${t("Hand is empty")}</div>`;
      return;
    }

    cardIds.forEach(id => {
      const meta = this.metaOf(id);
      const isLegal = isCurrentDecision && legalCards.has(id);
      const cardEl = this.cardItem(meta, isLegal ? "playable" : "");
      // The replay trace paints this card's probability onto it; that needs the id on the node.
      cardEl.setAttribute("data-card-id", id.toString());
      cardEl.addEventListener("click", () => {
        if (isLegal || legalCards.size === 0) {
          this.onCardClick(id);
        }
      });

      container.appendChild(cardEl);
    });

    // A player's view: the other side's cards it has not seen, face down.
    for (let i = 0; i < hiddenCount; i++) {
      const el = document.createElement("div");
      el.className = "card-item card-hidden";
      el.title = label(t("A card this side has not seen"));
      el.innerHTML = `
        <div class="card-item-era-bar"></div>
        <div class="card-ops-badge neutral">?</div>
        <div class="card-name-single">${t("Face-down card")}</div>
      `;
      container.appendChild(el);
    }
  }

  /** A card's metadata, or a stand-in for an id the rules do not list. */
  private metaOf(id: number): CardMetadata {
    return this.cardsMeta.get(id) || {
      id: num(id),
      name: t("Card #{0}", [num(id)]),
      ops: 0,
      side: "neutral",
      age: "early war",
      description: "",
      one_time: false
    };
  }

  /** A card's line as the hand tabs draw it -- era bar, Ops in the side's colour, number and name --
   *  with its text on hover. */
  private cardItem(meta: CardMetadata, extraClass = ""): HTMLElement {
    const cardEl = document.createElement("div");
    cardEl.className = `card-item ${meta.side} ${extraClass}`;
    const eraClass = meta.age === "early war" ? "era-early" : (meta.age === "mid war" ? "era-mid" : "era-late");
    cardEl.innerHTML = `
      <div class="card-item-era-bar ${eraClass}"></div>
      <div class="card-ops-badge ${meta.side}">
        ${`${meta.ops}${meta.one_time ? `<span class="card-star" title="${t("Remove after event")}">*</span>` : ''}`}
      </div>
      <div class="card-name-single">
        ${`#${meta.id} ${meta.name}`}
      </div>
    `;
    cardEl.addEventListener("mouseenter", (e) => this.showTooltip(e, meta));
    cardEl.addEventListener("mouseleave", () => this.hideTooltip());
    return cardEl;
  }

  /**
   * A pile (the discards, the removed cards) in the Piles tab: each card as the hands draw it,
   * packed, by side -- USSR, US, Neutral, as the tabs run -- then highest Ops first. No
   * `data-card-id`: the model's probabilities are painted on the hands, not on a pile.
   */
  private renderPile(containerId: string, cardIds: number[]) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = "";
    if (cardIds.length === 0) {
      container.innerHTML = `<div class="pile-empty">${t("Empty")}</div>`;
      return;
    }
    for (const meta of sortPile(cardIds.map(id => this.metaOf(id)))) {
      container.appendChild(this.cardItem(meta, "pile-card"));
    }
  }

  /** The side a player's view hides (null for the developer's view). */
  private opponent(state: GameState): "US" | "USSR" | null {
    return state.view === "US" ? "USSR" : state.view === "USSR" ? "US" : null;
  }

  private renderAllCardsList(state: GameState) {
    const container = document.getElementById("all-cards-list");
    if (!container) return;

    const locations = (state.card_locations || {}) as Record<string, string>;
    container.innerHTML = "";

    let matchedCount = 0;
    for (let id = 1; id <= 110; id++) {
      const meta = this.cardsMeta.get(id) || {
        id: num(id),
        name: t("Card #{0}", [num(id)]),
        ops: 0,
        side: "neutral",
        age: "early war",
        description: "",
        one_time: false
      };

      // The engine says whether the opponent has seen a hand card (HAND_US_KNOWN / _UNKNOWN);
      // the filter and badges only care whose hand it is. Compared raw, "US Hand" and "USSR
      // Hand" never matched a single card.
      const raw = locations[id.toString()] || "DRAW_DECK";
      const loc = raw.startsWith("HAND_USSR") ? "HAND_USSR" : raw.startsWith("HAND_US") ? "HAND_US" : raw;

      // In a player's view UNSEEN (the draw deck or the other side's unseen cards) answers to
      // the draw-deck filter.
      const filterLoc = loc === UNSEEN ? "DRAW_DECK" : loc;
      if (this.locationFilter !== "ALL" && filterLoc !== this.locationFilter) {
        continue;
      }

      if (this.searchFilter) {
        const nameMatch = meta.name.toLowerCase().includes(this.searchFilter)
          || !!ENGLISH_CARDS_METADATA.find(c => c.id === meta.id)?.name.toLowerCase().includes(this.searchFilter);
        const idMatch = id.toString() === this.searchFilter;
        if (!nameMatch && !idMatch) continue;
      }

      matchedCount++;
      const itemEl = document.createElement("div");
      itemEl.className = "all-cards-item";

      const locBadgeClass = this.getLocationBadgeClass(loc === UNSEEN ? "DRAW_DECK" : loc);
      const opp = this.opponent(state);
      const locLabel = loc === UNSEEN ? t("Deck or {0} hand", [opp ?? "other"]) : this.getLocationLabel(loc);
      const eraClass = meta.age === "early war" ? "era-early" : (meta.age === "mid war" ? "era-mid" : "era-late");

      itemEl.innerHTML = `
        <div class="card-item-era-bar ${eraClass}"></div>
        <div class="all-cards-item-left">
          <div class="card-ops-badge ${meta.side}">${label(meta.ops)}</div>
          <div class="all-cards-info">
            <div class="card-name">${`#${meta.id} ${meta.name}${meta.one_time ? " *" : ""}`}</div>
          </div>
        </div>
        <div class="card-loc-badge ${locBadgeClass}">${label(locLabel)}</div>
      `;

      itemEl.addEventListener('mouseenter', e => this.showCardTooltip(e, id));
      itemEl.addEventListener('mouseleave', () => this.hideTooltip());
      itemEl.addEventListener("click", () => {
        this.hideTooltip();
        this.showPileModal(() => t("Card #{0}: {1}", [meta.id, meta.name]), [id]);
      });

      container.appendChild(itemEl);
    }

    if (matchedCount === 0) {
      container.innerHTML = `<div style="color: var(--text-dim); text-align: center; padding: 20px;">${t("No cards match your filter.")}</div>`;
    }
  }

  private getLocationBadgeClass(loc: string): string {
    switch (loc) {
      case "HAND_US": return "loc-us";
      case "HAND_USSR": return "loc-ussr";
      case "DRAW_DECK": return "loc-deck";
      case "DISCARD_PILE": return "loc-discard";
      case "REMOVED_FROM_GAME": return "loc-removed";
      case "ONGOING_EVENT": return "loc-ongoing";
      case "UNAVAILABLE": return "loc-future";
      case "PEEKED_TEMP": return "loc-ongoing";
      default: return "loc-default";
    }
  }

  private getLocationLabel(loc: string): string {
    switch (loc) {
      case "HAND_US": return t("US Hand");
      case "HAND_USSR": return t("USSR Hand");
      case "DRAW_DECK": return t("Draw Deck");
      case "DISCARD_PILE": return "Discard";
      case "REMOVED_FROM_GAME": return t("Removed");
      case "ONGOING_EVENT": return "Ongoing";
      case "UNAVAILABLE": return t("Future Era");
      case "PEEKED_TEMP": return t("Drawn (being chosen)");
      default: return escapeHtml(loc);
    }
  }

  private renderChinaCard(state: GameState) {
    const chinaContainer = document.getElementById("china-card-container");
    if (!chinaContainer) return;

    const china = state.china_card || { holder: "USSR", playable: true };
    const holder = china.holder || "USSR";
    const isPlayable = china.playable;

    chinaContainer.innerHTML = `
      <div class="china-card-box ${isPlayable ? "face-up" : "face-down"}">
        <div>
          <div style="font-weight: 800; font-size: 13px;">${t("#6 THE CHINA CARD (4 Ops)")}</div>
          <div style="font-size: 11px; opacity: 0.9;">${t("Holder:")} <strong>${label(escapeHtml(holder))}</strong> ${`(${isPlayable ? t("Face Up / Playable") : t("Face Down")})`}</div>
        </div>
        <div style="font-weight: bold; font-size: 11px; background: rgba(0,0,0,0.3); padding: 4px 8px; border-radius: 4px;">
          ${t("+1 Op in Asia")}
        </div>
      </div>
    `;
  }

  private renderFlags(state: GameState) {
    const flagsContainer = document.getElementById("active-flags-container");
    if (!flagsContainer) return;

    flagsContainer.innerHTML = "";
    const flags = state.flags || [];
    const effectCards: Array<{ key: string; icon?: string; cardId?: number; title: string; side: string; badge: string; desc: string }> = [];

    // 1. Check persistent flags
    flags.forEach(f => {
      const info = EFFECT_INFO_MAP[f];
      if (info) {
        effectCards.push({
          key: f, icon: flagIcon(f), cardId: info.cardId,
          title: info.name,
          side: info.side,
          badge: info.duration === "TURN" ? "Turn Only" : (info.duration === "PERMANENT" ? "Permanent" : "Conditional"),
          desc: info.description
        });
      } else {
        effectCards.push({
          key: f,
          title: escapeHtml(f.replace(/_ACTIVE|_PLAYED/, "")),
          side: "NEUTRAL",
          badge: "Active",
          get desc() { return t("Continuous effect for {0}", [f]); }
        });
      }
    });

    // 2. Space Race special perks
    const usSpace = state.space?.US || 0;
    const ussrSpace = state.space?.USSR || 0;

    // A space perk is held only while the opponent has not reached the same box: once
    // both sides are on it, neither side has the ability. The engine already works this
    // way (SpaceRace::has_animal_in_space and friends all require opp_track < box), so
    // testing only one's own track showed perks that were not actually in effect --
    // "US may attempt Space Race twice" with the USSR level with them, for instance.
    if (usSpace >= 2 && ussrSpace < 2) effectCards.push({ key: 'space-US-2', icon: spaceIcon(2), title: "US: Animal in Space (#2)", side: "US", badge: "Space Perk", desc: "US may attempt Space Race twice per turn." });
    if (usSpace >= 4 && ussrSpace < 4) effectCards.push({ key: 'space-US-4', icon: spaceIcon(4), title: "US: Man in Earth Orbit (#4)", side: "US", badge: "Space Perk", desc: "USSR must select & reveal headline card before US chooses." });
    if (usSpace >= 6 && ussrSpace < 6) effectCards.push({ key: 'space-US-6', icon: spaceIcon(6), title: "US: Eagle Has Landed (#6)", side: "US", badge: "Space Perk", desc: "US may discard 1 held card at end of turn." });
    if (usSpace >= 8 && ussrSpace < 8) effectCards.push({ key: 'space-US-8', icon: spaceIcon(8), title: "US: Space Station (#8)", side: "US", badge: "Space Perk", desc: "US gains an 8th Action Round each turn." });

    if (ussrSpace >= 2 && usSpace < 2) effectCards.push({ key: 'space-USSR-2', icon: spaceIcon(2), title: "USSR: Animal in Space (#2)", side: "USSR", badge: "Space Perk", desc: "USSR may attempt Space Race twice per turn." });
    if (ussrSpace >= 4 && usSpace < 4) effectCards.push({ key: 'space-USSR-4', icon: spaceIcon(4), title: "USSR: Man in Earth Orbit (#4)", side: "USSR", badge: "Space Perk", desc: "US must select & reveal headline card before USSR chooses." });
    if (ussrSpace >= 6 && usSpace < 6) effectCards.push({ key: 'space-USSR-6', icon: spaceIcon(6), title: "USSR: Bear Has Landed (#6)", side: "USSR", badge: "Space Perk", desc: "USSR may discard 1 held card at end of turn." });
    if (ussrSpace >= 8 && usSpace < 8) effectCards.push({ key: 'space-USSR-8', icon: spaceIcon(8), title: "USSR: Space Station (#8)", side: "USSR", badge: "Space Perk", desc: "USSR gains an 8th Action Round each turn." });

    if (effectCards.length === 0) {
      flagsContainer.replaceChildren();
      return;
    }

    effectCards.forEach(eff => {
      const button = document.createElement("button");
      button.className = `vtt-effect side-${eff.side.toLowerCase()}`;
      button.dataset.effect = eff.key;
      button.append(effectIcon(eff.icon));
      if (eff.cardId) {
        const cardId = eff.cardId;
        button.addEventListener('mouseenter', e => this.showCardTooltip(e, cardId));
        button.addEventListener('mouseleave', () => this.hideTooltip());
        button.addEventListener('focus', () => {
          const box = button.getBoundingClientRect();
          this.showCardTooltip(new MouseEvent('mouseover', { clientX: box.right, clientY: box.top }), cardId);
        });
        button.addEventListener('blur', () => this.hideTooltip());
      } else {
        button.title = `${label(eff.title)} · ${label(eff.badge)}\n${label(eff.desc)}`;
      }
      button.setAttribute("aria-label", label(eff.title));
      button.addEventListener("click", () => { this.hideTooltip(); this.showEffectDetails(eff); });
      flagsContainer.appendChild(button);
    });
  }

  private showEffectDetails(eff: { title: string; badge: string; desc: string }) {
    setModalRenderer(() => this.showEffectDetails(eff));
    document.getElementById("modal-title")!.textContent = label(eff.title);
    const body = document.getElementById("modal-body")!;
    body.replaceChildren();
    const duration = document.createElement("p");
    duration.className = "effect-detail-duration";
    duration.textContent = label(eff.badge);
    const description = document.createElement("p");
    description.textContent = label(eff.desc);
    body.append(duration, description);
    document.getElementById("modal-container")!.classList.remove("hidden");
  }

  /** Keep the viewed hand visible; only the current redacted card choices can be played. */
  private renderTextChoices(state: GameState) {
    const picker = document.getElementById("text-card-picker");
    const list = document.getElementById("text-card-picker-list");
    if (!picker || !list) return;
    this.handPreview.imageWidth();
    this.handPreview.hide();
    const replay = document.body.classList.contains('replay-view');
    picker.classList.toggle('vtt-replay-tabs', replay);
    if (!replay && this.selectedPile === 'ussr-hand') this.selectedPile = 'hand';
    const isHand = this.selectedPile === 'hand' || this.selectedPile === 'ussr-hand';
    picker.dataset.cardPileView = isHand ? 'hand' : this.selectedPile;
    const ctx = state.decision_context;
    const L = engineLayout();
    const selectCard = !state.is_terminal && !state.view_hidden_decision && L && ctx
      && num(ctx.decision_type) === L.decision_types.SELECT_CARD;
    const legal = new Set(selectCard ? (state.legal_actions?.valid_ids ?? []).map(Number).filter(id => id >= 1 && id <= 110) : []);
    const side = replay ? (this.selectedPile === 'ussr-hand' ? 'USSR' : 'US')
      : state.view === 'US' || state.view === 'USSR' ? state.view
      : ctx?.decision_player === 'US' || ctx?.decision_player === 'USSR' ? ctx.decision_player
      : state.phasing_player === 'US' ? 'US' : 'USSR';
    const hand = new Set((state.hands?.[side] ?? []).map(Number));
    if (state.china_card?.holder === side) hand.add(6);
    // Browse only public piles from the already-redacted state. Playing remains in the hand tab.
    const ids = isHand ? [...hand, ...(!replay ? [...legal].filter(id => !hand.has(id)) : [])]
      : [...new Set((this.selectedPile === 'discard' ? state.discard_pile : state.removed_pile) ?? [])];
    picker.classList.remove('hidden');
    list.replaceChildren();
    document.getElementById("text-card-picker-count")!.textContent = String(isHand ? hand.size : ids.length);
    const titles = { hand: t(replay || side === 'US' ? 'US hand' : 'USSR hand'), 'ussr-hand': t('USSR hand'), discard: t('Discard pile'), removed: t('Removed from Game') };
    document.querySelectorAll<HTMLButtonElement>('[data-card-pile]').forEach(button => {
      const pile = button.dataset.cardPile as keyof typeof titles;
      const active = pile === this.selectedPile;
      button.hidden = pile === 'ussr-hand' && !replay;
      button.classList.toggle('hidden', button.hidden);
      button.textContent = titles[pile];
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
      if (active) list.setAttribute('aria-labelledby', button.id);
    });
    picker.setAttribute('aria-label', titles[this.selectedPile]);
    if (isHand ? !hand.size : !ids.length) {
      const empty = document.createElement('div');
      empty.className = 'vtt-card-list-note';
      empty.textContent = t(isHand ? 'No cards in hand' : 'No cards in this pile'); list.append(empty);
    }
    let choiceHeading = false;
    for (const id of ids) {
      const meta = this.cardsMeta.get(id);
      if (!meta) continue;
      // Events may select from the discard pile or the opponent's hand. Keep these
      // legal choices accessible without presenting them as cards in our own hand.
      if (isHand && !hand.has(id) && !choiceHeading) {
        const note = document.createElement('div');
        note.className = 'vtt-card-list-note'; note.textContent = t('Choose a card'); list.append(note);
        choiceHeading = true;
      }
      list.appendChild(this.textCardButton(meta, isHand && legal.has(id) && !replay, isHand && !replay));
    }
  }

  private textCardButton(meta: CardMetadata, playable: boolean, choice: boolean): HTMLButtonElement {
    const button = document.createElement('button');
    button.className = `vtt-text-card${choice ? ' card-item' : ''} side-${meta.side.toLowerCase()}`;
    button.dataset.cardId = String(meta.id);
    if (choice) button.dataset.primary = String(meta.id);
    button.disabled = !playable;
    button.innerHTML = `<span class="vtt-card-number">#${meta.id}</span><span class="vtt-card-name">${escapeHtml(meta.name)}</span><span class="vtt-card-ops">${t('{0} Ops', [meta.ops])}</span>`;
    button.addEventListener('click', () => { if (!button.disabled) { this.hideTooltip(); this.onCardClick(meta.id); } });
    this.handPreview.bind(button, meta);
    return button;
  }

  /**
   * The effects that last for this turn only, on top of the map where they are always in view:
   * every flag whose `EFFECT_INFO_MAP` duration is TURN. The Space Race attempt flags are not in
   * the map and so never appear here; permanent and conditional effects stay in the side panel.
   */
  private renderTurnEffects(state: GameState) {
    const strip = document.getElementById("map-turn-effects");
    if (!strip) return;
    const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
    const chips = (state.flags || [])
      .map(f => ({ flag: f, info: EFFECT_INFO_MAP[f] }))
      .filter(e => e.info && e.info.duration === "TURN")
      .map(({ flag, info }) =>
        `<span class="turn-effect side-${info.side.toLowerCase()}" data-flag="${flag}" title="${label(esc(`${info.cardName}: ${info.description}`))}">${label(esc(info.name.replace(/ Active$/, "")))}</span>`);
    strip.innerHTML = `<span class="turn-effects-label">${t("This turn")}</span>`
      + (chips.length ? chips.join("") : `<span class="turn-effects-none">${t("no effects")}</span>`);
  }

  private renderContextStack(state: GameState) {
    const stackContainer = document.getElementById("context-stack-container");
    if (!stackContainer) return;

    const ctx = state.decision_context;
    if (!ctx) return;

    stackContainer.innerHTML = `
      <div><strong>${t("Reentrancy Depth:")}</strong> ${`${num(ctx.stack_depth || 0)} / 2`}</div>
      <div><strong>${t("Decision:")}</strong> ${`${escapeHtml(label(ctx.decision_type_name || ctx.decision_type))} (${escapeHtml(label(ctx.decision_player))})`}</div>
      ${`${ctx.pending_op_card ? `<div><strong>${t("Pending Card:")}</strong> ${t("#{0} (Ops: {1})", [num(ctx.pending_op_card), num(ctx.pending_ops_value)])}</div>` : ""}
      ${ctx.resolving_card ? `<div><strong>${t("Resolving Card:")}</strong> ${t("#{0} ({1})", [num(ctx.resolving_card), escapeHtml(ctx.resolving_card_name || "")])}</div>` : ""}
      ${ctx.remaining_steps ? `<div><strong>${t("Remaining Steps:")}</strong> ${label(num(ctx.remaining_steps))}</div>` : ""}`}
    `;
  }

  private showTooltip(e: MouseEvent, meta: CardMetadata) {
    this.handPreview.hide();
    this.tooltipEl.classList.remove('hanon-card-preview', 'region-tip');
    this.tooltipEl.innerHTML = `
      <div style="font-weight: bold; font-size: 13px; color: #F8FAFC; margin-bottom: 4px;">
        ${`#${meta.id} ${meta.name}${meta.one_time ? " *" : ""}`}
      </div>
      <div style="font-size: 11px; color: var(--text-dim); margin-bottom: 8px;">
        ${t("{0} • {1} • {2} OPS", [meta.age.toUpperCase(), meta.side.toUpperCase(), meta.ops])}
      </div>
      <div style="font-size: 12px; color: #E2E8F0; line-height: 1.4;">
        ${label(meta.description)}
      </div>
    `;

    this.tooltipEl.classList.remove("hidden");
    this.positionTooltip(e);
  }

  private positionTooltip(e: MouseEvent) {
    const w = this.tooltipEl.offsetWidth, h = this.tooltipEl.offsetHeight;
    const x = Math.max(8, Math.min(window.innerWidth - w - 8,
      e.clientX + 16 + w <= window.innerWidth - 8 ? e.clientX + 16 : e.clientX - w - 16));
    const y = Math.max(8, Math.min(window.innerHeight - h - 8,
      e.clientY + 16 + h <= window.innerHeight - 8 ? e.clientY + 16 : e.clientY - h - 16));
    this.tooltipEl.style.left = `${x}px`;
    this.tooltipEl.style.top = `${y}px`;
    this.tooltipEl.style.setProperty('--card-preview-x', `${x}px`);
    this.tooltipEl.style.setProperty('--card-preview-y', `${y}px`);
  }

  /** Public references use artwork; the hand has its own fixed preview area. */
  public showCardTooltip(e: MouseEvent, cardId: number) {
    this.handPreview.hide();
    const meta = this.cardsMeta.get(cardId);
    if (!meta) { this.hideTooltip(); return; }
    const art = cardArtwork(cardId);
    if (!art) { this.showTooltip(e, meta); return; }
    const img = document.createElement('img');
    img.alt = `#${cardId} ${meta.name}`;
    img.width = art.width; img.height = art.height; img.draggable = false;
    img.addEventListener('error', () => {
      // An old asynchronous request must not replace another card or a country tooltip.
      if (this.tooltipEl.contains(img) && !this.tooltipEl.classList.contains('hidden')) this.showTooltip(e, meta);
    }, { once: true });
    this.tooltipEl.classList.remove('region-tip');
    this.tooltipEl.classList.add('hanon-card-preview');
    this.tooltipEl.style.setProperty('--card-preview-width', `${this.handPreview.imageWidth()}px`);
    this.tooltipEl.replaceChildren(img);
    this.tooltipEl.classList.remove('hidden');
    img.src = art.src;
    this.positionTooltip(e);
  }

  public hideTooltip() {
    this.handPreview.hide();
    this.tooltipEl.classList.add("hidden");
    this.tooltipEl.classList.remove('hanon-card-preview');
  }

  public showPileModal(title: string | (() => string), cardIds: number[]) {
    setModalRenderer(() => this.showPileModal(title, cardIds));
    const modal = document.getElementById("modal-container");
    const titleEl = document.getElementById("modal-title");
    const bodyEl = document.getElementById("modal-body");
    if (!modal || !titleEl || !bodyEl) return;

    titleEl.textContent = label(t("{0} ({1} cards)", [typeof title === "function" ? title() : title, cardIds.length]));
    bodyEl.innerHTML = "";

    if (cardIds.length === 0) {
      bodyEl.innerHTML = `<div style="color: var(--text-muted); text-align: center; padding: 20px;">${t("No cards in this pile")}</div>`;
    } else {
      cardIds.forEach(id => {
        const meta = this.cardsMeta.get(id);
        if (!meta) return;
        const row = document.createElement("div");
        row.style.background = "#111827";
        row.style.padding = "8px 12px";
        row.style.borderRadius = "4px";
        row.style.border = "1px solid rgba(255,255,255,0.06)";
        row.innerHTML = `
          <div style="font-weight: bold; color: #F8FAFC;">${t("#{0} {1} ({2} Ops, {3}, {4})", [meta.id, meta.name, meta.ops, meta.side.toUpperCase(), meta.age.toUpperCase()])}</div>
          <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px; line-height: 1.35;">${label(meta.description)}</div>
        `;
        bodyEl.appendChild(row);
        row.addEventListener('mouseenter', e => this.showCardTooltip(e, id));
        row.addEventListener('mouseleave', () => this.hideTooltip());
      });
    }

    modal.classList.remove("hidden");
  }
}
