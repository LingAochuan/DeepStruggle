import { CardMetadata } from '../types';
import { cardArtwork } from './art';

/** A stable reading area beside the visible hand; receives only already-visible rows. */
export class HandPreview {
  private readonly panel = document.getElementById('text-card-picker')!;
  private readonly list = document.getElementById('text-card-picker-list')!;
  private readonly preview = document.createElement('div');
  private pending: number | undefined;
  private leaving: number | undefined;
  private generation = 0;
  private row: HTMLElement | null = null;
  private lastImageWidth = 240;
  private readonly metas = new WeakMap<HTMLElement, CardMetadata>();

  constructor(private readonly beforeShow: () => void) {
    this.preview.id = 'hand-card-preview';
    this.preview.className = 'hand-card-preview hidden';
    document.body.append(this.preview);
    this.panel.addEventListener('mouseenter', () => window.clearTimeout(this.leaving));
    this.panel.addEventListener('mouseleave', () => this.leave());
    this.preview.addEventListener('mouseenter', () => window.clearTimeout(this.leaving));
    this.preview.addEventListener('mouseleave', () => this.leave());
    this.list.addEventListener('scroll', () => {
      this.hide();
      const row = this.list.querySelector<HTMLElement>('.vtt-text-card:hover');
      const meta = row && this.metas.get(row);
      if (row && meta) this.queue(row, meta);
    });
    this.panel.addEventListener('focusout', e => {
      if (!this.panel.contains(e.relatedTarget as Node | null)) this.hide();
    });
    // Panel collapse is owned by the shell; never leave an image or pending request behind.
    new MutationObserver(() => this.hide()).observe(this.panel, { attributes: true, attributeFilter: ['class'] });
    new ResizeObserver(() => {
      this.imageWidth();
      if (!this.preview.classList.contains('hidden')) this.position();
    }).observe(this.panel);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') this.hide(); });
    window.addEventListener('blur', () => this.hide());
  }

  bind(row: HTMLElement, meta: CardMetadata): void {
    this.metas.set(row, meta);
    row.addEventListener('mouseenter', () => this.queue(row, meta));
    row.addEventListener('mouseleave', () => this.cancelPending());
    row.addEventListener('focus', () => this.queue(row, meta));
  }

  private cancelPending(): void { window.clearTimeout(this.pending); this.generation++; }
  private leave(): void {
    this.cancelPending();
    window.clearTimeout(this.leaving);
    this.leaving = window.setTimeout(() => this.hide(), 220);
  }

  hide(): void {
    this.cancelPending(); window.clearTimeout(this.leaving);
    this.preview.classList.add('hidden');
    this.row?.classList.remove('previewing'); this.row = null;
  }

  private queue(row: HTMLElement, meta: CardMetadata): void {
    this.cancelPending(); window.clearTimeout(this.leaving);
    this.pending = window.setTimeout(() => this.show(row, meta), 100);
  }

  /** Share the hand's card size with other hovers, even while the hand is collapsed. */
  imageWidth(): number {
    const box = this.panel.getBoundingClientRect();
    if (box.height > 0 && !this.panel.matches('.hidden, .vtt-minimized')) {
      this.lastImageWidth = Math.max(0, Math.min((box.height + 22) / 1.401,
        window.innerWidth - box.right - 20, (window.innerHeight - 16) / 1.401));
    }
    return Math.max(0, Math.min(this.lastImageWidth, window.innerWidth - 24,
      (window.innerHeight - 16) / 1.401));
  }

  private position(): void {
    const box = this.panel.getBoundingClientRect();
    const width = this.imageWidth();
    const height = width * 1.401;
    this.preview.style.width = `${width + 12}px`;
    this.preview.style.height = `${height}px`;
    this.preview.style.left = `${box.right}px`;
    this.preview.style.top = `${Math.max(8, Math.min(window.innerHeight - height - 8, box.bottom - height))}px`;
  }

  private show(row: HTMLElement, meta: CardMetadata): void {
    const token = ++this.generation;
    const current = () => token === this.generation && row.isConnected
      && !this.panel.matches('.hidden, .vtt-minimized');
    const display = (content: HTMLElement) => {
      if (!current()) return;
      this.beforeShow(); this.row?.classList.remove('previewing');
      this.row = row; row.classList.add('previewing');
      this.preview.replaceChildren(content); this.preview.dataset.cardId = String(meta.id);
      this.position(); this.preview.classList.remove('hidden');
    };
    const fallback = () => {
      const body = document.createElement('div'); body.className = 'hand-card-fallback';
      const title = document.createElement('strong'); title.textContent = `#${meta.id} ${meta.name}`;
      const text = document.createElement('p'); text.textContent = meta.description;
      body.append(title, text); display(body);
    };
    const art = cardArtwork(meta.id);
    if (!art) { fallback(); return; }
    const img = document.createElement('img'); img.alt = `#${meta.id} ${meta.name}`;
    img.width = art.width; img.height = art.height; img.draggable = false;
    img.addEventListener('load', () => display(img), { once: true });
    img.addEventListener('error', fallback, { once: true });
    img.src = art.src;
  }
}
