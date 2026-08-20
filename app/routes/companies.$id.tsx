import { Form, Link, redirect, useLoaderData } from "react-router";
import { db } from "~/db";
import { companies, applications } from "~/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { requireUserId } from "~/lib/auth.server";
import type { Route } from "./+types/companies.$id";

export async function loader({ request, params }: Route.LoaderArgs) {
  const userId = await requireUserId(request);
  const id = Number(params.id);
  const company = db
    .select()
    .from(companies)
    .where(and(eq(companies.id, id), eq(companies.userId, userId)))
    .get();
  if (!company) throw new Response("Not found", { status: 404 });
  const companyApplications = db
    .select({
      id: applications.id,
      jobTitle: applications.jobTitle,
      status: applications.status,
      appliedAt: applications.appliedAt,
    })
    .from(applications)
    .where(
      and(
        eq(applications.userId, userId),
        eq(applications.companyId, id),
      ),
    )
    .orderBy(desc(applications.updatedAt))
    .all();
  return { company, applications: companyApplications };
}

export async function action({ request, params }: Route.ActionArgs) {
  const userId = await requireUserId(request);
  const id = Number(params.id);
  const form = await request.formData();
  const _action = form.get("_action");
  if (_action === "delete") {
    db.delete(companies)
      .where(and(eq(companies.id, id), eq(companies.userId, userId)))
      .run();
    return redirect("/companies");
  }
  return new Response("Bad request", { status: 400 });
}

export default function CompanyDetail() {
  const { company, applications } = useLoaderData<typeof loader>();

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4 min-w-0">
          {company.logoUrl ? (
            <img
              src={company.logoUrl}
              alt=""
              className="h-14 w-14 rounded object-cover bg-gray-100 dark:bg-gray-800"
            />
          ) : (
            <div className="h-14 w-14 rounded bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 text-lg font-medium">
              {company.name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white truncate">
              {company.name}
            </h2>
            {company.tagline && (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {company.tagline}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            to={`/companies/${company.id}/edit`}
            className="rounded border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            Edit
          </Link>
          <Form
            method="post"
            onSubmit={(e) => {
              if (!confirm(`Delete "${company.name}"?`)) e.preventDefault();
            }}
          >
            <input type="hidden" name="_action" value="delete" />
            <button
              type="submit"
              className="rounded border border-red-300 dark:border-red-700 px-3 py-1.5 text-sm font-medium text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950"
            >
              Delete
            </button>
          </Form>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
        <Meta label="Industry" value={company.industry} />
        <Meta label="Location" value={company.location} />
        <Meta label="Size" value={company.size ? `${company.size} employees` : null} />
      </div>

      <Section title="Tech stack">
        <div className="flex flex-wrap gap-2">
          {(company.techStack ?? []).length === 0 ? (
            <span className="text-sm text-gray-500">None yet.</span>
          ) : (
            (company.techStack ?? []).map((t, i) => (
              <span
                key={i}
                className="inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2.5 py-1 text-xs"
              >
                {t}
              </span>
            ))
          )}
        </div>
      </Section>

      {company.values && <Section title="Values"><Paragraph value={company.values} /></Section>}
      {company.culture && <Section title="Culture"><Paragraph value={company.culture} /></Section>}

      {(company.recentNews ?? []).length > 0 && (
        <Section title="Recent news">
          <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700 dark:text-gray-300">
            {(company.recentNews ?? []).map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </Section>
      )}

      {company.notableProjects && (
        <Section title="Notable projects">
          <Paragraph value={company.notableProjects} />
        </Section>
      )}

      {company.notes && (
        <Section title="Notes">
          <Paragraph value={company.notes} />
        </Section>
      )}

      <Section title={`Applications (${applications.length})`}>
        {applications.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No applications for this company yet.{" "}
            <Link
              to="/applications"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              Track one
            </Link>
            .
          </p>
        ) : (
          <ul className="space-y-1.5">
            {applications.map((a) => (
              <li key={a.id}>
                <Link
                  to={`/applications/${a.id}`}
                  className="flex items-center justify-between rounded bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <span className="text-gray-900 dark:text-white">
                    {a.jobTitle}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {a.status}
                    {a.appliedAt && ` · ${a.appliedAt.slice(0, 10)}`}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="rounded bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 px-3 py-2">
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
        {title}
      </h3>
      {children}
    </div>
  );
}

function Paragraph({ value }: { value: string }) {
  return (
    <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
      {value}
    </p>
  );
}
