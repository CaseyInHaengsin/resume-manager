import { Form, Link, redirect, useActionData, useLoaderData, useSearchParams } from "react-router";
import {
  createUserSession,
  getUserId,
  login,
  signupEnabled,
} from "~/lib/auth.server";
import type { Route } from "./+types/login";

/**
 * `redirectTo` is attacker-supplied — it arrives in the query string of a link.
 * Only same-site paths are allowed through, so a crafted /login?redirectTo=…
 * can't bounce someone to another origin after they sign in. This matters more
 * now that /oauth/authorize sends users through here mid-flow.
 */
function safeRedirect(to: string | null | undefined, fallback = "/library") {
  if (!to || !to.startsWith("/") || to.startsWith("//")) return fallback;
  return to;
}

export async function loader({ request }: Route.LoaderArgs) {
  const userId = await getUserId(request);
  if (userId) return redirect("/library");
  return { signupEnabled: signupEnabled() };
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const username = (form.get("username") as string | null)?.trim() ?? "";
  const password = (form.get("password") as string | null) ?? "";
  const redirectTo = safeRedirect(form.get("redirectTo") as string | null);

  if (!username || !password) {
    return { error: "Username and password are required" };
  }
  const user = await login(username, password);
  if (!user) {
    return { error: "Invalid username or password" };
  }
  return createUserSession({ request, userId: user.id, redirectTo });
}

export default function LoginPage() {
  const actionData = useActionData<typeof action>();
  const { signupEnabled } = useLoaderData<typeof loader>();
  const [params] = useSearchParams();
  const redirectTo = safeRedirect(params.get("redirectTo"));

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6 text-center">
          Sign in
        </h1>
        <Form method="post" className="space-y-4 bg-white dark:bg-gray-900 p-6 rounded-lg border border-gray-200 dark:border-gray-800">
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <label className="block">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Username</span>
            <input
              name="username"
              type="text"
              required
              autoComplete="username"
              className="mt-1 block w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Password</span>
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="mt-1 block w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white"
            />
          </label>
          {actionData?.error && (
            <p className="text-sm text-red-600 dark:text-red-400">{actionData.error}</p>
          )}
          <button
            type="submit"
            className="w-full rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Sign in
          </button>
          {signupEnabled && (
            <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
              No account?{" "}
              <Link to="/signup" className="text-blue-600 dark:text-blue-400 hover:underline">
                Sign up
              </Link>
            </p>
          )}
        </Form>
      </div>
    </div>
  );
}
