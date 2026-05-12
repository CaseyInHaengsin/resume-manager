import { Form, Link, redirect, useActionData } from "react-router";
import {
  createUserSession,
  getUserId,
  signup,
} from "~/lib/auth.server";
import type { Route } from "./+types/signup";

export async function loader({ request }: Route.LoaderArgs) {
  const userId = await getUserId(request);
  if (userId) return redirect("/library");
  return null;
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const username = (form.get("username") as string | null)?.trim() ?? "";
  const password = (form.get("password") as string | null) ?? "";
  const confirm = (form.get("confirm") as string | null) ?? "";
  const fieldErrors: {
    username?: string;
    password?: string;
    confirm?: string;
  } = {};

  if (!username) {
    fieldErrors.username = "Enter a username.";
  } else if (username.length < 3) {
    fieldErrors.username = "Username must be at least 3 characters.";
  }

  if (!password) {
    fieldErrors.password = "Enter a password.";
  } else if (password.length < 6) {
    fieldErrors.password = "Password must be at least 6 characters.";
  }

  if (!confirm) {
    fieldErrors.confirm = "Confirm your password.";
  } else if (password !== confirm) {
    fieldErrors.confirm = "Passwords do not match.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      formError: "Fix the signup errors below.",
      fieldErrors,
      values: { username },
    };
  }

  try {
    const result = await signup(username, password);
    if (!result.ok) {
      return {
        formError: result.error,
        fieldErrors: {
          username: result.error.toLowerCase().includes("username")
            ? result.error
            : undefined,
          password: result.error.toLowerCase().includes("password")
            ? result.error
            : undefined,
        },
        values: { username },
      };
    }
    return createUserSession({
      request,
      userId: result.user.id,
      redirectTo: "/library",
    });
  } catch (error) {
    console.error("[signup] Unable to create account", error);
    return {
      formError:
        "We could not create your account right now. Try again, or contact the site owner if this keeps happening.",
      fieldErrors: {},
      values: { username },
    };
  }
}

export default function SignupPage() {
  const actionData = useActionData<typeof action>();
  const fieldErrors = actionData?.fieldErrors ?? {};
  const errorMessages = Object.values(fieldErrors).filter(Boolean);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6 text-center">
          Create account
        </h1>
        <Form
          method="post"
          noValidate
          className="space-y-4 bg-white dark:bg-gray-900 p-6 rounded-lg border border-gray-200 dark:border-gray-800"
        >
          {actionData?.formError && (
            <div
              role="alert"
              className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200"
            >
              <p className="font-medium">{actionData.formError}</p>
              {errorMessages.length > 0 && (
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {errorMessages.map((message) => (
                    <li key={message}>{message}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <label className="block">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Username</span>
            <input
              id="username"
              name="username"
              type="text"
              required
              minLength={3}
              autoComplete="username"
              defaultValue={actionData?.values?.username ?? ""}
              aria-invalid={fieldErrors.username ? true : undefined}
              aria-describedby="username-help username-error"
              className={`mt-1 block w-full rounded border bg-white px-3 py-2 text-gray-900 dark:bg-gray-800 dark:text-white ${
                fieldErrors.username
                  ? "border-red-500 focus:border-red-500 focus:outline-red-500 dark:border-red-500"
                  : "border-gray-300 dark:border-gray-700"
              }`}
            />
            <span id="username-help" className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
              Use at least 3 characters.
            </span>
            {fieldErrors.username && (
              <span id="username-error" className="mt-1 block text-sm text-red-600 dark:text-red-400">
                {fieldErrors.username}
              </span>
            )}
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Password</span>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              aria-invalid={fieldErrors.password ? true : undefined}
              aria-describedby="password-help password-error"
              className={`mt-1 block w-full rounded border bg-white px-3 py-2 text-gray-900 dark:bg-gray-800 dark:text-white ${
                fieldErrors.password
                  ? "border-red-500 focus:border-red-500 focus:outline-red-500 dark:border-red-500"
                  : "border-gray-300 dark:border-gray-700"
              }`}
            />
            <span id="password-help" className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
              Use at least 6 characters.
            </span>
            {fieldErrors.password && (
              <span id="password-error" className="mt-1 block text-sm text-red-600 dark:text-red-400">
                {fieldErrors.password}
              </span>
            )}
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Confirm password</span>
            <input
              id="confirm"
              name="confirm"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              aria-invalid={fieldErrors.confirm ? true : undefined}
              aria-describedby="confirm-error"
              className={`mt-1 block w-full rounded border bg-white px-3 py-2 text-gray-900 dark:bg-gray-800 dark:text-white ${
                fieldErrors.confirm
                  ? "border-red-500 focus:border-red-500 focus:outline-red-500 dark:border-red-500"
                  : "border-gray-300 dark:border-gray-700"
              }`}
            />
            {fieldErrors.confirm && (
              <span id="confirm-error" className="mt-1 block text-sm text-red-600 dark:text-red-400">
                {fieldErrors.confirm}
              </span>
            )}
          </label>
          <button
            type="submit"
            className="w-full rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Sign up
          </button>
          <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
            Already have an account?{" "}
            <Link to="/login" className="text-blue-600 dark:text-blue-400 hover:underline">
              Sign in
            </Link>
          </p>
        </Form>
      </div>
    </div>
  );
}
