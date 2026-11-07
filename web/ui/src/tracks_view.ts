import { t, label, setModalRenderer } from "./i18n";
import { GameState } from './types';
import { engineLayout } from './engine/layout';
import { escapeHtml, num } from './html';
import spaceArt from './space/steam-track.json';

export interface SpaceBoxMetadata {
  box: number;
  name: string;
  minOps: number;
  maxRoll: number;
  vpFirst: number;
  vpSecond: number;
  ability: string;
  abilityShort: string;
}

/** The boxes' names and privileges, in words; what each box asks and pays is the engine's. */
const SPACE_RACE_TEXT: Array<Pick<SpaceBoxMetadata, "name" | "ability" | "abilityShort">> = [
  { name: "Start / Launchpad", ability: "None", abilityShort: "None" },
  { name: "Earth Satellite", ability: "None", abilityShort: "None" },
  { name: "Animal in Space", ability: "May attempt Space Race twice per turn", abilityShort: "2 Attempts / Turn" },
  { name: "Man in Space", ability: "None", abilityShort: "None" },
  { name: "Man in Earth Orbit", ability: "Opponent must select & reveal headline first", abilityShort: "Opponent Reveals Headline 1st" },
  { name: "Lunar Orbit", ability: "None", abilityShort: "None" },
  { name: "Eagle / Bear Has Landed", ability: "May discard 1 held card at end of turn", abilityShort: "Discard Held Card at Turn End" },
  { name: "Space Shuttle", ability: "None", abilityShort: "None" },
  { name: "Space Station", ability: "May play 8 Action Rounds per turn", abilityShort: "8th Action Round" },
];

/**
 * The track: each box's Ops, roll and VP as the engine plays them (SpaceRace::get_box_info, exported
 * as WasmEngine.layout.space_boxes), with its name and privilege. Empty until the engine has loaded.
 */
export function spaceRaceBoxes(): SpaceBoxMetadata[] {
  const boxes = engineLayout()?.space_boxes ?? [];
  return boxes.map((b, box) => ({
    box, minOps: b.min_ops, maxRoll: b.max_roll, vpFirst: b.vp_first, vpSecond: b.vp_second,
    ...(SPACE_RACE_TEXT[box] ?? { name: t("Box {0}", [box]), ability: t("None"), abilityShort: t("None") }),
  }));
}

/** A box's name, safe for any number a replay's state holds. */
function boxName(box: number): string {
  return escapeHtml(SPACE_RACE_TEXT[box]?.name ?? t("Box {0}", [box]));
}

/** What the next box asks, as the app's "NEXT PROJECT: 2 OPS: Roll 1-3": a card of N Ops, a roll. */
function nextProject(at: number): string {
  const boxes = spaceRaceBoxes();
  if (!boxes.length) return "";
  const next = boxes[at + 1];
  if (!next) return `<span class="pill-next" title="${t("The last box, the Space Station: the space race is over")}">${t("done")}</span>`;
  return `<span class="pill-next" title="${t("Box {0}, {1}: a card of {2}+ Ops, then a roll of 1-{3}", [next.box, next.name, next.minOps, next.maxRoll])}">`
    + `${t("next {0} Ops · 1–{1}", [next.minOps, next.maxRoll])}</span>`;
}

export class TracksView {
  private container: HTMLElement;
  private currentState: GameState | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  /** Board markers own the visible tracks; retain the rules dialog's latest snapshot. */
  public updateState(state: GameState) {
    this.currentState = state;
  }

