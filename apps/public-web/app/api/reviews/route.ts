import {
  authenticateDirectRequest,
  hasDirectAccountAccess,
  loadDirectReviewHelpers,
} from "../../../lib/interaction-source";
import { jsonResponse, toApiErrorResponse } from "../../../lib/api-route";
import { proxyLegacyRequest } from "../../../lib/legacy-proxy";

export async function POST(request: Request) {
  if (!hasDirectAccountAccess()) {
    return proxyLegacyRequest(request, "/api/public/reviews");
  }

  try {
    const user = await authenticateDirectRequest(request.headers);
    const { createOrUpdateReviewForUser, createReviewSchema } =
      await loadDirectReviewHelpers();
    const payload = createReviewSchema.parse(await request.json());
    const review = await createOrUpdateReviewForUser(user.id, payload);
    return jsonResponse(
      { review },
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
