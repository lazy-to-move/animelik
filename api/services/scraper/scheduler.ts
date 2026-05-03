import { getDb } from "../../queries/connection";
import { anime, episodes } from "../../../db/schema";
import { eq, isNotNull } from "drizzle-orm";
import * as witanime from "./witanime-scraper";

let syncInterval: ReturnType<typeof setInterval> | null = null;

export async function startScheduler(intervalMs = 6 * 60 * 60 * 1000) {
  if (syncInterval) return;
  
  console.log(`[Scheduler] Starting episode sync job (every ${Math.round(intervalMs / 3600000)} hours)`);
  
  const runSync = async () => {
    try {
      console.log('[Scheduler] Running episode sync...');
      await syncAllEpisodes();
      console.log('[Scheduler] Episode sync completed');
    } catch (err) {
      console.error('[Scheduler] Sync error:', err);
    }
  };
  
  await runSync();
  
  syncInterval = setInterval(runSync, intervalMs);
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

    const scrapedEpisodes = await witanime.scrapeAnimeEpisodes(a.externalSlug);
    const scrapedByNumber = new Map(scrapedEpisodes.map((ep) => [ep.number, ep] as const));
    
    const eps = await db
      .select()
      .from(episodes)
      .where(eq(episodes.animeId, a.id));
    
    for (const ep of eps) {
      try {
        const scrapedEpisode = scrapedByNumber.get(ep.number);
        if (!scrapedEpisode) continue;
        const sources = await witanime.scrapeEpisodeSources(scrapedEpisode.id);
        
        if (sources.length > 0) {
          await db
            .update(episodes)
            .set({ videoSources: sources })
            .where(eq(episodes.id, ep.id));
          
          console.log(`[Scheduler] Synced EP${ep.number} for ${a.title}`);
        }
        
        await new Promise(r => setTimeout(r, 2000));
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

  const scrapedEpisodes = await witanime.scrapeAnimeEpisodes(a[0].externalSlug);
  const scrapedByNumber = new Map(scrapedEpisodes.map((ep) => [ep.number, ep] as const));
  
  let synced = 0;
  for (const ep of eps) {
    try {
      const scrapedEpisode = scrapedByNumber.get(ep.number);
      if (!scrapedEpisode) continue;
      const sources = await witanime.scrapeEpisodeSources(scrapedEpisode.id);
      if (sources.length > 0) {
        await db
          .update(episodes)
          .set({ videoSources: sources })
          .where(eq(episodes.id, ep.id));
        synced++;
      }
      await new Promise(r => setTimeout(r, 2000));
    } catch (err) {
      console.error(`Failed to sync EP${ep.number}:`, err);
    }
  }
  
  return { synced, total: eps.length };
}
