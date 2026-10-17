import {
  SUPPORTED_SCOPES,
  getPublicUrl,
  getResourceUrl,
} from "~/lib/oauth.server";

/**
 * OAuth 2.0 Protected Resource Metadata (RFC 9728).
 *
 * Mounted twice — at `/.well-known/oauth-protected-resource` and at
 * `/.well-known/oauth-protected-resource/*` — because a client that doesn't get
 * a `resource_metadata` pointer from our 401 probes the path-inserted form
 * (`…/oauth-protected-resource/mcp`) first and the bare form second.
 *
 * `resource` has to match the URL the user typed into their client byte for
 * byte, which is why it comes from PUBLIC_URL rather than the request.
 */
export function loader() {
  return Response.json(
    {
      resource: getResourceUrl(),
      authorization_servers: [getPublicUrl()],
      // Deliberately no `offline_access`: refresh is not a requirement of the
      // resource, and the MCP spec says a protected resource SHOULD NOT list it.
      scopes_supported: SUPPORTED_SCOPES,
      bearer_methods_supported: ["header"],
      resource_name: "Resume Builder",
      resource_documentation: `${getPublicUrl()}/settings`,
    },
    {
      headers: {
        "Cache-Control": "public, max-age=300",
        "Access-Control-Allow-Origin": "*",
      },
    },
  );
}
