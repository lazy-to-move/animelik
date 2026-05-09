import puppeteer, { Browser, Page } from 'puppeteer';
import type { WitanimeAnime, WitanimeEpisode, VideoSource } from './types';
import { getPuppeteerLaunchOptions } from './puppeteer-launch';

const BASE_URL = 'https://witanime.you';

let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browser) {
    browser = await puppeteer.launch(getPuppeteerLaunchOptions());
  }
  return browser;
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const SERVER_LINK_SELECTORS = [
  '#episode-servers .server-link',
  '.servers .server-link',
  '.server-list .server-link',
  'a[data-url]',
];

const SERVER_LINK_SELECTOR = SERVER_LINK_SELECTORS.join(', ');

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  Referer: BASE_URL,
};

function decodeBase64Url(value: string): string | null {
  if (!value) return null;

  try {
    const normalized = value
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(value.length / 4) * 4, '=');

    return Buffer.from(normalized, 'base64').toString('utf8').trim() || null;
  } catch {
    return null;
  }
}

function normalizeAbsoluteUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('//')) return `https:${url}`;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/')) return `${BASE_URL}${url}`;
  return undefined;
}

function inferQuality(serverName: string): 'sd' | 'hd' | 'fhd' {
  if (serverName.includes('sd') || serverName.includes('360') || serverName.includes('480')) return 'sd';
  if (serverName.includes('fhd') || serverName.includes('1080') || serverName.includes('full')) return 'fhd';
  return 'hd';
}

function inferServer(serverName: string, url: string): string {
  let server = '';

  if (serverName.includes('mp4upload') || url.includes('mp4upload')) server = 'mp4upload';
  else if (serverName.includes('streamwish') || serverName.includes('playerwish') || url.includes('streamwish') || url.includes('playerwish')) server = 'streamwish';
  else if (serverName.includes('yona') || url.includes('yona')) server = 'yonaplay';
  else if (serverName.includes('videa') || url.includes('videa')) server = 'videa';

  if (url.includes('mega') || url.includes('mega.nz')) server = 'mega';
  else if (url.includes('4shared') || url.includes('4shared.com')) server = 'fourShared';
  else if (url.includes('soraplay') || url.includes('soraplay.xyz')) server = 'soraplay';

  if (server) return server;

  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    const primaryLabel = hostname.split('.')[0]?.trim();
    if (primaryLabel) return primaryLabel;
  } catch {
    // ignore malformed URLs
  }

  const cleanedLabel = serverName.replace(/[^a-z0-9]+/gi, '').trim();
  return cleanedLabel || 'direct';
}

async function resolveYonaPlaySources(embedUrl: string): Promise<VideoSource[]> {
  try {
    const response = await fetch(embedUrl, { headers: FETCH_HEADERS });
    if (!response.ok) return [];

    const html = await response.text();
    const matches = [...html.matchAll(/go_to_player\('([^']+)'\)[\s\S]*?<span>([^<]+)<\/span>[\s\S]*?<p>([^<]*)<\/p>/gi)];
    const sources: VideoSource[] = [];

    for (const match of matches) {
      const nestedUrl = normalizeAbsoluteUrl(decodeBase64Url(match[1]));
      if (!nestedUrl) continue;

      const serverLabel = (match[2] || '').trim().toLowerCase();
      const qualityLabel = (match[3] || '').trim().toLowerCase();

      sources.push({
        server: inferServer(serverLabel, nestedUrl),
        quality: inferQuality(qualityLabel || serverLabel),
        url: nestedUrl,
      });
    }

    return sources;
  } catch (error) {
    console.error('Failed to resolve YonaPlay sources:', error);
    return [];
  }
}

async function extractCoverImage(page: Page): Promise<string | undefined> {
  const selectorCover = await page
    .$eval(
      'img[class*="poster"], .posters img, .anime-header img, [class*="poster"] img, .wp-post-image, .attachment-post-thumbnail',
      (el) => el.getAttribute('src') || el.getAttribute('data-src') || el.getAttribute('data-lazy-src') || '',
    )
    .catch(() => '');

  if (selectorCover) {
    return normalizeAbsoluteUrl(selectorCover);
  }

  const ogImage = await page
    .$eval('meta[property="og:image"]', (el) => el.getAttribute('content') || '')
    .catch(() => '');

  if (ogImage) {
    return normalizeAbsoluteUrl(ogImage);
  }

  const episodeThumb = await page
    .$eval('.episodes-card-container img, [class*="episode"] img', (el) => el.getAttribute('src') || el.getAttribute('data-src') || '')
    .catch(() => '');

  return normalizeAbsoluteUrl(episodeThumb);
}

function toStatus(statusText: string): 'ongoing' | 'completed' | 'upcoming' {
  const text = statusText.toLowerCase();
  if (text.includes('ongoing') || text.includes('currently') || text.includes('يعرض')) return 'ongoing';
  if (text.includes('completed') || text.includes('finished') || text.includes('مكتمل')) return 'completed';
  return 'upcoming';
}

function toType(typeText: string): 'tv' | 'movie' | 'ova' | 'special' {
  const text = typeText.toLowerCase();
  if (text.includes('movie') || text.includes('فيلم')) return 'movie';
  if (text.includes('ova')) return 'ova';
  if (text.includes('special') || text.includes('خاصة')) return 'special';
  return 'tv';
}

async function safeNavigate(page: Page, url: string, retries = 3): Promise<boolean> {
  for (let i = 0; i < retries; i++) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await delay(1000);
      return true;
    } catch (err) {
      console.error(`Navigation failed (attempt ${i + 1}):`, err);
      await delay(2000);
    }
  }

  return false;
}

