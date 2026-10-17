import {
  ClientRegistrationError,
  registerClient,
} from "~/lib/oauth.server";
import type { Route } from "./+types/oauth.register";

/**
 * Dynamic Client Registration (RFC 7591).
 *
 * This is what lets someone paste the server URL into Claude and connect without
 * any pre-arranged credentials: the client registers itself here, then runs the
 * normal authorization code flow.
 *
 * Unauthenticated by necessity — the client has no credential yet. The ceiling
 * on that is in `registerClient`: callbacks must be on a host we know or an
 * RFC 8252 loopback address, stale registrations are pruned, and the total is
 * capped. Registering a client grants nothing on its own; every token still
 * requires a signed-in user to approve it at /oauth/authorize.
 *
 * Body is `application/json` per RFC 7591 §3.1 — note that /oauth/token is
 * form-urlencoded, so the two endpoints do not share a parser.
 */
export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return errorResponse("invalid_request", "POST required.", 405);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("invalid_client_metadata", "Body must be JSON.");
  }
  if (typeof body !== "object" || body === null) {
    return errorResponse("invalid_client_metadata", "Body must be a JSON object.");
  }

  const meta = body as Record<string, unknown>;
  const redirectUris = Array.isArray(meta.redirect_uris)
    ? meta.redirect_uris.filter((u): u is string => typeof u === "string")
    : [];
  const clientName =
    typeof meta.client_name === "string" && meta.client_name.trim()
      ? meta.client_name.trim().slice(0, 200)
      : "Unnamed client";
  const authMethod =
    typeof meta.token_endpoint_auth_method === "string"
      ? meta.token_endpoint_auth_method
      : "none";

  try {
    const { client, clientSecret, createdAt } = registerClient({
      clientName,
      redirectUris,
      tokenEndpointAuthMethod: authMethod,
    });
    return Response.json(
      {
        client_id: client.clientId,
        ...(clientSecret ? { client_secret: clientSecret } : {}),
        client_id_issued_at: Math.floor(Date.parse(createdAt) / 1000),
        client_name: client.clientName,
        redirect_uris: client.redirectUris,
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        token_endpoint_auth_method: client.tokenEndpointAuthMethod,
      },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    if (err instanceof ClientRegistrationError) {
      return errorResponse(err.code, err.message, err.status);
    }
    console.error("[oauth/register] unexpected error", err);
    return errorResponse("invalid_client_metadata", "Registration failed.", 500);
  }
}

function errorResponse(code: string, description: string, status = 400) {
  return Response.json(
    { error: code, error_description: description },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}
