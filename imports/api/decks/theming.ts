import { Meteor } from "meteor/meteor";
import { DeckCardsCollection, DecksCollection, ThemedDeckCardsCollection } from "./collections";
import { generateDeckThemeWithOpenAI } from "./openai";
import { resolveCardDetailsFromScryfall } from "./scryfall";
import type {
  DeckThemeStartInput,
  DeckThemeStartResult,
  ScryfallCardDetails,
  ThemedDeckCardDoc,
  ThemedDeckCardGeneratedPayload,
} from "./types";

type CardDetailsResolver = (cardName: string) => Promise<ScryfallCardDetails | null>;
type OpenAIThemer = (input: {
  themeUniverse: string;
  artStyleBrief: string;
  cards: Array<{
    originalCardName: string;
    quantity: number;
    oracleText: string;
    typeLine: string;
    manaCost: string | null;
    isLegendary: boolean;
  }>;
}) => Promise<ThemedDeckCardGeneratedPayload[]>;

let cardDetailsResolver: CardDetailsResolver = resolveCardDetailsFromScryfall;
let openAIThemer: OpenAIThemer = generateDeckThemeWithOpenAI;

interface ThemeCandidateCard {
  originalCardName: string;
  quantity: number;
  details: ScryfallCardDetails;
}

const validateThemeStartInput = ({ deckId, themeUniverse, artStyleBrief, confirmDiscardPrevious }: DeckThemeStartInput): void => {
  if (typeof deckId !== "string" || deckId.trim().length === 0) {
    throw new Meteor.Error("invalid-deck-id", "Deck id is required.");
  }

  if (typeof themeUniverse !== "string" || themeUniverse.trim().length === 0) {
    throw new Meteor.Error("invalid-theme-universe", "Theme universe is required.");
  }

  if (typeof artStyleBrief !== "string" || artStyleBrief.trim().length === 0) {
    throw new Meteor.Error("invalid-art-style-brief", "Art style brief is required.");
  }

  if (typeof confirmDiscardPrevious !== "boolean") {
    throw new Meteor.Error("invalid-confirm-discard", "Confirm discard flag must be a boolean.");
  }
};

