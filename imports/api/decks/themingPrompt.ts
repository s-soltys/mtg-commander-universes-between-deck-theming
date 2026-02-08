interface ThemingPromptInputCard {
  originalCardName: string;
  quantity: number;
  oracleText: string;
  typeLine: string;
  manaCost: string | null;
  isLegendary: boolean;
}

export interface BuildThemingPromptInput {
  themeUniverse: string;
  artStyleBrief: string;
  cards: ThemingPromptInputCard[];
}

export const THEMING_PROMPT_RULES = {
  global: [
    "You create Universe-Beyond style reskins for Magic cards.",
    "Preserve gameplay intent from the source card. Do not invent new mechanics.",
    "Output concise and production-safe text only.",
    "Use the full deck context to keep names and tone coherent.",
  ],
  cardTypeConstraints: [
    "Legendary cards must become a specific named character.",
    "Keep card identity coherent with source card type line (artifact stays artifact-themed, etc).",
    "Do not output alternative versions of basic lands (they are excluded from generation).",
  ],
  outputContract: [
    "Return strict JSON object with top-level key `cards`.",
    "Each `cards` item must include: originalCardName, themedName, themedFlavorText, themedConcept, themedImagePrompt, constraintsApplied.",
    "Keep `themedImagePrompt` short (max ~35 words).",
    "Keep `themedConcept` short (max ~30 words).",
    "constraintsApplied must be an array of short strings.",
  ],
} as const;

export const buildThemingPrompt = ({ themeUniverse, artStyleBrief, cards }: BuildThemingPromptInput): string => {
  const rules = [
    "GLOBAL RULES:",
    ...THEMING_PROMPT_RULES.global.map((rule) => `- ${rule}`),
    "",
    "CARD TYPE CONSTRAINTS:",
    ...THEMING_PROMPT_RULES.cardTypeConstraints.map((rule) => `- ${rule}`),
    "",
    "OUTPUT SCHEMA CONTRACT:",
    ...THEMING_PROMPT_RULES.outputContract.map((rule) => `- ${rule}`),
  ].join("\n");

  const cardPayload = cards.map((card) => ({
    originalCardName: card.originalCardName,
    quantity: card.quantity,
    oracleText: card.oracleText,
    typeLine: card.typeLine,
    manaCost: card.manaCost,
    isLegendary: card.isLegendary,
  }));

  return [
    "Create themed card reskins for this deck.",
    `Theme universe: ${themeUniverse}`,
    `Art style brief: ${artStyleBrief}`,
    rules,
    "",
    "CARDS JSON:",
    JSON.stringify(cardPayload),
  ].join("\n");
};
