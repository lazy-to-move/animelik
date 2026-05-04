import { describe, expect, it } from "vitest";
import { hashPassword, normalizeEmail, verifyPassword } from "./passwords";

describe("password helpers", () => {
  it("normalizes email addresses", () => {
    expect(normalizeEmail("  Admin@Synx.Local ")).toBe("admin@synx.local");
  });

  it("hashes and verifies a valid password", async () => {
    const password = "SynxAdmin!23495b6b";
    const hash = await hashPassword(password);

    expect(hash).toContain(":");
    await expect(verifyPassword(password, hash)).resolves.toBe(true);
  });

  it("rejects an invalid password", async () => {
    const hash = await hashPassword("correct-horse-battery-staple");
    await expect(verifyPassword("wrong-password", hash)).resolves.toBe(false);
  });

  it("rejects malformed hashes safely", async () => {
    await expect(verifyPassword("anything", "bad-hash")).resolves.toBe(false);
  });
});
