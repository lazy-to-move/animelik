import type { ScraperAnime } from "./types";

type JikanSearchItem = {
  mal_id?: number;
  title?: string;
  title_english?: string;
  title_japanese?: string;
  title_synonyms?: string[];
  titles?: Array<{ type?: string; title?: string }>;
  status?: string;
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

type TvMazeShow = {
  name?: string;
  premiered?: string;
  runtime?: number | null;
  averageRuntime?: number | null;
  genres?: string[];
  rating?: { average?: number | null };
  image?: {
    medium?: string | null;
    original?: string | null;
  };
  summary?: string | null;
};

type TvMazeSearchItem = {
  score?: number;
  show?: TvMazeShow;
};

type ResolvedMetadata = Partial<ScraperAnime>;
type CandidateScore = {
  item: JikanSearchItem;
  totalScore: number;
  textScore: number;
};

const MIN_JIKAN_TEXT_SCORE = 20;

function mapJikanStatus(status?: string): ScraperAnime["status"] | undefined {
  const text = status?.toLowerCase().trim();
  if (!text) return undefined;
  if (text.includes("finished")) return "completed";
  if (text.includes("currently airing")) return "ongoing";
  if (text.includes("not yet aired")) return "upcoming";
  return undefined;
}

const JIKAN_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
  Accept: "application/json,text/plain,*/*",
  Referer: "https://myanimelist.net/",
  Origin: "https://myanimelist.net",
};

const TVMAZE_HEADERS = {
  "User-Agent": JIKAN_HEADERS["User-Agent"],
  Accept: "application/json,text/plain,*/*",
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
    .replace(/\b(anime|all|episodes|episode|season|movie|tv|ova|special|subbed|online|dubbed|arabic)\b/gi, " ")
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
  const pipeParts = cleaned
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);

  return Array.from(new Set([cleaned, beforeSlash, beforeDash, latinOnly, ...pipeParts].filter(Boolean)));
}

function tokenizeNormalized(value: string) {
  return value.split(" ").map((token) => token.trim()).filter((token) => token.length >= 2);
}

