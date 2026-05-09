import { describe, expect, it } from "vitest";
import { enforceRateLimit, getRequestClientKey } from "./rate-limit";

describe("getRequestClientKey", () => {
  it("prefers forwarded client headers", () => {
    const req = new Request("https://synx.example.com", {
      headers: {
        "x-forwarded-for": "203.0.113.10, 10.0.0.1",
      },
    });

    expect(getRequestClientKey(req)).toBe("203.0.113.10");
  });

  it("falls back to a stable placeholder when no address exists", () => {
    const req = new Request("https://synx.example.com");
    expect(getRequestClientKey(req)).toBe("unknown-client");
  });
});

describe("enforceRateLimit", () => {
  it("allows requests up to the configured limit", () => {
    const key = `rate-limit-pass-${Date.now()}`;

    expect(() => enforceRateLimit(key, 2, 60_000)).not.toThrow();
    expect(() => enforceRateLimit(key, 2, 60_000)).not.toThrow();
  });

  it("throws after the limit is exceeded", () => {
    const key = `rate-limit-fail-${Date.now()}`;

    enforceRateLimit(key, 1, 60_000);
    expect(() => enforceRateLimit(key, 1, 60_000)).toThrow(/Too many requests/i);
  });
});
