import { useLoaderData, Form } from "react-router";
import { db } from "~/db";
import { resumes, companies, applications } from "~/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { Link } from "react-router";
import { requireUserId } from "~/lib/auth.server";
import type { Route } from "./+types/builder-index";

export async function loader({ request }: Route.LoaderArgs) {
  const userId = await requireUserId(request);
  const rows = db
    .select({
      id: resumes.id,
      name: resumes.name,
      updatedAt: resumes.updatedAt,
      companyId: resumes.companyId,
      companyName: companies.name,
      applicationCount:
        sql<number>`(SELECT COUNT(*) FROM ${applications} WHERE ${applications.resumeId} = ${resumes.id})`.as(
          "application_count",
        ),
    })
    .from(resumes)
    .leftJoin(companies, eq(resumes.companyId, companies.id))
    .where(eq(resumes.userId, userId))
    .orderBy(desc(resumes.updatedAt))
    .all();
  return { resumes: rows };
}

export default function BuilderIndex() {
  const { resumes } = useLoaderData<typeof loader>();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Resumes
        </h2>
        <Form method="post" action="/api/resumes">
          <input type="hidden" name="_action" value="create" />
          <input type="hidden" name="name" value="Untitled Resume" />
          <button
            type="submit"
            className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            + New Resume
          </button>
        </Form>
      </div>

      {resumes.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400 text-center py-12">
          No resumes yet. Create one to get started.
        </p>
      ) : (
        <div className="space-y-2">
          {resumes.map((resume) => (
            <Link
              key={resume.id}
              to={`/builder/${resume.id}`}
              className="block rounded-lg border border-gray-200 bg-white px-4 py-3 hover:bg-gray-50 dark:bg-gray-900 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium text-gray-900 dark:text-white truncate">
                  {resume.name}
                </p>
                <div className="flex items-center gap-2 shrink-0">
                  {resume.applicationCount > 0 && (
                    <span className="rounded-full bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-200 px-2 py-0.5 text-xs">
                      {resume.applicationCount} application
                      {resume.applicationCount === 1 ? "" : "s"}
                    </span>
                  )}
                  {resume.companyName && (
                    <span className="rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 px-2 py-0.5 text-xs">
                      Target: {resume.companyName}
                    </span>
                  )}
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Updated{" "}
                {new Date(resume.updatedAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
