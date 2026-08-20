import { redirect, useActionData, useLoaderData } from "react-router";
import { db } from "~/db";
import { companies } from "~/db/schema";
import { and, eq } from "drizzle-orm";
import { requireUserId } from "~/lib/auth.server";
import { parseCompanyForm } from "~/lib/companies.server";
import { saveUpload, validateImage } from "~/lib/uploads.server";
import { CompanyForm } from "~/components/companies/CompanyForm";
import type { Route } from "./+types/companies.$id.edit";

export async function loader({ request, params }: Route.LoaderArgs) {
  const userId = await requireUserId(request);
  const id = Number(params.id);
  const company = db
    .select()
    .from(companies)
    .where(and(eq(companies.id, id), eq(companies.userId, userId)))
    .get();
  if (!company) throw new Response("Not found", { status: 404 });
  return { company };
}

export async function action({ request, params }: Route.ActionArgs) {
  const userId = await requireUserId(request);
  const id = Number(params.id);
  const form = await request.formData();

  let logoUrl: string | null = null;
  const logo = form.get("logo");
  if (logo instanceof File) {
    const err = validateImage(logo);
    if (err) return { error: err };
    if (logo.size > 0) logoUrl = await saveUpload(logo, userId);
  }

  let payload;
  try {
    payload = parseCompanyForm(form);
  } catch (e) {
    if (e instanceof Response) return { error: await e.text() };
    throw e;
  }
  if (logoUrl) payload.logoUrl = logoUrl;

  db.update(companies)
    .set({ ...payload, updatedAt: new Date().toISOString() })
    .where(and(eq(companies.id, id), eq(companies.userId, userId)))
    .run();
  return redirect(`/companies/${id}`);
}

export default function EditCompany() {
  const { company } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  return (
    <div className="max-w-3xl mx-auto">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
        Edit Company
      </h2>
      <CompanyForm
        submitLabel="Save"
        cancelHref={`/companies/${company.id}`}
        defaultValues={company}
        encType="multipart/form-data"
        error={actionData?.error}
      />
    </div>
  );
}
