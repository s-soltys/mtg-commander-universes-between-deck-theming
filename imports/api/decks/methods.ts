import { Meteor } from "meteor/meteor";
import { DeckCardsCollection, DecksCollection } from "./collections";
import { parseDecklist } from "./parser";
import { resolveCardFromScryfall } from "./scryfall";
import type { DeckCreateInput, DeckCreateResult, ResolvedCardImage } from "./types";

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

export const createDeck = async ({ title, decklistText }: DeckCreateInput): Promise<DeckCreateResult> => {
  validateDeckCreateInput({ title, decklistText });

  const parsedDeck = parseDecklist(decklistText);

  if (parsedDeck.cards.length === 0) {
    throw new Meteor.Error("invalid-decklist", "No parseable cards found in deck list.");
  }

  const now = new Date();
  const deckId = await DecksCollection.insertAsync({
    title: title.trim(),
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

export const registerDeckMethods = (): void => {
  Meteor.methods({
    "decks.create": createDeck,
  });
};

export const __setCardImageResolverForTests = (resolver: CardImageResolver): void => {
  cardImageResolver = resolver;
};

export const __resetCardImageResolverForTests = (): void => {
  cardImageResolver = resolveCardFromScryfall;
};
