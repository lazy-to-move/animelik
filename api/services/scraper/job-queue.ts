import { and, asc, desc, eq, lte, sql } from "drizzle-orm";
import { Queue } from "bullmq";
import IORedis from "ioredis";
import {
  scrapeJobs,
  type InsertScrapeJob,
  type ScrapeJob,
  type ScrapeJobPayload,
  type ScrapeJobResult,
} from "@db/schema";
import { createRedisConnectionOptions } from "../../lib/redis-config";
import { getScraperQueueBackend } from "../../lib/scraper-execution";
import { getDb } from "../../queries/connection";

type Db = ReturnType<typeof getDb>;

type BullQueuePayload = {
  dbJobId: number;
};

let bullQueue: Queue<BullQueuePayload> | null = null;
let redisConnection: IORedis | null = null;

function getScraperQueueName() {
  return process.env.SCRAPER_QUEUE_NAME?.trim() || "synx-scrape-jobs";
}

function getRedisConnection() {
  if (redisConnection) {
    return redisConnection;
  }

  const redisUrl = process.env.REDIS_URL?.trim();
  if (!redisUrl) {
    throw new Error(
      "BullMQ scraper queue requires REDIS_URL to be configured.",
    );
  }

  redisConnection = new IORedis({
    ...createRedisConnectionOptions(redisUrl),
    maxRetriesPerRequest: null,
  });

  return redisConnection;
}

function getBullQueue() {
  if (!bullQueue) {
    bullQueue = new Queue<BullQueuePayload>(getScraperQueueName(), {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 1,
        removeOnComplete: 200,
        removeOnFail: 500,
      },
    });
  }

  return bullQueue;
}

async function dispatchBullMqJob(job: ScrapeJob) {
  await getBullQueue().add(
    job.type,
    { dbJobId: job.id },
    {
      jobId: `scrape-job-${job.id}`,
      attempts: 1,
    },
  );
}

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

  if (getScraperQueueBackend() === "bullmq") {
    try {
      await dispatchBullMqJob(job);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      await failScrapeJob({
        jobId: job.id,
        errorMessage: `BullMQ dispatch failed: ${message}`,
        db,
      });
      throw error;
    }
  }

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
  const [candidate] = await db
    .select()
    .from(scrapeJobs)
    .where(
      and(
        eq(scrapeJobs.status, "pending"),
        lte(scrapeJobs.availableAt, sql`now()`),
      ),
    )
    .orderBy(asc(scrapeJobs.createdAt))
    .limit(1);

  if (!candidate) {
    return null;
  }

  return markScrapeJobRunning({
    jobId: candidate.id,
    workerId: input.workerId,
    db,
  });
}

export async function markScrapeJobRunning(input: {
  jobId: number;
  workerId: string;
  db?: Db;
}) {
  const db = input.db ?? getDb();
  const now = new Date();
  const [claimed] = await db
    .update(scrapeJobs)
    .set({
      status: "running",
      lockedBy: input.workerId,
      startedAt: now,
      attempts: sql`${scrapeJobs.attempts} + 1`,
      errorMessage: null,
      updatedAt: now,
    })
    .where(
      and(eq(scrapeJobs.id, input.jobId), eq(scrapeJobs.status, "pending")),
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

export async function closeScrapeQueueConnections() {
  await bullQueue?.close().catch(() => {});
  bullQueue = null;

  if (redisConnection) {
    await redisConnection.quit().catch(async () => {
      await redisConnection?.disconnect();
    });
    redisConnection = null;
  }
}

export { getBullQueue, getRedisConnection, getScraperQueueName };
