import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerReadTools } from "./tools/reads";
import { registerWriteTools } from "./tools/writes";

/**
 * Creates a per-request MCP server instance bound to the authenticated userId.
 * Tools registered here receive `userId` via closure and must scope their
 * DB queries by it.
 */
export function createMcpServer(userId: number): McpServer {
  const server = new McpServer(
    { name: "resume-builder", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );
  registerReadTools(server, userId);
  registerWriteTools(server, userId);
  return server;
}
