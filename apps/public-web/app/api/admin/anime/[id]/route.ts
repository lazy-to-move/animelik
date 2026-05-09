import {
  authenticateDirectAdminRequest,
  hasDirectAdminAccess,
} from "../../../../../lib/admin-auth-source";
import { jsonResponse, toApiErrorResponse } from "../../../../../lib/api-route";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function DELETE(request: Request, context: RouteContext) {
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
    const { id } = await context.params;
    const parsedId = Number.parseInt(id, 10);
    const { adminAnimeDeleteSchema, deleteAdminAnimeById } = await import(
      "../../../../../../../api/services/admin-anime-service"
    );
    const payload = adminAnimeDeleteSchema.parse({ id: parsedId });
    const result = await deleteAdminAnimeById(payload.id);
    return jsonResponse(result, {
      headers: {
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
