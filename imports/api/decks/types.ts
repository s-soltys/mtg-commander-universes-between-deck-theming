export interface DeckDoc {
  _id?: string;
  title: string;
  themingStatus: DeckThemingStatus;
  themingThemeUniverse: string | null;
  themingArtStyleBrief: string | null;
  themingStartedAt: Date | null;
  themingCompletedAt: Date | null;
  themingError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type DeckThemingStatus = "idle" | "running" | "completed" | "failed";

export interface DeckCardDoc {
  _id?: string;
  deckId: string;
  name: string;
  quantity: number;
  imageUrl: string | null;
  imageSource: "scryfall";
  scryfallId: string | null;
  createdAt: Date;
}

export interface DeckCreateInput {
  title: string;
  decklistText: string;
}

export interface DeckCreateResult {
  deckId: string;
  cardCount: number;
  unresolvedCardNames: string[];
}

export interface DeckCopyInput {
  sourceDeckId: string;
  title: string;
}

export interface DeckCopyResult {
  deckId: string;
  cardCount: number;
}

export interface DeckDeleteInput {
  deckId: string;
}

export interface DeckDeleteResult {
  deckId: string;
}

export interface DeckThemeStartInput {
  deckId: string;
  themeUniverse: string;
  artStyleBrief: string;
  confirmDiscardPrevious: boolean;
}

export interface DeckThemeStartResult {
  deckId: string;
  themingStatus: DeckThemingStatus;
}

export interface ParsedDeckCard {
  name: string;
  quantity: number;
}

export interface ParsedDecklist {
  cards: ParsedDeckCard[];
  ignoredLines: string[];
  invalidLines: string[];
}

export interface ResolvedCardImage {
  scryfallId: string | null;
  imageUrl: string | null;
}

export type ThemedDeckCardStatus = "pending" | "generated" | "failed" | "skipped";
export type ThemedDeckCardImageStatus = "idle" | "generated" | "failed";
export type ThemedDeckCardCompositeStatus = "idle" | "generating" | "generated" | "failed";

export interface ThemedDeckCardDoc {
  _id?: string;
  deckId: string;
  originalCardName: string;
  quantity: number;
  isBasicLand: boolean;
  status: ThemedDeckCardStatus;
  themedName: string | null;
  themedFlavorText: string | null;
  themedConcept: string | null;
  themedImagePrompt: string | null;
  themedGeneratedImageUrl?: string | null;
  themedGeneratedImageStatus?: ThemedDeckCardImageStatus;
  themedGeneratedImageError?: string | null;
  themedGeneratedImageUpdatedAt?: Date | null;
  themedCompositeImageUrl?: string | null;
  themedCompositeImageStatus?: ThemedDeckCardCompositeStatus;
  themedCompositeImageError?: string | null;
  themedCompositeImageUpdatedAt?: Date | null;
  constraintsApplied: string[];
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ScryfallCardDetails {
  scryfallId: string | null;
  oracleText: string | null;
  typeLine: string | null;
  manaCost: string | null;
  isLegendary: boolean;
  isBasicLand: boolean;
}

export interface ThemedDeckCardGeneratedPayload {
  originalCardName: string;
  themedName: string;
  themedFlavorText: string;
  themedConcept: string;
  themedImagePrompt: string;
  constraintsApplied: string[];
}

export interface DeckThemeImagesGenerateInput {
  deckId: string;
  forceRegenerate: boolean;
}

export interface DeckThemeImagesGenerateResult {
  deckId: string;
  generatedCount: number;
  failedCount: number;
  skippedCount: number;
}

export interface DeckThemeImageGenerateForCardInput {
  deckId: string;
  originalCardName: string;
  themedName: string;
  themedImagePrompt: string;
  forceRegenerate: boolean;
}

export interface DeckThemeImageGenerateForCardResult {
  deckId: string;
  originalCardName: string;
  generated: boolean;
  imageUrl: string | null;
}

export interface DeckThemeCardCompositeGenerateForCardInput {
  deckId: string;
  originalCardName: string;
  themedName: string;
  forceRegenerate: boolean;
}

export interface DeckThemeCardCompositeGenerateForCardResult {
  deckId: string;
  originalCardName: string;
  started: boolean;
}

export interface AppSettingsDoc {
  _id?: string;
  openAIApiKey: string | null;
  updatedAt: Date;
}

export interface AppSettingsPublicDoc {
  _id?: string;
  hasOpenAIApiKey: boolean;
  maskedOpenAIApiKey: string | null;
  updatedAt: Date | null;
}

export interface AppSettingsSetOpenAIKeyInput {
  openAIApiKey: string;
}

export interface AppSettingsSetOpenAIKeyResult {
  hasOpenAIApiKey: true;
  maskedOpenAIApiKey: string;
  updatedAt: Date;
}

export interface AppSettingsClearOpenAIKeyResult {
  hasOpenAIApiKey: false;
  maskedOpenAIApiKey: null;
  updatedAt: Date;
}
