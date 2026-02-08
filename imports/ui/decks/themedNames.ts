import type { ThemedDeckCardDoc } from "/imports/api/decks";

export const buildThemedNameByOriginalCard = (
  themedCards: ThemedDeckCardDoc[],
): Map<string, string> => {
  const themedNameByOriginalCard = new Map<string, string>();

  for (const themedCard of themedCards) {
    if (!themedCard.themedName) {
      continue;
    }

    if (themedCard.status !== "generated" && themedCard.status !== "skipped") {
      continue;
    }

    themedNameByOriginalCard.set(themedCard.originalCardName, themedCard.themedName);
  }

  return themedNameByOriginalCard;
};
