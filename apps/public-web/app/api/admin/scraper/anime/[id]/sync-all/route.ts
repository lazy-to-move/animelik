import {
  authenticateDirectAdminRequest,
  hasDirectAdminAccess,
} from "../../../../../../../lib/admin-auth-source";
import { loadDirectAdminScraperHelpers } from "../../../../../../../lib/admin-scraper-source";
import { jsonResponse, toApiErrorResponse } from "../../../../../../../lib/api-route";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
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
    const { animeAdminActionSchema, syncAllEpisodesForAdmin } =
      await loadDirectAdminScraperHelpers();
    const params = await context.params;
    const payload = animeAdminActionSchema.parse({
      animeId: Number.parseInt(params.id, 10),
    });
    const result = await syncAllEpisodesForAdmin({
      userId: user.id,
      animeId: payload.animeId,
    });

    return jsonResponse(result, {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
