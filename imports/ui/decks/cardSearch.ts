import type { DeckCardDoc, ThemedDeckCardDoc } from "/imports/api/decks";

export type DeckCardViewFilter =
  | "all"
  | "withGeneratedImage"
  | "withoutGeneratedImage"
  | "withGeneratedThemedCard";

export const filterDeckCardsByOriginalTitle = (cards: DeckCardDoc[], search: string): DeckCardDoc[] => {
  const query = search.trim().toLocaleLowerCase();
  if (query.length === 0) {
    return cards;
  }

  return cards.filter((card) => card.name.toLocaleLowerCase().includes(query));
};

export const filterDeckCardsByViewFilter = (
  cards: DeckCardDoc[],
  themedCardsByOriginalName: Map<string, ThemedDeckCardDoc>,
  viewFilter: DeckCardViewFilter,
): DeckCardDoc[] => {
  if (viewFilter === "all") {
    return cards;
  }

  return cards.filter((card) => {
    const themedCard = themedCardsByOriginalName.get(card.name);
    const hasGeneratedImage =
      themedCard?.status === "generated" &&
      themedCard.themedGeneratedImageStatus === "generated" &&
      typeof themedCard.themedGeneratedImageUrl === "string" &&
      themedCard.themedGeneratedImageUrl.length > 0;

    if (viewFilter === "withGeneratedImage") {
      return hasGeneratedImage;
    }

    if (viewFilter === "withoutGeneratedImage") {
      return !hasGeneratedImage;
    }

    return (
      themedCard?.status === "generated" &&
      themedCard.themedCompositeImageStatus === "generated" &&
      typeof themedCard.themedCompositeImageUrl === "string" &&
      themedCard.themedCompositeImageUrl.length > 0
    );
  });
};
