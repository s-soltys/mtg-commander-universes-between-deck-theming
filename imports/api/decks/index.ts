export type {
  DeckCardDoc,
  DeckCreateInput,
  DeckCreateResult,
  DeckDoc,
  ParsedDeckCard,
  ParsedDecklist,
  ResolvedCardImage,
} from "./types";

export { DeckCardsCollection, DecksCollection } from "./collections";

export const DeckMethodNames = {
  create: "decks.create",
} as const;

export const DeckPublicationNames = {
  publicOne: "decks.publicOne",
  cardsByDeck: "deckCards.byDeck",
} as const;
