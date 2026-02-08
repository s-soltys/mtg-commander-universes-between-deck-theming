import * as React from "react";
import type { DeckCardDoc } from "/imports/api/decks";

interface DeckCardRowProps {
  card: DeckCardDoc;
  themedName?: string | null;
  themedDescription?: string | null;
  themedImageUrl?: string | null;
  themedImageStatus?: "idle" | "generating" | "generated" | "failed";
  themedImageError?: string | null;
  themedCompositeImageUrl?: string | null;
  themedCompositeImageStatus?: "idle" | "generating" | "generated" | "failed";
  themedCompositeImageError?: string | null;
  canGenerateThemedImage?: boolean;
  onGenerateThemedImage?: () => void;
  showGenerateThemedCardButton?: boolean;
  canGenerateThemedCard?: boolean;
  onGenerateThemedCard?: () => void;
}

export const DeckCardRow = ({
  card,
  themedName = null,
  themedDescription = null,
  themedImageUrl = null,
  themedImageStatus = "idle",
  themedImageError = null,
  themedCompositeImageUrl = null,
  themedCompositeImageStatus = "idle",
  themedCompositeImageError = null,
  canGenerateThemedImage = false,
  onGenerateThemedImage,
  showGenerateThemedCardButton = false,
  canGenerateThemedCard = false,
  onGenerateThemedCard,
}: DeckCardRowProps) => {
  const imageStatusLabel = getImageStatusLabel(themedImageStatus);
  const imageStatusClassName = getImageStatusClassName(themedImageStatus);
  const compositeStatusLabel = getCompositeStatusLabel(themedCompositeImageStatus);
  const compositeStatusClassName = getCompositeStatusClassName(themedCompositeImageStatus);
  const isImageGenerating = themedImageStatus === "generating";

  return (
    <li className="grid min-h-80 grid-cols-1 gap-4 rounded-lg border border-slate-200 bg-white p-4 xl:grid-cols-3">
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
        <div className="mt-3">
          <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${imageStatusClassName}`}>
            {imageStatusLabel}
          </span>
        </div>
        {themedImageStatus === "failed" && themedImageError ? (
          <p className="mt-2 text-sm text-red-600">{themedImageError}</p>
        ) : null}
        <div className="mt-3">
          <button
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!canGenerateThemedImage || isImageGenerating}
            onClick={onGenerateThemedImage}
            type="button"
          >
            {isImageGenerating ? "Generating image..." : themedImageUrl ? "Re-generate image" : "Generate image"}
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-col">
        <p className="text-sm font-semibold text-slate-900">Themed card render</p>
        {themedCompositeImageUrl ? (
          <div className="mt-3 flex min-h-0 flex-1 items-center justify-center rounded-md border border-slate-200 bg-slate-50 p-2">
            <img
              alt={`${themedName ?? card.name} themed card`}
              className="h-full max-h-64 w-auto rounded object-contain"
              loading="lazy"
              src={themedCompositeImageUrl}
            />
          </div>
        ) : (
          <div className="mt-3 flex min-h-40 items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50 p-2 text-xs text-slate-500">
            Themed card not generated yet.
          </div>
        )}

        <div className="mt-3">
          <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${compositeStatusClassName}`}>
            {compositeStatusLabel}
          </span>
        </div>

        {themedCompositeImageStatus === "failed" && themedCompositeImageError ? (
          <p className="mt-2 text-sm text-red-600">{themedCompositeImageError}</p>
        ) : null}

        {showGenerateThemedCardButton ? (
          <div className="mt-3">
            <button
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!canGenerateThemedCard}
              onClick={onGenerateThemedCard}
              type="button"
            >
              {themedCompositeImageUrl ? "Re-create themed card" : "Create themed card"}
            </button>
          </div>
        ) : (
          <p className="mt-3 text-xs text-slate-500">Generate themed art first to enable card compositing.</p>
        )}
      </div>
    </li>
  );
};

const getImageStatusLabel = (status: "idle" | "generating" | "generated" | "failed"): string => {
  if (status === "generating") {
    return "Generating";
  }

  if (status === "generated") {
    return "Generated";
  }

  if (status === "failed") {
    return "Failed";
  }

  return "Idle";
};

const getImageStatusClassName = (status: "idle" | "generating" | "generated" | "failed"): string => {
  if (status === "generating") {
    return "border-blue-300 bg-blue-50 text-blue-700";
  }

  if (status === "generated") {
    return "border-emerald-300 bg-emerald-50 text-emerald-700";
  }

  if (status === "failed") {
    return "border-red-300 bg-red-50 text-red-700";
  }

  return "border-slate-300 bg-slate-100 text-slate-700";
};

const getCompositeStatusLabel = (status: "idle" | "generating" | "generated" | "failed"): string => {
  if (status === "generating") {
    return "Generating";
  }

  if (status === "generated") {
    return "Generated";
  }

  if (status === "failed") {
    return "Failed";
  }

  return "Idle";
};

const getCompositeStatusClassName = (status: "idle" | "generating" | "generated" | "failed"): string => {
  if (status === "generating") {
    return "border-blue-300 bg-blue-50 text-blue-700";
  }

  if (status === "generated") {
    return "border-emerald-300 bg-emerald-50 text-emerald-700";
  }

  if (status === "failed") {
    return "border-red-300 bg-red-50 text-red-700";
  }

  return "border-slate-300 bg-slate-100 text-slate-700";
};
