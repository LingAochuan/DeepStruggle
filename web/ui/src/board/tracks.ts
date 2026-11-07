import { GameState } from '../types';
import { t, label } from '../i18n';
import positions from './track-layout.json';
import { counterArt, CounterArt } from './counter-art';

const NS = 'http://www.w3.org/2000/svg';
const COLORS = { US: '#244d83', USSR: '#9d302c', neutral: '#38342e' };
function node<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}): SVGElementTagNameMap[K] {
  const el = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, String(value));
  return el;
}
function text(value: string, x: number, y: number, size = 5): SVGTextElement {
  const el = node('text', { x, y, fill: '#f3eee1', 'font-size': size, 'font-family': 'Arial, sans-serif',
    'font-weight': 700, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'pointer-events': 'none' });
  el.textContent = value;
  return el;
}
function title(el: SVGElement, value: string) {
  const title = node('title'); title.textContent = value; el.append(title);
  el.setAttribute('aria-label', value);
}
function position(track: number[][], value: number, min: number): number[] {
  return track[Math.max(0, Math.min(track.length - 1, Math.trunc(value) - min))];
}
function marker(parent: SVGGElement, track: string, value: number, at: number[], caption: string, side: keyof typeof COLORS = 'neutral', dy = 0) {
  const [x, y] = at;
  const art: CounterArt = track === 'action-round' ? 'action-round' : track.startsWith('space-')
    ? `space-${side === 'US' ? 'us' : 'ussr'}` : track.startsWith('mil-ops-')
    ? `mil-${side === 'US' ? 'us' : 'ussr'}` : track as CounterArt;
  const size = track === 'action-round' ? 20 : track === 'turn' ? 30 : track === 'vp' ? 25
    : track.startsWith('space-') ? 28 : 27;
  const g = node('g', { class: `board-track-marker ${side.toLowerCase()}`, 'data-track': track,
    'data-value': value, transform: `translate(${x + dy},${y + dy})`, role: 'img' });
  title(g, caption);
  g.append(node('rect', { x: -7.5, y: -7.5, width: 15, height: 15, rx: 1,
    fill: '#000', opacity: 0.25, transform: 'translate(1,1)' }));
  g.append(node('rect', { x: -7.5, y: -7.5, width: 15, height: 15, rx: 1,
    fill: COLORS[side], stroke: '#f2ddaf', 'stroke-width': 0.8 }));
  // The small side label keeps co-located counters identifiable without relying on colour.
  if (side !== 'neutral') {
    g.append(text(label(side), 0, -3.5, 3.1));
    g.append(text(String(value), 0, 2.7, 7));
  } else g.append(text(String(value), 0, 0, 8));
  g.append(counterArt(art, -size / 2, -size / 2, size,
    track === 'action-round' && side === 'US', track.startsWith('space-')));
  parent.append(g);
}
function plate(parent: SVGGElement, x: number, y: number, width: number, value: string) {
  const g = node('g');
  g.append(node('rect', { x: x - width / 2, y: y - 5, width, height: 10, rx: 1,
    fill: '#242320', 'fill-opacity': 0.88, stroke: '#9c8e73', 'stroke-width': 0.4 }));
  const txt = text(value, x, y, 6);
  if (value.length > width / 5) { txt.setAttribute('textLength', String(width - 5)); txt.setAttribute('lengthAdjust', 'spacingAndGlyphs'); }
  g.append(txt); parent.append(g);
}

/** All track coordinates are presentation data; values come directly from the viewed snapshot. */
export function renderBoardTracks(svg: SVGSVGElement, state: GameState, classic: boolean, showSpace: () => void) {
  const g = node('g', { id: 'board-tracks' });
  const turn = state.turn ?? 1, defcon = state.defcon ?? 5, vp = state.victory_points ?? 0;
  const phase = label(state.current_phase_name || '');
  const side = label(state.decision_context?.decision_player || state.phasing_player || '');
  const era = t(turn <= 3 ? 'Early War' : turn <= 7 ? 'Mid War' : 'Late War');
  if (classic) {
    marker(g, 'turn', turn, position(positions.turn, turn, 1), `${t('Turn')} ${turn} · ${era}`);
    marker(g, 'defcon', defcon, position(positions.defcon, defcon, 1), `DEFCON ${defcon}`);
    marker(g, 'vp', vp, position(positions.victoryPoints, vp, -20), `${t('Victory Points')} ${vp}`);
    if (state.current_phase === 2 && state.action_round > 0) {
      marker(g, 'action-round', state.action_round, position(positions.actionRound, state.action_round, 1),
        `${t('Action Round')} ${state.action_round} · ${side}`, state.phasing_player === 'US' ? 'US' : 'USSR');
    }
    const required = position(positions.milOps, defcon, 0);
    const ring = node('rect', { x: required[0] - 13, y: required[1] - 13, width: 26, height: 26,
      fill: 'none', stroke: '#f7d276', 'stroke-width': 1.5, 'stroke-dasharray': '3 1',
      'data-track': 'mil-ops-required', 'data-value': defcon });
    title(ring, `${t('Required Military Operations')}: ${defcon}`); g.append(ring);
    for (const p of ['US', 'USSR'] as const) {
      const mil = state.mil_ops?.[p] ?? 0, space = state.space?.[p] ?? 0;
      const offset = p === 'US' ? -4 : 4;
      marker(g, `mil-ops-${p}`, mil, position(positions.milOps, mil, 0), `${label(p)} · ${t('Military Operations')}: ${mil} / ${defcon}`, p,
        state.mil_ops?.US === state.mil_ops?.USSR ? offset : 0);
      marker(g, `space-${p}`, space, position(positions.space, space, 0), `${label(p)} · ${t('Space Race')}: ${space}`, p,
        state.space?.US === state.space?.USSR ? offset : 0);
    }
    const spaceHit = node('rect', { x: 678, y: 97, width: 300, height: 38, fill: 'transparent',
      role: 'button', tabindex: 0, class: 'board-space-details', style: 'cursor:pointer' });
    title(spaceHit, `${t('Space Race')} · ${label('US')} ${state.space?.US ?? 0} · ${label('USSR')} ${state.space?.USSR ?? 0}`);
    spaceHit.addEventListener('click', showSpace);
    spaceHit.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); showSpace(); } });
    g.append(spaceHit);
  } else {
    // The schematic has no printed tracks. Its compact footer moves with the map too.
    plate(g, 500, 618, 620, `${t('Turn')} ${turn} · ${era} · ${phase} · ${side} · ${t('Action Round')} ${state.action_round} · DEFCON ${defcon} · ${t('Victory Points')} ${vp}`);
    plate(g, 500, 632, 620, `${t('Military Operations')} ${label('US')} ${state.mil_ops?.US ?? 0} / ${label('USSR')} ${state.mil_ops?.USSR ?? 0} (${defcon}) · ${t('Space Race')} ${label('US')} ${state.space?.US ?? 0} / ${label('USSR')} ${state.space?.USSR ?? 0}`);
    g.setAttribute('role', 'button'); g.setAttribute('tabindex', '0');
    title(g, t('Space Race')); g.style.cursor = 'pointer';
    g.addEventListener('click', showSpace);
    g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); showSpace(); } });
  }
  svg.append(g);
}
