import { t, label } from "./i18n";
import type { RegionScoreAudit } from "./map_view";
import type { RegionalStatus, RegionSideScore } from "./types";
import { escapeHtml } from "./html";

const STANDING_NAME: Record<RegionalStatus, string> = {
  NONE: "None", PRESENCE: "Presence", DOMINATION: "Domination", CONTROL: "Control",
};

/** The same, as a map badge has room for. */
export const STANDING_SHORT: Record<RegionalStatus, string> = {
  NONE: "—", PRESENCE: "Pres", DOMINATION: "Dom", CONTROL: "Ctrl",
};

const title = (s: string): string => s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

export type NetSide = "us" | "ussr" | "even";

/** "+3 USSR", "+2 US", "even", or who wins outright -- in full, and as short as a map badge needs. */
export function regionNet(a: RegionScoreAudit): { text: string; short: string; side: NetSide } {
  if (a.wins === "US") return { text: t("US wins the game"), short: "US WINS", side: "us" };
  if (a.wins === "USSR") return { text: t("USSR wins the game"), short: "USSR WINS", side: "ussr" };
  const vp = (text: string, side: NetSide) => ({ text, short: text, side });
  if (a.netVpUs > 0) return vp(t("+{0} US", [a.netVpUs]), "us");
  if (a.netVpUs < 0) return vp(t("+{0} USSR", [-a.netVpUs]), "ussr");
  return vp("even", "even");
}

function row(caption: string, us: string, ussr: string, cls = ""): string {
  return `<div class="rs-row ${cls}"><span class="rs-us">${label(us)}</span><span class="rs-label">${label(caption)}</span><span class="rs-ussr">${label(ussr)}</span></div>`;
}

/** A count and the VP it brings: "2 · +2". */
const counted = (n: number, vp: number): string => `${label(n)}<small>${label(vp ? ` · +${vp}` : "")}</small>`;

/** A standing and what it alone is worth: "Domination · 7". */
function standing(s: RegionSideScore): string {
  const name = STANDING_NAME[s.status ?? "NONE"];
  return `${label(name)}<small>${label(s.base_vp ? ` · ${s.base_vp}` : "")}</small>`;
}

export function regionSummaryHtml(a: RegionScoreAudit): string {
  const net = regionNet(a);
  let rows: string;
  if (a.southeastAsia) {
    // Southeast Asia Scoring has no standings: each country is worth its VP (Thailand 2).
    const worth = (s: RegionSideScore, vp: number) => s.controlled.filter(c => c.vp === vp).length;
    rows = row(t("Countries (1 VP)"), String(worth(a.us, 1)), String(worth(a.ussr, 1)))
      + row(t("Thailand (2 VP)"), worth(a.us, 2) ? t("Controlled") : "—", worth(a.ussr, 2) ? t("Controlled") : "—");
  } else {
    const other = (s: RegionSideScore) => String(s.countries - s.battlegrounds);
    rows = row("Standing", standing(a.us), standing(a.ussr), "rs-standing")
      + row(`${t("Battlegrounds")} <small>${t("of {0}", [a.totalBattlegrounds])}</small>`,
            counted(a.us.battlegrounds, a.us.battlegrounds), counted(a.ussr.battlegrounds, a.ussr.battlegrounds))
      + row(t("Other countries"), other(a.us), other(a.ussr))
      + row(t("Next to the enemy"), counted(a.us.adjacent, a.us.adjacent), counted(a.ussr.adjacent, a.ussr.adjacent));
  }
  rows += row("Total", String(a.us.vp), String(a.ussr.vp), "rs-total");
  const list = (names: string[]): string => escapeHtml(names.length ? names.join(", ") : "none");
  const uncounted = a.shuttleDiplomacy
    ? `<div class="rs-foot">${t("Shuttle Diplomacy: one USSR battleground is not counted in this scoring")}</div>`
    : "";
  return `
    <div class="rs" style="--rs-accent: ${escapeHtml(a.color)}" data-region="${escapeHtml(a.regionName)}">
      <div class="rs-head"><span class="rs-title">${t("{0} Scoring", [escapeHtml(title(a.regionName))])}</span><span class="rs-net rs-${net.side}">${label(net.text)}</span></div>
      <div class="rs-sides"><span class="rs-us">${t("US")}</span><span></span><span class="rs-ussr">${t("USSR")}</span></div>
      ${label(rows)}
      <div class="rs-list"><span class="rs-us">${t("US controls")}</span> ${label(list(a.usControlled))}</div>
      <div class="rs-list"><span class="rs-ussr">${t("USSR controls")}</span> ${label(list(a.ussrControlled))}</div>
      ${label(uncounted)}
      <div class="rs-foot">${label(escapeHtml(a.scoringCardText))}</div>
      <div class="rs-foot">${`${escapeHtml(a.scoringCardName)}: ${escapeHtml(a.scoringCard.where)}`}</div>
    </div>`;
}
