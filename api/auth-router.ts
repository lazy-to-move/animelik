import { randomUUID } from "node:crypto";
import * as cookie from "cookie";
import { z } from "zod";
import { Session } from "@contracts/constants";
import { getSessionCookieOptions } from "./lib/cookies";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { users } from "@db/schema";
import { eq } from "drizzle-orm";
import { env } from "./lib/env";
import { signSessionToken } from "./kimi/session";
import { findUserByEmail, findUserByGoogleId } from "./queries/users";
import { hashPassword, normalizeEmail, verifyPassword } from "./lib/passwords";
import { verifyGoogleCredential } from "./google-auth";
import { enforceRateLimit, getRequestClientKey } from "./lib/rate-limit";

const authCredentialsSchema = z.object({
  email: z
    .string()
    .email("Enter a valid email address.")
    .max(320, "Email addresses must be 320 characters or less."),
  password: z
    .string()
    .min(8, "Use at least 8 characters for your password.")
    .max(72, "Passwords must be 72 characters or less."),
});

const signUpSchema = authCredentialsSchema.extend({
  name: z
    .string()
    .trim()
    .min(2, "Use at least 2 characters for your name.")
    .max(60, "Names must be 60 characters or less."),
});

const googleSignInSchema = z.object({
  credential: z.string().min(1),
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
      const clientKey = getRequestClientKey(ctx.req);
      enforceRateLimit(`auth:signup:ip:${clientKey}`, 8, 10 * 60 * 1000);
      enforceRateLimit(`auth:signup:email:${clientKey}:${email}`, 4, 10 * 60 * 1000);

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
      const clientKey = getRequestClientKey(ctx.req);
      enforceRateLimit(`auth:signin:ip:${clientKey}`, 20, 10 * 60 * 1000);
      enforceRateLimit(`auth:signin:email:${clientKey}:${email}`, 10, 10 * 60 * 1000);

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

  googleSignIn: publicQuery.input(googleSignInSchema).mutation(async ({ ctx, input }) => {
    try {
      const clientKey = getRequestClientKey(ctx.req);
      enforceRateLimit(`auth:google:ip:${clientKey}`, 15, 10 * 60 * 1000);
      const googleUser = await verifyGoogleCredential(input.credential);
      const db = getDb();
      const email = normalizeEmail(googleUser.email);
      const googleUnionId = `google:${googleUser.sub}`;

      let user = await findUserByGoogleId(googleUser.sub);
      if (!user) {
        user = await findUserByEmail(email);
      }

      if (user) {
        await db
          .update(users)
          .set({
            googleId: googleUser.sub,
            email,
            name: googleUser.name ?? user.name,
            avatar: googleUser.picture ?? user.avatar,
            lastSignInAt: new Date(),
          })
          .where(eq(users.id, user.id));
      } else {
        await db.insert(users).values({
          unionId: googleUnionId,
          googleId: googleUser.sub,
          email,
          name: googleUser.name,
          avatar: googleUser.picture,
          role: "user",
          lastSignInAt: new Date(),
        });
        user = await findUserByGoogleId(googleUser.sub);
      }

      if (!user) {
        throw new Error("Failed to complete Google sign-in.");
      }

      const token = await createSession(user.unionId);
      setSessionCookie(ctx.resHeaders, ctx.req.headers, token);

      return { success: true };
    } catch (err: unknown) {
      console.error("Google sign-in error:", err);
      throw new Error(err instanceof Error ? err.message : "Google sign-in failed");
    }
  }),

  me: publicQuery.query(({ ctx }) => ctx.user ?? null),
  logout: publicQuery.mutation(async ({ ctx }) => {
    clearSessionCookie(ctx.resHeaders, ctx.req.headers);
    return { success: true };
  }),
});
