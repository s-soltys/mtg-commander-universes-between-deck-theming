import { strict as assert } from "node:assert";
import { DeckCardsCollection, DecksCollection, ThemedDeckCardsCollection } from "/imports/api/decks";
import {
  __getTitleMaskBlendModeForTests,
  __resetThemedCardComposerForTests,
  __setThemedCardComposerForTests,
  generateThemedCardCompositeForCard,
} from "/imports/api/decks/themedCardComposites";

const clearData = async (): Promise<void> => {
  await ThemedDeckCardsCollection.removeAsync({});
  await DeckCardsCollection.removeAsync({});
  await DecksCollection.removeAsync({});
};

interface SeedCompositeScenarioInput {
  deckThemingStatus?: "idle" | "running" | "completed" | "failed";
  baseImageUrl?: string | null;
  themedGeneratedImageUrl?: string | null;
}

const seedCompositeScenario = async ({
  deckThemingStatus = "completed",
  baseImageUrl = "https://img/base-card.png",
  themedGeneratedImageUrl = "https://img/themed-art.png",
}: SeedCompositeScenarioInput = {}): Promise<string> => {
  const now = new Date();
  const deckId = await DecksCollection.insertAsync({
    title: "Deck",
    themingStatus: deckThemingStatus,
    themingThemeUniverse: "Dune",
    themingArtStyleBrief: "Painterly",
    themingStartedAt: now,
    themingCompletedAt: deckThemingStatus === "completed" ? now : null,
    themingError: null,
    createdAt: now,
    updatedAt: now,
  });

  await DeckCardsCollection.insertAsync({
    deckId,
    name: "Arcane Signet",
    quantity: 1,
    imageUrl: baseImageUrl,
    imageSource: "scryfall",
    scryfallId: "arcane-signet-id",
    createdAt: now,
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
    themedImagePrompt: "Prompt",
    themedGeneratedImageUrl,
    themedGeneratedImageStatus: themedGeneratedImageUrl ? "generated" : "idle",
    themedGeneratedImageError: null,
    themedGeneratedImageUpdatedAt: now,
    themedCompositeImageUrl: null,
    themedCompositeImageStatus: "idle",
    themedCompositeImageError: null,
    themedCompositeImageUpdatedAt: null,
    constraintsApplied: [],
    errorMessage: null,
    createdAt: now,
    updatedAt: now,
  });

  return deckId;
};

const sleep = async (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const waitForCompositeStatus = async (
  deckId: string,
  status: "idle" | "generating" | "generated" | "failed",
): Promise<void> => {
  const timeoutMs = 2500;
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const card = await ThemedDeckCardsCollection.findOneAsync({
      deckId,
      originalCardName: "Arcane Signet",
    });
    if (card?.themedCompositeImageStatus === status) {
      return;
    }

    await sleep(25);
  }

  throw new Error(`Timed out waiting for composite status "${status}".`);
};

