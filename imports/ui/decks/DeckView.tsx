import * as React from "react";
import { Meteor } from "meteor/meteor";
import { useFind, useSubscribe } from "meteor/react-meteor-data";
import {
  DeckCardsCollection,
  DeckMethodNames,
  DeckPublicationNames,
  DecksCollection,
  ThemedDeckCardsCollection,
} from "/imports/api/decks";
import type {
  DeckCardDoc,
  DeckCopyResult,
  DeckDoc,
  DeckThemeImageGenerateForCardResult,
  DeckThemeStartResult,
  ThemedDeckCardDoc,
} from "/imports/api/decks";
import { DeckCardRow } from "./DeckCardRow";
import { buildThemedDetailsByOriginalCard, type ThemedCardDetails } from "./themedNames";

interface DeckViewProps {
  deckId: string;
  onDeckCopied: (deckId: string) => void;
  onDeckDeleted: () => void;
  unresolvedCardNames?: string[];
}

export const DeckView = ({ deckId, onDeckCopied, onDeckDeleted, unresolvedCardNames = [] }: DeckViewProps) => {
  const isDeckLoading = useSubscribe(DeckPublicationNames.publicOne, deckId);
  const isCardsLoading = useSubscribe(DeckPublicationNames.cardsByDeck, deckId);
  const isThemedCardsLoading = useSubscribe(DeckPublicationNames.themedCardsByDeck, deckId);

  const decks = useFind(() => DecksCollection.find({ _id: deckId })) as DeckDoc[];
  const cards = useFind(() => DeckCardsCollection.find({ deckId }, { sort: { name: 1 } })) as DeckCardDoc[];
  const themedCards = useFind(() =>
    ThemedDeckCardsCollection.find({ deckId }, { sort: { originalCardName: 1 } }),
  ) as ThemedDeckCardDoc[];

  const [isThemeModalOpen, setIsThemeModalOpen] = React.useState<boolean>(false);
  const [themeUniverse, setThemeUniverse] = React.useState<string>("");
  const [artStyleBrief, setArtStyleBrief] = React.useState<string>("");
  const [confirmDiscardPrevious, setConfirmDiscardPrevious] = React.useState<boolean>(false);
  const [isStartingTheme, setIsStartingTheme] = React.useState<boolean>(false);
  const [themeErrorMessage, setThemeErrorMessage] = React.useState<string | null>(null);
  const [isCopyModalOpen, setIsCopyModalOpen] = React.useState<boolean>(false);
  const [copyTitle, setCopyTitle] = React.useState<string>("");
  const [isCopying, setIsCopying] = React.useState<boolean>(false);
  const [copyErrorMessage, setCopyErrorMessage] = React.useState<string | null>(null);
  const [isDeleting, setIsDeleting] = React.useState<boolean>(false);
  const [isImageModalOpen, setIsImageModalOpen] = React.useState<boolean>(false);
  const [imageModalCardName, setImageModalCardName] = React.useState<string>("");
  const [imageModalThemedName, setImageModalThemedName] = React.useState<string>("");
  const [imageModalPrompt, setImageModalPrompt] = React.useState<string>("");
  const [isGeneratingImage, setIsGeneratingImage] = React.useState<boolean>(false);
  const [imageGenerationError, setImageGenerationError] = React.useState<string | null>(null);
  const [imageGenerationSummary, setImageGenerationSummary] = React.useState<string | null>(null);

  const isLoading = isDeckLoading() || isCardsLoading() || isThemedCardsLoading();
  const deck = decks[0];
  const cardCount = cards.reduce((sum, card) => sum + card.quantity, 0);
  const themedDetailsByOriginalCard = React.useMemo(
    () =>
      deck?.themingStatus === "completed"
        ? buildThemedDetailsByOriginalCard(themedCards)
        : new Map<string, ThemedCardDetails>(),
    [deck?.themingStatus, themedCards],
  );
  const themedCardsByOriginalName = React.useMemo(
    () => new Map(themedCards.map((card) => [card.originalCardName, card])),
    [themedCards],
  );

  if (isLoading) {
    return <p className="text-sm text-slate-500">Loading deck...</p>;
  }

  if (!deck) {
    return <p className="text-sm text-slate-500">Deck not found for id `{deckId}`.</p>;
  }

  const isThemeButtonDisabled = deck.themingStatus === "running";
  const requiresDiscardConfirmation =
    deck.themingStatus === "completed" || deck.themingStatus === "failed";

  const handleThemeSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setThemeErrorMessage(null);
    setIsStartingTheme(true);

    try {
      await Meteor.callAsync<DeckThemeStartResult>(DeckMethodNames.startTheming, {
        deckId,
        themeUniverse,
        artStyleBrief,
        confirmDiscardPrevious,
      });

      setIsThemeModalOpen(false);
      setThemeUniverse("");
      setArtStyleBrief("");
      setConfirmDiscardPrevious(false);
    } catch (error) {
      if (error instanceof Error && error.message.trim().length > 0) {
        setThemeErrorMessage(error.message);
      } else {
        setThemeErrorMessage("Failed to start deck theming.");
      }
    } finally {
      setIsStartingTheme(false);
    }
  };

  const openCopyModal = () => {
    setCopyErrorMessage(null);
    setCopyTitle(`${deck.title} (Copy)`);
    setIsCopyModalOpen(true);
  };

  const handleCopySubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsCopying(true);
    setCopyErrorMessage(null);

    try {
      const result = await Meteor.callAsync<DeckCopyResult>(DeckMethodNames.copy, {
        sourceDeckId: deckId,
        title: copyTitle,
      });

      setIsCopyModalOpen(false);
      onDeckCopied(result.deckId);
    } catch (error) {
      if (error instanceof Error && error.message.trim().length > 0) {
        setCopyErrorMessage(error.message);
      } else {
        setCopyErrorMessage("Failed to copy deck.");
      }
    } finally {
      setIsCopying(false);
    }
  };

  const handleDeleteDeck = async () => {
    const shouldDelete = window.confirm(`Delete deck "${deck.title}"? This cannot be undone.`);
    if (!shouldDelete) {
      return;
    }

    setIsDeleting(true);
    try {
      await Meteor.callAsync(DeckMethodNames.delete, { deckId });
      onDeckDeleted();
    } catch (error) {
      if (error instanceof Error && error.message.trim().length > 0) {
        window.alert(error.message);
      } else {
        window.alert("Failed to delete deck.");
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const handleGenerateImageForCard = async (originalCardName: string) => {
    const themedCard = themedCardsByOriginalName.get(originalCardName);
    if (!themedCard) {
      return;
    }

    setImageGenerationError(null);
    setImageGenerationSummary(null);
    setImageModalCardName(originalCardName);
    setImageModalThemedName(themedCard.themedName ?? originalCardName);
    setImageModalPrompt(themedCard.themedImagePrompt ?? "");
    setIsImageModalOpen(true);
  };

  const handleGenerateImageSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setImageGenerationError(null);
    setImageGenerationSummary(null);
    setIsGeneratingImage(true);

    try {
      const result = await Meteor.callAsync<DeckThemeImageGenerateForCardResult>(
        DeckMethodNames.generateThemedImageForCard,
        {
          deckId,
          originalCardName: imageModalCardName,
          themedName: imageModalThemedName,
          themedImagePrompt: imageModalPrompt,
          forceRegenerate: true,
        },
      );

      setImageGenerationSummary(
        result.generated
          ? `Generated image for ${result.originalCardName}.`
          : `Skipped image generation for ${result.originalCardName}.`,
      );
      setIsImageModalOpen(false);
    } catch (error) {
      if (error instanceof Error && error.message.trim().length > 0) {
        setImageGenerationError(error.message);
      } else {
        setImageGenerationError(`Failed to generate image for ${imageModalCardName}.`);
      }
    } finally {
      setIsGeneratingImage(false);
    }
  };

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Deck Theme</h3>
            <p className="mt-1 text-sm text-slate-600 capitalize">Status: {deck.themingStatus}</p>
            {deck.themingThemeUniverse ? (
              <p className="mt-2 text-sm text-slate-700">
                <span className="font-medium text-slate-900">Universe:</span> {deck.themingThemeUniverse}
              </p>
            ) : (
              <p className="mt-2 text-sm text-slate-500">No theme applied yet.</p>
            )}
            {deck.themingArtStyleBrief ? (
              <p className="mt-1 text-sm text-slate-700">
                <span className="font-medium text-slate-900">Art style:</span> {deck.themingArtStyleBrief}
              </p>
            ) : null}
          </div>
          <button
            className="inline-flex cursor-pointer items-center rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isThemeButtonDisabled || isStartingTheme}
            onClick={() => {
              setThemeErrorMessage(null);
              setConfirmDiscardPrevious(false);
              setIsThemeModalOpen(true);
            }}
            type="button"
          >
            {deck.themingStatus === "completed" ? "Re-theme Deck" : "Theme Deck"}
          </button>
        </div>

        {deck.themingStatus === "running" ? (
          <div className="mt-4 rounded-lg border border-blue-300 bg-blue-50 p-3 text-sm text-blue-900">
            Generating themed deck...
          </div>
        ) : null}

        {deck.themingStatus === "failed" ? (
          <div className="mt-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
            Deck theming failed: {deck.themingError ?? "Unknown error."}
          </div>
        ) : null}

        {imageGenerationSummary ? (
          <div className="mt-4 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800">
            {imageGenerationSummary}
          </div>
        ) : null}

        {imageGenerationError ? (
          <div className="mt-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
            Image generation failed: {imageGenerationError}
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">{deck.title}</h2>
            <p className="text-sm text-slate-600">Total cards: {cardCount}</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100"
            onClick={openCopyModal}
            type="button"
          >
            Copy Deck
          </button>
          <button
            className="rounded-lg border border-red-300 px-3 py-2 text-sm text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isDeleting}
            onClick={handleDeleteDeck}
            type="button"
          >
            {isDeleting ? "Deleting..." : "Delete Deck"}
          </button>
        </div>

        {unresolvedCardNames.length > 0 ? (
          <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            Missing image data for: {unresolvedCardNames.join(", ")}
          </div>
        ) : null}

        <ul className="mt-4 grid grid-cols-1 gap-3">
          {cards.map((card) => {
            const themedDetails = themedDetailsByOriginalCard.get(card.name);
            const themedCard = themedCardsByOriginalName.get(card.name);
            const canGenerateThemedImage =
              deck.themingStatus === "completed" && themedCard?.status === "generated";

            return (
              <DeckCardRow
                card={card}
                canGenerateThemedImage={canGenerateThemedImage}
                key={card._id ?? `${card.name}-${card.quantity}`}
                onGenerateThemedImage={() => void handleGenerateImageForCard(card.name)}
                themedDescription={themedDetails?.themedDescription ?? null}
                themedImageError={themedDetails?.themedImageError ?? null}
                themedImageStatus={themedDetails?.themedImageStatus ?? "idle"}
                themedImageUrl={themedDetails?.themedImageUrl ?? null}
                themedName={themedDetails?.themedName ?? null}
              />
            );
          })}
        </ul>
      </div>

      {isThemeModalOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 px-4">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-lg md:p-6">
            <h3 className="text-lg font-semibold text-slate-900">Theme Deck</h3>
            <p className="mt-1 text-sm text-slate-600">Provide a universe theme and visual style brief.</p>

            <form className="mt-4 space-y-4" onSubmit={handleThemeSubmit}>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Theme universe</span>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none ring-red-500/40 transition focus:ring"
                  onChange={(event) => setThemeUniverse(event.target.value)}
                  placeholder="The Lord of the Rings"
                  required
                  type="text"
                  value={themeUniverse}
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Art style brief</span>
                <textarea
                  className="h-28 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-red-500/40 transition focus:ring"
                  onChange={(event) => setArtStyleBrief(event.target.value)}
                  placeholder="Cinematic realism with warm lighting and detailed costumes"
                  required
                  value={artStyleBrief}
                />
              </label>

              {requiresDiscardConfirmation ? (
                <label className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                  <input
                    checked={confirmDiscardPrevious}
                    className="mt-0.5 h-4 w-4"
                    onChange={(event) => setConfirmDiscardPrevious(event.target.checked)}
                    type="checkbox"
                  />
                  <span>
                    Confirm re-theming and discard all previously generated themed cards for this deck.
                  </span>
                </label>
              ) : null}

              {themeErrorMessage ? <p className="text-sm text-red-600">{themeErrorMessage}</p> : null}

              <div className="flex items-center justify-end gap-2">
                <button
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100"
                  onClick={() => {
                    setThemeErrorMessage(null);
                    setConfirmDiscardPrevious(false);
                    setIsThemeModalOpen(false);
                  }}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="inline-flex cursor-pointer items-center rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isStartingTheme || (requiresDiscardConfirmation && !confirmDiscardPrevious)}
                  type="submit"
                >
                  {isStartingTheme ? "Starting..." : "Start Theming"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {isCopyModalOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 px-4">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-lg md:p-6">
            <h3 className="text-lg font-semibold text-slate-900">Copy Deck</h3>
            <p className="mt-1 text-sm text-slate-600">Provide a new title for the copied decklist.</p>

            <form className="mt-4 space-y-4" onSubmit={handleCopySubmit}>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">New deck title</span>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none ring-red-500/40 transition focus:ring"
                  onChange={(event) => setCopyTitle(event.target.value)}
                  required
                  type="text"
                  value={copyTitle}
                />
              </label>

              {copyErrorMessage ? <p className="text-sm text-red-600">{copyErrorMessage}</p> : null}

              <div className="flex items-center justify-end gap-2">
                <button
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100"
                  onClick={() => {
                    setCopyErrorMessage(null);
                    setIsCopyModalOpen(false);
                  }}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="inline-flex cursor-pointer items-center rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isCopying}
                  type="submit"
                >
                  {isCopying ? "Copying..." : "Copy decklist"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {isImageModalOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 px-4">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-lg md:p-6">
            <h3 className="text-lg font-semibold text-slate-900">Generate image</h3>
            <p className="mt-1 text-sm text-slate-600">Edit themed card title and prompt before generating.</p>

            <form className="mt-4 space-y-4" onSubmit={handleGenerateImageSubmit}>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Themed card title</span>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none ring-red-500/40 transition focus:ring"
                  onChange={(event) => setImageModalThemedName(event.target.value)}
                  required
                  type="text"
                  value={imageModalThemedName}
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Image prompt</span>
                <textarea
                  className="h-28 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-red-500/40 transition focus:ring"
                  onChange={(event) => setImageModalPrompt(event.target.value)}
                  required
                  value={imageModalPrompt}
                />
              </label>

              {imageGenerationError ? <p className="text-sm text-red-600">{imageGenerationError}</p> : null}

              <div className="flex items-center justify-end gap-2">
                <button
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100"
                  onClick={() => {
                    setImageGenerationError(null);
                    setIsImageModalOpen(false);
                  }}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="inline-flex cursor-pointer items-center rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isGeneratingImage || imageModalThemedName.trim().length === 0 || imageModalPrompt.trim().length === 0}
                  type="submit"
                >
                  {isGeneratingImage ? "Generating..." : "Generate image"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
};
