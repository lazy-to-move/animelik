import { Hono } from "hono";
import type { Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { HttpBindings } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { TRPCError } from "@trpc/server";
import { ZodError } from "zod";
import { appRouter } from "./router";
import { createContext } from "./context";
import { verifyRuntimeDependencies } from "./lib/runtime-dependencies";
import { env } from "./lib/env";
import { isHttpError } from "./lib/http-error";
import { getPreferredPublicSiteOrigin } from "./lib/public-web";
import { assertRuntimeReadiness } from "./lib/runtime-config";
import { shouldStartEpisodeScheduler } from "./lib/scraper-execution";
import { startScheduler } from "./services/scraper/scheduler";
import { getDb } from "./queries/connection";
import { anime } from "@db/schema";
import {
  getFeaturedPublicAnime,
  getPublicAnimeDetails,
  getTrendingPublicAnime,
  listPublicAnime,
} from "./services/public-catalog";
import {
  authCredentialsSchema,
  getSessionUser,
  googleSignInSchema,
  logoutSession,
  signInWithCredentials,
  signInWithGoogleCredential,
  signUpSchema,
  signUpWithCredentials,
} from "./services/auth-service";
import {
  addWatchlistItemForUser,
  addWatchlistItemSchema,
  listWatchlistForUser,
  removeWatchlistItemForUser,
  updateWatchlistItemForUser,
  updateWatchlistItemSchema,
} from "./services/watchlist-service";
import {
  getBrokenEpisodeReportStatusForUser,
  reportBrokenEpisodeForUser,
} from "./services/broken-episode-service";
import {
  createOrUpdateReviewForUser,
  createReviewSchema,
  deleteReviewForUser,
} from "./services/review-service";
import { getWeeklySchedule } from "./services/weekly-schedule";
import { authenticateRequest } from "./session-auth";

type JsonHeaderInput = Headers | Record<string, string> | Array<[string, string]>;

const app = new Hono<{ Bindings: HttpBindings }>();
const runtimeReadiness = assertRuntimeReadiness({ role: "web" });
let runtimeDependencies:
  | Awaited<ReturnType<typeof verifyRuntimeDependencies>>
  | null = null;

function isHttpsRequest(c: Context): boolean {
  const forwardedProto = c.req.header("x-forwarded-proto");
  if (forwardedProto) {
    return forwardedProto.split(",")[0]?.trim().toLowerCase() === "https";
  }

  try {
    return new URL(c.req.url).protocol === "https:";
  } catch {
    return false;
  }
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function toOptionalInteger(value: string | null) {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function jsonHeaders(extra?: JsonHeaderInput) {
  const headers = new Headers(extra);
  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json; charset=utf-8");
  }
  return headers;
}

function toErrorResponse(error: unknown) {
  let status = 500;
  let message = "Internal server error.";

  if (error instanceof ZodError) {
    status = 400;
    message = error.issues[0]?.message ?? "Invalid request.";
  } else if (isHttpError(error)) {
    status = error.status;
    message = error.message;
  } else if (error instanceof TRPCError) {
    status =
      error.code === "TOO_MANY_REQUESTS"
        ? 429
        : error.code === "UNAUTHORIZED"
          ? 401
          : error.code === "FORBIDDEN"
            ? 403
            : 400;
    message = error.message;
  } else if (error instanceof Error && error.message) {
    message = error.message;
  }

  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: jsonHeaders({
      "cache-control": "no-store",
    }),
  });
}

