/**
 * Smoke-test for app/lib/oauth.server.ts — the OAuth 2.1 authorization server
 * behind the MCP endpoint. Exercises the pieces that are hard to see from the
 * outside: PKCE, single-use codes, audience binding, and refresh rotation.
 *
 * Usage: pnpm tsx scripts/dev/oauth-smoke.ts
 */
import { createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../../app/db";
import {
  oauthAccessTokens,
  oauthAuthCodes,
  oauthClients,
  oauthRefreshTokens,
  users,
} from "../../app/db/schema";
import {
  ClientRegistrationError,
  RefreshError,
  consumeAuthCode,
  getClient,
  getResourceUrl,
  issueAuthCode,
  issueTokens,
  normalizeResource,
  redirectUriMatches,
  registerClient,
  rotateRefreshToken,
  verifyAccessToken,
  verifyPkce,
} from "../../app/lib/oauth.server";

function check(label: string, condition: boolean) {
  if (!condition) throw new Error(`FAILED: ${label}`);
  console.log(`  ok  ${label}`);
}

async function main() {
  const user = db.select().from(users).limit(1).get();
  if (!user) {
    console.error("No user found. Create one via /signup first.");
    process.exit(1);
  }
  console.log(`Using user: id=${user.id} username=${user.username}`);
  console.log(`Canonical resource: ${getResourceUrl()}\n`);

  let clientId = "";
  try {
    // ── Registration ──────────────────────────────────────────────────────
    console.log("Registration");
    const { client, clientSecret } = registerClient({
      clientName: "smoke-test client",
      redirectUris: [
        "https://claude.ai/api/mcp/auth_callback",
        "http://localhost/callback",
      ],
      tokenEndpointAuthMethod: "none",
    });
    clientId = client.clientId;
    check("public client gets no secret", clientSecret === null);
    check("client is readable back", getClient(clientId)?.clientName === "smoke-test client");

    let rejected = false;
    try {
      registerClient({
        clientName: "evil",
        redirectUris: ["https://evil.example.com/steal"],
        tokenEndpointAuthMethod: "none",
      });
    } catch (e) {
      rejected = e instanceof ClientRegistrationError;
    }
    check("off-allowlist redirect_uri is rejected", rejected);

    check(
      "loopback match ignores the port (RFC 8252)",
      redirectUriMatches("http://localhost/callback", "http://localhost:51234/callback"),
    );
    check(
      "non-loopback match stays exact",
      !redirectUriMatches(
        "https://claude.ai/api/mcp/auth_callback",
        "https://claude.ai/api/mcp/other",
      ),
    );

    // ── Resource normalization ────────────────────────────────────────────
    console.log("\nResource (RFC 8707)");
    // Scheme and host are case-insensitive and a trailing slash is
    // insignificant; the path is neither.
    const canonical = new URL(getResourceUrl());
    const shouted = `${canonical.protocol.toUpperCase()}//${canonical.host.toUpperCase()}${canonical.pathname}/`;
    check(
      `trailing slash and host case are tolerated (${shouted})`,
      normalizeResource(shouted) === getResourceUrl(),
    );
    check(
      "path case is not tolerated",
      normalizeResource(getResourceUrl().replace("/mcp", "/MCP")) === null,
    );
    check("absent resource defaults to canonical", normalizeResource(null) === getResourceUrl());
    check("a different server is rejected", normalizeResource("https://elsewhere.test/mcp") === null);

    // ── PKCE + authorization code ─────────────────────────────────────────
    console.log("\nAuthorization code + PKCE");
    const verifier = randomBytes(32).toString("base64url");
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    check("PKCE verifies with the right verifier", verifyPkce(verifier, challenge));
    check("PKCE fails with a wrong verifier", !verifyPkce("wrong", challenge));

    const code = issueAuthCode({
      clientId,
      userId: user.id,
      redirectUri: "https://claude.ai/api/mcp/auth_callback",
      codeChallenge: challenge,
      scopes: ["mcp:read", "mcp:write"],
      resource: getResourceUrl(),
    });
    const claimed = consumeAuthCode(code);
    check("code resolves to the right user", claimed?.userId === user.id);
    check("code carries its scopes", claimed?.scopes.join(" ") === "mcp:read mcp:write");
    check("code is single-use", consumeAuthCode(code) === null);

    // ── Access tokens ─────────────────────────────────────────────────────
    console.log("\nAccess tokens");
    const issued = issueTokens({
      clientId,
      userId: user.id,
      scopes: ["mcp:read"],
      resource: getResourceUrl(),
    });
    const verified = verifyAccessToken(issued.accessToken);
    check("access token resolves to the user", verified?.userId === user.id);
    check("scopes survive the round trip", verified?.scopes.join(" ") === "mcp:read");
    check("an unknown token resolves to nothing", verifyAccessToken("nope") === null);

    const wrongAudience = issueTokens({
      clientId,
      userId: user.id,
      scopes: ["mcp:read"],
      resource: "https://elsewhere.test/mcp",
    });
    check(
      "a token minted for another audience is refused",
      verifyAccessToken(wrongAudience.accessToken) === null,
    );

    // ── Refresh rotation ──────────────────────────────────────────────────
    console.log("\nRefresh rotation");
    const rotated = rotateRefreshToken(issued.refreshToken);
    check("rotation returns a new access token", rotated.accessToken !== issued.accessToken);
    check("rotation returns a new refresh token", rotated.refreshToken !== issued.refreshToken);
    check("the new access token works", verifyAccessToken(rotated.accessToken)?.userId === user.id);

    let replayRejected = false;
    try {
      rotateRefreshToken(issued.refreshToken);
    } catch (e) {
      replayRejected = e instanceof RefreshError;
    }
    check("replaying a rotated refresh token is rejected", replayRejected);
    check(
      "the replay revokes the whole grant",
      verifyAccessToken(rotated.accessToken) === null,
    );
  } finally {
    if (clientId) {
      db.delete(oauthAccessTokens).where(eq(oauthAccessTokens.clientId, clientId)).run();
      db.delete(oauthRefreshTokens).where(eq(oauthRefreshTokens.clientId, clientId)).run();
      db.delete(oauthAuthCodes).where(eq(oauthAuthCodes.clientId, clientId)).run();
      db.delete(oauthClients).where(eq(oauthClients.clientId, clientId)).run();
      console.log("\nCleaned up smoke-test client and its tokens.");
    }
  }
  console.log("OAuth smoke test passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