describe("generateThemedCardCompositeForCard", function () {
  beforeEach(async function () {
    await clearData();
  });

  afterEach(function () {
    __resetThemedCardComposerForTests();
  });

  it("starts async composite generation and stores the generated composite image", async function () {
    const deckId = await seedCompositeScenario();
    const generatedDataUrl = "data:image/png;base64,ZmFrZQ==";

    __setThemedCardComposerForTests(async () => {
      await sleep(80);
      return generatedDataUrl;
    });

    const result = await generateThemedCardCompositeForCard({
      deckId,
      originalCardName: "Arcane Signet",
      themedName: "Guild Beacon Prime",
      forceRegenerate: true,
    });

    assert.strictEqual(result.started, true);

    const cardDuringGeneration = await ThemedDeckCardsCollection.findOneAsync({
      deckId,
      originalCardName: "Arcane Signet",
    });
    assert.strictEqual(cardDuringGeneration?.themedCompositeImageStatus, "generating");

    await waitForCompositeStatus(deckId, "generated");

    const finalCard = await ThemedDeckCardsCollection.findOneAsync({
      deckId,
      originalCardName: "Arcane Signet",
    });
    assert.strictEqual(finalCard?.themedCompositeImageStatus, "generated");
    assert.strictEqual(finalCard?.themedCompositeImageUrl, generatedDataUrl);
    assert.strictEqual(finalCard?.themedName, "Guild Beacon Prime");
  });

  it("fails with row status when themed art is missing", async function () {
    const deckId = await seedCompositeScenario({ themedGeneratedImageUrl: null });

    await assert.rejects(
      generateThemedCardCompositeForCard({
        deckId,
        originalCardName: "Arcane Signet",
        themedName: "Guild Beacon",
        forceRegenerate: true,
      }),
      (error: unknown) => error instanceof Error,
    );

    const card = await ThemedDeckCardsCollection.findOneAsync({
      deckId,
      originalCardName: "Arcane Signet",
    });
    assert.strictEqual(card?.themedCompositeImageStatus, "failed");
    assert.strictEqual(card?.themedCompositeImageError, "Generate themed art before creating a themed card image.");
  });

  it("fails with row status when base card image is missing", async function () {
    const deckId = await seedCompositeScenario({ baseImageUrl: null });

    await assert.rejects(
      generateThemedCardCompositeForCard({
        deckId,
        originalCardName: "Arcane Signet",
        themedName: "Guild Beacon",
        forceRegenerate: true,
      }),
      (error: unknown) => error instanceof Error,
    );

    const card = await ThemedDeckCardsCollection.findOneAsync({
      deckId,
      originalCardName: "Arcane Signet",
    });
    assert.strictEqual(card?.themedCompositeImageStatus, "failed");
    assert.strictEqual(card?.themedCompositeImageError, "Missing base Scryfall card image.");
  });

  it("rejects when deck theming is not completed", async function () {
    const deckId = await seedCompositeScenario({ deckThemingStatus: "idle" });

    await assert.rejects(
      generateThemedCardCompositeForCard({
        deckId,
        originalCardName: "Arcane Signet",
        themedName: "Guild Beacon",
        forceRegenerate: true,
      }),
      (error: unknown) => error instanceof Error,
    );

    const card = await ThemedDeckCardsCollection.findOneAsync({
      deckId,
      originalCardName: "Arcane Signet",
    });
    assert.strictEqual(card?.themedCompositeImageStatus, "idle");
  });

  it("marks row failed when compositor reports unsupported layout", async function () {
    const deckId = await seedCompositeScenario();

    __setThemedCardComposerForTests(async () => {
      throw new Error("unsupported-layout: card image is not a standard single-face frame ratio.");
    });

    const result = await generateThemedCardCompositeForCard({
      deckId,
      originalCardName: "Arcane Signet",
      themedName: "Guild Beacon",
      forceRegenerate: true,
    });

    assert.strictEqual(result.started, true);
    await waitForCompositeStatus(deckId, "failed");

    const card = await ThemedDeckCardsCollection.findOneAsync({
      deckId,
      originalCardName: "Arcane Signet",
    });
    assert.strictEqual(card?.themedCompositeImageStatus, "failed");
    assert.ok((card?.themedCompositeImageError ?? "").includes("unsupported-layout"));
  });
});

describe("title mask blend mode selection", function () {
  it("falls back to over when luminosity is unavailable", function () {
    const sharpFactoryWithoutLuminosity = Object.assign(() => null, {
      blend: {
        "over": "over",
        overlay: "overlay",
      },
    });

    assert.strictEqual(__getTitleMaskBlendModeForTests(sharpFactoryWithoutLuminosity), "over");
  });

  it("uses luminosity when the sharp factory reports support", function () {
    const sharpFactoryWithLuminosity = Object.assign(() => null, {
      blend: {
        luminosity: "luminosity",
        "over": "over",
      },
    });

    assert.strictEqual(__getTitleMaskBlendModeForTests(sharpFactoryWithLuminosity), "luminosity");
  });
});
