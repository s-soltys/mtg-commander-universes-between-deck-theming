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

interface ImageLike {
  width: number;
  height: number;
}

interface TitleMaskCompositeOperationContext {
  globalCompositeOperation: string;
}

interface CanvasContextLike extends TitleMaskCompositeOperationContext {
  save(): void;
  restore(): void;
  fillStyle: string;
  strokeStyle: string;
  lineWidth: number;
  lineJoin: string;
  miterLimit: number;
  font: string;
  textAlign: string;
  textBaseline: string;
  fillRect(x: number, y: number, width: number, height: number): void;
  drawImage(image: ImageLike, ...args: number[]): void;
  strokeText(text: string, x: number, y: number, maxWidth?: number): void;
  fillText(text: string, x: number, y: number, maxWidth?: number): void;
}

interface CanvasLike {
  getContext(contextId: "2d"): CanvasContextLike | null;
  toBuffer(mimeType?: "image/png"): Buffer;
}

interface CanvasModule {
  createCanvas(width: number, height: number): CanvasLike;
  loadImage(source: Buffer): Promise<ImageLike>;
}

interface CoverSourceRect {
  sx: number;
  sy: number;
  width: number;
  height: number;
}

type TitleMaskCompositeOperation = "luminosity" | "source-over";

const STANDARD_CARD_ASPECT_RATIO = 488 / 680;
const STANDARD_CARD_ASPECT_TOLERANCE = 0.03;
const MIN_STANDARD_CARD_WIDTH = 320;
const MIN_STANDARD_CARD_HEIGHT = 450;
const STANDARD_ART_RECT: NormalizedRect = { x: 0.080, y: 0.114, width: 0.842, height: 0.440 };
const STANDARD_TITLE_RECT: NormalizedRect = { x: 0.085, y: 0.050, width: 0.65, height: 0.048 };
const MTG_TITLE_FONT_FAMILY = "'Cinzel', 'Matrix Bold', 'Goudy Old Style', 'Palatino Linotype', 'Book Antiqua', serif";

let themedCardComposer: ThemedCardComposer = async (input) => composeStandardCardImage(input);
let cachedCanvasModule: CanvasModule | null = null;

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
  const canvasModule = await loadCanvasModule();
  const baseCardBuffer = await loadImageBuffer(baseCardUrl, "base-card-image");
  const themedArtBuffer = await loadImageBuffer(themedArtUrl, "themed-art-image");

  const [baseImage, themedArtImage] = await Promise.all([
    canvasModule.loadImage(baseCardBuffer),
    canvasModule.loadImage(themedArtBuffer),
  ]);

  const width = Math.round(baseImage.width);
  const height = Math.round(baseImage.height);

  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
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

  const canvas = canvasModule.createCanvas(width, height);
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("composite-renderer: failed to acquire 2d context.");
  }

  context.drawImage(baseImage, 0, 0, width, height);
  drawImageCover(context, themedArtImage, artRect);

  context.save();
  context.globalCompositeOperation = resolveTitleMaskCompositeOperation(context);
  context.fillStyle = "rgba(223, 209, 184, 1)";
  context.fillRect(titleRect.left, titleRect.top, titleRect.width, titleRect.height);
  context.restore();

  drawTitleText(context, themedName, titleRect);

  const composedBuffer = canvas.toBuffer("image/png");
  return `data:image/png;base64,${composedBuffer.toString("base64")}`;
};

const resolveTitleMaskCompositeOperation = (
  context: TitleMaskCompositeOperationContext,
): TitleMaskCompositeOperation => {
  const originalOperation = context.globalCompositeOperation;
  let supportsLuminosity = false;

  try {
    context.globalCompositeOperation = "luminosity";
    supportsLuminosity = context.globalCompositeOperation === "luminosity";
  } catch {
    supportsLuminosity = false;
  }

  try {
    context.globalCompositeOperation = originalOperation;
  } catch {
    // Ignore context restore failures and keep a safe fallback mode.
  }

  return supportsLuminosity ? "luminosity" : "source-over";
};

const drawImageCover = (context: CanvasContextLike, image: ImageLike, targetRect: PixelRect): void => {
  const sourceRect = getCoverSourceRect(image.width, image.height, targetRect.width, targetRect.height);

  context.drawImage(
    image,
    sourceRect.sx,
    sourceRect.sy,
    sourceRect.width,
    sourceRect.height,
    targetRect.left,
    targetRect.top,
    targetRect.width,
    targetRect.height,
  );
};

const getCoverSourceRect = (
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
): CoverSourceRect => {
  if (sourceWidth <= 0 || sourceHeight <= 0) {
    throw new Error("unsupported-layout: themed art dimensions unavailable.");
  }

  if (targetWidth <= 0 || targetHeight <= 0) {
    throw new Error("unsupported-layout: invalid cover target dimensions.");
  }

  const sourceAspect = sourceWidth / sourceHeight;
  const targetAspect = targetWidth / targetHeight;

  if (sourceAspect > targetAspect) {
    const width = sourceHeight * targetAspect;
    return {
      sx: (sourceWidth - width) / 2,
      sy: 0,
      width,
      height: sourceHeight,
    };
  }

  const height = sourceWidth / targetAspect;
  return {
    sx: 0,
    sy: (sourceHeight - height) / 2,
    width: sourceWidth,
    height,
  };
};

