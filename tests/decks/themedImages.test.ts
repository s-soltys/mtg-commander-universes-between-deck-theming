import { strict as assert } from "node:assert";
import { DecksCollection, ThemedDeckCardsCollection } from "/imports/api/decks";
import {
  __resetThemedImageGeneratorForTests,
  __setThemedImageGeneratorForTests,
  generateDeckThemedImages,
  generateThemedImageForCard,
} from "/imports/api/decks/themedImages";

const clearData = async (): Promise<void> => {
  await ThemedDeckCardsCollection.removeAsync({});
  await DecksCollection.removeAsync({});
};

describe("generateDeckThemedImages", function () {
  beforeEach(async function () {
    await clearData();
  });

  afterEach(function () {
    __resetThemedImageGeneratorForTests();
  });

  it("generates missing themed images and skips ineligible cards", async function () {
    const now = new Date();
    const deckId = await DecksCollection.insertAsync({
      title: "Deck",
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
      deckId,
      originalCardName: "Arcane Signet",
      quantity: 1,
      isBasicLand: false,
      status: "generated",
      themedName: "Guild Beacon",
      themedFlavorText: "Flavor",
      themedConcept: "Concept",
      themedImagePrompt: "prompt one",
      themedGeneratedImageUrl: null,
      themedGeneratedImageStatus: "idle",
      themedGeneratedImageError: null,
      themedGeneratedImageUpdatedAt: null,
      constraintsApplied: [],
      errorMessage: null,
      createdAt: now,
      updatedAt: now,
    });

    await ThemedDeckCardsCollection.insertAsync({
      deckId,
      originalCardName: "Sol Ring",
      quantity: 1,
      isBasicLand: false,
      status: "generated",
      themedName: "Sun Core",
      themedFlavorText: "Flavor",
      themedConcept: "Concept",
      themedImagePrompt: "prompt two",
      themedGeneratedImageUrl: "https://existing/image.png",
      themedGeneratedImageStatus: "generated",
      themedGeneratedImageError: null,
      themedGeneratedImageUpdatedAt: now,
      constraintsApplied: [],
      errorMessage: null,
      createdAt: now,
      updatedAt: now,
    });

    await ThemedDeckCardsCollection.insertAsync({
      deckId,
      originalCardName: "Plains",
      quantity: 1,
      isBasicLand: true,
      status: "skipped",
      themedName: "Plains",
      themedFlavorText: null,
      themedConcept: "Basic land kept unchanged.",
      themedImagePrompt: null,
      themedGeneratedImageUrl: null,
      themedGeneratedImageStatus: "idle",
      themedGeneratedImageError: null,
      themedGeneratedImageUpdatedAt: null,
      constraintsApplied: ["basic-land-unchanged"],
      errorMessage: null,
      createdAt: now,
      updatedAt: now,
    });

    __setThemedImageGeneratorForTests(async (prompt: string): Promise<string> => `https://generated/${prompt}`);

    const result = await generateDeckThemedImages({ deckId, forceRegenerate: false });

    assert.strictEqual(result.generatedCount, 1);
    assert.strictEqual(result.failedCount, 0);
    assert.strictEqual(result.skippedCount, 2);

    const generated = await ThemedDeckCardsCollection.findOneAsync({ deckId, originalCardName: "Arcane Signet" });
    assert.strictEqual(generated?.themedGeneratedImageStatus, "generated");
    assert.strictEqual(generated?.themedGeneratedImageUrl, "https://generated/prompt one");

    const unchanged = await ThemedDeckCardsCollection.findOneAsync({ deckId, originalCardName: "Sol Ring" });
    assert.strictEqual(unchanged?.themedGeneratedImageUrl, "https://existing/image.png");
  });

  it("marks failed rows and continues processing", async function () {
    const now = new Date();
    const deckId = await DecksCollection.insertAsync({
      title: "Deck",
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
      deckId,
      originalCardName: "Arcane Signet",
      quantity: 1,
      isBasicLand: false,
      status: "generated",
      themedName: "Guild Beacon",
      themedFlavorText: "Flavor",
      themedConcept: "Concept",
      themedImagePrompt: "good prompt",
      themedGeneratedImageUrl: null,
      themedGeneratedImageStatus: "idle",
      themedGeneratedImageError: null,
      themedGeneratedImageUpdatedAt: null,
      constraintsApplied: [],
      errorMessage: null,
      createdAt: now,
      updatedAt: now,
    });

    await ThemedDeckCardsCollection.insertAsync({
      deckId,
      originalCardName: "Command Tower",
      quantity: 1,
      isBasicLand: false,
      status: "generated",
      themedName: "Citadel Spire",
      themedFlavorText: "Flavor",
      themedConcept: "Concept",
      themedImagePrompt: "bad prompt",
      themedGeneratedImageUrl: null,
      themedGeneratedImageStatus: "idle",
      themedGeneratedImageError: null,
      themedGeneratedImageUpdatedAt: null,
      constraintsApplied: [],
      errorMessage: null,
      createdAt: now,
      updatedAt: now,
    });

    __setThemedImageGeneratorForTests(async (prompt: string): Promise<string> => {
      if (prompt === "bad prompt") {
        throw new Error("generation unavailable");
      }

      return "https://generated/good.png";
    });

    const result = await generateDeckThemedImages({ deckId, forceRegenerate: false });

    assert.strictEqual(result.generatedCount, 1);
    assert.strictEqual(result.failedCount, 1);
    assert.strictEqual(result.skippedCount, 0);

    const failed = await ThemedDeckCardsCollection.findOneAsync({ deckId, originalCardName: "Command Tower" });
    assert.strictEqual(failed?.themedGeneratedImageStatus, "failed");
    assert.strictEqual(failed?.themedGeneratedImageError, "generation unavailable");
  });

  it("generates image for a single selected card", async function () {
    const now = new Date();
    const deckId = await DecksCollection.insertAsync({
      title: "Deck",
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
      deckId,
      originalCardName: "Arcane Signet",
      quantity: 1,
      isBasicLand: false,
      status: "generated",
      themedName: "Guild Beacon",
      themedFlavorText: "Flavor",
      themedConcept: "Concept",
      themedImagePrompt: "prompt one",
      themedGeneratedImageUrl: null,
      themedGeneratedImageStatus: "idle",
      themedGeneratedImageError: null,
      themedGeneratedImageUpdatedAt: null,
      constraintsApplied: [],
      errorMessage: null,
      createdAt: now,
      updatedAt: now,
    });

    await ThemedDeckCardsCollection.insertAsync({
      deckId,
      originalCardName: "Command Tower",
      quantity: 1,
      isBasicLand: false,
      status: "generated",
      themedName: "Citadel Spire",
      themedFlavorText: "Flavor",
      themedConcept: "Concept",
      themedImagePrompt: "prompt two",
      themedGeneratedImageUrl: null,
      themedGeneratedImageStatus: "idle",
      themedGeneratedImageError: null,
      themedGeneratedImageUpdatedAt: null,
      constraintsApplied: [],
      errorMessage: null,
      createdAt: now,
      updatedAt: now,
    });

    __setThemedImageGeneratorForTests(async (prompt: string): Promise<string> => `https://generated/${prompt}`);

    const result = await generateThemedImageForCard({
      deckId,
      originalCardName: "Command Tower",
      forceRegenerate: false,
    });

    assert.strictEqual(result.generated, true);
    assert.strictEqual(result.imageUrl, "https://generated/prompt two");

    const selected = await ThemedDeckCardsCollection.findOneAsync({ deckId, originalCardName: "Command Tower" });
    const unselected = await ThemedDeckCardsCollection.findOneAsync({ deckId, originalCardName: "Arcane Signet" });
    assert.strictEqual(selected?.themedGeneratedImageStatus, "generated");
    assert.strictEqual(selected?.themedGeneratedImageUrl, "https://generated/prompt two");
    assert.strictEqual(unselected?.themedGeneratedImageStatus, "idle");
    assert.strictEqual(unselected?.themedGeneratedImageUrl, null);
  });
});
