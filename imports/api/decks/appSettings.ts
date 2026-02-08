import { Meteor } from "meteor/meteor";
import { AppSettingsCollection } from "./collections";
import type {
  AppSettingsClearOpenAIKeyResult,
  AppSettingsDoc,
  AppSettingsPublicDoc,
  AppSettingsSetOpenAIKeyInput,
  AppSettingsSetOpenAIKeyResult,
} from "./types";

const GLOBAL_APP_SETTINGS_ID = "global";

export const maskOpenAIApiKey = (key: string): string => {
  const trimmed = key.trim();
  if (trimmed.length === 0) {
    return "";
  }

  const visibleSuffix = trimmed.slice(-4);
  return `••••••••${visibleSuffix}`;
};

export const toAppSettingsPublicDoc = (
  settings: Pick<AppSettingsDoc, "_id" | "openAIApiKey" | "updatedAt"> | null,
): AppSettingsPublicDoc => {
  const key = settings?.openAIApiKey?.trim() ?? "";
  const hasOpenAIApiKey = key.length > 0;

  return {
    _id: settings?._id ?? GLOBAL_APP_SETTINGS_ID,
    hasOpenAIApiKey,
    maskedOpenAIApiKey: hasOpenAIApiKey ? maskOpenAIApiKey(key) : null,
    updatedAt: settings?.updatedAt ?? null,
  };
};

export const getAppSettingsDoc = async (): Promise<AppSettingsDoc | null> =>
  AppSettingsCollection.findOneAsync({ _id: GLOBAL_APP_SETTINGS_ID });

export const setOpenAIKey = async (
  input: AppSettingsSetOpenAIKeyInput,
): Promise<AppSettingsSetOpenAIKeyResult> => {
  if (typeof input.openAIApiKey !== "string") {
    throw new Meteor.Error("invalid-openai-api-key", "OpenAI API key must be a string.");
  }

  const openAIApiKey = input.openAIApiKey.trim();
  if (openAIApiKey.length === 0) {
    throw new Meteor.Error("invalid-openai-api-key", "OpenAI API key is required.");
  }

  const updatedAt = new Date();
  await AppSettingsCollection.upsertAsync(
    { _id: GLOBAL_APP_SETTINGS_ID },
    {
      $set: {
        openAIApiKey,
        updatedAt,
      },
    },
  );

  return {
    hasOpenAIApiKey: true,
    maskedOpenAIApiKey: maskOpenAIApiKey(openAIApiKey),
    updatedAt,
  };
};

export const clearOpenAIKey = async (): Promise<AppSettingsClearOpenAIKeyResult> => {
  const updatedAt = new Date();
  await AppSettingsCollection.upsertAsync(
    { _id: GLOBAL_APP_SETTINGS_ID },
    {
      $set: {
        openAIApiKey: null,
        updatedAt,
      },
    },
  );

  return {
    hasOpenAIApiKey: false,
    maskedOpenAIApiKey: null,
    updatedAt,
  };
};

export const getOpenAIApiKeyForRuntime = async (): Promise<string | null> => {
  const settings = await getAppSettingsDoc();
  const savedKey = settings?.openAIApiKey?.trim() ?? "";
  if (savedKey.length > 0) {
    return savedKey;
  }

  const envKey = process.env.OPENAI_API_KEY?.trim() ?? "";
  if (envKey.length > 0) {
    return envKey;
  }

  return null;
};

