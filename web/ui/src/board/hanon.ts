import layout from './hanon-layout.json';

/** Image coordinates only. Never change rule metadata or engine country IDs. */
export const HANON = layout;
export const BOARD_RECTS = new Map(layout.countries.map(c => [c.id, c.rect]));
export function boardCenter(id: number): [number, number] {
  const r = BOARD_RECTS.get(id);
  if (!r) throw new Error(`Missing board position for country ${id}`);
  return [r[0] + r[2] / 2, r[1] + r[3] / 2];
}

// Small live badges sit on the printed region headings; the full summary opens on click.
export const BOARD_REGIONS: Record<number, [number, number]> = {
  0: [455, 30], 1: [749, 256], 2: [650, 327], 3: [394, 398],
  4: [232, 268], 5: [232, 424], 6: [761, 382],
};
