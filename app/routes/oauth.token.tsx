import {
  RefreshError,
  consumeAuthCode,
  getClient,
  issueTokens,
  normalizeResource,
  redirectUriMatches,
  rotateRefreshToken,
  verifyClientSecret,
  verifyPkce,
} from "~/lib/oauth.server";
import type { Route } from "./+types/oauth.token";

/**
 * Token endpoint (OAuth 2.1).
 *
 * The body is `application/x-www-form-urlencoded` per RFC 6749 §4.1.3 — both the
 * initial exchange and refreshes arrive that way, and a JSON-only parser here
 * would answer 415 and break every connection.
 *
 * Error codes are the RFC 6749 ones. `invalid_grant` in particular is load-bearing:
 * clients key their re-authorization on it, and a custom code leaves them stuck.
 */
export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return tokenError("invalid_request", "POST required.", 405);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return tokenError(
      "invalid_request",
      "Body must be application/x-www-form-urlencoded.",
    );
  }

  const str = (k: string) => {
    const v = form.get(k);
    return typeof v === "string" && v.length > 0 ? v : null;
  };

  const basic = parseBasicAuth(request.headers.get("authorization"));
  const clientId = basic?.clientId ?? str("client_id");
  const clientSecret = basic?.clientSecret ?? str("client_secret");

  if (!clientId) {
    return tokenError("invalid_client", "client_id is required.", 401);
  }
  const client = getClient(clientId);
  if (!client) {
    return tokenError("invalid_client", "Unknown client.", 401);
  }
  if (!(await verifyClientSecret(clientId, clientSecret))) {
    return tokenError("invalid_client", "Client authentication failed.", 401);
  }

  const grantType = str("grant_type");
  if (grantType === "authorization_code") {
    return exchangeCode({
      clientId,
      code: str("code"),
      redirectUri: str("redirect_uri"),
      codeVerifier: str("code_verifier"),
      resource: str("resource"),
    });
  }
  if (grantType === "refresh_token") {
    return refresh(clientId, str("refresh_token"));
  }
  return tokenError(
    "unsupported_grant_type",
    "Supported grant types: authorization_code, refresh_token.",
  );
}

function exchangeCode(input: {
  clientId: string;
  code: string | null;
  redirectUri: string | null;
  codeVerifier: string | null;
  resource: string | null;
}) {
  if (!input.code) return tokenError("invalid_request", "code is required.");
  if (!input.codeVerifier) {
    return tokenError("invalid_request", "code_verifier is required.");
  }

  // Claiming the code is what makes it single-use: a replay finds nothing left
  // to claim and lands here, not on a second set of tokens.
  const claimed = consumeAuthCode(input.code);
  if (!claimed) {
    return tokenError(
      "invalid_grant",
      "Authorization code is unknown, expired, or already used.",
    );
  }
  if (claimed.clientId !== input.clientId) {
    return tokenError("invalid_grant", "Code was issued to a different client.");
  }
  if (
    !input.redirectUri ||
    !redirectUriMatches(claimed.redirectUri, input.redirectUri)
  ) {
    return tokenError("invalid_grant", "redirect_uri does not match the code.");
  }
  if (!verifyPkce(input.codeVerifier, claimed.codeChallenge)) {
    return tokenError("invalid_grant", "PKCE verification failed.");
  }
  if (input.resource !== null) {
    const requested = normalizeResource(input.resource);
    if (requested === null || requested !== claimed.resource) {
      return tokenError("invalid_target", "resource does not match the code.");
    }
  }

  const issued = issueTokens({
    clientId: claimed.clientId,
    userId: claimed.userId,
    scopes: claimed.scopes,
    resource: claimed.resource,
  });
  return tokenResponse(issued);
}

function refresh(clientId: string, refreshToken: string | null) {
  if (!refreshToken) {
    return tokenError("invalid_request", "refresh_token is required.");
  }
  try {
    const issued = rotateRefreshToken(refreshToken);
    return tokenResponse(issued);
  } catch (err) {
    if (err instanceof RefreshError) {
      return tokenError("invalid_grant", err.message);
    }
    console.error("[oauth/token] refresh failed", err);
    return tokenError("invalid_grant", "Refresh failed.");
  }
}

function tokenResponse(issued: {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  scopes: string[];
}) {
  return Response.json(
    {
      access_token: issued.accessToken,
      token_type: "Bearer",
      expires_in: issued.expiresIn,
      // Rotated on every use: the replacement ships in the same response that
      // retires the one just presented.
      refresh_token: issued.refreshToken,
      scope: issued.scopes.join(" "),
    },
    { headers: { "Cache-Control": "no-store", Pragma: "no-cache" } },
  );
}

function tokenError(code: string, description: string, status = 400) {
  const headers: Record<string, string> = { "Cache-Control": "no-store" };
  if (status === 401) headers["WWW-Authenticate"] = 'Basic realm="oauth"';
  return Response.json(
    { error: code, error_description: description },
    { status, headers },
  );
}

function parseBasicAuth(
  header: string | null,
): { clientId: string; clientSecret: string } | null {
  if (!header?.toLowerCase().startsWith("basic ")) return null;
  try {
    const decoded = Buffer.from(header.slice(6).trim(), "base64").toString("utf8");
    const sep = decoded.indexOf(":");
    if (sep < 0) return null;
    return {
      // client_secret_basic form-encodes both halves (RFC 6749 §2.3.1).
      clientId: decodeURIComponent(decoded.slice(0, sep)),
      clientSecret: decodeURIComponent(decoded.slice(sep + 1)),
    };
  } catch {
    return null;
  }
}
