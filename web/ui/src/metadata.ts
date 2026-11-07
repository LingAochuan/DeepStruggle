/**
 * The map and the card list, bundled into the page from rules/ -- the formal spec the engine
 * implements -- so the workbench needs no server to draw a board. (Names in the action log come
 * from the engine itself; these are for layout, tooltips and rules text.)
 */
import mapJson from "../../../rules/map.json";
import cardsJson from "../../../rules/cards.json";
import { CardMetadata, MapMetadata } from "./types";
import { cardName, cardDescription } from "./i18n";

export const MAP_METADATA = mapJson as unknown as MapMetadata;
/** Keep raw English names available for replay matching and bilingual search. */
export const ENGLISH_CARDS_METADATA = cardsJson as unknown as CardMetadata[];
export const CARDS_METADATA: CardMetadata[] = ENGLISH_CARDS_METADATA.map(card => ({
  ...card,
  get name() { return cardName(card.id, card.name); },
  get description() { return cardDescription(card.id, card.description); },
}));
