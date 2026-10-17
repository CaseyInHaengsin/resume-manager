import {
  OFFLINE_ACCESS_SCOPE,
  SUPPORTED_SCOPES,
  getPublicUrl,
} from "~/lib/oauth.server";

/**
 * OAuth 2.0 Authorization Server Metadata (RFC 8414).
 *
 * `issuer` must be identical to the origin this document was fetched from —
 * clients reject the document otherwise — so it comes from PUBLIC_URL.
 *
 * Note what is *not* here: `client_id_metadata_document_supported`. Claude picks
 * CIMD over DCR when that flag and `"none"` auth are both advertised, and we
 * implement DCR, not CIMD.
 */
export function loader() {
  const issuer = getPublicUrl();
  return Response.json(
    {
      issuer,
      authorization_endpoint: `${issuer}/oauth/authorize`,
      token_endpoint: `${issuer}/oauth/token`,
      registration_endpoint: `${issuer}/oauth/register`,
      // `offline_access` is listed here and only here: advertising it is what
      // prompts Claude to ask for a refresh token.
      scopes_supported: [...SUPPORTED_SCOPES, OFFLINE_ACCESS_SCOPE],
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: [
        "none",
        "client_secret_post",
        "client_secret_basic",
      ],
      authorization_response_iss_parameter_supported: true,
    },
    {
      headers: {
        "Cache-Control": "public, max-age=300",
        "Access-Control-Allow-Origin": "*",
      },
    },
  );
}
