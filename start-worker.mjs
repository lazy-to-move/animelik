process.env.NODE_ENV = process.env.NODE_ENV || "production";
process.env.SCRAPER_EXECUTION_MODE = process.env.SCRAPER_EXECUTION_MODE || "queue";

await import("./dist/worker.js");
