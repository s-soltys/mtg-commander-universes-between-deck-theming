import type { ThemedDeckCardDoc } from "/imports/api/decks";

export interface ThemedCardDetails {
  themedName: string;
  themedDescription: string;
}

export const buildThemedDetailsByOriginalCard = (
  themedCards: ThemedDeckCardDoc[],
): Map<string, ThemedCardDetails> => {
  const themedDetailsByOriginalCard = new Map<string, ThemedCardDetails>();

  for (const themedCard of themedCards) {
    if (!themedCard.themedName) {
      continue;
    }

    if (themedCard.status !== "generated" && themedCard.status !== "skipped") {
      continue;
    }

    const themedDescription =
      themedCard.status === "skipped"
        ? "Basic land unchanged."
        : themedCard.themedConcept ?? themedCard.themedFlavorText ?? "No themed description available.";

    themedDetailsByOriginalCard.set(themedCard.originalCardName, {
      themedName: themedCard.themedName,
      themedDescription,
    });
  }

  return themedDetailsByOriginalCard;
};
