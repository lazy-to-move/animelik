/* eslint-disable no-irregular-whitespace */
import puppeteer, { Browser, Page } from "puppeteer";
import type { ScraperAnime, ScraperEpisode, SourceSiteId, VideoSource } from "./types";

export interface GenericSiteConfig {
  id: SourceSiteId;
  name: string;
  baseUrl: string;
  latestUrl?: string;
  animePathSegment?: string;
  episodePathSegment?: string;
  searchUrls?: ((query: string) => string)[];
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

async function getBrowser(cacheKey: string): Promise<Browser> {
  const existing = browserCache.get(cacheKey);
  if (existing) return existing;

  const chromePath = "C:\\Users\\Expert Gaming\\.cache\\puppeteer\\chrome\\win64-148.0.7778.97\\chrome-win64\\chrome.exe";
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: chromePath,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-blink-features=AutomationControlled",
      "--disable-web-security",
      "--disable-features=IsolateOrigins,site-per-process",
      "--window-size=1920,1080",
    ],
  });

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
  return slug.replace(/\/$/, "") || null;
}

function extractEpisodeIdFromUrl(url: string, pathSegment: string): string | null {
  const normalizedSegment = pathSegment.endsWith("/") ? pathSegment : `${pathSegment}/`;
  const [, id = ""] = url.split(normalizedSegment);
  return id.replace(/\/$/, "") || null;
}

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

function deriveEpisodeId(absoluteHref: string, episodePathSegment: string): string {
  return extractEpisodeIdFromUrl(absoluteHref, episodePathSegment) ?? absoluteHref;
}

function looksLikeAnimeEpisodeUrl(config: GenericSiteConfig, animeSlug: string, absoluteHref: string): boolean {
  const normalizedHref = absoluteHref.toLowerCase();
  const normalizedSlug = animeSlug.toLowerCase();
  const episodeTail = normalizedHref.split('/episode/')[1] ?? "";

  if (!normalizedHref.includes('/episode/')) return false;
  if (!normalizedHref.includes(normalizedSlug)) return false;
  if (normalizedHref.includes(`${normalizedSlug}-episode-`)) return true;
  if (episodeTail.startsWith(`${normalizedSlug}-`) && /\d{1,4}/.test(episodeTail)) return true;

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

async function extractCoverImage(page: Page, baseUrl: string): Promise<string | undefined> {
  const selectorCover = await page
    .$eval(
      'img[class*="poster"], .posters img, .anime-header img, [class*="poster"] img, .wp-post-image, .attachment-post-thumbnail, .anime-thumbnail img, .thumb img',
      (el) => el.getAttribute("src") || el.getAttribute("data-src") || el.getAttribute("data-lazy-src") || "",
    )
    .catch(() => "");

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

export async function scrapeAnimeEpisodesWithConfig(config: GenericSiteConfig, animeSlug: string): Promise<ScraperEpisode[]> {
  const browser = await getBrowser(config.id);
  const page = await browser.newPage();
  const animePathSegment = config.animePathSegment ?? "/anime/";
  const episodePathSegment = config.episodePathSegment ?? "/episode/";

  try {
    const url = `${config.baseUrl}${animePathSegment}${animeSlug}`;
    if (!await safeNavigate(page, url)) return [];

    await page.waitForSelector("a, .episodes-card-container, [class*='episode'], article, .listing li", { timeout: 10000 });

    const scrapedEpisodes = await page.$$eval("a", (anchors) =>
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

    const episodes: ScraperEpisode[] = [];
    for (const episode of scrapedEpisodes) {
      const encoded = episode.onclick.match(/['"]([A-Za-z0-9+/_=-]{8,})['"]/)?.[1] ?? "";
      const decodedHref = decodeBase64Url(encoded);
      const absoluteHref = normalizeAbsoluteUrl(config.baseUrl, decodedHref || episode.href);
      if (!absoluteHref) continue;
      if (!looksLikeAnimeEpisodeUrl(config, animeSlug, absoluteHref)) continue;
      if (!looksLikeEpisodeLink(`${episode.title} ${episode.imageText}`, absoluteHref, episodePathSegment)) continue;

      const id = deriveEpisodeId(absoluteHref, episodePathSegment);
      const number = extractEpisodeNumber(`${episode.title} ${episode.imageText}`, absoluteHref);
      if (!number) continue;

      const preferredTitle = normalizeEpisodeCardTitle(episode.title);
      episodes.push({
        id,
        number,
        title: preferredTitle || normalizeEpisodeCardTitle(episode.imageText) || `Episode ${number}`,
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
  const browser = await getBrowser(config.id);
  const page = await browser.newPage();
  const animePathSegment = config.animePathSegment ?? "/anime/";

  try {
    const url = `${config.baseUrl}${animePathSegment}${slug}`;
    if (!await safeNavigate(page, url)) return null;

    await page.waitForSelector("h1, .anime-details-title, .anime-title, [class*='title']", { timeout: 10000 });

    const structured = await extractStructuredAnimeData(page, config.baseUrl);
    const title = await page.$eval("h1, .anime-details-title, .anime-title, [class*='title']", (el) => el.textContent?.trim() || "").catch(() => "");
    const ogTitle = await page.$eval("meta[property='og:title']", (el) => el.getAttribute("content") || "").catch(() => "");
    const documentTitle = await page.title().catch(() => "");
    const synopsis = await page.$eval(".content, p.anime-story, [class*='synopsis'], [class*='description'], .story, .anime-story, .entry-content p", (el) => el.textContent?.trim() || "").catch(() => "");
    const coverImage = structured.image ?? await extractCoverImage(page, config.baseUrl);
    const statusText = await page.$eval("div.anime-info, [class*='status'], .anime-status, .status", (el) => el.textContent?.toLowerCase() || "").catch(() => "");
    const typeText = await page.$eval("div.anime-info, .anime-card-type, [class*='type']", (el) => el.textContent?.toLowerCase() || "").catch(() => "");
    const ratingText = await page.$eval("[class*='rating'], .anime-rating, .score, [class*='score']", (el) => el.textContent?.trim() || "").catch(() => "");
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
