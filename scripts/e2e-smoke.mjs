import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer";

const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const adminEmail = process.env.E2E_ADMIN_EMAIL ?? "";
const adminPassword = process.env.E2E_ADMIN_PASSWORD ?? "";
const outputDir = path.resolve("test-artifacts", "e2e-smoke");
const summaryPath = path.join(outputDir, "summary.json");
const state = {
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
  attachDiagnostics(page, state);

  await verifyPublicRoutes(page);
  await verifySignUpValidation(page);
  await signUpFreshUser(page);
  await verifyAuthenticatedSettings(page);
  await verifyWatchlistFlow(page);
  await verifyResponsiveWidths(page);

  if (adminEmail && adminPassword) {
    await verifyAdminLogin(browser, adminEmail, adminPassword);
  }

  await assertCleanClientState("final");
  writeSummary({ success: true, ...state });
  console.log(JSON.stringify({ success: true, checks: state.completedChecks }, null, 2));
} catch (error) {
  writeSummary({
    success: false,
    error: error instanceof Error ? error.message : String(error),
    ...state,
  });
  throw error;
} finally {
  await browser.close();
}

async function verifyPublicRoutes(page) {
  await goto(page, "/");
  await expectText(page, "Synx");
  state.completedChecks.push("home");

  await goto(page, "/privacy");
  await expectText(page, "Privacy Policy");
  state.completedChecks.push("privacy");

  await goto(page, "/terms");
  await expectText(page, "Terms of Service");
  state.completedChecks.push("terms");
}

async function verifySignUpValidation(page) {
  await goto(page, "/signup");
  await fillInput(page, "Display name", "Smoke Audit");
  await fillInput(page, "Email address", `short-pass-${Date.now()}@synx.local`);
  await fillInput(page, "Password", "short");
  await clickButton(page, "Create Account");
  await expectText(page, "Use at least 8 characters for your password.");
  state.completedChecks.push("signup-validation");
}

async function signUpFreshUser(page) {
  await goto(page, "/signup");

  const email = `smoke-${Date.now()}@synx.local`;
  const password = "SmokePass!12345";

  await fillInput(page, "Display name", "Smoke Runner");
  await fillInput(page, "Email address", email);
  await fillInput(page, "Password", password);
  await clickButton(page, "Create Account");
  await waitForPath(page, "/");
  await expectText(page, "Synx");
  state.completedChecks.push("signup-success");
}

async function verifyAuthenticatedSettings(page) {
  await goto(page, "/settings");
  await expectText(page, "Settings");
  await expectText(page, "Account Center");
  state.completedChecks.push("settings-authenticated");
}

async function verifyWatchlistFlow(page) {
  await goto(page, "/");

  const animePath = await page.evaluate(() => {
    const link = document.querySelector('a[href^="/anime/"]');
    return link?.getAttribute("href") ?? "";
  });

  if (!animePath) {
    throw new Error("Could not find an anime detail link on the home page.");
  }

  await goto(page, animePath);
  await clickButton(page, "Add to Watchlist");
  await expectText(page, "In Watchlist");

  await goto(page, "/watchlist");
  await expectText(page, "Watchlist");
  state.completedChecks.push("watchlist-add");
}

async function verifyResponsiveWidths(page) {
  const routes = ["/", "/privacy", "/terms", "/settings"];
  const viewports = [
    { width: 390, height: 844, label: "mobile" },
    { width: 768, height: 1024, label: "tablet" },
  ];

  for (const viewport of viewports) {
    await page.setViewport({
      width: viewport.width,
      height: viewport.height,
      deviceScaleFactor: 1,
    });

    for (const route of routes) {
      await goto(page, route);

      const overflow = await page.evaluate(() => {
        const doc = document.documentElement;
        return Math.max(doc.scrollWidth, document.body.scrollWidth) - window.innerWidth;
      });

      if (overflow > 2) {
        const filename = screenshotName(`${viewport.label}-${routeToName(route)}-overflow`);
        await page.screenshot({ path: path.join(outputDir, filename), fullPage: true });
        throw new Error(`Horizontal overflow detected on ${route} at ${viewport.label}: ${overflow}px`);
      }
    }
  }

  await page.setViewport({ width: 1440, height: 960, deviceScaleFactor: 1 });
  state.completedChecks.push("responsive-widths");
}

async function verifyAdminLogin(browser, email, password) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  attachDiagnostics(page, state);

  await goto(page, "/login");
  await fillInput(page, "Email address", email);
  await fillInput(page, "Password", password);
  await clickButton(page, "Sign In");
  await waitForPath(page, "/");

  await goto(page, "/admin");
  await expectText(page, "Dashboard");
  state.completedChecks.push("admin-login");
  await context.close();
}

function attachDiagnostics(page, state) {
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    state.consoleErrors.push(message.text());
  });

  page.on("pageerror", (error) => {
    state.pageErrors.push(error.message);
  });

  page.on("requestfailed", (request) => {
    const url = request.url();
    if (!url.startsWith(baseUrl)) return;
    state.failedRequests.push(`${request.method()} ${url} :: ${request.failure()?.errorText ?? "unknown"}`);
  });
}

async function goto(page, pathname) {
  await page.goto(`${baseUrl}${pathname}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction(() => document.readyState === "interactive" || document.readyState === "complete");
  await page.waitForSelector("body");
  await page.evaluate(() => new Promise((resolve) => window.requestAnimationFrame(() => resolve())));
  await sleep(300);
  await assertCleanClientState(pathname);
}

async function fillInput(page, label, value) {
  const selectors = [
    `input[placeholder="${cssEscape(value)}"]`,
    `input[autocomplete]`,
  ];
  void selectors;

  const handle = await page.evaluateHandle((targetLabel) => {
    const labels = Array.from(document.querySelectorAll("label"));
    const label = labels.find((node) => node.textContent?.includes(targetLabel));
    return label?.querySelector("input") ?? null;
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

    const formMatches = matches.filter((node) => node.closest("form"));
    return formMatches[formMatches.length - 1] ?? matches[matches.length - 1] ?? null;
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

async function assertCleanClientState(stage) {
  const errors = [
    ...state.consoleErrors.map((message) => `console: ${message}`),
    ...state.pageErrors.map((message) => `pageerror: ${message}`),
    ...state.failedRequests.map((message) => `requestfailed: ${message}`),
  ];

  if (errors.length === 0) return;

  throw new Error(`Client-side errors detected during ${stage}:\n${errors.join("\n")}`);
}

function screenshotName(name) {
  return `${name.replace(/[^a-z0-9-]+/gi, "-").toLowerCase()}.png`;
}

function routeToName(route) {
  return route === "/" ? "home" : route.replace(/^\/+/, "").replace(/\//g, "-");
}

function writeSummary(summary) {
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
}

function cssEscape(value) {
  return value.replace(/["\\]/g, "\\$&");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
