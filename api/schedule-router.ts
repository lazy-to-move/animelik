import { eq } from "drizzle-orm";
import { anime, categories } from "@db/schema";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";

type JikanScheduleItem = {
  broadcast?: {
    day?: string | null;
    time?: string | null;
    timezone?: string | null;
    string?: string | null;
  };
};

const JIKAN_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
  Accept: "application/json,text/plain,*/*",
  Referer: "https://myanimelist.net/",
  Origin: "https://myanimelist.net",
};

const WEEKDAY_KEYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

type WeekdayKey = (typeof WEEKDAY_KEYS)[number];

const WEEKDAY_LABELS: Record<WeekdayKey, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

type BroadcastResult = {
  day: WeekdayKey;
  time: string | null;
  timezone: string | null;
  text: string | null;
};

type ScheduleAnimeItem = {
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
  broadcastDay: WeekdayKey | null;
  broadcastTime: string | null;
  broadcastTimezone: string | null;
  broadcastText: string | null;
};

type WeeklyScheduleResponse = {
  days: Array<{
    key: WeekdayKey;
    label: string;
    items: ScheduleAnimeItem[];
  }>;
  unscheduled: ScheduleAnimeItem[];
  total: number;
};

const WEEKLY_SCHEDULE_TTL_MS = 1000 * 60 * 10;
const BROADCAST_REFRESH_TTL_MS = 1000 * 60 * 60 * 12;
const BROADCAST_EMPTY_RETRY_MS = 1000 * 60 * 60;
const BROADCAST_RATE_LIMIT_RETRY_MS = 1000 * 60 * 2;

let weeklyScheduleCache: { expiresAt: number; value: WeeklyScheduleResponse } | null = null;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeBroadcastDay(raw?: string | null): WeekdayKey | null {
  if (!raw) return null;

  const lowered = raw.toLowerCase().trim();
  const singular = lowered.replace(/s$/, "");
  const matched = WEEKDAY_KEYS.find((weekday) => singular.includes(weekday));
  return matched ?? null;
}

function parseBroadcastFallback(raw?: string | null) {
  if (!raw) {
    return {
      day: null,
      time: null,
      timezone: null,
    } as const;
  }

  const normalized = raw.trim();
  const matchedDay = normalizeBroadcastDay(normalized);
  const timeMatch = normalized.match(/\b(\d{1,2}:\d{2})\b/);
  const timezoneMatch = normalized.match(/\(([A-Za-z0-9_+\-/: ]+)\)\s*$/);

  return {
    day: matchedDay,
    time: timeMatch?.[1] ?? null,
    timezone: timezoneMatch?.[1]?.trim() ?? null,
  } as const;
}

function getBroadcastCacheAgeMs(value: Date | string | null | undefined) {
  if (!value) return Number.POSITIVE_INFINITY;
  const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isNaN(timestamp) ? Number.POSITIVE_INFINITY : Date.now() - timestamp;
}

function shouldRefreshBroadcast(item: {
  externalId: string | null;
  broadcastFetchedAt: Date | string | null;
  broadcastDay: string | null;
}) {
  if (!item.externalId) return false;

  const ageMs = getBroadcastCacheAgeMs(item.broadcastFetchedAt);
  if (!Number.isFinite(ageMs)) return true;

  if (!item.broadcastDay) {
    return ageMs >= BROADCAST_EMPTY_RETRY_MS;
  }

  return ageMs >= BROADCAST_REFRESH_TTL_MS;
}

async function fetchBroadcastByMalId(malId: string): Promise<BroadcastResult | "rate_limited" | null> {
  try {
    const response = await fetch(`https://api.jikan.moe/v4/anime/${malId}/full`, {
      headers: JIKAN_HEADERS,
    });

    if (response.status === 429) {
      return "rate_limited";
    }

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as { data?: JikanScheduleItem };
    const broadcast = payload.data?.broadcast;
    const fallback = parseBroadcastFallback(broadcast?.string);
    const normalizedDay = normalizeBroadcastDay(broadcast?.day) ?? fallback.day;

    if (!normalizedDay) {
      return null;
    }

    return {
      day: normalizedDay,
      time: broadcast?.time ?? fallback.time,
      timezone: broadcast?.timezone ?? fallback.timezone,
      text: broadcast?.string ?? null,
    };
  } catch (error) {
    console.error("Failed to fetch Jikan broadcast info:", malId, error);
    return null;
  }
}

