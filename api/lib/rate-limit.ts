import { TRPCError } from "@trpc/server";

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, RateLimitBucket>();
let nextCleanupAt = 0;

function cleanupExpiredBuckets(now: number) {
  if (now < nextCleanupAt) return;

  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }

  nextCleanupAt = now + 5 * 60 * 1000;
}

export function getRequestClientKey(req: Request): string {
  const forwardedFor = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = req.headers.get("x-real-ip")?.trim();
  const cfIp = req.headers.get("cf-connecting-ip")?.trim();
  return forwardedFor || realIp || cfIp || "unknown-client";
}

export function enforceRateLimit(key: string, limit: number, windowMs: number): void {
  const now = Date.now();
  cleanupExpiredBuckets(now);

  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  if (current.count >= limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `Too many requests. Try again in ${retryAfterSeconds} seconds.`,
    });
  }

  current.count += 1;
  buckets.set(key, current);
}
