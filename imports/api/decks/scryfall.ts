import type { ResolvedCardImage } from "./types";

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

    const payload = (await response.json()) as ScryfallCardResponse;

    return {
      scryfallId: payload.id ?? null,
      imageUrl: extractImageUrl(payload),
    };
  } catch {
    return null;
  }
};
