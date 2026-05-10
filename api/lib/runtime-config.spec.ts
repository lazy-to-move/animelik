import { describe, expect, it } from "vitest";
import {
  assertRuntimeReadiness,
  getRuntimeReadinessReport,
} from "./runtime-config";

describe("runtime-config", () => {
  it("passes when using the default local/db setup", () => {
    const report = getRuntimeReadinessReport({
      role: "web",
      env: {
        NODE_ENV: "development",
      },
    });

    expect(report.ready).toBe(true);
    expect(report.queue.backend).toBe("db");
    expect(report.media.mode).toBe("local");
  });

  it("falls back to the database queue when bullmq is selected without REDIS_URL", () => {
    const report = getRuntimeReadinessReport({
      role: "worker",
      env: {
        NODE_ENV: "production",
        DATABASE_URL: "postgres://synx:synx@localhost:5432/synx",
        APP_SECRET: "12345678901234567890123456789012",
        SCRAPER_EXECUTION_MODE: "queue",
        SCRAPER_QUEUE_BACKEND: "bullmq",
      },
    });

    expect(report.ready).toBe(true);
    expect(report.queue.backend).toBe("db");
    expect(report.checks.some((check) => check.key === "redis_fallback")).toBe(true);
    expect(() =>
      assertRuntimeReadiness({
        role: "worker",
        env: {
          NODE_ENV: "production",
          DATABASE_URL: "postgres://synx:synx@localhost:5432/synx",
          APP_SECRET: "12345678901234567890123456789012",
          SCRAPER_EXECUTION_MODE: "queue",
          SCRAPER_QUEUE_BACKEND: "bullmq",
        },
      }),
    ).not.toThrow();
  });

  it("fails when BullMQ uses an invalid queue name", () => {
    const report = getRuntimeReadinessReport({
      role: "worker",
      env: {
        NODE_ENV: "production",
        SCRAPER_EXECUTION_MODE: "queue",
        SCRAPER_QUEUE_BACKEND: "bullmq",
        REDIS_URL: "redis://127.0.0.1:6379",
        SCRAPER_QUEUE_NAME: "synx:scrape-jobs",
      },
    });

    expect(report.ready).toBe(false);
    expect(report.checks.some((check) => check.key === "queue_name")).toBe(true);
  });

  it("fails when s3 mode is enabled without the required object-storage variables", () => {
    const report = getRuntimeReadinessReport({
      role: "web",
      env: {
        NODE_ENV: "production",
        DATABASE_URL: "postgres://synx:synx@localhost:5432/synx",
        APP_SECRET: "12345678901234567890123456789012",
        MEDIA_STORAGE_MODE: "s3",
      },
    });

    expect(report.ready).toBe(false);
    expect(report.media.mode).toBe("s3");
    expect(report.checks.some((check) => check.key === "s3_media")).toBe(true);
  });

  it("warns when google auth variables are only partially configured", () => {
    const report = getRuntimeReadinessReport({
      role: "web",
      env: {
        NODE_ENV: "production",
        DATABASE_URL: "postgres://synx:synx@localhost:5432/synx",
        APP_SECRET: "12345678901234567890123456789012",
        GOOGLE_CLIENT_ID: "server-client-id",
      },
    });

    expect(report.ready).toBe(true);
    expect(
      report.checks.find((check) => check.key === "google_auth_pair")?.status,
    ).toBe("warn");
  });

  it("fails when production is missing DATABASE_URL or APP_SECRET", () => {
    const report = getRuntimeReadinessReport({
      role: "web",
      env: {
        NODE_ENV: "production",
      },
    });

    expect(report.ready).toBe(false);
    expect(report.checks.some((check) => check.key === "database_url")).toBe(true);
    expect(report.checks.some((check) => check.key === "app_secret")).toBe(true);
  });

  it("marks fully configured bullmq plus s3 production as ready", () => {
    const report = getRuntimeReadinessReport({
      role: "worker",
      env: {
        NODE_ENV: "production",
        DATABASE_URL: "postgres://synx:synx@localhost:5432/synx",
        SITE_URL: "https://synx.example",
        APP_SECRET: "12345678901234567890123456789012",
        SCRAPER_EXECUTION_MODE: "queue",
        SCRAPER_QUEUE_BACKEND: "bullmq",
        REDIS_URL: "redis://127.0.0.1:6379",
        MEDIA_STORAGE_MODE: "s3",
        S3_MEDIA_BUCKET: "synx-media",
        S3_MEDIA_REGION: "auto",
        S3_MEDIA_ACCESS_KEY_ID: "key",
        S3_MEDIA_SECRET_ACCESS_KEY: "secret",
        MEDIA_PUBLIC_BASE_URL: "https://cdn.example.com",
      },
    });

    expect(report.ready).toBe(true);
    expect(report.media.objectStorageConfigured).toBe(true);
    expect(report.queue.redisConfigured).toBe(true);
    expect(report.queue.queueName).toBe("synx-scrape-jobs");
  });
});
