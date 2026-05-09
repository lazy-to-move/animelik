import { describe, expect, it } from "vitest";
import { z } from "zod";
import { getFirstZodErrorMessage } from "./validation-errors";

describe("getFirstZodErrorMessage", () => {
  it("returns a readable field error message", () => {
    const schema = z.object({
      password: z
        .string()
        .min(8, "Use at least 8 characters for your password."),
    });

    const parsed = schema.safeParse({
      password: "123",
    });

    expect(parsed.success).toBe(false);
    if (parsed.success) return;

    expect(getFirstZodErrorMessage(parsed.error)).toBe(
      "Use at least 8 characters for your password.",
    );
  });

  it("returns null for non-zod errors", () => {
    expect(getFirstZodErrorMessage(new Error("nope"))).toBeNull();
  });
});
