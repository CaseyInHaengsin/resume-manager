import { Form, Link, redirect, useLoaderData } from "react-router";
import { db } from "~/db";
import {
  applications,
  companies,
  resumes,
  APPLICATION_STATUSES,
} from "~/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { requireUserId } from "~/lib/auth.server";
import type { Route } from "./+types/applications.$id";

export async function loader({ request, params }: Route.LoaderArgs) {
  const userId = await requireUserId(request);
  const id = Number(params.id);
  const app = db
    .select()
    .from(applications)
    .where(and(eq(applications.id, id), eq(applications.userId, userId)))
    .get();
  if (!app) throw new Response("Not found", { status: 404 });
  const userCompanies = db
    .select({ id: companies.id, name: companies.name })
    .from(companies)
    .where(eq(companies.userId, userId))
    .orderBy(asc(companies.name))
    .all();
  const userResumes = db
    .select({ id: resumes.id, name: resumes.name })
    .from(resumes)
    .where(eq(resumes.userId, userId))
    .orderBy(asc(resumes.name))
    .all();
  return { app, companies: userCompanies, resumes: userResumes };
}

export async function action({ request, params }: Route.ActionArgs) {
  const userId = await requireUserId(request);
  const id = Number(params.id);
  const form = await request.formData();
  if (form.get("_action") === "delete") {
    db.delete(applications)
      .where(
        and(eq(applications.id, id), eq(applications.userId, userId)),
      )
      .run();
    return redirect("/applications");
  }
  return new Response("Bad request", { status: 400 });
}

export default function ApplicationDetail() {
  const { app, companies, resumes } = useLoaderData<typeof loader>();
  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Application
        </h2>
        <Link
          to="/applications"
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          ← Back to board
        </Link>
      </div>

      <Form
        method="post"
        action="/api/applications"
        className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-5 space-y-4"
      >
        <input type="hidden" name="_action" value="update" />
        <input type="hidden" name="id" value={app.id} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field
            label="Job title *"
            name="jobTitle"
            required
            defaultValue={app.jobTitle}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Status
            </label>
            <select
              name="status"
              defaultValue={app.status}
              className="w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white"
            >
              {APPLICATION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {titleCase(s)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Company"
            name="companyId"
            defaultValue={app.companyId != null ? String(app.companyId) : ""}
            options={[
              { value: "", label: "— None —" },
              ...companies.map((c) => ({
                value: String(c.id),
                label: c.name,
              })),
            ]}
          />
          <Select
            label="Resume used"
            name="resumeId"
            defaultValue={app.resumeId != null ? String(app.resumeId) : ""}
            options={[
              { value: "", label: "— None —" },
              ...resumes.map((r) => ({
                value: String(r.id),
                label: r.name,
              })),
            ]}
          />
        </div>

        <Field
          label="Job URL"
          name="jobUrl"
          defaultValue={app.jobUrl ?? ""}
          placeholder="https://..."
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field
            label="Source"
            name="source"
            defaultValue={app.source ?? ""}
            placeholder="LinkedIn, referral, board..."
          />
          <Field
            label="Location"
            name="location"
            defaultValue={app.location ?? ""}
          />
          <Field
            label="Salary range"
            name="salaryRange"
            defaultValue={app.salaryRange ?? ""}
            placeholder="$180-220k"
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            name="remote"
            value="1"
            defaultChecked={app.remote}
          />
          Remote
        </label>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <DateField
            label="Applied at"
            name="appliedAt"
            defaultValue={app.appliedAt ?? ""}
          />
          <DateField
            label="Next step"
            name="nextStepAt"
            defaultValue={app.nextStepAt ?? ""}
          />
          <DateField
            label="Last contact"
            name="lastContactAt"
            defaultValue={app.lastContactAt ?? ""}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Notes
          </label>
          <textarea
            name="notes"
            defaultValue={app.notes ?? ""}
            rows={6}
            className="w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white resize-y font-mono"
            placeholder={"2026-04-16 — applied via LinkedIn\n2026-04-20 — screen scheduled with Taylor (recruiter)"}
          />
        </div>

        <div className="flex justify-end gap-3 pt-2 border-t border-gray-200 dark:border-gray-800">
          <Link
            to="/applications"
            className="rounded border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            Cancel
          </Link>
          <button
            type="submit"
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Save
          </button>
        </div>
      </Form>

      <Form
        method="post"
        onSubmit={(e) => {
          if (!confirm(`Delete application for "${app.jobTitle}"?`))
            e.preventDefault();
        }}
        className="text-right"
      >
        <input type="hidden" name="_action" value="delete" />
        <button
          type="submit"
          className="text-sm text-red-600 dark:text-red-400 hover:underline"
        >
          Delete application
        </button>
      </Form>
    </div>
  );
}

function titleCase(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function Field({
  label,
  name,
  required,
  defaultValue,
  placeholder,
}: {
  label: string;
  name: string;
  required?: boolean;
  defaultValue?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}
      </label>
      <input
        type="text"
        name={name}
        required={required}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white"
      />
    </div>
  );
}

function DateField({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue?: string;
}) {
  // Strip to YYYY-MM-DD if an ISO timestamp slipped in
  const v = defaultValue ? defaultValue.slice(0, 10) : "";
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}
      </label>
      <input
        type="date"
        name={name}
        defaultValue={v}
        className="w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white"
      />
    </div>
  );
}

function Select({
  label,
  name,
  defaultValue,
  options,
}: {
  label: string;
  name: string;
  defaultValue: string;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}
      </label>
      <select
        name={name}
        defaultValue={defaultValue}
        className="w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
