import { afterEach, describe, expect, it } from "vitest";
import {
  getCatalogAccessMode,
  hasDirectCatalogDatabaseAccess,
} from "./catalog-source";

const originalDatabaseUrl = process.env.DATABASE_URL;

afterEach(() => {
  if (originalDatabaseUrl === undefined) {
    delete process.env.DATABASE_URL;
  } else {
    process.env.DATABASE_URL = originalDatabaseUrl;
  }
});

describe("catalog source mode", () => {
  it("uses legacy-http mode when DATABASE_URL is absent", () => {
    delete process.env.DATABASE_URL;

    expect(hasDirectCatalogDatabaseAccess()).toBe(false);
    expect(getCatalogAccessMode()).toBe("legacy-http");
  });

  it("uses direct-db mode when DATABASE_URL is present", () => {
    process.env.DATABASE_URL = "postgresql://postgres:secret@localhost:5432/synx";

    expect(hasDirectCatalogDatabaseAccess()).toBe(true);
    expect(getCatalogAccessMode()).toBe("direct-db");
  });
});
