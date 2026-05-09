import type { RedisOptions } from "ioredis";

export function createRedisConnectionOptions(redisUrl: string): RedisOptions {
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
