/* eslint-disable no-irregular-whitespace */
import { load, type CheerioAPI } from "cheerio";
import puppeteer, { Browser, Page } from "puppeteer";
import type { ScraperAnime, ScraperEpisode, SourceSiteId, VideoSource } from "./types";
import { getPuppeteerLaunchOptions } from "./puppeteer-launch";

export interface GenericSiteConfig {
  id: SourceSiteId;
  name: string;
  baseUrl: string;
  latestUrl?: string;
  animePathSegment?: string;
  episodePathSegment?: string;
  searchUrls?: ((query: string) => string)[];
  titleSelectors?: string[];
  synopsisSelectors?: string[];
  coverImageSelectors?: string[];
  ratingSelectors?: string[];
  paginationMode?: "anchors" | "rel-next" | "anchors-and-rel-next";
  isEpisodeUrl?: (absoluteHref: string, animeSlug: string) => boolean;
}

interface StructuredAnimeData {
  title?: string;
  alternateTitle?: string;
  description?: string;
  image?: string;
  episodesCount?: number;
  genres?: string[];
  rating?: string;
  year?: number;
}

const browserCache = new Map<string, Browser>();
const HTML_FETCH_TIMEOUT_MS = 30_000;
const HTML_FETCH_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
  "accept-language": "en-US,en;q=0.9,ar;q=0.8",
};

async function getBrowser(cacheKey: string): Promise<Browser> {
  const existing = browserCache.get(cacheKey);
  if (existing) return existing;

  const browser = await puppeteer.launch(getPuppeteerLaunchOptions());

  browserCache.set(cacheKey, browser);
  return browser;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function decodeBase64Url(value: string): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("//") || trimmed.startsWith("/")) return null;
  if (/[?&=:]/.test(trimmed)) return null;
  if (!/^[A-Za-z0-9+/_=-]+$/.test(trimmed)) return null;
  if (trimmed.length < 8) return null;

  try {
    const normalized = trimmed.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(trimmed.length / 4) * 4, "=");
    return Buffer.from(normalized, "base64").toString("utf8").trim() || null;
  } catch {
    return null;
  }
}

function normalizeAbsoluteUrl(baseUrl: string, url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("//")) return `https:${url}`;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("/")) return `${baseUrl}${url}`;

  try {
    return new URL(url, `${baseUrl}/`).toString();
  } catch {
    return undefined;
  }
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&#x2F;/gi, "/")
    .replace(/&#47;/gi, "/");
}

function safeDecodeUrlComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function extractBackgroundImageUrl(styleValue: string | undefined): string | undefined {
  if (!styleValue) return undefined;
  const match = styleValue.match(/background-image\s*:\s*url\((['"]?)(.+?)\1\)/i);
  return match?.[2]?.trim() || undefined;
}

function getTitleSelectors(config: GenericSiteConfig): string[] {
  return config.titleSelectors ?? ["h1", ".anime-details-title", ".anime-title", ".PostTitle", "[class*='title']"];
}

function getSynopsisSelectors(config: GenericSiteConfig): string[] {
  return (
    config.synopsisSelectors ?? [".content", "p.anime-story", "[class*='synopsis']", "[class*='description']", ".story", ".StoryArea p", ".StoryArea", ".anime-story", ".entry-content p"]
  );
}

function getCoverImageSelectors(config: GenericSiteConfig): string[] {
  return (
    config.coverImageSelectors ?? [
      ".InnerPoster img",
      ".Poster img",
      ".singleCover .BG",
      'img[class*="poster"]',
      ".posters img",
      ".anime-header img",
      '[class*="poster"] img',
      ".wp-post-image",
      ".attachment-post-thumbnail",
      ".anime-thumbnail img",
      ".thumb img",
    ]
  );
}

function getRatingSelectors(config: GenericSiteConfig): string[] {
  return config.ratingSelectors ?? [".imdbRBox span", "[class*='rating']", ".anime-rating", ".score", "[class*='score']"];
}

function unwrapProviderUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;

  const cleaned = decodeHtmlEntities(url.trim());

  try {
    const parsed = new URL(cleaned);
    if (parsed.pathname.endsWith("/card.php")) {
      const random = parsed.searchParams.get("random");
      if (random) {
        return decodeHtmlEntities(random);
      }
    }
  } catch {
    // ignore malformed wrapper urls
  }

  return cleaned;
}

function cleanupTitle(title: string): string {
  return title.replace(/Ã.*?Å /g, "").trim();
}

function normalizeTitleCandidate(title: string): string {
  return cleanupTitle(title)
    .replace(/\s+/g, " ")
    .replace(/مشاهدة وتحميل/gi, "")
    .replace(/مشاهدة جميع حلقات انمي/gi, "")
    .replace(/جميع حلقات انمي/gi, "")
    .replace(/جميع الحلقات/gi, "")
    .replace(/جميع حلقات/gi, "")
    .replace(/^انمي\s+/i, "")
    .replace(/مترجمة اون لاين.*/i, "")
    .replace(/مشاهدة اون لاين.*/i, "")
    .replace(/\|.*$/, "")
    .replace(/\s*\/\s*\d{4}\s*$/, "")
    .trim();
}

function normalizeEpisodeCardTitle(title: string): string {
  const cleaned = cleanupTitle(title)
    .replace(/\s+/g, " ")
    .replace(/\|.*$/, "")
    .trim();

  const arabicEpisodeMatch =
    cleaned.match(/الحلقة\s*[-:]?\s*(\d{1,4})/i) ||
    cleaned.match(/(\d{1,4})\s*الحلقة/i);

  if (arabicEpisodeMatch) {
    return `الحلقة ${arabicEpisodeMatch[1]}`;
  }

  const englishEpisodeMatch = cleaned.match(/(?:episode|ep)\s*[-:]?\s*(\d{1,4})/i);
  if (englishEpisodeMatch) {
    return `Episode ${englishEpisodeMatch[1]}`;
  }

  return cleaned;
}

function isWeakEpisodeTitle(title: string): boolean {
  const normalized = cleanupTitle(title).replace(/\s+/g, " ").trim().toLowerCase();
  return !normalized || normalized === "tv" || normalized.includes("مشاهدة وتحميل");
}

function pickBestTitle(...candidates: Array<string | undefined>): string {
  const normalized = candidates
    .map((value) => normalizeTitleCandidate(value ?? ""))
    .filter(Boolean)
    .filter((value) => !["تصفح", "الرئيسية", "home"].includes(value.toLowerCase()));

  if (normalized.length === 0) return "";
  return normalized.find((value) => !value.includes("الحلقة")) ?? normalized[0];
}

function inferQuality(serverName: string): "sd" | "hd" | "fhd" {
  if (serverName.includes("sd") || serverName.includes("360") || serverName.includes("480")) return "sd";
  if (serverName.includes("fhd") || serverName.includes("1080") || serverName.includes("full")) return "fhd";
  return "hd";
}

function inferServer(serverName: string, url: string): string {
  const lowerName = serverName.toLowerCase();
  const lowerUrl = url.toLowerCase();

  if (lowerName.includes("mp4upload") || lowerUrl.includes("mp4upload")) return "mp4upload";
  if (lowerName.includes("streamwish") || lowerName.includes("playerwish") || lowerUrl.includes("streamwish") || lowerUrl.includes("playerwish")) return "streamwish";
  if (lowerName.includes("yona") || lowerUrl.includes("yona")) return "yonaplay";
  if (lowerName.includes("videa") || lowerUrl.includes("videa")) return "videa";
  if (lowerName.includes("voe") || lowerUrl.includes("voe")) return "voe";
  if (lowerName.includes("uqload") || lowerUrl.includes("uqload")) return "uqload";
  if (lowerName.includes("vkvideo") || lowerUrl.includes("vkvideo")) return "vkvideo";
  if (lowerName.includes("file-upload") || lowerUrl.includes("file-upload")) return "fileupload";
  if (lowerName.includes("share4max") || lowerUrl.includes("share4max")) return "share4max";
  if (lowerName.includes("larhu") || lowerUrl.includes("larhu")) return "larhu";
  if (lowerName.includes("dsvplay") || lowerUrl.includes("dsvplay")) return "dsvplay";
  if (lowerUrl.includes("mega") || lowerUrl.includes("mega.nz")) return "mega";
  if (lowerUrl.includes("4shared")) return "fourShared";
  if (lowerUrl.includes("soraplay")) return "soraplay";

  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    const primary = hostname.split(".")[0]?.trim();
    if (primary) return primary;
  } catch {
    // ignore malformed URLs
  }

  const cleaned = lowerName.replace(/[^a-z0-9]+/g, "").trim();
  return cleaned || "direct";
}

function toStatus(statusText: string): "ongoing" | "completed" | "upcoming" {
  const text = statusText.toLowerCase();
  if (text.includes("ongoing") || text.includes("currently") || text.includes("يعرض")) return "ongoing";
  if (text.includes("completed") || text.includes("finished") || text.includes("مكتمل")) return "completed";
  return "upcoming";
}

function toType(typeText: string): "tv" | "movie" | "ova" | "special" {
  const text = typeText.toLowerCase();
  if (text.includes("movie") || text.includes("فيلم")) return "movie";
  if (text.includes("ova")) return "ova";
  if (text.includes("special") || text.includes("خاصة")) return "special";
  return "tv";
}

async function safeNavigate(page: Page, url: string, retries = 3): Promise<boolean> {
  for (let i = 0; i < retries; i++) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      await delay(1000);
      return true;
    } catch (err) {
      console.error(`Navigation failed for ${url} (attempt ${i + 1}):`, err);
      await delay(2000);
    }
  }

  return false;
}

