export type RuntimeServiceRole = "web" | "worker";
export type RuntimeCheckStatus = "ok" | "warn" | "error";
export type RuntimeMediaMode = "local" | "s3";
export type RuntimeQueueBackend = "db" | "bullmq";
export type RuntimeExecutionMode = "inline" | "queue";

export type RuntimeCheck = {
  key: string;
  status: RuntimeCheckStatus;
  message: string;
};

export type RuntimeReadinessReport = {
  role: RuntimeServiceRole;
  ready: boolean;
  summary: string;
  checks: RuntimeCheck[];
  queue: {
    mode: RuntimeExecutionMode;
    backend: RuntimeQueueBackend;
    redisConfigured: boolean;
    queueName: string;
  };
  media: {
    mode: RuntimeMediaMode;
    objectStorageConfigured: boolean;
  };
  scheduler: {
    enabled: boolean;
  };
};

type EnvLike = NodeJS.ProcessEnv;

function normalizeLower(value: string | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function hasValue(value: string | undefined) {
  return Boolean(value?.trim());
}

function isValidBullMqQueueName(value: string) {
  return !value.includes(":");
}

function getExecutionMode(env: EnvLike): RuntimeExecutionMode {
  const configured = normalizeLower(env.SCRAPER_EXECUTION_MODE);
  if (configured === "inline" || configured === "queue") {
    return configured;
  }

  return env.NODE_ENV === "production" ? "queue" : "inline";
}

function getQueueBackend(env: EnvLike): RuntimeQueueBackend {
  const configured = normalizeLower(env.SCRAPER_QUEUE_BACKEND);
  if (configured === "db" || configured === "bullmq") {
    return configured;
  }

  return hasValue(env.REDIS_URL) ? "bullmq" : "db";
}

function getMediaMode(env: EnvLike): RuntimeMediaMode {
  const configured = normalizeLower(env.MEDIA_STORAGE_MODE);
  if (configured === "s3") return "s3";
  if (configured === "local") return "local";
  return hasValue(env.S3_MEDIA_BUCKET) ? "s3" : "local";
}

function shouldEnableScheduler(env: EnvLike) {
  const configured = normalizeLower(env.ENABLE_EPISODE_SYNC_SCHEDULER);
  if (configured === "true") return true;
  if (configured === "false") return false;
  return getExecutionMode(env) === "inline";
}

function collectS3MissingVariables(env: EnvLike) {
  const required = [
    "S3_MEDIA_BUCKET",
    "S3_MEDIA_REGION",
    "S3_MEDIA_ACCESS_KEY_ID",
    "S3_MEDIA_SECRET_ACCESS_KEY",
    "MEDIA_PUBLIC_BASE_URL",
  ] as const;

  return required.filter((name) => !hasValue(env[name]));
}

function buildSummary(role: RuntimeServiceRole, checks: RuntimeCheck[]) {
  const errors = checks.filter((check) => check.status === "error");
  if (errors.length > 0) {
    return `${role} runtime configuration is invalid: ${errors
      .map((check) => check.message)
      .join(" | ")}`;
  }

  const warnings = checks.filter((check) => check.status === "warn");
  if (warnings.length > 0) {
    return `${role} runtime configuration is ready with warnings: ${warnings
      .map((check) => check.message)
      .join(" | ")}`;
  }

  return `${role} runtime configuration is ready.`;
}

export function getRuntimeReadinessReport(input?: {
  role?: RuntimeServiceRole;
  env?: EnvLike;
}): RuntimeReadinessReport {
  const role = input?.role ?? "web";
  const env = input?.env ?? process.env;
  const queueMode = getExecutionMode(env);
  const queueBackend = getQueueBackend(env);
  const queueName = env.SCRAPER_QUEUE_NAME?.trim() || "synx-scrape-jobs";
  const mediaMode = getMediaMode(env);
  const checks: RuntimeCheck[] = [];

  if (env.NODE_ENV === "production" && !hasValue(env.DATABASE_URL)) {
    checks.push({
      key: "database_url",
      status: "error",
      message: "DATABASE_URL is required in production so the app can reach PostgreSQL.",
    });
  }

  if (env.NODE_ENV === "production" && !hasValue(env.APP_SECRET)) {
    checks.push({
      key: "app_secret",
      status: "error",
      message:
        "APP_SECRET is required in production so session cookies and JWT-based auth can be signed and verified.",
    });
  }

  if (env.NODE_ENV === "production" && !hasValue(env.APP_ID)) {
    checks.push({
      key: "app_id",
      status: "warn",
      message:
        "APP_ID is not configured, so newly created sessions will fall back to a generic local client id.",
    });
  }

  if (queueMode === "queue" && queueBackend === "bullmq" && !hasValue(env.REDIS_URL)) {
    checks.push({
      key: "redis_url",
      status: "error",
      message:
        "SCRAPER_QUEUE_BACKEND=bullmq requires REDIS_URL so the web app and worker can dispatch and process queue jobs.",
    });
  }

  if (queueBackend === "bullmq" && !isValidBullMqQueueName(queueName)) {
    checks.push({
      key: "queue_name",
      status: "error",
      message:
        "SCRAPER_QUEUE_NAME cannot contain ':' when BullMQ is enabled. Use a Redis-safe name like synx-scrape-jobs.",
    });
  }

  if (mediaMode === "s3") {
    const missing = collectS3MissingVariables(env);
    if (missing.length > 0) {
      checks.push({
        key: "s3_media",
        status: "error",
        message: `MEDIA_STORAGE_MODE=s3 is missing ${missing.join(", ")}.`,
      });
    }
  }

  if (!hasValue(env.SITE_URL)) {
    checks.push({
      key: "site_url",
      status: "warn",
      message:
        "SITE_URL is not configured, so canonical URLs, sitemap output, and trusted-origin checks may be incomplete.",
    });
  }

  if (hasValue(env.APP_SECRET) && env.APP_SECRET!.trim().length < 32) {
    checks.push({
      key: "app_secret_strength",
      status: "warn",
      message:
        "APP_SECRET is shorter than 32 characters. Use a longer secret for production sessions.",
    });
  }

  const hasGoogleServerId = hasValue(env.GOOGLE_CLIENT_ID);
  const hasGoogleClientId = hasValue(env.VITE_GOOGLE_CLIENT_ID);
  if (hasGoogleServerId !== hasGoogleClientId) {
    checks.push({
      key: "google_auth_pair",
      status: "warn",
      message:
        "GOOGLE_CLIENT_ID and VITE_GOOGLE_CLIENT_ID should be configured together if Google sign-in is enabled.",
    });
  }

  if (role === "worker" && queueMode !== "queue") {
    checks.push({
      key: "worker_queue_mode",
      status: "warn",
      message:
        "The worker is running while SCRAPER_EXECUTION_MODE is not queue. It can stay online, but no queued jobs are expected.",
    });
  }

  if (role === "web" && env.NODE_ENV === "production" && queueMode === "inline") {
    checks.push({
      key: "inline_production_scraping",
      status: "warn",
      message:
        "Production is running with inline scraper execution. This is valid, but heavy scraper jobs will compete with user-facing traffic.",
    });
  }

  const ready = checks.every((check) => check.status !== "error");

  return {
    role,
    ready,
    summary: buildSummary(role, checks),
    checks,
    queue: {
      mode: queueMode,
      backend: queueBackend,
      redisConfigured: hasValue(env.REDIS_URL),
      queueName,
    },
    media: {
      mode: mediaMode,
      objectStorageConfigured:
        mediaMode === "s3" ? collectS3MissingVariables(env).length === 0 : false,
    },
    scheduler: {
      enabled: shouldEnableScheduler(env),
    },
  };
}

export function assertRuntimeReadiness(input?: {
  role?: RuntimeServiceRole;
  env?: EnvLike;
}) {
  const report = getRuntimeReadinessReport(input);
  if (!report.ready) {
    throw new Error(report.summary);
  }

  return report;
}
