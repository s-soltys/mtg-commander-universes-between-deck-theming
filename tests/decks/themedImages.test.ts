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

const sleep = async (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const createCompletedDeck = async (): Promise<string> => {
  const now = new Date();
  return DecksCollection.insertAsync({
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
};

interface SeedThemedCardInput {
  deckId: string;
  originalCardName: string;
  status?: "pending" | "generated" | "failed" | "skipped";
  isBasicLand?: boolean;
  themedName?: string | null;
  themedImagePrompt?: string | null;
  themedGeneratedImageUrl?: string | null;
  themedGeneratedImageStatus?: "idle" | "generating" | "generated" | "failed";
  themedGeneratedImageError?: string | null;
}

const insertThemedCard = async ({
  deckId,
  originalCardName,
  status = "generated",
  isBasicLand = false,
  themedName = `${originalCardName} themed`,
  themedImagePrompt = `${originalCardName} prompt`,
  themedGeneratedImageUrl = null,
  themedGeneratedImageStatus = "idle",
  themedGeneratedImageError = null,
}: SeedThemedCardInput): Promise<void> => {
  const now = new Date();

  await ThemedDeckCardsCollection.insertAsync({
    deckId,
    originalCardName,
    quantity: 1,
    isBasicLand,
    status,
    themedName,
    themedFlavorText: status === "generated" ? "Flavor" : null,
    themedConcept: status === "generated" ? "Concept" : "Basic land kept unchanged.",
    themedImagePrompt,
    themedGeneratedImageUrl,
    themedGeneratedImageStatus,
    themedGeneratedImageError,
    themedGeneratedImageUpdatedAt: null,
    constraintsApplied: status === "skipped" ? ["basic-land-unchanged"] : [],
    errorMessage: null,
    createdAt: now,
    updatedAt: now,
  });
};

const waitForImageStatus = async (
  deckId: string,
  originalCardName: string,
  expectedStatus: "idle" | "generating" | "generated" | "failed",
): Promise<void> => {
  const timeoutMs = 2500;
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const card = await ThemedDeckCardsCollection.findOneAsync({ deckId, originalCardName });
    if (card?.themedGeneratedImageStatus === expectedStatus) {
      return;
    }

    await sleep(25);
  }

  throw new Error(`Timed out waiting for image status "${expectedStatus}" for ${originalCardName}.`);
};

const waitForImageStatuses = async (
  deckId: string,
  expectedByCardName: Record<string, "idle" | "generating" | "generated" | "failed">,
): Promise<void> => {
  const timeoutMs = 3000;
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    let allMatched = true;

    for (const [originalCardName, expectedStatus] of Object.entries(expectedByCardName)) {
      const card = await ThemedDeckCardsCollection.findOneAsync({ deckId, originalCardName });
      if (card?.themedGeneratedImageStatus !== expectedStatus) {
        allMatched = false;
        break;
      }
    }

    if (allMatched) {
      return;
    }

    await sleep(25);
  }

  throw new Error("Timed out waiting for expected image statuses.");
};

describe("themed image generation", function () {
  beforeEach(async function () {
    await clearData();
  });

  afterEach(function () {
    __resetThemedImageGeneratorForTests();
  });

  it("queues eligible bulk jobs, skips ineligible rows, and counts already-generating rows", async function () {
    const deckId = await createCompletedDeck();

    await insertThemedCard({
      deckId,
      originalCardName: "Arcane Signet",
      themedImagePrompt: "prompt one",
      themedGeneratedImageStatus: "idle",
      themedGeneratedImageUrl: null,
    });
    await insertThemedCard({
      deckId,
      originalCardName: "Sol Ring",
      themedImagePrompt: "prompt two",
      themedGeneratedImageStatus: "generating",
      themedGeneratedImageUrl: "https://existing/running.png",
    });
    await insertThemedCard({
      deckId,
      originalCardName: "Command Tower",
      themedImagePrompt: "prompt three",
      themedGeneratedImageStatus: "generated",
      themedGeneratedImageUrl: "https://existing/generated.png",
    });
    await insertThemedCard({
      deckId,
      originalCardName: "Plains",
      status: "skipped",
      isBasicLand: true,
      themedName: "Plains",
      themedImagePrompt: null,
      themedGeneratedImageStatus: "idle",
      themedGeneratedImageUrl: null,
    });

    const prompts: string[] = [];
    __setThemedImageGeneratorForTests(async (prompt: string): Promise<string> => {
      prompts.push(prompt);
      await sleep(60);
      return `https://generated/${prompt}`;
    });

    const result = await generateDeckThemedImages({ deckId, forceRegenerate: false });

    assert.strictEqual(result.startedCount, 1);
    assert.strictEqual(result.alreadyGeneratingCount, 1);
    assert.strictEqual(result.skippedCount, 2);

    const queued = await ThemedDeckCardsCollection.findOneAsync({ deckId, originalCardName: "Arcane Signet" });
    assert.strictEqual(queued?.themedGeneratedImageStatus, "generating");

    await waitForImageStatus(deckId, "Arcane Signet", "generated");

    const generated = await ThemedDeckCardsCollection.findOneAsync({ deckId, originalCardName: "Arcane Signet" });
    const running = await ThemedDeckCardsCollection.findOneAsync({ deckId, originalCardName: "Sol Ring" });
    const unchanged = await ThemedDeckCardsCollection.findOneAsync({ deckId, originalCardName: "Command Tower" });
    assert.deepStrictEqual(prompts, ["prompt one"]);
    assert.strictEqual(generated?.themedGeneratedImageUrl, "https://generated/prompt one");
    assert.strictEqual(running?.themedGeneratedImageStatus, "generating");
    assert.strictEqual(unchanged?.themedGeneratedImageUrl, "https://existing/generated.png");
  });

  it("marks failed rows while allowing other queued rows to complete", async function () {
    const deckId = await createCompletedDeck();

    await insertThemedCard({
      deckId,
      originalCardName: "Arcane Signet",
      themedImagePrompt: "good prompt",
      themedGeneratedImageStatus: "idle",
      themedGeneratedImageUrl: null,
    });
    await insertThemedCard({
      deckId,
      originalCardName: "Command Tower",
      themedImagePrompt: "bad prompt",
      themedGeneratedImageStatus: "idle",
      themedGeneratedImageUrl: null,
    });

    __setThemedImageGeneratorForTests(async (prompt: string): Promise<string> => {
      await sleep(40);
      if (prompt === "bad prompt") {
        throw new Error("generation unavailable");
      }

      return "https://generated/good.png";
    });

    const result = await generateDeckThemedImages({ deckId, forceRegenerate: false });

    assert.strictEqual(result.startedCount, 2);
    assert.strictEqual(result.alreadyGeneratingCount, 0);
    assert.strictEqual(result.skippedCount, 0);

    await waitForImageStatuses(deckId, {
      "Arcane Signet": "generated",
      "Command Tower": "failed",
    });

    const good = await ThemedDeckCardsCollection.findOneAsync({ deckId, originalCardName: "Arcane Signet" });
    const failed = await ThemedDeckCardsCollection.findOneAsync({ deckId, originalCardName: "Command Tower" });
    assert.strictEqual(good?.themedGeneratedImageUrl, "https://generated/good.png");
    assert.strictEqual(failed?.themedGeneratedImageError, "generation unavailable");
  });

  it("limits bulk generation concurrency to three jobs per deck", async function () {
    const deckId = await createCompletedDeck();

    await insertThemedCard({ deckId, originalCardName: "Card A", themedImagePrompt: "prompt-a" });
    await insertThemedCard({ deckId, originalCardName: "Card B", themedImagePrompt: "prompt-b" });
    await insertThemedCard({ deckId, originalCardName: "Card C", themedImagePrompt: "prompt-c" });
    await insertThemedCard({ deckId, originalCardName: "Card D", themedImagePrompt: "prompt-d" });

    let active = 0;
    let maxActive = 0;

    __setThemedImageGeneratorForTests(async (prompt: string): Promise<string> => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await sleep(80);
      active -= 1;
      return `https://generated/${prompt}`;
    });

    const result = await generateDeckThemedImages({ deckId, forceRegenerate: false });

    assert.strictEqual(result.startedCount, 4);
    assert.strictEqual(result.alreadyGeneratingCount, 0);
    assert.strictEqual(result.skippedCount, 0);

    await waitForImageStatuses(deckId, {
      "Card A": "generated",
      "Card B": "generated",
      "Card C": "generated",
      "Card D": "generated",
    });

    assert.strictEqual(maxActive, 3);
  });

  it("starts async single-card generation and updates edited fields", async function () {
    const deckId = await createCompletedDeck();

    await insertThemedCard({
      deckId,
      originalCardName: "Arcane Signet",
      themedName: "Guild Beacon",
      themedImagePrompt: "prompt one",
    });
    await insertThemedCard({
      deckId,
      originalCardName: "Command Tower",
      themedName: "Citadel Spire",
      themedImagePrompt: "prompt two",
    });

    __setThemedImageGeneratorForTests(async (prompt: string): Promise<string> => {
      await sleep(60);
      return `https://generated/${prompt}`;
    });

    const result = await generateThemedImageForCard({
      deckId,
      originalCardName: "Command Tower",
      themedName: "Citadel Spire Reforged",
      themedImagePrompt: "new prompt two",
      forceRegenerate: false,
    });

    assert.strictEqual(result.started, true);

    const selectedDuringGeneration = await ThemedDeckCardsCollection.findOneAsync({
      deckId,
      originalCardName: "Command Tower",
    });
    const unselected = await ThemedDeckCardsCollection.findOneAsync({
      deckId,
      originalCardName: "Arcane Signet",
    });

    assert.strictEqual(selectedDuringGeneration?.themedGeneratedImageStatus, "generating");
    assert.strictEqual(selectedDuringGeneration?.themedName, "Citadel Spire Reforged");
    assert.strictEqual(selectedDuringGeneration?.themedImagePrompt, "new prompt two");
    assert.strictEqual(unselected?.themedGeneratedImageStatus, "idle");
    assert.strictEqual(unselected?.themedGeneratedImageUrl, null);

    await waitForImageStatus(deckId, "Command Tower", "generated");

    const selected = await ThemedDeckCardsCollection.findOneAsync({ deckId, originalCardName: "Command Tower" });
    assert.strictEqual(selected?.themedGeneratedImageUrl, "https://generated/new prompt two");
    assert.strictEqual(selected?.themedName, "Citadel Spire Reforged");
    assert.strictEqual(selected?.themedImagePrompt, "new prompt two");
  });

  it("marks single-card async generation as failed when generator throws", async function () {
    const deckId = await createCompletedDeck();

    await insertThemedCard({
      deckId,
      originalCardName: "Command Tower",
      themedName: "Citadel Spire",
      themedImagePrompt: "bad prompt",
    });

    __setThemedImageGeneratorForTests(async (): Promise<string> => {
      await sleep(40);
      throw new Error("generation unavailable");
    });

    const result = await generateThemedImageForCard({
      deckId,
      originalCardName: "Command Tower",
      themedName: "Citadel Spire",
      themedImagePrompt: "bad prompt",
      forceRegenerate: true,
    });

    assert.strictEqual(result.started, true);

    const during = await ThemedDeckCardsCollection.findOneAsync({ deckId, originalCardName: "Command Tower" });
    assert.strictEqual(during?.themedGeneratedImageStatus, "generating");

    await waitForImageStatus(deckId, "Command Tower", "failed");

    const failed = await ThemedDeckCardsCollection.findOneAsync({ deckId, originalCardName: "Command Tower" });
    assert.strictEqual(failed?.themedGeneratedImageError, "generation unavailable");
  });

  it("returns started false when single-card generation is already running", async function () {
    const deckId = await createCompletedDeck();

    await insertThemedCard({
      deckId,
      originalCardName: "Command Tower",
      themedName: "Citadel Spire",
      themedImagePrompt: "prompt one",
    });

    let releaseGeneration: (() => void) | null = null;
    const generationBlocker = new Promise<void>((resolve) => {
      releaseGeneration = resolve;
    });

    __setThemedImageGeneratorForTests(async (prompt: string): Promise<string> => {
      await generationBlocker;
      return `https://generated/${prompt}`;
    });

    const firstResult = await generateThemedImageForCard({
      deckId,
      originalCardName: "Command Tower",
      themedName: "Citadel Spire Prime",
      themedImagePrompt: "prompt prime",
      forceRegenerate: true,
    });

    const secondResult = await generateThemedImageForCard({
      deckId,
      originalCardName: "Command Tower",
      themedName: "Citadel Spire Alternate",
      themedImagePrompt: "alternate prompt",
      forceRegenerate: true,
    });

    assert.strictEqual(firstResult.started, true);
    assert.strictEqual(secondResult.started, false);

    const duringGeneration = await ThemedDeckCardsCollection.findOneAsync({
      deckId,
      originalCardName: "Command Tower",
    });
    assert.strictEqual(duringGeneration?.themedGeneratedImageStatus, "generating");
    assert.strictEqual(duringGeneration?.themedName, "Citadel Spire Prime");
    assert.strictEqual(duringGeneration?.themedImagePrompt, "prompt prime");

    if (!releaseGeneration) {
      throw new Error("Expected generation release function to be set.");
    }

    releaseGeneration();

    await waitForImageStatus(deckId, "Command Tower", "generated");

    const finalCard = await ThemedDeckCardsCollection.findOneAsync({ deckId, originalCardName: "Command Tower" });
    assert.strictEqual(finalCard?.themedGeneratedImageUrl, "https://generated/prompt prime");
  });
});
