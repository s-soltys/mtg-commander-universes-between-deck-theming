import { Meteor } from "meteor/meteor";
import { createRequire } from "node:module";
import path from "node:path";
import { DeckCardsCollection, DecksCollection, ThemedDeckCardsCollection } from "./collections";
import type {
  DeckThemeCardCompositeGenerateForCardInput,
  DeckThemeCardCompositeGenerateForCardResult,
} from "./types";

interface ComposeStandardCardImageInput {
  baseCardUrl: string;
  themedArtUrl: string;
  themedName: string;
}

type ThemedCardComposer = (input: ComposeStandardCardImageInput) => Promise<string>;

interface PixelRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface NormalizedRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CompositeGenerationJob {
  deckId: string;
  originalCardName: string;
  baseCardUrl: string;
  themedArtUrl: string;
  themedName: string;
}

interface SharpCreateInput {
  create: {
    width: number;
    height: number;
    channels: number;
    background: {
      r: number;
      g: number;
      b: number;
      alpha: number;
    };
  };
}

interface SharpResizeInput {
  width: number;
  height: number;
  fit: "cover";
  position: "centre";
}

interface SharpCompositeInput {
  input: Buffer;
  left: number;
  top: number;
}

interface SharpLike {
  ensureAlpha(): SharpLike;
  metadata(): Promise<{ width?: number; height?: number }>;
  resize(input: SharpResizeInput): SharpLike;
  composite(input: SharpCompositeInput[]): SharpLike;
  png(): SharpLike;
  toBuffer(): Promise<Buffer>;
}

type SharpFactory = (input: Buffer | SharpCreateInput) => SharpLike;

const STANDARD_CARD_ASPECT_RATIO = 488 / 680;
const STANDARD_CARD_ASPECT_TOLERANCE = 0.03;
const MIN_STANDARD_CARD_WIDTH = 320;
const MIN_STANDARD_CARD_HEIGHT = 450;
const STANDARD_ART_RECT: NormalizedRect = { x: 0.080, y: 0.114, width: 0.842, height: 0.440 };
const STANDARD_TITLE_RECT: NormalizedRect = { x: 0.085, y: 0.050, width: 0.65, height: 0.048 };

let themedCardComposer: ThemedCardComposer = async (input) => composeStandardCardImage(input);
let cachedSharpFactory: SharpFactory | null = null;

const validateGenerateCompositeInput = ({
  deckId,
  originalCardName,
  themedName,
  forceRegenerate,
}: DeckThemeCardCompositeGenerateForCardInput): void => {
  if (typeof deckId !== "string" || deckId.trim().length === 0) {
    throw new Meteor.Error("invalid-deck-id", "Deck id is required.");
  }

  if (typeof originalCardName !== "string" || originalCardName.trim().length === 0) {
    throw new Meteor.Error("invalid-card-name", "Original card name is required.");
  }

  if (typeof themedName !== "string" || themedName.trim().length === 0) {
    throw new Meteor.Error("invalid-themed-name", "Themed card title is required.");
  }

  if (typeof forceRegenerate !== "boolean") {
    throw new Meteor.Error("invalid-force-regenerate", "Force regenerate flag must be a boolean.");
  }
};

