import { ReplayAnalyzer } from "./analysis/replay";
import type { ReplayStep } from "./replay_controls";
import { escapeHtml as esc } from "./html";
import { t, label, onLocaleChange } from "./i18n";
import { localizeLog } from "./i18n/log";
import { valueSidesHtml } from "./trace_view";

/** Read-only analysis: nothing here can execute an action in the live game. */
export class ReplayAnalysisView {
  private root = document.getElementById("replay-analysis-panel")!;
  private steps: ReplayStep[] = [];
  private index = 0;
  private modelLabel = "";
  private detailKey = "";
  constructor(readonly analyzer: ReplayAnalyzer, seek: (index: number) => void,
    restart: () => void, private readonly decorateDescription: (root: HTMLElement) => void) {
    document.getElementById("rep-analysis-cancel")!.onclick = () => analyzer.cancel();
    document.getElementById("rep-analysis-restart")!.onclick = restart;
    document.getElementById("rep-analysis-model")!.onclick = () => document.getElementById("btn-model-choose")?.click();
    const chart = document.getElementById("rep-analysis-chart")!;
    chart.onclick = e => {
      const svg = chart.querySelector("svg");
      if (!svg || !analyzer.state.points.length) return;
      const rect = svg.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width * 400 - 34) / 354;
      seek(Math.max(0, Math.min(this.steps.length - 1, Math.round(x * (this.steps.length - 1)))));
    };
    chart.onkeydown = e => {
      const next = e.key === "ArrowLeft" ? this.index - 1 : e.key === "ArrowRight" ? this.index + 1
        : e.key === "Home" ? 0 : e.key === "End" ? this.steps.length - 1 : null;
      if (next !== null) { e.preventDefault(); seek(next); }
    };
    onLocaleChange(() => { this.detailKey = ""; this.render(); });
  }
  show(on: boolean): void { this.root.classList.toggle("hidden", !on); }
  set(steps: ReplayStep[], index: number, modelLabel: string): void {
    if (steps !== this.steps) this.detailKey = "";
    this.steps = steps; this.index = index; this.modelLabel = modelLabel; this.render();
  }
  render(): void {
    const s = this.analyzer.state;
    this.root.dataset.phase = s.phase;
    this.root.dataset.completed = String(s.points.length);
    const text = s.phase === "verifying" ? t("Verifying replay: {0} / {1}", [s.done, s.total])
      : s.phase === "analysing" ? t("Analysing: {0} / {1}", [s.done, s.total])
      : s.phase === "complete" ? t("Analysis complete: {0} steps", [s.total])
      : s.phase === "cancelled" ? t("Analysis stopped. Completed points are kept.")
      : s.phase === "error" ? t(s.error!.code) + (s.error!.step === undefined ? "" : t(" At step {0}.", [s.error!.step! + 1]))
        + (s.error!.detail ? ` (${localizeLog(s.error!.detail)})` : "")
      : this.steps.length ? t("Choose a model to analyse this replay.") : t("Load a replay to analyse it.");
    document.getElementById("rep-analysis-status")!.textContent = text;
    document.getElementById("rep-analysis-model-label")!.textContent = this.modelLabel;
    const busy = s.phase === "verifying" || s.phase === "analysing";
    (document.getElementById("rep-analysis-cancel") as HTMLButtonElement).disabled = !busy;
    (document.getElementById("rep-analysis-restart") as HTMLButtonElement).disabled = busy || !this.steps.length || !this.modelLabel;
    const progress = document.getElementById("rep-analysis-progress") as HTMLProgressElement;
    progress.max = Math.max(1, s.total); progress.value = s.done; progress.hidden = !busy;
    this.renderChart();
    const key = `${this.index}:${s.points.length > this.index}:${s.phase}:${this.modelLabel}`;
    if (key === this.detailKey) return;
    this.detailKey = key;
    const detail = document.getElementById("rep-analysis-detail")!;
    const step = this.steps[this.index], point = s.points[this.index];
    if (!step) { detail.innerHTML = ""; return; }
    const heading = `<h4>${esc(t("Step {0}", [this.index + 1]))} · ${esc(label(step.player))}</h4>
      <p class="rep-action-name">${esc(localizeLog(step.description))}</p>`;
    if (!point) {
      detail.innerHTML = heading + `<p>${esc(t("This step has not been analysed yet."))}</p>`;
      this.decorateDescription(detail.querySelector<HTMLElement>(".rep-action-name")!);
      return;
    }
    const selected = point.before.choices.find(c => c.idx === point.playedIndex);
    detail.innerHTML = heading
      + `<h5>${esc(t("Position after this action"))}</h5>`
      + valueSidesHtml(point.after.critic!, point.after.decision_player ?? null, step.state_snapshot.is_terminal ? step.state_snapshot : null)
      + `<h5>${esc(t("Model choices before this action"))} · ${esc(label(point.before.decision_player ?? ""))}</h5>`
      + `<p class="rep-analysis-note">${esc(selected ? t("Probability of the recorded action: {0}", [(selected.p * 100).toFixed(1) + "%"])
        : t("This recorded micro-action has no exact match in the model's action view; no agreement score is assigned."))}</p>`
      + `<ol class="rep-analysis-choices">${point.before.choices.map((c, i) =>
        `<li class="${c.idx === point.playedIndex ? "rep-played" : ""}"><span class="rep-choice-rank">${i + 1}</span><span>${esc(localizeLog(c.name ?? String(c.idx)))}
          ${c.idx === point.playedIndex ? `<small>${esc(t("Played"))}</small>` : ""}</span><strong>${(c.p * 100).toFixed(1)}%</strong></li>`).join("")}</ol>`;
    this.decorateDescription(detail.querySelector<HTMLElement>(".rep-action-name")!);
  }
  private renderChart(): void {
    const s = this.analyzer.state;
    const chart = document.getElementById("rep-analysis-chart")!;
    const x = (i: number) => 34 + (this.steps.length > 1 ? i / (this.steps.length - 1) : 0) * 354;
    const y = (v: number) => 158 - Math.max(0, Math.min(1, (v + 1) / 2)) * 142;
    const bits: string[] = [];
    for (const p of [25, 75]) {
      const yy = 158 - p / 100 * 142;
      bits.push(`<line x1="34" x2="388" y1="${yy}" y2="${yy}" class="rep-grid rep-grid-quarter"/>`);
    }
    for (const p of [0, 50, 100]) {
      const yy = 158 - p / 100 * 142;
      bits.push(`<line x1="34" x2="388" y1="${yy}" y2="${yy}" class="rep-grid"/><text x="28" y="${yy + 4}" text-anchor="end">${p}%</text>`);
    }
    for (const side of ["US", "USSR"] as const) {
      const value = (i: number) => side === "US" ? s.points[i].after.critic!.v_win_us! : s.points[i].after.critic!.v_win_ussr!;
      for (let i = 1; i < s.points.length; i++) {
        const active = s.points[i - 1].after.decision_player === side && s.points[i].after.decision_player === side;
        bits.push(`<path class="rep-curve ${side.toLowerCase()}${active ? "" : " rep-uncalibrated"}" d="M${x(i - 1)},${y(value(i - 1))} L${x(i)},${y(value(i))}"/>`);
      }
      if (s.points[this.index]) bits.push(`<circle class="rep-dot ${side.toLowerCase()}" cx="${x(this.index)}" cy="${y(value(this.index))}" r="4"/>`);
    }
    if (this.steps.length) bits.push(`<line class="rep-cursor" x1="${x(this.index)}" x2="${x(this.index)}" y1="12" y2="160"/>`);
    chart.setAttribute("aria-label", t("Win probability by replay step"));
    chart.setAttribute("aria-valuemin", "1"); chart.setAttribute("aria-valuemax", String(Math.max(1, this.steps.length)));
    chart.setAttribute("aria-valuenow", String(this.index + 1));
    chart.innerHTML = `<svg viewBox="0 0 400 184" aria-hidden="true">${bits.join("")}<text x="34" y="179">1</text><text x="388" y="179" text-anchor="end">${this.steps.length || ""}</text></svg>`;
  }
}
