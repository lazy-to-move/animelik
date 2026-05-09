import "dotenv/config";

import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { Client } from "pg";
import { Queue } from "bullmq";
import IORedis from "ioredis";

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getQueueName() {
  return process.env.SCRAPER_QUEUE_NAME?.trim() || "synx-scrape-jobs";
}

function createRedisConnectionOptions(redisUrl) {
  const parsed = new URL(redisUrl);
  const dbSegment = parsed.pathname.replace(/^\/+/, "");
  const db = dbSegment ? Number.parseInt(dbSegment, 10) : undefined;

  return {
    host: parsed.hostname,
    port: parsed.port ? Number.parseInt(parsed.port, 10) : 6379,
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    db: Number.isFinite(db) ? db : undefined,
    tls: parsed.protocol === "rediss:" ? {} : undefined,
  };
}

function formatJobSummary(job) {
  return `job ${job.id} [${job.type}] status=${job.status} attempts=${job.attempts}`;
}

async function waitForJobCompletion(client, jobId, timeoutMs) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const result = await client.query(
      `select id, type, status, attempts, "errorMessage", result, "createdAt", "startedAt", "completedAt"
       from "scrapeJobs"
       where id = $1`,
      [jobId],
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error(`Smoke probe job ${jobId} disappeared before completion.`);
    }

    if (row.status === "completed" || row.status === "failed") {
      return row;
    }

    await delay(500);
  }

  throw new Error(`Timed out waiting for smoke probe job ${jobId} to finish.`);
}

async function main() {
  const databaseUrl = required("DATABASE_URL");
  const redisUrl = required("REDIS_URL");
  const queueBackend = (process.env.SCRAPER_QUEUE_BACKEND ?? "bullmq").trim().toLowerCase();
  const executionMode = (process.env.SCRAPER_EXECUTION_MODE ?? "queue").trim().toLowerCase();

  if (executionMode !== "queue") {
    throw new Error("queue:smoke requires SCRAPER_EXECUTION_MODE=queue.");
  }

  if (queueBackend !== "bullmq") {
    throw new Error("queue:smoke requires SCRAPER_QUEUE_BACKEND=bullmq.");
  }

  const queueName = getQueueName();
  const probeId = `smoke-${randomUUID()}`;
  const workerEnv = {
    ...process.env,
    NODE_ENV: process.env.NODE_ENV || "production",
    SCRAPER_EXECUTION_MODE: "queue",
    SCRAPER_QUEUE_BACKEND: "bullmq",
  };

  const client = new Client({ connectionString: databaseUrl });
  const probeRedis = new IORedis({
    ...createRedisConnectionOptions(redisUrl),
    maxRetriesPerRequest: null,
  });
  const queueRedis = new IORedis({
    ...createRedisConnectionOptions(redisUrl),
    maxRetriesPerRequest: null,
  });
  const queue = new Queue(queueName, {
    connection: queueRedis,
  });

  let worker;
  let createdJobId = null;
  let createdQueueJob = null;

  try {
    console.log("[queue:smoke] Connecting to Postgres...");
    await client.connect();
    console.log("[queue:smoke] Pinging Redis...");
    const redisPing = await probeRedis.ping();
    console.log(`[queue:smoke] Redis ping: ${redisPing}`);

    console.log("[queue:smoke] Starting temporary worker...");
    worker = spawn(process.execPath, ["start-worker.mjs"], {
      cwd: process.cwd(),
      env: workerEnv,
      stdio: ["ignore", "pipe", "pipe"],
    });

    worker.stdout.on("data", (chunk) => {
      process.stdout.write(`[queue:smoke][worker] ${chunk}`);
    });
    worker.stderr.on("data", (chunk) => {
      process.stderr.write(`[queue:smoke][worker] ${chunk}`);
    });

    console.log("[queue:smoke] Inserting queue probe row...");
    const insertResult = await client.query(
      `insert into "scrapeJobs"
        ("type", "status", payload, attempts, "maxAttempts", "availableAt", "createdAt", "updatedAt")
       values
        ('queue_probe', 'pending', $1::jsonb, 0, 1, now(), now(), now())
       returning id, type, status, attempts`,
      [JSON.stringify({ probeId })],
    );

    const insertedJob = insertResult.rows[0];
    createdJobId = insertedJob.id;
    console.log(`[queue:smoke] Inserted ${formatJobSummary(insertedJob)} probeId=${probeId}`);

    console.log("[queue:smoke] Dispatching BullMQ probe job...");
    const bullJob = await queue.add(
      "queue_probe",
      { dbJobId: createdJobId },
      {
        jobId: `scrape-job-${createdJobId}`,
        attempts: 1,
        removeOnComplete: 10,
        removeOnFail: 10,
      },
    );
    createdQueueJob = bullJob;
    console.log(`[queue:smoke] Dispatched BullMQ job ${bullJob.id} on ${queueName}`);

    console.log("[queue:smoke] Waiting for worker completion...");
    const finalRow = await waitForJobCompletion(client, createdJobId, 20000);
    console.log(`[queue:smoke] Final ${formatJobSummary(finalRow)}`);
    console.log(`[queue:smoke] Result: ${JSON.stringify(finalRow.result)}`);

    if (finalRow.status !== "completed") {
      throw new Error(
        `Queue smoke probe failed: ${finalRow.errorMessage ?? "unknown worker error"}`,
      );
    }

    const probeResult = finalRow.result ?? {};
    if (probeResult.probeId !== probeId) {
      throw new Error(
        `Queue smoke probe completed, but returned probeId ${JSON.stringify(probeResult.probeId)} instead of ${probeId}.`,
      );
    }

    console.log("[queue:smoke] Success: enqueue -> BullMQ -> worker -> DB completion verified.");
  } finally {
    console.log("[queue:smoke] Cleaning up probe resources...");
    if (createdQueueJob) {
      console.log("[queue:smoke] Removing BullMQ probe job...");
      await createdQueueJob.remove().catch(() => {});
    }

    if (createdJobId) {
      console.log("[queue:smoke] Removing scrapeJobs probe row...");
      await client
        .query(`delete from "scrapeJobs" where id = $1`, [createdJobId])
        .catch(() => {});
    }

    if (worker && !worker.killed) {
      console.log("[queue:smoke] Stopping temporary worker...");
      worker.kill("SIGTERM");
      await delay(1000);
      if (worker.exitCode == null) {
        worker.kill("SIGKILL");
      }
    }

    console.log("[queue:smoke] Closing BullMQ queue handle...");
    await queue.close().catch(() => {});
    console.log("[queue:smoke] Closing Redis connections...");
    await queueRedis.quit().catch(() => {
      queueRedis.disconnect();
    });
    await probeRedis.quit().catch(() => {
      probeRedis.disconnect();
    });
    console.log("[queue:smoke] Closing Postgres connection...");
    await client.end().catch(() => {});
  }
}

main().catch((error) => {
  console.error("[queue:smoke] Failed:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
