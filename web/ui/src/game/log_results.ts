/** Result-only presentation. Reads the view's log, never the unredacted session or engine. */
import type { ActionLogItem } from "../types";
import { boardResults, groupLog, type LogEntry } from "./log_view";
import { cardName, label, t } from "../i18n";
import { localizeLog } from "../i18n/log";
import { escapeHtml } from "../html";
import { linkCardRefs, type CardNames } from "./card_refs";

export interface ResultEntry extends LogEntry {
  card?: number;
  mode?: string;
  pending?: boolean;
  headlines?: Array<{ player: string; card: number }>;
}

export function resultLog(items: ActionLogItem[]): ResultEntry[] {
  const out: ResultEntry[] = [];
  for (const entry of groupLog(items)) {
    const raw = items.slice(entry.first, entry.last + 1);
    const anchor = raw[0];
    const card = anchor.kind === "play" ? anchor.cards?.[0] : undefined;
    const lines = boardResults(raw, anchor.cards);
    const mode = entry.title.includes(" — ") ? entry.title.split(" — ").slice(1).join(" — ") : undefined;
    if (anchor.kind === "headline" && anchor.cards?.length === 2) {
      // The earlier face-down commit becomes the revealed card, not an extra play.
      const prev = out.at(-1);
      let first = entry.first;
      if (prev?.pending && prev.turn === entry.turn && prev.phase === "HEADLINE") {
        first = prev.first;
        out.pop();
      }
      out.push({ ...entry, first, player: "SYSTEM", card: undefined,
        title: "Headline Phase", lines, steps: lines.map(() => null),
        headlines: anchor.cards.map((id, i) => ({ player: i === 0 ? "US" : "USSR", card: id })) });
      continue;
    }
    // A still-face-down card has no metadata ID: only parse the redacted visible text.
    if (anchor.kind === "headline") {
      const id = /\(#(\d+)\)/.exec(anchor.text);
      out.push({ ...entry, player: "SYSTEM", title: "Headline Phase", pending: true,
        headlines: id ? [{ player: anchor.player, card: +id[1] }] : [],
        mode: "Waiting for headlines", lines, steps: lines.map(() => null) });
      continue;
    }
    const player = /^(USSR|US)\b/.exec(entry.title)?.[1] ?? entry.player;
    out.push({ ...entry, player, card, mode, lines, steps: lines.map(() => null) });
  }
  return out;
}

const arrow = `<svg class="result-arrow" viewBox="0 0 32 16" aria-hidden="true"><path d="M2 8h26M21 2l7 6-7 6"/></svg>`;
const txt = (s: string) => escapeHtml(label(s));
const change = (a: string, b: string, side = "") => `<span class="result-change ${side === "US" ? "us" : side === "USSR" ? "ussr" : ""}"><span class="result-before">${escapeHtml(a)}</span>${arrow}<span class="sr-only">${txt("to")}</span><strong class="result-after">${escapeHtml(b)}</strong></span>`;

/** Safe HTML for a result line. Numbers stay selectable text; arrows are crisp SVG paths. */
export function resultLine(line: string, names: CardNames): string {
  let m: RegExpExecArray | null;
  if ((m = /^  • (.+) Influence: (.+)$/.exec(line))) {
    const sides = [...m[2].matchAll(/(US|USSR): (\d+) -> (\d+)/g)];
    return `<div class="result-group"><h4>${escapeHtml(t("{0} Influence", [label(m[1])]))}</h4>${sides.map(s =>
      `<div class="result-row"><span class="result-side ${s[1].toLowerCase()}">${txt(s[1])}</span>${change(s[2], s[3], s[1])}</div>`).join("")}</div>`;
  }
  if ((m = /^  • (DEFCON|Victory Points|US MilOps|USSR MilOps): ([+-]?\d+)(?: \((\w+)\))? -> ([+-]?\d+)(?: \((\w+)\))?/.exec(line))) {
    const side = m[1].startsWith("USSR") ? "USSR" : m[1].startsWith("US ") ? "US" : "";
    const vp = m[1] === "Victory Points";
    const value = (n: string) => vp && +n !== 0 ? `${label(+n > 0 ? "US" : "USSR")} ${Math.abs(+n)}` : n;
    return `<div class="result-group result-row"><h4>${txt(m[1])}</h4>${change(value(m[2]), value(m[4]), side)}</div>`;
  }
  if ((m = /^  • Space Race: (US|USSR) (\d+) -> (\d+)$/.exec(line))) {
    return `<div class="result-group result-row"><h4>${escapeHtml(t("{0} Space Race", [m[1]]))}</h4>${change(m[2], m[3], m[1])}</div>`;
  }
  return `<div class="result-note">${linkCardRefs(localizeLog(line).replace(/^\s*•\s*/, ""), names)}</div>`;
}

export function resultEntryHtml(e: ResultEntry, names: CardNames): string {
  // Replay JSON is untrusted: TypeScript's number annotation does not validate it.
  const cardTitle = (id: number) => {
    if (!Number.isSafeInteger(id) || id <= 0) return escapeHtml(String(id));
    return `<span class="result-card-number">#${id}</span> <span class="log-card" tabindex="0" data-card-id="${id}">${escapeHtml(cardName(id, names.namesOf(id)[0] ?? ""))}</span>`;
  };
  const title = e.card
    ? cardTitle(e.card)
    : linkCardRefs(localizeLog(e.title), names);
  const subtitle = e.mode ? localizeLog(e.mode) : "";
  const phase = e.phase === "HEADLINE" ? t("Turn {0} · Headline", [e.turn]) : e.phase === "SETUP" ? label("Setup") : t("Turn {0} · AR {1}", [e.turn, e.ar]);
  const headlines = e.headlines?.map(c => `<div class="result-headline"><span class="result-headline-player">${txt(c.player)}</span><h3 class="result-title">${cardTitle(c.card)}</h3></div>`).join("") ?? "";
  return `<header class="result-header"><div class="result-context"><span>${txt(e.player)}</span><span>${escapeHtml(phase)}</span></div>${headlines || `<h3 class="result-title">${title}</h3>`}${subtitle ? `<div class="result-mode">${escapeHtml(subtitle)}</div>` : ""}</header>
    <div class="result-body">${e.lines.map(line => resultLine(line, names)).join("") || (e.card && !e.pending && e.mode !== "Headline" ? `<div class="result-note result-quiet">${txt("No recorded board changes")}</div>` : "")}</div>`;
}