export const generateThemedCardCompositeForCard = async (
  input: DeckThemeCardCompositeGenerateForCardInput,
): Promise<DeckThemeCardCompositeGenerateForCardResult> => {
  validateGenerateCompositeInput(input);

  const deckId = input.deckId.trim();
  const originalCardName = input.originalCardName.trim();
  const themedName = input.themedName.trim();
  const deck = await DecksCollection.findOneAsync({ _id: deckId });
  if (!deck) {
    throw new Meteor.Error("deck-not-found", "Deck not found.");
  }

  if (deck.themingStatus !== "completed") {
    throw new Meteor.Error("theming-not-complete", "Deck theming must be completed before generating themed cards.");
  }

  const themedCard = await ThemedDeckCardsCollection.findOneAsync({ deckId, originalCardName });
  if (!themedCard) {
    throw new Meteor.Error("themed-card-not-found", "Themed card not found.");
  }

  if (themedCard.status !== "generated") {
    throw new Meteor.Error("themed-card-not-ready", "Card theming must be generated before creating a themed card image.");
  }

  const hasTitleChanged = (themedCard.themedName ?? "").trim() !== themedName;

  await ThemedDeckCardsCollection.updateAsync(
    { deckId, originalCardName },
    {
      $set: {
        themedName,
        updatedAt: new Date(),
      },
    },
  );

  if (themedCard.themedCompositeImageStatus === "generating") {
    return {
      deckId,
      originalCardName,
      started: false,
    };
  }

  if (
    !input.forceRegenerate &&
    !hasTitleChanged &&
    themedCard.themedCompositeImageStatus === "generated" &&
    themedCard.themedCompositeImageUrl
  ) {
    return {
      deckId,
      originalCardName,
      started: false,
    };
  }

  const deckCard = await DeckCardsCollection.findOneAsync({ deckId, name: originalCardName });
  const baseCardUrl = deckCard?.imageUrl ?? null;
  if (!baseCardUrl) {
    const errorMessage = "Missing base Scryfall card image.";
    await markCompositeFailed(deckId, originalCardName, errorMessage);
    throw new Meteor.Error("base-image-missing", errorMessage);
  }

  const themedArtUrl = themedCard.themedGeneratedImageUrl ?? null;
  if (!themedArtUrl || themedCard.themedGeneratedImageStatus !== "generated") {
    const errorMessage = "Generate themed art before creating a themed card image.";
    await markCompositeFailed(deckId, originalCardName, errorMessage);
    throw new Meteor.Error("themed-art-missing", errorMessage);
  }

  await ThemedDeckCardsCollection.updateAsync(
    { deckId, originalCardName },
    {
      $set: {
        themedCompositeImageStatus: "generating",
        themedCompositeImageError: null,
        themedCompositeImageUpdatedAt: new Date(),
        updatedAt: new Date(),
      },
    },
  );

  startCompositeGeneration({
    deckId,
    originalCardName,
    baseCardUrl,
    themedArtUrl,
    themedName,
  });

  return {
    deckId,
    originalCardName,
    started: true,
  };
};

const startCompositeGeneration = (job: CompositeGenerationJob): void => {
  void runCompositeGeneration(job).catch((error) => {
    console.error("[themed-card-composite] Background generation failed.", {
      deckId: job.deckId,
      originalCardName: job.originalCardName,
      error,
    });
  });
};

