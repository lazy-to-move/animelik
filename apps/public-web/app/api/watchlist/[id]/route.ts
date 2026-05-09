import {
  authenticateDirectRequest,
  hasDirectAccountAccess,
  loadDirectWatchlistHelpers,
} from "../../../../lib/account-source";
import { jsonResponse, toApiErrorResponse } from "../../../../lib/api-route";
import { proxyLegacyRequest } from "../../../../lib/legacy-proxy";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!hasDirectAccountAccess()) {
    return proxyLegacyRequest(
      request,
      `/api/public/watchlist/${encodeURIComponent(id)}`,
    );
  }

  try {
    const user = await authenticateDirectRequest(request.headers);
    const { updateWatchlistItemForUser, updateWatchlistItemSchema } =
      await loadDirectWatchlistHelpers();
    const body =
      request.headers.get("content-length") === "0"
        ? {}
        : await request.json().catch(() => ({}));
    const payload = updateWatchlistItemSchema.parse({
      ...body,
      id: Number.parseInt(id, 10),
    });
    const item = await updateWatchlistItemForUser(user.id, payload);
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

export async function DELETE(request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!hasDirectAccountAccess()) {
    return proxyLegacyRequest(
      request,
      `/api/public/watchlist/${encodeURIComponent(id)}`,
    );
  }

  try {
    const user = await authenticateDirectRequest(request.headers);
    const { removeWatchlistItemForUser } = await loadDirectWatchlistHelpers();
    const payload = await removeWatchlistItemForUser(
      user.id,
      Number.parseInt(id, 10),
    );
    return jsonResponse(
      payload,
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
