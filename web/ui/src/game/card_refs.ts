/**
 * The cards a log line names, made hoverable: each mention is wrapped in a
 * `<span class="log-card" data-card-id>` that main.ts gives the card's tooltip (its Ops, side and
 * text, as the hand tabs show it). The log says a card as `Name (#id)`, `'Name' (#id, n Ops)` (the
 * headline reveal), `Card #id (Name)` (a card move), or by name alone in a deal ("US draws 3
 * cards: A, B, C"). Lines are the redacted log (game/view.ts), so nothing named here is hidden.
 */

import { escapeHtml } from "../html";

const REF = /(?:Card|卡牌) #(\d{1,3})[ （(]+[^)）]*[)）]|\(#(\d{1,3})(?:, [^)]*)?\)/g;
const DRAWS = /^(\s*• (?:(?:US|USSR) draws \d+ cards?: |(?:美国|苏联)抽取 \d+ 张牌：))(.+)$/;

export interface CardNames {
  /** The names a card goes by in the log (the engine's and the rules'); empty for no such card. */
  namesOf(id: number): readonly string[];
  /** The card a name is, if it is one. */
  idOf(name: string): number | undefined;
}

/** Add hover targets to already-rendered HUD text without replacing HTML or its handlers. */
export function annotateCardRefs(root: HTMLElement, cards: CardNames): void {
  const names = new Map<string, number>();
  for (let id = 1; id <= 110; id++) for (const name of cards.namesOf(id)) {
    if (name) names.set(name, id);
  }
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(?:Card|卡牌) #([0-9]{1,3})(?![0-9])|${[...names.keys()].sort((a, b) => b.length - a.length).map(escape).join('|')}`, 'g');
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const texts: Text[] = [];
  while (walker.nextNode()) {
    const text = walker.currentNode as Text;
    if (!text.parentElement?.closest('[data-card-id], script, style, .trace-choice-badge')) texts.push(text);
  }
  for (const text of texts) {
    const value = text.data;
    const fragment = document.createDocumentFragment();
    let end = 0;
    for (const match of value.matchAll(pattern)) {
      const id = match[1] ? Number(match[1]) : names.get(match[0]);
      if (!id || !cards.namesOf(id).length) continue;
      fragment.append(document.createTextNode(value.slice(end, match.index)));
      const ref = document.createElement('span');
      ref.className = 'log-card'; ref.dataset.cardId = String(id); ref.tabIndex = 0;
      ref.textContent = match[0]; fragment.append(ref);
      end = match.index! + match[0].length;
    }
    if (end) { fragment.append(document.createTextNode(value.slice(end))); text.replaceWith(fragment); }
  }
}

/** `inner` is text, escaped here. */
function span(id: number, inner: string): string {
  return `<span class="log-card" data-card-id="${id}">${escapeHtml(inner)}</span>`;
}

/**
 * `text` as HTML: every card it names wrapped for hovering, and all of it escaped -- a log line can
 * come from a replay file (its descriptions), which is anyone's text.
 */
export function linkCardRefs(text: string, cards: CardNames): string {
  const deal = DRAWS.exec(text);
  if (deal) {
    return escapeHtml(deal[1]) + deal[2].split(", ").map(n => {
      const id = cards.idOf(n);
      return id === undefined ? escapeHtml(n) : span(id, n);
    }).join(", ");
  }
  let out = "";
  let last = 0;
  for (const m of text.matchAll(REF)) {
    const at = m.index ?? 0;
    const id = parseInt(m[1] ?? m[2], 10);
    const names = cards.namesOf(id);
    if (names.length === 0) continue;
    // `(#id)` follows the card's name: take the name in, quoted or not.
    let start = at;
    if (m[2] !== undefined) {
      const before = text.slice(last, at);
      const form = names.flatMap(n => [`${n} `, `'${n}' `]).find(f => before.endsWith(f));
      if (form) start = at - form.length;
    }
    const end = at + m[0].length;
    out += escapeHtml(text.slice(last, start)) + span(id, text.slice(start, end));
    last = end;
  }
  return out + escapeHtml(text.slice(last));
}
