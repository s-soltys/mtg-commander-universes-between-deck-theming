import * as React from "react";
import { useFind, useSubscribe } from "meteor/react-meteor-data";
import { DeckCardsCollection, DeckPublicationNames, DecksCollection } from "/imports/api/decks";
import type { DeckCardDoc, DeckDoc } from "/imports/api/decks";
import { DeckCardRow } from "./DeckCardRow";

interface DeckViewProps {
  deckId: string;
  unresolvedCardNames?: string[];
}

export const DeckView = ({ deckId, unresolvedCardNames = [] }: DeckViewProps) => {
  const isDeckLoading = useSubscribe(DeckPublicationNames.publicOne, deckId);
  const isCardsLoading = useSubscribe(DeckPublicationNames.cardsByDeck, deckId);

  const decks = useFind(() => DecksCollection.find({ _id: deckId })) as DeckDoc[];
  const cards = useFind(() => DeckCardsCollection.find({ deckId }, { sort: { name: 1 } })) as DeckCardDoc[];

  const isLoading = isDeckLoading() || isCardsLoading();
  const deck = decks[0];
  const cardCount = cards.reduce((sum, card) => sum + card.quantity, 0);

  if (isLoading) {
    return <p className="text-sm text-slate-500">Loading deck...</p>;
  }

  if (!deck) {
    return <p className="text-sm text-slate-500">Deck not found for id `{deckId}`.</p>;
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50 p-5 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">{deck.title}</h2>
          <p className="text-sm text-slate-600">Total cards: {cardCount}</p>
        </div>
      </div>

      {unresolvedCardNames.length > 0 ? (
        <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Missing image data for: {unresolvedCardNames.join(", ")}
        </div>
      ) : null}

      <ul className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        {cards.map((card) => (
          <DeckCardRow card={card} key={card._id ?? `${card.name}-${card.quantity}`} />
        ))}
      </ul>
    </section>
  );
};
