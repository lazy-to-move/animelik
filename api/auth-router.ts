import { randomUUID } from "node:crypto";
import * as cookie from "cookie";
import { z } from "zod";
import { Session } from "@contracts/constants";
import { getSessionCookieOptions } from "./lib/cookies";
import { createRouter, authedQuery, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { users } from "@db/schema";
import { eq } from "drizzle-orm";
import { env } from "./lib/env";
import { signSessionToken } from "./kimi/session";
import { findUserByEmail } from "./queries/users";
import { hashPassword, normalizeEmail, verifyPassword } from "./lib/passwords";

const authCredentialsSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(8).max(72),
});

const signUpSchema = authCredentialsSchema.extend({
  name: z.string().trim().min(2).max(60),
});

async function createSession(unionId: string) {
  return signSessionToken({
    unionId,
    clientId: env.appId || "local",
  });
}

function setSessionCookie(headers: Headers, reqHeaders: Headers, token: string) {
  const cookieOpts = getSessionCookieOptions(reqHeaders);
  headers.append(
    "set-cookie",
    cookie.serialize(Session.cookieName, token, {
      httpOnly: cookieOpts.httpOnly,
      path: cookieOpts.path,
      sameSite: cookieOpts.sameSite?.toLowerCase() as "lax" | "none",
      secure: cookieOpts.secure,
      maxAge: Session.maxAgeMs / 1000,
    }),
  );
}

function clearSessionCookie(headers: Headers, reqHeaders: Headers) {
  const opts = getSessionCookieOptions(reqHeaders);
  headers.append(
    "set-cookie",
    cookie.serialize(Session.cookieName, "", {
      httpOnly: opts.httpOnly,
      path: opts.path,
      sameSite: opts.sameSite?.toLowerCase() as "lax" | "none",
      secure: opts.secure,
      maxAge: 0,
    }),
  );
}

export const authRouter = createRouter({
  signUp: publicQuery.input(signUpSchema).mutation(async ({ ctx, input }) => {
    try {
      const db = getDb();

      const email = normalizeEmail(input.email);
      const existingUser = await findUserByEmail(email);
      if (existingUser) {
        throw new Error("An account with this email already exists.");
      }

      const unionId = `local:${randomUUID()}`;
      const passwordHash = await hashPassword(input.password);

      await db.insert(users).values({
        unionId,
        name: input.name.trim(),
        email,
        passwordHash,
        role: "user",
        lastSignInAt: new Date(),
      });

      const token = await createSession(unionId);
      setSessionCookie(ctx.resHeaders, ctx.req.headers, token);

      return { success: true };
    } catch (err: unknown) {
      console.error("Sign up error:", err);
      throw new Error(err instanceof Error ? err.message : "Sign up failed");
    }
  }),

  signIn: publicQuery.input(authCredentialsSchema).mutation(async ({ ctx, input }) => {
    try {
      const email = normalizeEmail(input.email);
      const user = await findUserByEmail(email);
      if (!user?.passwordHash) {
        throw new Error("Invalid email or password.");
      }

      const isValid = await verifyPassword(input.password, user.passwordHash);
      if (!isValid) {
        throw new Error("Invalid email or password.");
      }

      await getDb().update(users).set({ lastSignInAt: new Date() }).where(eq(users.id, user.id));

      const token = await createSession(user.unionId);
      setSessionCookie(ctx.resHeaders, ctx.req.headers, token);

      return { success: true };
    } catch (err: unknown) {
      console.error("Sign in error:", err);
      throw new Error(err instanceof Error ? err.message : "Sign in failed");
    }
  }),

  devLogin: publicQuery.mutation(async ({ ctx }) => {
    if (env.isProduction) {
      throw new Error("Dev login is disabled in production.");
    }

    try {
      const db = getDb();

      let user = await db.select().from(users).where(eq(users.unionId, "local:dev-admin")).limit(1);

      if (!user.length) {
        const [inserted] = await db.insert(users).values({
          unionId: "local:dev-admin",
          name: "Dev Admin",
          email: "dev@localhost",
          role: "admin",
          lastSignInAt: new Date(),
        }).$returningId();
        user = await db.select().from(users).where(eq(users.id, inserted.id));
      } else if (user[0].role !== "admin") {
        await db.update(users).set({ role: "admin", lastSignInAt: new Date() }).where(eq(users.id, user[0].id));
        user = await db.select().from(users).where(eq(users.id, user[0].id));
      }

      const token = await createSession(user[0].unionId);
      setSessionCookie(ctx.resHeaders, ctx.req.headers, token);

      return { success: true };
    } catch (err: unknown) {
      console.error("Dev login error:", err);
      throw new Error(err instanceof Error ? err.message : "Login failed");
    }
  }),

  me: authedQuery.query((opts) => opts.ctx.user),
  logout: authedQuery.mutation(async ({ ctx }) => {
    clearSessionCookie(ctx.resHeaders, ctx.req.headers);
    return { success: true };
  }),
});
