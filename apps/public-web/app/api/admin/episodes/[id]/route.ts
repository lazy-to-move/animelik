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

export async function PATCH(request: Request, context: RouteContext) {
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
    const { adminEpisodeUpdateSchema, updateAdminEpisode } = await import(
      "../../../../../../../api/services/admin-episode-service"
    );
    const body = await request.json();
    const payload = adminEpisodeUpdateSchema.parse({
      id: Number.parseInt(id, 10),
      ...body,
    });
    const episode = await updateAdminEpisode(payload);
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
    const { adminEpisodeDeleteSchema, deleteAdminEpisodeById } = await import(
      "../../../../../../../api/services/admin-episode-service"
    );
    const payload = adminEpisodeDeleteSchema.parse({ id: parsedId });
    const result = await deleteAdminEpisodeById(payload.id);
    return jsonResponse(result, {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
