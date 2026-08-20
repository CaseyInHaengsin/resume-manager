import { createMcpServer } from "~/mcp/server";
import { handleMcpHttp } from "~/mcp/transport";
import {
  McpUnauthorizedError,
  requireMcpUserId,
} from "~/lib/mcp-auth.server";
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

async function handle(request: Request): Promise<Response> {
  let userId: number;
  try {
    userId = await requireMcpUserId(request);
  } catch (err) {
    if (err instanceof McpUnauthorizedError) {
      return jsonRpcErrorResponse(401, -32001, "Unauthorized", {
        "WWW-Authenticate": 'Bearer realm="mcp"',
      });
    }
    throw err;
  }
  try {
    const server = createMcpServer(userId);
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
