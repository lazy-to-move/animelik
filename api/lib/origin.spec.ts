import { describe, expect, it } from "vitest";
import { getSourceRequestOrigin, getTrustedRequestOrigins, isTrustedMutationOrigin } from "./origin";

describe("origin helpers", () => {
  it("extracts the request and configured trusted origins", () => {
    const req = new Request("https://app.example.com/api/trpc/test");
    expect(getTrustedRequestOrigins(req, "https://www.example.com")).toEqual([
      "https://app.example.com",
      "https://www.example.com",
    ]);
  });

  it("prefers the origin header and falls back to referer", () => {
    const reqWithOrigin = new Request("https://app.example.com/api/trpc/test", {
      method: "POST",
      headers: {
        origin: "https://app.example.com",
      },
    });
    expect(getSourceRequestOrigin(reqWithOrigin)).toBe("https://app.example.com");

    const reqWithReferer = new Request("https://app.example.com/api/trpc/test", {
      method: "POST",
      headers: {
        referer: "https://app.example.com/admin",
      },
    });
    expect(getSourceRequestOrigin(reqWithReferer)).toBe("https://app.example.com");
  });

  it("allows same-origin cookie-authenticated mutation requests", () => {
    const req = new Request("https://app.example.com/api/trpc/test", {
      method: "POST",
      headers: {
        cookie: "kimi_sid=test",
        origin: "https://app.example.com",
      },
    });

    expect(isTrustedMutationOrigin(req)).toBe(true);
  });

  it("trusts proxy-forwarded public origins for cookie-authenticated mutations", () => {
    const req = new Request("http://127.0.0.1:10000/api/trpc/test", {
      method: "POST",
      headers: {
        cookie: "kimi_sid=test",
        origin: "https://synx-app.onrender.com",
        "x-forwarded-proto": "https",
        "x-forwarded-host": "synx-app.onrender.com",
      },
    });

    expect(getTrustedRequestOrigins(req)).toEqual([
      "http://127.0.0.1:10000",
      "https://synx-app.onrender.com",
    ]);
    expect(isTrustedMutationOrigin(req)).toBe(true);
  });

  it("blocks mismatched origins for cookie-authenticated mutation requests", () => {
    const req = new Request("https://app.example.com/api/trpc/test", {
      method: "POST",
      headers: {
        cookie: "kimi_sid=test",
        origin: "https://evil.example.com",
      },
    });

    expect(isTrustedMutationOrigin(req)).toBe(false);
  });

  it("allows stateless non-cookie mutation requests without origin", () => {
    const req = new Request("https://app.example.com/api/trpc/test", {
      method: "POST",
    });

    expect(isTrustedMutationOrigin(req)).toBe(true);
  });
});
