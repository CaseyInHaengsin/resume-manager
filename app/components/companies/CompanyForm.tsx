import { Form, Link } from "react-router";
import { TagInput } from "./TagInput";
import type { companies } from "~/db/schema";

type Company = typeof companies.$inferSelect;

type Props = {
  action?: string;
  method?: "post";
  encType?: "multipart/form-data" | "application/x-www-form-urlencoded";
  defaultValues?: Partial<Company>;
  submitLabel: string;
  cancelHref: string;
  error?: string;
};

const SIZE_OPTIONS = [
  "1-10",
  "11-50",
  "51-200",
  "201-500",
  "501-1000",
  "1000+",
];

export function CompanyForm({
  action,
  method = "post",
  encType,
  defaultValues,
  submitLabel,
  cancelHref,
  error,
}: Props) {
  const dv = defaultValues ?? {};
  return (
    <Form
      method={method}
      action={action}
      encType={encType}
      className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6 space-y-6"
    >
      {error && (
        <div className="rounded border border-red-300 bg-red-50 dark:bg-red-950 dark:border-red-800 px-3 py-2 text-sm text-red-800 dark:text-red-200">
          {error}
        </div>
      )}

      <Section title="Basic info">
        <Field label="Company name *" name="name" required defaultValue={dv.name ?? ""} />
        <Field label="Tagline" name="tagline" defaultValue={dv.tagline ?? ""} placeholder="Brief description" />
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Logo</label>
          <input
            type="file"
            name="logo"
            accept="image/*"
            className="text-sm text-gray-600 dark:text-gray-400"
          />
          {dv.logoUrl && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Current: <span className="font-mono">{dv.logoUrl}</span>
            </p>
          )}
          <input type="hidden" name="existingLogoUrl" value={dv.logoUrl ?? ""} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Industry" name="industry" defaultValue={dv.industry ?? ""} />
          <Field label="Location" name="location" defaultValue={dv.location ?? ""} />
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Size</label>
            <select
              name="size"
              defaultValue={dv.size ?? ""}
              className="w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white"
            >
              <option value="">Select size</option>
              {SIZE_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s} employees
                </option>
              ))}
            </select>
          </div>
        </div>
      </Section>

      <Section title="Tech stack">
        <TagInput
          name="techStack"
          defaultValue={(dv.techStack as string[] | undefined) ?? []}
          label="Technologies used"
          placeholder="Add tech (press Enter)"
        />
      </Section>

      <Section title="Culture & values">
        <TextArea label="Values" name="values" defaultValue={dv.values ?? ""} />
        <TextArea label="Culture" name="culture" defaultValue={dv.culture ?? ""} />
      </Section>

      <Section title="Recent news">
        <TagInput
          name="recentNews"
          defaultValue={(dv.recentNews as string[] | undefined) ?? []}
          label="News items"
          placeholder="Add news (press Enter)"
        />
      </Section>

      <Section title="Additional">
        <TextArea label="Notable projects" name="notableProjects" defaultValue={dv.notableProjects ?? ""} />
        <TextArea label="Personal notes" name="notes" defaultValue={dv.notes ?? ""} />
      </Section>

      <div className="flex justify-end gap-3 pt-2 border-t border-gray-200 dark:border-gray-800">
        <Link
          to={cancelHref}
          className="rounded border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          Cancel
        </Link>
        <button
          type="submit"
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          {submitLabel}
        </button>
      </div>
    </Form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-800 pb-1">
        {title}
      </h3>
      {children}
    </div>
  );
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
  defaultValue?: string | null;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
      <input
        type="text"
        name={name}
        required={required}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        className="w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white"
      />
    </div>
  );
}

function TextArea({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
      <textarea
        name={name}
        defaultValue={defaultValue ?? ""}
        rows={4}
        className="w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white resize-y"
      />
    </div>
  );
}
