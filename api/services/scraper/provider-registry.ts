import type { ScraperAnime, ScraperEpisode, SourceSiteId, VideoSource } from "./types";
import * as stardima from "./stardima-scraper";
import * as witanime from "./witanime-scraper";
import {
  type GenericSiteConfig,
  scrapeAnimeEpisodesWithConfig,
  scrapeAnimeInfoWithConfig,
  scrapeEpisodeSourcesWithConfig,
  scrapeLatestAnimeWithConfig,
  searchAnimeWithConfig,
} from "./generic-site-scraper";

export interface ScraperProvider {
  id: SourceSiteId;
  name: string;
  baseUrl: string;
  latestUrl?: string;
  animePathHint: string;
  searchAnime(query: string): Promise<ScraperAnime[]>;
  scrapeLatestAnime(limit?: number): Promise<ScraperAnime[]>;
  scrapeAnimeInfo(slug: string): Promise<ScraperAnime | null>;
  scrapeAnimeEpisodes(slug: string): Promise<ScraperEpisode[]>;
  scrapeEpisodeSources(episodeId: string): Promise<VideoSource[]>;
}

const genericConfigs: Record<Exclude<SourceSiteId, "witanime" | "stardima">, GenericSiteConfig> = {
  okanime: {
    id: "okanime",
    name: "OkAnime",
    baseUrl: "https://ww3.okanime.xyz",
    latestUrl: "https://ww3.okanime.xyz/",
    animePathSegment: "/anime/",
    episodePathSegment: "/episode/",
    searchUrls: [
      (query) => `https://ww3.okanime.xyz/?s=${encodeURIComponent(query)}`,
      (query) => `https://ww3.okanime.xyz/?search_param=animes&s=${encodeURIComponent(query)}`,
    ],
  },
  anime4up: {
    id: "anime4up",
    name: "Anime4up",
    baseUrl: "https://w1.anime4up.rest",
    latestUrl: "https://w1.anime4up.rest/home8/",
    animePathSegment: "/anime/",
    episodePathSegment: "/episode/",
    searchUrls: [
      (query) => `https://w1.anime4up.rest/?s=${encodeURIComponent(query)}`,
      (query) => `https://w1.anime4up.rest/?search_param=animes&s=${encodeURIComponent(query)}`,
    ],
  },
  animelek: {
    id: "animelek",
    name: "AnimeLek",
    baseUrl: "https://animelek.top",
    latestUrl: "https://animelek.top/",
    animePathSegment: "/anime/",
    episodePathSegment: "/episode/",
    searchUrls: [
      (query) => `https://animelek.top/?s=${encodeURIComponent(query)}`,
      (query) => `https://animelek.top/?search_param=animes&s=${encodeURIComponent(query)}`,
    ],
  },
  ristoanime: {
    id: "ristoanime",
    name: "RistoAnime",
    baseUrl: "https://ristoanime.co",
    latestUrl: "https://ristoanime.co/",
    animePathSegment: "/series/",
    episodePathSegment: "/episode/",
    titleSelectors: [".PostTitle", "h1", ".anime-details-title", ".anime-title", "[class*='title']"],
    synopsisSelectors: [".StoryArea p", ".StoryArea", ".content", ".story", ".anime-story", "[class*='description']"],
    coverImageSelectors: [".InnerPoster img", ".Poster img", ".singleCover .BG"],
    ratingSelectors: [".imdbRBox span", "[class*='rating']", ".anime-rating", ".score", "[class*='score']"],
    paginationMode: "rel-next",
    isEpisodeUrl: (absoluteHref, animeSlug) => {
      const safeDecode = (value: string) => {
        try {
          return decodeURIComponent(value).toLowerCase();
        } catch {
          return value.toLowerCase();
        }
      };

      const normalizedHref = safeDecode(absoluteHref);
      const normalizedSlug = safeDecode(animeSlug)
        .replace(/\/+$/, "")
        .replace(/-+/g, " ")
        .trim();

      if (!normalizedHref.startsWith("https://ristoanime.co/")) return false;
      if (normalizedHref.includes("/series/")) return false;
      if (!normalizedHref.includes("الحلقة")) return false;

      const slugTokens = normalizedSlug
        .split(/\s+/)
        .map((token) => token.trim())
        .filter((token) => token.length >= 3)
        .filter((token) => token !== "جميع" && token !== "حلقات" && token !== "انمي" && token !== "مترجمة");

      return slugTokens.some((token) => normalizedHref.includes(token));
    },
    searchUrls: [
      (query) => `https://ristoanime.co/?s=${encodeURIComponent(query)}`,
      (query) => `https://ristoanime.co/?search_param=animes&s=${encodeURIComponent(query)}`,
    ],
  },
};

