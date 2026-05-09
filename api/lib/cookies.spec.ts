import { describe, expect, it } from "vitest";
import { getSessionCookieOptions } from "./cookies";

describe("getSessionCookieOptions", () => {
  it("uses secure false for localhost development", () => {
    const headers = new Headers({ host: "localhost:3000" });
    expect(getSessionCookieOptions(headers)).toEqual({
      httpOnly: true,
      path: "/",
      sameSite: "Lax",
      secure: false,
    });
  });

  it("keeps same-site lax and secure true for non-local hosts", () => {
    const headers = new Headers({ host: "synx.example.com" });
    expect(getSessionCookieOptions(headers)).toEqual({
      httpOnly: true,
      path: "/",
      sameSite: "Lax",
      secure: true,
    });
  });
});
