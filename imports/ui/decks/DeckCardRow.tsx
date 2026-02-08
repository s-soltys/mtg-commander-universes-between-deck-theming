import * as React from "react";
import type { DeckCardDoc } from "/imports/api/decks";

interface DeckCardRowProps {
  card: DeckCardDoc;
}

export const DeckCardRow = ({ card }: DeckCardRowProps) => {
  return (
    <li className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
      {card.imageUrl ? (
        <img alt={card.name} className="h-16 w-12 rounded object-cover" loading="lazy" src={card.imageUrl} />
      ) : (
        <div className="flex h-16 w-12 items-center justify-center rounded bg-slate-200 text-[10px] text-slate-500">
          No image
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-900">{card.name}</p>
        <p className="text-xs text-slate-500">Qty: {card.quantity}</p>
      </div>
    </li>
  );
};
