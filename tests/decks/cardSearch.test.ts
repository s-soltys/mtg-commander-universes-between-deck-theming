import { strict as assert } from "node:assert";
import type { DeckCardDoc } from "/imports/api/decks";
import { filterDeckCardsByOriginalTitle } from "/imports/ui/decks/cardSearch";

const makeCard = (name: string): DeckCardDoc => ({
  deckId: "deck-1",
  name,
  quantity: 1,
  imageUrl: null,
  imageSource: "scryfall",
  scryfallId: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
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
