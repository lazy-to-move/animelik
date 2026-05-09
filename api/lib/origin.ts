import { TRPCError } from "@trpc/server";

function safeOrigin(url: string | null | undefined): string | null {
  if (!url) return null;

  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function getTrustedRequestOrigins(req: Request, siteUrl?: string): string[] {
  const origins = new Set<string>();
  const requestOrigin = safeOrigin(req.url);
  const configuredOrigin = safeOrigin(siteUrl);

  if (requestOrigin) origins.add(requestOrigin);
  if (configuredOrigin) origins.add(configuredOrigin);

  return [...origins];
}

export function getSourceRequestOrigin(req: Request): string | null {
  return safeOrigin(req.headers.get("origin")) ?? safeOrigin(req.headers.get("referer"));
}

export function isTrustedMutationOrigin(req: Request, siteUrl?: string): boolean {
  const method = req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return true;
  }

  if (!req.headers.get("cookie")) {
    return true;
  }

  const sourceOrigin = getSourceRequestOrigin(req);
  if (!sourceOrigin) {
    return false;
  }

  return getTrustedRequestOrigins(req, siteUrl).includes(sourceOrigin);
}

export function enforceTrustedMutationOrigin(req: Request, siteUrl?: string): void {
  if (isTrustedMutationOrigin(req, siteUrl)) return;

  throw new TRPCError({
    code: "FORBIDDEN",
    message: "Untrusted request origin.",
  });
}
