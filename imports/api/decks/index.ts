export type {
  AppSettingsClearOpenAIKeyResult,
  AppSettingsPublicDoc,
  AppSettingsSetOpenAIKeyInput,
  AppSettingsSetOpenAIKeyResult,
  DeckCardDoc,
  DeckCopyInput,
  DeckCopyResult,
  DeckDeleteInput,
  DeckDeleteResult,
  DeckCreateInput,
  DeckCreateResult,
  DeckDoc,
  DeckThemeImagesGenerateInput,
  DeckThemeImageGenerateForCardInput,
  DeckThemeImageGenerateForCardResult,
  DeckThemeImagesGenerateResult,
  DeckThemeStartInput,
  DeckThemeStartResult,
  ParsedDeckCard,
  ParsedDecklist,
  ResolvedCardImage,
  ScryfallCardDetails,
  ThemedDeckCardDoc,
  ThemedDeckCardGeneratedPayload,
} from "./types";

export {
  AppSettingsCollection,
  AppSettingsPublicCollection,
  DeckCardsCollection,
  DecksCollection,
  ThemedDeckCardsCollection,
} from "./collections";

export const DeckMethodNames = {
  copy: "decks.copy",
  delete: "decks.delete",
  create: "decks.create",
  startTheming: "decks.startTheming",
  generateThemedImages: "decks.generateThemedImages",
  generateThemedImageForCard: "decks.generateThemedImageForCard",
  setOpenAIKey: "appSettings.setOpenAIKey",
  clearOpenAIKey: "appSettings.clearOpenAIKey",
} as const;

export const DeckPublicationNames = {
  list: "decks.list",
  publicOne: "decks.publicOne",
  cardsByDeck: "deckCards.byDeck",
  themedCardsByDeck: "themedDeckCards.byDeck",
  appSettingsPublic: "appSettings.public",
} as const;
