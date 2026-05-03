import type { ScraperAnime } from "./types";

type JikanSearchItem = {
  mal_id?: number;
  title?: string;
  title_english?: string;
  title_japanese?: string;
  synopsis?: string;
  year?: number;
  score?: number;
  duration?: string;
  rating?: string;
  genres?: Array<{ name?: string }>;
  studios?: Array<{ name?: string }>;
  images?: {
    jpg?: { image_url?: string; large_image_url?: string };
    webp?: { image_url?: string; large_image_url?: string };
  };
  trailer?: {
    images?: {
      maximum_image_url?: string;
      large_image_url?: string;
      medium_image_url?: string;
    };
  };
  aired?: {
    from?: string;
    prop?: {
      from?: { year?: number };
    };
  };
};

type ResolvedMetadata = Partial<ScraperAnime>;

const JIKAN_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
  Accept: "application/json,text/plain,*/*",
  Referer: "https://myanimelist.net/",
  Origin: "https://myanimelist.net",
};

async function fetchJikanByMalId(malId: string): Promise<JikanSearchItem | null> {
  const response = await fetch(`https://api.jikan.moe/v4/anime/${malId}/full`, {
    headers: JIKAN_HEADERS,
  });
  if (!response.ok) return null;
  const payload = (await response.json()) as { data?: JikanSearchItem };
  return payload.data ?? null;
}

function normalizeQuery(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\b(anime|all|episodes|episode|season|movie|tv|ova|special|subbed|online)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitMixedTitle(value: string): string[] {
  const cleaned = value
    .replace(/[_/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return [];

  const latinOnly = cleaned
    .replace(/[^\p{Script=Latin}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  const beforeSlash = cleaned.split("/")[0]?.trim() ?? "";
  const beforeDash = cleaned.split("-")[0]?.trim() ?? "";

  return Array.from(new Set([cleaned, beforeSlash, beforeDash, latinOnly].filter(Boolean)));
}

function buildSearchCandidates(base: ScraperAnime): string[] {
  const slugCandidate = base.slug.replace(/^anime\//i, "").replace(/[-_]+/g, " ").trim();
  const rawCandidates = [slugCandidate, base.title, base.titleJp, base.titleArabic].filter(Boolean) as string[];

  return Array.from(
    new Set(
      rawCandidates
        .flatMap(splitMixedTitle)
        .map((value) => normalizeQuery(value))
        .filter((value) => value.length >= 3),
    ),
  );
}

function parseDurationMinutes(duration?: string): number | undefined {
  if (!duration) return undefined;
  const lower = duration.toLowerCase();

  const hourMatch = lower.match(/(\d+)\s*hr/);
  const minuteMatch = lower.match(/(\d+)\s*min/);

  const hours = hourMatch ? Number(hourMatch[1]) : 0;
  const minutes = minuteMatch ? Number(minuteMatch[1]) : 0;
  const total = hours * 60 + minutes;
  return total > 0 ? total : undefined;
}

function pickImage(item: JikanSearchItem): { coverImage?: string; bannerImage?: string } {
  const coverImage =
    item.images?.webp?.large_image_url ||
    item.images?.jpg?.large_image_url ||
    item.images?.webp?.image_url ||
    item.images?.jpg?.image_url;

  const bannerImage =
    item.trailer?.images?.maximum_image_url ||
    item.trailer?.images?.large_image_url ||
    item.trailer?.images?.medium_image_url ||
    coverImage;

  return { coverImage, bannerImage };
}

function scoreCandidate(item: JikanSearchItem, query: string, expectedYear?: number) {
  const titles = [item.title, item.title_english, item.title_japanese]
    .filter(Boolean)
    .map((value) => normalizeQuery(value!));

  let score = 0;
  if (titles.some((title) => title === query)) score += 60;
  else if (titles.some((title) => title.includes(query) || query.includes(title))) score += 35;
  else if (titles.some((title) => {
    const queryWords = new Set(query.split(" "));
    const titleWords = title.split(" ");
    return titleWords.filter((word) => queryWords.has(word)).length >= Math.min(2, titleWords.length);
  })) score += 20;

  if (expectedYear) {
    const itemYear =
      item.year ||
      item.aired?.prop?.from?.year ||
      (item.aired?.from ? Number(item.aired.from.slice(0, 4)) : undefined);
    if (itemYear === expectedYear) score += 10;
  }

  if (item.score) score += Math.min(item.score, 10);
  return score;
}

function mapJikanToMetadata(item: JikanSearchItem, base: ScraperAnime): ResolvedMetadata {
  const images = pickImage(item);
  const numericScore = typeof item.score === "number" ? item.score.toFixed(2) : undefined;

  return {
    externalId: item.mal_id ? String(item.mal_id) : base.externalId,
    titleJp: item.title_japanese || base.titleJp,
    synopsis: item.synopsis || base.synopsis,
    coverImage: images.coverImage || base.coverImage,
    bannerImage: images.bannerImage || images.coverImage || base.bannerImage,
    releaseYear:
      item.year ||
      item.aired?.prop?.from?.year ||
      (item.aired?.from ? Number(item.aired.from.slice(0, 4)) : undefined) ||
      base.releaseYear,
    studio: item.studios?.map((studio) => studio.name).filter(Boolean).join(", ") || base.studio,
    categoryName: item.genres?.map((genre) => genre.name).filter(Boolean).join(" | ") || base.categoryName,
    duration: parseDurationMinutes(item.duration) || base.duration,
    rating: numericScore ? `${Number(numericScore).toFixed(1)} / 10` : base.rating,
  };
}

async function resolveDetailedMetadata(item: JikanSearchItem, base: ScraperAnime): Promise<ResolvedMetadata> {
  if (item.mal_id) {
    try {
      const full = await fetchJikanByMalId(String(item.mal_id));
      if (full) return mapJikanToMetadata(full, base);
    } catch (error) {
      console.error("Metadata enrichment full fetch failed:", item.mal_id, error);
    }
  }

  return mapJikanToMetadata(item, base);
}

export async function enrichAnimeMetadata(base: ScraperAnime): Promise<ResolvedMetadata> {
  if (base.externalId) {
    try {
      const exact = await fetchJikanByMalId(base.externalId);
      if (exact) return resolveDetailedMetadata(exact, base);
    } catch (error) {
      console.error("Metadata enrichment failed for MAL id:", base.externalId, error);
    }
  }

  const candidates = buildSearchCandidates(base);

  for (const candidate of candidates) {
    try {
      const response = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(candidate)}&limit=5`, {
        headers: JIKAN_HEADERS,
      });
      if (!response.ok) continue;
      const payload = (await response.json()) as { data?: JikanSearchItem[] };
      const results = payload.data ?? [];
      if (results.length === 0) continue;

      const best = results
        .map((item) => ({ item, score: scoreCandidate(item, candidate, base.releaseYear) }))
        .sort((a, b) => b.score - a.score)[0]?.item;

      if (!best) continue;
      return resolveDetailedMetadata(best, base);
    } catch (error) {
      console.error("Metadata enrichment failed for candidate:", candidate, error);
    }
  }

  return {};
}
