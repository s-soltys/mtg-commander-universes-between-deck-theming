export type {
  DeckCardDoc,
  DeckCopyInput,
  DeckCopyResult,
  DeckDeleteInput,
  DeckDeleteResult,
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
  copy: "decks.copy",
  delete: "decks.delete",
  create: "decks.create",
  startTheming: "decks.startTheming",
} as const;

export const DeckPublicationNames = {
  list: "decks.list",
  publicOne: "decks.publicOne",
  cardsByDeck: "deckCards.byDeck",
  themedCardsByDeck: "themedDeckCards.byDeck",
} as const;
