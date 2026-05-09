import {
  authenticateDirectAdminRequest,
  hasDirectAdminAccess,
} from "../../../../../lib/admin-auth-source";
import { jsonResponse, toApiErrorResponse } from "../../../../../lib/api-route";

export async function GET(request: Request) {
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
    const { searchSourceQuerySchema, searchAnimeFromSource } = await import(
      "../../../../../../../api/services/admin-scraper-read-service"
    );
    const url = new URL(request.url);
    const payload = searchSourceQuerySchema.parse({
      source: url.searchParams.get("source") ?? undefined,
      query: url.searchParams.get("query") ?? undefined,
    });
    const result = await searchAnimeFromSource(payload);

    return jsonResponse(result, {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
