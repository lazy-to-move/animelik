import { getDb } from "../../queries/connection";
import { anime, episodes } from "../../../db/schema";
import { eq, isNotNull } from "drizzle-orm";
import { getScraperProvider } from "./provider-registry";

let syncInterval: ReturnType<typeof setInterval> | null = null;
let syncInProgress = false;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function startScheduler(intervalMs = 6 * 60 * 60 * 1000) {
  if (syncInterval) return;
  
  console.log(`[Scheduler] Starting episode sync job (every ${Math.round(intervalMs / 3600000)} hours)`);
  
  const runSync = async () => {
    if (syncInProgress) {
      console.log("[Scheduler] Previous sync still running, skipping overlap");
      return;
    }

    syncInProgress = true;
    try {
      console.log('[Scheduler] Running episode sync...');
      await syncAllEpisodes();
      console.log('[Scheduler] Episode sync completed');
    } catch (err) {
      console.error('[Scheduler] Sync error:', err);
    } finally {
      syncInProgress = false;
    }
  };
  
  setTimeout(() => {
    void runSync();
  }, Math.min(60 * 1000, intervalMs));

  syncInterval = setInterval(() => {
    void runSync();
  }, intervalMs);
}

export async function stopScheduler() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
    console.log('[Scheduler] Stopped');
  }
}

async function syncAllEpisodes() {
  const db = getDb();
  
  const allAnime = await db
    .select()
    .from(anime)
    .where(isNotNull(anime.externalSlug));
  
  for (const a of allAnime) {
    if (!a.externalSlug) continue;

    const provider = getScraperProvider(a.sourceSite ?? "witanime");
    const scrapedEpisodes = await withTimeout(
      provider.scrapeAnimeEpisodes(a.externalSlug),
      30000,
      `Fetch episodes for ${a.title}`,
    );
    const scrapedByNumber = new Map(scrapedEpisodes.map((ep) => [ep.number, ep] as const));
    
    const eps = await db
      .select()
      .from(episodes)
      .where(eq(episodes.animeId, a.id));
    
    for (const ep of eps) {
      try {
        const scrapedEpisode = scrapedByNumber.get(ep.number);
        if (!scrapedEpisode) continue;
        const sources = await withTimeout(
          provider.scrapeEpisodeSources(scrapedEpisode.id),
          15000,
          `Sync ${a.title} episode ${ep.number}`,
        );
        
        if (sources.length > 0) {
          await db
            .update(episodes)
            .set({ videoSources: sources })
            .where(eq(episodes.id, ep.id));
          
          console.log(`[Scheduler] Synced EP${ep.number} for ${a.title}`);
        }
        
        await delay(250);
      } catch (err) {
        console.error(`[Scheduler] Failed to sync EP${ep.number}:`, err);
      }
    }
  }
}

export async function syncSingleAnime(animeId: number) {
  const db = getDb();
  
  const a = await db
    .select()
    .from(anime)
    .where(eq(anime.id, animeId))
    .limit(1);
  
  if (!a.length || !a[0].externalSlug) {
    throw new Error('Anime not found or no external slug');
  }
  
  const eps = await db
    .select()
    .from(episodes)
    .where(eq(episodes.animeId, animeId));

  const provider = getScraperProvider(a[0].sourceSite ?? "witanime");
  const scrapedEpisodes = await withTimeout(
    provider.scrapeAnimeEpisodes(a[0].externalSlug),
    30000,
    `Fetch episodes for ${a[0].title}`,
  );
  const scrapedByNumber = new Map(scrapedEpisodes.map((ep) => [ep.number, ep] as const));
  
  let synced = 0;
  for (const ep of eps) {
    try {
      const scrapedEpisode = scrapedByNumber.get(ep.number);
      if (!scrapedEpisode) continue;
      const sources = await withTimeout(
        provider.scrapeEpisodeSources(scrapedEpisode.id),
        15000,
        `Sync ${a[0].title} episode ${ep.number}`,
      );
      if (sources.length > 0) {
        await db
          .update(episodes)
          .set({ videoSources: sources })
          .where(eq(episodes.id, ep.id));
        synced++;
      }
      await delay(250);
    } catch (err) {
      console.error(`Failed to sync EP${ep.number}:`, err);
    }
  }
  
  return { synced, total: eps.length };
}
