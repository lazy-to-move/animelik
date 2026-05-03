import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import type { User } from "@db/schema";
import { authenticateRequest } from "./kimi/auth";
import { getDb } from "./queries/connection";
import { users } from "@db/schema";
import { eq } from "drizzle-orm";
import * as jose from "jose";
import { env } from "./lib/env";
import { Session } from "@contracts/constants";

export type TrpcContext = {
  req: Request;
  resHeaders: Headers;
  user?: User;
};

async function verifyDevToken(token: string): Promise<User | null> {
  try {
    const secret = new TextEncoder().encode(env.appSecret);
    const { payload } = await jose.jwtVerify(token, secret);
    
    const userId = Number(payload.sub);
    if (!userId) return null;
    
    const db = getDb();
    const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    return user[0] || null;
  } catch {
    return null;
  }
}

function getSessionToken(headers: Headers): string | null {
  const cookie = headers.get("cookie") || "";
  const match = cookie.match(new RegExp(`${Session.cookieName}=([^;]+)`));
  return match ? match[1] : null;
}

export async function createContext(
  opts: FetchCreateContextFnOptions,
): Promise<TrpcContext> {
  const ctx: TrpcContext = { req: opts.req, resHeaders: opts.resHeaders };
  
  // First try Kimi OAuth auth
  try {
    ctx.user = await authenticateRequest(opts.req.headers);
  } catch {
    // If Kimi auth fails, try dev token
    const token = getSessionToken(opts.req.headers);
    if (token) {
      ctx.user = await verifyDevToken(token) || undefined;
    }
  }
  
  return ctx;
}