import { Meteor } from "meteor/meteor";
import { toAppSettingsPublicDoc } from "./appSettings";
import { AppSettingsCollection, DeckCardsCollection, DecksCollection, ThemedDeckCardsCollection } from "./collections";

export const findDeckCursorById = (deckId: string) => DecksCollection.find({ _id: deckId });

export const findDecksCursor = () => DecksCollection.find({}, { sort: { updatedAt: -1, createdAt: -1 } });

export const findDeckCardsCursorByDeckId = (deckId: string) =>
  DeckCardsCollection.find({ deckId }, { sort: { name: 1 } });

export const findThemedDeckCardsCursorByDeckId = (deckId: string) =>
  ThemedDeckCardsCollection.find({ deckId }, { sort: { originalCardName: 1 } });

export const findAppSettingsCursor = () => AppSettingsCollection.find({ _id: "global" });

export const registerDeckPublications = (): void => {
  Meteor.publish("decks.list", function publishDecksList() {
    return findDecksCursor();
  });

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

  Meteor.publish("appSettings.public", function publishAppSettingsPublic() {
    this.added("app_settings_public", "global", {
      hasOpenAIApiKey: false,
      maskedOpenAIApiKey: null,
      updatedAt: null,
    });
    this.ready();

    const publishCurrentDoc = async () => {
      const settings = await AppSettingsCollection.findOneAsync({ _id: "global" });
      const publicDoc = toAppSettingsPublicDoc(settings);
      this.changed("app_settings_public", "global", {
        hasOpenAIApiKey: publicDoc.hasOpenAIApiKey,
        maskedOpenAIApiKey: publicDoc.maskedOpenAIApiKey,
        updatedAt: publicDoc.updatedAt,
      });
    };

    void publishCurrentDoc();

    const handle = findAppSettingsCursor().observeChanges({
      added: async () => {
        const settings = await AppSettingsCollection.findOneAsync({ _id: "global" });
        const publicDoc = toAppSettingsPublicDoc(settings);
        this.changed("app_settings_public", "global", {
          hasOpenAIApiKey: publicDoc.hasOpenAIApiKey,
          maskedOpenAIApiKey: publicDoc.maskedOpenAIApiKey,
          updatedAt: publicDoc.updatedAt,
        });
      },
      changed: async () => {
        const settings = await AppSettingsCollection.findOneAsync({ _id: "global" });
        const publicDoc = toAppSettingsPublicDoc(settings);
        this.changed("app_settings_public", "global", {
          hasOpenAIApiKey: publicDoc.hasOpenAIApiKey,
          maskedOpenAIApiKey: publicDoc.maskedOpenAIApiKey,
          updatedAt: publicDoc.updatedAt,
        });
      },
      removed: () => {
        this.changed("app_settings_public", "global", {
          hasOpenAIApiKey: false,
          maskedOpenAIApiKey: null,
          updatedAt: null,
        });
      },
    });

    return () => handle.stop();
  });
};
