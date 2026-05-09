import type { Hono } from "hono";
import type { HttpBindings } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import fs from "fs";
import path from "path";
import { findAnimeCoverFile, getFileContentType } from "./imported-media";

type App = Hono<{ Bindings: HttpBindings }>;

function isKnownFrontendRoute(pathname: string): boolean {
  return [
    /^\/$/,
    /^\/browse$/,
    /^\/schedule$/,
    /^\/login$/,
    /^\/signup$/,
    /^\/watchlist$/,
    /^\/admin$/,
    /^\/anime\/[^/]+\/?$/,
    /^\/watch\/[^/]+\/\d+\/?$/,
  ].some(pattern => pattern.test(pathname));
}

export function serveStaticFiles(app: App) {
  const distPath = path.resolve(import.meta.dirname, "../dist/public");

  app.get("/anime-covers/*", c => {
    const requestPath = c.req.path.replace(/^\/anime-covers\/+/i, "");
    const filePath = findAnimeCoverFile(requestPath);
    if (!filePath) {
      return c.json({ error: "Not Found" }, 404);
    }

    c.header("Content-Type", getFileContentType(filePath));
    c.header("Cache-Control", "public, max-age=86400, s-maxage=86400");
    return c.body(fs.readFileSync(filePath));
  });
  app.use("*", serveStatic({ root: "./dist/public" }));

  app.notFound(c => {
    const accept = c.req.header("accept") ?? "";
    if (!accept.includes("text/html")) {
      return c.json({ error: "Not Found" }, 404);
    }
    const indexPath = path.resolve(distPath, "index.html");
    const content = fs.readFileSync(indexPath, "utf-8");
    const pathname = new URL(c.req.url).pathname;
    return c.html(content, isKnownFrontendRoute(pathname) ? 200 : 404);
  });
}
