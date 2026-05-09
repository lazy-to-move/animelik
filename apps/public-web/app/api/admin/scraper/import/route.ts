import {
  authenticateDirectAdminRequest,
  hasDirectAdminAccess,
} from "../../../../../lib/admin-auth-source";
import { loadDirectAdminScraperHelpers } from "../../../../../lib/admin-scraper-source";
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
    const { importFromSourceAdminSchema, importFromSourceForAdmin } =
      await loadDirectAdminScraperHelpers();
    const payload = importFromSourceAdminSchema.parse(await request.json());
    const result = await importFromSourceForAdmin({
      userId: user.id,
      source: payload.source,
      slug: payload.slug,
      importEpisodes: payload.importEpisodes,
    });

    return jsonResponse(result, {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
