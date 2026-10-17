import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { and, eq, isNull, lt, sql } from "drizzle-orm";
import { db } from "~/db";
import {
  OAUTH_SCOPES,
  oauthAccessTokens,
  oauthAuthCodes,
  oauthClients,
  oauthRefreshTokens,
} from "~/db/schema";

// ── Public identity ───────────────────────────────────────────────────────────
//
// The app runs behind a TLS-terminating proxy, so `request.url` is
// http://<container>:3000 and is useless for anything a client has to match
// byte-for-byte. Every issuer / resource / metadata URL comes from here.

const DEV_FALLBACK_URL = "http://localhost:5173";

export function getPublicUrl(): string {
  const raw = process.env.PUBLIC_URL;
  if (!raw) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "PUBLIC_URL is not set. The OAuth issuer and resource identifiers must " +
          "be the browser-facing origin (e.g. https://resume.example.com), not " +
          "the address the container sees behind the proxy.",
      );
    }
    return DEV_FALLBACK_URL;
  }
  return raw.replace(/\/+$/, "");
}

/** Canonical resource identifier (RFC 8707) — the audience of every token. */
export function getResourceUrl(): string {
  return `${getPublicUrl()}/mcp`;
}

export function getProtectedResourceMetadataUrl(): string {
  return `${getPublicUrl()}/.well-known/oauth-protected-resource`;
}

/**
 * Accept a client's `resource` (RFC 8707) if it designates this server, and
 * return it in canonical form so only one spelling is ever stored.
 *
 * Deliberately lenient about the things RFC 8707 says are insignificant —
 * scheme/host case and a trailing slash — because a client that spells the URL
 * slightly differently than we do would otherwise fail with an error that says
 * nothing useful. Anything that isn't this server still gets rejected.
 *
 * An absent `resource` falls back to the canonical value: some clients omit it.
 */
export function normalizeResource(raw: string | null | undefined): string | null {
  if (!raw) return getResourceUrl();
  const canonical = getResourceUrl();
  let presented: URL;
  let expected: URL;
  try {
    presented = new URL(raw);
    expected = new URL(canonical);
  } catch {
    return null;
  }
  if (presented.hash) return null;
  const samePath =
    presented.pathname.replace(/\/+$/, "") === expected.pathname.replace(/\/+$/, "");
  const sameOrigin =
    presented.protocol.toLowerCase() === expected.protocol.toLowerCase() &&
    presented.host.toLowerCase() === expected.host.toLowerCase();
  return sameOrigin && samePath ? canonical : null;
}

// ── Lifetimes ─────────────────────────────────────────────────────────────────

const AUTH_CODE_TTL_MS = 60_000; // 1 min
const ACCESS_TOKEN_TTL_MS = 60 * 60_000; // 1 hour
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60_000; // 30 days

export const ACCESS_TOKEN_TTL_SECONDS = ACCESS_TOKEN_TTL_MS / 1000;

/** Cap on dynamically registered clients, so an open /register can't grow forever. */
const MAX_CLIENTS = 200;
/** DCR clients this old with nothing live attached are pruned on the next registration. */
const STALE_CLIENT_AGE_MS = 30 * 24 * 60 * 60_000;

// ── Secrets ───────────────────────────────────────────────────────────────────

