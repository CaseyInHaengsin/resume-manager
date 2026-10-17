import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "~/db";
import { mcpTokens } from "~/db/schema";
import { SUPPORTED_SCOPES, verifyAccessToken } from "~/lib/oauth.server";

const TOKEN_PREFIX = "rbmcp_";
const BCRYPT_ROUNDS = 10;

export class McpUnauthorizedError extends Error {
  readonly statusCode = 401;
  readonly jsonRpcCode = -32001;
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "McpUnauthorizedError";
  }
}

export type ActiveToken = {
  id: number;
  label: string;
  createdAt: string;
  lastUsedAt: string | null;
};

export async function generateToken(
  userId: number,
  label = "default",
): Promise<{ id: number; plaintext: string }> {
  revokeAllTokens(userId);
  const plaintext = TOKEN_PREFIX + randomBytes(32).toString("base64url");
  const tokenHash = await bcrypt.hash(plaintext, BCRYPT_ROUNDS);
  const inserted = db
    .insert(mcpTokens)
    .values({ userId, tokenHash, label })
    .returning({ id: mcpTokens.id })
    .get();
  return { id: inserted.id, plaintext };
}

export function revokeAllTokens(userId: number): void {
  const now = new Date().toISOString();
  db.update(mcpTokens)
    .set({ revokedAt: now })
    .where(
      and(eq(mcpTokens.userId, userId), isNull(mcpTokens.revokedAt)),
    )
    .run();
}

export function getActiveToken(userId: number): ActiveToken | null {
  const row = db
    .select({
      id: mcpTokens.id,
      label: mcpTokens.label,
      createdAt: mcpTokens.createdAt,
      lastUsedAt: mcpTokens.lastUsedAt,
    })
    .from(mcpTokens)
    .where(
      and(eq(mcpTokens.userId, userId), isNull(mcpTokens.revokedAt)),
    )
    .get();
  return row ?? null;
}

export type McpAuth = {
  userId: number;
  scopes: string[];
};

/**
 * Resolve the bearer token on an MCP request.
 *
 * Two credentials reach this endpoint. OAuth access tokens are the path that
 * makes remote clients (claude.ai, and therefore mobile) work, and they carry
 * scopes and an audience. Legacy `rbmcp_` tokens are the hand-generated kind
 * pasted into a Claude Desktop or Claude Code config; they predate scopes, so
 * they get all of them.
 *
 * The OAuth lookup runs first and is an indexed digest match. The legacy lookup
 * bcrypt-compares against every live row, so it stays behind the cheap path.
 */
export async function requireMcpAuth(request: Request): Promise<McpAuth> {
  const header = request.headers.get("authorization");
  if (!header) throw new McpUnauthorizedError();
  const [scheme, token] = header.split(/\s+/, 2);
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    throw new McpUnauthorizedError();
  }

  const oauth = verifyAccessToken(token);
  if (oauth) {
    return { userId: oauth.userId, scopes: oauth.scopes };
  }

  const userId = await verifyLegacyToken(token);
  if (userId === null) throw new McpUnauthorizedError();
  return { userId, scopes: [...SUPPORTED_SCOPES] };
}

async function verifyLegacyToken(token: string): Promise<number | null> {
  const candidates = db
    .select({
      id: mcpTokens.id,
      userId: mcpTokens.userId,
      tokenHash: mcpTokens.tokenHash,
    })
    .from(mcpTokens)
    .where(isNull(mcpTokens.revokedAt))
    .all();
  for (const row of candidates) {
    if (await bcrypt.compare(token, row.tokenHash)) {
      db.update(mcpTokens)
        .set({ lastUsedAt: new Date().toISOString() })
        .where(eq(mcpTokens.id, row.id))
        .run();
      return row.userId;
    }
  }
  return null;
}
