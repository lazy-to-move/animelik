import { hostname } from "os";
import { randomUUID } from "crypto";
import type { ScrapeJob } from "@db/schema";
import { claimNextScrapeJob, completeScrapeJob, failScrapeJob } from "./services/scraper/job-queue";
import {
  runImportFromSourceOperation,
  runRefreshAnimeMetadataOperation,
  runSyncAllEpisodesOperation,
} from "./services/scraper/operations";

const pollMs = Math.max(
  1000,
  Number.parseInt(process.env.SCRAPER_WORKER_POLL_MS ?? "5000", 10) || 5000
);
const workerId =
  process.env.SCRAPER_WORKER_ID?.trim() ||
  `${hostname()}-${process.pid}-${randomUUID().slice(0, 8)}`;

let shuttingDown = false;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
          // Worker and web service do not share a local disk, so keep remote image URLs here.
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

    default: {
      throw new Error(`Unsupported scrape job type: ${String(job.type)}`);
    }
  }
}

async function runLoop() {
  console.log(
    `[scraper-worker] started worker ${workerId} with ${pollMs}ms polling`
  );

  while (!shuttingDown) {
    const job = await claimNextScrapeJob({ workerId });

    if (!job) {
      await sleep(pollMs);
      continue;
    }

    console.log(
      `[scraper-worker] claimed job ${job.id} (${job.type})`
    );

    try {
      const result = await processJob(job);

      if (result.success) {
        await completeScrapeJob({
          jobId: job.id,
          result,
        });
        console.log(
          `[scraper-worker] completed job ${job.id} (${job.type})`
        );
      } else {
        await failScrapeJob({
          jobId: job.id,
          errorMessage: result.error,
          result,
        });
        console.warn(
          `[scraper-worker] failed job ${job.id} (${job.type}): ${result.error}`
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await failScrapeJob({
        jobId: job.id,
        errorMessage: message,
      });
      console.error(
        `[scraper-worker] crashed job ${job.id} (${job.type}):`,
        error
      );
    }
  }

  console.log(`[scraper-worker] stopping worker ${workerId}`);
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    shuttingDown = true;
  });
}

await runLoop();