function newSecret(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Codes and tokens are 256-bit random strings, not passwords: a fast digest is
 * the right primitive, and it makes the lookup an indexed equality match rather
 * than a bcrypt compare against every live row.
 */
function hashSecret(raw: string): string {
  return createHash("sha256").update(raw).digest("base64url");
}

function nowIso(): string {
  return new Date().toISOString();
}

function isoIn(ms: number): string {
  return new Date(Date.now() + ms).toISOString();
}

function isExpired(iso: string): boolean {
  return Date.parse(iso) <= Date.now();
}

// ── Scopes ────────────────────────────────────────────────────────────────────

export const SUPPORTED_SCOPES = [...OAUTH_SCOPES];
/**
 * Advertised on the authorization server (not on the protected resource — the
 * MCP spec says a resource server SHOULD NOT list it). Claude appends it to its
 * authorization request when it sees it here, which is how it asks for a
 * refresh token.
 */
export const OFFLINE_ACCESS_SCOPE = "offline_access";

export function parseScopes(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw.split(/\s+/).filter(Boolean);
}

/**
 * Narrow a requested scope set to what this server grants. An empty or absent
 * request gets everything supported, per the spec's scope-selection fallback.
 */
export function resolveGrantedScopes(requested: string[]): string[] {
  const usable = requested.filter((s) =>
    (SUPPORTED_SCOPES as string[]).includes(s),
  );
  return usable.length > 0 ? usable : [...SUPPORTED_SCOPES];
}

export function hasScope(granted: string[], required: string): boolean {
  return granted.includes(required);
}

// ── Redirect URIs ─────────────────────────────────────────────────────────────

/** Hosts allowed to receive an authorization code over https. */
const ALLOWED_REDIRECT_HOSTS = new Set(["claude.ai", "claude.com"]);
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

function isLoopback(url: URL): boolean {
  return LOOPBACK_HOSTS.has(url.hostname);
}

/**
 * Whether a callback points at the user's own machine. The consent screen says
 * so out loud: any local process can bind a port and claim to be the legitimate
 * client, so a loopback callback deserves more scrutiny from the person
 * approving it than an https one on a known host.
 */
export function isLoopbackRedirectUri(raw: string): boolean {
  try {
    return isLoopback(new URL(raw));
  } catch {
    return false;
  }
}

/**
 * Registration policy. Native clients (Claude Code, MCP Inspector) redirect to
 * an RFC 8252 loopback address on a port they pick at runtime; everything else
 * must be an https callback on a host we know.
 */
export function isRegisterableRedirectUri(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.hash) return false;
  if (isLoopback(url)) return url.protocol === "http:" || url.protocol === "https:";
  return url.protocol === "https:" && ALLOWED_REDIRECT_HOSTS.has(url.hostname);
}

/**
 * Match a presented redirect_uri against a registered one. Exact string compare,
 * except that loopback addresses ignore the port: Claude Code declares
 * `http://localhost/callback` but arrives on an ephemeral port, and RFC 8252
 * §7.3 requires the port to be ignored for the IP-literal form.
 */
export function redirectUriMatches(registered: string, presented: string): boolean {
  if (registered === presented) return true;
  let a: URL, b: URL;
  try {
    a = new URL(registered);
    b = new URL(presented);
  } catch {
    return false;
  }
  if (!isLoopback(a) || !isLoopback(b)) return false;
  return (
    a.protocol === b.protocol &&
    a.hostname === b.hostname &&
    a.pathname === b.pathname
  );
}

// ── Clients ───────────────────────────────────────────────────────────────────

export type OAuthClient = {
  clientId: string;
  clientName: string;
  redirectUris: string[];
  isPublic: boolean;
  tokenEndpointAuthMethod: string;
};

function rowToClient(row: typeof oauthClients.$inferSelect): OAuthClient {
  let redirectUris: string[] = [];
  try {
    const parsed = JSON.parse(row.redirectUris);
    if (Array.isArray(parsed)) redirectUris = parsed.filter((u) => typeof u === "string");
  } catch {
    // A malformed row can only come from a hand-edit; treat it as having no
    // usable callbacks rather than throwing on every lookup.
  }
  return {
    clientId: row.clientId,
    clientName: row.clientName,
    redirectUris,
    isPublic: row.clientSecretHash === null,
    tokenEndpointAuthMethod: row.tokenEndpointAuthMethod,
  };
}

export function getClient(clientId: string): OAuthClient | null {
  const row = db
    .select()
    .from(oauthClients)
    .where(eq(oauthClients.clientId, clientId))
    .get();
  return row ? rowToClient(row) : null;
}

/**
 * Drop dynamically registered clients that are old and have nothing live hanging
 * off them. /register is unauthenticated by design (that is what lets a user
 * paste a URL and connect), so it needs a ceiling.
 */
function pruneStaleClients(): void {
  const cutoff = new Date(Date.now() - STALE_CLIENT_AGE_MS).toISOString();
  db.delete(oauthClients)
    .where(
      and(
        lt(oauthClients.createdAt, cutoff),
        sql`NOT EXISTS (SELECT 1 FROM ${oauthAccessTokens} WHERE ${oauthAccessTokens.clientId} = ${oauthClients.clientId} AND ${oauthAccessTokens.revokedAt} IS NULL)`,
        sql`NOT EXISTS (SELECT 1 FROM ${oauthRefreshTokens} WHERE ${oauthRefreshTokens.clientId} = ${oauthClients.clientId} AND ${oauthRefreshTokens.revokedAt} IS NULL)`,
      ),
    )
    .run();
}

export class ClientRegistrationError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "ClientRegistrationError";
  }
}

