import { Meteor } from "meteor/meteor";
import { DecksCollection, ThemedDeckCardsCollection } from "./collections";
import { generateThemedCardImageWithOpenAI } from "./openai";
import type {
  DeckThemeImageGenerateForCardInput,
  DeckThemeImageGenerateForCardResult,
  DeckThemeImagesGenerateInput,
  DeckThemeImagesGenerateResult,
  ThemedDeckCardDoc,
} from "./types";

type ThemedImageGenerator = (prompt: string) => Promise<string>;
interface ImageGenerationJob {
  deckId: string;
  originalCardName: string;
  themedImagePrompt: string;
}

const IMAGE_GENERATION_CONCURRENCY_PER_DECK = 3;

let themedImageGenerator: ThemedImageGenerator = generateThemedCardImageWithOpenAI;

const validateGenerateImagesInput = ({ deckId, forceRegenerate }: DeckThemeImagesGenerateInput): void => {
  if (typeof deckId !== "string" || deckId.trim().length === 0) {
    throw new Meteor.Error("invalid-deck-id", "Deck id is required.");
  }

  if (typeof forceRegenerate !== "boolean") {
    throw new Meteor.Error("invalid-force-regenerate", "Force regenerate flag must be a boolean.");
  }
};

const validateGenerateSingleImageInput = ({
  deckId,
  originalCardName,
  themedName,
  themedImagePrompt,
  forceRegenerate,
}: DeckThemeImageGenerateForCardInput): void => {
  if (typeof deckId !== "string" || deckId.trim().length === 0) {
    throw new Meteor.Error("invalid-deck-id", "Deck id is required.");
  }

  if (typeof originalCardName !== "string" || originalCardName.trim().length === 0) {
    throw new Meteor.Error("invalid-card-name", "Original card name is required.");
  }

  if (typeof themedName !== "string" || themedName.trim().length === 0) {
    throw new Meteor.Error("invalid-themed-name", "Themed card title is required.");
  }

  if (typeof themedImagePrompt !== "string" || themedImagePrompt.trim().length === 0) {
    throw new Meteor.Error("invalid-image-prompt", "Image prompt is required.");
  }

  if (typeof forceRegenerate !== "boolean") {
    throw new Meteor.Error("invalid-force-regenerate", "Force regenerate flag must be a boolean.");
  }
};

export const generateDeckThemedImages = async (
  input: DeckThemeImagesGenerateInput,
): Promise<DeckThemeImagesGenerateResult> => {
  validateGenerateImagesInput(input);

  const deckId = input.deckId.trim();
  const deck = await DecksCollection.findOneAsync({ _id: deckId });
  if (!deck) {
    throw new Meteor.Error("deck-not-found", "Deck not found.");
  }

  if (deck.themingStatus !== "completed") {
    throw new Meteor.Error("theming-not-complete", "Deck theming must be completed before generating images.");
  }

  const themedCards = await ThemedDeckCardsCollection.find({ deckId }, { sort: { originalCardName: 1 } }).fetch();
  if (themedCards.length === 0) {
    throw new Meteor.Error("themed-cards-missing", "No themed cards found for this deck.");
  }

  let startedCount = 0;
  let alreadyGeneratingCount = 0;
  let skippedCount = 0;
  const startedJobs: ImageGenerationJob[] = [];

  for (const card of themedCards) {
    if (card.themedGeneratedImageStatus === "generating") {
      alreadyGeneratingCount += 1;
      continue;
    }

    if (!shouldGenerateImage(card, input.forceRegenerate)) {
      skippedCount += 1;
      continue;
    }

    const started = await markImageGenerating({
      deckId,
      originalCardName: card.originalCardName,
    });
    if (!started) {
      alreadyGeneratingCount += 1;
      continue;
    }

    startedCount += 1;
    startedJobs.push({
      deckId,
      originalCardName: card.originalCardName,
      themedImagePrompt: card.themedImagePrompt ?? "",
    });
  }

  startDeckImageGeneration(startedJobs);

  return {
    deckId,
    startedCount,
    alreadyGeneratingCount,
    skippedCount,
  };
};

export const generateThemedImageForCard = async (
  input: DeckThemeImageGenerateForCardInput,
): Promise<DeckThemeImageGenerateForCardResult> => {
  validateGenerateSingleImageInput(input);

  const deckId = input.deckId.trim();
  const originalCardName = input.originalCardName.trim();
  const themedName = input.themedName.trim();
  const themedImagePrompt = input.themedImagePrompt.trim();
  const deck = await DecksCollection.findOneAsync({ _id: deckId });
  if (!deck) {
    throw new Meteor.Error("deck-not-found", "Deck not found.");
  }

  if (deck.themingStatus !== "completed") {
    throw new Meteor.Error("theming-not-complete", "Deck theming must be completed before generating images.");
  }

  const card = await ThemedDeckCardsCollection.findOneAsync({ deckId, originalCardName });
  if (!card) {
    throw new Meteor.Error("themed-card-not-found", "Themed card not found.");
  }

  if (card.themedGeneratedImageStatus === "generating") {
    return {
      deckId,
      originalCardName,
      started: false,
    };
  }

  const updatedCard = {
    ...card,
    themedName,
    themedImagePrompt,
  };

  if (!shouldGenerateImage(updatedCard, input.forceRegenerate)) {
    return {
      deckId,
      originalCardName,
      started: false,
    };
  }

  const started = await markImageGenerating({
    deckId,
    originalCardName,
    themedName,
    themedImagePrompt,
  });

  if (!started) {
    return {
      deckId,
      originalCardName,
      started: false,
    };
  }

  startImageGeneration({
    deckId,
    originalCardName,
    themedImagePrompt,
  });

  return {
    deckId,
    originalCardName,
    started: true,
  };
};