function extractSlugFromUrl(url: string, pathSegment: string): string | null {
  const normalizedSegment = pathSegment.endsWith("/") ? pathSegment : `${pathSegment}/`;
  const [, slug = ""] = url.split(normalizedSegment);
  const normalizedSlug = safeDecodeUrlComponent(slug.replace(/\/$/, ""));
  return normalizedSlug || null;
}

function extractEpisodeIdFromUrl(url: string, pathSegment: string): string | null {
  const normalizedSegment = pathSegment.endsWith("/") ? pathSegment : `${pathSegment}/`;
  const [, id = ""] = url.split(normalizedSegment);
  const normalizedId = safeDecodeUrlComponent(id.replace(/\/$/, ""));
  return normalizedId || null;
}

// Legacy helper kept temporarily while the robust parser is the active path.
function extractEpisodeNumber(text: string, href?: string): number | null {
  const explicitMatch =
    text.match(/(?:episode|ep|الحلقة)\s*[-:]?\s*(\d{1,4})/i) ||
    text.match(/(?:^|\s)(\d{1,4})(?:\s|$)/);

  if (explicitMatch) {
    const number = Number(explicitMatch[1]);
    if (Number.isFinite(number) && number > 0 && number <= 500) return number;
  }

  if (href) {
    const hrefMatch =
      href.match(/\/episode\/(\d{1,4})(?:\/|$)/i) ||
      href.match(/(?:episode|ep|الحلقة)[^\d]*(\d{1,4})(?:\/|$)/i);

    if (hrefMatch) {
      const number = Number(hrefMatch[1]);
      if (Number.isFinite(number) && number > 0 && number <= 500) return number;
    }
  }

  return null;
}

// Legacy helper kept temporarily while the robust parser is the active path.
function looksLikeEpisodeLink(text: string, href: string, episodePathSegment: string): boolean {
  if (!href) return false;
  const loweredText = text.toLowerCase();
  const loweredHref = href.toLowerCase();
  const loweredSegment = episodePathSegment.toLowerCase();

  return (
    loweredHref.includes(loweredSegment) ||
    loweredText.includes("الحلقة") ||
    loweredText.includes("episode") ||
    loweredText.includes("ep ")
  );
}

void extractEpisodeNumber;
void looksLikeEpisodeLink;

function safeDecodeEpisodeHref(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function extractEpisodeNumberRobust(text: string, href?: string): number | null {
  const decodedHref = href ? safeDecodeEpisodeHref(href) : "";
  const explicitMatch =
    text.match(/(?:episode|ep|الحلقة)\s*[-:]?\s*(\d{1,4})/i) ||
    text.match(/(\d{1,4})\s*الحلقة/i) ||
    text.match(/(?:^|\s)(\d{1,4})(?:\s|$)/);

  if (explicitMatch) {
    const number = Number(explicitMatch[1]);
    if (Number.isFinite(number) && number > 0 && number <= 500) return number;
  }

  if (decodedHref) {
    const hrefMatch =
      decodedHref.match(/\/episode\/(\d{1,4})(?:\/|$)/i) ||
      decodedHref.match(/(?:episode|ep|الحلقة)(?:[\s:_-]+)(\d{1,4})(?:[-/]|$)/i);

    if (hrefMatch) {
      const number = Number(hrefMatch[1]);
      if (Number.isFinite(number) && number > 0 && number <= 500) return number;
    }
  }

  return null;
}

function looksLikeEpisodeLinkRobust(text: string, href: string, episodePathSegment: string): boolean {
  if (!href) return false;
  const loweredText = text.toLowerCase();
  const loweredHref = href.toLowerCase();
  const loweredSegment = episodePathSegment.toLowerCase();

  return (
    loweredHref.includes(loweredSegment) ||
    loweredText.includes("الحلقة") ||
    loweredText.includes("episode") ||
    loweredText.includes("ep ")
  );
}

function deriveEpisodeId(absoluteHref: string, episodePathSegment: string): string {
  return extractEpisodeIdFromUrl(absoluteHref, episodePathSegment) ?? absoluteHref;
}

function looksLikeAnimeEpisodeUrl(config: GenericSiteConfig, animeSlug: string, absoluteHref: string): boolean {
  if (config.isEpisodeUrl) {
    return config.isEpisodeUrl(absoluteHref, animeSlug);
  }

  const normalizedHref = absoluteHref.toLowerCase();
  const normalizedSlug = animeSlug.toLowerCase();
  const normalizedSlugCore = config.id === 'anime4up'
    ? normalizedSlug.replace(/-[a-z0-9]{4,8}$/i, '')
    : normalizedSlug;
  const episodeTail = normalizedHref.split('/episode/')[1] ?? "";

  if (!normalizedHref.includes('/episode/')) return false;
  if (!normalizedHref.includes(normalizedSlug) && !normalizedHref.includes(normalizedSlugCore)) return false;
  if (normalizedHref.includes(`${normalizedSlug}-episode-`)) return true;
  if (normalizedHref.includes(`${normalizedSlugCore}-episode-`)) return true;
  if (episodeTail.startsWith(`${normalizedSlug}-`) && /\d{1,4}/.test(episodeTail)) return true;
  if (episodeTail.startsWith(`${normalizedSlugCore}-`) && /\d{1,4}/.test(episodeTail)) return true;

  if (config.id === 'anime4up') {
    return true;
  }

  return false;
}

function isPlaceholderLink(url: string): boolean {
  const normalized = url.trim().toLowerCase();
  return (
    !normalized ||
    normalized === "#" ||
    normalized.endsWith("/#") ||
    normalized.endsWith("#") ||
    normalized.startsWith("javascript:") ||
    normalized.includes("javascript:void") ||
    normalized === "about:blank"
  );
}

function extractLabeledValue(text: string, labels: string[]): string {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`${escaped}\\s*[:：]?\\s*([^\\n|]+)`, "i");
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }

  return "";
}

