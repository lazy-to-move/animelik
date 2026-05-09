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
    await authenticateDirectAdminRequest(request.headers);
    const { adminEpisodeBulkDeleteSchema, deleteAdminEpisodeByIds } = await import(
      "../../../../../../../api/services/admin-episode-service"
    );
    const payload = adminEpisodeBulkDeleteSchema.parse(await request.json());
    const result = await deleteAdminEpisodeByIds(payload.ids);
    return jsonResponse(result, {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