export function registerClient(input: {
  clientName: string;
  redirectUris: string[];
  tokenEndpointAuthMethod: string;
}): { client: OAuthClient; clientSecret: string | null; createdAt: string } {
  if (input.redirectUris.length === 0) {
    throw new ClientRegistrationError(
      "invalid_redirect_uri",
      "At least one redirect_uri is required.",
    );
  }
  for (const uri of input.redirectUris) {
    if (!isRegisterableRedirectUri(uri)) {
      throw new ClientRegistrationError(
        "invalid_redirect_uri",
        `redirect_uri not permitted: ${uri}. Allowed: https callbacks on ` +
          `${[...ALLOWED_REDIRECT_HOSTS].join(", ")}, or an http loopback address.`,
      );
    }
  }

  pruneStaleClients();
  const count = db
    .select({ c: sql<number>`count(*)` })
    .from(oauthClients)
    .get();
  if ((count?.c ?? 0) >= MAX_CLIENTS) {
    throw new ClientRegistrationError(
      "invalid_client_metadata",
      "Client registration limit reached.",
      503,
    );
  }

  const confidential = input.tokenEndpointAuthMethod !== "none";
  const clientSecret = confidential ? newSecret() : null;
  const createdAt = nowIso();
  const clientId = `rbc_${randomBytes(16).toString("base64url")}`;

  db.insert(oauthClients)
    .values({
      clientId,
      clientSecretHash: clientSecret ? bcrypt.hashSync(clientSecret, 10) : null,
      clientName: input.clientName,
      redirectUris: JSON.stringify(input.redirectUris),
      tokenEndpointAuthMethod: confidential
        ? input.tokenEndpointAuthMethod
        : "none",
      createdAt,
    })
    .run();

  const client = getClient(clientId);
  if (!client) throw new Error("client insert did not persist");
  return { client, clientSecret, createdAt };
}

/**
 * Confidential clients authenticate at /token. A public client presents no
 * secret and is protected by PKCE alone, which is what OAuth 2.1 expects.
 */
export async function verifyClientSecret(
  clientId: string,
  presented: string | null,
): Promise<boolean> {
  const row = db
    .select({ hash: oauthClients.clientSecretHash })
    .from(oauthClients)
    .where(eq(oauthClients.clientId, clientId))
    .get();
  if (!row) return false;
  if (row.hash === null) return true; // public client: nothing to verify
  if (!presented) return false;
  return bcrypt.compare(presented, row.hash);
}

// ── PKCE ──────────────────────────────────────────────────────────────────────

export function verifyPkce(verifier: string, challenge: string): boolean {
  const computed = createHash("sha256").update(verifier).digest("base64url");
  const a = Buffer.from(computed);
  const b = Buffer.from(challenge);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// ── Authorization codes ───────────────────────────────────────────────────────

export function issueAuthCode(input: {
  clientId: string;
  userId: number;
  redirectUri: string;
  codeChallenge: string;
  scopes: string[];
  resource: string;
}): string {
  const code = newSecret();
  db.insert(oauthAuthCodes)
    .values({
      codeHash: hashSecret(code),
      clientId: input.clientId,
      userId: input.userId,
      redirectUri: input.redirectUri,
      codeChallenge: input.codeChallenge,
      scope: input.scopes.join(" "),
      resource: input.resource,
      expiresAt: isoIn(AUTH_CODE_TTL_MS),
      createdAt: nowIso(),
    })
    .run();
  return code;
}

export type ConsumedAuthCode = {
  clientId: string;
  userId: number;
  redirectUri: string;
  codeChallenge: string;
  scopes: string[];
  resource: string;
};

/**
 * Claims a code, atomically. The `consumedAt IS NULL` guard lives in the UPDATE
 * so two simultaneous exchanges cannot both win; a replay simply returns null.
 */
export function consumeAuthCode(code: string): ConsumedAuthCode | null {
  const row = db
    .update(oauthAuthCodes)
    .set({ consumedAt: nowIso() })
    .where(
      and(
        eq(oauthAuthCodes.codeHash, hashSecret(code)),
        isNull(oauthAuthCodes.consumedAt),
      ),
    )
    .returning()
    .get();
  if (!row) return null;
  if (isExpired(row.expiresAt)) return null;
  return {
    clientId: row.clientId,
    userId: row.userId,
    redirectUri: row.redirectUri,
    codeChallenge: row.codeChallenge,
    scopes: parseScopes(row.scope),
    resource: row.resource,
  };
}

// ── Tokens ────────────────────────────────────────────────────────────────────

export type IssuedTokens = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  scopes: string[];
};