const drawTitleText = (context: CanvasContextLike, themedName: string, rect: PixelRect): void => {
  const normalizedTitle = themedName.trim();
  if (normalizedTitle.length === 0) {
    throw new Error("Themed card title is required.");
  }

  const fontSize = getTitleFontSize(rect.width, rect.height, normalizedTitle);
  const strokeWidth = Math.max(1, Math.round(fontSize * 0.1));

  context.save();
  context.font = `700 ${fontSize}px ${MTG_TITLE_FONT_FAMILY}`;
  context.textAlign = "left";
  context.textBaseline = "middle";
  context.strokeStyle = "#efe8d8";
  context.fillStyle = "#1f1610";
  context.lineWidth = strokeWidth;
  context.lineJoin = "round";
  context.miterLimit = 2;

  const textY = rect.top + rect.height / 2;
  context.strokeText(normalizedTitle, rect.left, textY, rect.width);
  context.fillText(normalizedTitle, rect.left, textY, rect.width);
  context.restore();
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

const getTitleFontSize = (width: number, height: number, text: string): number => {
  const maxForHeight = Math.floor(height * 0.72);
  const estimatedFromLength = Math.floor((width * 0.86) / Math.max(1, text.length * 0.66));
  return clamp(estimatedFromLength, 15, maxForHeight);
};

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const loadCanvasModule = async (): Promise<CanvasModule> => {
  if (cachedCanvasModule) {
    return cachedCanvasModule;
  }

  const resolutionErrors: string[] = [];

  const fromNonWebpack = tryResolveCanvasModule(
    (globalThis as { __non_webpack_require__?: (id: string) => unknown }).__non_webpack_require__,
    "canvas",
    "__non_webpack_require__",
    resolutionErrors,
  );
  if (fromNonWebpack) {
    cachedCanvasModule = fromNonWebpack;
    return cachedCanvasModule;
  }

  const fromModuleRequire = tryResolveCanvasModule(
    typeof module !== "undefined" && typeof module.require === "function" ? module.require.bind(module) : undefined,
    "canvas",
    "module.require",
    resolutionErrors,
  );
  if (fromModuleRequire) {
    cachedCanvasModule = fromModuleRequire;
    return cachedCanvasModule;
  }

  const fromMainModule = tryResolveCanvasModule(
    (process as NodeJS.Process & { mainModule?: { require?: (id: string) => unknown } }).mainModule?.require,
    "canvas",
    "process.mainModule.require",
    resolutionErrors,
  );
  if (fromMainModule) {
    cachedCanvasModule = fromMainModule;
    return cachedCanvasModule;
  }

  const candidateRoots = getCandidateRootPaths();

  for (const rootPath of candidateRoots) {
    const rootRequire = createRequire(path.join(rootPath, "__canvas_loader__.cjs"));

    const fromRootRequire = tryResolveCanvasModule(
      rootRequire.bind(null) as (id: string) => unknown,
      "canvas",
      `createRequire(${rootPath})`,
      resolutionErrors,
    );
    if (fromRootRequire) {
      cachedCanvasModule = fromRootRequire;
      return cachedCanvasModule;
    }

    const fromRootNodeModules = tryResolveCanvasModule(
      rootRequire.bind(null) as (id: string) => unknown,
      `${rootPath}/node_modules/canvas`,
      `createRequire(${rootPath}) absolute-canvas`,
      resolutionErrors,
    );
    if (fromRootNodeModules) {
      cachedCanvasModule = fromRootNodeModules;
      return cachedCanvasModule;
    }
  }

  throw new Error(
    [
      "canvas module is unavailable.",
      `node=${process.version}`,
      `cwd=${process.cwd()}`,
      `attemptedRoots=${candidateRoots.join(", ")}`,
      `resolutionErrors=${resolutionErrors.slice(0, 8).join(" | ")}`,
      "Install canvas in the app root and restart Meteor.",
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

const toCanvasModule = (value: unknown): CanvasModule | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as {
    createCanvas?: unknown;
    loadImage?: unknown;
  };

  if (typeof candidate.createCanvas !== "function" || typeof candidate.loadImage !== "function") {
    return null;
  }

  return candidate as unknown as CanvasModule;
};

const getCanvasModuleExport = (value: unknown): CanvasModule | null => {
  const directModule = toCanvasModule(value);
  if (directModule) {
    return directModule;
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as { default?: unknown };
  return toCanvasModule(candidate.default);
};

const tryResolveCanvasModule = (
  resolver: ((id: string) => unknown) | undefined,
  specifier: string,
  label: string,
  errors: string[],
): CanvasModule | null => {
  if (typeof resolver !== "function") {
    errors.push(`${label}: resolver missing`);
    return null;
  }

  try {
    const resolved = resolver(specifier);
    const canvasModule = getCanvasModuleExport(resolved);
    if (!canvasModule) {
      errors.push(`${label}: export missing createCanvas/loadImage`);
    }
    return canvasModule;
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

export const __resolveTitleMaskCompositeOperationForTests = (
  context: TitleMaskCompositeOperationContext,
): TitleMaskCompositeOperation => resolveTitleMaskCompositeOperation(context);

export const __getCoverSourceRectForTests = (
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
): CoverSourceRect => getCoverSourceRect(sourceWidth, sourceHeight, targetWidth, targetHeight);

export const __toPixelRectForTests = (rect: NormalizedRect, width: number, height: number): PixelRect =>
  toPixelRect(rect, width, height);

export const __getTitleFontSizeForTests = (width: number, height: number, text: string): number =>
  getTitleFontSize(width, height, text);
