/** Display-only localization. Engine IDs, records and protocol values remain English. */
import gameData from "./zh-CN/game.json";
import messages from "./zh-CN/messages.json";
import errors from "./zh-CN/errors.json";
import logMessages from "./zh-CN/log-messages.json";
import cards from "../../../../rules/cards.json";
import map from "../../../../rules/map.json";

export type Locale = "en" | "zh-CN";
type GameText = { cards: Record<string, { name: string; description: string }>;
  countries: Record<string, string>; regions: Record<string, string>; terms: Record<string, string> };
const game = gameData as GameText;
const catalog: Record<string, string> = { ...errors, ...logMessages, ...messages };
const STORAGE_KEY = "deepstruggle.locale.v1";
const listeners = new Set<() => void>();

function initialLocale(): Locale {
  try {
    const query = new URLSearchParams(globalThis.location?.search ?? "").get("lang");
    if (query === "en" || query === "zh-CN") return query;
    return globalThis.localStorage?.getItem(STORAGE_KEY) === "zh-CN" ? "zh-CN" : "en";
  } catch { return "en"; }
}
let current = initialLocale();
export const locale = (): Locale => current;
export function onLocaleChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function setLocale(next: Locale): void {
  if (next !== "en" && next !== "zh-CN") return;
  try { globalThis.localStorage?.setItem(STORAGE_KEY, next); } catch { /* storage is optional */ }
  if (typeof location !== "undefined" && typeof history !== "undefined") {
    const url = new URL(location.href);
    url.searchParams.set("lang", next);
    history.replaceState(history.state, "", url);
  }
  if (next === current) return;
  current = next;
  applyStaticMessages();
  listeners.forEach(listener => listener());
}

const names: Record<string, string> = {};
for (const c of cards) if (game.cards[String(c.id)]) names[c.name] = game.cards[String(c.id)].name;
for (const c of map.countries) if (game.countries[String(c.id)]) names[c.name] = game.countries[String(c.id)];
Object.assign(names, game.regions, game.terms);
// These are display aliases only. The underlying side / enum values are never changed.
Object.assign(names, {
  US: game.terms["US / USA / United States"] ?? "美国", USA: "美国", USSR: "苏联",
  "UNITED STATES": "美国", "SOVIET UNION": "苏联", BOTH: "双方", NEUTRAL: "中立",
  Ops: game.terms["Operations / Ops"] ?? "行动点数", Operations: game.terms["Operations / Ops"] ?? "行动点数",
  "Victory Points": game.terms["Victory Points / VP"] ?? "胜利点数",
});
const normalized = new Map(Object.entries({ ...catalog, ...names }).map(([key, value]) =>
  [key.toLowerCase().replace(/\s+/g, " ").trim(), value]));
const unescapeText = (value: string) => value.replace(/&(?:amp|lt|gt|quot|#39);/g,
  entity => ({ "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" })[entity]!);
const escapeText = (value: string) => value.replace(/[&<>"']/g,
  char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

/** An explicitly displayed value, including names obtained from the engine. */
export function label(value: unknown): string {
  const text = String(value);
  if (current === "en") return text;
  const translated = names[text] ?? catalog[text] ?? normalized.get(text.toLowerCase().replace(/\s+/g, " ").trim());
  if (translated !== undefined) return translated;
  // Existing renderers escape replay text before interpolation. Only known catalog values
  // are decoded/re-escaped here; unrecognized (including user-supplied) text is untouched.
  const decoded = unescapeText(text);
  if (decoded !== text) {
    const safe = names[decoded] ?? catalog[decoded] ?? normalized.get(decoded.toLowerCase().replace(/\s+/g, " ").trim());
    if (safe !== undefined) return escapeText(safe);
  }
  return text;
}
/** English source messages are stable keys; numbered parameters allow Chinese word order. */
export function t(source: string, values: readonly unknown[] = []): string {
  const template = current === "zh-CN" ? label(source) : source;
  return template.replace(/\{(\d+)\}/g, (_, index: string) => {
    const value = values[Number(index)];
    return value === undefined ? `{${index}}` : label(value);
  });
}
export function cardName(id: number, english = ""): string {
  return current === "zh-CN" ? game.cards[String(id)]?.name ?? english : english;
}
export function cardDescription(id: number, english = ""): string {
  return current === "zh-CN" ? game.cards[String(id)]?.description ?? english : english;
}
export function countryName(id: number, english = ""): string {
  return current === "zh-CN" ? game.countries[String(id)] ?? english : english;
}
export function regionName(english: string): string {
  return current === "zh-CN" ? game.regions[english] ?? english : english;
}
export const term = label;

/** Only opt-in nodes are touched. This is not a page-wide text replacement pass. */
export function applyStaticMessages(root: ParentNode = document): void {
  document.documentElement.lang = current;
  root.querySelectorAll<HTMLElement>("[data-i18n]").forEach(el => {
    el.textContent = t(el.dataset.i18n!);
  });
  for (const attr of ["title", "placeholder", "aria-label"] as const) {
    root.querySelectorAll<HTMLElement>(`[data-i18n-${attr}]`).forEach(el => {
      el.setAttribute(attr, t(el.getAttribute(`data-i18n-${attr}`)!));
    });
  }
  root.querySelectorAll<HTMLSelectElement>("[data-locale-select]").forEach(el => { el.value = current; });
}
export function bindLanguageControls(): void {
  applyStaticMessages();
  document.querySelectorAll<HTMLSelectElement>("[data-locale-select]").forEach(el => {
    el.addEventListener("change", () => setLocale(el.value as Locale));
  });
}

let modalRenderer: (() => void) | null = null;
/** The shared modal's owner supplies its renderer; switching languages preserves entered values. */
export function setModalRenderer(render: () => void): void { modalRenderer = render; }
onLocaleChange(() => {
  const modal = document.getElementById("modal-container");
  if (!modalRenderer || !modal || modal.classList.contains("hidden")) return;
  const fields = Array.from(modal.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input[id], select[id], textarea[id]"))
    .map(el => ({ id: el.id, value: el.value, checked: el instanceof HTMLInputElement ? el.checked : undefined }));
  const focusedId = (document.activeElement as HTMLElement | null)?.id;
  const scrollTop = modal.querySelector(".modal-body")?.scrollTop ?? 0;
  modalRenderer();
  fields.forEach(({ id, value, checked }) => {
    const el = document.getElementById(id) as HTMLInputElement | null;
    if (el) { el.value = value; if (checked !== undefined) el.checked = checked; }
  });
  const body = modal.querySelector(".modal-body");
  if (body) body.scrollTop = scrollTop;
  if (focusedId) document.getElementById(focusedId)?.focus();
});
