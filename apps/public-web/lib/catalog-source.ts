import type {
  AnimeDetailResponse,
  BrowseResponse,
  HomeResponse,
  ScheduleResponse,
} from "./api";
import {
  getAnimeDetail as getAnimeDetailFromLegacyApi,
  getBrowseData as getBrowseDataFromLegacyApi,
  getHomeData as getHomeDataFromLegacyApi,
  getScheduleData as getScheduleDataFromLegacyApi,
} from "./api";

type SearchParamsInput = Record<string, string | string[] | undefined> | undefined;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parsePositiveInteger(value: string | string[] | undefined) {
  const rawValue = firstValue(value);
  if (!rawValue) return undefined;
  const parsed = Number.parseInt(rawValue, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function normalizeBrowseFilters(searchParams?: SearchParamsInput) {
  return {
    category: firstValue(searchParams?.category),
    status: firstValue(searchParams?.status) as
      | "ongoing"
      | "completed"
      | "upcoming"
      | undefined,
    type: firstValue(searchParams?.type) as
      | "tv"
      | "movie"
      | "ova"
      | "special"
      | undefined,
    releaseYear: parsePositiveInteger(searchParams?.releaseYear),
    search: firstValue(searchParams?.search),
    page: parsePositiveInteger(searchParams?.page),
    limit: parsePositiveInteger(searchParams?.limit),
  };
}

export function hasDirectCatalogDatabaseAccess() {
  return Boolean(process.env.DATABASE_URL);
}

export function getCatalogAccessMode() {
  return hasDirectCatalogDatabaseAccess() ? "direct-db" : "legacy-http";
}

async function loadDirectCatalogModules() {
  const [{ getFeaturedPublicAnime, getPublicAnimeDetails, getTrendingPublicAnime, listPublicAnime }, { getWeeklySchedule }] =
    await Promise.all([
      import("../../../api/services/public-catalog"),
      import("../../../api/services/weekly-schedule"),
    ]);

  return {
    getFeaturedPublicAnime,
    getPublicAnimeDetails,
    getTrendingPublicAnime,
    getWeeklySchedule,
    listPublicAnime,
  };
}

export async function getHomeCatalogData(): Promise<HomeResponse> {
  if (!hasDirectCatalogDatabaseAccess()) {
    return getHomeDataFromLegacyApi();
  }

  const catalog = await loadDirectCatalogModules();
  const [featured, trending] = await Promise.all([
    catalog.getFeaturedPublicAnime(),
    catalog.getTrendingPublicAnime(),
  ]);

  return { featured, trending };
}

export async function getBrowseCatalogData(
  searchParams?: SearchParamsInput,
): Promise<BrowseResponse> {
  if (!hasDirectCatalogDatabaseAccess()) {
    return getBrowseDataFromLegacyApi(searchParams);
  }

  const catalog = await loadDirectCatalogModules();
  return catalog.listPublicAnime(normalizeBrowseFilters(searchParams));
}

export async function getAnimeCatalogDetail(
  slug: string,
): Promise<AnimeDetailResponse> {
  if (!hasDirectCatalogDatabaseAccess()) {
    return getAnimeDetailFromLegacyApi(slug);
  }

  const catalog = await loadDirectCatalogModules();
  const details = await catalog.getPublicAnimeDetails(slug);
  if (!details) {
    throw new Error(`Anime not found for slug "${slug}".`);
  }
  return details;
}

export async function getScheduleCatalogData(): Promise<ScheduleResponse> {
  if (!hasDirectCatalogDatabaseAccess()) {
    return getScheduleDataFromLegacyApi();
  }

  const catalog = await loadDirectCatalogModules();
  return catalog.getWeeklySchedule();
}
