export interface DeckDoc {
  _id?: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

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
