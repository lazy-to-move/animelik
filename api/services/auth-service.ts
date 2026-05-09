import { randomUUID } from "node:crypto";
import * as cookie from "cookie";
import { z } from "zod";
import type { User } from "@db/schema";
import { users } from "@db/schema";
import { Session } from "@contracts/constants";
import { eq } from "drizzle-orm";
import { getDb } from "../queries/connection";
import { getSessionCookieOptions } from "../lib/cookies";
import { env } from "../lib/env";
import { HttpError } from "../lib/http-error";
import { hashPassword, normalizeEmail, verifyPassword } from "../lib/passwords";
import { enforceRateLimit, getRequestClientKey } from "../lib/rate-limit";
import { signSessionToken } from "../kimi/session";
import { findUserByEmail, findUserByGoogleId } from "../queries/users";
import { authenticateRequest } from "../session-auth";
import { verifyGoogleCredential } from "../google-auth";

export const authCredentialsSchema = z.object({
  email: z
    .string()
    .email("Enter a valid email address.")
    .max(320, "Email addresses must be 320 characters or less."),
  password: z
    .string()
    .min(8, "Use at least 8 characters for your password.")
    .max(72, "Passwords must be 72 characters or less."),
});

export const signUpSchema = authCredentialsSchema.extend({
  name: z
    .string()
    .trim()
    .min(2, "Use at least 2 characters for your name.")
    .max(60, "Names must be 60 characters or less."),
});

export const googleSignInSchema = z.object({
  credential: z.string().min(1),
});

export type PublicSessionUser = {
  id: number;
  unionId: string;
  googleId: string | null;
  name: string | null;
  email: string | null;
  avatar: string | null;
  role: User["role"];
  createdAt: Date;
  updatedAt: Date;
  lastSignInAt: Date;
};

async function createSession(unionId: string) {
  return signSessionToken({
    unionId,
    clientId: env.appId || "local",
  });
}

function getClientKeyFromHeaders(headers: Headers) {
  return getRequestClientKey(new Request("http://local", { headers }));
}

export function toPublicSessionUser(user: User): PublicSessionUser {
  return {
    id: user.id,
    unionId: user.unionId,
    googleId: user.googleId ?? null,
    name: user.name ?? null,
    email: user.email ?? null,
    avatar: user.avatar ?? null,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastSignInAt: user.lastSignInAt,
  };
}

export function setSessionCookie(
  headers: Headers,
  reqHeaders: Headers,
  token: string,
) {
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

export function clearSessionCookie(headers: Headers, reqHeaders: Headers) {
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

export async function getSessionUser(
  headers: Headers,
): Promise<PublicSessionUser | null> {
  try {
    const user = await authenticateRequest(headers);
    return toPublicSessionUser(user);
  } catch {
    return null;
  }
}

export async function signUpWithCredentials(input: {
  reqHeaders: Headers;
  resHeaders: Headers;
  name: string;
  email: string;
  password: string;
}) {
  const db = getDb();
  const email = normalizeEmail(input.email);
  const clientKey = getClientKeyFromHeaders(input.reqHeaders);
  enforceRateLimit(`auth:signup:ip:${clientKey}`, 8, 10 * 60 * 1000);
  enforceRateLimit(
    `auth:signup:email:${clientKey}:${email}`,
    4,
    10 * 60 * 1000,
  );

  const existingUser = await findUserByEmail(email);
  if (existingUser) {
    throw new HttpError(409, "An account with this email already exists.");
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
  setSessionCookie(input.resHeaders, input.reqHeaders, token);

  const createdUser = await findUserByEmail(email);
  if (!createdUser) {
    throw new HttpError(500, "Failed to create account.");
  }

  return toPublicSessionUser(createdUser);
}

export async function signInWithCredentials(input: {
  reqHeaders: Headers;
  resHeaders: Headers;
  email: string;
  password: string;
}) {
  const email = normalizeEmail(input.email);
  const clientKey = getClientKeyFromHeaders(input.reqHeaders);
  enforceRateLimit(`auth:signin:ip:${clientKey}`, 20, 10 * 60 * 1000);
  enforceRateLimit(
    `auth:signin:email:${clientKey}:${email}`,
    10,
    10 * 60 * 1000,
  );

  const user = await findUserByEmail(email);
  if (!user?.passwordHash) {
    throw new HttpError(401, "Invalid email or password.");
  }

  const isValid = await verifyPassword(input.password, user.passwordHash);
  if (!isValid) {
    throw new HttpError(401, "Invalid email or password.");
  }

  await getDb()
    .update(users)
    .set({ lastSignInAt: new Date() })
    .where(eq(users.id, user.id));

  const token = await createSession(user.unionId);
  setSessionCookie(input.resHeaders, input.reqHeaders, token);

  const refreshedUser = await findUserByEmail(email);
  if (!refreshedUser) {
    throw new HttpError(500, "Failed to load account.");
  }

  return toPublicSessionUser(refreshedUser);
}

export async function signInWithGoogleCredential(input: {
  reqHeaders: Headers;
  resHeaders: Headers;
  credential: string;
}) {
  const clientKey = getClientKeyFromHeaders(input.reqHeaders);
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
    throw new HttpError(500, "Failed to complete Google sign-in.");
  }

  const token = await createSession(user.unionId);
  setSessionCookie(input.resHeaders, input.reqHeaders, token);

  return toPublicSessionUser(user);
}

export function logoutSession(input: {
  reqHeaders: Headers;
  resHeaders: Headers;
}) {
  clearSessionCookie(input.resHeaders, input.reqHeaders);
  return { success: true };
}