function buildGenericProvider(config: GenericSiteConfig): ScraperProvider {
  return {
    id: config.id,
    name: config.name,
    baseUrl: config.baseUrl,
    latestUrl: config.latestUrl,
    animePathHint: `${config.baseUrl}${config.animePathSegment ?? "/anime/"}`,
    searchAnime: (query) => searchAnimeWithConfig(config, query),
    scrapeLatestAnime: (limit = 20) => scrapeLatestAnimeWithConfig(config, limit),
    scrapeAnimeInfo: (slug) => scrapeAnimeInfoWithConfig(config, slug),
    scrapeAnimeEpisodes: (slug) => scrapeAnimeEpisodesWithConfig(config, slug),
    scrapeEpisodeSources: (episodeId) => scrapeEpisodeSourcesWithConfig(config, episodeId),
  };
}

const witanimeProvider: ScraperProvider = {
  id: "witanime",
  name: "WITAnime",
  baseUrl: "https://witanime.you",
  latestUrl: "https://witanime.you",
  animePathHint: "https://witanime.you/anime/",
  searchAnime: (query) => witanime.searchAnime(query),
  scrapeLatestAnime: (limit = 20) => witanime.scrapeLatestAnime(limit),
  scrapeAnimeInfo: (slug) => witanime.scrapeAnimeInfo(slug),
  scrapeAnimeEpisodes: (slug) => witanime.scrapeAnimeEpisodes(slug),
  scrapeEpisodeSources: (episodeId) => witanime.scrapeEpisodeSources(episodeId),
};

const stardimaProvider: ScraperProvider = {
  id: "stardima",
  name: "StarDima",
  baseUrl: "https://watch.stardima.com",
  latestUrl: "https://watch.stardima.com/watch/tvshows/",
  animePathHint: "https://watch.stardima.com/watch/tvshows/",
  searchAnime: (query) => stardima.searchAnime(query),
  scrapeLatestAnime: (limit = 20) => stardima.scrapeLatestAnime(limit),
  scrapeAnimeInfo: (slug) => stardima.scrapeAnimeInfo(slug),
  scrapeAnimeEpisodes: (slug) => stardima.scrapeAnimeEpisodes(slug),
  scrapeEpisodeSources: (episodeId) => stardima.scrapeEpisodeSources(episodeId),
};

export const scraperProviders: Record<SourceSiteId, ScraperProvider> = {
  witanime: witanimeProvider,
  okanime: buildGenericProvider(genericConfigs.okanime),
  anime4up: buildGenericProvider(genericConfigs.anime4up),
  animelek: buildGenericProvider(genericConfigs.animelek),
  ristoanime: buildGenericProvider(genericConfigs.ristoanime),
  stardima: stardimaProvider,
};

export function getScraperProvider(source: SourceSiteId): ScraperProvider {
  return scraperProviders[source] ?? scraperProviders.witanime;
}

export function listScraperProviders() {
  return Object.values(scraperProviders).map((provider) => ({
    id: provider.id,
    name: provider.name,
    baseUrl: provider.baseUrl,
    animePathHint: provider.animePathHint,
  }));
}
