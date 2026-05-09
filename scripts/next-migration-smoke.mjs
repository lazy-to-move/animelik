import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer";

const baseUrl = process.env.NEXT_BASE_URL ?? "http://127.0.0.1:3101";
const watchSlug = process.env.MIGRATION_SMOKE_SLUG ?? "video-229";
const firstEpisode = Number.parseInt(
  process.env.MIGRATION_SMOKE_FIRST_EPISODE ?? "1",
  10,
);
const secondEpisode = Number.parseInt(
  process.env.MIGRATION_SMOKE_SECOND_EPISODE ?? "3",
  10,
);
const outputDir = path.resolve("test-artifacts", "next-migration-smoke");
const summaryPath = path.join(outputDir, "summary.json");

const summary = {
  baseUrl,
  watchSlug,
  firstEpisode,
  secondEpisode,
  consoleErrors: [],
  pageErrors: [],
  failedRequests: [],
  completedChecks: [],
};

fs.mkdirSync(outputDir, { recursive: true });

const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: {
    width: 1440,
    height: 960,
    deviceScaleFactor: 1,
  },
});

try {
  const page = await browser.newPage();
  attachDiagnostics(page);

  const account = await signUpFreshUser(page);
  await verifySettings(page, account.email);
  await verifyReviewFlow(page);
  const progress = await verifyWatchProgress(page);
  await verifyBrokenReport(page);
  await verifyWatchlistSnapshot(page, progress.targetEpisode);

  writeSummary({
    success: true,
    ...summary,
    account,
    progress,
  });
  console.log(
    JSON.stringify(
      {
        success: true,
        account,
        progress,
        checks: summary.completedChecks,
      },
      null,
      2,
    ),
  );
} catch (error) {
  writeSummary({
    success: false,
    error: error instanceof Error ? error.message : String(error),
    ...summary,
  });
  throw error;
} finally {
  await browser.close();
}

async function signUpFreshUser(page) {
  const email = `next-migration-${Date.now()}@synx.local`;
  const password = "NextMigration!12345";

  await goto(page, "/signup");
  await fillInput(page, "Display name", "Migration Runner");
  await fillInput(page, "Email address", email);
  await fillInput(page, "Password", password);
  await clickButton(page, "Create Account");
  await waitForPath(page, "/watchlist");
  await expectText(page, "Welcome back");

  summary.completedChecks.push("signup");
  return { email, password };
}

async function verifySettings(page, email) {
  await goto(page, "/settings");
  await expectText(page, "Settings");
  await expectText(page, "Account snapshot");
  await expectText(page, email);
  summary.completedChecks.push("settings");
}

async function verifyWatchProgress(page) {
  await goto(page, `/watch/${watchSlug}/${firstEpisode}`);
  await page.screenshot({
    path: path.join(outputDir, "watch-before-track.png"),
    fullPage: true,
  });

  await clickButton(page, "Track this episode");
  await expectText(
    page,
    `Progress tracking started at episode ${firstEpisode}.`,
  );

  summary.completedChecks.push("watch-track");

  await goto(page, `/watch/${watchSlug}/${secondEpisode}`);
  await expectText(page, `Progress synced to episode ${secondEpisode}.`);
  await page.screenshot({
    path: path.join(outputDir, "watch-after-sync.png"),
    fullPage: true,
  });

  summary.completedChecks.push("watch-sync");
  return {
    sourceEpisode: firstEpisode,
    targetEpisode: secondEpisode,
  };
}

async function verifyReviewFlow(page) {
  const reviewText = `Next migration review ${Date.now()}`;

  await goto(page, `/anime/${watchSlug}`);
  await page.type("textarea", reviewText);
  await clickButton(page, "Post review");
  await expectText(page, "Review posted.");
  await expectText(page, reviewText);

  summary.completedChecks.push("review-post");
}

async function verifyBrokenReport(page) {
  await clickButton(page, "Report Broken Episode");
  await expectText(page, "has been reported for review.");
  summary.completedChecks.push("broken-report");
}

async function verifyWatchlistSnapshot(page, expectedEpisode) {
  const payload = await page.evaluate(async () => {
    const response = await fetch("/api/watchlist", {
      credentials: "same-origin",
    });
    return response.json();
  });

  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    throw new Error("Watchlist payload was empty after progress sync.");
  }

  if (payload.items[0]?.currentEpisode !== expectedEpisode) {
    throw new Error(
      `Expected currentEpisode ${expectedEpisode}, received ${payload.items[0]?.currentEpisode}.`,
    );
  }

  summary.completedChecks.push("watchlist-payload");
}

function attachDiagnostics(page) {
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (text.includes("ERR_BLOCKED_BY_RESPONSE.NotSameSite")) {
      return;
    }
    summary.consoleErrors.push(text);
  });

  page.on("pageerror", (error) => {
    summary.pageErrors.push(error.message);
  });

  page.on("requestfailed", (request) => {
    const url = request.url();
    if (!url.startsWith(baseUrl)) return;
    const failureText = request.failure()?.errorText ?? "unknown";
    if (failureText === "net::ERR_ABORTED" && url.includes("_rsc=")) {
      return;
    }
    summary.failedRequests.push(
      `${request.method()} ${url} :: ${failureText}`,
    );
  });
}

async function goto(page, pathname) {
  await page.goto(`${baseUrl}${pathname}`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForFunction(
    () =>
      document.readyState === "interactive" ||
      document.readyState === "complete",
  );
  await page.waitForSelector("body");
  await page.evaluate(
    () => new Promise((resolve) => window.requestAnimationFrame(resolve)),
  );
  await sleep(300);
  assertCleanClientState(pathname);
}

async function fillInput(page, label, value) {
  const handle = await page.evaluateHandle((targetLabel) => {
    const labels = Array.from(document.querySelectorAll("label"));
    const labelNode = labels.find((node) =>
      node.textContent?.includes(targetLabel),
    );
    return labelNode?.querySelector("input") ?? null;
  }, label);

  const input = handle.asElement();
  if (!input) {
    throw new Error(`Could not find input for label "${label}".`);
  }

  await input.click({ clickCount: 3 });
  await input.press("Backspace");
  await input.type(value);
}

async function clickButton(page, text) {
  const button = await page.evaluateHandle((targetText) => {
    const matches = Array.from(document.querySelectorAll("button")).filter(
      (node) => node.textContent?.includes(targetText) && !node.disabled,
    );

    return matches[matches.length - 1] ?? null;
  }, text);

  const element = button.asElement();
  if (!element) {
    throw new Error(`Could not find button containing "${text}".`);
  }

  await element.click();
  await sleep(400);
}

async function expectText(page, text) {
  const normalized = text.toLowerCase();
  await page.waitForFunction(
    (expected) => document.body.innerText.toLowerCase().includes(expected),
    { timeout: 15000 },
    normalized,
  );
}

async function waitForPath(page, pathname) {
  await page.waitForFunction(
    (expectedPath) => window.location.pathname === expectedPath,
    { timeout: 15000 },
    pathname,
  );
}

function assertCleanClientState(stage) {
  const errors = [
    ...summary.consoleErrors.map((message) => `console: ${message}`),
    ...summary.pageErrors.map((message) => `pageerror: ${message}`),
    ...summary.failedRequests.map((message) => `requestfailed: ${message}`),
  ];

  if (errors.length === 0) return;

  throw new Error(
    `Client-side errors detected during ${stage}:\n${errors.join("\n")}`,
  );
}

function writeSummary(payload) {
  fs.writeFileSync(summaryPath, JSON.stringify(payload, null, 2));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
