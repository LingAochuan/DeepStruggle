import { t, label, setModalRenderer } from "./i18n";
import { GameState, MapMetadata } from "./types";
import { MAP_METADATA } from "./metadata";

export class DebugPanel {
  private onOverride: (override: any) => void;
  private mapData: MapMetadata | null = null;

  constructor(onOverride: (override: any) => void) {
    this.onOverride = onOverride;
    this.fetchMetadata();
  }

  public fetchMetadata() {
    if (this.mapData) return;
    this.mapData = MAP_METADATA;   // bundled from rules/map.json
  }

  public setMapData(data: MapMetadata) {
    this.mapData = data;
  }

  public openDebugModal(state: GameState) {
    setModalRenderer(() => this.openDebugModal(state));
    const modal = document.getElementById("modal-container");
    const titleEl = document.getElementById("modal-title");
    const bodyEl = document.getElementById("modal-body");
    if (!modal || !titleEl || !bodyEl) return;

    titleEl.textContent = label(t("Engine Debug & State Inspector"));

    const countries = this.mapData?.countries || [];

    bodyEl.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <!-- Global Track Tweaks -->
        <div style="background: #111827; padding: 12px; border-radius: 6px;">
          <h4 style="color: var(--warning); margin-bottom: 8px;">${t("Override Tracks")}</h4>
          <div style="display: flex; gap: 12px; align-items: center; margin-bottom: 8px;">
            <label>${t("DEFCON:")}
              <input type="number" id="dbg-defcon" min="1" max="5" value="${state.defcon}" style="width: 50px; background: #1E293B; color: white; border: 1px solid #475569; padding: 4px; border-radius: 4px;">
            </label>
            <button id="dbg-apply-defcon" class="btn btn-sm btn-secondary">${t("Set DEFCON")}</button>
          </div>
          <div style="display: flex; gap: 12px; align-items: center;">
            <label>${t("Victory Points (-20 to +20):")}
              <input type="number" id="dbg-vp" min="-20" max="20" value="${state.victory_points}" style="width: 60px; background: #1E293B; color: white; border: 1px solid #475569; padding: 4px; border-radius: 4px;">
            </label>
            <button id="dbg-apply-vp" class="btn btn-sm btn-secondary">${t("Set VP")}</button>
          </div>
        </div>

        <!-- Country Influence Tweaks -->
        <div style="background: #111827; padding: 12px; border-radius: 6px;">
          <h4 style="color: var(--warning); margin-bottom: 8px;">${t("Set Country Influence")}</h4>
          <div style="display: flex; gap: 8px; margin-bottom: 8px; flex-wrap: wrap;">
            <select id="dbg-country-select" style="flex: 1; min-width: 140px; background: #1E293B; color: white; border: 1px solid #475569; padding: 4px; border-radius: 4px;">
              ${label(countries.map(c => `<option value="${c.id}">${`${label(c.name)} (#${c.id})`}</option>`).join(""))}
            </select>
            <label>${t("US:")} <input type="number" id="dbg-us-inf" min="0" max="99" value="0" style="width: 45px; background: #1E293B; color: white; border: 1px solid #475569; padding: 4px; border-radius: 4px;"></label>
            <label>${t("USSR:")} <input type="number" id="dbg-ussr-inf" min="0" max="99" value="0" style="width: 45px; background: #1E293B; color: white; border: 1px solid #475569; padding: 4px; border-radius: 4px;"></label>
            <button id="dbg-apply-country" class="btn btn-sm btn-primary">${t("Apply")}</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById("dbg-apply-defcon")?.addEventListener("click", () => {
      const defcon = parseInt((document.getElementById("dbg-defcon") as HTMLInputElement).value, 10);
      this.onOverride({ op: "set_defcon", defcon });
      modal.classList.add("hidden");
    });

    document.getElementById("dbg-apply-vp")?.addEventListener("click", () => {
      const vp = parseInt((document.getElementById("dbg-vp") as HTMLInputElement).value, 10);
      this.onOverride({ op: "set_vp", vp });
      modal.classList.add("hidden");
    });

    document.getElementById("dbg-apply-country")?.addEventListener("click", () => {
      const cid = parseInt((document.getElementById("dbg-country-select") as HTMLSelectElement).value, 10);
      const us = parseInt((document.getElementById("dbg-us-inf") as HTMLInputElement).value, 10);
      const ussr = parseInt((document.getElementById("dbg-ussr-inf") as HTMLInputElement).value, 10);
      this.onOverride({ op: "set_country", country_id: cid, us, ussr });
      modal.classList.add("hidden");
    });

    modal.classList.remove("hidden");
  }
}