  public render(state: GameState) {
    this.currentState = state;
    // Numbers and names, as a replay snapshot may hold anything.
    const vp = num(state.victory_points);
    const defcon = num(state.defcon);
    const turn = num(state.turn);
    const ar = num(state.action_round);
    const phase = num(state.current_phase);
    const phasing = escapeHtml(state.phasing_player);

    const usMilOps = num(state.mil_ops?.US ?? 0);
    const ussrMilOps = num(state.mil_ops?.USSR ?? 0);
    const usSpace = num(state.space?.US ?? 0);
    const ussrSpace = num(state.space?.USSR ?? 0);

    const usTurnsUsed = num(state.space_turns_used?.US ?? 0);
    const ussrTurnsUsed = num(state.space_turns_used?.USSR ?? 0);
    const maxUsAttempts = (usSpace >= 2 && ussrSpace < 2) ? 2 : 1;
    const maxUssrAttempts = (ussrSpace >= 2 && usSpace < 2) ? 2 : 1;

    // Needle pos in percentage: -20 (USSR) is 0%, 0 is 50%, +20 (US) is 100%
    const needlePercent = Math.max(0, Math.min(100, ((vp + 20) / 40) * 100));

    let vpLabel = t("TIE 0");
    let vpClass = 'tie';
    if (vp > 0) {
      vpLabel = t("US +{0}", [vp]);
      vpClass = 'us';
    } else if (vp < 0) {
      vpLabel = t("USSR +{0}", [Math.abs(vp)]);
      vpClass = 'ussr';
    }

    const eraName = turn <= 3 ? 'EARLY WAR' : (turn <= 7 ? 'MID WAR' : 'LATE WAR');

    this.container.innerHTML = `
      <!-- DEFCON Track -->
      <div class="track-group">
        <span class="track-label">${t("DEFCON")}</span>
        <div class="defcon-scale">
          ${label([5, 4, 3, 2, 1].map(lvl => `
            <div class="defcon-box ${defcon === lvl ? 'active' : ''}" data-level="${lvl}">
              ${label(lvl)}
            </div>
          `).join(''))}
        </div>
      </div>

      <!-- Victory Points Meter -->
      <div class="track-group">
        <span class="track-label">${t("VICTORY POINTS")}</span>
        <div class="vp-meter-container">
          <div class="vp-bar">
            <div class="vp-fill-ussr" style="width: ${needlePercent}%;"></div>
            <div class="vp-center-line"></div>
            <div class="vp-needle" style="left: ${needlePercent}%;"></div>
          </div>
          <span class="vp-val-badge ${vpClass}">${label(vpLabel)}</span>
        </div>
      </div>

      <!-- Turn & Era -->
      <div class="track-group">
        <span class="track-label">${t("TURN & ERA")}</span>
        <div class="turn-ar-badge">
          <strong>${t("T{0}/10", [turn])}</strong>
          <span style="color: var(--text-dim);">•</span>
          <span>${label(eraName)}</span>
        </div>
      </div>

      <!-- Action Round -->
      <div class="track-group">
        <span class="track-label">${t("ACTION ROUND")}</span>
        <div class="turn-ar-badge">
          <strong>${label((phase === 0 || state.current_phase_name === 'SETUP') ? 'SETUP' : ((phase === 1 || state.current_phase_name === 'HEADLINE') ? 'HEADLINE' : ((phase === 3 || state.current_phase_name === 'GAME_OVER') ? 'GAME OVER' : t("AR {0}", [ar]))))}</strong>
        </div>
      </div>

      <!-- Military Ops Track -->
      <div class="track-group">
        <span class="track-label">${t("MILITARY OPS (REQ: {0})", [defcon])}</span>
        <div class="superpower-track">
          <span style="color: var(--ussr-red-light); font-weight: bold;">${t("USSR:")}</span>
          <div class="milops-pips">
            ${label([1, 2, 3, 4, 5].map(i => `<div class="pip ${i <= ussrMilOps ? 'filled-ussr' : ''}"></div>`).join(''))}
          </div>
          <span style="color: var(--text-dim); margin: 0 4px;">|</span>
          <span style="color: var(--us-blue-light); font-weight: bold;">${t("US:")}</span>
          <div class="milops-pips">
            ${label([1, 2, 3, 4, 5].map(i => `<div class="pip ${i <= usMilOps ? 'filled-us' : ''}"></div>`).join(''))}
          </div>
        </div>
      </div>

      <!-- Space Race Visual Track Widget -->
      <div class="track-group space-race-track-group">
        <span class="track-label">${t("SPACE RACE")}</span>
        <div class="space-race-header-widget" id="space-race-widget" role="button" tabindex="0" title="${t("Space Race: USSR at Box #{0}, US at Box #{1}. Click to open full Deluxe Space Track & Perks.", [ussrSpace, usSpace])}">
          <!-- USSR Pill -->
          <div class="space-pill ussr" title="${t("USSR Space: Box #{0} ({1}) | Attempts Used: {2}/{3}", [ussrSpace, boxName(ussrSpace), ussrTurnsUsed, maxUssrAttempts])}">
            <span class="pill-dot ussr"></span>
            <span class="pill-side">${t("USSR:")}</span>
            <span class="pill-box-num">${`#${ussrSpace}`}</span>
            <span class="pill-attempts">${`(${ussrTurnsUsed}/${maxUssrAttempts})`}</span>
            ${label(nextProject(ussrSpace))}
          </div>

          <!-- Mini Progress Ladder (Boxes 0 to 8) -->
          <div class="space-mini-ladder">
            ${label([0, 1, 2, 3, 4, 5, 6, 7, 8].map(step => {
              const hasUs = usSpace === step;
              const hasUssr = ussrSpace === step;
              let occ = '';
              if (hasUs && hasUssr) occ = 'both';
              else if (hasUs) occ = 'us';
              else if (hasUssr) occ = 'ussr';

              return `
                <div class="mini-box ${occ ? "active " + occ : ''}" data-step="${step}" title="${t("Box {0}: {1}", [step, boxName(step)])}">
                  <span class="mini-box-num">${label(step)}</span>
                  <div class="mini-box-tokens">
                    ${`${hasUssr ? '<div class="mini-token ussr" title="' + t('USSR at Box {0}', [step]) + `"></div>` : ''}
                    ${hasUs ? '<div class="mini-token us" title="' + t('US at Box {0}', [step]) + `"></div>` : ''}`}
                  </div>
                </div>
              `;
            }).join(''))}
          </div>

          <!-- US Pill -->
          <div class="space-pill us" title="${t("US Space: Box #{0} ({1}) | Attempts Used: {2}/{3}", [usSpace, boxName(usSpace), usTurnsUsed, maxUsAttempts])}">
            <span class="pill-dot us"></span>
            <span class="pill-side">${t("US:")}</span>
            <span class="pill-box-num">${`#${usSpace}`}</span>
            <span class="pill-attempts">${`(${usTurnsUsed}/${maxUsAttempts})`}</span>
            ${label(nextProject(usSpace))}
          </div>

          <!-- Expand Icon Button -->
          <span class="space-view-btn" title="${t("View Space Race Details")}">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
              <polyline points="15 3 21 3 21 9"></polyline>
              <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
          </span>
        </div>
      </div>
    `;

    // Hook up click & keyboard access to view detailed space race modal
    const widget = document.getElementById('space-race-widget');
    if (widget) {
      widget.addEventListener('click', () => {
        if (this.currentState) this.showSpaceRaceModal(this.currentState);
      });
      widget.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (this.currentState) this.showSpaceRaceModal(this.currentState);
        }
      });
    }

    // Update active player badge in top-right
    const activeBadge = document.getElementById('active-player-badge');
    if (activeBadge) {
      const activePlayer = state.decision_context?.decision_player || phasing || 'NONE';
      activeBadge.textContent = label(t("{0} TURN", [activePlayer]));
      activeBadge.className = `player-badge ${activePlayer.toLowerCase()}`;
    }
  }

  public showSpaceRaceModal(state: GameState) {
    setModalRenderer(() => this.showSpaceRaceModal(this.currentState ?? state));
    const modalContainer = document.getElementById('modal-container');
    const modalContent = modalContainer?.querySelector('.modal-content');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    if (!modalContainer || !modalTitle || !modalBody) return;

    modalContent?.classList.add('modal-lg');

    const positions: Record<string, number> = { US: num(state.space?.US ?? 0), USSR: num(state.space?.USSR ?? 0) };
    const text = (s: string) => escapeHtml(label(s));
    const active = (side: string, box: number) => positions[side] >= box && positions[side === 'US' ? 'USSR' : 'US'] < box;
    const art: Record<string, { name: string }> = spaceArt.stages;
    modalTitle.textContent = t("Space Race");
    modalBody.innerHTML = `
      <section class="space-track-window" aria-label="${t("Space Race")}">
        <div class="space-track-programs">${['USSR', 'US'].map(side => {
          const attempts = side === 'US' ? state.space_turns_used?.US : state.space_turns_used?.USSR;
          const maxAttempts = active(side, 2) ? 2 : 1;
          return `<div class="space-program ${side.toLowerCase()}"><strong>${text(side)}</strong>
            <span>${t("Box #{0} — {1}", [positions[side], boxName(positions[side])])}</span>
            <span class="space-attempts">${t("Attempts this turn: {0}/{1}", [num(attempts ?? 0), maxAttempts])}</span></div>`;
        }).join('')}</div>
        <div class="space-track-scroll" tabindex="0" role="region" aria-label="${t("Space Race stages; scroll horizontally")}">
          <ol class="space-track-stages">${spaceRaceBoxes().filter(b => b.box > 0 && b.box <= 8).map(box => {
            const occupants = ['USSR', 'US'].filter(side => positions[side] === box.box);
            const holder = box.ability === 'None' ? undefined : ['USSR', 'US'].find(side => active(side, box.box));
            const cancelled = box.ability !== 'None' && positions.US >= box.box && positions.USSR >= box.box;
            return `<li class="space-stage" data-box="${box.box}">
              <header><span class="space-stage-number">${String(box.box).padStart(2, '0')}</span><h3>${text(box.name)}</h3></header>
              <div class="space-stage-picture"><img src="${import.meta.env.BASE_URL}personal/space/${art[String(box.box)].name}.png" alt="${text(box.name)}" draggable="false"/><span class="space-art-fallback" hidden>${String(box.box).padStart(2, '0')}</span></div>
              <div class="space-stage-positions">${occupants.map(side => `<span class="space-position ${side.toLowerCase()}">${text(side)}</span>`).join('')}</div>
              <dl class="space-stage-values">
                <div><dt>${t("Operations required")}</dt><dd>${box.minOps}+</dd></div>
                <div><dt>${t("Advance on roll")}</dt><dd>1–${box.maxRoll}</dd></div>
                <div><dt>${t("First arrival")}</dt><dd>${t("{0} VP", [box.vpFirst])}</dd></div>
                <div><dt>${t("Second arrival")}</dt><dd>${t("{0} VP", [box.vpSecond])}</dd></div>
              </dl>
              <div class="space-stage-perk ${holder ? 'perk-held ' + holder.toLowerCase() : ''}">
                <span class="space-perk-label">${t("Privilege")}</span>
                <p>${box.ability === 'None' ? t("No special privilege") : text(box.ability)}</p>
                ${holder ? `<strong>${t("Active for {0}", [holder])}</strong>` : cancelled ? `<span>${t("Cancelled: both players reached this stage")}</span>` : ''}
              </div>
            </li>`;
          }).join('')}</ol>
        </div>
        <p class="space-track-scroll-hint">${t("Scroll horizontally to view all eight stages.")}</p>
      </section>`;
    modalBody.querySelectorAll<HTMLImageElement>('.space-stage-picture img').forEach(img => {
      img.addEventListener('error', () => { img.hidden = true; (img.nextElementSibling as HTMLElement).hidden = false; });
    });
    modalContainer.classList.remove('hidden');
  }

}
