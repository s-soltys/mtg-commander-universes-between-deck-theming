import * as React from "react";
import type { DeckCardDoc } from "/imports/api/decks";

interface DeckCardRowProps {
  card: DeckCardDoc;
  themedName?: string | null;
  themedDescription?: string | null;
  themedImageUrl?: string | null;
  themedImageStatus?: "idle" | "generated" | "failed";
  themedImageError?: string | null;
  canGenerateThemedImage?: boolean;
  onGenerateThemedImage?: () => void;
}

export const DeckCardRow = ({
  card,
  themedName = null,
  themedDescription = null,
  themedImageUrl = null,
  themedImageStatus = "idle",
  themedImageError = null,
  canGenerateThemedImage = false,
  onGenerateThemedImage,
}: DeckCardRowProps) => {
  return (
    <li className="grid min-h-80 grid-cols-2 gap-4 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex min-h-0 flex-col">
        <p className="text-sm font-semibold text-slate-900">{card.name}</p>
        <div className="mt-3 flex min-h-0 flex-1 items-center justify-center rounded-md border border-slate-200 bg-slate-50 p-2">
          {card.imageUrl ? (
            <img alt={card.name} className="h-full max-h-64 w-auto rounded object-contain" loading="lazy" src={card.imageUrl} />
          ) : (
            <div className="flex h-full min-h-40 w-full items-center justify-center rounded bg-slate-200 text-xs text-slate-500">
              No image
            </div>
          )}
        </div>
        <p className="text-xs text-slate-500">Qty: {card.quantity}</p>
      </div>

      <div className="flex min-h-0 flex-col">
        <p className="text-sm font-semibold text-slate-900">{themedName ?? "Theme not generated yet"}</p>
        {themedImageUrl ? (
          <div className="mt-3 flex min-h-0 flex-1 items-center justify-center rounded-md border border-slate-200 bg-slate-50 p-2">
            <img
              alt={`${themedName ?? card.name} themed art`}
              className="h-full max-h-64 w-auto rounded object-contain"
              loading="lazy"
              src={themedImageUrl}
            />
          </div>
        ) : null}
        <p className="mt-3 whitespace-pre-wrap text-sm leading-5 text-slate-700">
          {themedDescription ?? "Run deck theming to generate themed card details."}
        </p>
        {themedImageStatus === "failed" && themedImageError ? (
          <p className="mt-2 text-sm text-red-600">{themedImageError}</p>
        ) : null}
        <div className="mt-3">
          <button
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!canGenerateThemedImage}
            onClick={onGenerateThemedImage}
            type="button"
          >
            {themedImageUrl ? "Re-generate image" : "Generate image"}
          </button>
        </div>
      </div>
    </li>
  );
};
