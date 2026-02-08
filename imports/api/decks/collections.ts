import { Mongo } from "meteor/mongo";
import type { DeckCardDoc, DeckDoc } from "./types";

export const DecksCollection = new Mongo.Collection<DeckDoc>("decks");
export const DeckCardsCollection = new Mongo.Collection<DeckCardDoc>("deck_cards");
