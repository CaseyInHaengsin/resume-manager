import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "~/db";
import { mcpTokens } from "~/db/schema";

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

export async function requireMcpUserId(request: Request): Promise<number> {
  const header = request.headers.get("authorization");
  if (!header) throw new McpUnauthorizedError();
  const [scheme, token] = header.split(/\s+/, 2);
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    throw new McpUnauthorizedError();
  }
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
  throw new McpUnauthorizedError();
}
