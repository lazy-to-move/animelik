import { and, asc, desc, eq, lte } from "drizzle-orm";
import {
  scrapeJobs,
  type InsertScrapeJob,
  type ScrapeJob,
  type ScrapeJobPayload,
  type ScrapeJobResult,
} from "@db/schema";
import { getDb } from "../../queries/connection";

type Db = ReturnType<typeof getDb>;

export async function enqueueScrapeJob(input: {
  type: InsertScrapeJob["type"];
  payload: ScrapeJobPayload;
  requestedByUserId?: number;
  maxAttempts?: number;
  db?: Db;
}) {
  const db = input.db ?? getDb();
  const [job] = await db
    .insert(scrapeJobs)
    .values({
      type: input.type,
      payload: input.payload,
      requestedByUserId: input.requestedByUserId,
      maxAttempts: input.maxAttempts ?? 1,
    })
    .returning();

  return job;
}

export async function listRecentScrapeJobs(options?: {
  limit?: number;
  db?: Db;
}) {
  const db = options?.db ?? getDb();
  const limit = Math.min(Math.max(options?.limit ?? 20, 1), 100);

  return db
    .select()
    .from(scrapeJobs)
    .orderBy(desc(scrapeJobs.createdAt))
    .limit(limit);
}

export async function claimNextScrapeJob(input: {
  workerId: string;
  db?: Db;
}): Promise<ScrapeJob | null> {
  const db = input.db ?? getDb();
  const now = new Date();
  const [candidate] = await db
    .select()
    .from(scrapeJobs)
    .where(
      and(
        eq(scrapeJobs.status, "pending"),
        lte(scrapeJobs.availableAt, now)
      )
    )
    .orderBy(asc(scrapeJobs.createdAt))
    .limit(1);

  if (!candidate) {
    return null;
  }

  const [claimed] = await db
    .update(scrapeJobs)
    .set({
      status: "running",
      lockedBy: input.workerId,
      startedAt: now,
      attempts: candidate.attempts + 1,
      errorMessage: null,
      updatedAt: now,
    })
    .where(
      and(
        eq(scrapeJobs.id, candidate.id),
        eq(scrapeJobs.status, "pending")
      )
    )
    .returning();

  return claimed ?? null;
}

export async function completeScrapeJob(input: {
  jobId: number;
  result: ScrapeJobResult;
  db?: Db;
}) {
  const db = input.db ?? getDb();
  const now = new Date();

  await db
    .update(scrapeJobs)
    .set({
      status: "completed",
      result: input.result,
      errorMessage: null,
      lockedBy: null,
      completedAt: now,
      updatedAt: now,
    })
    .where(eq(scrapeJobs.id, input.jobId));
}

export async function failScrapeJob(input: {
  jobId: number;
  errorMessage: string;
  result?: ScrapeJobResult | null;
  db?: Db;
}) {
  const db = input.db ?? getDb();
  const now = new Date();

  await db
    .update(scrapeJobs)
    .set({
      status: "failed",
      errorMessage: input.errorMessage,
      result: input.result ?? null,
      lockedBy: null,
      completedAt: now,
      updatedAt: now,
    })
    .where(eq(scrapeJobs.id, input.jobId));
}
