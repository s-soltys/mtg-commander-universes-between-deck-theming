import type { ParsedDeckCard, ParsedDecklist } from "./types";

const HEADER_LINE_REGEX = /^(deck|commander|sideboard)$/i;
const COUNT_NAME_REGEX = /^(\d+)\s+(.+)$/;
const COUNT_X_NAME_REGEX = /^(\d+)[xX]\s+(.+)$/;

const normalizeCardName = (rawName: string): string => rawName.trim();

export const parseDecklist = (decklistText: string): ParsedDecklist => {
  const lines = decklistText.split(/\r?\n/);
  const ignoredLines: string[] = [];
  const invalidLines: string[] = [];
  const aggregatedCards = new Map<string, ParsedDeckCard>();

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (line.length === 0 || HEADER_LINE_REGEX.test(line)) {
      ignoredLines.push(rawLine);
      continue;
    }

    const match = line.match(COUNT_NAME_REGEX) ?? line.match(COUNT_X_NAME_REGEX);
    if (!match) {
      invalidLines.push(rawLine);
      continue;
    }

    const quantity = Number.parseInt(match[1], 10);
    const name = normalizeCardName(match[2]);

    if (!Number.isFinite(quantity) || quantity <= 0 || name.length === 0) {
      invalidLines.push(rawLine);
      continue;
    }

    const existing = aggregatedCards.get(name);
    if (existing) {
      existing.quantity += quantity;
      continue;
    }

    aggregatedCards.set(name, { name, quantity });
  }

  return {
    cards: [...aggregatedCards.values()],
    ignoredLines,
    invalidLines,
  };
};
