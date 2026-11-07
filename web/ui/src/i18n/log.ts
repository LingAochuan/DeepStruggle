/** Display adapter for the English log/action grammar. Records remain byte-for-byte English. */
import logTemplates from "./zh-CN/log-messages.json";
import errorTemplates from "./zh-CN/errors.json";
const templates = { ...logTemplates, ...errorTemplates };
import { cardName, countryName, label, locale, t } from "./index";
import { withoutEmoji } from "./plain_text";

const escapePattern = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const patterns = Object.entries(templates).filter(([key]) => /[A-Za-z]/.test(key)).map(([key, zh]) => {
  const slots: number[] = [];
  let pattern = "", at = 0;
  for (const m of key.matchAll(/\{(\d+)\}/g)) {
    const slot = Number(m[1]);
    let capture = "[\\s\\S]*?";
    // Numeric fields cannot consume the next side's change or the VP side annotation.
    if (/^(US|USSR): /.test(key)) capture = "[+-]?\\d+";
    if (key.startsWith("  • Victory Points:")) {
      capture = slot < 2 ? "[+-]?\\d+ \\((?:US|USSR|Tie)\\)" : key.endsWith("({2} VP)") ? "[+-]?\\d+" : "[+-]?\\d+ VP";
    }
    pattern += escapePattern(key.slice(at, m.index)) + `(${capture})`;
    slots.push(Number(m[1]));
    at = m.index! + m[0].length;
  }
  pattern += escapePattern(key.slice(at));
  const cardPairs = Array.from(key.matchAll(/\{(\d+)\}'? \(\#\{(\d+)\}/g), m => [Number(m[1]), Number(m[2])]);
  if (key.startsWith("  • Card #") || key.startsWith("SelectCard #")) cardPairs.push([1, 0]);
  return { regex: new RegExp(`^${pattern}$`), slots, zh, cardPairs, countryRef: key.startsWith("PointNode #"),
    specificity: key.replace(/\{\d+\}/g, "").length };
}).sort((a, b) => b.specificity - a.specificity);

/** Complete mode grammar, including chained Ops -> opponent Event -> extra Ops.
 * Parse every segment before translating so a generic "Ops: {0}" cannot swallow
 * the remainder and leave a half-English subtitle. Unknown prose is not token-replaced.
 */
function actionModes(text: string): string | null {
  const actions: Record<string, string> = {
    influence: "Influence", "influence placement": "Influence", "place influence": "Influence",
    coup: "Coup", "coup attempt": "Coup", realignment: "Realignment", realign: "Realignment",
  };
  const parts = text.split(/,\s*then\s+/i);
  const translated = parts.map(part => {
    if (/^event$/i.test(part)) return label("Event");
    if (/^space race$/i.test(part)) return label("Space Race");
    let m = /^(?:Ops?|Operations)(?::\s*(.+))?$/i.exec(part);
    if (m) {
      if (!m[1]) return label("Ops");
      const action = actions[m[1].toLowerCase()];
      return action ? t("Ops: {0}", [label(action)]) : null;
    }
    m = /^(USSR|US) Event first$/i.exec(part);
    if (m) return t("{0} Event first", [m[1].toUpperCase()]);
    m = /^the (USSR|US) Event$/i.exec(part);
    if (m) return t("Resolve the {0} Event", [m[1].toUpperCase()]);
    return null;
  });
  return translated.every(part => part !== null) ? translated.join(t(", then ")) : null;
}

function translate(text: string, depth: number): string {
  const exact = label(text);
  if (exact !== text || depth > 8) return exact;
  const mode = actionModes(text);
  if (mode !== null) return mode;
  const cardMove = /^  • (.+) \(#(\d{1,3})\) (.+)$/.exec(text);
  if (cardMove) {
    const movement = translate(cardMove[3], depth + 1);
    if (movement !== cardMove[3]) return `  • ${cardName(Number(cardMove[2]), cardMove[1])} (#${cardMove[2]}) ${movement}`;
  }
  const dash = text.indexOf(" — ");
  if (dash >= 0) {
    const left = part(text.slice(0, dash), depth + 1), right = part(text.slice(dash + 3), depth + 1);
    if (left !== text.slice(0, dash) && right !== text.slice(dash + 3)) return `${left} —— ${right}`;
  }
  // A branch has a known verb phrase and a parenthesized event; do not interpret arbitrary prose.
  const branch = /^(US|USSR) (.+) \(([^()]*)\)$/.exec(text);
  if (branch) {
    const verb = translate(branch[2], depth + 1);
    if (verb !== branch[2]) return `${label(branch[1])}${verb}（${label(branch[3])}）`;
  }
  for (const { regex, slots, zh, cardPairs, countryRef } of patterns) {
    const match = regex.exec(text);
    if (!match) continue;
    const values: Record<number, string> = {};
    slots.forEach((slot, index) => { values[slot] = part(match[index + 1], depth + 1); });
    cardPairs.forEach(([name, id]) => { values[name] = cardName(Number(values[id]), values[name]); });
    if (countryRef) values[1] = countryName(Number(values[0]), values[1]);
    return zh.replace(/\{(\d+)\}/g, (_, slot: string) => values[Number(slot)] ?? `{${slot}}`);
  }
  return text;
}

/** Fragments are interpreted only inside a recognized log sentence. */
function part(text: string, depth: number): string {
  // A deal can contain several numbered references. Match the complete list
  // before the single-reference rule so the last ID cannot replace every name.
  const refs = [...text.matchAll(/(?:^|, )([^()]+?) \((#\d+(?:, [^()]*)?)\)/g)];
  if (refs.length > 1 && refs.map(ref => ref[0]).join("") === text) {
    return refs.map(ref => part(`${ref[1]} (${ref[2]})`, depth + 1)).join(", ");
  }
  // This is the log's two-side influence list, not one side with a long parenthesized delta.
  if (/^(?:US|USSR): [+-]?\d+ -> [+-]?\d+ \([+-]?\d+\), (?:US|USSR): /.test(text)) {
    return text.split(", ").map(s => translate(s, depth)).join(", ");
  }
  const translated = translate(text, depth);
  if (translated !== text) return translated;
  const ref = /^([^()]*) \(#(\d+)(?:, (\d+) Ops)?\)$/.exec(text);
  if (ref) return `${cardName(Number(ref[2]), ref[1])} (#${ref[2]}${ref[3] ? `, ${ref[3]} ${label("Ops")}` : ""})`;
  // Dealt cards, or two sides' influence changes. Preserve the separators for card hover links.
  if (text.includes(", ")) return text.split(", ").map(s => translate(s, depth)).join(", ");
  return text;
}

/** Translate display text and remove historic pictographs; stored records stay unchanged. */
export function localizeLog(text: string): string {
  if (locale() === "en") return withoutEmoji(text);
  if (text.startsWith("  ▸ ")) return "  ▸ " + withoutEmoji(translate(text.slice(4), 0));
  return withoutEmoji(translate(text, 0));
}
