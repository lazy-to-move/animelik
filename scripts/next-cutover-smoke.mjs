import fs from "node:fs";
import path from "node:path";

const legacyBaseUrl = process.env.LEGACY_BASE_URL ?? "http://127.0.0.1:3100";
const publicBaseUrl = process.env.NEXT_BASE_URL ?? "http://127.0.0.1:3101";
const slug = process.env.CUTOVER_SMOKE_SLUG ?? "video-229";
const outputDir = path.resolve("test-artifacts", "next-cutover-smoke");
const summaryPath = path.join(outputDir, "summary.json");

fs.mkdirSync(outputDir, { recursive: true });

const summary = {
  legacyBaseUrl,
  publicBaseUrl,
  slug,
  completedChecks: [],
};

try {
  await expectRedirect("/browse", `${publicBaseUrl}/browse`);
  await expectRedirect(
    `/anime/${slug}?from=cutover`,
    `${publicBaseUrl}/anime/${slug}?from=cutover`,
  );
  await expectRedirectFollow("/browse", "Browse");
  await expectAdminStaysOnLegacy();
  await expectApiStillWorks();
  await expectSeoPointsToPublicWeb();

  writeSummary({ success: true, ...summary });
  console.log(
    JSON.stringify(
      {
        success: true,
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
}

async function expectRedirect(pathname, expectedLocation) {
  const response = await fetch(`${legacyBaseUrl}${pathname}`, {
    headers: {
      accept: "text/html",
    },
    redirect: "manual",
  });

  if (response.status !== 307) {
    throw new Error(
      `Expected 307 redirect for ${pathname}, received ${response.status}.`,
    );
  }

  const location = response.headers.get("location");
  if (location !== expectedLocation) {
    throw new Error(
      `Expected redirect for ${pathname} to be ${expectedLocation}, received ${location}.`,
    );
  }

  summary.completedChecks.push(`redirect:${pathname}`);
}

async function expectRedirectFollow(pathname, expectedText) {
  const response = await fetch(`${legacyBaseUrl}${pathname}`, {
    headers: {
      accept: "text/html",
    },
    redirect: "follow",
  });

  if (response.status !== 200) {
    throw new Error(
      `Expected followed redirect for ${pathname} to return 200, received ${response.status}.`,
    );
  }

  if (!response.url.startsWith(publicBaseUrl)) {
    throw new Error(
      `Expected followed redirect for ${pathname} to land on ${publicBaseUrl}, received ${response.url}.`,
    );
  }

  const html = await response.text();
  if (!html.toLowerCase().includes(expectedText.toLowerCase())) {
    throw new Error(
      `Expected followed redirect for ${pathname} to include "${expectedText}".`,
    );
  }

  summary.completedChecks.push(`redirect-follow:${pathname}`);
}

async function expectAdminStaysOnLegacy() {
  const response = await fetch(`${legacyBaseUrl}/admin`, {
    headers: {
      accept: "text/html",
    },
    redirect: "manual",
  });

  if (response.status !== 200) {
    throw new Error(
      `Expected legacy /admin to remain on the backend, received ${response.status}.`,
    );
  }

  if (response.headers.get("location")) {
    throw new Error("Legacy /admin unexpectedly redirected during cutover.");
  }

  summary.completedChecks.push("legacy-admin");
}

async function expectApiStillWorks() {
  const response = await fetch(`${legacyBaseUrl}/healthz`);
  if (response.status !== 200) {
    throw new Error(`/healthz returned ${response.status}.`);
  }

  const health = await response.json();
  if (!health.ok) {
    throw new Error("/healthz reported an unhealthy backend during cutover smoke.");
  }

  const apiResponse = await fetch(`${legacyBaseUrl}/api/public/home`);
  if (apiResponse.status !== 200) {
    throw new Error(`/api/public/home returned ${apiResponse.status}.`);
  }

  summary.completedChecks.push("legacy-api");
}

async function expectSeoPointsToPublicWeb() {
  const robots = await fetch(`${legacyBaseUrl}/robots.txt`).then((response) =>
    response.text(),
  );
  if (!robots.includes(`${publicBaseUrl}/sitemap.xml`)) {
    throw new Error("robots.txt did not point to the public-web sitemap.");
  }

  const sitemap = await fetch(`${legacyBaseUrl}/sitemap.xml`).then((response) =>
    response.text(),
  );
  if (!sitemap.includes(`${publicBaseUrl}/browse`)) {
    throw new Error("sitemap.xml did not emit public-web URLs.");
  }

  summary.completedChecks.push("seo-origin");
}

function writeSummary(payload) {
  fs.writeFileSync(summaryPath, JSON.stringify(payload, null, 2));
}
