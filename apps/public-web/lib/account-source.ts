import type { PublicSessionUser, PublicWatchlistItem } from "./api";

export function hasDirectAccountAccess() {
  return Boolean(
    process.env.DATABASE_URL && process.env.APP_SECRET && process.env.APP_ID,
  );
}

export function getAccountAccessMode() {
  return hasDirectAccountAccess() ? "direct-db-auth" : "legacy-http";
}

async function loadAuthModule() {
  return import("../../../api/services/auth-service");
}

async function loadSessionModule() {
  return import("../../../api/session-auth");
}

async function loadWatchlistModule() {
  return import("../../../api/services/watchlist-service");
}

export async function getDirectSessionUserFromHeaders(
  headers: Headers,
): Promise<PublicSessionUser | null> {
  const { getSessionUser } = await loadAuthModule();
  return getSessionUser(headers);
}

export async function authenticateDirectRequest(headers: Headers) {
  const { authenticateRequest } = await loadSessionModule();
  return authenticateRequest(headers);
}

export async function getDirectWatchlistForUser(
  userId: number,
): Promise<PublicWatchlistItem[]> {
  const { listWatchlistForUser } = await loadWatchlistModule();
  return listWatchlistForUser(userId);
}

export async function loadDirectAuthHelpers() {
  return loadAuthModule();
}

export async function loadDirectWatchlistHelpers() {
  return loadWatchlistModule();
}
