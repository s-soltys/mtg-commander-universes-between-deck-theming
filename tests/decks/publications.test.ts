import { strict as assert } from "node:assert";
import { DeckCardsCollection, DecksCollection } from "/imports/api/decks";
import { findDeckCardsCursorByDeckId, findDeckCursorById } from "/imports/api/decks/publications";

const clearDeckData = async (): Promise<void> => {
  await DeckCardsCollection.removeAsync({});
  await DecksCollection.removeAsync({});
};

describe("deck publications", function () {
  beforeEach(async function () {
    await clearDeckData();
  });

  it("returns requested deck and only its cards", async function () {
    const now = new Date();

    const deckIdA = await DecksCollection.insertAsync({ title: "Deck A", createdAt: now, updatedAt: now });
    const deckIdB = await DecksCollection.insertAsync({ title: "Deck B", createdAt: now, updatedAt: now });

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

  it("returns empty results for invalid deck id", async function () {
    const deckDocs = await findDeckCursorById("missing").fetch();
    const cardDocs = await findDeckCardsCursorByDeckId("missing").fetch();

    assert.deepStrictEqual(deckDocs, []);
    assert.deepStrictEqual(cardDocs, []);
  });
});