export function issueTokens(input: {
  clientId: string;
  userId: number;
  scopes: string[];
  resource: string;
}): IssuedTokens {
  const accessToken = newSecret();
  const refreshToken = newSecret();
  const scope = input.scopes.join(" ");
  const createdAt = nowIso();

  db.insert(oauthAccessTokens)
    .values({
      tokenHash: hashSecret(accessToken),
      clientId: input.clientId,
      userId: input.userId,
      scope,
      resource: input.resource,
      expiresAt: isoIn(ACCESS_TOKEN_TTL_MS),
      createdAt,
    })
    .run();

  db.insert(oauthRefreshTokens)
    .values({
      tokenHash: hashSecret(refreshToken),
      clientId: input.clientId,
      userId: input.userId,
      scope,
      resource: input.resource,
      expiresAt: isoIn(REFRESH_TOKEN_TTL_MS),
      createdAt,
    })
    .run();

  return {
    accessToken,
    refreshToken,
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    scopes: input.scopes,
  };
}

export type VerifiedAccessToken = {
  userId: number;
  clientId: string;
  scopes: string[];
};

/**
 * Resolve a bearer token to its subject, rejecting anything expired, revoked, or
 * issued for a different audience. The audience check is what stops a token
 * minted for some other resource from being replayed at this one.
 */
export function verifyAccessToken(raw: string): VerifiedAccessToken | null {
  const row = db
    .select()
    .from(oauthAccessTokens)
    .where(eq(oauthAccessTokens.tokenHash, hashSecret(raw)))
    .get();
  if (!row) return null;
  if (row.revokedAt) return null;
  if (isExpired(row.expiresAt)) return null;
  if (row.resource !== getResourceUrl()) return null;
  return {
    userId: row.userId,
    clientId: row.clientId,
    scopes: parseScopes(row.scope),
  };
}

export class RefreshError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RefreshError";
  }
}

/**
 * Rotate a refresh token: the presented one is retired in the same statement
 * that claims it, and its replacement comes back in the same response. Presenting
 * an already-rotated token is a replay, and OAuth 2.1 says to assume the family
 * is compromised — so everything issued to that client/user pair is revoked.
 */
export function rotateRefreshToken(raw: string): IssuedTokens {
  const presentedHash = hashSecret(raw);
  const claimed = db
    .update(oauthRefreshTokens)
    .set({ revokedAt: nowIso() })
    .where(
      and(
        eq(oauthRefreshTokens.tokenHash, presentedHash),
        isNull(oauthRefreshTokens.rotatedTo),
        isNull(oauthRefreshTokens.revokedAt),
      ),
    )
    .returning()
    .get();

  if (!claimed) {
    const replayed = db
      .select({
        clientId: oauthRefreshTokens.clientId,
        userId: oauthRefreshTokens.userId,
      })
      .from(oauthRefreshTokens)
      .where(eq(oauthRefreshTokens.tokenHash, presentedHash))
      .get();
    if (replayed) revokeGrant(replayed.userId, replayed.clientId);
    throw new RefreshError("Refresh token is unknown, already used, or revoked.");
  }

  if (isExpired(claimed.expiresAt)) {
    throw new RefreshError("Refresh token has expired.");
  }

  const scopes = parseScopes(claimed.scope);
  const issued = issueTokens({
    clientId: claimed.clientId,
    userId: claimed.userId,
    scopes,
    resource: claimed.resource,
  });

  db.update(oauthRefreshTokens)
    .set({ rotatedTo: hashSecret(issued.refreshToken) })
    .where(eq(oauthRefreshTokens.tokenHash, presentedHash))
    .run();

  return issued;
}

/** Revoke everything a client holds for a user — used on logout-style teardown
 *  and on detecting a refresh-token replay. */
export function revokeGrant(userId: number, clientId: string): void {
  const now = nowIso();
  db.update(oauthAccessTokens)
    .set({ revokedAt: now })
    .where(
      and(
        eq(oauthAccessTokens.userId, userId),
        eq(oauthAccessTokens.clientId, clientId),
        isNull(oauthAccessTokens.revokedAt),
      ),
    )
    .run();
  db.update(oauthRefreshTokens)
    .set({ revokedAt: now })
    .where(
      and(
        eq(oauthRefreshTokens.userId, userId),
        eq(oauthRefreshTokens.clientId, clientId),
        isNull(oauthRefreshTokens.revokedAt),
      ),
    )
    .run();
}
