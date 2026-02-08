import { strict as assert } from "node:assert";
import { DeckCardsCollection, DecksCollection, ThemedDeckCardsCollection } from "/imports/api/decks";
import {
  __resetCardImageResolverForTests,
  __setCardImageResolverForTests,
  copyDeck,
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

describe("createDeck", function () {
  beforeEach(async function () {
    await clearDeckData();
  });

  afterEach(function () {
    __resetCardImageResolverForTests();
    __resetCardDetailsResolverForTests();
    __resetOpenAIThemerForTests();
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

  it("starts deck theming, skips basic lands, and completes the deck status", async function () {
    __setCardImageResolverForTests(async (name: string): Promise<ResolvedCardImage | null> => ({
      scryfallId: `${name}-id`,
      imageUrl: `https://img/${encodeURIComponent(name)}`,
    }));

    __setCardDetailsResolverForTests(async (name: string): Promise<ScryfallCardDetails | null> => {
      if (name === "Plains") {
        return {
          scryfallId: "plains-id",
          oracleText: "({T}: Add {W}.)",
          typeLine: "Basic Land — Plains",
          manaCost: null,
          isLegendary: false,
          isBasicLand: true,
        };
      }

      return {
        scryfallId: `${name}-detail-id`,
        oracleText: "Rules text",
        typeLine: "Legendary Artifact",
        manaCost: "{1}",
        isLegendary: true,
        isBasicLand: false,
      };
    });

    __setOpenAIThemerForTests(async (): Promise<ThemedDeckCardGeneratedPayload[]> => [
      {
        originalCardName: "Sol Ring",
        themedName: "Arcanum Core",
        themedFlavorText: "Power gathers in its orbit.",
        themedConcept: "A glowing relic suspended over an altar.",
        themedImagePrompt: "Ancient sci-fi relic floating above a marble dais, dramatic rim light.",
        constraintsApplied: ["type-coherent"],
      },
    ]);

    const created = await createDeck({
      title: "My Deck",
      decklistText: "1 Sol Ring\n1 Plains",
    });

    const startResult = await startDeckThemingMethod({
      deckId: created.deckId,
      themeUniverse: "Star Wars",
      artStyleBrief: "Cinematic matte painting",
      confirmDiscardPrevious: false,
    });

    assert.strictEqual(startResult.themingStatus, "completed");

    const deck = await DecksCollection.findOneAsync({ _id: created.deckId });
    assert.ok(deck);
    assert.strictEqual(deck?.themingStatus, "completed");

    const themedCards = await ThemedDeckCardsCollection.find({ deckId: created.deckId }).fetch();
    assert.strictEqual(themedCards.length, 2);

    const plains = themedCards.find((card) => card.originalCardName === "Plains");
    const solRing = themedCards.find((card) => card.originalCardName === "Sol Ring");

    assert.ok(plains);
    assert.strictEqual(plains?.status, "skipped");
    assert.strictEqual(plains?.themedName, "Plains");

    assert.ok(solRing);
    assert.strictEqual(solRing?.status, "generated");
    assert.strictEqual(solRing?.themedName, "Arcanum Core");
    assert.ok(solRing?.constraintsApplied.includes("legendary-source"));
    assert.ok(solRing?.constraintsApplied.includes("type-artifact"));
  });

  it("requires confirmation to rerun and discards old themed cards after confirmation", async function () {
    __setCardImageResolverForTests(async (name: string): Promise<ResolvedCardImage | null> => ({
      scryfallId: `${name}-id`,
      imageUrl: `https://img/${encodeURIComponent(name)}`,
    }));
    __setCardDetailsResolverForTests(async (): Promise<ScryfallCardDetails | null> => ({
      scryfallId: "id",
      oracleText: "Rules",
      typeLine: "Artifact",
      manaCost: "{2}",
      isLegendary: false,
      isBasicLand: false,
    }));
    __setOpenAIThemerForTests(async (): Promise<ThemedDeckCardGeneratedPayload[]> => [
      {
        originalCardName: "Arcane Signet",
        themedName: "Guild Beacon",
        themedFlavorText: "It hums with ordered might.",
        themedConcept: "Metal sigil glowing with blue-white runes.",
        themedImagePrompt: "Arcane medallion with carved insignia and cool magical glow.",
        constraintsApplied: [],
      },
    ]);

    const created = await createDeck({
      title: "My Deck",
      decklistText: "1 Arcane Signet",
    });

    await startDeckThemingMethod({
      deckId: created.deckId,
      themeUniverse: "Dune",
      artStyleBrief: "Painterly desert epics",
      confirmDiscardPrevious: false,
    });

    await assert.rejects(
      startDeckThemingMethod({
        deckId: created.deckId,
        themeUniverse: "Foundation",
        artStyleBrief: "Retro sci-fi concept art",
        confirmDiscardPrevious: false,
      }),
      (error: unknown) => error instanceof Error,
    );

    await startDeckThemingMethod({
      deckId: created.deckId,
      themeUniverse: "Foundation",
      artStyleBrief: "Retro sci-fi concept art",
      confirmDiscardPrevious: true,
    });

    const themedCards = await ThemedDeckCardsCollection.find({ deckId: created.deckId }).fetch();
    assert.strictEqual(themedCards.length, 1);
    assert.strictEqual(themedCards[0].themedName, "Guild Beacon");
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

  it("copies only base deck cards and resets theming state", async function () {
    const now = new Date();
    const sourceDeckId = await DecksCollection.insertAsync({
      title: "Source Deck",
      themingStatus: "completed",
      themingThemeUniverse: "Dune",
      themingArtStyleBrief: "Painterly",
      themingStartedAt: now,
      themingCompletedAt: now,
      themingError: null,
      createdAt: now,
      updatedAt: now,
    });

    await DeckCardsCollection.insertAsync({
      deckId: sourceDeckId,
      name: "Arcane Signet",
      quantity: 2,
      imageUrl: "https://img/arcane-signet",
      imageSource: "scryfall",
      scryfallId: "arcane-signet-id",
      createdAt: now,
    });
    await DeckCardsCollection.insertAsync({
      deckId: sourceDeckId,
      name: "Sol Ring",
      quantity: 1,
      imageUrl: "https://img/sol-ring",
      imageSource: "scryfall",
      scryfallId: "sol-ring-id",
      createdAt: now,
    });

    await ThemedDeckCardsCollection.insertAsync({
      deckId: sourceDeckId,
      originalCardName: "Arcane Signet",
      quantity: 2,
      isBasicLand: false,
      status: "generated",
      themedName: "Guild Beacon",
      themedFlavorText: "Flavor",
      themedConcept: "Concept",
      themedImagePrompt: "Prompt",
      constraintsApplied: [],
      errorMessage: null,
      createdAt: now,
      updatedAt: now,
    });

    const result = await copyDeck({
      sourceDeckId,
      title: "Copied Deck",
    });

    assert.ok(result.deckId);
    assert.strictEqual(result.cardCount, 3);
    assert.notStrictEqual(result.deckId, sourceDeckId);

    const copiedDeck = await DecksCollection.findOneAsync({ _id: result.deckId });
    assert.ok(copiedDeck);
    assert.strictEqual(copiedDeck?.title, "Copied Deck");
    assert.strictEqual(copiedDeck?.themingStatus, "idle");
    assert.strictEqual(copiedDeck?.themingThemeUniverse, null);
    assert.strictEqual(copiedDeck?.themingArtStyleBrief, null);
    assert.strictEqual(copiedDeck?.themingStartedAt, null);
    assert.strictEqual(copiedDeck?.themingCompletedAt, null);
    assert.strictEqual(copiedDeck?.themingError, null);

    const copiedCards = await DeckCardsCollection.find({ deckId: result.deckId }).fetch();
    assert.deepStrictEqual(
      copiedCards
        .map((card) => ({
          name: card.name,
          quantity: card.quantity,
          imageSource: card.imageSource,
          scryfallId: card.scryfallId,
          imageUrl: card.imageUrl,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      [
        {
          name: "Arcane Signet",
          quantity: 2,
          imageSource: "scryfall",
          scryfallId: "arcane-signet-id",
          imageUrl: "https://img/arcane-signet",
        },
        {
          name: "Sol Ring",
          quantity: 1,
          imageSource: "scryfall",
          scryfallId: "sol-ring-id",
          imageUrl: "https://img/sol-ring",
        },
      ],
    );

    const copiedThemedCards = await ThemedDeckCardsCollection.find({ deckId: result.deckId }).fetch();
    assert.deepStrictEqual(copiedThemedCards, []);
  });

  it("rejects copy for missing source deck id", async function () {
    await assert.rejects(
      copyDeck({ sourceDeckId: "", title: "Copied Deck" }),
      (error: unknown) => error instanceof Error,
    );
  });

  it("rejects copy for blank title", async function () {
    await assert.rejects(
      copyDeck({ sourceDeckId: "abc123", title: "   " }),
      (error: unknown) => error instanceof Error,
    );
  });

  it("rejects copy when source deck is not found", async function () {
    await assert.rejects(
      copyDeck({ sourceDeckId: "missing-deck-id", title: "Copied Deck" }),
      (error: unknown) => error instanceof Error,
    );
  });
});
