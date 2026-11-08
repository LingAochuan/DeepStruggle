import type { GameState } from './types';
import type { ActionLayout } from './engine/layout';
import { CARDS_METADATA, ENGLISH_CARDS_METADATA } from './metadata';
import { cardArtwork } from './cards/art';
import { label, onLocaleChange, t } from './i18n';
import './hand_reveal.css';

type Side = 'US' | 'USSR';
export interface HandReveal { side: Side; cards: number[]; source?: number }

/** Only accepts the viewer's redacted states. A reveal is an action, not a render. */
export function revealedHands(before: GameState, after: GameState, layout: ActionLayout): HandReveal[] {
  const result: HandReveal[] = [];
  const b = before.decision_context, a = after.decision_context;
  const cardId = (name: string) => ENGLISH_CARDS_METADATA.find(c => c.name === name)?.id;
  for (const side of ['US', 'USSR'] as const) {
    if (after.view === side) continue;
    const viewer = side === 'US' ? 'USSR' : 'US';
    const event = cardId(side === 'US' ? '“Lone Gunman”' : 'CIA Created');
    const ames = layout.card_ids.ALDRICH_AMES;
    // These events stop at a decision after revealing, even if every card was already known.
    const opsReveal = event !== undefined && a.decision_player === viewer
      && a.decision_type === layout.decision_types.SELECT_OP_MODE && a.pending_op_card === event
      && !(b.decision_type === a.decision_type && b.pending_op_card === event && b.decision_player === viewer);
    const amesReveal = side === 'US' && ames !== undefined
      && a.resolving_card === ames && b.resolving_card !== ames;
    const visible = after.hands[side].filter(id => after.card_locations?.[id] === `HAND_${side}_KNOWN`);
    const newlyRevealed = visible.filter(id => {
      const location = before.card_locations?.[id];
      return location === `HAND_${side}_UNKNOWN` || location === 'UNSEEN';
    });
    // Other reveals (e.g. Cambridge Five) show only the cards the engine made public.
    if (opsReveal || amesReveal || newlyRevealed.length) {
      result.push({ side, cards: opsReveal || amesReveal ? visible : newlyRevealed,
        source: opsReveal ? event : amesReveal ? ames : a.resolving_card || undefined });
    }
  }
  return result;
}

/** A transient, modal row of face-up cards, with no permanent known-hand tab. */
export class HandRevealDialog {
  private readonly dialog = document.createElement('dialog');
  private pending: HandReveal[] = [];
  private previousFocus: HTMLElement | null = null;

  constructor(private readonly onDismiss: () => void) {
    this.dialog.id = 'hand-reveal-dialog';
    this.dialog.className = 'hand-reveal-dialog';
    this.dialog.setAttribute('aria-labelledby', 'hand-reveal-title');
    document.body.append(this.dialog);
    this.dialog.addEventListener('cancel', event => { event.preventDefault(); this.dismiss(); });
    // Escape and game hotkeys must not reach undo, the map or the other modals.
    this.dialog.addEventListener('keydown', event => {
      event.stopPropagation();
      if (event.key === 'Escape') { event.preventDefault(); this.dismiss(); }
    });
    onLocaleChange(() => { if (this.open) this.render(); });
  }

  get open(): boolean { return this.dialog.open; }

  observe(before: GameState, after: GameState, layout: ActionLayout): void {
    this.pending = revealedHands(before, after, layout);
    if (!this.pending.length) return;
    this.previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.render();
    this.dialog.showModal();
    this.dialog.querySelector<HTMLButtonElement>('button')!.focus();
  }

  /** Position/view changes invalidate the old reveal without re-arming auto-play. */
  clear(): void {
    this.pending = [];
    this.dialog.close();
    this.dialog.replaceChildren();
    this.previousFocus = null;
  }

  private dismiss(): void {
    this.pending.shift();
    if (this.pending.length) { this.render(); return; }
    const focus = this.previousFocus;
    this.clear();
    if (focus?.isConnected) focus.focus();
    this.onDismiss();
  }

  private render(): void {
    const reveal = this.pending[0];
    if (!reveal) return;
    const hadFocus = this.dialog.contains(document.activeElement);
    const title = document.createElement('h2');
    title.id = 'hand-reveal-title';
    title.textContent = t('{0} reveals their hand', [label(reveal.side)]);
    const source = document.createElement('p');
    source.className = 'hand-reveal-source';
    source.textContent = CARDS_METADATA.find(c => c.id === reveal.source)?.name ?? '';
    const row = document.createElement('div');
    row.className = 'hand-reveal-row';
    row.setAttribute('role', 'list');
    row.setAttribute('aria-label', title.textContent);
    row.style.setProperty('--revealed-count', String(Math.max(1, reveal.cards.length)));
    for (const id of reveal.cards) {
      const card = CARDS_METADATA.find(c => c.id === id);
      if (!card) continue;
      const figure = document.createElement('figure');
      figure.className = 'hand-reveal-card';
      figure.dataset.cardId = String(id);
      figure.setAttribute('role', 'listitem');
      const fallback = document.createElement('div');
      fallback.className = 'hand-reveal-fallback';
      fallback.textContent = card.description;
      const art = cardArtwork(id);
      if (art) {
        const img = document.createElement('img');
        img.alt = card.name;
        img.width = art.width;
        img.height = art.height;
        img.onload = () => { fallback.hidden = true; };
        img.onerror = () => { img.remove(); fallback.hidden = false; };
        img.src = art.src;
        figure.append(img);
      }
      const caption = document.createElement('figcaption');
      caption.textContent = `#${id} ${card.name}`;
      figure.append(fallback, caption);
      row.append(figure);
    }
    if (!reveal.cards.length) row.textContent = t('No cards to reveal');
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'hand-reveal-close';
    close.textContent = t('Close');
    close.onclick = () => this.dismiss();
    this.dialog.replaceChildren(title, source, row, close);
    if (hadFocus) close.focus();
  }
}