const runCompositeGeneration = async (job: CompositeGenerationJob): Promise<void> => {
  try {
    const imageUrl = await themedCardComposer({
      baseCardUrl: job.baseCardUrl,
      themedArtUrl: job.themedArtUrl,
      themedName: job.themedName,
    });

    await ThemedDeckCardsCollection.updateAsync(
      { deckId: job.deckId, originalCardName: job.originalCardName },
      {
        $set: {
          themedCompositeImageUrl: imageUrl,
          themedCompositeImageStatus: "generated",
          themedCompositeImageError: null,
          themedCompositeImageUpdatedAt: new Date(),
          updatedAt: new Date(),
        },
      },
    );
  } catch (error) {
    await markCompositeFailed(job.deckId, job.originalCardName, getErrorMessage(error));
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

const markCompositeFailed = async (deckId: string, originalCardName: string, message: string): Promise<void> => {
  await ThemedDeckCardsCollection.updateAsync(
    { deckId, originalCardName },
    {
      $set: {
        themedCompositeImageStatus: "failed",
        themedCompositeImageError: message,
        themedCompositeImageUpdatedAt: new Date(),
        updatedAt: new Date(),
      },
    },
  );
};

export const composeStandardCardImage = async ({
  baseCardUrl,
  themedArtUrl,
  themedName,
}: ComposeStandardCardImageInput): Promise<string> => {
  const sharp = await loadSharpFactory();
  const baseCardBuffer = await loadImageBuffer(baseCardUrl, "base-card-image");
  const themedArtBuffer = await loadImageBuffer(themedArtUrl, "themed-art-image");

  const baseImage = sharp(baseCardBuffer).ensureAlpha();
  const metadata = await baseImage.metadata();

  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (width === 0 || height === 0) {
    throw new Error("unsupported-layout: base card image dimensions unavailable.");
  }

  if (width < MIN_STANDARD_CARD_WIDTH || height < MIN_STANDARD_CARD_HEIGHT) {
    throw new Error("unsupported-layout: base card image too small for standard-frame compositing.");
  }

  const ratioDelta = Math.abs(width / height - STANDARD_CARD_ASPECT_RATIO);
  if (ratioDelta > STANDARD_CARD_ASPECT_TOLERANCE) {
    throw new Error("unsupported-layout: card image is not a standard single-face frame ratio.");
  }

  const artRect = toPixelRect(STANDARD_ART_RECT, width, height);
  const titleRect = toPixelRect(STANDARD_TITLE_RECT, width, height);
  const artLayerBuffer = await sharp(themedArtBuffer)
    .resize({
      width: artRect.width,
      height: artRect.height,
      fit: "cover",
      position: "centre",
    })
    .png()
    .toBuffer();
  const titleMaskBuffer = await createTitleMaskBuffer(sharp, titleRect.width, titleRect.height);
  const titleTextBuffer = await createTitleTextBuffer(sharp, themedName, titleRect.width, titleRect.height);
  const composedBuffer = await baseImage
    .composite([
      {
        input: artLayerBuffer,
        left: artRect.left,
        top: artRect.top,
      },
      {
        input: titleMaskBuffer,
        left: titleRect.left,
        top: titleRect.top,
      },
      {
        input: titleTextBuffer,
        left: titleRect.left,
        top: titleRect.top,
      },
    ])
    .png()
    .toBuffer();

  return `data:image/png;base64,${composedBuffer.toString("base64")}`;
};

const toPixelRect = (rect: NormalizedRect, width: number, height: number): PixelRect => {
  const left = Math.max(0, Math.round(rect.x * width));
  const top = Math.max(0, Math.round(rect.y * height));
  const rectWidth = Math.min(width - left, Math.round(rect.width * width));
  const rectHeight = Math.min(height - top, Math.round(rect.height * height));

  if (rectWidth <= 0 || rectHeight <= 0) {
    throw new Error("unsupported-layout: invalid target frame coordinates.");
  }

  return {
    left,
    top,
    width: rectWidth,
    height: rectHeight,
  };
};

const createTitleMaskBuffer = async (sharp: SharpFactory, width: number, height: number): Promise<Buffer> =>
  sharp({
    create: {
      width,
      height,
      channels: 4,
      background: {
        r: 223,
        g: 209,
        b: 184,
        alpha: 1,
      },
    },
  })
    .png()
    .toBuffer();

const createTitleTextBuffer = async (
  sharp: SharpFactory,
  themedName: string,
  width: number,
  height: number,
): Promise<Buffer> => {
  const normalizedTitle = themedName.trim();
  if (normalizedTitle.length === 0) {
    throw new Error("Themed card title is required.");
  }

  const fontSize = getTitleFontSize(width, height, normalizedTitle);
  const strokeWidth = Math.max(1, Math.round(fontSize * 0.1));
  const escapedText = escapeXml(normalizedTitle);
  const yCenter = height / 2;
  const svg = [
    `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`,
    "<rect width=\"100%\" height=\"100%\" fill=\"transparent\"/>",
    `<text x="0" y="${yCenter}" dy="0.35em" text-anchor="start" fill="#1f1610" stroke="#efe8d8" stroke-width="${strokeWidth}" paint-order="stroke fill" font-size="${fontSize}" font-family="'Times New Roman', Georgia, serif" font-weight="700" letter-spacing="0.6">${escapedText}</text>`,
    "</svg>",
  ].join("");

  return sharp(Buffer.from(svg)).png().toBuffer();
};

const getTitleFontSize = (width: number, height: number, text: string): number => {
  const maxForHeight = Math.floor(height * 0.72);
  const estimatedFromLength = Math.floor((width * 0.86) / Math.max(1, text.length * 0.66));
  return clamp(estimatedFromLength, 15, maxForHeight);
};

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const escapeXml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

const loadSharpFactory = async (): Promise<SharpFactory> => {
  if (cachedSharpFactory) {
    return cachedSharpFactory;
  }

  const resolutionErrors: string[] = [];

  const fromNonWebpack = tryResolveSharpFactory(
    (globalThis as { __non_webpack_require__?: (id: string) => unknown }).__non_webpack_require__,
    "sharp",
    "__non_webpack_require__",
    resolutionErrors,
  );
  if (fromNonWebpack) {
    cachedSharpFactory = fromNonWebpack;
    return cachedSharpFactory;
  }

  const fromModuleRequire = tryResolveSharpFactory(
    typeof module !== "undefined" && typeof module.require === "function" ? module.require.bind(module) : undefined,
    "sharp",
    "module.require",
    resolutionErrors,
  );
  if (fromModuleRequire) {
    cachedSharpFactory = fromModuleRequire;
    return cachedSharpFactory;
  }

  const fromMainModule = tryResolveSharpFactory(
    (process as NodeJS.Process & { mainModule?: { require?: (id: string) => unknown } }).mainModule?.require,
    "sharp",
    "process.mainModule.require",
    resolutionErrors,
  );
  if (fromMainModule) {
    cachedSharpFactory = fromMainModule;
    return cachedSharpFactory;
  }

  const candidateRoots = getCandidateRootPaths();

  for (const rootPath of candidateRoots) {
    const fromRootRequire = tryResolveSharpFactory(
      createRequire(path.join(rootPath, "__sharp_loader__.cjs")).bind(null) as (id: string) => unknown,
      "sharp",
      `createRequire(${rootPath})`,
      resolutionErrors,
    );
    if (fromRootRequire) {
      cachedSharpFactory = fromRootRequire;
      return cachedSharpFactory;
    }

    const fromRootNodeModules = tryResolveSharpFactory(
      createRequire(path.join(rootPath, "__sharp_loader__.cjs")).bind(null) as (id: string) => unknown,
      `${rootPath}/node_modules/sharp`,
      `createRequire(${rootPath}) absolute-sharp`,
      resolutionErrors,
    );
    if (fromRootNodeModules) {
      cachedSharpFactory = fromRootNodeModules;
      return cachedSharpFactory;
    }

    const fromRootEntry = tryResolveSharpFactory(
      createRequire(path.join(rootPath, "__sharp_loader__.cjs")).bind(null) as (id: string) => unknown,
      `${rootPath}/node_modules/sharp/lib/index.js`,
      `createRequire(${rootPath}) absolute-sharp-entry`,
      resolutionErrors,
    );
    if (fromRootEntry) {
      cachedSharpFactory = fromRootEntry;
      return cachedSharpFactory;
    }
  }

  throw new Error(
    [
      "sharp module is unavailable.",
      `node=${process.version}`,
      `cwd=${process.cwd()}`,
      `attemptedRoots=${candidateRoots.join(", ")}`,
      `resolutionErrors=${resolutionErrors.slice(0, 8).join(" | ")}`,
      "Install sharp in the app root and restart Meteor.",
    ].join(" "),
  );
};

const getCandidateRootPaths = (): string[] => {
  const roots = new Set<string>();
  const directCandidates = [process.env.PWD, process.env.INIT_CWD, process.env.APP_DIR, process.cwd()];

  for (const entry of directCandidates) {
    if (typeof entry !== "string" || entry.trim().length === 0) {
      continue;
    }

    let current = entry.trim();
    for (let i = 0; i < 7; i += 1) {
      roots.add(current);
      const parent = path.dirname(current);
      if (parent === current) {
        break;
      }
      current = parent;
    }
  }

  return [...roots];
};

const getSharpFactoryExport = (value: unknown): SharpFactory | null => {
  if (typeof value === "function") {
    return value as SharpFactory;
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as { default?: unknown };
  if (typeof candidate.default === "function") {
    return candidate.default as SharpFactory;
  }

  return null;
};

const tryResolveSharpFactory = (
  resolver: ((id: string) => unknown) | undefined,
  specifier: string,
  label: string,
  errors: string[],
): SharpFactory | null => {
  if (typeof resolver !== "function") {
    errors.push(`${label}: resolver missing`);
    return null;
  }

  try {
    const resolved = resolver(specifier);
    const factory = getSharpFactoryExport(resolved);
    if (!factory) {
      errors.push(`${label}: export not callable`);
    }
    return factory;
  } catch (error) {
    errors.push(`${label}: ${getUnknownErrorMessage(error)}`);
    return null;
  }
};

const getUnknownErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
};

const loadImageBuffer = async (source: string, label: string): Promise<Buffer> => {
  const normalizedSource = source.trim();
  if (normalizedSource.length === 0) {
    throw new Error(`${label}: image source is empty.`);
  }

  const dataUrlBuffer = decodeDataUrlBuffer(normalizedSource);
  if (dataUrlBuffer) {
    return dataUrlBuffer;
  }

  const response = await fetch(normalizedSource, {
    method: "GET",
    headers: {
      Accept: "image/*",
    },
  });

  if (!response.ok) {
    throw new Error(`${label}: failed to fetch image (${response.status}).`);
  }

  const payload = await response.arrayBuffer();
  return Buffer.from(payload);
};

const decodeDataUrlBuffer = (source: string): Buffer | null => {
  const match = source.match(/^data:[^;]+;base64,(?<payload>.+)$/);
  if (!match?.groups?.payload) {
    return null;
  }

  try {
    return Buffer.from(match.groups.payload, "base64");
  } catch {
    return null;
  }
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Meteor.Error) {
    return error.reason ?? error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown themed card composite generation error.";
};

export const __setThemedCardComposerForTests = (composer: ThemedCardComposer): void => {
  themedCardComposer = composer;
};

export const __resetThemedCardComposerForTests = (): void => {
  themedCardComposer = composeStandardCardImage;
};
