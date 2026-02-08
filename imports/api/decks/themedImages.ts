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

  const candidates = themedCards.filter((card) => shouldGenerateImage(card, input.forceRegenerate));

  let generatedCount = 0;
  let failedCount = 0;
  const skippedCount = themedCards.length - candidates.length;

  for (const card of candidates) {
    const result = await generateImageForCard(deckId, card);
    if (result.generated) {
      generatedCount += 1;
    } else {
      failedCount += 1;
    }
  }

  await DecksCollection.updateAsync(
    { _id: deckId },
    {
      $set: {
        updatedAt: new Date(),
      },
    },
  );

  return {
    deckId,
    generatedCount,
    failedCount,
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

  await ThemedDeckCardsCollection.updateAsync(
    { deckId, originalCardName },
    {
      $set: {
        themedName,
        themedImagePrompt,
        updatedAt: new Date(),
      },
    },
  );

  const updatedCard = {
    ...card,
    themedName,
    themedImagePrompt,
  };

  if (!shouldGenerateImage(updatedCard, input.forceRegenerate)) {
    return {
      deckId,
      originalCardName,
      generated: false,
      imageUrl: updatedCard.themedGeneratedImageUrl ?? null,
    };
  }

  const result = await generateImageForCard(deckId, updatedCard);
  await DecksCollection.updateAsync(
    { _id: deckId },
    {
      $set: {
        updatedAt: new Date(),
      },
    },
  );

  return {
    deckId,
    originalCardName,
    generated: result.generated,
    imageUrl: result.imageUrl,
  };
};

const generateImageForCard = async (
  deckId: string,
  card: Pick<ThemedDeckCardDoc, "originalCardName" | "themedImagePrompt">,
): Promise<{ generated: boolean; imageUrl: string | null }> => {
  try {
    const imageUrl = await themedImageGenerator(card.themedImagePrompt ?? "");

    await ThemedDeckCardsCollection.updateAsync(
      { deckId, originalCardName: card.originalCardName },
      {
        $set: {
          themedGeneratedImageUrl: imageUrl,
          themedGeneratedImageStatus: "generated",
          themedGeneratedImageError: null,
          themedGeneratedImageUpdatedAt: new Date(),
          updatedAt: new Date(),
        },
      },
    );

    return { generated: true, imageUrl };
  } catch (error) {
    await ThemedDeckCardsCollection.updateAsync(
      { deckId, originalCardName: card.originalCardName },
      {
        $set: {
          themedGeneratedImageStatus: "failed",
          themedGeneratedImageError: getErrorMessage(error),
          themedGeneratedImageUpdatedAt: new Date(),
          updatedAt: new Date(),
        },
      },
    );

    return { generated: false, imageUrl: null };
  }
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