export const startDeckTheming = async (input: DeckThemeStartInput): Promise<DeckThemeStartResult> => {
  validateThemeStartInput(input);

  const deckId = input.deckId.trim();
  const themeUniverse = input.themeUniverse.trim();
  const artStyleBrief = input.artStyleBrief.trim();
  const deck = await DecksCollection.findOneAsync({ _id: deckId });

  if (!deck) {
    throw new Meteor.Error("deck-not-found", "Deck not found.");
  }

  if (deck.themingStatus === "running") {
    throw new Meteor.Error("theming-already-running", "Deck theming is already running for this deck.");
  }

  const existingThemedCards = await ThemedDeckCardsCollection.find({ deckId }).fetch();
  if (existingThemedCards.length > 0) {
    if (!input.confirmDiscardPrevious) {
      throw new Meteor.Error(
        "theming-confirmation-required",
        "Confirm discarding previous themed cards before re-theming.",
      );
    }

    await ThemedDeckCardsCollection.removeAsync({ deckId });
  }

  const now = new Date();
  await DecksCollection.updateAsync(
    { _id: deckId },
    {
      $set: {
        themingStatus: "running",
        themingThemeUniverse: themeUniverse,
        themingArtStyleBrief: artStyleBrief,
        themingStartedAt: now,
        themingCompletedAt: null,
        themingError: null,
        updatedAt: now,
      },
    },
  );

  try {
    const deckCards = await DeckCardsCollection.find({ deckId }, { sort: { name: 1 } }).fetch();
    if (deckCards.length === 0) {
      throw new Meteor.Error("empty-deck", "Cannot theme an empty deck.");
    }

    const themedDraftDocs: ThemedDeckCardDoc[] = [];
    const themeCandidates: ThemeCandidateCard[] = [];

    for (const card of deckCards) {
      const details = await cardDetailsResolver(card.name);

      if (!details) {
        themedDraftDocs.push({
          deckId,
          originalCardName: card.name,
          quantity: card.quantity,
          isBasicLand: false,
          status: "failed",
          themedName: null,
          themedFlavorText: null,
          themedConcept: null,
          themedImagePrompt: null,
          themedGeneratedImageUrl: null,
          themedGeneratedImageStatus: "idle",
          themedGeneratedImageError: null,
          themedGeneratedImageUpdatedAt: null,
          themedCompositeImageUrl: null,
          themedCompositeImageStatus: "idle",
          themedCompositeImageError: null,
          themedCompositeImageUpdatedAt: null,
          constraintsApplied: [],
          errorMessage: "Scryfall metadata unavailable.",
          createdAt: now,
          updatedAt: now,
        });
        continue;
      }

      if (details.isBasicLand) {
        themedDraftDocs.push({
          deckId,
          originalCardName: card.name,
          quantity: card.quantity,
          isBasicLand: true,
          status: "skipped",
          themedName: card.name,
          themedFlavorText: null,
          themedConcept: "Basic land kept unchanged.",
          themedImagePrompt: null,
          themedGeneratedImageUrl: null,
          themedGeneratedImageStatus: "idle",
          themedGeneratedImageError: null,
          themedGeneratedImageUpdatedAt: null,
          themedCompositeImageUrl: null,
          themedCompositeImageStatus: "idle",
          themedCompositeImageError: null,
          themedCompositeImageUpdatedAt: null,
          constraintsApplied: ["basic-land-unchanged"],
          errorMessage: null,
          createdAt: now,
          updatedAt: now,
        });
        continue;
      }

      themedDraftDocs.push({
        deckId,
        originalCardName: card.name,
        quantity: card.quantity,
        isBasicLand: false,
        status: "pending",
        themedName: null,
        themedFlavorText: null,
        themedConcept: null,
        themedImagePrompt: null,
        themedGeneratedImageUrl: null,
        themedGeneratedImageStatus: "idle",
        themedGeneratedImageError: null,
        themedGeneratedImageUpdatedAt: null,
        themedCompositeImageUrl: null,
        themedCompositeImageStatus: "idle",
        themedCompositeImageError: null,
        themedCompositeImageUpdatedAt: null,
        constraintsApplied: [],
        errorMessage: null,
        createdAt: now,
        updatedAt: now,
      });

      themeCandidates.push({
        originalCardName: card.name,
        quantity: card.quantity,
        details,
      });
    }

    for (const draftDoc of themedDraftDocs) {
      await ThemedDeckCardsCollection.insertAsync(draftDoc);
    }

    if (themeCandidates.length > 0) {
      const generated = await openAIThemer({
        themeUniverse,
        artStyleBrief,
        cards: themeCandidates.map((candidate) => ({
          originalCardName: candidate.originalCardName,
          quantity: candidate.quantity,
          oracleText: candidate.details.oracleText ?? "",
          typeLine: candidate.details.typeLine ?? "",
          manaCost: candidate.details.manaCost,
          isLegendary: candidate.details.isLegendary,
        })),
      });

      const outputByName = new Map<string, ThemedDeckCardGeneratedPayload>();
      for (const row of generated) {
        if (!outputByName.has(row.originalCardName)) {
          outputByName.set(row.originalCardName, row);
        }
      }

      for (const candidate of themeCandidates) {
        const generatedCard = outputByName.get(candidate.originalCardName);

        if (!generatedCard) {
          await markCardFailed(deckId, candidate.originalCardName, "Model output missing card.");
          continue;
        }

        const normalized = normalizeGeneratedCard(generatedCard, candidate.details);
        await ThemedDeckCardsCollection.updateAsync(
          {
            deckId,
            originalCardName: candidate.originalCardName,
          },
          {
            $set: {
              status: "generated",
              themedName: normalized.themedName,
              themedFlavorText: normalized.themedFlavorText,
              themedConcept: normalized.themedConcept,
              themedImagePrompt: normalized.themedImagePrompt,
              constraintsApplied: normalized.constraintsApplied,
              errorMessage: null,
              updatedAt: new Date(),
            },
          },
        );
      }
    }

    await DecksCollection.updateAsync(
      { _id: deckId },
      {
        $set: {
          themingStatus: "completed",
          themingCompletedAt: new Date(),
          themingError: null,
          updatedAt: new Date(),
        },
      },
    );

    return {
      deckId,
      themingStatus: "completed",
    };
  } catch (error) {
    const message = getErrorMessage(error);
    await DecksCollection.updateAsync(
      { _id: deckId },
      {
        $set: {
          themingStatus: "failed",
          themingError: message,
          themingCompletedAt: null,
          updatedAt: new Date(),
        },
      },
    );

    throw new Meteor.Error("theming-failed", message);
  }
};

