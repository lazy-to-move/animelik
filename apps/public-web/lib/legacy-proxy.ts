import { getLegacyApiServerBaseUrl } from "./api";

function copySetCookieHeaders(source: Headers, target: Headers) {
  const maybeGetSetCookie = source as Headers & {
    getSetCookie?: () => string[];
  };

  if (typeof maybeGetSetCookie.getSetCookie === "function") {
    for (const value of maybeGetSetCookie.getSetCookie()) {
      target.append("set-cookie", value);
    }
    return;
  }

  const singleValue = source.get("set-cookie");
  if (singleValue) {
    target.append("set-cookie", singleValue);
  }
}

export async function proxyLegacyRequest(
  request: Request,
  path: string,
  init?: Partial<RequestInit>,
) {
  const requestHeaders = new Headers(init?.headers);
  const incomingCookie = request.headers.get("cookie");
  const incomingContentType = request.headers.get("content-type");

  if (incomingCookie && !requestHeaders.has("cookie")) {
    requestHeaders.set("cookie", incomingCookie);
  }

  if (incomingContentType && !requestHeaders.has("content-type")) {
    requestHeaders.set("content-type", incomingContentType);
  }

  const method = init?.method ?? request.method;
  const body =
    method === "GET" || method === "HEAD"
      ? undefined
      : (init?.body as BodyInit | null | undefined) ?? (await request.text());

  const legacyResponse = await fetch(`${getLegacyApiServerBaseUrl()}${path}`, {
    method,
    headers: requestHeaders,
    body,
    cache: "no-store",
    redirect: "manual",
  });

  const responseHeaders = new Headers();
  const responseContentType = legacyResponse.headers.get("content-type");
  if (responseContentType) {
    responseHeaders.set("content-type", responseContentType);
  }
  responseHeaders.set(
    "cache-control",
    legacyResponse.headers.get("cache-control") ?? "no-store",
  );
  copySetCookieHeaders(legacyResponse.headers, responseHeaders);

  return new Response(await legacyResponse.text(), {
    status: legacyResponse.status,
    headers: responseHeaders,
  });
}
