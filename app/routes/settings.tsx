import { Form, redirect, useLoaderData, useSearchParams } from "react-router";
import { requireUserId } from "~/lib/auth.server";
import { generateToken, getActiveToken, revokeAllTokens } from "~/lib/mcp-auth.server";
import {
  ImportError,
  importUserData,
  parseImportPayload,
} from "~/lib/data-import.server";
import type { Route } from "./+types/settings";

export async function loader({ request }: Route.LoaderArgs) {
  const userId = await requireUserId(request);
  return { token: getActiveToken(userId) };
}

export async function action({ request }: Route.ActionArgs) {
  const userId = await requireUserId(request);
  const form = await request.formData();
  const _action = form.get("_action");
  if (_action === "generate") {
    const { plaintext } = await generateToken(userId);
    return redirect(`/settings?new=${encodeURIComponent(plaintext)}`);
  }
  if (_action === "revoke") {
    revokeAllTokens(userId);
    return redirect("/settings");
  }
  if (_action === "import") {
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return redirect("/settings?import=missing");
    }
    let payload;
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      payload = parseImportPayload(json);
    } catch (e) {
      const msg =
        e instanceof ImportError
          ? e.message
          : e instanceof SyntaxError
            ? "File is not valid JSON"
            : "Could not read file";
      return redirect(`/settings?import=err&msg=${encodeURIComponent(msg)}`);
    }
    try {
      importUserData(userId, payload);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Import failed";
      return redirect(`/settings?import=err&msg=${encodeURIComponent(msg)}`);
    }
    return redirect("/settings?import=ok");
  }
  return new Response("Unknown action", { status: 400 });
}

function formatDate(iso: string | null) {
  if (!iso) return "never";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

export default function SettingsPage() {
  const { token } = useLoaderData<typeof loader>();
  const [params] = useSearchParams();
  const newToken = params.get("new");
  const importStatus = params.get("import");
  const importMsg = params.get("msg");

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Settings</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Manage how external tools connect to your data.
        </p>
      </div>

      <section className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">MCP Token</h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Bearer token for connecting Claude Desktop or Claude Code to this app via MCP.
              Only one active token per user; regenerating revokes the previous one.
            </p>
          </div>
        </div>

        {newToken && (
          <div className="mt-4 rounded border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 p-4">
            <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
              Copy this token now. You won't be able to see it again.
            </p>
            <pre className="mt-2 overflow-x-auto rounded bg-white dark:bg-gray-950 px-3 py-2 text-xs font-mono text-gray-900 dark:text-gray-100 border border-amber-200 dark:border-amber-800 select-all">
              {newToken}
            </pre>
            <a
              href="/settings"
              className="mt-3 inline-block text-sm text-amber-900 dark:text-amber-200 hover:underline"
            >
              Dismiss
            </a>
          </div>
        )}

        <div className="mt-4">
          {token ? (
            <div className="space-y-3">
              <dl className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-2 text-sm">
                <div>
                  <dt className="text-gray-500 dark:text-gray-400">Label</dt>
                  <dd className="text-gray-900 dark:text-white">{token.label}</dd>
                </div>
                <div>
                  <dt className="text-gray-500 dark:text-gray-400">Created</dt>
                  <dd className="text-gray-900 dark:text-white">{formatDate(token.createdAt)}</dd>
                </div>
                <div>
                  <dt className="text-gray-500 dark:text-gray-400">Last used</dt>
                  <dd className="text-gray-900 dark:text-white">{formatDate(token.lastUsedAt)}</dd>
                </div>
              </dl>
              <div className="flex gap-3 pt-2">
                <Form method="post">
                  <input type="hidden" name="_action" value="generate" />
                  <button
                    type="submit"
                    className="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    Revoke &amp; Regenerate
                  </button>
                </Form>
                <Form method="post">
                  <input type="hidden" name="_action" value="revoke" />
                  <button
                    type="submit"
                    className="rounded border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    Revoke only
                  </button>
                </Form>
              </div>
            </div>
          ) : (
            <Form method="post">
              <input type="hidden" name="_action" value="generate" />
              <button
                type="submit"
                className="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Generate MCP Token
              </button>
            </Form>
          )}
        </div>

        <p className="mt-6 text-xs text-gray-500 dark:text-gray-400">
          See the project README "MCP" section for connection instructions.
        </p>
      </section>

      <section className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
        <h2 className="text-lg font-medium text-gray-900 dark:text-white">
          Backup &amp; Restore
        </h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Export your data as JSON to back it up or move it between instances.
          Importing replaces all of your current data with the contents of the file.
        </p>

        {importStatus === "ok" && (
          <div className="mt-4 rounded border border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950/40 p-3 text-sm text-green-900 dark:text-green-200">
            Import successful.
          </div>
        )}
        {importStatus === "missing" && (
          <div className="mt-4 rounded border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 p-3 text-sm text-amber-900 dark:text-amber-200">
            Choose a file to import.
          </div>
        )}
        {importStatus === "err" && (
          <div className="mt-4 rounded border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-900 dark:text-red-200">
            Import failed: {importMsg ?? "unknown error"}
          </div>
        )}

        <div className="mt-4 grid gap-6 sm:grid-cols-2">
          <div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">Export</h3>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Download a JSON file containing all your library, resumes, companies, and applications.
            </p>
            <Form method="get" action="/api/export" className="mt-3 space-y-3">
              <label className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-400">
                <input
                  type="checkbox"
                  name="blankTemplate"
                  value="1"
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600"
                />
                Export a blank template instead of my current data
              </label>
              <button
                type="submit"
                className="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Download JSON
              </button>
            </Form>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">Import</h3>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Replace all of your current data with the contents of an export file.
              This cannot be undone — export first if you're not sure.
            </p>
            <Form
              method="post"
              encType="multipart/form-data"
              className="mt-3 space-y-2"
              onSubmit={(e) => {
                if (
                  !window.confirm(
                    "This will permanently replace all of your current data. Continue?",
                  )
                ) {
                  e.preventDefault();
                }
              }}
            >
              <input type="hidden" name="_action" value="import" />
              <input
                type="file"
                name="file"
                accept="application/json,.json"
                required
                className="block w-full text-sm text-gray-700 dark:text-gray-300 file:mr-3 file:rounded file:border-0 file:bg-gray-100 dark:file:bg-gray-800 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-gray-900 dark:file:text-gray-100 hover:file:bg-gray-200 dark:hover:file:bg-gray-700"
              />
              <button
                type="submit"
                className="rounded bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Replace my data
              </button>
            </Form>
          </div>
        </div>
      </section>
    </div>
  );
}
