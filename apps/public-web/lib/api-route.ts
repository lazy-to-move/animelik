import { ZodError } from "zod";
import { isHttpError } from "../../../api/lib/http-error";

type JsonHeaderInput = Headers | Record<string, string> | Array<[string, string]>;

type AppErrorLike = {
  tag: "app_error";
  status: number;
  message: string;
};

function isAppErrorLike(error: unknown): error is AppErrorLike {
  return (
    typeof error === "object" &&
    error !== null &&
    "tag" in error &&
    "status" in error &&
    "message" in error &&
    (error as { tag?: unknown }).tag === "app_error" &&
    typeof (error as { status?: unknown }).status === "number" &&
    typeof (error as { message?: unknown }).message === "string"
  );
}

export function jsonHeaders(extra?: JsonHeaderInput) {
  const headers = new Headers(extra);
  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json; charset=utf-8");
  }
  return headers;
}

export function jsonResponse(
  payload: unknown,
  init?: {
    status?: number;
    headers?: JsonHeaderInput;
  },
) {
  return new Response(JSON.stringify(payload), {
    status: init?.status ?? 200,
    headers: jsonHeaders(init?.headers),
  });
}

export function appendHeaders(source: Headers, target: Headers) {
  const maybeGetSetCookie = source as Headers & {
    getSetCookie?: () => string[];
  };

  if (typeof maybeGetSetCookie.getSetCookie === "function") {
    for (const value of maybeGetSetCookie.getSetCookie()) {
      target.append("set-cookie", value);
    }
  } else {
    const setCookie = source.get("set-cookie");
    if (setCookie) {
      target.append("set-cookie", setCookie);
    }
  }

  for (const [key, value] of source.entries()) {
    if (key.toLowerCase() === "set-cookie") continue;
    target.set(key, value);
  }
}

export function toApiErrorResponse(error: unknown) {
  let status = 500;
  let message = "Internal server error.";

  if (error instanceof ZodError) {
    status = 400;
    message = error.issues[0]?.message ?? "Invalid request.";
  } else if (isHttpError(error)) {
    status = error.status;
    message = error.message;
  } else if (isAppErrorLike(error)) {
    status = error.status;
    message = error.message;
  } else if (error instanceof Error && error.message) {
    message = error.message;
  }

  return jsonResponse(
    { error: message },
    {
      status,
      headers: {
        "cache-control": "no-store",
      },
    },
  );
}
