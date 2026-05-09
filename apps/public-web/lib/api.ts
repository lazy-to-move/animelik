import { cache } from "react";

export type PublicAnime = {
  id: number;
  title: string;
  titleEnglish: string | null;
  titleJp: string | null;
  slug: string;
  synopsis: string;
  coverImage: string | null;
  coverImageSource: string | null;
  bannerImage: string | null;
  bannerImageSource: string | null;
  metadataSource: string | null;
  status: string | null;
  type: string | null;
  rating: string | null;
  releaseYear: number | null;
  studio: string | null;
  score: string | null;
  episodesCount: number | null;
  duration: number | null;
  genreNames: string;
  categoryName?: string;
};

export type PublicEpisode = {
  id: number;
  animeId: number;
  seasonNumber: number | null;
  number: number;
  title: string | null;
  synopsis: string | null;
  thumbnail: string | null;
  videoUrl: string | null;
  videoSources: unknown | null;
  duration: number | null;
  airDate?: string | Date | null;
};

export type PublicReview = {
  id: number;
  userId: number;
  animeId: number;
  rating: number;
  comment: string | null;
  createdAt: string | Date | null;
  userName: string | null;
  userAvatar: string | null;
};

export type PublicSessionUser = {
  id: number;
  unionId: string;
  googleId: string | null;
  name: string | null;
  email: string | null;
  avatar: string | null;
  role: "user" | "admin";
  createdAt: string | Date;
  updatedAt: string | Date;
  lastSignInAt: string | Date;
};

export type PublicWatchlistItem = {
  id: number;
  userId: number;
  animeId: number;
  status: "watching" | "completed" | "plan_to_watch" | "dropped" | null;
  currentEpisode: number | null;
  createdAt: string | Date;
  animeTitle: string | null;
  animeTitleEnglish: string | null;
  animeTitleJp: string | null;
  animeSlug: string | null;
  animeCover: string | null;
  animeBanner: string | null;
  animeStatus: string | null;
  animeType: string | null;
  animeScore: string | null;
  animeReleaseYear: number | null;
  animeEpisodesCount: number | null;
  categoryName?: string;
  genreNames?: string;
  genres?: string[];
};

export type BrowseResponse = {
  items: PublicAnime[];
  total: number;
  page: number;
  limit: number;
};

export type HomeResponse = {
  featured: PublicAnime[];
  trending: PublicAnime[];
};

export type AnimeDetailResponse = {
  anime: PublicAnime;
  episodes: PublicEpisode[];
  reviews: PublicReview[];
};

export type ScheduleResponse = {
  days: Array<{
    key: string;
    label: string;
    items: ScheduleAnime[];
  }>;
  unscheduled: ScheduleAnime[];
  total: number;
};

export type ScheduleAnime = {
  id: number;
  title: string;
  titleEnglish: string | null;
  titleJp: string | null;
  slug: string;
  coverImage: string | null;
  bannerImage: string | null;
  score: string | null;
  releaseYear: number | null;
  episodesCount: number | null;
  categoryName: string | null;
  broadcastDay: string | null;
  broadcastTime: string | null;
  broadcastTimezone: string | null;
  broadcastText: string | null;
};

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/g, "");
}

function readRuntimeEnv(name: string) {
  const runtimeEnv = process.env as Record<string, string | undefined>;
  return runtimeEnv[name];
}

function normalizeOrigin(rawValue: string | undefined) {
  if (!rawValue) return undefined;
  const trimmed = rawValue.trim();
  if (!trimmed) return undefined;
  return /^(https?:)?\/\//i.test(trimmed)
    ? trimTrailingSlash(trimmed)
    : trimTrailingSlash(`http://${trimmed}`);
}

export function getLegacyApiServerBaseUrl() {
  return trimTrailingSlash(
    normalizeOrigin(readRuntimeEnv("LEGACY_API_INTERNAL_ORIGIN")) ||
      normalizeOrigin(readRuntimeEnv("LEGACY_API_INTERNAL_HOSTPORT")) ||
      normalizeOrigin(readRuntimeEnv("LEGACY_API_BASE_URL")) ||
      normalizeOrigin(readRuntimeEnv("NEXT_PUBLIC_LEGACY_API_BASE_URL")) ||
      "http://127.0.0.1:3000",
  );
}

export function getLegacyApiPublicBaseUrl() {
  return trimTrailingSlash(
    normalizeOrigin(readRuntimeEnv("NEXT_PUBLIC_LEGACY_API_BASE_URL")) ||
      normalizeOrigin(readRuntimeEnv("LEGACY_API_BASE_URL")) ||
      "http://127.0.0.1:3000",
  );
}

export function getPublicSiteUrl() {
  return trimTrailingSlash(
    readRuntimeEnv("NEXT_PUBLIC_SITE_URL") || "http://127.0.0.1:3001",
  );
}

export function resolveMediaUrl(url: string | null | undefined) {
  if (!url) return null;
  if (/^(https?:)?\/\//i.test(url) || url.startsWith("data:")) {
    return url;
  }

  const normalizedPath = url.startsWith("/") ? url : `/${url}`;
  return `${getLegacyApiPublicBaseUrl()}${normalizedPath}`;
}

async function fetchJson<T>(path: string) {
  const response = await fetch(`${getLegacyApiServerBaseUrl()}${path}`, {
    next: {
      revalidate: 300,
    },
  });

  if (!response.ok) {
    throw new Error(`Legacy API request failed for ${path}: ${response.status}`);
  }

  return (await response.json()) as T;
}

const getHomeDataCached = cache(async () =>
  fetchJson<HomeResponse>("/api/public/home"),
);

function buildBrowseQuery(
  searchParams?: Record<string, string | string[] | undefined>,
) {
  const params = new URLSearchParams();
  for (const [key, rawValue] of Object.entries(searchParams ?? {})) {
    const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;
    if (!value) continue;
    params.set(key, value);
  }

  return params.toString();
}

const getBrowseDataCached = cache(async (query: string) =>
  fetchJson<BrowseResponse>(`/api/public/browse${query ? `?${query}` : ""}`),
);

const getAnimeDetailCached = cache(async (slug: string) =>
  fetchJson<AnimeDetailResponse>(
    `/api/public/anime/${encodeURIComponent(slug)}`,
  ),
);

const getScheduleDataCached = cache(async () =>
  fetchJson<ScheduleResponse>("/api/public/schedule"),
);

export function getHomeData() {
  return getHomeDataCached();
}

export function getBrowseData(
  searchParams?: Record<string, string | string[] | undefined>,
) {
  return getBrowseDataCached(buildBrowseQuery(searchParams));
}

export function getAnimeDetail(slug: string) {
  return getAnimeDetailCached(slug);
}

export function getScheduleData() {
  return getScheduleDataCached();
}

export const getLegacyApiBaseUrl = getLegacyApiServerBaseUrl;
