const publicConsumerRoutePatterns = [
  /^\/$/,
  /^\/browse$/,
  /^\/schedule$/,
  /^\/login$/,
  /^\/signup$/,
  /^\/watchlist$/,
  /^\/settings$/,
  /^\/privacy$/,
  /^\/terms$/,
  /^\/anime\/[^/]+\/?$/,
  /^\/watch\/[^/]+\/\d+\/?$/,
];

const legacyFrontendRoutePatterns = [
  ...publicConsumerRoutePatterns,
  /^\/admin$/,
];

function normalizeAbsoluteUrl(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  try {
    return new URL(trimmed).toString();
  } catch {
    return null;
  }
}

export function isPublicConsumerRoute(pathname: string): boolean {
  return publicConsumerRoutePatterns.some((pattern) => pattern.test(pathname));
}

export function isLegacyFrontendRoute(pathname: string): boolean {
  return legacyFrontendRoutePatterns.some((pattern) => pattern.test(pathname));
}

export function getConfiguredPublicWebUrl(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  return normalizeAbsoluteUrl(env.PUBLIC_WEB_URL);
}

export function buildPublicWebRedirectTarget(
  requestUrl: string,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const publicWebUrl = getConfiguredPublicWebUrl(env);
  if (!publicWebUrl) return null;

  const request = new URL(requestUrl);
  if (!isPublicConsumerRoute(request.pathname)) {
    return null;
  }

  const target = new URL(
    `${request.pathname}${request.search}${request.hash}`,
    publicWebUrl,
  );
  return target.toString();
}

export function getPreferredPublicSiteOrigin(
  requestUrl: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const publicWebUrl = getConfiguredPublicWebUrl(env);
  if (publicWebUrl) {
    return new URL(publicWebUrl).origin;
  }

  const siteUrl = normalizeAbsoluteUrl(env.SITE_URL);
  if (siteUrl) {
    return new URL(siteUrl).origin;
  }

  return new URL(requestUrl).origin;
}
