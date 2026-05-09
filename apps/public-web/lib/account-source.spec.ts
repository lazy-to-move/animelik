import { afterEach, describe, expect, it } from "vitest";
import { getAccountAccessMode, hasDirectAccountAccess } from "./account-source";

const originalDatabaseUrl = process.env.DATABASE_URL;
const originalAppSecret = process.env.APP_SECRET;
const originalAppId = process.env.APP_ID;

afterEach(() => {
  if (originalDatabaseUrl === undefined) {
    delete process.env.DATABASE_URL;
  } else {
    process.env.DATABASE_URL = originalDatabaseUrl;
  }

  if (originalAppSecret === undefined) {
    delete process.env.APP_SECRET;
  } else {
    process.env.APP_SECRET = originalAppSecret;
  }

  if (originalAppId === undefined) {
    delete process.env.APP_ID;
  } else {
    process.env.APP_ID = originalAppId;
  }
});

describe("public-web account access mode", () => {
  it("falls back to the legacy bridge when shared auth env is incomplete", () => {
    process.env.DATABASE_URL = "postgresql://synx:secret@localhost/synx";
    delete process.env.APP_SECRET;
    process.env.APP_ID = "synx-public-web";

    expect(hasDirectAccountAccess()).toBe(false);
    expect(getAccountAccessMode()).toBe("legacy-http");
  });

  it("enables direct auth mode when db and session env are present", () => {
    process.env.DATABASE_URL = "postgresql://synx:secret@localhost/synx";
    process.env.APP_SECRET = "shared-session-secret";
    process.env.APP_ID = "synx-public-web";

    expect(hasDirectAccountAccess()).toBe(true);
    expect(getAccountAccessMode()).toBe("direct-db-auth");
  });
});
