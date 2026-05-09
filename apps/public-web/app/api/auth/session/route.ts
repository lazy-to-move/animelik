import {
  getDirectSessionUserFromHeaders,
  hasDirectAccountAccess,
} from "../../../../lib/account-source";
import { jsonResponse, toApiErrorResponse } from "../../../../lib/api-route";
import { proxyLegacyRequest } from "../../../../lib/legacy-proxy";

export async function GET(request: Request) {
  if (!hasDirectAccountAccess()) {
    return proxyLegacyRequest(request, "/api/public/session");
  }

  try {
    const user = await getDirectSessionUserFromHeaders(request.headers);
    return jsonResponse(
      { user },
      {
        headers: {
          "cache-control": "no-store",
        },
      },
    );
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
