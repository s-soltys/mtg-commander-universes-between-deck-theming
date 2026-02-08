import * as React from "react";
import type { DeckCreateResult } from "/imports/api/decks";
import { DeckCreateForm } from "./decks/DeckCreateForm";
import { DeckView } from "./decks/DeckView";

const getDeckIdFromUrl = (): string | null => {
  const params = new URLSearchParams(window.location.search);
  const deckId = params.get("deck");
  return deckId && deckId.trim().length > 0 ? deckId.trim() : null;
};

const setDeckIdInUrl = (deckId: string): void => {
  const url = new URL(window.location.href);
  url.searchParams.set("deck", deckId);
  window.history.pushState({}, "", url);
};

const getShareUrl = (deckId: string): string => {
  const url = new URL(window.location.href);
  url.searchParams.set("deck", deckId);
  return url.toString();
};

export const App = () => {
  const [deckId, setDeckId] = React.useState<string | null>(() => getDeckIdFromUrl());
  const [lastCreateResult, setLastCreateResult] = React.useState<DeckCreateResult | null>(null);

  React.useEffect(() => {
    const onPopState = () => {
      setDeckId(getDeckIdFromUrl());
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const handleDeckCreated = (result: DeckCreateResult): void => {
    setLastCreateResult(result);
    setDeckId(result.deckId);
    setDeckIdInUrl(result.deckId);
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 md:px-6 md:py-10">
        <header>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">Commander Deck Share</h1>
          <p className="mt-1 text-sm text-slate-600">Create, store, and share MTG Commander deck lists with card images.</p>
        </header>

        <DeckCreateForm onCreated={handleDeckCreated} />

        {deckId ? (
          <section className="space-y-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
              <p className="font-medium text-slate-900">Share URL</p>
              <p className="mt-1 break-all">{getShareUrl(deckId)}</p>
            </div>
            <DeckView
              deckId={deckId}
              unresolvedCardNames={
                lastCreateResult?.deckId === deckId ? lastCreateResult.unresolvedCardNames : []
              }
            />
          </section>
        ) : (
          <p className="text-sm text-slate-500">Create a deck to get a shareable URL.</p>
        )}
      </main>
    </div>
  );
};
