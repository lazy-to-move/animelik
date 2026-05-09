import IORedis from "ioredis";
import { verifyConfiguredMediaStorage } from "./media-storage";
import { createRedisConnectionOptions } from "./redis-config";
import {
  assertRuntimeReadiness,
  type RuntimeServiceRole,
} from "./runtime-config";

export type RuntimeDependencyStatus = {
  role: RuntimeServiceRole;
  queue: {
    checked: boolean;
    backend: "db" | "bullmq";
    queueName: string;
    message: string;
  };
  media: {
    checked: boolean;
    mode: "local" | "s3";
    message: string;
  };
  verifiedAt: string;
};

type DependencyOverrides = {
  pingRedis?: () => Promise<string>;
  verifyMedia?: () => Promise<{
    mode: "local" | "s3";
    verified: boolean;
    bucket: string | null;
    message: string;
  }>;
};

async function pingConfiguredRedis() {
  const redisUrl = process.env.REDIS_URL?.trim();
  if (!redisUrl) {
    throw new Error("REDIS_URL is required to verify BullMQ connectivity.");
  }

  const connection = new IORedis({
    ...createRedisConnectionOptions(redisUrl),
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    lazyConnect: true,
    connectTimeout: 5000,
    retryStrategy: () => null,
  });
  let lastErrorMessage = "";
  connection.on("error", (error) => {
    lastErrorMessage = error instanceof Error ? error.message : String(error);
  });

  try {
    await connection.connect();
    return await connection.ping();
  } catch (error) {
    const message =
      lastErrorMessage ||
      (error instanceof Error ? error.message : String(error));
    throw new Error(`Redis connectivity check failed: ${message}`);
  } finally {
    await connection.quit().catch(async () => {
      connection.disconnect();
    });
  }
}

export async function verifyRuntimeDependencies(
  input?: {
    role?: RuntimeServiceRole;
    overrides?: DependencyOverrides;
  },
): Promise<RuntimeDependencyStatus> {
  const report = assertRuntimeReadiness({ role: input?.role ?? "web" });
  const pingRedis =
    input?.overrides?.pingRedis ??
    pingConfiguredRedis;
  const verifyMedia =
    input?.overrides?.verifyMedia ?? verifyConfiguredMediaStorage;

  const queue =
    report.queue.backend === "bullmq"
      ? await (async () => {
          const response = await pingRedis();
          return {
            checked: true,
            backend: report.queue.backend,
            queueName: report.queue.queueName,
            message: `Redis connectivity verified for ${report.queue.queueName} (PING=${response}).`,
          };
        })()
      : {
          checked: false,
          backend: report.queue.backend,
          queueName: report.queue.queueName,
          message: "Database queue mode does not require Redis connectivity checks.",
        };

  const mediaCheck = await verifyMedia();
  const media = {
    checked: mediaCheck.mode === "s3",
    mode: mediaCheck.mode,
    message: mediaCheck.message,
  };

  return {
    role: report.role,
    queue,
    media,
    verifiedAt: new Date().toISOString(),
  };
}
