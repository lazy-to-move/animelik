export type ScraperExecutionMode = "inline" | "queue";
export type ScraperQueueBackend = "db" | "bullmq";

export function getScraperExecutionMode(): ScraperExecutionMode {
  const configured = process.env.SCRAPER_EXECUTION_MODE?.trim().toLowerCase();

  if (configured === "inline" || configured === "queue") {
    return configured;
  }

  return process.env.NODE_ENV === "production" ? "queue" : "inline";
}

export function isScraperQueueMode() {
  return getScraperExecutionMode() === "queue";
}

export function getScraperQueueBackend(): ScraperQueueBackend {
  const configured = process.env.SCRAPER_QUEUE_BACKEND?.trim().toLowerCase();

  if (configured === "db" || configured === "bullmq") {
    return configured;
  }

  return process.env.REDIS_URL?.trim() ? "bullmq" : "db";
}

export function getScraperExecutionMessage() {
  const mode = getScraperExecutionMode();

  if (mode === "queue") {
    const backend = getScraperQueueBackend();
    return backend === "bullmq"
      ? "Scraper jobs are queued through Redis/BullMQ and processed by the background worker. Keep both Redis and the worker service online so imports and syncs can finish."
      : "Scraper jobs are queued in the database and processed by the background worker. Keep the worker service online so imports and syncs can finish.";
  }

  return "Scraper jobs run immediately in this web process.";
}

export function shouldStartEpisodeScheduler() {
  const configured = process.env.ENABLE_EPISODE_SYNC_SCHEDULER?.trim().toLowerCase();

  if (configured === "true") return true;
  if (configured === "false") return false;

  return getScraperExecutionMode() === "inline";
}
