/** Original Hanon TTS counter textures, optional personal resources (not bundled into source). */
const NS = 'http://www.w3.org/2000/svg';
export type CounterArt = 'influence-us' | 'influence-ussr' | 'turn' | 'vp' | 'space-us' | 'space-ussr'
  | 'action-round' | 'defcon' | 'mil-us' | 'mil-ussr';

/** Crop the top/bottom UV face in SVG; preserve the original 2048px texture byte-for-byte. */
export function counterArt(name: CounterArt, x: number, y: number, size: number,
                           back = false, rotate = false): SVGSVGElement {
  const svg = document.createElementNS(NS, 'svg');
  const faceY = back ? 1136 : 132;
  const attrs = { x, y, width: size, height: size, viewBox: `605 ${faceY} 891 891`,
    preserveAspectRatio: 'xMidYMid meet', class: 'counter-art', 'data-asset': name,
    'data-face': back ? 'back' : 'front', 'pointer-events': 'none', overflow: 'hidden' };
  for (const [key, value] of Object.entries(attrs)) svg.setAttribute(key, String(value));
  const image = document.createElementNS(NS, 'image');
  image.setAttribute('href', `${import.meta.env.BASE_URL}personal/counters/${name}.png`);
  image.setAttribute('width', '2048'); image.setAttribute('height', '2048');
  if (rotate) image.setAttribute('transform', `rotate(180 1050.5 ${faceY + 445.5})`);
  // Without the optional pack, the existing vector counter beneath the image stays visible.
  image.addEventListener('error', () => svg.remove());
  svg.append(image);
  return svg;
}
