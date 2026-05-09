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
    const { updateAdminCategory, adminCategoryUpdateSchema } = await import(
      "../../../../../../../api/services/admin-category-service"
    );
    const body = await request.json();
    const payload = adminCategoryUpdateSchema.parse({
      id: Number.parseInt(id, 10),
      ...body,
    });
    const category = await updateAdminCategory(payload);
    return jsonResponse(
      { category },
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
    const { adminCategoryDeleteSchema, deleteAdminCategoryById } = await import(
      "../../../../../../../api/services/admin-category-service"
    );
    const payload = adminCategoryDeleteSchema.parse({ id: parsedId });
    const result = await deleteAdminCategoryById(payload.id);
    return jsonResponse(result, {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
