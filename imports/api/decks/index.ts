export type {
  DeckCardDoc,
  DeckCreateInput,
  DeckCreateResult,
  DeckDoc,
  DeckThemeStartInput,
  DeckThemeStartResult,
  ParsedDeckCard,
  ParsedDecklist,
  ResolvedCardImage,
  ScryfallCardDetails,
  ThemedDeckCardDoc,
  ThemedDeckCardGeneratedPayload,
} from "./types";

export { DeckCardsCollection, DecksCollection, ThemedDeckCardsCollection } from "./collections";

export const DeckMethodNames = {
  create: "decks.create",
  startTheming: "decks.startTheming",
} as const;

export const DeckPublicationNames = {
  list: "decks.list",
  publicOne: "decks.publicOne",
  cardsByDeck: "deckCards.byDeck",
  themedCardsByDeck: "themedDeckCards.byDeck",
} as const;
