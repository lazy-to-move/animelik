import {
  authenticateDirectRequest,
  hasDirectAccountAccess,
  loadDirectBrokenEpisodeHelpers,
} from "../../../../../lib/interaction-source";
import { jsonResponse, toApiErrorResponse } from "../../../../../lib/api-route";
import { proxyLegacyRequest } from "../../../../../lib/legacy-proxy";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!hasDirectAccountAccess()) {
    return proxyLegacyRequest(
      request,
      `/api/public/episodes/${encodeURIComponent(id)}/broken-report-status`,
    );
  }

  try {
    const user = await authenticateDirectRequest(request.headers);
    const { getBrokenEpisodeReportStatusForUser } =
      await loadDirectBrokenEpisodeHelpers();
    const payload = await getBrokenEpisodeReportStatusForUser(
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
