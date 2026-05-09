import {
  hasDirectAccountAccess,
  loadDirectAuthHelpers,
} from "../../../../lib/account-source";
import {
  appendHeaders,
  jsonHeaders,
  toApiErrorResponse,
} from "../../../../lib/api-route";
import { proxyLegacyRequest } from "../../../../lib/legacy-proxy";

export async function POST(request: Request) {
  if (!hasDirectAccountAccess()) {
    return proxyLegacyRequest(request, "/api/public/auth/logout");
  }

  try {
    const { logoutSession } = await loadDirectAuthHelpers();
    const responseHeaders = new Headers({
      "cache-control": "no-store",
    });
    const payload = logoutSession({
      reqHeaders: request.headers,
      resHeaders: responseHeaders,
    });

    const headers = jsonHeaders();
    appendHeaders(responseHeaders, headers);
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers,
    });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
