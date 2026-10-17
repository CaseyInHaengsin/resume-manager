import { Form, useLoaderData } from "react-router";
import type { Route } from "./+types/oauth.authorize";

// Everything server-side lives in ~/lib/oauth-authorize.server and is imported
// inside `loader`/`action` only. This route has a component, and React Router
// strips server code from those two exports alone — a module-scope import of a
// `.server` module here would fail the client build.

const SCOPE_DESCRIPTIONS: Record<string, string> = {
  "mcp:read":
    "Read your profile, resumes, work history, projects, skills, companies and applications",
  "mcp:write":
    "Move applications through the pipeline, append notes, and add skills and bullets",
};

export async function loader({ request }: Route.LoaderArgs) {
  const { requireUserId } = await import("~/lib/auth.server");
  const { getClient, isLoopbackRedirectUri } = await import("~/lib/oauth.server");
  const {
    FatalAuthorizeError,
    RedirectableAuthorizeError,
    readParams,
    redirectBack,
    validate,
  } = await import("~/lib/oauth-authorize.server");

  const url = new URL(request.url);
  let params;
  try {
    params = validate(readParams(url.searchParams));
  } catch (err) {
    if (err instanceof RedirectableAuthorizeError) {
      throw redirectBack(err.redirectUri, {
        error: err.code,
        error_description: err.message,
        state: err.state,
      });
    }
    if (err instanceof FatalAuthorizeError) {
      return { error: err.message, consent: null };
    }
    throw err;
  }

  // `requireUserId` defaults its return path to the pathname alone, which would
  // drop every OAuth parameter across the sign-in bounce. Pass the whole URL.
  await requireUserId(request, url.pathname + url.search);

  const client = getClient(params.clientId)!;
  return {
    error: null,
    consent: {
      clientName: client.clientName,
      redirectHost: new URL(params.redirectUri).host,
      isLoopback: isLoopbackRedirectUri(params.redirectUri),
      scopes: params.scopes,
      // Echoed into hidden fields and re-validated on the way back in; nothing
      // returned here is trusted on submit.
      raw: {
        response_type: "code",
        client_id: params.clientId,
        redirect_uri: params.redirectUri,
        state: params.state ?? "",
        scope: params.scopes.join(" "),
        code_challenge: params.codeChallenge,
        code_challenge_method: "S256",
        resource: params.resource,
      },
    },
  };
}

export async function action({ request }: Route.ActionArgs) {
  const { requireUserId } = await import("~/lib/auth.server");
  const { issueAuthCode } = await import("~/lib/oauth.server");
  const {
    FatalAuthorizeError,
    RedirectableAuthorizeError,
    readParams,
    redirectBack,
    validate,
  } = await import("~/lib/oauth-authorize.server");

  const form = await request.formData();
  let params;
  try {
    params = validate(readParams(form));
  } catch (err) {
    if (err instanceof RedirectableAuthorizeError) {
      return redirectBack(err.redirectUri, {
        error: err.code,
        error_description: err.message,
        state: err.state,
      });
    }
    if (err instanceof FatalAuthorizeError) {
      return { error: err.message, consent: null };
    }
    throw err;
  }

  const userId = await requireUserId(request);

  if (form.get("intent") !== "approve") {
    return redirectBack(params.redirectUri, {
      error: "access_denied",
      error_description: "The user declined the request.",
      state: params.state,
    });
  }

  const code = issueAuthCode({
    clientId: params.clientId,
    userId,
    redirectUri: params.redirectUri,
    codeChallenge: params.codeChallenge,
    scopes: params.scopes,
    resource: params.resource,
  });

  return redirectBack(params.redirectUri, { code, state: params.state });
}

export default function AuthorizePage() {
  const data = useLoaderData<typeof loader>();

  if (data.error || !data.consent) {
    return (
      <Shell>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
          This request can&rsquo;t be completed
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          {data.error}
        </p>
      </Shell>
    );
  }

  const { clientName, redirectHost, isLoopback, scopes, raw } = data.consent;

  return (
    <Shell>
      <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
        Connect {clientName}?
      </h1>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
        It will be able to:
      </p>
      <ul className="mt-3 space-y-2">
        {scopes.map((scope) => (
          <li
            key={scope}
            className="flex gap-2 text-sm text-gray-800 dark:text-gray-200"
          >
            <span aria-hidden="true">•</span>
            <span>{SCOPE_DESCRIPTIONS[scope] ?? scope}</span>
          </li>
        ))}
      </ul>

      <p className="mt-4 text-xs text-gray-500 dark:text-gray-500">
        After approving, you&rsquo;ll be sent to{" "}
        <span className="font-mono text-gray-700 dark:text-gray-300">
          {redirectHost}
        </span>
        .
      </p>
      {isLoopback && (
        <p className="mt-2 rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          This callback points at a program running on your own computer. Only
          approve it if you just started a sign-in from that program.
        </p>
      )}

      <Form method="post" className="mt-6 flex gap-3">
        {Object.entries(raw).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        <button
          type="submit"
          name="intent"
          value="approve"
          className="flex-1 rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Approve
        </button>
        <button
          type="submit"
          name="intent"
          value="deny"
          className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          Deny
        </button>
      </Form>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-950">
      <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        {children}
      </div>
    </div>
  );
}
