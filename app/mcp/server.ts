import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerReadTools } from "./tools/reads";
import { registerWriteTools } from "./tools/writes";

/**
 * Creates a per-request MCP server instance bound to the authenticated userId.
 * Tools registered here receive `userId` via closure and must scope their
 * DB queries by it.
 *
 * Scope is enforced by what gets registered: a token without `mcp:write` never
 * sees the write tools listed, rather than discovering the refusal at call time.
 */
export function createMcpServer(userId: number, scopes: string[]): McpServer {
  const server = new McpServer(
    { name: "resume-builder", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );
  if (scopes.includes("mcp:read")) registerReadTools(server, userId);
  if (scopes.includes("mcp:write")) registerWriteTools(server, userId);
  return server;
}