app.use(bodyLimit({ maxSize: 50 * 1024 * 1024 }));
app.use("*", async (c, next) => {
  await next();

  c.header("X-Content-Type-Options", "nosniff");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("X-Frame-Options", "SAMEORIGIN");
  c.header("Content-Security-Policy", "base-uri 'self'; object-src 'none'; frame-ancestors 'self'; form-action 'self'");
  c.header("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  c.header("Cross-Origin-Resource-Policy", "same-site");
  c.header("Origin-Agent-Cluster", "?1");
  c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  if (isHttpsRequest(c)) {
    c.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
});
app.get("/healthz", c =>
  c.json(
    {
      ok: runtimeReadiness.ready,
      ts: Date.now(),
      runtime: runtimeReadiness,
      dependencies: runtimeDependencies,
    },
    runtimeReadiness.ready ? 200 : 503,
  ),
);
app.get("/api/public/home", async c => {
  const [featured, trending] = await Promise.all([
    getFeaturedPublicAnime(),
    getTrendingPublicAnime(),
  ]);

  return c.json({ featured, trending });
});
app.get("/api/public/browse", async c => {
  const url = new URL(c.req.url);
  const status = url.searchParams.get("status");
  const type = url.searchParams.get("type");
  const payload = await listPublicAnime({
    category: url.searchParams.get("category") ?? undefined,
    status:
      status === "ongoing" || status === "completed" || status === "upcoming"
        ? status
        : undefined,
    type:
      type === "tv" || type === "movie" || type === "ova" || type === "special"
        ? type
        : undefined,
    releaseYear: toOptionalInteger(url.searchParams.get("releaseYear")),
    search: url.searchParams.get("search") ?? undefined,
    page: toOptionalInteger(url.searchParams.get("page")),
    limit: toOptionalInteger(url.searchParams.get("limit")),
  });

  return c.json(payload);
});
app.get("/api/public/anime/:slug", async c => {
  const slug = c.req.param("slug");
  const payload = await getPublicAnimeDetails(slug);

  if (!payload) {
    return c.json({ error: "Not Found" }, 404);
  }

  return c.json(payload);
});
app.get("/api/public/schedule", async c => {
  const payload = await getWeeklySchedule();
  return c.json(payload);
});
app.get("/api/public/session", async c => {
  const user = await getSessionUser(c.req.raw.headers);
  return new Response(JSON.stringify({ user }), {
    status: 200,
    headers: jsonHeaders({
      "cache-control": "no-store",
    }),
  });
});
app.post("/api/public/auth/sign-in", async c => {
  try {
    const payload = authCredentialsSchema.parse(await c.req.json());
    const resHeaders = new Headers({
      "cache-control": "no-store",
    });
    const user = await signInWithCredentials({
      reqHeaders: c.req.raw.headers,
      resHeaders,
      email: payload.email,
      password: payload.password,
    });

    return new Response(JSON.stringify({ success: true, user }), {
      status: 200,
      headers: jsonHeaders(resHeaders),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
});
app.post("/api/public/auth/sign-up", async c => {
  try {
    const payload = signUpSchema.parse(await c.req.json());
    const resHeaders = new Headers({
      "cache-control": "no-store",
    });
    const user = await signUpWithCredentials({
      reqHeaders: c.req.raw.headers,
      resHeaders,
      name: payload.name,
      email: payload.email,
      password: payload.password,
    });

    return new Response(JSON.stringify({ success: true, user }), {
      status: 200,
      headers: jsonHeaders(resHeaders),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
});
app.post("/api/public/auth/google-sign-in", async c => {
  try {
    const payload = googleSignInSchema.parse(await c.req.json());
    const resHeaders = new Headers({
      "cache-control": "no-store",
    });
    const user = await signInWithGoogleCredential({
      reqHeaders: c.req.raw.headers,
      resHeaders,
      credential: payload.credential,
    });

    return new Response(JSON.stringify({ success: true, user }), {
      status: 200,
      headers: jsonHeaders(resHeaders),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
});
app.post("/api/public/auth/logout", async c => {
  try {
    const resHeaders = new Headers({
      "cache-control": "no-store",
    });
    const payload = logoutSession({
      reqHeaders: c.req.raw.headers,
      resHeaders,
    });

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: jsonHeaders(resHeaders),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
});
app.get("/api/public/watchlist", async c => {
  try {
    const user = await authenticateRequest(c.req.raw.headers);
    const items = await listWatchlistForUser(user.id);
    return new Response(JSON.stringify({ items }), {
      status: 200,
      headers: jsonHeaders({
        "cache-control": "no-store",
      }),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
});
app.post("/api/public/watchlist", async c => {
  try {
    const user = await authenticateRequest(c.req.raw.headers);
    const payload = addWatchlistItemSchema.parse(await c.req.json());
    const item = await addWatchlistItemForUser(user.id, payload);

    return new Response(JSON.stringify({ item }), {
      status: 200,
      headers: jsonHeaders({
        "cache-control": "no-store",
      }),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
});
app.patch("/api/public/watchlist/:id", async c => {
  try {
    const user = await authenticateRequest(c.req.raw.headers);
    const body =
      c.req.header("content-length") === "0" ? {} : await c.req.json().catch(() => ({}));
    const payload = updateWatchlistItemSchema.parse({
      ...body,
      id: Number.parseInt(c.req.param("id"), 10),
    });
    const item = await updateWatchlistItemForUser(user.id, payload);

    return new Response(JSON.stringify({ item }), {
      status: 200,
      headers: jsonHeaders({
        "cache-control": "no-store",
      }),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
});
app.delete("/api/public/watchlist/:id", async c => {
  try {
    const user = await authenticateRequest(c.req.raw.headers);
    const id = Number.parseInt(c.req.param("id"), 10);
    const payload = await removeWatchlistItemForUser(user.id, id);

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: jsonHeaders({
        "cache-control": "no-store",
      }),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
});
app.post("/api/public/reviews", async c => {
  try {
    const user = await authenticateRequest(c.req.raw.headers);
    const payload = createReviewSchema.parse(await c.req.json());
    const review = await createOrUpdateReviewForUser(user.id, payload);

    return new Response(JSON.stringify({ review }), {
      status: 200,
      headers: jsonHeaders({
        "cache-control": "no-store",
      }),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
});
app.delete("/api/public/reviews/:id", async c => {
  try {
    const user = await authenticateRequest(c.req.raw.headers);
    const id = Number.parseInt(c.req.param("id"), 10);
    const payload = await deleteReviewForUser({
      reviewId: id,
      userId: user.id,
      isAdmin: user.role === "admin",
    });

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: jsonHeaders({
        "cache-control": "no-store",
      }),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
});
app.get("/api/public/episodes/:id/broken-report-status", async c => {
  try {
    const user = await authenticateRequest(c.req.raw.headers);
    const episodeId = Number.parseInt(c.req.param("id"), 10);
    const payload = await getBrokenEpisodeReportStatusForUser(user.id, episodeId);

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: jsonHeaders({
        "cache-control": "no-store",
      }),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
});
app.post("/api/public/episodes/:id/report-broken", async c => {
  try {
    const user = await authenticateRequest(c.req.raw.headers);
    const episodeId = Number.parseInt(c.req.param("id"), 10);
    const payload = await reportBrokenEpisodeForUser(user.id, episodeId);

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: jsonHeaders({
        "cache-control": "no-store",
      }),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
});
app.get("/favicon.ico", c => c.redirect("/favicon.svg", 302));
app.get("/robots.txt", c => {
  const origin = getPreferredPublicSiteOrigin(c.req.url);
  return c.text(`User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`);
});
app.get("/sitemap.xml", async c => {
  const origin = getPreferredPublicSiteOrigin(c.req.url);
  const db = getDb();
  const animeRows = await db
    .select({
      slug: anime.slug,
      updatedAt: anime.updatedAt,
    })
    .from(anime)
    .orderBy(anime.updatedAt)
    .limit(5000);

  const staticEntries = [
    { loc: `${origin}/`, lastmod: undefined },
    { loc: `${origin}/browse`, lastmod: undefined },
    { loc: `${origin}/schedule`, lastmod: undefined },
  ];
  const animeEntries = animeRows.map(row => ({
    loc: `${origin}/anime/${row.slug.replace(/^\/+|\/+$/g, "")}`,
    lastmod: row.updatedAt?.toISOString(),
  }));

  const entries = [...staticEntries, ...animeEntries];
  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    entries
      .map(entry => {
        const lastmodTag = entry.lastmod
          ? `\n    <lastmod>${escapeXml(entry.lastmod)}</lastmod>`
          : "";
        return `  <url>\n    <loc>${escapeXml(entry.loc)}</loc>${lastmodTag}\n  </url>`;
      })
      .join("\n") +
    `\n</urlset>\n`;

  c.header("Content-Type", "application/xml; charset=utf-8");
  return c.body(xml);
});
app.use("/api/trpc/*", async c => {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext,
  });
});
app.all("/api/*", c => c.json({ error: "Not Found" }, 404));

export default app;

if (env.isProduction) {
  const { serve } = await import("@hono/node-server");
  const { serveStaticFiles } = await import("./lib/vite");
  serveStaticFiles(app);
  runtimeDependencies = await verifyRuntimeDependencies({ role: "web" });
  console.log(`[runtime] ${runtimeReadiness.summary}`);
  console.log(`[runtime] ${runtimeDependencies.queue.message}`);
  console.log(`[runtime] ${runtimeDependencies.media.message}`);

  if (shouldStartEpisodeScheduler()) {
    startScheduler(6 * 60 * 60 * 1000);
  } else {
    console.log("[Scheduler] Automatic episode sync disabled for this process");
  }

  const port = parseInt(process.env.PORT || "3000");
  serve({ fetch: app.fetch, port, hostname: "0.0.0.0" }, () => {
    console.log(`Server running on http://0.0.0.0:${port}/`);
  });
}