function cleanStructuredSynopsisText(value: string): string {
  const collapsed = value.replace(/\s+/g, " ").trim();
  const storyIndex = collapsed.search(/(?:قصة|Ù‚ØµØ©)\s+(?:انمي|Ø§Ù†Ù…ÙŠ|الانمي|Ø§Ù„Ø§Ù†Ù…ÙŠ)\b/i);
  let cleaned = storyIndex >= 0 ? collapsed.slice(storyIndex) : collapsed;

  cleaned = cleaned
    .replace(/^(?:ملخص القصة|Ù…Ù„Ø®Øµ Ø§Ù„Ù‚ØµØ©)\s*/i, "")
    .replace(/\s*(?:اقرأ المزيد|Ø§Ù‚Ø±Ø£ Ø§Ù„Ù…Ø²ÙŠØ¯|قد يعجبك(?: أيضاً| ايضا)?|Ù‚Ø¯ ÙŠØ¹Ø¬Ø¨Ùƒ|الحلقات|Ø§Ù„Ø­Ù„Ù‚Ø§Øª|مواسم أخرى|Ø§Ù„Ù…ÙˆØ§Ø³Ù…).*$/i, "")
    .trim();

  return cleaned;
}

function cleanSynopsisText(value: string): string {
  const collapsed = value
    .replace(/\s+/g, " ")
    .trim();

  const storyIndex = collapsed.search(/قصة\s+(?:انمي|الانمي)\b/i);
  const trimmedToStory = storyIndex >= 0 ? collapsed.slice(storyIndex) : collapsed;

  return trimmedToStory
    .replace(/^ملخص القصة\s*/i, "")
    .replace(/^قصة\s+(?:انمي|الانمي)\s*/i, "")
    .trim();
}

async function extractCoverImageWithSelectors(
  page: Page,
  baseUrl: string,
  selectors: string[],
): Promise<string | undefined> {
  const selectorCover = await page
    .$eval(
      selectors.join(", "),
      (el) =>
        el.getAttribute("src") ||
        el.getAttribute("data-src") ||
        el.getAttribute("data-lazy-src") ||
        el.getAttribute("style") ||
        "",
    )
    .catch(() => "");

  const backgroundCover = extractBackgroundImageUrl(selectorCover);
  if (backgroundCover) return normalizeAbsoluteUrl(baseUrl, backgroundCover);
  if (selectorCover) return normalizeAbsoluteUrl(baseUrl, selectorCover);

  const ogImage = await page.$eval('meta[property="og:image"]', (el) => el.getAttribute("content") || "").catch(() => "");
  if (ogImage) return normalizeAbsoluteUrl(baseUrl, ogImage);

  return undefined;
}

async function extractStructuredAnimeData(page: Page, baseUrl: string): Promise<StructuredAnimeData> {
  const scripts = await page.$$eval('script[type="application/ld+json"]', (nodes) =>
    nodes.map((node) => node.textContent?.trim() || "").filter(Boolean),
  ).catch(() => []);

  for (const scriptText of scripts) {
    try {
      const parsed = JSON.parse(scriptText);
      const candidates = Array.isArray(parsed)
        ? parsed
        : parsed?.["@graph"] && Array.isArray(parsed["@graph"])
          ? parsed["@graph"]
          : [parsed];

      for (const candidate of candidates) {
        const type = String(candidate?.["@type"] ?? "");
        if (!/(TVSeries|Movie|Series|AnimeSeries)/i.test(type)) continue;

        const imageValue = typeof candidate?.image === "string"
          ? candidate.image
          : typeof candidate?.image?.url === "string"
            ? candidate.image.url
            : undefined;
        const genres = Array.isArray(candidate?.genre)
          ? candidate.genre.filter((value: unknown): value is string => typeof value === "string" && value.trim().length > 0)
          : typeof candidate?.genre === "string"
            ? [candidate.genre]
            : [];
        const ratingValue = typeof candidate?.aggregateRating?.ratingValue === "string" || typeof candidate?.aggregateRating?.ratingValue === "number"
          ? String(candidate.aggregateRating.ratingValue)
          : undefined;
        const yearMatch = String(candidate?.datePublished ?? "").match(/(\d{4})/);

        return {
          title: typeof candidate?.name === "string" ? candidate.name.trim() : undefined,
          alternateTitle: typeof candidate?.alternateName === "string" ? candidate.alternateName.trim() : undefined,
          description: typeof candidate?.description === "string" ? candidate.description.trim() : undefined,
          image: normalizeAbsoluteUrl(baseUrl, imageValue),
          episodesCount: Number.isFinite(Number(candidate?.numberOfEpisodes)) ? Number(candidate.numberOfEpisodes) : undefined,
          genres,
          rating: ratingValue ? `${ratingValue} / 10` : undefined,
          year: yearMatch ? Number.parseInt(yearMatch[1], 10) : undefined,
        };
      }
    } catch {
      // Ignore malformed structured data blocks
    }
  }

  return {};
}

interface ScrapedEpisodeAnchor {
  index: number;
  title: string;
  imageText: string;
  thumbnail: string;
  onclick: string;
  href: string;
}

async function extractEpisodeAnchorsFromPage(page: Page): Promise<ScrapedEpisodeAnchor[]> {
  return page.$$eval("a", (anchors) =>
    anchors.map((anchor, index) => {
      const parentImage =
        anchor.querySelector("img") ||
        anchor.closest("li, article, .episodes-card-container, [class*='episode']")?.querySelector("img");

      return {
        index,
        title: anchor.textContent?.trim() ?? "",
        imageText: parentImage?.getAttribute("alt")?.trim() ?? "",
        thumbnail: parentImage?.getAttribute("src") ?? parentImage?.getAttribute("data-src") ?? "",
        onclick: anchor.getAttribute("onclick") ?? "",
        href: anchor.getAttribute("href") ?? "",
      };
    }),
  ).catch(() => []);
}

