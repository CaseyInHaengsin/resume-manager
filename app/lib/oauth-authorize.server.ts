import { redirect } from "react-router";
import {
  getClient,
  getPublicUrl,
  normalizeResource,
  parseScopes,
  redirectUriMatches,
  resolveGrantedScopes,
} from "~/lib/oauth.server";

/**
 * Request handling for /oauth/authorize.
 *
 * This lives apart from the route module on purpose. That route has a component
 * (the consent screen), and React Router only strips `loader`/`action`/
 * `middleware`/`headers` from the client bundle — anything at module scope goes
 * to the browser. Keeping the validation here means the route's only references
 * to server code are inside loader and action, where they get stripped.
 */

export type AuthorizeParams = {
  clientId: string;
  redirectUri: string;
  state: string | null;
  scopes: string[];
  codeChallenge: string;
  resource: string;
};

/** A failure we cannot hand back to the client, because we do not yet trust
 *  where it says to send the user. Rendered as a page instead. */
export class FatalAuthorizeError extends Error {}

/** A failure the client is entitled to receive at its registered callback. */
export class RedirectableAuthorizeError extends Error {
  constructor(
    readonly redirectUri: string,
    readonly code: string,
    readonly state: string | null,
    description: string,
  ) {
    super(description);
  }
}

export function readParams(source: URLSearchParams | FormData) {
  const get = (k: string) => {
    const v = source.get(k);
    return typeof v === "string" && v.length > 0 ? v : null;
  };
  return {
    responseType: get("response_type"),
    clientId: get("client_id"),
    redirectUri: get("redirect_uri"),
    state: get("state"),
    scope: get("scope"),
    codeChallenge: get("code_challenge"),
    codeChallengeMethod: get("code_challenge_method"),
    resource: get("resource"),
  };
}

/**
 * Two-stage validation, and the order matters. Until the client and its callback
 * are known-good, an error cannot be redirected anywhere — sending OAuth errors
 * to an unverified `redirect_uri` is the open redirect this endpoint would
 * otherwise be. Only afterwards do errors go back to the client.
 */
export function validate(raw: ReturnType<typeof readParams>): AuthorizeParams {
  if (!raw.clientId) {
    throw new FatalAuthorizeError("Missing client_id.");
  }
  const client = getClient(raw.clientId);
  if (!client) {
    throw new FatalAuthorizeError(
      "Unknown client_id. The registration may have been pruned — remove and re-add the connector.",
    );
  }
  if (!raw.redirectUri) {
    throw new FatalAuthorizeError("Missing redirect_uri.");
  }
  const presented = raw.redirectUri;
  const matched = client.redirectUris.some((registered) =>
    redirectUriMatches(registered, presented),
  );
  if (!matched) {
    throw new FatalAuthorizeError(
      "redirect_uri does not match any callback registered by this client.",
    );
  }

  const fail = (code: string, description: string): never => {
    throw new RedirectableAuthorizeError(presented, code, raw.state, description);
  };

  if (raw.responseType !== "code") {
    fail("unsupported_response_type", "Only response_type=code is supported.");
  }
  if (!raw.codeChallenge) {
    fail("invalid_request", "PKCE code_challenge is required.");
  }
  if (raw.codeChallengeMethod !== "S256") {
    fail("invalid_request", "code_challenge_method must be S256.");
  }
  const resource = normalizeResource(raw.resource);
  if (!resource) {
    fail(
      "invalid_target",
      `resource must identify this MCP server (${getPublicUrl()}/mcp).`,
    );
  }

  return {
    clientId: client.clientId,
    redirectUri: presented,
    state: raw.state,
    scopes: resolveGrantedScopes(parseScopes(raw.scope)),
    codeChallenge: raw.codeChallenge!,
    resource: resource!,
  };
}

export function redirectBack(
  redirectUri: string,
  params: Record<string, string | null>,
): Response {
  const url = new URL(redirectUri);
  for (const [key, value] of Object.entries(params)) {
    if (value !== null) url.searchParams.set(key, value);
  }
  // RFC 9207: naming the issuer in the response lets the client detect a mix-up
  // attack before it sends the code to a token endpoint.
  url.searchParams.set("iss", getPublicUrl());
  return redirect(url.toString());
}
