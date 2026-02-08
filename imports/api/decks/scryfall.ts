import type { ResolvedCardImage, ScryfallCardDetails } from "./types";

interface ScryfallImageUris {
  normal?: string;
}

interface ScryfallCardFace {
  image_uris?: ScryfallImageUris;
}

interface ScryfallCardResponse {
  id?: string;
  image_uris?: ScryfallImageUris;
  card_faces?: ScryfallCardFace[];
  oracle_text?: string;
  type_line?: string;
  mana_cost?: string;
}

const SCRYFALL_BASE_URL = "https://api.scryfall.com/cards/named";

const extractImageUrl = (card: ScryfallCardResponse): string | null => {
  const singleFaceImage = card.image_uris?.normal;
  if (singleFaceImage) {
    return singleFaceImage;
  }

  const multiFaceImage = card.card_faces?.find((face) => face.image_uris?.normal)?.image_uris?.normal;
  return multiFaceImage ?? null;
};

export const resolveCardFromScryfall = async (cardName: string): Promise<ResolvedCardImage | null> => {
  const payload = await fetchScryfallCard(cardName);
  if (!payload) {
    return null;
  }

  return {
    scryfallId: payload.id ?? null,
    imageUrl: extractImageUrl(payload),
  };
};

const getTypeLine = (payload: ScryfallCardResponse): string => payload.type_line?.trim() ?? "";

export const resolveCardDetailsFromScryfall = async (cardName: string): Promise<ScryfallCardDetails | null> => {
  const payload = await fetchScryfallCard(cardName);
  if (!payload) {
    return null;
  }

  const typeLine = getTypeLine(payload);
  const normalizedTypeLine = typeLine.toLowerCase();

  return {
    scryfallId: payload.id ?? null,
    oracleText: payload.oracle_text?.trim() ?? null,
    typeLine: typeLine.length > 0 ? typeLine : null,
    manaCost: payload.mana_cost?.trim() ?? null,
    isLegendary: normalizedTypeLine.includes("legendary"),
    isBasicLand: normalizedTypeLine.includes("basic") && normalizedTypeLine.includes("land"),
  };
};

const fetchScryfallCard = async (cardName: string): Promise<ScryfallCardResponse | null> => {
  const url = new URL(SCRYFALL_BASE_URL);
  url.searchParams.set("exact", cardName);

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as ScryfallCardResponse;
  } catch {
    return null;
  }
};
