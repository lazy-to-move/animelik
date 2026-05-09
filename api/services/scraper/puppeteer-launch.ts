import type { LaunchOptions } from "puppeteer";

const DEFAULT_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-blink-features=AutomationControlled",
  "--disable-web-security",
  "--disable-features=IsolateOrigins,site-per-process",
  "--window-size=1920,1080",
];

export function getPuppeteerLaunchOptions(extraArgs: string[] = []): LaunchOptions {
  const configuredExecutablePath = process.env.PUPPETEER_EXECUTABLE_PATH?.trim();

  return {
    headless: true,
    executablePath: configuredExecutablePath || undefined,
    args: [...DEFAULT_ARGS, ...extraArgs],
  };
}
