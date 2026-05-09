import {
  authenticateDirectRequest,
  hasDirectAccountAccess,
  loadDirectWatchlistHelpers,
} from "../../../lib/account-source";
import { jsonResponse, toApiErrorResponse } from "../../../lib/api-route";
import { proxyLegacyRequest } from "../../../lib/legacy-proxy";

export async function GET(request: Request) {
  if (!hasDirectAccountAccess()) {
    return proxyLegacyRequest(request, "/api/public/watchlist");
  }

  try {
    const user = await authenticateDirectRequest(request.headers);
    const { listWatchlistForUser } = await loadDirectWatchlistHelpers();
    const items = await listWatchlistForUser(user.id);
    return jsonResponse(
      { items },
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

export async function POST(request: Request) {
  if (!hasDirectAccountAccess()) {
    return proxyLegacyRequest(request, "/api/public/watchlist");
  }

  try {
    const user = await authenticateDirectRequest(request.headers);
    const { addWatchlistItemForUser, addWatchlistItemSchema } =
      await loadDirectWatchlistHelpers();
    const payload = addWatchlistItemSchema.parse(await request.json());
    const item = await addWatchlistItemForUser(user.id, payload);
    return jsonResponse(
      { item },
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
