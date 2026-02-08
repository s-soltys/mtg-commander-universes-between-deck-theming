import { strict as assert } from "node:assert";
import { Meteor } from "meteor/meteor";

import "./decks/parser.test";
import "./decks/methods.test";
import "./decks/publications.test";
import "./decks/themedNames.test";
import "./decks/theming.test";

describe("app-for-decks", function () {
  it("package.json has correct name", async function () {
    const { name } = await import("../package.json");
    assert.strictEqual(name, "app-for-decks");
  });

  if (Meteor.isServer) {
    it("server is not client", function () {
      assert.strictEqual(Meteor.isClient, false);
    });
  }
});
