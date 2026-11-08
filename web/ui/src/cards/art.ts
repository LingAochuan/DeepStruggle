import manifest from './hanon-art.json';

const cards: Record<string, { file: string; width: number; height: number }> = manifest.cards;

/** Optional, display-only artwork. Never infer a card identity from hidden game state. */
export function cardArtwork(id: number): { src: string; width: number; height: number } | undefined {
  const card = cards[String(id)];
  return card ? { src: `${import.meta.env.BASE_URL}personal/cards/${card.file}`, width: card.width, height: card.height } : undefined;
}
