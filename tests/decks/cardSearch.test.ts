import { strict as assert } from "node:assert";
import type { DeckCardDoc, ThemedDeckCardDoc } from "/imports/api/decks";
import { filterDeckCardsByOriginalTitle, filterDeckCardsByViewFilter } from "/imports/ui/decks/cardSearch";

const makeCard = (name: string): DeckCardDoc => ({
  deckId: "deck-1",
  name,
  quantity: 1,
  imageUrl: null,
  imageSource: "scryfall",
  scryfallId: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
});

const makeThemedCard = (
  originalCardName: string,
  overrides: Partial<ThemedDeckCardDoc> = {},
): ThemedDeckCardDoc => ({
  deckId: "deck-1",
  originalCardName,
  quantity: 1,
  isBasicLand: false,
  status: "generated",
  themedName: `${originalCardName} Themed`,
  themedFlavorText: null,
  themedConcept: "A new concept",
  themedImagePrompt: "A themed prompt",
  themedGeneratedImageUrl: null,
  themedGeneratedImageStatus: "idle",
  themedGeneratedImageError: null,
  themedGeneratedImageUpdatedAt: null,
  themedCompositeImageUrl: null,
  themedCompositeImageStatus: "idle",
  themedCompositeImageError: null,
  themedCompositeImageUpdatedAt: null,
  constraintsApplied: [],
  errorMessage: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  ...overrides,
});

describe("filterDeckCardsByOriginalTitle", function () {
  it("returns all cards when search is empty", function () {
    const cards = [makeCard("Sol Ring"), makeCard("Arcane Signet")];

    const result = filterDeckCardsByOriginalTitle(cards, "   ");

    assert.strictEqual(result.length, 2);
  });

  it("matches original title case-insensitively", function () {
    const cards = [makeCard("Sol Ring"), makeCard("Arcane Signet"), makeCard("Solemn Simulacrum")];

    const result = filterDeckCardsByOriginalTitle(cards, "sol");

    assert.deepStrictEqual(
      result.map((card) => card.name),
      ["Sol Ring", "Solemn Simulacrum"],
    );
  });
});

describe("filterDeckCardsByViewFilter", function () {
  it("returns all cards when filter is all", function () {
    const cards = [makeCard("Sol Ring"), makeCard("Arcane Signet")];
    const themedCardsByOriginalName = new Map<string, ThemedDeckCardDoc>();

    const result = filterDeckCardsByViewFilter(cards, themedCardsByOriginalName, "all");

    assert.deepStrictEqual(
      result.map((card) => card.name),
      ["Sol Ring", "Arcane Signet"],
    );
  });

  it("returns only cards with generated themed image", function () {
    const cards = [makeCard("Sol Ring"), makeCard("Arcane Signet"), makeCard("Island")];
    const themedCardsByOriginalName = new Map<string, ThemedDeckCardDoc>([
      [
        "Sol Ring",
        makeThemedCard("Sol Ring", {
          themedGeneratedImageStatus: "generated",
          themedGeneratedImageUrl: "https://example.com/sol-ring.png",
        }),
      ],
      [
        "Arcane Signet",
        makeThemedCard("Arcane Signet", {
          themedGeneratedImageStatus: "failed",
          themedGeneratedImageUrl: null,
        }),
      ],
      [
        "Island",
        makeThemedCard("Island", {
          status: "skipped",
          themedGeneratedImageStatus: "generated",
          themedGeneratedImageUrl: "https://example.com/island.png",
        }),
      ],
    ]);

    const result = filterDeckCardsByViewFilter(cards, themedCardsByOriginalName, "withGeneratedImage");

    assert.deepStrictEqual(
      result.map((card) => card.name),
      ["Sol Ring"],
    );
  });

  it("returns only cards without generated themed image", function () {
    const cards = [makeCard("Sol Ring"), makeCard("Arcane Signet"), makeCard("Island"), makeCard("Command Tower")];
    const themedCardsByOriginalName = new Map<string, ThemedDeckCardDoc>([
      [
        "Sol Ring",
        makeThemedCard("Sol Ring", {
          themedGeneratedImageStatus: "generated",
          themedGeneratedImageUrl: "https://example.com/sol-ring.png",
        }),
      ],
      [
        "Arcane Signet",
        makeThemedCard("Arcane Signet", {
          themedGeneratedImageStatus: "failed",
          themedGeneratedImageUrl: null,
        }),
      ],
      [
        "Island",
        makeThemedCard("Island", {
          status: "skipped",
          themedGeneratedImageStatus: "generated",
          themedGeneratedImageUrl: "https://example.com/island.png",
        }),
      ],
    ]);

    const result = filterDeckCardsByViewFilter(cards, themedCardsByOriginalName, "withoutGeneratedImage");

    assert.deepStrictEqual(
      result.map((card) => card.name),
      ["Arcane Signet", "Island", "Command Tower"],
    );
  });

  it("returns only cards with generated themed card composites", function () {
    const cards = [makeCard("Sol Ring"), makeCard("Arcane Signet"), makeCard("Command Tower")];
    const themedCardsByOriginalName = new Map<string, ThemedDeckCardDoc>([
      [
        "Sol Ring",
        makeThemedCard("Sol Ring", {
          themedCompositeImageStatus: "generated",
          themedCompositeImageUrl: "https://example.com/sol-ring-composite.png",
        }),
      ],
      [
        "Arcane Signet",
        makeThemedCard("Arcane Signet", {
          themedCompositeImageStatus: "generated",
          themedCompositeImageUrl: "",
        }),
      ],
      [
        "Command Tower",
        makeThemedCard("Command Tower", {
          themedCompositeImageStatus: "generating",
          themedCompositeImageUrl: null,
        }),
      ],
    ]);

    const result = filterDeckCardsByViewFilter(cards, themedCardsByOriginalName, "withGeneratedThemedCard");

    assert.deepStrictEqual(
      result.map((card) => card.name),
      ["Sol Ring"],
    );
  });
});