const startDeckImageGeneration = (jobs: ImageGenerationJob[]): void => {
  if (jobs.length === 0) {
    return;
  }

  void runDeckImageGeneration(jobs).catch((error) => {
    console.error("[themed-images] Background bulk generation failed.", {
      deckId: jobs[0]?.deckId,
      error,
    });
  });
};

const runDeckImageGeneration = async (jobs: ImageGenerationJob[]): Promise<void> => {
  const parallelism = Math.min(IMAGE_GENERATION_CONCURRENCY_PER_DECK, jobs.length);
  const pendingJobs = [...jobs];
  const workers = Array.from({ length: parallelism }, async () => {
    while (pendingJobs.length > 0) {
      const nextJob = pendingJobs.shift();
      if (!nextJob) {
        return;
      }

      await runImageGeneration(nextJob);
    }
  });

  await Promise.all(workers);
};

const startImageGeneration = (job: ImageGenerationJob): void => {
  void runImageGeneration(job).catch((error) => {
    console.error("[themed-images] Background generation failed.", {
      deckId: job.deckId,
      originalCardName: job.originalCardName,
      error,
    });
  });
};

const runImageGeneration = async (job: ImageGenerationJob): Promise<void> => {
  try {
    const imageUrl = await themedImageGenerator(job.themedImagePrompt);

    await ThemedDeckCardsCollection.updateAsync(
      { deckId: job.deckId, originalCardName: job.originalCardName },
      {
        $set: {
          themedGeneratedImageUrl: imageUrl,
          themedGeneratedImageStatus: "generated",
          themedGeneratedImageError: null,
          themedGeneratedImageUpdatedAt: new Date(),
          themedCompositeImageUrl: null,
          themedCompositeImageStatus: "idle",
          themedCompositeImageError: null,
          themedCompositeImageUpdatedAt: null,
          updatedAt: new Date(),
        },
      },
    );
  } catch (error) {
    await markImageFailed(job.deckId, job.originalCardName, getErrorMessage(error));
  } finally {
    await DecksCollection.updateAsync(
      { _id: job.deckId },
      {
        $set: {
          updatedAt: new Date(),
        },
      },
    );
  }
};

const markImageGenerating = async ({
  deckId,
  originalCardName,
  themedName,
  themedImagePrompt,
}: {
  deckId: string;
  originalCardName: string;
  themedName?: string;
  themedImagePrompt?: string;
}): Promise<boolean> => {
  const setFields: Record<string, unknown> = {
    themedGeneratedImageStatus: "generating",
    themedGeneratedImageError: null,
    themedGeneratedImageUpdatedAt: new Date(),
    updatedAt: new Date(),
  };

  if (typeof themedName === "string") {
    setFields.themedName = themedName;
  }

  if (typeof themedImagePrompt === "string") {
    setFields.themedImagePrompt = themedImagePrompt;
  }

  const updatedCount = await ThemedDeckCardsCollection.updateAsync(
    {
      deckId,
      originalCardName,
      themedGeneratedImageStatus: { $ne: "generating" },
    },
    {
      $set: setFields,
    },
  );

  return updatedCount > 0;
};

const markImageFailed = async (deckId: string, originalCardName: string, message: string): Promise<void> => {
  await ThemedDeckCardsCollection.updateAsync(
    { deckId, originalCardName },
    {
      $set: {
        themedGeneratedImageStatus: "failed",
        themedGeneratedImageError: message,
        themedGeneratedImageUpdatedAt: new Date(),
        updatedAt: new Date(),
      },
    },
  );
};

const shouldGenerateImage = (card: ThemedDeckCardDoc, forceRegenerate: boolean): boolean => {
  if (card.status !== "generated") {
    return false;
  }

  if (!card.themedImagePrompt || card.themedImagePrompt.trim().length === 0) {
    return false;
  }

  if (forceRegenerate) {
    return true;
  }

  return !card.themedGeneratedImageUrl;
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Meteor.Error) {
    return error.reason ?? error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown image generation error.";
};

export const __setThemedImageGeneratorForTests = (generator: ThemedImageGenerator): void => {
  themedImageGenerator = generator;
};

export const __resetThemedImageGeneratorForTests = (): void => {
  themedImageGenerator = generateThemedCardImageWithOpenAI;
};
