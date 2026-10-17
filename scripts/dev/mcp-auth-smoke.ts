/**
 * Smoke-test for app/lib/mcp-auth.server.ts.
 * Usage: pnpm tsx scripts/dev/mcp-auth-smoke.ts
 */
import { db } from "../../app/db";
import { users } from "../../app/db/schema";
import { eq } from "drizzle-orm";
import {
  generateToken,
  getActiveToken,
  requireMcpAuth,
  McpUnauthorizedError,
} from "../../app/lib/mcp-auth.server";

async function main() {
  // Pick the first user we find — the legacy bootstrap in app/db/index.ts
  // guarantees at least "default" exists when there's library data.
  const user = db.select().from(users).limit(1).get();
  if (!user) {
    console.error("No user found. Create one via /signup first.");
    process.exit(1);
  }
  console.log(`Using user: id=${user.id} username=${user.username}`);

  // 1. Generate a token.
  const { id, plaintext } = await generateToken(user.id, "smoke-test");
  console.log(`Generated token #${id}: ${plaintext.slice(0, 16)}…`);

  // 2. getActiveToken returns it.
  const active = getActiveToken(user.id);
  if (active?.id !== id) throw new Error(`expected active id ${id}, got ${active?.id}`);
  console.log(`getActiveToken: ok (id=${active.id}, label=${active.label})`);

  // 3. requireMcpAuth with good token.
  const goodReq = new Request("http://x/mcp", {
    headers: { authorization: `Bearer ${plaintext}` },
  });
  const returned = await requireMcpAuth(goodReq);
  const returnedUserId = returned.userId;
  if (returnedUserId !== user.id)
    throw new Error(`expected userId ${user.id}, got ${returnedUserId}`);
  console.log(`requireMcpAuth (good token): ok (returned ${returnedUserId})`);

  // 4. requireMcpAuth with bad token.
  const badReq = new Request("http://x/mcp", {
    headers: { authorization: "Bearer not-a-real-token" },
  });
  let threw = false;
  try {
    await requireMcpAuth(badReq);
  } catch (e) {
    if (e instanceof McpUnauthorizedError) threw = true;
  }
  if (!threw) throw new Error("bad token did not throw McpUnauthorizedError");
  console.log("requireMcpAuth (bad token): ok (threw McpUnauthorizedError)");

  // 5. Missing header.
  const noReq = new Request("http://x/mcp");
  threw = false;
  try {
    await requireMcpAuth(noReq);
  } catch (e) {
    if (e instanceof McpUnauthorizedError) threw = true;
  }
  if (!threw) throw new Error("missing header did not throw");
  console.log("requireMcpAuth (missing header): ok");

  // 6. Regenerate revokes the old one.
  const { plaintext: plaintext2 } = await generateToken(user.id, "smoke-test-2");
  const oldReq = new Request("http://x/mcp", {
    headers: { authorization: `Bearer ${plaintext}` },
  });
  threw = false;
  try {
    await requireMcpAuth(oldReq);
  } catch (e) {
    if (e instanceof McpUnauthorizedError) threw = true;
  }
  if (!threw) throw new Error("revoked token did not throw");
  console.log("requireMcpAuth (revoked token): ok");

  const newReq = new Request("http://x/mcp", {
    headers: { authorization: `Bearer ${plaintext2}` },
  });
  const reUserId = (await requireMcpAuth(newReq)).userId;
  if (reUserId !== user.id) throw new Error("new token userId mismatch");
  console.log("requireMcpAuth (new token after regen): ok");

  // Clean up: revoke the smoke-test token.
  db.update((await import("../../app/db/schema")).mcpTokens)
    .set({ revokedAt: new Date().toISOString() })
    .where(eq((await import("../../app/db/schema")).mcpTokens.userId, user.id))
    .run();
  console.log("Smoke test passed. Cleaned up tokens.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
