import puppeteer, { type Browser, type Page } from "puppeteer";
import type { ScraperAnime, ScraperEpisode, VideoSource } from "./types";
import { getPuppeteerLaunchOptions } from "./puppeteer-launch";

const BASE_URL = "https://watch.stardima.com";
const WATCH_ROOT = `${BASE_URL}/watch`;
const TVSHOW_PATH = "/watch/tvshows/";
const EPISODE_PATH = "/watch/episodes/";
const TVSHOW_LIST_URL = `${WATCH_ROOT}/tvshows/`;
const SEARCH_URL = `${WATCH_ROOT}/?s=`;
const AJAX_URL = `${WATCH_ROOT}/wp-admin/admin-ajax.php`;
const PLAYER_URL_PREFIX = `${WATCH_ROOT}/player/player.php`;
const PUBLIC_BASE_URL = "https://www.stardima.com";
const PUBLIC_TVSHOW_PATH = "/tvshow/";
const PUBLIC_SEASON_API_PATH = "/series/season/";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";
const SHOW_CACHE_TTL_MS = 60_000;
const SOURCE_CACHE_TTL_MS = 120_000;

let browser: Browser | null = null;

type CachedShowData = {
  anime: ScraperAnime;
  episodes: ScraperEpisode[];
  expiresAt: number;
};

type CachedSourceData = {
  sources: VideoSource[];
  expiresAt: number;
};

type ScrapedShowData = {
  anime: ScraperAnime;
  episodes: ScraperEpisode[];
};

type PublicSeasonReference = {
  id: string;
  label: string;
  seasonNumber?: number;
  order: number;
};

type PublicSeasonPayload = {
  episodes?: Array<{
    id: number | string;
    episode_number?: number;
    title?: string;
    watch_url?: string;
  }>;
  series_id?: string;
};

const showCache = new Map<string, CachedShowData>();
const sourceCache = new Map<string, CachedSourceData>();

function normalizeSlug(value: string) {
  return value.trim().replace(/^\/+|\/+$/g, "");
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isHttpUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function isPublicShowUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.hostname.replace(/^www\./i, "") === "stardima.com" && parsed.pathname.includes(PUBLIC_TVSHOW_PATH);
  } catch {
    return false;
  }
}

function extractPublicShowSlug(value: string) {
  const normalized = normalizeSlug(value);
  if (!normalized) return null;

  if (isPublicShowUrl(normalized)) {
    const parsed = new URL(normalized);
    const segment = parsed.pathname.split(PUBLIC_TVSHOW_PATH)[1] ?? "";
    const slug = segment.split("/")[0]?.trim();
    return slug || null;
  }

  if (normalized.startsWith("tvshow/")) {
    const slug = normalized.split("/")[1]?.trim();
    return slug || null;
  }

  if (!normalized.includes("/") && !normalized.startsWith("http")) {
    return normalized;
  }

  return null;
}

function cloneAnime(value: ScraperAnime): ScraperAnime {
  return { ...value, titleSynonyms: value.titleSynonyms ? [...value.titleSynonyms] : undefined };
}

function cloneEpisodes(items: ScraperEpisode[]): ScraperEpisode[] {
  return items.map((episode) => ({
    ...episode,
    sources: episode.sources.map((source) => ({ ...source })),
  }));
}

function cloneSources(items: VideoSource[]): VideoSource[] {
  return items.map((source) => ({ ...source }));
}

async function getBrowser(): Promise<Browser> {
  if (browser) return browser;

  browser = await puppeteer.launch(getPuppeteerLaunchOptions());

  return browser;
}

async function createPage(): Promise<Page> {
  const activeBrowser = await getBrowser();
  const page = await activeBrowser.newPage();
  await page.setUserAgent(USER_AGENT);
  await page.setViewport({ width: 1440, height: 900 });
  return page;
}

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function safeNavigate(page: Page, url: string, retries = 3): Promise<boolean> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await delay(800);
      return true;
    } catch (error) {
      console.error(`Stardima navigation failed for ${url} (attempt ${attempt}):`, error);
      await delay(1_500);
    }
  }

  return false;
}

function normalizeAbsoluteUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("//")) return `https:${url}`;

  try {
    return new URL(url, `${BASE_URL}/`).toString();
  } catch {
    return undefined;
  }
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function cleanHtmlText(value: string | undefined) {
  return decodeHtmlEntities((value ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function extractMetaContent(html: string, key: string) {
  const escaped = escapeRegex(key);
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["']`, "i"),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return cleanHtmlText(match[1]);
  }

  return undefined;
}

async function fetchText(url: string, extraHeaders?: Record<string, string>) {
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
        "User-Agent": USER_AGENT,
        ...extraHeaders,
      },
    });

    if (!response.ok) return null;
    return await response.text();
  } catch (error) {
    console.error(`Failed to fetch Stardima HTML from ${url}:`, error);
    return null;
  }
}

async function fetchJson<T>(url: string, extraHeaders?: Record<string, string>) {
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json,text/plain,*/*",
        "User-Agent": USER_AGENT,
        ...extraHeaders,
      },
    });

    if (!response.ok) return null;
    return await response.json() as T;
  } catch (error) {
    console.error(`Failed to fetch Stardima JSON from ${url}:`, error);
    return null;
  }
}

function cleanTitle(value: string | undefined, fallback: string) {
  const cleaned = (value ?? "")
    .replace(/\s*-\s*StarDima.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned) return cleaned.slice(0, 255);

  return fallback
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 255);
}

function splitDisplayTitles(value: string | undefined, fallback: string) {
  const cleaned = cleanTitle(value, fallback);
  const parts = cleaned
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    return {
      primary: parts[0],
      secondary: parts[1],
    };
  }

  return {
    primary: cleaned,
    secondary: undefined,
  };
}

function toSynopsis(value: string | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim().slice(0, 2_000);
}

function parseDurationMinutes(value?: string) {
  if (!value) return undefined;

  const isoMatch = value.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i);
  if (isoMatch) {
    const hours = Number.parseInt(isoMatch[1] ?? "0", 10);
    const minutes = Number.parseInt(isoMatch[2] ?? "0", 10);
    const seconds = Number.parseInt(isoMatch[3] ?? "0", 10);
    const totalMinutes = hours * 60 + minutes + Math.round(seconds / 60);
    return totalMinutes > 0 ? totalMinutes : undefined;
  }

  const textMatch = value.match(/(\d{1,3})\s*(?:min|minute|minutes|دقيقة)/i);
  if (!textMatch) return undefined;

  const totalMinutes = Number.parseInt(textMatch[1], 10);
  return Number.isFinite(totalMinutes) && totalMinutes > 0 ? totalMinutes : undefined;
}

function parseReleaseYear(...candidates: Array<string | undefined>) {
  for (const candidate of candidates) {
    const match = candidate?.match(/\b(19\d{2}|20\d{2})\b/);
    if (!match) continue;

    const year = Number.parseInt(match[1], 10);
    if (year >= 1950 && year <= new Date().getFullYear() + 1) {
      return year;
    }
  }

  return undefined;
}

function toStatus(value: string | undefined, episodesCount: number): ScraperAnime["status"] {
  const text = (value ?? "").toLowerCase();
  if (text.includes("completed") || text.includes("finished") || text.includes("مكتمل")) return "completed";
  if (text.includes("ongoing") || text.includes("currently") || text.includes("مستمر") || text.includes("يعرض")) {
    return "ongoing";
  }

  return episodesCount > 0 ? "ongoing" : "upcoming";
}

function inferQualityFromUrl(url: string | undefined): VideoSource["quality"] {
  const lowerUrl = (url ?? "").toLowerCase();
  if (
    lowerUrl.includes("itag=37") ||
    lowerUrl.includes("itag=137") ||
    lowerUrl.includes("=m37") ||
    lowerUrl.includes("1080")
  ) {
    return "fhd";
  }

  if (
    lowerUrl.includes("itag=18") ||
    lowerUrl.includes("=m18") ||
    lowerUrl.includes("360") ||
    lowerUrl.includes("480")
  ) {
    return "sd";
  }

  return "hd";
}

function parseEpisodeNumber(rawLabel: string | undefined, rawTitle: string | undefined, href: string | undefined) {
  const label = (rawLabel ?? "").replace(/\s+/g, " ").trim();
  const title = (rawTitle ?? "").replace(/\s+/g, " ").trim();
  const combined = `${label} ${title}`;

  const labelMatch = label.match(/(\d+)\s*$/);
  if (labelMatch) return Number.parseInt(labelMatch[1], 10);

  const titleMatch =
    combined.match(/(?:episode|ep|الحلقة)\s*[-:]?\s*(\d{1,4})/i) ||
    combined.match(/(\d{1,4})\s*x\s*(\d{1,4})/i);
  if (titleMatch) {
    const value = titleMatch[2] ?? titleMatch[1];
    return Number.parseInt(value, 10);
  }

  const hrefMatch = href?.match(/(?:^|\/)(\d{1,4})(?:[^0-9]|$)/);
  if (hrefMatch) return Number.parseInt(hrefMatch[1], 10);

  return null;
}

function dedupeAnime(items: ScraperAnime[], limit?: number) {
  const seen = new Set<string>();
  const results: ScraperAnime[] = [];

  for (const item of items) {
    if (!item.slug || seen.has(item.slug)) continue;
    seen.add(item.slug);
    results.push(item);
    if (limit && results.length >= limit) break;
  }

  return results;
}

function dedupeEpisodes(items: ScraperEpisode[]) {
  const seen = new Map<number, ScraperEpisode>();

  for (const episode of items) {
    if (!Number.isFinite(episode.number) || episode.number <= 0 || episode.number > 500) continue;
    if (!seen.has(episode.number)) {
      seen.set(episode.number, episode);
    }
  }

  return Array.from(seen.values()).sort((left, right) => left.number - right.number);
}

function extractPublicPlayUrl(html: string) {
  const absolute = html.match(/https:\/\/www\.stardima\.com\/tvshow\/[^"' ]+\/play\/\d+/i)?.[0];
  if (absolute) return normalizeAbsoluteUrl(absolute);

  const relative = html.match(/\/tvshow\/[^"' ]+\/play\/\d+/i)?.[0];
  return normalizeAbsoluteUrl(relative ?? undefined);
}

function parseSeasonNumber(label: string) {
  const seasonMatch = label.match(/(?:season|s|الموسم)\s*0*(\d{1,3})/i) ?? label.match(/\b(\d{1,3})\b/);
  if (!seasonMatch) return undefined;

  const value = Number.parseInt(seasonMatch[1], 10);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function extractPublicSeasonReferences(html: string) {
  const refs: PublicSeasonReference[] = [];
  const seen = new Set<string>();
  const seasonRegex =
    /class="[^"]*season-item[^"]*"[^>]*data-season-id="([^"]+)"[^>]*data-season-number="([^"]+)"/gi;

  let match: RegExpExecArray | null;
  while ((match = seasonRegex.exec(html)) !== null) {
    const id = match[1]?.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);

    const label = cleanHtmlText(match[2]);
    refs.push({
      id,
      label,
      seasonNumber: parseSeasonNumber(label),
      order: refs.length,
    });
  }

  const initialSeasonId = html.match(/data-initial-season-id="([^"]+)"/i)?.[1]?.trim();
  if (initialSeasonId && !seen.has(initialSeasonId)) {
    const currentLabel = cleanHtmlText(html.match(/id="current-season-dropdown-text"[^>]*>([\s\S]*?)<\/span>/i)?.[1]) || "Season 1";
    refs.push({
      id: initialSeasonId,
      label: currentLabel,
      seasonNumber: parseSeasonNumber(currentLabel),
      order: refs.length,
    });
  }

  return refs.sort((left, right) => {
    if (left.seasonNumber && right.seasonNumber) return left.seasonNumber - right.seasonNumber;
    if (left.seasonNumber) return -1;
    if (right.seasonNumber) return 1;
    return left.order - right.order;
  });
}

function buildPublicEpisodeTitle(
  season: PublicSeasonReference | undefined,
  rawTitle: string | undefined,
  episodeNumber: number,
  overallNumber: number,
) {
  const cleaned = cleanTitle(rawTitle, `Episode ${overallNumber}`);
  const looksGeneric = /^(?:ep|episode)\s*0*\d+$/i.test(cleaned);

  if (season?.seasonNumber) {
    return looksGeneric
      ? `Season ${season.seasonNumber} Episode ${episodeNumber}`
      : `Season ${season.seasonNumber} Episode ${episodeNumber} - ${cleaned}`;
  }

  return looksGeneric ? `Episode ${overallNumber}` : cleaned;
}

async function loadPublicShowData(input: string): Promise<ScrapedShowData | null> {
  const publicSlug = extractPublicShowSlug(input);
  if (!publicSlug) return null;

  const showUrl = isPublicShowUrl(input)
    ? `${PUBLIC_BASE_URL}${PUBLIC_TVSHOW_PATH}${publicSlug}`
    : `${PUBLIC_BASE_URL}${PUBLIC_TVSHOW_PATH}${publicSlug}`;
  const showHtml = await fetchText(showUrl);
  if (!showHtml) return null;

  const playUrl = extractPublicPlayUrl(showHtml);
  if (!playUrl) return null;

  const playHtml = await fetchText(playUrl, { Referer: showUrl });
  if (!playHtml) return null;

  const seasonReferences = extractPublicSeasonReferences(playHtml);
  if (seasonReferences.length === 0) return null;

  const title =
    extractMetaContent(showHtml, "og:title") ||
    cleanHtmlText(showHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]) ||
    cleanHtmlText(showHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]);
  const synopsis = extractMetaContent(showHtml, "og:description") ?? extractMetaContent(showHtml, "description");
  const coverImage = extractMetaContent(showHtml, "og:image");
  const publicEpisodes: ScraperEpisode[] = [];
  const seenUrls = new Set<string>();
  let overallNumber = 1;

  for (const season of seasonReferences) {
    if (overallNumber > 500) break;

    const payload = await fetchJson<PublicSeasonPayload>(
      `${PUBLIC_BASE_URL}${PUBLIC_SEASON_API_PATH}${season.id}?X-Requested-With=XMLHttpRequest`,
      { "X-Requested-With": "XMLHttpRequest", Referer: playUrl },
    );
    const seasonEpisodes = Array.isArray(payload?.episodes) ? payload.episodes : [];

    const orderedEpisodes = seasonEpisodes
      .map((episode) => ({
        id: String(episode.id ?? "").trim(),
        episodeNumber: Number.parseInt(String(episode.episode_number ?? ""), 10),
        title: episode.title?.trim(),
        watchUrl: normalizeAbsoluteUrl(episode.watch_url),
      }))
      .filter((episode) => episode.id && episode.watchUrl && Number.isFinite(episode.episodeNumber) && episode.episodeNumber > 0)
      .sort((left, right) => left.episodeNumber - right.episodeNumber);

    for (const episode of orderedEpisodes) {
      if (!episode.watchUrl || seenUrls.has(episode.watchUrl)) continue;
      if (overallNumber > 500) break;

      seenUrls.add(episode.watchUrl);
      publicEpisodes.push({
        id: episode.watchUrl,
        number: overallNumber,
        title: buildPublicEpisodeTitle(season, episode.title, episode.episodeNumber, overallNumber),
        sources: [],
      });
      overallNumber++;
    }
  }

  if (publicEpisodes.length === 0) return null;
  const publicTitles = splitDisplayTitles(title, publicSlug);

  return {
    anime: {
      slug: publicSlug,
      title: publicTitles.primary,
      titleEnglish: publicTitles.secondary,
      synopsis: toSynopsis(synopsis),
      coverImage: normalizeAbsoluteUrl(coverImage),
      sourceUrl: showUrl,
      status: "ongoing",
      type: "tv",
      episodesCount: publicEpisodes.length,
      releaseYear: parseReleaseYear(showHtml),
    },
    episodes: dedupeEpisodes(publicEpisodes),
  };
}

async function scrapeAnimeCardsFromPage(page: Page, selector: string) {
  return page.evaluate(
    new Function(
      "cardSelector",
      "baseUrl",
      "tvshowPath",
      `
        const normalizeUrl = (value) => {
          if (!value) return "";
          try {
            return new URL(value, baseUrl + "/").toString();
          } catch {
            return "";
          }
        };

        const extractSlug = (value) => {
          try {
            const parsed = new URL(value);
            const normalizedSegment = tvshowPath.endsWith("/") ? tvshowPath : tvshowPath + "/";
            const parts = parsed.pathname.split(normalizedSegment);
            const slug = parts[1] || "";
            return slug.replace(/^\\/+/g, "").replace(/\\/+$/g, "");
          } catch {
            return "";
          }
        };

        const cards = Array.from(document.querySelectorAll(cardSelector));
        return cards.map((card) => {
          const link =
            card.querySelector("a[href*='/watch/tvshows/']")?.getAttribute("href") ||
            card.querySelector("a")?.getAttribute("href") ||
            "";
          const href = normalizeUrl(link);
          const title =
            card.querySelector(".details .title a, .data h3, .data h2, .title a, .title, h2, h3, h4")?.textContent?.trim() ||
            card.querySelector("img")?.getAttribute("alt")?.trim() ||
            "";
          const image =
            card.querySelector("img")?.getAttribute("src") ||
            card.querySelector("img")?.getAttribute("data-src") ||
            "";
          const metaText =
            card.querySelector(".metadata, .meta, .mepo, .texto, .data span")?.textContent?.trim() || "";
          const ratingText = card.querySelector(".imdb, .rating")?.textContent?.trim() || "";

          return {
            href,
            slug: extractSlug(href),
            title,
            coverImage: normalizeUrl(image),
            metaText,
            ratingText,
          };
        });
      `,
    ) as unknown as (cardSelector: string, baseUrl: string, tvshowPath: string) => Array<{
      href: string;
      slug: string;
      title: string;
      coverImage: string;
      metaText: string;
      ratingText: string;
    }>,
    selector,
    BASE_URL,
    TVSHOW_PATH,
  );
}

async function extractShowPageData(page: Page, slug: string): Promise<ScrapedShowData> {
  const raw = await page.evaluate(
    new Function(
      "baseUrl",
      "episodePath",
      `
        const normalizeUrl = (value) => {
          if (!value) return "";
          try {
            return new URL(value, baseUrl + "/").toString();
          } catch {
            return "";
          }
        };

        const firstText = (...selectors) => {
          for (const selector of selectors) {
            const element = document.querySelector(selector);
            const value = element?.textContent?.trim();
            if (value) return value;
          }
          return "";
        };

        const jsonLdBlocks = Array.from(document.querySelectorAll("script[type='application/ld+json']"))
          .map((node) => node.textContent?.trim() || "")
          .filter(Boolean);

        let structuredName = "";
        let structuredDescription = "";
        let structuredDuration = "";
        let structuredUploadDate = "";

        for (const block of jsonLdBlocks) {
          try {
            const parsed = JSON.parse(block);
            const candidates = Array.isArray(parsed)
              ? parsed
              : parsed?.["@graph"] && Array.isArray(parsed["@graph"])
                ? parsed["@graph"]
                : [parsed];

            for (const candidate of candidates) {
              if (!candidate || typeof candidate !== "object") continue;
              if (!structuredName && typeof candidate.name === "string") structuredName = candidate.name;
              if (!structuredDescription && typeof candidate.description === "string") structuredDescription = candidate.description;
              if (!structuredDuration && typeof candidate.duration === "string") structuredDuration = candidate.duration;
              if (!structuredUploadDate && typeof candidate.datePublished === "string") structuredUploadDate = candidate.datePublished;
            }
          } catch {}
        }

        const episodes = Array.from(document.querySelectorAll("#seasons .episodios li, ul.episodios li")).map((item) => {
          const href =
            item.querySelector(".episodiotitle a")?.getAttribute("href") ||
            item.querySelector("a")?.getAttribute("href") ||
            "";
          const absoluteHref = normalizeUrl(href);
          let id = "";

          try {
            const parsed = new URL(absoluteHref);
            const normalizedSegment = episodePath.endsWith("/") ? episodePath : episodePath + "/";
            const parts = parsed.pathname.split(normalizedSegment);
            id = (parts[1] || "").replace(/^\\/+/g, "").replace(/\\/+$/g, "");
          } catch {}

          return {
            id,
            title: item.querySelector(".episodiotitle a")?.textContent?.trim() || "",
            label: item.querySelector(".numerando")?.textContent?.trim() || "",
            thumbnail: normalizeUrl(
              item.querySelector(".imagen img, img")?.getAttribute("src") ||
              item.querySelector(".imagen img, img")?.getAttribute("data-src") ||
              "",
            ),
          };
        });

        const tagValues = Array.from(document.querySelectorAll("#info .wp-tags a, #info .genres a, .genres .mta a"))
          .map((node) => node.textContent?.trim() || "")
          .filter(Boolean);

        return {
          title:
            document.querySelector("h1")?.textContent?.trim() ||
            document.querySelector("meta[property='og:title']")?.getAttribute("content")?.trim() ||
            document.title ||
            "",
          synopsis:
            firstText("#info .wp-content p", "#info .wp-content", ".wp-content p", ".texto", ".contenido p") ||
            structuredDescription ||
            document.querySelector("meta[property='og:description']")?.getAttribute("content")?.trim() ||
            "",
          coverImage:
            normalizeUrl(document.querySelector("meta[property='og:image']")?.getAttribute("content")) ||
            normalizeUrl(document.querySelector(".poster img, .sheader img, img")?.getAttribute("src")) ||
            "",
          ratingText:
            firstText(".poster .rating", ".starstruck-rating-wrap .dt_rating_vgs", ".imdb, .rating, .metadata .imdb") || "",
          yearText: firstText(".metadata .year", ".mepo .year", ".poster .year", ".extra .year") || "",
          statusText: firstText(".sheader .data", ".sheader", ".metadata", ".mepo", ".poster"),
          tags: tagValues,
          durationText: structuredDuration,
          structuredName,
          episodes,
        };
      `,
    ) as unknown as (baseUrl: string, episodePath: string) => {
      title: string;
      synopsis: string;
      coverImage: string;
      ratingText: string;
      yearText: string;
      statusText: string;
      tags: string[];
      durationText: string;
      structuredName: string;
      episodes: Array<{ id: string; title: string; label: string; thumbnail: string }>;
    },
    BASE_URL,
    EPISODE_PATH,
  );

  const parsedEpisodes = raw.episodes.map((episode) => {
    const number = parseEpisodeNumber(episode.label, episode.title, episode.id);
    if (!episode.id || !number) return null;

    return {
      id: episode.id,
      number,
      title: cleanTitle(episode.title, `Episode ${number}`),
      thumbnail: normalizeAbsoluteUrl(episode.thumbnail),
      sources: [],
    } as ScraperEpisode;
  });

  const episodes = dedupeEpisodes(
    parsedEpisodes.filter((episode): episode is ScraperEpisode => episode !== null),
  );

  const categoryName = raw.tags
    .filter((tag) => {
      const normalized = tag.toLowerCase();
      return normalized !== "watch" && normalized !== "مشاهدة";
    })
    .join(" | ");

  const showTitles = splitDisplayTitles(raw.structuredName || raw.title, slug);

  const anime: ScraperAnime = {
    slug,
    title: showTitles.primary,
    titleEnglish: showTitles.secondary,
    synopsis: toSynopsis(raw.synopsis),
    coverImage: normalizeAbsoluteUrl(raw.coverImage),
    sourceUrl: `${WATCH_ROOT}/tvshows/${slug}`,
    status: toStatus(raw.statusText, episodes.length),
    type: "tv",
    episodesCount: episodes.length,
    rating: raw.ratingText || undefined,
    releaseYear: parseReleaseYear(raw.yearText),
    categoryName: categoryName || undefined,
    duration: parseDurationMinutes(raw.durationText),
  };

  return {
    anime,
    episodes,
  };
}

async function loadWatchShowPageData(slug: string): Promise<ScrapedShowData | null> {
  const normalizedSlug = normalizeSlug(slug);
  const page = await createPage();

  try {
    const url = `${WATCH_ROOT}/tvshows/${normalizedSlug}`;
    if (!await safeNavigate(page, url)) return null;

    await page.waitForSelector("h1, #info .wp-content p, #seasons .episodios li, ul.episodios li", {
      timeout: 10_000,
    });

    return await extractShowPageData(page, normalizedSlug);
  } catch (error) {
    console.error(`Error scraping Stardima watch page for ${normalizedSlug}:`, error);
    return null;
  } finally {
    await page.close();
  }
}

async function loadShowPageData(slug: string): Promise<ScrapedShowData | null> {
  const normalizedSlug = normalizeSlug(slug);
  const cached = showCache.get(normalizedSlug);
  if (cached && cached.expiresAt > Date.now()) {
    return {
      anime: cloneAnime(cached.anime),
      episodes: cloneEpisodes(cached.episodes),
    };
  }

  const publicFirst = isPublicShowUrl(normalizedSlug) || /^video-/i.test(normalizedSlug);
  const attempts = publicFirst
    ? [() => loadPublicShowData(slug), () => loadWatchShowPageData(normalizedSlug)]
    : [() => loadWatchShowPageData(normalizedSlug), () => loadPublicShowData(slug)];

  let fallback: ScrapedShowData | null = null;

  for (const attempt of attempts) {
    const data = await attempt();
    if (!data) continue;

    if (data.episodes.length > 0) {
      showCache.set(normalizedSlug, {
        anime: cloneAnime(data.anime),
        episodes: cloneEpisodes(data.episodes),
        expiresAt: Date.now() + SHOW_CACHE_TTL_MS,
      });

      return {
        anime: cloneAnime(data.anime),
        episodes: cloneEpisodes(data.episodes),
      };
    }

    fallback ??= data;
  }

  if (fallback) {
    const data = fallback;
    showCache.set(normalizedSlug, {
      anime: cloneAnime(data.anime),
      episodes: cloneEpisodes(data.episodes),
      expiresAt: Date.now() + SHOW_CACHE_TTL_MS,
    });

    return {
      anime: cloneAnime(data.anime),
      episodes: cloneEpisodes(data.episodes),
    };
  }

  return null;
}

async function resolvePlayerUrl(playerUrl: string): Promise<{ url: string; quality: VideoSource["quality"] }> {
  const page = await createPage();

  try {
    if (!await safeNavigate(page, playerUrl, 2)) {
      return { url: playerUrl, quality: inferQualityFromUrl(playerUrl) };
    }

    await page.waitForFunction(
      `
        (() => {
          const video = document.querySelector("video");
          const source = document.querySelector("source");
          return Boolean(video?.currentSrc || video?.getAttribute("src") || source?.getAttribute("src"));
        })()
      `,
      { timeout: 7_000 },
    );

    const directUrl = await page.evaluate(
      `
        (() => {
          const video = document.querySelector("video");
          const source = document.querySelector("source");
          return video?.currentSrc || video?.getAttribute("src") || source?.getAttribute("src") || "";
        })()
      `,
    ) as string;

    const normalizedUrl = normalizeAbsoluteUrl(directUrl) ?? playerUrl;
    return {
      url: normalizedUrl,
      quality: inferQualityFromUrl(normalizedUrl),
    };
  } catch {
    return { url: playerUrl, quality: inferQualityFromUrl(playerUrl) };
  } finally {
    await page.close();
  }
}

function decodeBase64Url(value: string): string | null {
  if (!value) return null;

  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
    return Buffer.from(normalized, "base64").toString("utf8").trim() || null;
  } catch {
    return null;
  }
}

export async function searchAnime(query: string): Promise<ScraperAnime[]> {
  const page = await createPage();

  try {
    const url = `${SEARCH_URL}${encodeURIComponent(query.trim())}`;
    if (!await safeNavigate(page, url)) return [];

    await page.waitForSelector(".search-page .result-item article, .result-item article", { timeout: 10_000 });

    const items = await scrapeAnimeCardsFromPage(page, ".search-page .result-item article, .result-item article");
    return dedupeAnime(
      items
        .filter((item) => item.href.includes(TVSHOW_PATH) && item.slug)
        .map((item) => ({
          slug: item.slug,
          title: cleanTitle(item.title, item.slug),
          coverImage: normalizeAbsoluteUrl(item.coverImage),
          status: "upcoming",
          type: "tv",
          episodesCount: 0,
          rating: item.ratingText || undefined,
          releaseYear: parseReleaseYear(item.metaText),
        })),
      15,
    );
  } catch (error) {
    console.error(`Error searching Stardima for "${query}":`, error);
    return [];
  } finally {
    await page.close();
  }
}

export async function scrapeLatestAnime(limit = 20): Promise<ScraperAnime[]> {
  const page = await createPage();

  try {
    if (!await safeNavigate(page, TVSHOW_LIST_URL)) return [];

    await page.waitForSelector(".items article.item, article.item", { timeout: 10_000 });
    const items = await scrapeAnimeCardsFromPage(page, ".items article.item, article.item");

    return dedupeAnime(
      items
        .filter((item) => item.href.includes(TVSHOW_PATH) && item.slug)
        .map((item) => ({
          slug: item.slug,
          title: cleanTitle(item.title, item.slug),
          coverImage: normalizeAbsoluteUrl(item.coverImage),
          status: "ongoing",
          type: "tv",
          episodesCount: 0,
          rating: item.ratingText || undefined,
          releaseYear: parseReleaseYear(item.metaText),
        })),
      limit,
    );
  } catch (error) {
    console.error("Error scraping Stardima latest anime:", error);
    return [];
  } finally {
    await page.close();
  }
}

export async function scrapeAnimeInfo(slug: string): Promise<ScraperAnime | null> {
  const data = await loadShowPageData(slug);
  return data ? cloneAnime(data.anime) : null;
}

export async function scrapeAnimeEpisodes(slug: string): Promise<ScraperEpisode[]> {
  const data = await loadShowPageData(slug);
  return data ? cloneEpisodes(data.episodes) : [];
}

export async function scrapeEpisodeSources(episodeId: string): Promise<VideoSource[]> {
  const normalizedEpisodeId = normalizeSlug(episodeId);
  const cached = sourceCache.get(normalizedEpisodeId);
  if (cached && cached.expiresAt > Date.now()) {
    return cloneSources(cached.sources);
  }

  if (isHttpUrl(normalizedEpisodeId) && !normalizedEpisodeId.includes(`${WATCH_ROOT}/episodes/`)) {
    const sourceUrl = normalizeAbsoluteUrl(normalizedEpisodeId);
    if (!sourceUrl) return [];

    const publicSource = {
      server: "stardima-public",
      quality: inferQualityFromUrl(sourceUrl),
      url: sourceUrl,
    } satisfies VideoSource;

    sourceCache.set(normalizedEpisodeId, {
      sources: [publicSource],
      expiresAt: Date.now() + SOURCE_CACHE_TTL_MS,
    });

    return [publicSource];
  }

  const page = await createPage();

  try {
    const episodeUrl = `${WATCH_ROOT}/episodes/${normalizedEpisodeId}`;
    if (!await safeNavigate(page, episodeUrl)) return [];

    await page.waitForSelector("#playeroptionsul li.dooplay_player_option, #playeroptions li.dooplay_player_option", {
      timeout: 10_000,
    });

    const options = await page.evaluate(
      `
        (() => {
          const items = Array.from(
            document.querySelectorAll("#playeroptionsul li.dooplay_player_option, #playeroptions li.dooplay_player_option"),
          );

          return items.map((item, index) => ({
            post: item.getAttribute("data-post") || "",
            nume: item.getAttribute("data-nume") || item.getAttribute("data-id") || String(index + 1),
            type: item.getAttribute("data-type") || "tv",
            label: item.querySelector(".title")?.textContent?.trim() || item.textContent?.trim() || "Server " + (index + 1),
            index,
          }));
        })()
      `,
    ) as Array<{ post: string; nume: string; type: string; label: string; index: number }>;

    const discovered: VideoSource[] = [];

    for (const option of options) {
      if (!option.post || !option.nume) continue;

      try {
        const response = await fetch(AJAX_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "X-Requested-With": "XMLHttpRequest",
            Origin: BASE_URL,
            Referer: episodeUrl,
            "User-Agent": USER_AGENT,
          },
          body: new URLSearchParams({
            action: "doo_player_ajax",
            post: option.post,
            nume: option.nume,
            type: option.type,
          }).toString(),
        });

        if (!response.ok) continue;

        const payload = await response.json().catch(() => null) as
          | { embed_url?: string; type?: string }
          | null;
        const decodedPlayerUrl = normalizeAbsoluteUrl(decodeBase64Url(payload?.embed_url ?? ""));
        if (!decodedPlayerUrl) continue;

        const resolved = decodedPlayerUrl.startsWith(PLAYER_URL_PREFIX)
          ? await resolvePlayerUrl(decodedPlayerUrl)
          : { url: decodedPlayerUrl, quality: inferQualityFromUrl(decodedPlayerUrl) };

        discovered.push({
          server: `stardima-${option.index + 1}`,
          quality: resolved.quality,
          url: resolved.url,
        });
      } catch (error) {
        console.error(`Failed to resolve Stardima source for ${normalizedEpisodeId}/${option.nume}:`, error);
      }
    }

    const deduped = new Map<string, VideoSource>();
    for (const source of discovered) {
      if (source.url && !deduped.has(source.url)) {
        deduped.set(source.url, source);
      }
    }

    const results = Array.from(deduped.values());
    if (results.length > 0) {
      sourceCache.set(normalizedEpisodeId, {
        sources: cloneSources(results),
        expiresAt: Date.now() + SOURCE_CACHE_TTL_MS,
      });
    }

    return results;
  } catch (error) {
    console.error(`Error scraping Stardima episode sources for ${normalizedEpisodeId}:`, error);
    return [];
  } finally {
    await page.close();
  }
}
