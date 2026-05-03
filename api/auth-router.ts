import * as cookie from "cookie";
import { Session } from "@contracts/constants";
import { getSessionCookieOptions } from "./lib/cookies";
import { createRouter, authedQuery, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { users } from "@db/schema";
import { eq } from "drizzle-orm";
import * as jose from "jose";
import { env } from "./lib/env";

async function createDevSession(userId: number, role: string) {
  const secret = new TextEncoder().encode(env.appSecret);
  const token = await new jose.SignJWT({ sub: String(userId), role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
  
  return token;
}

export const authRouter = createRouter({
  devLogin: publicQuery.mutation(async ({ ctx }) => {
    try {
      const db = getDb();
      
      let user = await db.select().from(users).where(eq(users.unionId, "dev-user")).limit(1);
      
      if (!user.length) {
        const [inserted] = await db.insert(users).values({
          unionId: "dev-user",
          name: "Dev Admin",
          email: "dev@localhost",
          role: "admin",
        }).$returningId();
        user = await db.select().from(users).where(eq(users.id, inserted.id));
      } else if (user[0].role !== "admin") {
        await db.update(users).set({ role: "admin" }).where(eq(users.id, user[0].id));
        user = await db.select().from(users).where(eq(users.id, user[0].id));
      }
      
      const token = await createDevSession(user[0].id, user[0].role);
      
      const cookieOpts = getSessionCookieOptions(ctx.req.headers);
      ctx.resHeaders.append(
        "set-cookie",
        cookie.serialize(Session.cookieName, token, {
          httpOnly: cookieOpts.httpOnly,
          path: cookieOpts.path,
          sameSite: cookieOpts.sameSite?.toLowerCase() as "lax" | "none",
          secure: cookieOpts.secure,
          maxAge: 60 * 60 * 24 * 7,
        }),
      );
      
      return { success: true };
    } catch (err: unknown) {
      console.error("Dev login error:", err);
      throw new Error(err instanceof Error ? err.message : "Login failed");
    }
  }),
  
  me: authedQuery.query((opts) => opts.ctx.user),
  logout: authedQuery.mutation(async ({ ctx }) => {
    const opts = getSessionCookieOptions(ctx.req.headers);
    ctx.resHeaders.append(
      "set-cookie",
      cookie.serialize(Session.cookieName, "", {
        httpOnly: opts.httpOnly,
        path: opts.path,
        sameSite: opts.sameSite?.toLowerCase() as "lax" | "none",
        secure: opts.secure,
        maxAge: 0,
      }),
    );
    return { success: true };
  }),
});