const markCardFailed = async (deckId: string, originalCardName: string, errorMessage: string): Promise<void> => {
  await ThemedDeckCardsCollection.updateAsync(
    { deckId, originalCardName },
    {
      $set: {
        status: "failed",
        themedName: null,
        themedFlavorText: null,
        themedConcept: null,
        themedImagePrompt: null,
        themedGeneratedImageUrl: null,
        themedGeneratedImageStatus: "idle",
        themedGeneratedImageError: null,
        themedGeneratedImageUpdatedAt: null,
        themedCompositeImageUrl: null,
        themedCompositeImageStatus: "idle",
        themedCompositeImageError: null,
        themedCompositeImageUpdatedAt: null,
        constraintsApplied: [],
        errorMessage,
        updatedAt: new Date(),
      },
    },
  );
};

const normalizeGeneratedCard = (
  generated: ThemedDeckCardGeneratedPayload,
  details: ScryfallCardDetails,
): ThemedDeckCardGeneratedPayload => {
  const baseConstraints = new Set<string>(generated.constraintsApplied.map((constraint) => constraint.trim()));

  if (details.isLegendary) {
    baseConstraints.add("legendary-source");
  }

  const typeConstraint = getTypeConstraint(details.typeLine);
  if (typeConstraint) {
    baseConstraints.add(typeConstraint);
  }

  return {
    originalCardName: generated.originalCardName.trim(),
    themedName: generated.themedName.trim(),
    themedFlavorText: generated.themedFlavorText.trim(),
    themedConcept: limitWords(generated.themedConcept.trim(), 30),
    themedImagePrompt: limitWords(generated.themedImagePrompt.trim(), 35),
    constraintsApplied: [...baseConstraints].filter((constraint) => constraint.length > 0),
  };
};

const getTypeConstraint = (typeLine: string | null): string | null => {
  if (!typeLine) {
    return null;
  }

  const normalized = typeLine.toLowerCase();

  if (normalized.includes("artifact")) {
    return "type-artifact";
  }

  if (normalized.includes("enchantment")) {
    return "type-enchantment";
  }

  if (normalized.includes("creature")) {
    return "type-creature";
  }

  if (normalized.includes("planeswalker")) {
    return "type-planeswalker";
  }

  if (normalized.includes("instant")) {
    return "type-instant";
  }

  if (normalized.includes("sorcery")) {
    return "type-sorcery";
  }

  if (normalized.includes("land")) {
    return "type-land";
  }

  return null;
};

const limitWords = (value: string, maxWords: number): string => {
  const words = value.split(/\s+/).filter((word) => word.length > 0);
  if (words.length <= maxWords) {
    return value;
  }

  return words.slice(0, maxWords).join(" ");
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Meteor.Error) {
    return error.reason ?? error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown theming error.";
};

export const __setCardDetailsResolverForTests = (resolver: CardDetailsResolver): void => {
  cardDetailsResolver = resolver;
};

export const __resetCardDetailsResolverForTests = (): void => {
  cardDetailsResolver = resolveCardDetailsFromScryfall;
};

export const __setOpenAIThemerForTests = (themer: OpenAIThemer): void => {
  openAIThemer = themer;
};

export const __resetOpenAIThemerForTests = (): void => {
  openAIThemer = generateDeckThemeWithOpenAI;
};
