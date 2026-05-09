import { asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { anime, episodeBrokenReports, episodes } from "@db/schema";
import { getDb } from "../queries/connection";

export const adminEpisodeListQuerySchema = z.object({
  animeId: z.coerce.number().int().positive().optional(),
  search: z.string().trim().optional(),
});

export const adminEpisodeCreateSchema = z.object({
  animeId: z.number().int().positive(),
  seasonNumber: z.number().int().positive().optional(),
  number: z.number().int().positive(),
  title: z.string().trim().optional(),
  synopsis: z.string().trim().optional(),
  thumbnail: z.string().trim().optional(),
  videoUrl: z.string().trim().optional(),
  duration: z.number().int().positive().optional(),
  airDate: z.string().trim().optional(),
});

export const adminEpisodeUpdateSchema = z.object({
  id: z.number().int().positive(),
  animeId: z.number().int().positive().optional(),
  seasonNumber: z.number().int().positive().optional(),
  number: z.number().int().positive().optional(),
  title: z.string().trim().optional(),
  synopsis: z.string().trim().optional(),
  thumbnail: z.string().trim().optional(),
  videoUrl: z.string().trim().optional(),
  duration: z.number().int().positive().optional(),
  airDate: z.string().trim().optional(),
});

export const adminEpisodeDeleteSchema = z.object({
  id: z.number().int().positive(),
});

export const adminEpisodeBulkDeleteSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1),
});

type EpisodeListItem = {
  id: number;
  animeId: number;
  animeTitle: string;
  animeSlug: string;
  seasonNumber: number | null;
  number: number;
  title: string | null;
  synopsis: string | null;
  thumbnail: string | null;
  videoUrl: string | null;
  duration: number | null;
  airDate: Date | null;
  createdAt: Date;
};

function normalizeOptionalText(value?: string) {
  const trimmed = value?.trim() ?? "";
  return trimmed || null;
}

function normalizeOptionalDate(value?: string) {
  const trimmed = value?.trim() ?? "";
  return trimmed ? new Date(trimmed) : undefined;
}

function matchesEpisodeSearch(item: EpisodeListItem, search: string) {
  const normalized = search.trim().toLowerCase();
  if (!normalized) return true;
  return [
    item.title ?? "",
    item.animeTitle,
    String(item.number),
    item.seasonNumber ? `season ${item.seasonNumber}` : "",
  ].some((value) => value.toLowerCase().includes(normalized));
}

export async function listAdminEpisodeAnimeOptions() {
  const db = getDb();
  return db
    .select({
      id: anime.id,
      title: anime.title,
      slug: anime.slug,
      episodesCount: anime.episodesCount,
    })
    .from(anime)
    .orderBy(asc(anime.title));
}

export async function listAdminEpisodes(rawInput: z.input<typeof adminEpisodeListQuerySchema> = {}) {
  const input = adminEpisodeListQuerySchema.parse(rawInput);
  const db = getDb();
  const animeOptions = await listAdminEpisodeAnimeOptions();
  const selectedAnimeId = input.animeId ?? animeOptions[0]?.id ?? null;

  if (!selectedAnimeId) {
    return {
      animeOptions,
      selectedAnimeId: null,
      selectedAnime: null,
      items: [] as EpisodeListItem[],
      total: 0,
    };
  }

  const rows = await db
    .select({
      id: episodes.id,
      animeId: episodes.animeId,
      animeTitle: anime.title,
      animeSlug: anime.slug,
      seasonNumber: episodes.seasonNumber,
      number: episodes.number,
      title: episodes.title,
      synopsis: episodes.synopsis,
      thumbnail: episodes.thumbnail,
      videoUrl: episodes.videoUrl,
      duration: episodes.duration,
      airDate: episodes.airDate,
      createdAt: episodes.createdAt,
    })
    .from(episodes)
    .innerJoin(anime, eq(episodes.animeId, anime.id))
    .where(eq(episodes.animeId, selectedAnimeId))
    .orderBy(asc(episodes.number));

  const search = input.search?.trim() ?? "";
  const items = search ? rows.filter((item) => matchesEpisodeSearch(item, search)) : rows;
  const selectedAnime = animeOptions.find((item) => item.id === selectedAnimeId) ?? null;

  return {
    animeOptions,
    selectedAnimeId,
    selectedAnime,
    items,
    total: items.length,
  };
}

export async function createAdminEpisode(rawInput: z.input<typeof adminEpisodeCreateSchema>) {
  const input = adminEpisodeCreateSchema.parse(rawInput);
  const db = getDb();
  const [inserted] = await db
    .insert(episodes)
    .values({
      animeId: input.animeId,
      seasonNumber: input.seasonNumber,
      number: input.number,
      title: normalizeOptionalText(input.title),
      synopsis: normalizeOptionalText(input.synopsis),
      thumbnail: normalizeOptionalText(input.thumbnail),
      videoUrl: normalizeOptionalText(input.videoUrl),
      duration: input.duration,
      airDate: normalizeOptionalDate(input.airDate),
    })
    .returning({ id: episodes.id });

  const [result] = await db.select().from(episodes).where(eq(episodes.id, inserted.id));
  return result;
}

export async function updateAdminEpisode(rawInput: z.input<typeof adminEpisodeUpdateSchema>) {
  const input = adminEpisodeUpdateSchema.parse(rawInput);
  const db = getDb();
  const { id, animeId, seasonNumber, number, title, synopsis, thumbnail, videoUrl, duration, airDate } = input;
  const updateValues = {
    ...(animeId !== undefined ? { animeId } : {}),
    ...(seasonNumber !== undefined ? { seasonNumber } : {}),
    ...(number !== undefined ? { number } : {}),
    ...(title !== undefined ? { title: normalizeOptionalText(title) } : {}),
    ...(synopsis !== undefined ? { synopsis: normalizeOptionalText(synopsis) } : {}),
    ...(thumbnail !== undefined ? { thumbnail: normalizeOptionalText(thumbnail) } : {}),
    ...(videoUrl !== undefined ? { videoUrl: normalizeOptionalText(videoUrl) } : {}),
    ...(duration !== undefined ? { duration } : {}),
    ...(airDate !== undefined ? { airDate: normalizeOptionalDate(airDate) } : {}),
  };

  await db.update(episodes).set(updateValues).where(eq(episodes.id, id));
  const [result] = await db.select().from(episodes).where(eq(episodes.id, id));
  return result;
}

export async function deleteAdminEpisodeById(id: number) {
  const db = getDb();
  await db.delete(episodeBrokenReports).where(eq(episodeBrokenReports.episodeId, id));
  await db.delete(episodes).where(eq(episodes.id, id));
  return { success: true };
}

export async function deleteAdminEpisodeByIds(ids: number[]) {
  const db = getDb();
  await db.delete(episodeBrokenReports).where(inArray(episodeBrokenReports.episodeId, ids));
  await db.delete(episodes).where(inArray(episodes.id, ids));
  return { success: true, deletedCount: ids.length };
}
