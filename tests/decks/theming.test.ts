import { strict as assert } from "node:assert";
import { DeckCardsCollection, DecksCollection, ThemedDeckCardsCollection } from "/imports/api/decks";
import {
  __resetCardImageResolverForTests,
  __setCardImageResolverForTests,
  createDeck,
  startDeckThemingMethod,
} from "/imports/api/decks/methods";
import {
  __resetCardDetailsResolverForTests,
  __resetOpenAIThemerForTests,
  __setCardDetailsResolverForTests,
  __setOpenAIThemerForTests,
} from "/imports/api/decks/theming";
import type { ResolvedCardImage, ScryfallCardDetails, ThemedDeckCardGeneratedPayload } from "/imports/api/decks";

const clearDeckData = async (): Promise<void> => {
  await ThemedDeckCardsCollection.removeAsync({});
  await DeckCardsCollection.removeAsync({});
  await DecksCollection.removeAsync({});
};

describe("deck theming", function () {
  beforeEach(async function () {
    await clearDeckData();
  });

  afterEach(function () {
    __resetCardImageResolverForTests();
    __resetCardDetailsResolverForTests();
    __resetOpenAIThemerForTests();
  });

  it("marks Scryfall-missing cards as failed and still completes run", async function () {
    __setCardImageResolverForTests(async (name: string): Promise<ResolvedCardImage | null> => ({
      scryfallId: `${name}-id`,
      imageUrl: `https://img/${encodeURIComponent(name)}`,
    }));

    __setCardDetailsResolverForTests(async (name: string): Promise<ScryfallCardDetails | null> => {
      if (name === "Unknown Card") {
        return null;
      }

      return {
        scryfallId: `${name}-scryfall-id`,
        oracleText: "Target spell gets better.",
        typeLine: "Artifact",
        manaCost: "{2}",
        isLegendary: false,
        isBasicLand: false,
      };
    });

    __setOpenAIThemerForTests(async (): Promise<ThemedDeckCardGeneratedPayload[]> => [
      {
        originalCardName: "Arcane Signet",
        themedName: "Order Sigil",
        themedFlavorText: "A shard tuned to imperial cadence.",
        themedConcept: "Ornate metal sigil with etched symbols and pale glow.",
        themedImagePrompt: "Detailed fantasy sigil of brass and ivory, soft magical light, plain backdrop.",
        constraintsApplied: ["type-coherent"],
      },
    ]);

    const created = await createDeck({
      title: "Deck",
      decklistText: "1 Arcane Signet\n1 Unknown Card",
    });

    const result = await startDeckThemingMethod({
      deckId: created.deckId,
      themeUniverse: "The Witcher",
      artStyleBrief: "Dark realism",
      confirmDiscardPrevious: false,
    });

    assert.strictEqual(result.themingStatus, "completed");

    const themedCards = await ThemedDeckCardsCollection.find({ deckId: created.deckId }).fetch();
    const failedCard = themedCards.find((card) => card.originalCardName === "Unknown Card");
    const generatedCard = themedCards.find((card) => card.originalCardName === "Arcane Signet");

    assert.ok(failedCard);
    assert.strictEqual(failedCard?.status, "failed");
    assert.strictEqual(failedCard?.errorMessage, "Scryfall metadata unavailable.");

    assert.ok(generatedCard);
    assert.strictEqual(generatedCard?.status, "generated");
    assert.ok(generatedCard?.constraintsApplied.includes("type-artifact"));
  });

  it("marks deck status failed on fatal theming error", async function () {
    __setCardImageResolverForTests(async (name: string): Promise<ResolvedCardImage | null> => ({
      scryfallId: `${name}-id`,
      imageUrl: `https://img/${encodeURIComponent(name)}`,
    }));

    __setCardDetailsResolverForTests(async (): Promise<ScryfallCardDetails | null> => ({
      scryfallId: "card-id",
      oracleText: "Do thing.",
      typeLine: "Legendary Creature — Human",
      manaCost: "{3}",
      isLegendary: true,
      isBasicLand: false,
    }));

    __setOpenAIThemerForTests(async (): Promise<ThemedDeckCardGeneratedPayload[]> => {
      throw new Error("Malformed model output");
    });

    const created = await createDeck({
      title: "Deck",
      decklistText: "1 Captain Sisay",
    });

    await assert.rejects(
      startDeckThemingMethod({
        deckId: created.deckId,
        themeUniverse: "Star Trek",
        artStyleBrief: "Retro-futurist portraiture",
        confirmDiscardPrevious: false,
      }),
      (error: unknown) => error instanceof Error,
    );

    const deck = await DecksCollection.findOneAsync({ _id: created.deckId });
    assert.ok(deck);
    assert.strictEqual(deck?.themingStatus, "failed");
    assert.strictEqual(deck?.themingError, "Malformed model output");
  });
});
