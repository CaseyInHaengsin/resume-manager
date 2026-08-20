/**
 * Mint an MCP token for manual testing. Prints the plaintext to stdout.
 * Usage: pnpm tsx scripts/dev/mcp-mint-token.ts [--user=<username>]
 */
import { db } from "../../app/db";
import { users } from "../../app/db/schema";
import { eq } from "drizzle-orm";
import { generateToken } from "../../app/lib/mcp-auth.server";

async function main() {
  const arg = process.argv.find((a) => a.startsWith("--user="));
  const username = arg?.slice("--user=".length);
  const user = username
    ? db.select().from(users).where(eq(users.username, username)).get()
    : db.select().from(users).limit(1).get();
  if (!user) {
    console.error(`No user found${username ? ` for ${username}` : ""}.`);
    process.exit(1);
  }
  const { plaintext } = await generateToken(user.id, "manual-test");
  console.log(plaintext);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
