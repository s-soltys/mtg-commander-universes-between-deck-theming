import { strict as assert } from "node:assert";
import { parseDecklist } from "/imports/api/decks/parser";

describe("parseDecklist", function () {
  it("parses quantity + card name", function () {
    const result = parseDecklist("1 Sol Ring");

    assert.deepStrictEqual(result.cards, [{ name: "Sol Ring", quantity: 1 }]);
    assert.deepStrictEqual(result.invalidLines, []);
  });

  it("parses quantityx + card name", function () {
    const result = parseDecklist("1x Sol Ring");

    assert.deepStrictEqual(result.cards, [{ name: "Sol Ring", quantity: 1 }]);
    assert.deepStrictEqual(result.invalidLines, []);
  });

  it("ignores blank and header lines", function () {
    const result = parseDecklist("\nDeck\nCommander\nSideboard\n1 Arcane Signet");

    assert.deepStrictEqual(result.cards, [{ name: "Arcane Signet", quantity: 1 }]);
    assert.strictEqual(result.ignoredLines.length, 4);
  });

  it("aggregates duplicate card names", function () {
    const result = parseDecklist("1 Sol Ring\n2 Sol Ring");

    assert.deepStrictEqual(result.cards, [{ name: "Sol Ring", quantity: 3 }]);
  });

  it("collects invalid lines", function () {
    const result = parseDecklist("oops\n1 Sol Ring\n0 Nothing");

    assert.deepStrictEqual(result.cards, [{ name: "Sol Ring", quantity: 1 }]);
    assert.deepStrictEqual(result.invalidLines, ["oops", "0 Nothing"]);
  });
});
