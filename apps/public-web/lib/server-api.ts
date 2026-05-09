import { cache } from "react";
import { cookies } from "next/headers";
import type { PublicSessionUser, PublicWatchlistItem } from "./api";
import {
  getDirectSessionUserFromHeaders,
  getDirectWatchlistForUser,
  hasDirectAccountAccess,
} from "./account-source";
import { getLegacyApiServerBaseUrl } from "./api";

async function getCookieHeader() {
  const cookieStore = await cookies();
  return cookieStore.toString();
}

async function fetchLegacyServerJson<T>(
  path: string,
  init?: RequestInit & { allowUnauthorized?: boolean },
) {
  const headers = new Headers(init?.headers);
  const cookieHeader = await getCookieHeader();
  if (cookieHeader) {
    headers.set("cookie", cookieHeader);
  }

  const response = await fetch(`${getLegacyApiServerBaseUrl()}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  if (init?.allowUnauthorized && response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error(
      `Legacy API request failed for ${path}: ${response.status}`,
    );
  }

  return (await response.json()) as T;
}

const getCurrentSessionCached = cache(async () => {
  if (hasDirectAccountAccess()) {
    const headers = new Headers();
    const cookieHeader = await getCookieHeader();
    if (cookieHeader) {
      headers.set("cookie", cookieHeader);
    }
    return getDirectSessionUserFromHeaders(headers);
  }

  const response = await fetchLegacyServerJson<{ user: PublicSessionUser | null }>(
    "/api/public/session",
    { allowUnauthorized: true },
  );
  return response?.user ?? null;
});

const getCurrentWatchlistCached = cache(async () => {
  if (hasDirectAccountAccess()) {
    const headers = new Headers();
    const cookieHeader = await getCookieHeader();
    if (cookieHeader) {
      headers.set("cookie", cookieHeader);
    }

    const user = await getDirectSessionUserFromHeaders(headers);
    if (!user) {
      return null;
    }

    return getDirectWatchlistForUser(user.id);
  }

  const response = await fetchLegacyServerJson<{
    items: PublicWatchlistItem[];
  }>("/api/public/watchlist", {
    allowUnauthorized: true,
  });
  return response?.items ?? null;
});

export function getCurrentSession() {
  return getCurrentSessionCached();
}

export function getCurrentWatchlist() {
  return getCurrentWatchlistCached();
}
