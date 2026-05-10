import { randomUUID } from "crypto";
import { createServer, type Server } from "http";
import { hostname } from "os";
import { Worker as BullWorker } from "bullmq";
import type { ScrapeJob } from "@db/schema";
import { verifyRuntimeDependencies } from "./lib/runtime-dependencies";
import { assertRuntimeReadiness } from "./lib/runtime-config";
import {
  getScraperExecutionMode,
  getScraperQueueBackend,
} from "./lib/scraper-execution";
import {
  claimNextScrapeJob,
  closeScrapeQueueConnections,
  completeScrapeJob,
  failScrapeJob,
  getRedisConnection,
  getScraperQueueName,
  markScrapeJobRunning,
} from "./services/scraper/job-queue";
import {
  runImportFromSourceOperation,
  runRefreshAnimeMetadataOperation,
  runSyncAllEpisodesOperation,
} from "./services/scraper/operations";

const pollMs = Math.max(
  1000,
  Number.parseInt(process.env.SCRAPER_WORKER_POLL_MS ?? "5000", 10) || 5000,
);
const workerId =
  process.env.SCRAPER_WORKER_ID?.trim() ||
  `${hostname()}-${process.pid}-${randomUUID().slice(0, 8)}`;

let shuttingDown = false;
const healthState = {
  ok: false,
  message: "Worker is starting.",
  verifiedAt: null as string | null,
};
let healthServer: Server | null = null;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function startHealthServer() {
  const port = Number.parseInt(process.env.PORT ?? "", 10);
  if (!Number.isFinite(port) || port <= 0) {
    return;
  }

  healthServer = createServer((req, res) => {
    if (!req.url?.startsWith("/healthz")) {
      res.statusCode = 404;
      res.end("Not Found");
      return;
    }

    const status = healthState.ok ? 200 : 503;
    res.writeHead(status, {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    });
    res.end(
      JSON.stringify({
        ok: healthState.ok,
        workerId,
        message: healthState.message,
        verifiedAt: healthState.verifiedAt,
      }),
    );
  });

  healthServer.listen(port, "0.0.0.0", () => {
    console.log(`[scraper-worker] health server listening on http://0.0.0.0:${port}/healthz`);
  });
}

async function processJob(job: ScrapeJob) {
  switch (job.type) {
    case "import_from_source": {
      if (!job.payload?.source || !job.payload?.slug) {
        throw new Error("Import job is missing source or slug.");
      }

      return runImportFromSourceOperation({
        source: job.payload.source,
        slug: job.payload.slug,
        importEpisodes: job.payload.importEpisodes ?? true,
        options: {
          downloadImages: false,
        },
      });
    }

    case "sync_all_episodes": {
      if (typeof job.payload?.animeId !== "number") {
        throw new Error("Sync job is missing animeId.");
      }

      return runSyncAllEpisodesOperation({
        animeId: job.payload.animeId,
      });
    }

    case "refresh_anime_metadata": {
      if (typeof job.payload?.animeId !== "number") {
        throw new Error("Refresh metadata job is missing animeId.");
      }

      return runRefreshAnimeMetadataOperation({
        animeId: job.payload.animeId,
        options: {
          downloadImages: false,
        },
      });
    }

    case "queue_probe": {
      return {
        success: true as const,
        probeId: job.payload?.probeId ?? null,
        processedByWorkerId: workerId,
        processedAt: new Date().toISOString(),
        message: "Queue probe completed successfully.",
      };
    }

    default: {
      throw new Error(`Unsupported scrape job type: ${String(job.type)}`);
    }
  }
}

async function handleClaimedJob(job: ScrapeJob) {
  console.log(`[scraper-worker] claimed job ${job.id} (${job.type})`);

  try {
    const result = await processJob(job);

    if (result.success) {
      await completeScrapeJob({
        jobId: job.id,
        result,
      });
      console.log(`[scraper-worker] completed job ${job.id} (${job.type})`);
      return;
    }

    await failScrapeJob({
      jobId: job.id,
      errorMessage: result.error,
      result,
    });
    console.warn(
      `[scraper-worker] failed job ${job.id} (${job.type}): ${result.error}`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await failScrapeJob({
      jobId: job.id,
      errorMessage: message,
    });
    console.error(
      `[scraper-worker] crashed job ${job.id} (${job.type}):`,
      error,
    );
  }
}

async function runDbLoop() {
  console.log(
    `[scraper-worker] started worker ${workerId} in db queue mode with ${pollMs}ms polling`,
  );

  while (!shuttingDown) {
    const job = await claimNextScrapeJob({ workerId });

    if (!job) {
      await sleep(pollMs);
      continue;
    }

    await handleClaimedJob(job);
  }
}

async function runBullMqLoop() {
  console.log(
    `[scraper-worker] started worker ${workerId} in bullmq mode on queue ${getScraperQueueName()}`,
  );

  const worker = new BullWorker<{ dbJobId: number }>(
    getScraperQueueName(),
    async (queueJob) => {
      const job = await markScrapeJobRunning({
        jobId: queueJob.data.dbJobId,
        workerId,
      });

      if (!job) {
        console.warn(
          `[scraper-worker] skipped queue job ${queueJob.id}: DB job ${queueJob.data.dbJobId} is no longer pending`,
        );
        return;
      }

      await handleClaimedJob(job);
    },
    {
      connection: getRedisConnection(),
      concurrency: 1,
    },
  );

  worker.on("error", (error) => {
    console.error("[scraper-worker] bullmq worker error:", error);
  });

  while (!shuttingDown) {
    await sleep(500);
  }

  await worker.close();
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    shuttingDown = true;
  });
}

startHealthServer();

try {
  const runtimeReadiness = assertRuntimeReadiness({ role: "worker" });
  const dependencyStatus = await verifyRuntimeDependencies({ role: "worker" });
  if (runtimeReadiness.checks.length > 0) {
    console.warn(
      `[scraper-worker] runtime warnings: ${runtimeReadiness.checks
        .filter((check) => check.status === "warn")
        .map((check) => check.message)
        .join(" | ")}`,
    );
  }
  console.log(`[scraper-worker] ${dependencyStatus.queue.message}`);
  console.log(`[scraper-worker] ${dependencyStatus.media.message}`);
  healthState.ok = true;
  healthState.message = `${dependencyStatus.queue.message} ${dependencyStatus.media.message}`;
  healthState.verifiedAt = dependencyStatus.verifiedAt;

  if (getScraperExecutionMode() !== "queue") {
    console.warn(
      `[scraper-worker] execution mode is ${getScraperExecutionMode()}, but the worker was started anyway.`,
    );
  }

  if (getScraperQueueBackend() === "bullmq") {
    await runBullMqLoop();
  } else {
    await runDbLoop();
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  healthState.ok = false;
  healthState.message = message;
  healthState.verifiedAt = new Date().toISOString();
  console.error("[scraper-worker] startup failed:", error);
  process.exitCode = 1;
} finally {
  if (healthServer) {
    await new Promise<void>((resolve) => healthServer?.close(() => resolve()));
  }
  await closeScrapeQueueConnections();
  console.log(`[scraper-worker] stopping worker ${workerId}`);
}