async function extractAnimePaginationUrls(page: Page, config: GenericSiteConfig, animeSlug: string): Promise<string[]> {
  const paginationMode = config.paginationMode ?? "anchors";
  const animePathSegment = config.animePathSegment ?? "/anime/";
  const expectedPrefix = `${config.baseUrl}${animePathSegment}${animeSlug}/page/`.toLowerCase();
  const urls = new Set<string>();

  if (paginationMode === "anchors" || paginationMode === "anchors-and-rel-next") {
    const rawLinks = await page.$$eval("a[href]", (anchors) =>
      anchors.map((anchor) => anchor.getAttribute("href") || "").filter(Boolean),
    ).catch(() => []);

    for (const href of rawLinks) {
      const normalized = normalizeAbsoluteUrl(config.baseUrl, href);
      if (!normalized) continue;
      if (!normalized.toLowerCase().startsWith(expectedPrefix)) continue;
      if (!/\/page\/\d+\/?$/i.test(normalized)) continue;
      urls.add(normalized);
    }
  }

  if (paginationMode === "rel-next" || paginationMode === "anchors-and-rel-next") {
    const relNext = await page.$eval("link[rel='next']", (el) => el.getAttribute("href") || "").catch(() => "");
    const normalized = normalizeAbsoluteUrl(config.baseUrl, relNext);
    if (normalized && /\/page\/\d+\/?$/i.test(normalized)) {
      urls.add(normalized);
    }
  }

  return Array.from(urls);
}

