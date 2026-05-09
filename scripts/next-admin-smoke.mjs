import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer";

const baseUrl = process.env.NEXT_BASE_URL ?? "http://127.0.0.1:3101";
const email = process.env.ADMIN_SMOKE_EMAIL ?? "next-admin-smoke@synx.local";
const password = process.env.ADMIN_SMOKE_PASSWORD ?? "NextAdmin!12345";
const outputDir = path.resolve("test-artifacts", "next-admin-smoke");
const summaryPath = path.join(outputDir, "summary.json");

fs.mkdirSync(outputDir, { recursive: true });

const summary = {
  baseUrl,
  email,
  consoleErrors: [],
  pageErrors: [],
  failedRequests: [],
  completedChecks: [],
};

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

  await goto(page, "/login");
  await fillInput(page, "Email address", email);
  await fillInput(page, "Password", password);
  await clickButton(page, "Sign In");
  await waitForPath(page, "/watchlist");
  summary.completedChecks.push("admin-login");

  await goto(page, "/admin");
  await expectText(page, "Admin overview");
  await expectText(page, "Recent scraper jobs");
  await expectText(page, "Most reported broken episodes");
  await expectText(page, "Worker-backed source controls");
  await expectText(page, "Import from source");
  await page.screenshot({
    path: path.join(outputDir, "admin-overview.png"),
    fullPage: true,
  });
  summary.completedChecks.push("admin-overview");

  await goto(page, "/admin/anime");
  await expectText(page, "Anime catalog");
  await expectText(page, "Apply filters");
  await expectText(page, "Delete anime");
  await page.screenshot({
    path: path.join(outputDir, "admin-anime-catalog.png"),
    fullPage: true,
  });
  summary.completedChecks.push("admin-anime-catalog");

  await verifyEpisodeFlow(page);
  await verifyCategoryFlow(page);
  await verifyReportsPage(page);
  await verifyScraperPage(page);

  writeSummary({ success: true, ...summary });
  console.log(JSON.stringify({ success: true, checks: summary.completedChecks }, null, 2));
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

function attachDiagnostics(page) {
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    summary.consoleErrors.push(message.text());
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
    summary.failedRequests.push(`${request.method()} ${url} :: ${failureText}`);
  });
}

async function goto(page, pathname) {
  await page.goto(`${baseUrl}${pathname}`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForSelector("body");
  await page.evaluate(
    () => new Promise((resolve) => window.requestAnimationFrame(resolve)),
  );
  await sleep(250);
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

async function clickButtonWithinCard(page, cardText, buttonText) {
  const button = await page.evaluateHandle(
    ({ targetCardText, targetButtonText }) => {
      const cards = Array.from(document.querySelectorAll("article"));
      const card = cards.find((node) =>
        node.textContent?.includes(targetCardText),
      );
      if (!card) return null;
      const candidate = Array.from(
        card.querySelectorAll("button, a"),
      ).find((node) => node.textContent?.includes(targetButtonText));
      return candidate ?? null;
    },
    { targetCardText: cardText, targetButtonText: buttonText },
  );

  const element = button.asElement();
  if (!element) {
    throw new Error(
      `Could not find button containing "${buttonText}" in card "${cardText}".`,
    );
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

async function verifyCategoryFlow(page) {
  const categoryName = `Next Category ${Date.now()}`;
  const categorySlug = `next-category-${Date.now()}`;

  await goto(page, "/admin/categories");
  await expectText(page, "Create category");
  await expectText(page, "Categories");
  await fillInput(page, "Name", categoryName);
  await fillInput(page, "Slug", categorySlug);
  await page.locator('textarea[aria-label="Category description"]').fill(
    "Temporary category created by the Next admin smoke test.",
  );
  await clickButton(page, "Create category");
  await expectText(page, `${categoryName} was created successfully.`);
  await expectText(page, categoryName);
  await page.screenshot({
    path: path.join(outputDir, "admin-categories.png"),
    fullPage: true,
  });
  summary.completedChecks.push("admin-category-create");

  await filterCategories(page, categoryName);
  await expectCategoryCard(page, categoryName);

  page.once("dialog", (dialog) => dialog.accept());
  await clickButtonWithinCard(page, categoryName, "Delete category");
  await expectText(page, `${categoryName} was deleted successfully.`);
  summary.completedChecks.push("admin-category-delete");
}

async function verifyEpisodeFlow(page) {
  const episodeNumber = `${500000 + (Date.now() % 100000)}`;
  const episodeTitle = `Next Episode ${Date.now()}`;

  await goto(page, "/admin/episodes");
  await expectText(page, "Create episode");
  await expectText(page, "Episodes");
  await page.locator('input[aria-label="Episode number"]').fill(episodeNumber);
  await page.locator('input[aria-label="Episode title"]').fill(episodeTitle);
  await page.locator('input[aria-label="Episode duration"]').fill("24");
  await clickButton(page, "Create episode");
  await expectText(page, `${episodeTitle} was created successfully.`);
  await filterEpisodes(page, episodeTitle);
  await expectCategoryCard(page, episodeTitle);
  await page.screenshot({
    path: path.join(outputDir, "admin-episodes.png"),
    fullPage: true,
  });
  summary.completedChecks.push("admin-episode-create");

  page.once("dialog", (dialog) => dialog.accept());
  await clickButtonWithinCard(page, episodeTitle, "Delete episode");
  await expectText(page, `${episodeTitle} was deleted successfully.`);
  summary.completedChecks.push("admin-episode-delete");
}

async function verifyReportsPage(page) {
  await goto(page, "/admin/reports");
  await expectText(page, "Broken episode reports");
  await expectText(page, "Most reported episodes");
  await expectText(page, "Recent report activity");
  await page.screenshot({
    path: path.join(outputDir, "admin-reports.png"),
    fullPage: true,
  });
  summary.completedChecks.push("admin-reports");
}

async function verifyScraperPage(page) {
  await goto(page, "/admin/scraper");
  await expectText(page, "Import sources");
  await expectText(page, "Worker-backed source controls");
  await expectText(page, "Import from source");
  await expectText(page, "Run Queue Probe");
  await page.screenshot({
    path: path.join(outputDir, "admin-scraper.png"),
    fullPage: true,
  });
  summary.completedChecks.push("admin-scraper");
}

async function filterEpisodes(page, searchText) {
  await page.locator('input[aria-label="Search episodes"]').fill(searchText);
  await clickButton(page, "Apply filters");
  await expectCategoryCard(page, searchText);
}

async function filterCategories(page, searchText) {
  await page.locator('input[aria-label="Search categories"]').fill(searchText);
  await clickButton(page, "Apply filters");
  await expectCategoryCard(page, searchText);
}

async function expectCategoryCard(page, categoryName) {
  const normalized = categoryName.toLowerCase();
  await page.waitForFunction(
    (expected) => {
      const cards = Array.from(document.querySelectorAll("article"));
      return cards.some((node) => node.textContent?.toLowerCase().includes(expected));
    },
    { timeout: 15000 },
    normalized,
  );
}

function assertCleanClientState(stage) {
  const errors = [
    ...summary.consoleErrors.map((message) => `console: ${message}`),
    ...summary.pageErrors.map((message) => `pageerror: ${message}`),
    ...summary.failedRequests.map((message) => `requestfailed: ${message}`),
  ];
  if (errors.length === 0) return;
  throw new Error(`Client-side errors detected during ${stage}:\n${errors.join("\n")}`);
}

function writeSummary(payload) {
  fs.writeFileSync(summaryPath, JSON.stringify(payload, null, 2));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
