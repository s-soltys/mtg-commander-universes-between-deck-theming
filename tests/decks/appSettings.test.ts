import { strict as assert } from "node:assert";
import { AppSettingsCollection } from "/imports/api/decks";
import {
  clearOpenAIKey,
  getOpenAIApiKeyForRuntime,
  maskOpenAIApiKey,
  setOpenAIKey,
  toAppSettingsPublicDoc,
} from "/imports/api/decks/appSettings";

const clearAppSettings = async (): Promise<void> => {
  await AppSettingsCollection.removeAsync({});
};

describe("app settings", function () {
  const originalEnvOpenAIKey = process.env.OPENAI_API_KEY;

  beforeEach(async function () {
    await clearAppSettings();
    delete process.env.OPENAI_API_KEY;
  });

  afterEach(async function () {
    await clearAppSettings();
    if (typeof originalEnvOpenAIKey === "string") {
      process.env.OPENAI_API_KEY = originalEnvOpenAIKey;
    } else {
      delete process.env.OPENAI_API_KEY;
    }
  });

  it("stores a key and returns a masked value", async function () {
    const result = await setOpenAIKey({ openAIApiKey: "  sk-test-1234567890  " });

    assert.strictEqual(result.hasOpenAIApiKey, true);
    assert.strictEqual(result.maskedOpenAIApiKey, "••••••••7890");

    const stored = await AppSettingsCollection.findOneAsync({ _id: "global" });
    assert.ok(stored);
    assert.strictEqual(stored?.openAIApiKey, "sk-test-1234567890");
  });

  it("rejects empty key input", async function () {
    await assert.rejects(
      setOpenAIKey({ openAIApiKey: "   " }),
      (error: unknown) => error instanceof Error,
    );
  });

  it("clears a stored key", async function () {
    await setOpenAIKey({ openAIApiKey: "sk-to-clear-0000" });

    const result = await clearOpenAIKey();
    assert.strictEqual(result.hasOpenAIApiKey, false);
    assert.strictEqual(result.maskedOpenAIApiKey, null);

    const stored = await AppSettingsCollection.findOneAsync({ _id: "global" });
    assert.ok(stored);
    assert.strictEqual(stored?.openAIApiKey, null);
  });

  it("builds a public doc with masked fields only", async function () {
    await setOpenAIKey({ openAIApiKey: "sk-abcdefghijkl" });
    const stored = await AppSettingsCollection.findOneAsync({ _id: "global" });
    const publicDoc = toAppSettingsPublicDoc(stored ?? null);

    assert.strictEqual(publicDoc.hasOpenAIApiKey, true);
    assert.strictEqual(publicDoc.maskedOpenAIApiKey, "••••••••ijkl");
    assert.strictEqual("openAIApiKey" in publicDoc, false);
  });

  it("uses saved key before env key at runtime", async function () {
    process.env.OPENAI_API_KEY = "sk-from-env";
    await setOpenAIKey({ openAIApiKey: "sk-from-settings" });

    const resolved = await getOpenAIApiKeyForRuntime();
    assert.strictEqual(resolved, "sk-from-settings");
  });

  it("falls back to env key when no saved key exists", async function () {
    process.env.OPENAI_API_KEY = "sk-only-env";

    const resolved = await getOpenAIApiKeyForRuntime();
    assert.strictEqual(resolved, "sk-only-env");
  });

  it("returns null when no saved or env key exists", async function () {
    const resolved = await getOpenAIApiKeyForRuntime();
    assert.strictEqual(resolved, null);
  });
});

describe("maskOpenAIApiKey", function () {
  it("shows only the last 4 characters", function () {
    assert.strictEqual(maskOpenAIApiKey("sk-1234567890"), "••••••••7890");
  });
});