async function waitForServerList(page: Page): Promise<boolean> {
  for (const selector of SERVER_LINK_SELECTORS) {
    try {
      await page.waitForSelector(selector, { timeout: 4000 });
      return true;
    } catch {
      // continue trying known layouts
    }
  }

  return false;
}

async function readIframeSrc(page: Page): Promise<string> {
  return page
    .$eval('#iframe-container iframe', (iframe) => iframe.getAttribute('src') || '')
    .catch(() => '');
}

async function waitForIframeChange(page: Page, previousSrc: string, timeout = 1600): Promise<string> {
  try {
    const handle = await page.waitForFunction(
      (previous) => {
        const browserGlobal = globalThis as {
          document?: {
            querySelector: (selector: string) => {
              getAttribute: (name: string) => string | null;
            } | null;
          };
        };
        const iframe = browserGlobal.document?.querySelector('#iframe-container iframe');
        if (!iframe) return false;

        const nextSrc = iframe.getAttribute('src') || '';
        if (!nextSrc) return false;

        return nextSrc !== previous ? nextSrc : false;
      },
      { timeout },
      previousSrc,
    );

    const nextSrc = await handle.jsonValue();
    return typeof nextSrc === 'string' ? nextSrc : '';
  } catch {
    return '';
  }
}

export async function scrapeAnimeEpisodes(animeSlug: string): Promise<WitanimeEpisode[]> {
  const b = await getBrowser();
  const page = await b.newPage();

  try {
    const url = `${BASE_URL}/anime/${animeSlug}`;
    if (!await safeNavigate(page, url)) {
      console.error(`Failed to navigate to anime episodes: ${url}`);
      return [];
    }

    await page.waitForSelector('.episodes-card-container, [class*="episode"]', { timeout: 10000 });

    const scrapedEpisodes = await page.$$eval('.episodes-card-container', (cards) =>
      cards.map((card, index) => {
        const anchor = card.querySelector('h3 a');
        const image = card.querySelector('.img-responsive, img');

        return {
          index,
          title: anchor?.textContent?.trim() ?? `Episode ${index + 1}`,
          imageText: image?.getAttribute('alt')?.trim() ?? '',
          thumbnail: image?.getAttribute('src') ?? image?.getAttribute('data-src') ?? '',
          onclick: anchor?.getAttribute('onclick') ?? '',
        };
      }),
    ).catch(() => []);

    const episodes: Array<WitanimeEpisode | null> = scrapedEpisodes.map((episode) => {
        const encoded = episode.onclick.match(/['"]([A-Za-z0-9+/_=-]{8,})['"]/)?.[1] ?? '';
        const decodedUrl = normalizeAbsoluteUrl(decodeBase64Url(encoded));
        const id = decodedUrl?.split('/episode/')[1]?.replace(/\/$/, '');
        if (!id) return null;

        const numberMatch = `${episode.title} ${episode.imageText}`.match(/(\d+)/);
        const number = numberMatch ? Number(numberMatch[1]) : episode.index + 1;

        return {
          id,
          number,
          title: episode.title,
          thumbnail: normalizeAbsoluteUrl(episode.thumbnail),
          sources: [],
        } satisfies WitanimeEpisode;
      });

    return episodes
      .filter((episode): episode is WitanimeEpisode => episode !== null)
      .sort((a, b) => a.number - b.number);
  } catch (err) {
    console.error(`Error scraping episodes for ${animeSlug}:`, err);
    return [];
  } finally {
    await page.close();
  }
}

export async function scrapeAnimeInfo(slug: string): Promise<WitanimeAnime | null> {
  const b = await getBrowser();
  const page = await b.newPage();

  try {
    const url = `${BASE_URL}/anime/${slug}`;
    if (!await safeNavigate(page, url)) {
      console.error(`Failed to navigate to anime: ${url}`);
      return null;
    }

    await page.waitForSelector('h1, .anime-details-title, .anime-title, [class*="title"]', { timeout: 10000 });

    const title = await page.$eval('h1, .anime-details-title, .anime-title, [class*="title"]', (el) => el.textContent?.trim() || '').catch(() => '');
    const synopsis = await page.$eval('p.anime-story, [class*="synopsis"], [class*="description"], .story, .anime-story', (el) => el.textContent?.trim() || '').catch(() => '');
    const coverImage = await extractCoverImage(page);
    const statusText = await page.$eval('div.anime-info, [class*="status"], .anime-status, .status', (el) => el.textContent?.toLowerCase() || '').catch(() => '');
    const typeText = await page.$eval('div.anime-info, .anime-card-type, [class*="type"]', (el) => el.textContent?.toLowerCase() || '').catch(() => '');
    const scrapedEpisodes = await scrapeAnimeEpisodes(slug);
    
    const ratingText = await page.$eval('[class*="rating"], .anime-rating, .score, [class*="score"]', (el) => el.textContent?.trim() || '').catch(() => '');
    const studioText = await page.$eval('[class*="studio"], .anime-studio, .studio, [class*="producer"]', (el) => el.textContent?.trim() || '').catch(() => '');
    const yearText = await page.$eval('[class*="year"], .anime-year, .release-date, [class*="released"]', (el) => el.textContent?.trim() || '').catch(() => '');
    const genreText = await page.$eval('[class*="genre"], .anime-genre, .genres, [class*="category"]', (el) => el.textContent?.trim() || '').catch(() => '');

    const yearMatch = yearText.match(/(\d{4})/);
    const releaseYear = yearMatch ? parseInt(yearMatch[1]) : undefined;

    return {
      slug,
      title: title.replace(/Ø§Ù†Ù…ÙŠ|Ø£Ù†Ù…ÙŠ/g, '').trim(),
      synopsis: synopsis.slice(0, 2000),
      coverImage,
      status: toStatus(statusText),
      type: toType(typeText),
      episodesCount: Math.min(scrapedEpisodes.length, 500),
      rating: ratingText || undefined,
      studio: studioText || undefined,
      releaseYear,
      categoryName: genreText || undefined,
    };
  } catch (err) {
    console.error(`Error scraping anime ${slug}:`, err);
    return null;
  } finally {
    await page.close();
  }
}

export async function scrapeEpisodeSources(episodeId: string): Promise<VideoSource[]> {
  const b = await getBrowser();
  const page = await b.newPage();
  const sources: VideoSource[] = [];

  try {
    const url = `${BASE_URL}/episode/${episodeId}`;
    if (!await safeNavigate(page, url)) {
      console.error(`Failed to navigate to episode: ${url}`);
      return sources;
    }

    const hasServerList = await waitForServerList(page);
    if (!hasServerList) {
      console.error(`No recognizable server list found for episode ${episodeId}`);
      return sources;
    }

    const directSources = await page.$$eval(SERVER_LINK_SELECTOR, (elements) =>
      elements.map((el) => {
        const label =
          (el.querySelector('.ser')?.textContent || el.textContent || '')
            .trim()
            .toLowerCase();

        const link =
          el.getAttribute('data-url') ||
          el.querySelector('a')?.getAttribute('data-url') ||
          el.querySelector('a')?.getAttribute('href') ||
          '';

        return { label, link };
      }),
    ).catch(() => []);

    const seen = new Set<string>();

    for (const item of directSources) {
      const decodedUrl = normalizeAbsoluteUrl(decodeBase64Url(item.link) || item.link);
      if (!decodedUrl) continue;
      const key = `${item.label}|${decodedUrl}`;
      if (seen.has(key)) continue;
      seen.add(key);

      if (decodedUrl.includes('yonaplay.')) {
        const nestedSources = await resolveYonaPlaySources(decodedUrl);
        if (nestedSources.length > 0) {
          for (const nestedSource of nestedSources) {
            const nestedKey = `${nestedSource.server}|${nestedSource.quality}|${nestedSource.url}`;
            if (seen.has(nestedKey)) continue;
            seen.add(nestedKey);
            sources.push(nestedSource);
          }
          continue;
        }
      }

      sources.push({
        server: inferServer(item.label, decodedUrl),
        quality: inferQuality(item.label),
        url: decodedUrl,
      });
    }

    if (sources.length === 0) {
      const serverItems = await page.$$(SERVER_LINK_SELECTOR);
      let previousIframeSrc = await readIframeSrc(page);

      for (let i = 0; i < serverItems.length; i++) {
        const serverName = await serverItems[i]
          .$eval('.ser, .notice, span', (el) => el.textContent?.trim().toLowerCase() || '')
          .catch(async () => {
            return serverItems[i].evaluate((el) => el.textContent?.trim().toLowerCase() || '');
          });

        await serverItems[i].click().catch(() => undefined);
        const changedIframeSrc = await waitForIframeChange(page, previousIframeSrc);

        const embedUrl = changedIframeSrc || await readIframeSrc(page);
        previousIframeSrc = embedUrl || previousIframeSrc;

        const normalizedUrl = normalizeAbsoluteUrl(embedUrl);
        if (!normalizedUrl) continue;
        const key = `${serverName}|${normalizedUrl}`;
        if (seen.has(key)) continue;
        seen.add(key);

        if (normalizedUrl.includes('yonaplay.')) {
          const nestedSources = await resolveYonaPlaySources(normalizedUrl);
          if (nestedSources.length > 0) {
            for (const nestedSource of nestedSources) {
              const nestedKey = `${nestedSource.server}|${nestedSource.quality}|${nestedSource.url}`;
              if (seen.has(nestedKey)) continue;
              seen.add(nestedKey);
              sources.push(nestedSource);
            }
            continue;
          }
        }

        sources.push({
          server: inferServer(serverName, normalizedUrl),
          quality: inferQuality(serverName),
          url: normalizedUrl,
        });
      }
    }

    if (sources.length === 0) {
      const links = await page.$$eval('a[href*="stream"], a[href*="play"], a[href*="embed"], a[data-url]', (elements) =>
        elements
          .map((el) => el.getAttribute('href') || el.getAttribute('data-url') || '')
          .filter((href) => href && !href.includes('javascript')),
      );

      for (const link of links.slice(0, 10)) {
        const url = normalizeAbsoluteUrl(decodeBase64Url(link) || link);
        if (!url) continue;
        const key = `fallback|${url}`;
        if (seen.has(key)) continue;
        seen.add(key);

        sources.push({ server: inferServer('', url), quality: 'hd', url });
      }
    }
  } catch (err) {
    console.error(`Error scraping episode ${episodeId}:`, err);
  } finally {
    await page.close();
  }

  return sources;
}

export async function scrapeLatestAnime(limit = 20): Promise<WitanimeAnime[]> {
  const b = await getBrowser();
  const page = await b.newPage();
  const animeList: WitanimeAnime[] = [];

  try {
    if (!await safeNavigate(page, BASE_URL)) {
      console.error('Failed to navigate to home');
      return animeList;
    }

    await page.waitForSelector('[class*="anime"], .anime-list, .latest-anime', { timeout: 10000 });

    const animeCards = await page.$$('[class*="anime"]:not([class*="episode"]), .anime-card, .anime-item');

    for (const card of animeCards.slice(0, limit)) {
      try {
        const link = await card.$eval('a', (el) => el.href).catch(() => '');
        const title = await card.$eval('[class*="title"], h3, h4', (el) => el.textContent?.trim() || '').catch(() => '');
        const image = await card.$eval('img', (el) => el.getAttribute('src') || '').catch(() => '');

        if (link && link.includes('/anime/')) {
          const slug = link.split('/anime/')[1]?.replace(/\/$/, '') || '';
          if (slug) {
            animeList.push({
              slug,
              title: title.replace(/Ø§Ù†Ù…ÙŠ|Ø£Ù†Ù…ÙŠ/g, '').trim(),
              coverImage: normalizeAbsoluteUrl(image),
              status: 'ongoing',
              type: 'tv',
              episodesCount: 0,
            });
          }
        }
      } catch (err) {
        console.error('Error parsing anime card:', err);
      }
    }
  } catch (err) {
    console.error('Error scraping latest anime:', err);
  } finally {
    await page.close();
  }

  return animeList;
}

export async function scrapeSeasonAnime(season: string): Promise<WitanimeAnime[]> {
  const b = await getBrowser();
  const page = await b.newPage();
  const animeList: WitanimeAnime[] = [];

  try {
    const seasonUrl = `${BASE_URL}/anime-season/${season}`;
    if (!await safeNavigate(page, seasonUrl)) {
      console.error(`Failed to navigate to season: ${seasonUrl}`);
      return animeList;
    }

    await page.waitForSelector('[class*="anime"], .anime-list', { timeout: 10000 });

    const animeCards = await page.$$('[class*="anime"]:not([class*="episode"]), .anime-card, .anime-item');

    for (const card of animeCards) {
      try {
        const link = await card.$eval('a', (el) => el.href).catch(() => '');
        const title = await card.$eval('[class*="title"], h3, h4', (el) => el.textContent?.trim() || '').catch(() => '');

        if (link && link.includes('/anime/')) {
          const slug = link.split('/anime/')[1]?.replace(/\/$/, '') || '';
          if (slug) {
            animeList.push({
              slug,
              title: title.replace(/Ø§Ù†Ù…ÙŠ|Ø£Ù†Ù…ÙŠ/g, '').trim(),
              status: 'ongoing',
              type: 'tv',
              episodesCount: 0,
            });
          }
        }
      } catch (err) {
        console.error('Error parsing season anime card:', err);
      }
    }
  } catch (err) {
    console.error('Error scraping season anime:', err);
  } finally {
    await page.close();
  }

  return animeList;
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}

export async function searchAnime(query: string): Promise<WitanimeAnime[]> {
  const b = await getBrowser();
  const page = await b.newPage();
  const results: WitanimeAnime[] = [];

  try {
    const searchUrl = `${BASE_URL}/?s=${encodeURIComponent(query)}`;
    if (!await safeNavigate(page, searchUrl)) {
      console.error('Failed to search');
      return results;
    }

    await page.waitForSelector('[class*="anime"], .anime-list, .search-results', { timeout: 10000 });

    const cards = await page.$$('[class*="anime"]:not([class*="episode"]), .anime-card, .anime-item, article');

    for (const card of cards.slice(0, 15)) {
      try {
        const link = await card.$eval('a', (el) => el.href).catch(() => '');
        const title = await card.$eval('[class*="title"], h2, h3, h4', (el) => el.textContent?.trim() || '').catch(() => '');

        if (link && link.includes('/anime/')) {
          const slug = link.split('/anime/')[1]?.replace(/\/$/, '') || '';
          results.push({
            slug,
            title: title.replace(/Ø§Ù†Ù…ÙŠ|Ø£Ù†Ù…ÙŠ/g, '').trim(),
            status: 'upcoming',
            type: 'tv',
            episodesCount: 0,
          });
        }
      } catch (err) {
        console.error('Error parsing search result:', err);
      }
    }
  } catch (err) {
    console.error('Error searching anime:', err);
  } finally {
    await page.close();
  }

  return results;
}
