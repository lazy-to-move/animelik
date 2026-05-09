import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { HttpBindings } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./router";
import { createContext } from "./context";
import { env } from "./lib/env";
import { startScheduler } from "./services/scraper/scheduler";
import { getDb } from "./queries/connection";
import { anime } from "@db/schema";

const app = new Hono<{ Bindings: HttpBindings }>();

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

app.use(bodyLimit({ maxSize: 50 * 1024 * 1024 }));
app.use("*", async (c, next) => {
  await next();

  c.header("X-Content-Type-Options", "nosniff");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("X-Frame-Options", "SAMEORIGIN");
  c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
});
app.get("/healthz", c => c.json({ ok: true, ts: Date.now() }));
app.get("/robots.txt", c => {
  const origin = new URL(c.req.url).origin;
  return c.text(`User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`);
});
app.get("/sitemap.xml", async c => {
  const origin = new URL(c.req.url).origin;
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

  startScheduler(6 * 60 * 60 * 1000);

  const port = parseInt(process.env.PORT || "3000");
  serve({ fetch: app.fetch, port, hostname: "0.0.0.0" }, () => {
    console.log(`Server running on http://0.0.0.0:${port}/`);
  });
}
