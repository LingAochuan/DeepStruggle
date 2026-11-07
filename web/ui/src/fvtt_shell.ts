import { onLocaleChange, t } from "./i18n";
import { escapeHtml } from "./html";

type DockTab = "log" | "analysis" | "model" | "settings";
const TITLES: Record<DockTab, string> = {
  log: "Action log", analysis: "Model analysis", model: "Configure model", settings: "Settings",
};

/** The tabletop's chrome owns only layout; game and model state stay in TSApp. */
export class TabletopShell {
  private selected: DockTab = "log";
  private expanded = false;
  private loadedLeaderboard = false;
  private leaderboard: Array<{ player: string; elo: number; games: number }> | null = null;
  private leaderboardError = false;

  constructor() {
    document.getElementById("btn-model-choose")!.dataset.dockTab = "model";
    document.querySelectorAll<HTMLButtonElement>("[data-dock-tab]").forEach(button => {
      // TSApp owns the model button, because it also restores the shared model controls.
      if (button.dataset.dockTab === "model") return;
      button.addEventListener("click", () => this.toggleTab(button.dataset.dockTab as DockTab));
    });
    for (const id of ['text-card-picker', 'decision-panel']) {
      const panel = document.getElementById(id)!;
      const button = panel.querySelector<HTMLButtonElement>('[data-collapse-panel]')!;
      const update = () => {
        const collapsed = panel.classList.contains('vtt-minimized');
        button.textContent = collapsed ? '+' : '‹';
        button.setAttribute('aria-expanded', String(!collapsed));
        button.title = t(collapsed ? 'Expand panel' : 'Collapse panel');
        button.setAttribute('aria-label', button.title);
      };
      button.addEventListener('click', () => { panel.classList.toggle('vtt-minimized'); update(); });
      panel.addEventListener('click', event => {
        if (panel.classList.contains('vtt-minimized') && !button.contains(event.target as Node)) {
          panel.classList.remove('vtt-minimized'); update();
        }
      });
      onLocaleChange(update);
      update();
    }
    onLocaleChange(() => { this.render(); this.renderLeaderboard(); });
    this.render();
  }

  get isOpen(): boolean { return this.expanded; }
  get modelOpen(): boolean { return this.expanded && this.selected === "model"; }

  toggleTab(tab: DockTab): void {
    if (this.selected === tab && this.expanded) this.close();
    else this.open(tab);
  }

  open(tab: DockTab): void {
    this.selected = tab;
    this.expanded = true;
    this.render();
    if (tab === "model") void this.loadLeaderboard();
  }

  close(): void {
    this.expanded = false;
    this.render();
  }

  private render(): void {
    const dock = document.getElementById("vtt-dock")!;
    dock.hidden = !this.expanded;
    document.body.classList.toggle("vtt-dock-open", this.expanded);
    document.getElementById("vtt-dock-title")!.textContent = t(TITLES[this.selected]);
    document.querySelectorAll<HTMLElement>("[data-dock-page]").forEach(page => {
      page.hidden = page.dataset.dockPage !== this.selected;
    });
    document.querySelectorAll<HTMLButtonElement>("[data-dock-tab]").forEach(button => {
      const active = this.expanded && button.dataset.dockTab === this.selected;
      button.classList.toggle("active", active);
      button.setAttribute("aria-expanded", String(active));
      button.setAttribute("aria-controls", "vtt-dock");
    });
    const slot = document.getElementById(this.expanded ? "vtt-dock-action-slot" : "vtt-floating-action-slot")!;
    const action = document.getElementById("decision-panel")!;
    if (action.parentElement !== slot) slot.appendChild(action);
  }

  private async loadLeaderboard(): Promise<void> {
    if (this.loadedLeaderboard) return;
    this.loadedLeaderboard = true;
    this.renderLeaderboard();
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}leaderboard.json`);
      if (!response.ok) throw new Error(String(response.status));
      const data = await response.json();
      const epochs = Object.entries(data.epochs ?? {}) as Array<[string, { pairs?: unknown[]; ratings?: Array<{ player: string; elo: number; main: boolean; games: number }> }]>;
      const played = epochs.filter(([, epoch]) => (epoch.pairs?.length ?? 0) > 0);
      const epoch = (played.length ? played : epochs).at(-1)?.[1];
      this.leaderboard = (epoch?.ratings ?? []).filter(row => row.main).sort((a, b) => b.elo - a.elo).slice(0, 8);
    } catch {
      this.leaderboardError = true;
    }
    this.renderLeaderboard();
  }

  private renderLeaderboard(): void {
    const root = document.getElementById("vtt-leaderboard-body")!;
    if (this.leaderboard === null) {
      root.textContent = t(this.leaderboardError ? "Leaderboard unavailable" : "Loading leaderboard…");
      return;
    }
    if (!this.leaderboard.length) { root.textContent = t("No rated models available"); return; }
    root.innerHTML = `<table><thead><tr><th>#</th><th>${t("Model")}</th><th>Elo</th></tr></thead><tbody>${this.leaderboard.map((row, index) => `<tr><td>${index + 1}</td><td title="${escapeHtml(row.player)}">${escapeHtml(row.player)}</td><td>${Math.round(row.elo)}</td></tr>`).join("")}</tbody></table>`;
  }
}