async function fetchHtmlDocument(url: string): Promise<CheerioAPI> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HTML_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: HTML_FETCH_HEADERS,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} while fetching ${url}`);
    }

    return load(await response.text());
  } finally {
    clearTimeout(timeout);
  }
}

function extractMetaContent($: CheerioAPI, selector: string): string {
  return $(selector).attr("content")?.trim() || "";
}

function extractFirstText($: CheerioAPI, selectors: string[]): string {
  for (const selector of selectors) {
    const text = $(selector).first().text().trim();
    if (text) return text;
  }

  return "";
}

function extractStructuredAnimeDataFromHtml($: CheerioAPI, baseUrl: string): StructuredAnimeData {
  const scripts = $('script[type="application/ld+json"]')
    .map((_, node) => $(node).text().trim())
    .get()
    .filter(Boolean);

  for (const scriptText of scripts) {
    try {
      const parsed = JSON.parse(scriptText);
      const candidates = Array.isArray(parsed)
        ? parsed
        : parsed?.["@graph"] && Array.isArray(parsed["@graph"])
          ? parsed["@graph"]
          : [parsed];

      for (const candidate of candidates) {
        const type = String(candidate?.["@type"] ?? "");
        if (!/(TVSeries|Movie|Series|AnimeSeries)/i.test(type)) continue;

        const imageValue = typeof candidate?.image === "string"
          ? candidate.image
          : typeof candidate?.image?.url === "string"
            ? candidate.image.url
            : undefined;
        const genres = Array.isArray(candidate?.genre)
          ? candidate.genre.filter((value: unknown): value is string => typeof value === "string" && value.trim().length > 0)
          : typeof candidate?.genre === "string"
            ? [candidate.genre]
            : [];
        const ratingValue =
          typeof candidate?.aggregateRating?.ratingValue === "string" ||
          typeof candidate?.aggregateRating?.ratingValue === "number"
            ? String(candidate.aggregateRating.ratingValue)
            : undefined;
        const yearMatch = String(candidate?.datePublished ?? "").match(/(\d{4})/);

        return {
          title: typeof candidate?.name === "string" ? candidate.name.trim() : undefined,
          alternateTitle: typeof candidate?.alternateName === "string" ? candidate.alternateName.trim() : undefined,
          description: typeof candidate?.description === "string" ? candidate.description.trim() : undefined,
          image: normalizeAbsoluteUrl(baseUrl, imageValue),
          episodesCount: Number.isFinite(Number(candidate?.numberOfEpisodes)) ? Number(candidate.numberOfEpisodes) : undefined,
          genres,
          rating: ratingValue ? `${ratingValue} / 10` : undefined,
          year: yearMatch ? Number.parseInt(yearMatch[1], 10) : undefined,
        };
      }
    } catch {
      // Ignore malformed structured data blocks
    }
  }

  return {};
}

function extractCoverImageFromHtmlWithSelectors(
  $: CheerioAPI,
  baseUrl: string,
  selectors: string[],
): string | undefined {
  const node = $(selectors.join(", ")).first();
  const selectorCover =
    node.attr("src") ||
    node.attr("data-src") ||
    node.attr("data-lazy-src") ||
    extractBackgroundImageUrl(node.attr("style")) ||
    "";

  if (selectorCover) return normalizeAbsoluteUrl(baseUrl, selectorCover);

  const ogImage = extractMetaContent($, 'meta[property="og:image"]');
  if (ogImage) return normalizeAbsoluteUrl(baseUrl, ogImage);

  return undefined;
}

function extractEpisodeAnchorsFromHtml($: CheerioAPI): ScrapedEpisodeAnchor[] {
  return $("a")
    .map((index, anchor) => {
      const anchorNode = $(anchor);
      const parentScope = anchorNode.find("img").length > 0
        ? anchorNode
        : anchorNode.parents("li, article, .episodes-card-container, [class*='episode']").first();
      const parentImage = parentScope.find("img").first();

      return {
        index,
        title: anchorNode.text().trim(),
        imageText: parentImage.attr("alt")?.trim() ?? "",
        thumbnail: parentImage.attr("src") ?? parentImage.attr("data-src") ?? "",
        onclick: anchorNode.attr("onclick") ?? "",
        href: anchorNode.attr("href") ?? "",
      };
    })
    .get();
}

function extractAnimePaginationUrlsFromHtml($: CheerioAPI, config: GenericSiteConfig, animeSlug: string): string[] {
  const paginationMode = config.paginationMode ?? "anchors";
  const animePathSegment = config.animePathSegment ?? "/anime/";
  const expectedPrefix = `${config.baseUrl}${animePathSegment}${animeSlug}/page/`.toLowerCase();
  const urls = new Set<string>();

  if (paginationMode === "anchors" || paginationMode === "anchors-and-rel-next") {
    $("a[href]")
      .map((_, anchor) => $(anchor).attr("href") || "")
      .get()
      .map((href) => normalizeAbsoluteUrl(config.baseUrl, href))
      .filter((href): href is string => Boolean(href))
      .filter((href) => href.toLowerCase().startsWith(expectedPrefix))
      .filter((href) => /\/page\/\d+\/?$/i.test(href))
      .forEach((href) => urls.add(href));
  }

  if (paginationMode === "rel-next" || paginationMode === "anchors-and-rel-next") {
    const relNext = normalizeAbsoluteUrl(config.baseUrl, $("link[rel='next']").attr("href"));
    if (relNext && /\/page\/\d+\/?$/i.test(relNext)) {
      urls.add(relNext);
    }
  }

  return Array.from(urls);
}

function collectAnimeCardsFromHtml(
  $: CheerioAPI,
  config: GenericSiteConfig,
  limit: number,
  fallbackStatus: ScraperAnime["status"],
): ScraperAnime[] {
  const animePathSegment = config.animePathSegment ?? "/anime/";
  const results: ScraperAnime[] = [];

  $("[class*='anime']:not([class*='episode']), .anime-card, .anime-item, .MovieItem, article, .poster").each((_, card) => {
    if (results.length >= limit) return false;

    const cardNode = $(card);
    const link =
      cardNode.find("a").first().attr("href") ||
      cardNode.attr("href") ||
      "";
    const title =
      cardNode.find("[class*='title'], h2, h3, h4").first().text().trim() ||
      cardNode.find("a").first().text().trim() ||
      "";
    const image =
      cardNode.find("img").first().attr("src") ||
      cardNode.find("img").first().attr("data-src") ||
      extractBackgroundImageUrl(cardNode.find(".poster").first().attr("style")) ||
      extractBackgroundImageUrl(cardNode.attr("style")) ||
      "";
    const absoluteLink = normalizeAbsoluteUrl(config.baseUrl, link);
    if (!absoluteLink || !absoluteLink.includes(animePathSegment)) return;

    const slug = extractSlugFromUrl(absoluteLink, animePathSegment);
    if (!slug || results.some((item) => item.slug === slug)) return;

    results.push({
      slug,
      title: pickBestTitle(title, slug.replace(/-/g, " ")),
      coverImage: normalizeAbsoluteUrl(config.baseUrl, image),
      status: fallbackStatus,
      type: "tv",
      episodesCount: 0,
    });
  });

  return results;
}

async function scrapeAnimeEpisodesWithHtml(config: GenericSiteConfig, animeSlug: string): Promise<ScraperEpisode[]> {
  const animePathSegment = config.animePathSegment ?? "/anime/";
  const episodePathSegment = config.episodePathSegment ?? "/episode/";
  const url = `${config.baseUrl}${animePathSegment}${animeSlug}`;
  const scrapedEpisodes: ScrapedEpisodeAnchor[] = [];
  const pagesToVisit = [url];
  const visitedPages = new Set<string>();

  while (pagesToVisit.length > 0 && visitedPages.size < 50) {
    const pageUrl = pagesToVisit.shift();
    if (!pageUrl || visitedPages.has(pageUrl)) continue;
    visitedPages.add(pageUrl);

    try {
      const $ = await fetchHtmlDocument(pageUrl);
      scrapedEpisodes.push(...extractEpisodeAnchorsFromHtml($));

      for (const nextUrl of extractAnimePaginationUrlsFromHtml($, config, animeSlug)) {
        if (!visitedPages.has(nextUrl) && !pagesToVisit.includes(nextUrl)) {
          pagesToVisit.push(nextUrl);
        }
      }
    } catch (error) {
      console.error(`HTML episode scrape failed for ${config.id}/${animeSlug} page ${pageUrl}:`, error);
    }
  }

  const episodes: ScraperEpisode[] = [];
  for (const episode of scrapedEpisodes) {
    const encoded = episode.onclick.match(/['"]([A-Za-z0-9+/_=-]{8,})['"]/)?.[1] ?? "";
    const decodedHref = decodeBase64Url(encoded);
    const absoluteHref = normalizeAbsoluteUrl(config.baseUrl, decodedHref || episode.href);
    if (!absoluteHref) continue;
    if (!looksLikeAnimeEpisodeUrl(config, animeSlug, absoluteHref)) continue;
    if (!looksLikeEpisodeLinkRobust(`${episode.title} ${episode.imageText}`, absoluteHref, episodePathSegment)) continue;

    const id = deriveEpisodeId(absoluteHref, episodePathSegment);
    const number = extractEpisodeNumberRobust(`${episode.title} ${episode.imageText}`, absoluteHref);
    if (!number) continue;

    const preferredTitle = normalizeEpisodeCardTitle(episode.title);
    const alternateTitle = normalizeEpisodeCardTitle(episode.imageText);
    episodes.push({
      id,
      number,
      title: !isWeakEpisodeTitle(preferredTitle)
        ? preferredTitle
        : alternateTitle || `Episode ${number}`,
      thumbnail: normalizeAbsoluteUrl(config.baseUrl, episode.thumbnail),
      sources: [],
    });
  }

  const deduped = new Map<number, ScraperEpisode>();
  for (const episode of episodes) {
    if (!deduped.has(episode.number)) deduped.set(episode.number, episode);
  }

  return Array.from(deduped.values()).sort((a, b) => a.number - b.number);
}

async function scrapeAnimeInfoWithHtml(config: GenericSiteConfig, slug: string): Promise<ScraperAnime | null> {
  const animePathSegment = config.animePathSegment ?? "/anime/";
  const url = `${config.baseUrl}${animePathSegment}${slug}`;
  const $ = await fetchHtmlDocument(url);
  const structured = extractStructuredAnimeDataFromHtml($, config.baseUrl);
  const title = extractFirstText($, getTitleSelectors(config));
  const ogTitle = extractMetaContent($, "meta[property='og:title']");
  const documentTitle = $("title").text().trim();

  if (!title && !ogTitle && !documentTitle) return null;

  const synopsis = extractFirstText($, getSynopsisSelectors(config));
  const coverImage = structured.image ?? extractCoverImageFromHtmlWithSelectors($, config.baseUrl, getCoverImageSelectors(config));
  const statusText = extractFirstText($, ["div.anime-info", "[class*='status']", ".anime-status", ".status"]);
  const typeText = extractFirstText($, ["div.anime-info", ".anime-card-type", "[class*='type']"]);
  const ratingText = extractFirstText($, getRatingSelectors(config));
  const studioText = extractFirstText($, ["[class*='studio']", ".anime-studio", ".studio", "[class*='producer']"]);
  const yearText = extractFirstText($, ["[class*='year']", ".anime-year", ".release-date", "[class*='released']"]);
  const malUrl = $('a[href*="myanimelist.net/anime/"]').first().attr("href") || "";
  const pageText = $("body").text();
  const genreText = $("a[href*='genre'], a[rel='tag'], .genres a, [class*='genre'] a, [class*='category'] a")
    .map((_, element) => $(element).text().trim())
    .get()
    .filter(Boolean)
    .join(" | ");
  const scrapedEpisodes = await scrapeAnimeEpisodesWithHtml(config, slug).catch(() => []);

  const resolvedSynopsis = cleanSynopsisText(synopsis || extractLabeledValue(pageText, ["Ù…Ù„Ø®Øµ Ø§Ù„Ù‚ØµØ©", "Ø§Ù„Ù‚ØµØ©", "Synopsis", "Description"]));
  const resolvedRating = ratingText || extractLabeledValue(pageText, ["Ø§Ù„ØªÙ‚ÙŠÙŠÙ…", "IMDb", "ØªÙ‚ÙŠÙŠÙ… Ø§Ù„Ø¹Ø±Ø¶", "rating", "score"]);
  const resolvedStudio = studioText || extractLabeledValue(pageText, ["Ø§Ù„Ø§Ø³ØªÙˆØ¯ÙŠÙˆ", "studio", "producer", "studios"]);
  const resolvedYear = yearText || extractLabeledValue(pageText, ["Ø¨Ø¯Ø§ÙŠØ© Ø§Ù„Ø¹Ø±Ø¶", "ØªØ§Ø±ÙŠØ® Ø§Ù„Ø§ØµØ¯Ø§Ø±", "Ø¹Ø±Ø¶ Ù…Ù†", "release", "year"]);
  const yearMatch = resolvedYear.match(/(\d{4})/);
  const malId = malUrl.match(/myanimelist\.net\/anime\/(\d+)/)?.[1];
  const finalSynopsis = cleanStructuredSynopsisText(structured.description || resolvedSynopsis);
  const finalRating = structured.rating || resolvedRating;
  const finalReleaseYear = structured.year ?? (yearMatch ? Number.parseInt(yearMatch[1], 10) : undefined);
  const finalGenres = structured.genres?.join(" | ") || genreText || undefined;

  return {
    slug,
    title: pickBestTitle(structured.title, structured.alternateTitle, title, ogTitle, documentTitle, slug.replace(/-/g, " ")),
    synopsis: finalSynopsis.slice(0, 2000),
    coverImage,
    externalId: malId,
    sourceUrl: url,
    status: toStatus(statusText),
    type: toType(typeText),
    episodesCount: Math.min(Math.max(scrapedEpisodes.length, structured.episodesCount ?? 0), 500),
    rating: finalRating || undefined,
    studio: resolvedStudio || undefined,
    releaseYear: finalReleaseYear,
    categoryName: finalGenres,
  };
}

async function scrapeLatestAnimeWithHtml(config: GenericSiteConfig, limit = 20): Promise<ScraperAnime[]> {
  const latestUrl = config.latestUrl ?? config.baseUrl;
  const $ = await fetchHtmlDocument(latestUrl);
  return collectAnimeCardsFromHtml($, config, limit, "ongoing");
}

async function searchAnimeWithHtml(config: GenericSiteConfig, query: string): Promise<ScraperAnime[]> {
  const searchUrlFactories = config.searchUrls ?? [(value: string) => `${config.baseUrl}/?s=${encodeURIComponent(value)}`];
  const deduped = new Map<string, ScraperAnime>();

  for (const factory of searchUrlFactories) {
    try {
      const $ = await fetchHtmlDocument(factory(query));
      for (const anime of collectAnimeCardsFromHtml($, config, 15, "upcoming")) {
        if (!deduped.has(anime.slug)) deduped.set(anime.slug, anime);
        if (deduped.size >= 15) break;
      }
    } catch (error) {
      console.error(`HTML search scrape failed for ${config.id} with query "${query}":`, error);
    }

    if (deduped.size >= 15) break;
  }

  return Array.from(deduped.values());
}

export async function scrapeAnimeEpisodesWithConfig(config: GenericSiteConfig, animeSlug: string): Promise<ScraperEpisode[]> {
  const lightweightEpisodes = await scrapeAnimeEpisodesWithHtml(config, animeSlug).catch((error) => {
    console.error(`Lightweight episode scrape failed for ${config.id}/${animeSlug}:`, error);
    return [];
  });
  if (lightweightEpisodes.length > 0) return lightweightEpisodes;

  const browser = await getBrowser(config.id);
  const page = await browser.newPage();
  const animePathSegment = config.animePathSegment ?? "/anime/";
  const episodePathSegment = config.episodePathSegment ?? "/episode/";

  try {
    const url = `${config.baseUrl}${animePathSegment}${animeSlug}`;
    if (!await safeNavigate(page, url)) return [];

    const scrapedEpisodes: ScrapedEpisodeAnchor[] = [];
    const pagesToVisit = [url];
    const visitedPages = new Set<string>();

    while (pagesToVisit.length > 0 && visitedPages.size < 50) {
      const pageUrl = pagesToVisit.shift();
      if (!pageUrl || visitedPages.has(pageUrl)) continue;
      visitedPages.add(pageUrl);

      const currentPage = pageUrl === url ? page : await browser.newPage();
      try {
        if (pageUrl !== url && !await safeNavigate(currentPage, pageUrl)) {
          continue;
        }

        await currentPage.waitForSelector("a, .episodes-card-container, [class*='episode'], article, .listing li", { timeout: 10000 });
        scrapedEpisodes.push(...await extractEpisodeAnchorsFromPage(currentPage));

        const paginatedUrls = await extractAnimePaginationUrls(currentPage, config, animeSlug);
        for (const nextUrl of paginatedUrls) {
          if (!visitedPages.has(nextUrl) && !pagesToVisit.includes(nextUrl)) {
            pagesToVisit.push(nextUrl);
          }
        }
      } finally {
        if (currentPage !== page) {
          await currentPage.close();
        }
      }
    }

    const episodes: ScraperEpisode[] = [];
    for (const episode of scrapedEpisodes) {
      const encoded = episode.onclick.match(/['"]([A-Za-z0-9+/_=-]{8,})['"]/)?.[1] ?? "";
      const decodedHref = decodeBase64Url(encoded);
      const absoluteHref = normalizeAbsoluteUrl(config.baseUrl, decodedHref || episode.href);
      if (!absoluteHref) continue;
      if (!looksLikeAnimeEpisodeUrl(config, animeSlug, absoluteHref)) continue;
      if (!looksLikeEpisodeLinkRobust(`${episode.title} ${episode.imageText}`, absoluteHref, episodePathSegment)) continue;

      const id = deriveEpisodeId(absoluteHref, episodePathSegment);
      const number = extractEpisodeNumberRobust(`${episode.title} ${episode.imageText}`, absoluteHref);
      if (!number) continue;

      const preferredTitle = normalizeEpisodeCardTitle(episode.title);
      const alternateTitle = normalizeEpisodeCardTitle(episode.imageText);
      episodes.push({
        id,
        number,
        title: !isWeakEpisodeTitle(preferredTitle)
          ? preferredTitle
          : alternateTitle || `Episode ${number}`,
        thumbnail: normalizeAbsoluteUrl(config.baseUrl, episode.thumbnail),
        sources: [],
      });
    }

    const deduped = new Map<number, ScraperEpisode>();
    for (const episode of episodes) {
      if (!deduped.has(episode.number)) deduped.set(episode.number, episode);
    }

    return Array.from(deduped.values()).sort((a, b) => a.number - b.number);
  } catch (err) {
    console.error(`Error scraping episodes for ${config.id}/${animeSlug}:`, err);
    return [];
  } finally {
    await page.close();
  }
}

export async function scrapeAnimeInfoWithConfig(config: GenericSiteConfig, slug: string): Promise<ScraperAnime | null> {
  const lightweightAnime = await scrapeAnimeInfoWithHtml(config, slug).catch((error) => {
    console.error(`Lightweight anime scrape failed for ${config.id}/${slug}:`, error);
    return null;
  });
  if (lightweightAnime) return lightweightAnime;

  const browser = await getBrowser(config.id);
  const page = await browser.newPage();
  const animePathSegment = config.animePathSegment ?? "/anime/";

  try {
    const url = `${config.baseUrl}${animePathSegment}${slug}`;
    if (!await safeNavigate(page, url)) return null;

    const titleSelector = getTitleSelectors(config).join(", ");
    await page.waitForSelector(titleSelector, { timeout: 10000 });

    const structured = await extractStructuredAnimeData(page, config.baseUrl);
    const titleCandidates = await page
      .$$eval(titleSelector, (elements) => elements.map((el) => el.textContent?.trim() || "").filter(Boolean))
      .catch(() => []);
    const title = titleCandidates[0] || "";
    const ogTitle = await page.$eval("meta[property='og:title']", (el) => el.getAttribute("content") || "").catch(() => "");
    const documentTitle = await page.title().catch(() => "");
    const synopsis = await page.$eval(getSynopsisSelectors(config).join(", "), (el) => el.textContent?.trim() || "").catch(() => "");
    const coverImage = structured.image ?? await extractCoverImageWithSelectors(page, config.baseUrl, getCoverImageSelectors(config));
    const statusText = await page.$eval("div.anime-info, [class*='status'], .anime-status, .status", (el) => el.textContent?.toLowerCase() || "").catch(() => "");
    const typeText = await page.$eval("div.anime-info, .anime-card-type, [class*='type']", (el) => el.textContent?.toLowerCase() || "").catch(() => "");
    const ratingText = await page.$eval(getRatingSelectors(config).join(", "), (el) => el.textContent?.trim() || "").catch(() => "");
    const studioText = await page.$eval("[class*='studio'], .anime-studio, .studio, [class*='producer']", (el) => el.textContent?.trim() || "").catch(() => "");
    const yearText = await page.$eval("[class*='year'], .anime-year, .release-date, [class*='released']", (el) => el.textContent?.trim() || "").catch(() => "");
    const malUrl = await page.$eval("a[href*='myanimelist.net/anime/']", (el) => el.getAttribute("href") || "").catch(() => "");
    const pageText = await page.$eval("body", (el) => el.textContent || "").catch(() => "");
    const genreText = await page.$$eval(
      "a[href*='genre'], a[rel='tag'], .genres a, [class*='genre'] a, [class*='category'] a",
      (elements) => elements.map((el) => el.textContent?.trim() || "").filter(Boolean).join(" | "),
    ).catch(() => "");
    const scrapedEpisodes = await scrapeAnimeEpisodesWithConfig(config, slug);

    const resolvedSynopsis = cleanSynopsisText(synopsis || extractLabeledValue(pageText, ["ملخص القصة", "القصة", "Synopsis", "Description"]));
    const resolvedRating = ratingText || extractLabeledValue(pageText, ["التقييم", "IMDb", "تقييم العرض", "rating", "score"]);
    const resolvedStudio = studioText || extractLabeledValue(pageText, ["الاستوديو", "studio", "producer", "studios"]);
    const resolvedYear = yearText || extractLabeledValue(pageText, ["بداية العرض", "تاريخ الاصدار", "عرض من", "release", "year"]);
    const yearMatch = resolvedYear.match(/(\d{4})/);
    const malId = malUrl.match(/myanimelist\.net\/anime\/(\d+)/)?.[1];
    const finalSynopsis = cleanStructuredSynopsisText(structured.description || resolvedSynopsis);
    const finalRating = structured.rating || resolvedRating;
    const finalReleaseYear = structured.year ?? (yearMatch ? Number.parseInt(yearMatch[1], 10) : undefined);
    const finalGenres = structured.genres?.join(" | ") || genreText || undefined;

    return {
      slug,
      title: pickBestTitle(structured.title, structured.alternateTitle, title, ogTitle, documentTitle, slug.replace(/-/g, " ")),
      synopsis: finalSynopsis.slice(0, 2000),
      coverImage,
      externalId: malId,
      sourceUrl: url,
      status: toStatus(statusText),
      type: toType(typeText),
      episodesCount: Math.min(Math.max(scrapedEpisodes.length, structured.episodesCount ?? 0), 500),
      rating: finalRating || undefined,
      studio: resolvedStudio || undefined,
      releaseYear: finalReleaseYear,
      categoryName: finalGenres,
    };
  } catch (err) {
    console.error(`Error scraping anime ${config.id}/${slug}:`, err);
    return null;
  } finally {
    await page.close();
  }
}

export async function scrapeEpisodeSourcesWithConfig(config: GenericSiteConfig, episodeId: string): Promise<VideoSource[]> {
  const browser = await getBrowser(config.id);
  const page = await browser.newPage();
  const episodePathSegment = config.episodePathSegment ?? "/episode/";
  const sources: VideoSource[] = [];

  try {
    const url = episodeId.startsWith("http://") || episodeId.startsWith("https://") ? episodeId : `${config.baseUrl}${episodePathSegment}${episodeId}`;
    if (!await safeNavigate(page, url)) return [];

    await page.waitForSelector("#episode-servers .server-link, #episode-servers li, .servers li, .server-list li, iframe[src], script[type='application/ld+json'], [x-data*='activeUrl']", { timeout: 10000 });

    const directSources = await page.$$eval(
      "#episode-servers .server-link, #episode-servers li, .servers li, .server-list li",
      (elements) =>
        elements.map((el) => {
          const label = (el.querySelector(".ser, .notice, span")?.textContent || el.textContent || "").trim().toLowerCase();
          const link =
            el.getAttribute("data-watch") ||
            el.getAttribute("data-embed") ||
            el.getAttribute("data-url") ||
            el.querySelector("a")?.getAttribute("data-watch") ||
            el.querySelector("a")?.getAttribute("data-embed") ||
            el.querySelector("a")?.getAttribute("data-url") ||
            el.querySelector("a")?.getAttribute("href") ||
            "";

          return { label, link };
        }),
    ).catch(() => []);

    for (const item of directSources) {
      const decodedUrl = normalizeAbsoluteUrl(config.baseUrl, unwrapProviderUrl(decodeBase64Url(item.link) || item.link));
      if (!decodedUrl || isPlaceholderLink(decodedUrl)) continue;

      sources.push({
        server: inferServer(item.label, decodedUrl),
        quality: inferQuality(item.label),
        url: decodedUrl,
      });
    }

    if (sources.length === 0) {
      const scriptedSources = await page.$$eval("a, button, [role='button']", (elements) => {
        const matches: Array<{ label: string; url: string }> = [];

        for (const el of elements) {
          const clickHandler =
            el.getAttribute("@click") ||
            el.getAttribute("x-on:click") ||
            el.getAttribute("onclick") ||
            "";

          const match = clickHandler.match(/setServer\(['"]([^'"]+)['"]\)/i);
          if (!match?.[1]) continue;

          matches.push({
            label: (el.textContent || "").trim().toLowerCase(),
            url: match[1],
          });
        }

        return matches;
      }).catch(() => []);

      for (const item of scriptedSources) {
        const normalizedUrl = normalizeAbsoluteUrl(config.baseUrl, unwrapProviderUrl(item.url));
        if (!normalizedUrl || isPlaceholderLink(normalizedUrl)) continue;

        sources.push({
          server: inferServer(item.label, normalizedUrl),
          quality: inferQuality(item.label),
          url: normalizedUrl,
        });
      }
    }

    if (sources.length === 0) {
      const activeUrl = await page
        .$eval("[x-data*='activeUrl']", (el) => el.getAttribute("x-data") || "")
        .then((xData) => xData.match(/activeUrl:\s*'([^']+)'/)?.[1] || xData.match(/activeUrl:\s*"([^"]+)"/)?.[1] || "")
        .catch(() => "");

      const ldJsonSources = await page.$$eval('script[type="application/ld+json"]', (nodes) => {
        const results: string[] = [];
        for (const node of nodes) {
          const text = node.textContent?.trim();
          if (!text) continue;
          try {
            const parsed = JSON.parse(text);
            const candidates = Array.isArray(parsed)
              ? parsed
              : parsed?.["@graph"] && Array.isArray(parsed["@graph"])
                ? parsed["@graph"]
                : [parsed];

            for (const candidate of candidates) {
              const embedUrl = typeof candidate?.embedUrl === "string" ? candidate.embedUrl : "";
              if (embedUrl) results.push(embedUrl);
            }
          } catch {
            // ignore malformed blocks
          }
        }
        return results;
      }).catch(() => []);

      for (const candidateUrl of [activeUrl, ...ldJsonSources]) {
        const normalizedUrl = normalizeAbsoluteUrl(config.baseUrl, unwrapProviderUrl(candidateUrl));
        if (!normalizedUrl || isPlaceholderLink(normalizedUrl)) continue;

        sources.push({
          server: inferServer("direct", normalizedUrl),
          quality: "hd",
          url: normalizedUrl,
        });
      }
    }

    if (sources.length === 0) {
      const serverItems = await page.$$("#episode-servers .server-link, #episode-servers li, .servers li, .server-list li");

      for (const serverItem of serverItems) {
        const serverName = await serverItem
          .$eval(".ser, .notice, span", (el) => el.textContent?.trim().toLowerCase() || "")
          .catch(async () => serverItem.evaluate((el) => el.textContent?.trim().toLowerCase() || ""));

        const embeddedUrl = await serverItem
          .$eval(
            "a",
            (anchor) =>
              anchor.getAttribute("data-watch") ||
              anchor.getAttribute("data-embed") ||
              anchor.getAttribute("data-url") ||
              anchor.getAttribute("href") ||
              "",
          )
          .catch(() => "");

        const inlineEmbeddedUrl =
          embeddedUrl ||
          await serverItem.evaluate(
            (el) => el.getAttribute("data-watch") || el.getAttribute("data-embed") || el.getAttribute("data-url") || "",
          ).catch(() => "");

        const normalizedEmbeddedUrl = normalizeAbsoluteUrl(
          config.baseUrl,
          unwrapProviderUrl(decodeBase64Url(inlineEmbeddedUrl) || inlineEmbeddedUrl),
        );
        if (normalizedEmbeddedUrl && !isPlaceholderLink(normalizedEmbeddedUrl)) {
          sources.push({
            server: inferServer(serverName, normalizedEmbeddedUrl),
            quality: inferQuality(serverName),
            url: normalizedEmbeddedUrl,
          });
          continue;
        }

        await serverItem.click().catch(() => undefined);
        await delay(2500);

        const embedUrl = await page
          .$eval("#iframe-container iframe, iframe[src], .player-iframe iframe", (iframe) => iframe.getAttribute("src") || "")
          .catch(() => "");

        const normalizedUrl = normalizeAbsoluteUrl(config.baseUrl, unwrapProviderUrl(embedUrl));
        if (!normalizedUrl || isPlaceholderLink(normalizedUrl)) continue;

        sources.push({
          server: inferServer(serverName, normalizedUrl),
          quality: inferQuality(serverName),
          url: normalizedUrl,
        });
      }
    }

    const deduped = new Map<string, VideoSource>();
    for (const source of sources) {
      const key = `${source.server}|${source.quality}|${source.url}`;
      if (!deduped.has(key)) deduped.set(key, source);
    }

    return Array.from(deduped.values());
  } catch (err) {
    console.error(`Error scraping episode sources ${config.id}/${episodeId}:`, err);
    return [];
  } finally {
    await page.close();
  }
}

export async function scrapeLatestAnimeWithConfig(config: GenericSiteConfig, limit = 20): Promise<ScraperAnime[]> {
  const lightweightLatest = await scrapeLatestAnimeWithHtml(config, limit).catch((error) => {
    console.error(`Lightweight latest scrape failed for ${config.id}:`, error);
    return [];
  });
  if (lightweightLatest.length > 0) return lightweightLatest;

  const browser = await getBrowser(config.id);
  const page = await browser.newPage();
  const results: ScraperAnime[] = [];
  const animePathSegment = config.animePathSegment ?? "/anime/";

  try {
    const latestUrl = config.latestUrl ?? config.baseUrl;
    if (!await safeNavigate(page, latestUrl)) return [];

    await page.waitForSelector("[class*='anime'], .anime-card, .anime-item, article", { timeout: 10000 });

    const cards = await page.$$("[class*='anime']:not([class*='episode']), .anime-card, .anime-item, article");
    for (const card of cards.slice(0, limit * 3)) {
      try {
        const link = await card.$eval("a", (el) => el.getAttribute("href") || "").catch(() => "");
        const title = await card.$eval("[class*='title'], h2, h3, h4", (el) => el.textContent?.trim() || "").catch(() => "");
        const image = await card.$eval("img", (el) => el.getAttribute("src") || el.getAttribute("data-src") || "").catch(() => "");
        const absoluteLink = normalizeAbsoluteUrl(config.baseUrl, link);
        if (!absoluteLink || !absoluteLink.includes(animePathSegment)) continue;

        const slug = extractSlugFromUrl(absoluteLink, animePathSegment);
        if (!slug || results.some((item) => item.slug === slug)) continue;

        results.push({
          slug,
          title: pickBestTitle(title, slug.replace(/-/g, " ")),
          coverImage: normalizeAbsoluteUrl(config.baseUrl, image),
          status: "ongoing",
          type: "tv",
          episodesCount: 0,
        });

        if (results.length >= limit) break;
      } catch (err) {
        console.error(`Error parsing latest card for ${config.id}:`, err);
      }
    }

    return results;
  } catch (err) {
    console.error(`Error scraping latest anime for ${config.id}:`, err);
    return [];
  } finally {
    await page.close();
  }
}

export async function searchAnimeWithConfig(config: GenericSiteConfig, query: string): Promise<ScraperAnime[]> {
  const lightweightResults = await searchAnimeWithHtml(config, query).catch((error) => {
    console.error(`Lightweight search scrape failed for ${config.id} with query "${query}":`, error);
    return [];
  });
  if (lightweightResults.length > 0) return lightweightResults;

  const browser = await getBrowser(config.id);
  const page = await browser.newPage();
  const results: ScraperAnime[] = [];
  const animePathSegment = config.animePathSegment ?? "/anime/";
  const searchUrlFactories = config.searchUrls ?? [(value: string) => `${config.baseUrl}/?s=${encodeURIComponent(value)}`];

  try {
    let visited = false;
    for (const factory of searchUrlFactories) {
      const url = factory(query);
      if (!await safeNavigate(page, url)) continue;

      visited = true;
      const cards = await page.$$("[class*='anime']:not([class*='episode']), .anime-card, .anime-item, article, .poster");
      for (const card of cards.slice(0, 30)) {
        try {
          const link = await card.$eval("a", (el) => el.getAttribute("href") || "").catch(() => "");
          const title = await card.$eval("[class*='title'], h2, h3, h4", (el) => el.textContent?.trim() || "").catch(() => "");
          const image = await card.$eval("img", (el) => el.getAttribute("src") || el.getAttribute("data-src") || "").catch(() => "");
          const absoluteLink = normalizeAbsoluteUrl(config.baseUrl, link);
          if (!absoluteLink || !absoluteLink.includes(animePathSegment)) continue;

          const slug = extractSlugFromUrl(absoluteLink, animePathSegment);
          if (!slug || results.some((item) => item.slug === slug)) continue;

          results.push({
            slug,
            title: pickBestTitle(title, slug.replace(/-/g, " ")),
            coverImage: normalizeAbsoluteUrl(config.baseUrl, image),
            status: "upcoming",
            type: "tv",
            episodesCount: 0,
          });

          if (results.length >= 15) return results;
        } catch (err) {
          console.error(`Error parsing search result for ${config.id}:`, err);
        }
      }
    }

    return visited ? results : [];
  } catch (err) {
    console.error(`Error searching ${config.id}:`, err);
    return [];
  } finally {
    await page.close();
  }
}
