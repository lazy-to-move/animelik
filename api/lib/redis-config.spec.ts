import { describe, expect, it } from "vitest";
import { createRedisConnectionOptions } from "./redis-config";

describe("redis-config", () => {
  it("parses a standard redis url", () => {
    const options = createRedisConnectionOptions("redis://user:pass@localhost:6380/4");

    expect(options.host).toBe("localhost");
    expect(options.port).toBe(6380);
    expect(options.username).toBe("user");
    expect(options.password).toBe("pass");
    expect(options.db).toBe(4);
    expect(options.tls).toBeUndefined();
  });

  it("enables tls for rediss urls", () => {
    const options = createRedisConnectionOptions("rediss://example.com");

    expect(options.host).toBe("example.com");
    expect(options.port).toBe(6379);
    expect(options.tls).toEqual({});
  });
});
