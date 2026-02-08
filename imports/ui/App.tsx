import * as React from "react";
import type { DeckCreateResult } from "/imports/api/decks";
import { DeckCreateForm } from "./decks/DeckCreateForm";
import { DeckListPage } from "./decks/DeckListPage";
import { DeckView } from "./decks/DeckView";

type AppPage =
  | { kind: "list" }
  | { kind: "create" }
  | { kind: "details"; deckId: string };

const getPageFromUrl = (): AppPage => {
  const pathname = window.location.pathname;

  if (pathname === "/create") {
    return { kind: "create" };
  }

  const match = pathname.match(/^\/decks\/([^/]+)$/);
  if (match) {
    const deckId = decodeURIComponent(match[1]).trim();
    if (deckId.length > 0) {
      return { kind: "details", deckId };
    }
  }

  return { kind: "list" };
};

export const App = () => {
  const [page, setPage] = React.useState<AppPage>(() => getPageFromUrl());
  const [lastCreateResult, setLastCreateResult] = React.useState<DeckCreateResult | null>(null);

  const navigateToPath = React.useCallback((path: string): void => {
    window.history.pushState({}, "", path);
    setPage(getPageFromUrl());
  }, []);

  React.useEffect(() => {
    const onPopState = () => {
      setPage(getPageFromUrl());
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const handleDeckCreated = (result: DeckCreateResult): void => {
    setLastCreateResult(result);
    navigateToPath(`/decks/${encodeURIComponent(result.deckId)}`);
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 md:px-6 md:py-10">
        <header>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">Commander Deck Share</h1>
          <p className="mt-1 text-sm text-slate-600">Create, store, and share MTG Commander deck lists with card images.</p>
          <nav className="mt-3 flex flex-wrap gap-4 text-sm font-medium">
            <a
              className={page.kind === "list" ? "text-red-700" : "text-slate-700 hover:text-red-700"}
              href="/"
              onClick={(event) => {
                event.preventDefault();
                navigateToPath("/");
              }}
            >
              Deck List
            </a>
            <a
              className={page.kind === "create" ? "text-red-700" : "text-slate-700 hover:text-red-700"}
              href="/create"
              onClick={(event) => {
                event.preventDefault();
                navigateToPath("/create");
              }}
            >
              Create Deck
            </a>
          </nav>
        </header>

        {page.kind === "list" ? <DeckListPage /> : null}

        {page.kind === "create" ? <DeckCreateForm onCreated={handleDeckCreated} /> : null}

        {page.kind === "details" ? (
          <DeckView
            deckId={page.deckId}
            onDeckCopied={(copiedDeckId) => navigateToPath(`/decks/${encodeURIComponent(copiedDeckId)}`)}
            unresolvedCardNames={lastCreateResult?.deckId === page.deckId ? lastCreateResult.unresolvedCardNames : []}
          />
        ) : null}
      </main>
    </div>
  );
};
