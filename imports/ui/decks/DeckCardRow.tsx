import * as React from "react";
import type { DeckCardDoc } from "/imports/api/decks";

interface DeckCardRowProps {
  card: DeckCardDoc;
  themedName?: string | null;
  themedDescription?: string | null;
}

export const DeckCardRow = ({ card, themedName = null, themedDescription = null }: DeckCardRowProps) => {
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
        <p className="mt-3 whitespace-pre-wrap text-sm leading-5 text-slate-700">
          {themedDescription ?? "Run deck theming to generate themed card details."}
        </p>
      </div>
    </li>
  );
};
