import {
  hasDirectAccountAccess,
  loadDirectAuthHelpers,
} from "../../../../lib/account-source";
import {
  appendHeaders,
  jsonHeaders,
  toApiErrorResponse,
} from "../../../../lib/api-route";
import { proxyLegacyRequest } from "../../../../lib/legacy-proxy";

export async function POST(request: Request) {
  if (!hasDirectAccountAccess()) {
    return proxyLegacyRequest(request, "/api/public/auth/sign-in");
  }

  try {
    const { authCredentialsSchema, signInWithCredentials } =
      await loadDirectAuthHelpers();
    const payload = authCredentialsSchema.parse(await request.json());
    const responseHeaders = new Headers({
      "cache-control": "no-store",
    });
    const user = await signInWithCredentials({
      reqHeaders: request.headers,
      resHeaders: responseHeaders,
      email: payload.email,
      password: payload.password,
    });

    const headers = jsonHeaders();
    appendHeaders(responseHeaders, headers);
    return new Response(JSON.stringify({ user }), {
      status: 200,
      headers,
    });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
