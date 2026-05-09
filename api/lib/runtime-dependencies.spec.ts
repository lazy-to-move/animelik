import { afterEach, describe, expect, it } from "vitest";
import { verifyRuntimeDependencies } from "./runtime-dependencies";

const originalEnv = { ...process.env };

function resetEnv() {
  for (const key of Object.keys(process.env)) {
    delete process.env[key];
  }

  Object.assign(process.env, originalEnv);
}

afterEach(() => {
  resetEnv();
});

describe("runtime-dependencies", () => {
  it("skips Redis and object storage when running the local default stack", async () => {
    process.env.NODE_ENV = "development";
    delete process.env.SCRAPER_QUEUE_BACKEND;
    delete process.env.REDIS_URL;
    delete process.env.MEDIA_STORAGE_MODE;
    delete process.env.S3_MEDIA_BUCKET;

    const status = await verifyRuntimeDependencies({
      role: "web",
      overrides: {
        pingRedis: async () => "PONG",
        verifyMedia: async () => ({
          mode: "local",
          verified: false,
          bucket: null,
          message: "local ok",
        }),
      },
    });

    expect(status.queue.checked).toBe(false);
    expect(status.media.checked).toBe(false);
  });

  it("pings Redis when BullMQ is enabled", async () => {
    process.env.NODE_ENV = "production";
    process.env.SITE_URL = "https://synx.example";
    process.env.APP_SECRET = "12345678901234567890123456789012";
    process.env.SCRAPER_EXECUTION_MODE = "queue";
    process.env.SCRAPER_QUEUE_BACKEND = "bullmq";
    process.env.REDIS_URL = "redis://127.0.0.1:6379";

    const status = await verifyRuntimeDependencies({
      role: "worker",
      overrides: {
        pingRedis: async () => "PONG",
        verifyMedia: async () => ({
          mode: "local",
          verified: false,
          bucket: null,
          message: "local ok",
        }),
      },
    });

    expect(status.queue.checked).toBe(true);
    expect(status.queue.queueName).toBe("synx-scrape-jobs");
    expect(status.queue.message).toContain("PONG");
    expect(status.media.checked).toBe(false);
  });

  it("checks object storage when s3 mode is enabled", async () => {
    process.env.NODE_ENV = "production";
    process.env.SITE_URL = "https://synx.example";
    process.env.APP_SECRET = "12345678901234567890123456789012";
    process.env.MEDIA_STORAGE_MODE = "s3";
    process.env.S3_MEDIA_BUCKET = "synx-media";
    process.env.S3_MEDIA_REGION = "auto";
    process.env.S3_MEDIA_ACCESS_KEY_ID = "key";
    process.env.S3_MEDIA_SECRET_ACCESS_KEY = "secret";
    process.env.MEDIA_PUBLIC_BASE_URL = "https://cdn.example.com";

    const status = await verifyRuntimeDependencies({
      role: "web",
      overrides: {
        pingRedis: async () => "PONG",
        verifyMedia: async () => ({
          mode: "s3",
          verified: true,
          bucket: "synx-media",
          message: "bucket ok",
        }),
      },
    });

    expect(status.media.checked).toBe(true);
    expect(status.media.message).toBe("bucket ok");
  });
});
