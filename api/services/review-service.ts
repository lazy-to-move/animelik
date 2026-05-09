import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { reviews, users } from "@db/schema";
import { HttpError } from "../lib/http-error";
import { getDb } from "../queries/connection";

export const createReviewSchema = z.object({
  animeId: z.number(),
  rating: z.number().min(1).max(10),
  comment: z
    .string()
    .trim()
    .max(2000, "Reviews must be 2000 characters or less.")
    .optional(),
});

export const deleteReviewSchema = z.object({
  id: z.number(),
});

function normalizeComment(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function listReviewsForAnime(animeId: number) {
  const db = getDb();
  return db
    .select({
      id: reviews.id,
      userId: reviews.userId,
      animeId: reviews.animeId,
      rating: reviews.rating,
      comment: reviews.comment,
      createdAt: reviews.createdAt,
      userName: users.name,
      userAvatar: users.avatar,
    })
    .from(reviews)
    .leftJoin(users, eq(reviews.userId, users.id))
    .where(eq(reviews.animeId, animeId))
    .orderBy(desc(reviews.createdAt));
}

async function getReviewById(id: number) {
  const db = getDb();
  const [review] = await db
    .select({
      id: reviews.id,
      userId: reviews.userId,
      animeId: reviews.animeId,
      rating: reviews.rating,
      comment: reviews.comment,
      createdAt: reviews.createdAt,
      userName: users.name,
      userAvatar: users.avatar,
    })
    .from(reviews)
    .leftJoin(users, eq(reviews.userId, users.id))
    .where(eq(reviews.id, id))
    .limit(1);

  return review ?? null;
}

export async function createOrUpdateReviewForUser(
  userId: number,
  input: z.infer<typeof createReviewSchema>,
) {
  const db = getDb();
  const existing = await db
    .select({ id: reviews.id })
    .from(reviews)
    .where(and(eq(reviews.userId, userId), eq(reviews.animeId, input.animeId)))
    .limit(1);

  const payload = {
    rating: input.rating,
    comment: normalizeComment(input.comment),
  };

  if (existing[0]) {
    await db
      .update(reviews)
      .set(payload)
      .where(eq(reviews.id, existing[0].id));

    const review = await getReviewById(existing[0].id);
    if (!review) {
      throw new HttpError(500, "Failed to refresh your review.");
    }
    return review;
  }

  const [inserted] = await db
    .insert(reviews)
    .values({
      userId,
      animeId: input.animeId,
      ...payload,
    })
    .returning({ id: reviews.id });

  const review = await getReviewById(inserted.id);
  if (!review) {
    throw new HttpError(500, "Failed to create your review.");
  }
  return review;
}

export async function deleteReviewForUser(input: {
  reviewId: number;
  userId: number;
  isAdmin?: boolean;
}) {
  const db = getDb();
  const deletedRows = input.isAdmin
    ? await db.delete(reviews).where(eq(reviews.id, input.reviewId)).returning({ id: reviews.id })
    : await db
        .delete(reviews)
        .where(and(eq(reviews.id, input.reviewId), eq(reviews.userId, input.userId)))
        .returning({ id: reviews.id });

  if (deletedRows.length === 0) {
    throw new HttpError(404, "Review not found.");
  }

  return { success: true };
}

export type PublicReviewRecord = Awaited<
  ReturnType<typeof listReviewsForAnime>
>[number];
