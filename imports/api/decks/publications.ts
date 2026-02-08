import { Meteor } from "meteor/meteor";
import { DeckCardsCollection, DecksCollection, ThemedDeckCardsCollection } from "./collections";

export const findDeckCursorById = (deckId: string) => DecksCollection.find({ _id: deckId });

export const findDeckCardsCursorByDeckId = (deckId: string) =>
  DeckCardsCollection.find({ deckId }, { sort: { name: 1 } });

export const findThemedDeckCardsCursorByDeckId = (deckId: string) =>
  ThemedDeckCardsCollection.find({ deckId }, { sort: { originalCardName: 1 } });

export const registerDeckPublications = (): void => {
  Meteor.publish("decks.publicOne", function publishDeck(deckId: string) {
    if (typeof deckId !== "string" || deckId.length === 0) {
      return DecksCollection.find({ _id: null });
    }

    return findDeckCursorById(deckId);
  });

  Meteor.publish("deckCards.byDeck", function publishDeckCards(deckId: string) {
    if (typeof deckId !== "string" || deckId.length === 0) {
      return DeckCardsCollection.find({ _id: null });
    }

    return findDeckCardsCursorByDeckId(deckId);
  });

  Meteor.publish("themedDeckCards.byDeck", function publishThemedDeckCards(deckId: string) {
    if (typeof deckId !== "string" || deckId.length === 0) {
      return ThemedDeckCardsCollection.find({ _id: null });
    }

    return findThemedDeckCardsCursorByDeckId(deckId);
  });
};
