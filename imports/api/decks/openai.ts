import { buildThemingPrompt } from "./themingPrompt";
import { getOpenAIApiKeyForRuntime } from "./appSettings";
import type { ThemedDeckCardGeneratedPayload } from "./types";

interface OpenAIThemingInputCard {
  originalCardName: string;
  quantity: number;
  oracleText: string;
  typeLine: string;
  manaCost: string | null;
  isLegendary: boolean;
}

export interface OpenAIThemeDeckInput {
  themeUniverse: string;
  artStyleBrief: string;
  cards: OpenAIThemingInputCard[];
}

interface ChatCompletionsResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
}

const OPENAI_CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_IMAGE_GENERATIONS_URL = "https://api.openai.com/v1/images/generations";
const DEFAULT_MODEL = "gpt-4o-mini";
const DEFAULT_IMAGE_MODEL = "gpt-image-1";

export const generateDeckThemeWithOpenAI = async (
  input: OpenAIThemeDeckInput,
): Promise<ThemedDeckCardGeneratedPayload[]> => {
  const apiKey = await getOpenAIApiKeyForRuntime();
  if (!apiKey) {
    console.error("[openai] Missing OPENAI_API_KEY at runtime. Verify .env/.env.local and restart Meteor.");
    throw new Error("Missing OPENAI_API_KEY.");
  }

  const prompt = buildThemingPrompt(input);

  const response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      temperature: 0.2,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "themed_deck_cards",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              cards: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    originalCardName: { type: "string" },
                    themedName: { type: "string" },
                    themedFlavorText: { type: "string" },
                    themedConcept: { type: "string" },
                    themedImagePrompt: { type: "string" },
                    constraintsApplied: {
                      type: "array",
                      items: { type: "string" },
                    },
                  },
                  required: [
                    "originalCardName",
                    "themedName",
                    "themedFlavorText",
                    "themedConcept",
                    "themedImagePrompt",
                    "constraintsApplied",
                  ],
                },
              },
            },
            required: ["cards"],
          },
        },
      },
      messages: [
        {
          role: "system",
          content: "You are an expert MTG Universe-Beyond card themer.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI request failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as ChatCompletionsResponse;
  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI returned empty content.");
  }

  const parsed = safeParseJson(content);
  if (!parsed || !isGeneratedCardPayload(parsed)) {
    throw new Error("OpenAI returned invalid themed card payload.");
  }

  return parsed.cards;
};

export const generateThemedCardImageWithOpenAI = async (prompt: string): Promise<string> => {
  const apiKey = await getOpenAIApiKeyForRuntime();
  if (!apiKey) {
    console.error("[openai] Missing OPENAI_API_KEY at runtime. Verify .env/.env.local and restart Meteor.");
    throw new Error("Missing OPENAI_API_KEY.");
  }

  const response = await fetch(OPENAI_IMAGE_GENERATIONS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEFAULT_IMAGE_MODEL,
      prompt,
      size: "940x680",
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI image request failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as {
    data?: Array<{ url?: unknown; b64_json?: unknown }>;
  };
  const first = payload.data?.[0];
  if (!first) {
    throw new Error("OpenAI image response missing data.");
  }

  if (typeof first.url === "string" && first.url.trim().length > 0) {
    return first.url;
  }

  if (typeof first.b64_json === "string" && first.b64_json.trim().length > 0) {
    return `data:image/png;base64,${first.b64_json}`;
  }

  throw new Error("OpenAI image response missing URL.");
};

const safeParseJson = (raw: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const isGeneratedCardPayload = (
  value: unknown,
): value is { cards: ThemedDeckCardGeneratedPayload[] } => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const cards = (value as { cards?: unknown }).cards;
  if (!Array.isArray(cards)) {
    return false;
  }

  return cards.every((card) => {
    if (!card || typeof card !== "object") {
      return false;
    }

    const candidate = card as Partial<ThemedDeckCardGeneratedPayload>;
    return (
      typeof candidate.originalCardName === "string" &&
      typeof candidate.themedName === "string" &&
      typeof candidate.themedFlavorText === "string" &&
      typeof candidate.themedConcept === "string" &&
      typeof candidate.themedImagePrompt === "string" &&
      Array.isArray(candidate.constraintsApplied) &&
      candidate.constraintsApplied.every((entry) => typeof entry === "string")
    );
  });
};
