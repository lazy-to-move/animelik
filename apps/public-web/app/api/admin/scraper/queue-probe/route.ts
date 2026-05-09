import {
  authenticateDirectAdminRequest,
  hasDirectAdminAccess,
} from "../../../../../lib/admin-auth-source";
import { jsonResponse, toApiErrorResponse } from "../../../../../lib/api-route";

export async function POST(request: Request) {
  if (!hasDirectAdminAccess()) {
    return jsonResponse(
      { error: "Direct admin mode is not configured for the Next admin tools." },
      {
        status: 503,
        headers: { "cache-control": "no-store" },
      },
    );
  }

  try {
    const user = await authenticateDirectAdminRequest(request.headers);
    const { queueProbeAdminSchema, runQueueProbeForAdmin } = await import(
      "../../../../../../../api/services/admin-scraper-queue-service"
    );
    const body =
      request.headers.get("content-length") === "0"
        ? {}
        : await request.json().catch(() => ({}));
    const payload = queueProbeAdminSchema.parse(body);
    const result = await runQueueProbeForAdmin({
      userId: user.id,
      probeId: payload.probeId,
    });

    return jsonResponse(result, {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
