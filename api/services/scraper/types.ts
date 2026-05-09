export const SOURCE_SITE_IDS = [
  "witanime",
  "okanime",
  "anime4up",
  "animelek",
  "ristoanime",
  "stardima",
] as const;

export type SourceSiteId = (typeof SOURCE_SITE_IDS)[number];

export interface VideoSource {
  server: string;
  quality: 'sd' | 'hd' | 'fhd';
  url: string;
}

export interface EpisodeSources {
  episodeId: number;
  sources: VideoSource[];
}

export interface ScraperAnime {
  slug: string;
  title: string;
  titleEnglish?: string;
  titleJp?: string;
  titleArabic?: string;
  titleSynonyms?: string[];
  synopsis?: string;
  coverImage?: string;
  bannerImage?: string;
  status: 'ongoing' | 'completed' | 'upcoming';
  type: 'tv' | 'movie' | 'ova' | 'special';
  episodesCount: number;
  externalId?: string;
  sourceUrl?: string;
  rating?: string;
  releaseYear?: number;
  studio?: string;
  categoryName?: string;
  duration?: number;
}

export interface ScraperEpisode {
  id: string;
  number: number;
  title?: string;
  titleArabic?: string;
  synopsis?: string;
  thumbnail?: string;
  addedAt?: string;
  sources: VideoSource[];
}

export interface ScraperResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export type WitanimeAnime = ScraperAnime;
export type WitanimeEpisode = ScraperEpisode;
