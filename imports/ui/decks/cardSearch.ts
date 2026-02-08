import type { DeckCardDoc } from "/imports/api/decks";

export const filterDeckCardsByOriginalTitle = (cards: DeckCardDoc[], search: string): DeckCardDoc[] => {
  const query = search.trim().toLocaleLowerCase();
  if (query.length === 0) {
    return cards;
  }

  return cards.filter((card) => card.name.toLocaleLowerCase().includes(query));
};