function buildSearchCandidates(base: ScraperAnime): string[] {
  const slugCandidate = base.slug.replace(/^anime\//i, "").replace(/[-_]+/g, " ").trim();
  const rawCandidates = [slugCandidate, base.title, base.titleEnglish, base.titleJp, base.titleArabic].filter(Boolean) as string[];

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

function scoreCandidate(item: JikanSearchItem, query: string, expectedYear?: number): CandidateScore {
  const titles = [
    item.title,
    item.title_english,
    item.title_japanese,
    ...(item.title_synonyms ?? []),
    ...((item.titles?.map((entry) => entry.title).filter(Boolean) as string[] | undefined) ?? []),
  ]
    .filter(Boolean)
    .map((value) => normalizeQuery(value!));

  let textScore = 0;
  const queryWords = new Set(tokenizeNormalized(query));

  for (const title of titles) {
    if (!title) continue;

    if (title === query) {
      textScore = Math.max(textScore, 80);
      continue;
    }

    if (title.includes(query) || query.includes(title)) {
      textScore = Math.max(textScore, 55);
      continue;
    }

    const titleWords = tokenizeNormalized(title);
    const sharedWords = titleWords.filter((word) => queryWords.has(word));
    const sharedCount = new Set(sharedWords).size;
    const minRequired = Math.min(queryWords.size <= 1 || titleWords.length <= 1 ? 1 : 2, queryWords.size, titleWords.length);
    if (sharedCount >= minRequired) {
      textScore = Math.max(textScore, 20 + sharedCount * 8);
    }
  }

  let totalScore = textScore;

  if (expectedYear) {
    const itemYear =
      item.year ||
      item.aired?.prop?.from?.year ||
      (item.aired?.from ? Number(item.aired.from.slice(0, 4)) : undefined);
    if (itemYear === expectedYear) totalScore += 10;
  }

  if (item.score) totalScore += Math.min(item.score, 10);

  return {
    item,
    totalScore,
    textScore,
  };
}

function mapJikanToMetadata(item: JikanSearchItem, base: ScraperAnime): ResolvedMetadata {
  const images = pickImage(item);
  const numericScore = typeof item.score === "number" ? item.score.toFixed(2) : undefined;
  const titleSynonyms = Array.from(
    new Set(
      [
        ...(item.title_synonyms ?? []),
        ...(item.titles?.map((entry) => entry.title).filter(Boolean) as string[] ?? []),
      ]
        .map((value) => value.replace(/\s+/g, " ").trim())
        .filter(Boolean)
        .filter((value) => value !== item.title && value !== item.title_english && value !== item.title_japanese),
    ),
  );

  return {
    externalId: item.mal_id ? String(item.mal_id) : base.externalId,
    titleEnglish: item.title_english || base.titleEnglish,
    titleJp: item.title_japanese || base.titleJp,
    titleSynonyms: titleSynonyms.length > 0 ? titleSynonyms : base.titleSynonyms,
    synopsis: item.synopsis || base.synopsis,
    coverImage: images.coverImage || base.coverImage,
    bannerImage: images.bannerImage || images.coverImage || base.bannerImage,
    status: mapJikanStatus(item.status) || base.status,
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

function stripHtml(value?: string | null) {
  return (value ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function mapTvMazeToMetadata(show: TvMazeShow, base: ScraperAnime): ResolvedMetadata {
  const ratingValue = typeof show.rating?.average === "number" ? `${show.rating.average.toFixed(1)} / 10` : base.rating;
  const premieredYear = show.premiered ? Number.parseInt(show.premiered.slice(0, 4), 10) : undefined;

  return {
    titleEnglish: show.name || base.titleEnglish,
    synopsis: stripHtml(show.summary) || base.synopsis,
    coverImage: base.coverImage || show.image?.original || show.image?.medium || undefined,
    bannerImage: base.bannerImage || base.coverImage || show.image?.original || show.image?.medium || undefined,
    releaseYear: premieredYear || base.releaseYear,
    duration: show.averageRuntime || show.runtime || base.duration,
    categoryName: show.genres?.filter(Boolean).join(" | ") || base.categoryName,
    rating: ratingValue,
  };
}

function scoreTvMazeCandidate(show: TvMazeShow, query: string) {
  const normalizedName = normalizeQuery(show.name ?? "");
  if (!normalizedName) return 0;
  if (normalizedName === query) return 80;
  if (normalizedName.includes(query) || query.includes(normalizedName)) return 55;

  const queryWords = new Set(tokenizeNormalized(query));
  const showWords = tokenizeNormalized(normalizedName);
  const shared = new Set(showWords.filter((word) => queryWords.has(word))).size;
  const minRequired = Math.min(queryWords.size <= 1 || showWords.length <= 1 ? 1 : 2, queryWords.size, showWords.length);
  if (shared >= minRequired) return 20 + shared * 8;
  return 0;
}

async function resolveTvMazeMetadata(base: ScraperAnime, candidates: string[]): Promise<ResolvedMetadata> {
  if (base.type !== "tv") return {};

  for (const candidate of candidates) {
    const response = await fetch(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(candidate)}`, {
      headers: TVMAZE_HEADERS,
    }).catch(() => null);
    if (!response?.ok) continue;

    const payload = await response.json().catch(() => []) as TvMazeSearchItem[];
    if (!Array.isArray(payload) || payload.length === 0) continue;

    const best = payload
      .map((entry) => ({
        show: entry.show,
        textScore: scoreTvMazeCandidate(entry.show ?? {}, candidate),
      }))
      .filter((entry) => entry.show && entry.textScore >= MIN_JIKAN_TEXT_SCORE)
      .sort((left, right) => right.textScore - left.textScore)[0]?.show;

    if (!best) continue;
    return mapTvMazeToMetadata(best, base);
  }

  return {};
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
        .map((item) => scoreCandidate(item, candidate, base.releaseYear))
        .sort((a, b) => b.totalScore - a.totalScore)[0];

      if (!best || best.textScore < MIN_JIKAN_TEXT_SCORE) continue;
      return resolveDetailedMetadata(best.item, base);
    } catch (error) {
      console.error("Metadata enrichment failed for candidate:", candidate, error);
    }
  }

  return resolveTvMazeMetadata(base, candidates);
}
