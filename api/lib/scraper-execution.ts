export type ScraperExecutionMode = "inline" | "queue";

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

export function getScraperExecutionMessage() {
  const mode = getScraperExecutionMode();

  if (mode === "queue") {
    return "Scraper jobs are queued and processed by the background worker. Keep the worker service online so imports and syncs can finish.";
  }

  return "Scraper jobs run immediately in this web process.";
}
