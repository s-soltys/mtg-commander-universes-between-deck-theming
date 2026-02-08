import { strict as assert } from "node:assert";
import { DeckCardsCollection, DecksCollection, ThemedDeckCardsCollection } from "/imports/api/decks";
import {
  findDeckCardsCursorByDeckId,
  findDeckCursorById,
  findThemedDeckCardsCursorByDeckId,
} from "/imports/api/decks/publications";

const clearDeckData = async (): Promise<void> => {
  await ThemedDeckCardsCollection.removeAsync({});
  await DeckCardsCollection.removeAsync({});
  await DecksCollection.removeAsync({});
};

describe("deck publications", function () {
  beforeEach(async function () {
    await clearDeckData();
  });

  it("returns requested deck and only its cards", async function () {
    const now = new Date();

    const deckIdA = await DecksCollection.insertAsync({
      title: "Deck A",
      themingStatus: "idle",
      themingThemeUniverse: null,
      themingArtStyleBrief: null,
      themingStartedAt: null,
      themingCompletedAt: null,
      themingError: null,
      createdAt: now,
      updatedAt: now,
    });
    const deckIdB = await DecksCollection.insertAsync({
      title: "Deck B",
      themingStatus: "idle",
      themingThemeUniverse: null,
      themingArtStyleBrief: null,
      themingStartedAt: null,
      themingCompletedAt: null,
      themingError: null,
      createdAt: now,
      updatedAt: now,
    });

    await DeckCardsCollection.insertAsync({
      deckId: deckIdA,
      name: "Arcane Signet",
      quantity: 1,
      imageUrl: null,
      imageSource: "scryfall",
      scryfallId: null,
      createdAt: now,
    });

    await DeckCardsCollection.insertAsync({
      deckId: deckIdB,
      name: "Sol Ring",
      quantity: 1,
      imageUrl: null,
      imageSource: "scryfall",
      scryfallId: null,
      createdAt: now,
    });

    const deckDocs = await findDeckCursorById(deckIdA).fetch();
    const cardDocs = await findDeckCardsCursorByDeckId(deckIdA).fetch();

    assert.strictEqual(deckDocs.length, 1);
    assert.strictEqual(deckDocs[0]._id, deckIdA);
    assert.strictEqual(cardDocs.length, 1);
    assert.strictEqual(cardDocs[0].deckId, deckIdA);
    assert.strictEqual(cardDocs[0].name, "Arcane Signet");
  });

  it("returns themed cards scoped to the requested deck", async function () {
    const now = new Date();

    const deckIdA = await DecksCollection.insertAsync({
      title: "Deck A",
      themingStatus: "completed",
      themingThemeUniverse: "Dune",
      themingArtStyleBrief: "Painterly",
      themingStartedAt: now,
      themingCompletedAt: now,
      themingError: null,
      createdAt: now,
      updatedAt: now,
    });
    const deckIdB = await DecksCollection.insertAsync({
      title: "Deck B",
      themingStatus: "completed",
      themingThemeUniverse: "Dune",
      themingArtStyleBrief: "Painterly",
      themingStartedAt: now,
      themingCompletedAt: now,
      themingError: null,
      createdAt: now,
      updatedAt: now,
    });

    await ThemedDeckCardsCollection.insertAsync({
      deckId: deckIdA,
      originalCardName: "Arcane Signet",
      quantity: 1,
      isBasicLand: false,
      status: "generated",
      themedName: "Guild Beacon",
      themedFlavorText: "Flavor",
      themedConcept: "Concept",
      themedImagePrompt: "Prompt",
      constraintsApplied: ["type-artifact"],
      errorMessage: null,
      createdAt: now,
      updatedAt: now,
    });
    await ThemedDeckCardsCollection.insertAsync({
      deckId: deckIdB,
      originalCardName: "Sol Ring",
      quantity: 1,
      isBasicLand: false,
      status: "generated",
      themedName: "Power Halo",
      themedFlavorText: "Flavor",
      themedConcept: "Concept",
      themedImagePrompt: "Prompt",
      constraintsApplied: ["type-artifact"],
      errorMessage: null,
      createdAt: now,
      updatedAt: now,
    });

    const themedDocs = await findThemedDeckCardsCursorByDeckId(deckIdA).fetch();

    assert.strictEqual(themedDocs.length, 1);
    assert.strictEqual(themedDocs[0].deckId, deckIdA);
    assert.strictEqual(themedDocs[0].originalCardName, "Arcane Signet");
  });

  it("returns empty results for invalid deck id", async function () {
    const deckDocs = await findDeckCursorById("missing").fetch();
    const cardDocs = await findDeckCardsCursorByDeckId("missing").fetch();
    const themedDocs = await findThemedDeckCardsCursorByDeckId("missing").fetch();

    assert.deepStrictEqual(deckDocs, []);
    assert.deepStrictEqual(cardDocs, []);
    assert.deepStrictEqual(themedDocs, []);
  });
});
