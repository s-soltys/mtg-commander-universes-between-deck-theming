import { Mongo } from "meteor/mongo";
import type { DeckCardDoc, DeckDoc, ThemedDeckCardDoc } from "./types";

export const DecksCollection = new Mongo.Collection<DeckDoc>("decks");
export const DeckCardsCollection = new Mongo.Collection<DeckCardDoc>("deck_cards");
export const ThemedDeckCardsCollection = new Mongo.Collection<ThemedDeckCardDoc>("themed_deck_cards");
