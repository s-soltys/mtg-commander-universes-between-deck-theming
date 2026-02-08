import * as React from "react";
import type { DeckCreateResult } from "/imports/api/decks";
import { DeckCreateForm } from "./decks/DeckCreateForm";
import { DeckListPage } from "./decks/DeckListPage";
import { DeckView } from "./decks/DeckView";
import { SettingsPage } from "./decks/SettingsPage";

type AppPage =
  | { kind: "list" }
  | { kind: "create" }
  | { kind: "settings" }
  | { kind: "details"; deckId: string };

const getPageFromUrl = (): AppPage => {
  const pathname = window.location.pathname;

  if (pathname === "/create") {
    return { kind: "create" };
  }

  if (pathname === "/settings") {
    return { kind: "settings" };
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
          <div className="flex items-start justify-between gap-3">
            <div>
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
            </div>
            {page.kind === "list" ? (
              <a
                aria-label="Open settings"
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 transition hover:border-slate-400 hover:text-slate-900"
                href="/settings"
                onClick={(event) => {
                  event.preventDefault();
                  navigateToPath("/settings");
                }}
                title="Settings"
              >
                <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path
                    d="M12 15.5A3.5 3.5 0 1 0 12 8.5a3.5 3.5 0 0 0 0 7Z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V21a2 2 0 1 1-4 0v-.2a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a2 2 0 0 1-2.8-2.8l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H3a2 2 0 1 1 0-4h.2a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9V3a2 2 0 1 1 4 0v.2a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6H21a2 2 0 1 1 0 4h-.2a1 1 0 0 0-.9.6Z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </a>
            ) : null}
          </div>
        </header>

        {page.kind === "list" ? <DeckListPage /> : null}

        {page.kind === "create" ? <DeckCreateForm onCreated={handleDeckCreated} /> : null}

        {page.kind === "settings" ? <SettingsPage /> : null}

        {page.kind === "details" ? (
          <DeckView
            deckId={page.deckId}
            onDeckCopied={(copiedDeckId) => navigateToPath(`/decks/${encodeURIComponent(copiedDeckId)}`)}
            onDeckDeleted={() => navigateToPath("/")}
            unresolvedCardNames={lastCreateResult?.deckId === page.deckId ? lastCreateResult.unresolvedCardNames : []}
          />
        ) : null}
      </main>
    </div>
  );
};
