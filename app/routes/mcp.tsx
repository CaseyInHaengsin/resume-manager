import { createMcpServer } from "~/mcp/server";
import { handleMcpHttp } from "~/mcp/transport";
import {
  McpUnauthorizedError,
  requireMcpAuth,
} from "~/lib/mcp-auth.server";
import {
  SUPPORTED_SCOPES,
  getProtectedResourceMetadataUrl,
} from "~/lib/oauth.server";
import type { Route } from "./+types/mcp";

function jsonRpcErrorResponse(
  status: number,
  code: number,
  message: string,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      error: { code, message },
      id: null,
    }),
    {
      status,
      headers: { "Content-Type": "application/json", ...extraHeaders },
    },
  );
}

/**
 * The challenge that starts the whole OAuth flow. A client with no usable
 * credential reads `resource_metadata` from here to find the protected resource
 * metadata document, and from there the authorization server.
 *
 * This must be sent on a 401 — Claude ignores `WWW-Authenticate` on a 200 — and
 * without it a client falls back to probing well-known paths, which costs
 * round-trips and fails outright on hosts that can't serve `/.well-known/*`.
 */
function challengeHeader(): string {
  return (
    `Bearer resource_metadata="${getProtectedResourceMetadataUrl()}", ` +
    `scope="${SUPPORTED_SCOPES.join(" ")}"`
  );
}

async function handle(request: Request): Promise<Response> {
  let auth;
  try {
    auth = await requireMcpAuth(request);
  } catch (err) {
    if (err instanceof McpUnauthorizedError) {
      return jsonRpcErrorResponse(401, -32001, "Unauthorized", {
        "WWW-Authenticate": challengeHeader(),
      });
    }
    throw err;
  }
  try {
    const server = createMcpServer(auth.userId, auth.scopes);
    return await handleMcpHttp(request, server);
  } catch (err) {
    console.error("[mcp] internal error", err);
    return jsonRpcErrorResponse(500, -32603, "Internal error");
  }
}

export async function loader({ request }: Route.LoaderArgs): Promise<Response> {
  return handle(request);
}

export async function action({ request }: Route.ActionArgs): Promise<Response> {
  return handle(request);
}
