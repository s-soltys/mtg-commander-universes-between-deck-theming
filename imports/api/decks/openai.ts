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

interface ResponsesApiResponse {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
}

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const OPENAI_IMAGE_GENERATIONS_URL = "https://api.openai.com/v1/images/generations";
const DEFAULT_MODEL = "gpt-5-mini";
const DEFAULT_IMAGE_MODEL = "gpt-image-1.5";

export const generateDeckThemeWithOpenAI = async (
  input: OpenAIThemeDeckInput,
): Promise<ThemedDeckCardGeneratedPayload[]> => {
  const apiKey = await getOpenAIApiKeyForRuntime();
  if (!apiKey) {
    console.error("[openai] Missing OPENAI_API_KEY at runtime. Verify .env/.env.local and restart Meteor.");
    throw new Error("Missing OPENAI_API_KEY.");
  }

  const prompt = buildThemingPrompt(input);

  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      text: {
        format: {
          type: "json_schema",
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
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: "You are an expert MTG Universe-Beyond card themer.",
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: prompt,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    let errBody: unknown = body;
    try {
      errBody = body ? JSON.parse(body) : body;
    } catch {
      // keep as text
    }

    console.error("[openai] Deck theming request failed:", {
      status: response.status,
      statusText: response.statusText,
      body: errBody,
      model: DEFAULT_MODEL,
      cardsCount: input.cards.length,
    });

    throw new Error(`OpenAI request failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as ResponsesApiResponse | ChatCompletionsResponse;
  const content = extractStructuredContent(payload);
  if (!content) {
    throw new Error("OpenAI returned empty content.");
  }

  const parsed = safeParseJson(content);
  if (!parsed || !isGeneratedCardPayload(parsed)) {
    throw new Error("OpenAI returned invalid themed card payload.");
  }

  return parsed.cards;
};

const extractStructuredContent = (payload: ResponsesApiResponse | ChatCompletionsResponse): string | null => {
  if ("output_text" in payload && typeof payload.output_text === "string" && payload.output_text.trim().length > 0) {
    return payload.output_text;
  }

  if ("output" in payload && Array.isArray(payload.output)) {
    for (const item of payload.output) {
      const contentItems = item.content;
      if (!Array.isArray(contentItems)) {
        continue;
      }

      for (const part of contentItems) {
        if (part.type === "output_text" && typeof part.text === "string" && part.text.trim().length > 0) {
          return part.text;
        }
      }
    }
  }

  const chatCompletionsContent = payload.choices?.[0]?.message?.content;
  if (typeof chatCompletionsContent === "string" && chatCompletionsContent.trim().length > 0) {
    return chatCompletionsContent;
  }

  return null;
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
      size: "1536x1024",
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    let errBody: unknown = body;
    try {
      errBody = body ? JSON.parse(body) : body;
    } catch {
      // keep as text
    }
    console.error("[openai] Image generation failed:", {
      status: response.status,
      statusText: response.statusText,
      body: errBody,
      promptLength: prompt.length,
    });
    throw new Error(`OpenAI image request failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as {
    data?: Array<{ url?: unknown; b64_json?: unknown }>;
    error?: unknown;
  };
  const first = payload.data?.[0];
  if (!first) {
    console.error("[openai] Image response missing data array or first item:", {
      hasData: Array.isArray(payload.data),
      dataLength: payload.data?.length ?? 0,
      payloadKeys: Object.keys(payload),
      error: payload.error,
    });
    throw new Error("OpenAI image response missing data.");
  }

  if (typeof first.url === "string" && first.url.trim().length > 0) {
    return first.url;
  }

  if (typeof first.b64_json === "string" && first.b64_json.trim().length > 0) {
    return `data:image/png;base64,${first.b64_json}`;
  }

  console.error("[openai] Image response missing URL and b64_json:", {
    hasUrl: "url" in first,
    urlType: typeof first.url,
    hasB64: "b64_json" in first,
    b64Type: typeof first.b64_json,
  });
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
