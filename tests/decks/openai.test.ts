import { strict as assert } from "node:assert";
import { generateDeckThemeWithOpenAI } from "/imports/api/decks/openai";

const createResponse = (status: number, body: unknown): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
    statusText: "",
    json: async () => body,
    text: async () => JSON.stringify(body),
  }) as Response;

describe("openai theming", function () {
  const originalFetch = global.fetch;
  const originalEnvOpenAIKey = process.env.OPENAI_API_KEY;

  beforeEach(function () {
    process.env.OPENAI_API_KEY = "sk-test-openai-key";
  });

  afterEach(function () {
    global.fetch = originalFetch;
    if (typeof originalEnvOpenAIKey === "string") {
      process.env.OPENAI_API_KEY = originalEnvOpenAIKey;
    } else {
      delete process.env.OPENAI_API_KEY;
    }
  });

  it("uses the responses API json schema format for deck theming", async function () {
    let requestedUrl: string | null = null;
    let requestedBody: Record<string, unknown> | null = null;

    global.fetch = (async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
      requestedUrl = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      requestedBody = JSON.parse((init?.body as string | undefined) ?? "{}") as Record<string, unknown>;

      return createResponse(200, {
        output_text: JSON.stringify({
          cards: [
            {
              originalCardName: "Arcane Signet",
              themedName: "Order Sigil",
              themedFlavorText: "A shard tuned to imperial cadence.",
              themedConcept: "Ornate sigil with etched symbols and pale glow.",
              themedImagePrompt: "Detailed sigil in brass and ivory, magical glow, plain backdrop.",
              constraintsApplied: ["type-coherent"],
            },
          ],
        }),
      });
    }) as typeof fetch;

    const result = await generateDeckThemeWithOpenAI({
      themeUniverse: "The Witcher",
      artStyleBrief: "Dark realism",
      cards: [
        {
          originalCardName: "Arcane Signet",
          quantity: 1,
          oracleText: "{T}: Add one mana of any color in your commander's color identity.",
          typeLine: "Artifact",
          manaCost: "{2}",
          isLegendary: false,
        },
      ],
    });

    assert.strictEqual(requestedUrl, "https://api.openai.com/v1/responses");
    assert.ok(requestedBody);
    assert.strictEqual(requestedBody?.model, "gpt-5-mini");
    assert.strictEqual(
      ((requestedBody?.text as { format?: { type?: string } } | undefined)?.format?.type ?? null),
      "json_schema",
    );
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0]?.themedName, "Order Sigil");
  });
});
