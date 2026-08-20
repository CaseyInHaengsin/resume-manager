import { Link, useLoaderData } from "react-router";
import { db } from "~/db";
import { companies } from "~/db/schema";
import { desc, eq } from "drizzle-orm";
import { requireUserId } from "~/lib/auth.server";
import type { Route } from "./+types/companies._index";

export async function loader({ request }: Route.LoaderArgs) {
  const userId = await requireUserId(request);
  const rows = db
    .select()
    .from(companies)
    .where(eq(companies.userId, userId))
    .orderBy(desc(companies.updatedAt))
    .all();
  return { companies: rows };
}

export default function CompaniesIndex() {
  const { companies: rows } = useLoaderData<typeof loader>();
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Companies
        </h2>
        <Link
          to="/companies/new"
          className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          + New Company
        </Link>
      </div>
      {rows.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400 text-center py-12">
          No companies yet. Add one to start tracking research targets.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rows.map((c) => (
            <Link
              key={c.id}
              to={`/companies/${c.id}`}
              className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <div className="flex items-center gap-3">
                {c.logoUrl ? (
                  <img
                    src={c.logoUrl}
                    alt=""
                    className="h-10 w-10 rounded object-cover bg-gray-100 dark:bg-gray-800"
                  />
                ) : (
                  <div className="h-10 w-10 rounded bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 text-sm font-medium">
                    {c.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-900 dark:text-white truncate">
                    {c.name}
                  </p>
                  {c.tagline && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {c.tagline}
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                {(c.techStack ?? []).slice(0, 4).map((t, i) => (
                  <span
                    key={i}
                    className="text-[10px] rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-gray-700 dark:text-gray-300"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
