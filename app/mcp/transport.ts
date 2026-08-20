import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * Bridges an RR7 WHATWG Request to the MCP SDK's web-standard transport.
 * Stateless mode + JSON responses: no session tracking, no SSE streaming.
 * Sufficient for Claude Desktop + Claude Code tool-calling use cases.
 */
export async function handleMcpHttp(
  request: Request,
  server: McpServer,
): Promise<Response> {
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  try {
    return await transport.handleRequest(request);
  } finally {
    await transport.close().catch(() => {});
    await server.close().catch(() => {});
  }
}
