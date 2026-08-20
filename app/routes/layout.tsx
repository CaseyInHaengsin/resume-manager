import { Form, NavLink, Outlet, useLoaderData } from "react-router";
import { getCurrentUser, requireUserId } from "~/lib/auth.server";
import type { Route } from "./+types/layout";

export async function loader({ request }: Route.LoaderArgs) {
  await requireUserId(request);
  const user = await getCurrentUser(request);
  return { user };
}

export default function AppLayout() {
  const { user } = useLoaderData<typeof loader>();

  const linkClasses = ({ isActive }: { isActive: boolean }) =>
    `text-sm font-medium ${
      isActive
        ? "text-blue-600 dark:text-blue-400"
        : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
    }`;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <nav className="border-b border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-800">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center justify-between">
            <span className="text-lg font-semibold text-gray-900 dark:text-white">
              Resume Builder
            </span>
            <div className="flex items-center gap-6">
              <NavLink to="/library" className={linkClasses}>
                Library
              </NavLink>
              <NavLink to="/builder" className={linkClasses}>
                Builder
              </NavLink>
              <NavLink to="/companies" className={linkClasses}>
                Companies
              </NavLink>
              <NavLink to="/applications" className={linkClasses}>
                Applications
              </NavLink>
              <NavLink to="/techstack" className={linkClasses}>
                Tech Stack
              </NavLink>
              <NavLink to="/settings" className={linkClasses}>
                Settings
              </NavLink>
              {user && (
                <>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {user.username}
                  </span>
                  <Form method="post" action="/logout">
                    <button
                      type="submit"
                      className="text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                    >
                      Log out
                    </button>
                  </Form>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}