export const scheduleRouter = createRouter({
  weekly: publicQuery.query(async () => {
    if (weeklyScheduleCache && weeklyScheduleCache.expiresAt > Date.now()) {
      return weeklyScheduleCache.value;
    }

    const db = getDb();
    const ongoingAnime = await db
      .select({
        id: anime.id,
        title: anime.title,
        titleEnglish: anime.titleEnglish,
        titleJp: anime.titleJp,
        slug: anime.slug,
        coverImage: anime.coverImage,
        bannerImage: anime.bannerImage,
        score: anime.score,
        releaseYear: anime.releaseYear,
        episodesCount: anime.episodesCount,
        externalId: anime.externalId,
        categoryName: categories.name,
        broadcastDay: anime.broadcastDay,
        broadcastTime: anime.broadcastTime,
        broadcastTimezone: anime.broadcastTimezone,
        broadcastText: anime.broadcastText,
        broadcastFetchedAt: anime.broadcastFetchedAt,
      })
      .from(anime)
      .leftJoin(categories, eq(anime.categoryId, categories.id))
      .where(eq(anime.status, "ongoing"));

    const scheduledItems: ScheduleAnimeItem[] = [];

    for (const item of ongoingAnime) {
      let resolvedBroadcast: BroadcastResult | null = item.broadcastDay
        ? {
            day: item.broadcastDay as WeekdayKey,
            time: item.broadcastTime,
            timezone: item.broadcastTimezone,
            text: item.broadcastText,
          }
        : null;

      if (shouldRefreshBroadcast(item)) {
        const fetched = await fetchBroadcastByMalId(item.externalId!);

        if (fetched === "rate_limited") {
          await db
            .update(anime)
            .set({ broadcastFetchedAt: new Date(Date.now() - BROADCAST_REFRESH_TTL_MS + BROADCAST_RATE_LIMIT_RETRY_MS) })
            .where(eq(anime.id, item.id));
        } else {
          resolvedBroadcast = fetched;
          await db
            .update(anime)
            .set({
              broadcastDay: fetched?.day ?? null,
              broadcastTime: fetched?.time ?? null,
              broadcastTimezone: fetched?.timezone ?? null,
              broadcastText: fetched?.text ?? null,
              broadcastFetchedAt: new Date(),
            })
            .where(eq(anime.id, item.id));
        }

        if (item.externalId) {
          await sleep(450);
        }
      }

      scheduledItems.push({
        id: item.id,
        title: item.title,
        titleEnglish: item.titleEnglish,
        titleJp: item.titleJp,
        slug: item.slug,
        coverImage: item.coverImage,
        bannerImage: item.bannerImage,
        score: item.score,
        releaseYear: item.releaseYear,
        episodesCount: item.episodesCount,
        categoryName: item.categoryName,
        broadcastDay: resolvedBroadcast?.day ?? null,
        broadcastTime: resolvedBroadcast?.time ?? null,
        broadcastTimezone: resolvedBroadcast?.timezone ?? null,
        broadcastText: resolvedBroadcast?.text ?? null,
      });
    }

    const response = {
      days: WEEKDAY_KEYS.map((day) => ({
        key: day,
        label: WEEKDAY_LABELS[day],
        items: scheduledItems.filter((item) => item.broadcastDay === day),
      })),
      unscheduled: scheduledItems.filter((item) => !item.broadcastDay),
      total: scheduledItems.length,
    } satisfies WeeklyScheduleResponse;

    weeklyScheduleCache = {
      expiresAt: Date.now() + WEEKLY_SCHEDULE_TTL_MS,
      value: response,
    };

    return response;
  }),
});
