import * as React from "react";
import { useFind, useSubscribe } from "meteor/react-meteor-data";
import { DeckPublicationNames, DecksCollection } from "/imports/api/decks";
import type { DeckDoc } from "/imports/api/decks";

const formatDateTime = (value: Date): string => value.toLocaleString();

const getStatusTone = (status: DeckDoc["themingStatus"]): string => {
  if (status === "completed") {
    return "bg-emerald-100 text-emerald-800";
  }

  if (status === "running") {
    return "bg-blue-100 text-blue-800";
  }

  if (status === "failed") {
    return "bg-red-100 text-red-800";
  }

  return "bg-slate-200 text-slate-700";
};

export const DeckListPage = () => {
  const isDecksLoading = useSubscribe(DeckPublicationNames.list);
  const decks = useFind(() => DecksCollection.find({}, { sort: { updatedAt: -1, createdAt: -1 } })) as DeckDoc[];

  if (isDecksLoading() && decks.length === 0) {
    return <p className="text-sm text-slate-500">Loading decks...</p>;
  }

  if (decks.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm md:p-6">
        No decks yet. <a className="font-medium text-red-700 hover:text-red-600" href="/">Create your first deck.</a>
      </div>
    );
  }

  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold text-slate-900">All Decks</h2>
      <ul className="space-y-2">
        {decks.map((deck) => {
          const deckId = deck._id;
          const deckHref = deckId ? `/?deck=${deckId}` : "/";

          return (
            <li className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm" key={deckId ?? deck.title}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <a className="text-base font-semibold text-slate-900 hover:text-red-700" href={deckHref}>
                    {deck.title}
                  </a>
                  <p className="mt-1 text-xs text-slate-500">
                    Created {formatDateTime(deck.createdAt)} | Updated {formatDateTime(deck.updatedAt)}
                  </p>
                </div>
                <span
                  className={`inline-flex rounded-full px-2 py-1 text-xs font-medium capitalize ${getStatusTone(deck.themingStatus)}`}
                >
                  {deck.themingStatus}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
};
