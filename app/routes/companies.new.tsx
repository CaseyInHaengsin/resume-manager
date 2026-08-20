import { redirect, useActionData } from "react-router";
import { db } from "~/db";
import { companies } from "~/db/schema";
import { requireUserId } from "~/lib/auth.server";
import { parseCompanyForm } from "~/lib/companies.server";
import { saveUpload, validateImage } from "~/lib/uploads.server";
import { CompanyForm } from "~/components/companies/CompanyForm";
import type { Route } from "./+types/companies.new";

export async function loader({ request }: Route.LoaderArgs) {
  await requireUserId(request);
  return null;
}

export async function action({ request }: Route.ActionArgs) {
  const userId = await requireUserId(request);
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

  const now = new Date().toISOString();
  const inserted = db
    .insert(companies)
    .values({ userId, ...payload, createdAt: now, updatedAt: now })
    .returning({ id: companies.id })
    .get();
  return redirect(`/companies/${inserted.id}`);
}

export default function NewCompany() {
  const actionData = useActionData<typeof action>();
  return (
    <div className="max-w-3xl mx-auto">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
        New Company
      </h2>
      <CompanyForm
        submitLabel="Create"
        cancelHref="/companies"
        encType="multipart/form-data"
        error={actionData?.error}
      />
    </div>
  );
}
