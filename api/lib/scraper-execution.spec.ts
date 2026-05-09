import { afterEach, describe, expect, it } from "vitest";
import {
  getScraperExecutionMode,
  getScraperQueueBackend,
  shouldStartEpisodeScheduler,
} from "./scraper-execution";

const originalNodeEnv = process.env.NODE_ENV;
const originalExecutionMode = process.env.SCRAPER_EXECUTION_MODE;
const originalQueueBackend = process.env.SCRAPER_QUEUE_BACKEND;
const originalRedisUrl = process.env.REDIS_URL;
const originalSchedulerSetting = process.env.ENABLE_EPISODE_SYNC_SCHEDULER;

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
  restoreEnv("SCRAPER_EXECUTION_MODE", originalExecutionMode);
  restoreEnv("SCRAPER_QUEUE_BACKEND", originalQueueBackend);
  restoreEnv("REDIS_URL", originalRedisUrl);
  restoreEnv("ENABLE_EPISODE_SYNC_SCHEDULER", originalSchedulerSetting);
});

describe("getScraperExecutionMode", () => {
  it("defaults to inline outside production", () => {
    process.env.NODE_ENV = "development";
    delete process.env.SCRAPER_EXECUTION_MODE;

    expect(getScraperExecutionMode()).toBe("inline");
  });

  it("defaults to queue in production", () => {
    process.env.NODE_ENV = "production";
    delete process.env.SCRAPER_EXECUTION_MODE;

    expect(getScraperExecutionMode()).toBe("queue");
  });
});

describe("getScraperQueueBackend", () => {
  it("defaults to the db queue when no redis config exists", () => {
    delete process.env.SCRAPER_QUEUE_BACKEND;
    delete process.env.REDIS_URL;

    expect(getScraperQueueBackend()).toBe("db");
  });

  it("switches to bullmq automatically when redis is configured", () => {
    delete process.env.SCRAPER_QUEUE_BACKEND;
    process.env.REDIS_URL = "redis://127.0.0.1:6379";

    expect(getScraperQueueBackend()).toBe("bullmq");
  });

  it("respects an explicit backend override", () => {
    process.env.SCRAPER_QUEUE_BACKEND = "db";
    process.env.REDIS_URL = "redis://127.0.0.1:6379";

    expect(getScraperQueueBackend()).toBe("db");
  });
});

describe("shouldStartEpisodeScheduler", () => {
  it("does not start the scheduler in queue mode unless explicitly enabled", () => {
    process.env.NODE_ENV = "production";
    process.env.SCRAPER_EXECUTION_MODE = "queue";
    delete process.env.ENABLE_EPISODE_SYNC_SCHEDULER;

    expect(shouldStartEpisodeScheduler()).toBe(false);
  });

  it("starts the scheduler in inline mode when no override exists", () => {
    process.env.NODE_ENV = "development";
    process.env.SCRAPER_EXECUTION_MODE = "inline";
    delete process.env.ENABLE_EPISODE_SYNC_SCHEDULER;

    expect(shouldStartEpisodeScheduler()).toBe(true);
  });

  it("respects an explicit true override", () => {
    process.env.NODE_ENV = "production";
    process.env.SCRAPER_EXECUTION_MODE = "queue";
    process.env.ENABLE_EPISODE_SYNC_SCHEDULER = "true";

    expect(shouldStartEpisodeScheduler()).toBe(true);
  });
});

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}
