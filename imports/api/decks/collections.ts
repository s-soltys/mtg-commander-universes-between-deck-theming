import { Mongo } from "meteor/mongo";
import type { AppSettingsDoc, AppSettingsPublicDoc, DeckCardDoc, DeckDoc, ThemedDeckCardDoc } from "./types";

export const DecksCollection = new Mongo.Collection<DeckDoc>("decks");
export const DeckCardsCollection = new Mongo.Collection<DeckCardDoc>("deck_cards");
export const ThemedDeckCardsCollection = new Mongo.Collection<ThemedDeckCardDoc>("themed_deck_cards");
export const AppSettingsCollection = new Mongo.Collection<AppSettingsDoc>("app_settings");
export const AppSettingsPublicCollection = new Mongo.Collection<AppSettingsPublicDoc>("app_settings_public");
