import { Meteor } from "meteor/meteor";
import { DeckCardsCollection, DecksCollection, ThemedDeckCardsCollection } from "./collections";
import { parseDecklist } from "./parser";
import { resolveCardFromScryfall } from "./scryfall";
import { startDeckTheming } from "./theming";
import type {
  DeckCopyInput,
  DeckCopyResult,
  DeckDeleteInput,
  DeckDeleteResult,
  DeckCreateInput,
  DeckCreateResult,
  DeckThemeStartInput,
  DeckThemeStartResult,
  ResolvedCardImage,
} from "./types";

type CardImageResolver = (cardName: string) => Promise<ResolvedCardImage | null>;

let cardImageResolver: CardImageResolver = resolveCardFromScryfall;

const validateDeckCreateInput = ({ title, decklistText }: DeckCreateInput): void => {
  if (title.trim().length === 0) {
    throw new Meteor.Error("invalid-title", "Title is required.");
  }

  if (decklistText.trim().length === 0) {
    throw new Meteor.Error("invalid-decklist", "Deck list text is required.");
  }
};

const validateDeckCopyInput = ({ sourceDeckId, title }: DeckCopyInput): void => {
  if (typeof sourceDeckId !== "string" || sourceDeckId.trim().length === 0) {
    throw new Meteor.Error("invalid-deck-id", "Source deck id is required.");
  }

  if (title.trim().length === 0) {
    throw new Meteor.Error("invalid-title", "Title is required.");
  }
};

const validateDeckDeleteInput = ({ deckId }: DeckDeleteInput): void => {
  if (typeof deckId !== "string" || deckId.trim().length === 0) {
    throw new Meteor.Error("invalid-deck-id", "Deck id is required.");
  }
};

export const createDeck = async ({ title, decklistText }: DeckCreateInput): Promise<DeckCreateResult> => {
  validateDeckCreateInput({ title, decklistText });

  const parsedDeck = parseDecklist(decklistText);

  if (parsedDeck.cards.length === 0) {
    throw new Meteor.Error("invalid-decklist", "No parseable cards found in deck list.");
  }

  const now = new Date();
  const deckId = await DecksCollection.insertAsync({
    title: title.trim(),
    themingStatus: "idle",
    themingThemeUniverse: null,
    themingArtStyleBrief: null,
    themingStartedAt: null,
    themingCompletedAt: null,
    themingError: null,
    createdAt: now,
    updatedAt: now,
  });

  const unresolvedCardNames: string[] = [];

  for (const card of parsedDeck.cards) {
    const resolved = await cardImageResolver(card.name);

    if (!resolved) {
      unresolvedCardNames.push(card.name);
    }

    await DeckCardsCollection.insertAsync({
      deckId,
      name: card.name,
      quantity: card.quantity,
      imageSource: "scryfall",
      scryfallId: resolved?.scryfallId ?? null,
      imageUrl: resolved?.imageUrl ?? null,
      createdAt: now,
    });
  }

  return {
    deckId,
    cardCount: parsedDeck.cards.reduce((sum, card) => sum + card.quantity, 0),
    unresolvedCardNames,
  };
};

export const startDeckThemingMethod = async (
  input: DeckThemeStartInput,
): Promise<DeckThemeStartResult> => startDeckTheming(input);

export const copyDeck = async ({ sourceDeckId, title }: DeckCopyInput): Promise<DeckCopyResult> => {
  validateDeckCopyInput({ sourceDeckId, title });

  const sourceDeckIdValue = sourceDeckId.trim();
  const sourceDeck = await DecksCollection.findOneAsync({ _id: sourceDeckIdValue });
  if (!sourceDeck) {
    throw new Meteor.Error("deck-not-found", "Deck not found.");
  }

  const sourceCards = await DeckCardsCollection.find({ deckId: sourceDeckIdValue }).fetch();
  const now = new Date();
  const deckId = await DecksCollection.insertAsync({
    title: title.trim(),
    themingStatus: "idle",
    themingThemeUniverse: null,
    themingArtStyleBrief: null,
    themingStartedAt: null,
    themingCompletedAt: null,
    themingError: null,
    createdAt: now,
    updatedAt: now,
  });

  for (const card of sourceCards) {
    await DeckCardsCollection.insertAsync({
      deckId,
      name: card.name,
      quantity: card.quantity,
      imageSource: card.imageSource,
      scryfallId: card.scryfallId,
      imageUrl: card.imageUrl,
      createdAt: now,
    });
  }

  return {
    deckId,
    cardCount: sourceCards.reduce((sum, card) => sum + card.quantity, 0),
  };
};

export const deleteDeck = async ({ deckId }: DeckDeleteInput): Promise<DeckDeleteResult> => {
  validateDeckDeleteInput({ deckId });

  const deckIdValue = deckId.trim();
  const existingDeck = await DecksCollection.findOneAsync({ _id: deckIdValue });
  if (!existingDeck) {
    throw new Meteor.Error("deck-not-found", "Deck not found.");
  }

  await ThemedDeckCardsCollection.removeAsync({ deckId: deckIdValue });
  await DeckCardsCollection.removeAsync({ deckId: deckIdValue });
  await DecksCollection.removeAsync({ _id: deckIdValue });

  return { deckId: deckIdValue };
};

export const registerDeckMethods = (): void => {
  Meteor.methods({
    "decks.copy": copyDeck,
    "decks.delete": deleteDeck,
    "decks.create": createDeck,
    "decks.startTheming": startDeckThemingMethod,
  });
};

export const __setCardImageResolverForTests = (resolver: CardImageResolver): void => {
  cardImageResolver = resolver;
};

export const __resetCardImageResolverForTests = (): void => {
  cardImageResolver = resolveCardFromScryfall;
};
