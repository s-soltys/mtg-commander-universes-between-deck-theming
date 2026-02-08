import { strict as assert } from "node:assert";
import { DeckCardsCollection, DecksCollection } from "/imports/api/decks";
import {
  __resetCardImageResolverForTests,
  __setCardImageResolverForTests,
  createDeck,
} from "/imports/api/decks/methods";
import type { ResolvedCardImage } from "/imports/api/decks";

const clearDeckData = async (): Promise<void> => {
  await DeckCardsCollection.removeAsync({});
  await DecksCollection.removeAsync({});
};

describe("createDeck", function () {
  beforeEach(async function () {
    await clearDeckData();
  });

  afterEach(function () {
    __resetCardImageResolverForTests();
  });

  it("creates one deck and unique card rows with quantities", async function () {
    const resolver = async (name: string): Promise<ResolvedCardImage | null> => ({
      scryfallId: `id-${name}`,
      imageUrl: `https://img/${encodeURIComponent(name)}`,
    });

    __setCardImageResolverForTests(resolver);

    const result = await createDeck({
      title: "My Deck",
      decklistText: "1 Sol Ring\n2 Sol Ring\n1 Arcane Signet",
    });

    const deck = await DecksCollection.findOneAsync({ _id: result.deckId });
    const cards = await DeckCardsCollection.find({ deckId: result.deckId }).fetch();

    assert.ok(deck);
    assert.strictEqual(cards.length, 2);
    assert.deepStrictEqual(
      cards
        .map((card) => ({ name: card.name, quantity: card.quantity }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      [
        { name: "Arcane Signet", quantity: 1 },
        { name: "Sol Ring", quantity: 3 },
      ],
    );
    assert.strictEqual(result.cardCount, 4);
    assert.deepStrictEqual(result.unresolvedCardNames, []);
  });

  it("throws on empty or invalid-only decklist", async function () {
    await assert.rejects(
      createDeck({ title: "Deck", decklistText: "" }),
      (error: unknown) => error instanceof Error,
    );

    await assert.rejects(
      createDeck({ title: "Deck", decklistText: "not a card" }),
      (error: unknown) => error instanceof Error,
    );
  });

  it("stores unresolved cards with null image data", async function () {
    __setCardImageResolverForTests(async (name: string) => {
      if (name === "Sol Ring") {
        return {
          scryfallId: "sol-ring-id",
          imageUrl: "https://img/sol-ring",
        };
      }

      return null;
    });

    const result = await createDeck({
      title: "My Deck",
      decklistText: "1 Sol Ring\n1 Totally Fake Card",
    });

    const unresolved = DeckCardsCollection.findOneAsync({
      deckId: result.deckId,
      name: "Totally Fake Card",
    });

    assert.deepStrictEqual(result.unresolvedCardNames, ["Totally Fake Card"]);
    await assert.doesNotReject(unresolved);
    const unresolvedCard = await unresolved;
    assert.ok(unresolvedCard);
    assert.strictEqual(unresolvedCard?.imageUrl, null);
    assert.strictEqual(unresolvedCard?.scryfallId, null);
  });
});
