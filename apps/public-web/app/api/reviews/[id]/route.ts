import {
  authenticateDirectRequest,
  hasDirectAccountAccess,
  loadDirectReviewHelpers,
} from "../../../../lib/interaction-source";
import { jsonResponse, toApiErrorResponse } from "../../../../lib/api-route";
import { proxyLegacyRequest } from "../../../../lib/legacy-proxy";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function DELETE(request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!hasDirectAccountAccess()) {
    return proxyLegacyRequest(
      request,
      `/api/public/reviews/${encodeURIComponent(id)}`,
    );
  }

  try {
    const user = await authenticateDirectRequest(request.headers);
    const { deleteReviewForUser } = await loadDirectReviewHelpers();
    const payload = await deleteReviewForUser({
      reviewId: Number.parseInt(id, 10),
      userId: user.id,
      isAdmin: user.role === "admin",
    });
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
