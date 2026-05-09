import {
  authenticateDirectAdminRequest,
  hasDirectAdminAccess,
} from "../../../../lib/admin-auth-source";
import { jsonResponse, toApiErrorResponse } from "../../../../lib/api-route";

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
    const { adminEpisodeCreateSchema, createAdminEpisode } = await import(
      "../../../../../../api/services/admin-episode-service"
    );
    const payload = adminEpisodeCreateSchema.parse(await request.json());
    const episode = await createAdminEpisode(payload);
    return jsonResponse(
      { episode },
      {
        headers: { "cache-control": "no-store" },
      },
    );
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
