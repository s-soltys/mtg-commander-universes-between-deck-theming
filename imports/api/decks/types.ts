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
