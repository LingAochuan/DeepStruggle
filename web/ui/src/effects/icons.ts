import sources from './steam-icons.json';

const flags: Record<string, string> = sources.flags;
const space: Record<string, string> = sources.space;
export const flagIcon = (flag: string): string | undefined => flags[flag];
export const spaceIcon = (box: number): string | undefined => space[String(box)];

/** Optional personal sprites keep their original alpha; the shell provides the button. */
export function effectIcon(name?: string): HTMLSpanElement {
  const holder = document.createElement('span');
  holder.className = 'vtt-effect-art';
  holder.setAttribute('aria-hidden', 'true');
  const img = document.createElement('img');
  img.src = `${import.meta.env.BASE_URL}personal/effects/${name ?? sources.fallback}.png`;
  img.alt = ''; img.draggable = false;
  img.addEventListener('error', () => {
    // Source-only builds and missing sprites retain an identifiable, clickable control.
    holder.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4m0 3v1"/></svg>';
  });
  holder.append(img);
  return holder;
}
