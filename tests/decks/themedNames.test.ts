import { strict as assert } from "node:assert";
import { buildThemedNameByOriginalCard } from "/imports/ui/decks/themedNames";
import type { ThemedDeckCardDoc } from "/imports/api/decks";

describe("buildThemedNameByOriginalCard", function () {
  it("returns themed names for generated and skipped rows only", function () {
    const now = new Date();
    const input: ThemedDeckCardDoc[] = [
      {
        _id: "a",
        deckId: "deck-1",
        originalCardName: "Sol Ring",
        quantity: 1,
        isBasicLand: false,
        status: "generated",
        themedName: "Arcanum Core",
        themedFlavorText: null,
        themedConcept: null,
        themedImagePrompt: null,
        constraintsApplied: [],
        errorMessage: null,
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: "b",
        deckId: "deck-1",
        originalCardName: "Plains",
        quantity: 5,
        isBasicLand: true,
        status: "skipped",
        themedName: "Plains",
        themedFlavorText: null,
        themedConcept: null,
        themedImagePrompt: null,
        constraintsApplied: [],
        errorMessage: null,
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: "c",
        deckId: "deck-1",
        originalCardName: "Arcane Signet",
        quantity: 1,
        isBasicLand: false,
        status: "failed",
        themedName: null,
        themedFlavorText: null,
        themedConcept: null,
        themedImagePrompt: null,
        constraintsApplied: [],
        errorMessage: "Generation failed",
        createdAt: now,
        updatedAt: now,
      },
    ];

    const result = buildThemedNameByOriginalCard(input);

    assert.strictEqual(result.get("Sol Ring"), "Arcanum Core");
    assert.strictEqual(result.get("Plains"), "Plains");
    assert.strictEqual(result.has("Arcane Signet"), false);
  });
});
