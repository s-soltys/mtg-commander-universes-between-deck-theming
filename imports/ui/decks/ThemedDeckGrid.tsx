import * as React from "react";
import { useFind, useSubscribe } from "meteor/react-meteor-data";
import { DeckPublicationNames, ThemedDeckCardsCollection } from "/imports/api/decks";
import type { ThemedDeckCardDoc } from "/imports/api/decks";

interface ThemedDeckGridProps {
  deckId: string;
}

export const ThemedDeckGrid = ({ deckId }: ThemedDeckGridProps) => {
  const isLoadingSubscription = useSubscribe(DeckPublicationNames.themedCardsByDeck, deckId);
  const themedCards = useFind(() =>
    ThemedDeckCardsCollection.find({ deckId }, { sort: { originalCardName: 1 } }),
  ) as ThemedDeckCardDoc[];

  if (isLoadingSubscription()) {
    return <p className="text-sm text-slate-500">Loading themed cards...</p>;
  }

  if (themedCards.length === 0) {
    return <p className="text-sm text-slate-500">No themed cards generated yet.</p>;
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 md:p-6">
      <h3 className="text-lg font-semibold text-slate-900">Themed Deck</h3>
      <ul className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
        {themedCards.map((card) => (
          <li className="rounded-lg border border-slate-200 bg-slate-50 p-3" key={card._id ?? card.originalCardName}>
            <p className="text-xs uppercase tracking-wide text-slate-500">{card.originalCardName}</p>
            <p className="mt-1 text-sm text-slate-600">Qty: {card.quantity}</p>

            {card.status === "generated" ? (
              <>
                <p className="mt-2 text-sm font-semibold text-slate-900">{card.themedName}</p>
                <p className="mt-1 text-sm text-slate-700">{card.themedConcept}</p>
                <p className="mt-1 text-xs text-slate-600">Prompt: {card.themedImagePrompt}</p>
              </>
            ) : null}

            {card.status === "skipped" ? (
              <p className="mt-2 text-sm text-slate-700">Skipped: Basic land unchanged.</p>
            ) : null}

            {card.status === "failed" ? (
              <p className="mt-2 text-sm text-red-600">Failed: {card.errorMessage ?? "Unknown error."}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
};
