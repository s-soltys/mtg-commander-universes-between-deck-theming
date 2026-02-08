import * as React from "react";
import { Meteor } from "meteor/meteor";
import { useFind, useSubscribe } from "meteor/react-meteor-data";
import {
  AppSettingsPublicCollection,
  DeckMethodNames,
  DeckPublicationNames,
} from "/imports/api/decks";
import type {
  AppSettingsClearOpenAIKeyResult,
  AppSettingsPublicDoc,
  AppSettingsSetOpenAIKeyResult,
} from "/imports/api/decks";

export const SettingsPage = () => {
  const isSettingsLoading = useSubscribe(DeckPublicationNames.appSettingsPublic);
  const settingsDocs = useFind(() => AppSettingsPublicCollection.find({ _id: "global" })) as AppSettingsPublicDoc[];
  const settings = settingsDocs[0];

  const [openAIApiKeyInput, setOpenAIApiKeyInput] = React.useState<string>("");
  const [isSaving, setIsSaving] = React.useState<boolean>(false);
  const [isClearing, setIsClearing] = React.useState<boolean>(false);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const hasSavedKey = settings?.hasOpenAIApiKey ?? false;
  const maskedKey = settings?.maskedOpenAIApiKey ?? null;

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setSuccessMessage(null);
    setErrorMessage(null);
    setIsSaving(true);

    try {
      const result = await Meteor.callAsync<AppSettingsSetOpenAIKeyResult>(DeckMethodNames.setOpenAIKey, {
        openAIApiKey: openAIApiKeyInput,
      });

      setOpenAIApiKeyInput("");
      setSuccessMessage(`Saved OpenAI API key (${result.maskedOpenAIApiKey}).`);
    } catch (error) {
      if (error instanceof Error && error.message.trim().length > 0) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Failed to save OpenAI API key.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = async () => {
    const shouldClear = window.confirm("Clear the saved OpenAI API key?");
    if (!shouldClear) {
      return;
    }

    setSuccessMessage(null);
    setErrorMessage(null);
    setIsClearing(true);

    try {
      await Meteor.callAsync<AppSettingsClearOpenAIKeyResult>(DeckMethodNames.clearOpenAIKey);
      setOpenAIApiKeyInput("");
      setSuccessMessage("Cleared saved OpenAI API key.");
    } catch (error) {
      if (error instanceof Error && error.message.trim().length > 0) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Failed to clear OpenAI API key.");
      }
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <h2 className="text-xl font-semibold text-slate-900">Settings</h2>
        <p className="mt-1 text-sm text-slate-600">Manage the server-side OpenAI API key used for deck theming and image generation.</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <h3 className="text-base font-semibold text-slate-900">OpenAI API Key</h3>

        {isSettingsLoading() && !settings ? (
          <p className="mt-2 text-sm text-slate-500">Loading key settings...</p>
        ) : (
          <div className="mt-2 space-y-1">
            <p className="text-sm text-slate-700">Status: {hasSavedKey ? "set" : "not set"}</p>
            {hasSavedKey && maskedKey ? <p className="text-sm text-slate-700">Saved key: {maskedKey}</p> : null}
          </div>
        )}

        <form className="mt-4 space-y-3" onSubmit={(event) => void handleSave(event)}>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="openai-api-key">
              {hasSavedKey ? "Replace OpenAI API key" : "Set OpenAI API key"}
            </label>
            <input
              autoComplete="off"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-100"
              id="openai-api-key"
              onChange={(event) => setOpenAIApiKeyInput(event.target.value)}
              placeholder="sk-..."
              type="password"
              value={openAIApiKeyInput}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSaving || isClearing}
              type="submit"
            >
              {isSaving ? "Saving..." : "Save Key"}
            </button>
            <button
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!hasSavedKey || isSaving || isClearing}
              onClick={() => void handleClear()}
              type="button"
            >
              {isClearing ? "Clearing..." : "Clear Key"}
            </button>
          </div>
        </form>

        {successMessage ? <p className="mt-3 text-sm text-emerald-700">{successMessage}</p> : null}
        {errorMessage ? <p className="mt-3 text-sm text-red-700">{errorMessage}</p> : null}
      </div>
    </section>
  );
};

