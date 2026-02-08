import * as React from "react";
import { Meteor } from "meteor/meteor";
import { DeckMethodNames } from "/imports/api/decks";
import type { DeckCreateResult } from "/imports/api/decks";

interface DeckCreateFormProps {
  onCreated: (result: DeckCreateResult) => void;
}

export const DeckCreateForm = ({ onCreated }: DeckCreateFormProps) => {
  const [title, setTitle] = React.useState<string>("");
  const [decklistText, setDecklistText] = React.useState<string>("");
  const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const result = await Meteor.callAsync<DeckCreateResult>(DeckMethodNames.create, {
        title,
        decklistText,
      });

      onCreated(result);
      setTitle("");
      setDecklistText("");
    } catch (error) {
      const fallbackMessage = "Failed to create deck.";
      if (error instanceof Error && error.message.trim().length > 0) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage(fallbackMessage);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
      <h2 className="text-lg font-semibold text-slate-900">Create Commander Deck</h2>
      <p className="mt-1 text-sm text-slate-500">
        Paste one card per line using `quantity + card name` (example: `1 Sol Ring`).
      </p>

      <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Deck title</span>
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none ring-red-500/40 transition focus:ring"
            onChange={(event) => setTitle(event.target.value)}
            placeholder="My Atraxa Counters"
            required
            type="text"
            value={title}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Deck list</span>
          <textarea
            className="h-56 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 outline-none ring-red-500/40 transition focus:ring"
            onChange={(event) => setDecklistText(event.target.value)}
            placeholder={"1 Sol Ring\n1 Command Tower\n1 Arcane Signet"}
            required
            value={decklistText}
          />
        </label>

        {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}

        <button
          className="inline-flex cursor-pointer items-center rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? "Creating..." : "Create deck"}
        </button>
      </form>
    </section>
  );
};
