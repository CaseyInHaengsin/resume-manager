import { useEffect, useMemo, useState } from "react";
import {
  Form,
  Link,
  redirect,
  useFetcher,
  useLoaderData,
  useSearchParams,
} from "react-router";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "~/db";
import { companies, networkContacts } from "~/db/schema";
import { requireUserId } from "~/lib/auth.server";
import {
  NetworkImportError,
  importNetwork,
  parseNetworkCsv,
} from "~/lib/network-import.server";
import type { Route } from "./+types/network";

export async function loader({ request }: Route.LoaderArgs) {
  const userId = await requireUserId(request);
  const contacts = db
    .select({
      id: networkContacts.id,
      name: networkContacts.name,
      headline: networkContacts.headline,
      notes: networkContacts.notes,
      companyId: networkContacts.companyId,
      companyName: companies.name,
    })
    .from(networkContacts)
    .leftJoin(companies, eq(companies.id, networkContacts.companyId))
    .where(eq(networkContacts.userId, userId))
    // Unaffiliated contacts sort after everyone with a company.
    .orderBy(
      sql`${companies.name} IS NULL`,
      sql`${companies.name} COLLATE NOCASE`,
      sql`${networkContacts.name} COLLATE NOCASE`,
    )
    .all();
  const companyList = db
    .select({ id: companies.id, name: companies.name })
    .from(companies)
    .where(eq(companies.userId, userId))
    .orderBy(asc(sql`${companies.name} COLLATE NOCASE`))
    .all();
  return { contacts, companies: companyList };
}

const bannerUrl = (status: string, msg?: string) =>
  `/network?import=${status}${msg ? `&msg=${encodeURIComponent(msg)}` : ""}`;

export async function action({ request }: Route.ActionArgs) {
  const userId = await requireUserId(request);
  const form = await request.formData();
  const _action = form.get("_action");

  if (_action === "import_csv") {
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0)
      return redirect(bannerUrl("missing"));
    try {
      const { rows, skipped } = parseNetworkCsv(await file.text());
      const r = importNetwork(userId, rows);
      const msg =
        `${r.contactsCreated} contacts added, ${r.contactsUpdated} updated, ` +
        `${r.companiesCreated} companies created` +
        (skipped ? `, ${skipped} rows skipped (no name)` : "");
      return redirect(bannerUrl("ok", msg));
    } catch (e) {
      const msg =
        e instanceof NetworkImportError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Import failed";
      return redirect(bannerUrl("err", msg));
    }
  }

  const id = Number(form.get("id"));
  const owned = and(
    eq(networkContacts.id, id),
    eq(networkContacts.userId, userId),
  );

  if (_action === "update_contact") {
    const companyRaw = String(form.get("companyId") ?? "");
    let companyId: number | null = null;
    if (companyRaw) {
      // Only accept a company the user owns.
      const c = db
        .select({ id: companies.id })
        .from(companies)
        .where(
          and(
            eq(companies.id, Number(companyRaw)),
            eq(companies.userId, userId),
          ),
        )
        .get();
      if (!c) return new Response("Unknown company", { status: 400 });
      companyId = c.id;
    }
    const text = (k: string) => String(form.get(k) ?? "").trim() || null;
    db.update(networkContacts)
      .set({
        companyId,
        headline: text("headline"),
        notes: text("notes"),
        updatedAt: new Date().toISOString(),
      })
      .where(owned)
      .run();
    return { ok: true };
  }

  if (_action === "delete_contact") {
    db.delete(networkContacts).where(owned).run();
    return { ok: true };
  }

  return new Response("Unknown action", { status: 400 });
}

type Contact = ReturnType<typeof useLoaderData<typeof loader>>["contacts"][number];
type CompanyOption = { id: number; name: string };

const UNAFFILIATED = "none";

export default function Network() {
  const { contacts, companies } = useLoaderData<typeof loader>();
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const companyFilter = params.get("company") ?? "";
  const importStatus = params.get("import");
  const importMsg = params.get("msg");

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    next.delete("import");
    next.delete("msg");
    if (!value) next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };

  const filtered = useMemo(() => {
    let list = contacts;
    if (companyFilter === UNAFFILIATED)
      list = list.filter((c) => c.companyId == null);
    else if (companyFilter)
      list = list.filter((c) => String(c.companyId ?? "") === companyFilter);
    const needle = q.trim().toLowerCase();
    if (needle)
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(needle) ||
          (c.headline ?? "").toLowerCase().includes(needle) ||
          (c.companyName ?? "").toLowerCase().includes(needle),
      );
    return list;
  }, [contacts, companyFilter, q]);

  // Only offer companies that someone in the network works at.
  const companiesWithContacts = useMemo(() => {
    const ids = new Set(contacts.map((c) => c.companyId));
    return companies.filter((c) => ids.has(c.id));
  }, [contacts, companies]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Network
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {contacts.length} contacts at {companiesWithContacts.length}{" "}
            companies
          </p>
        </div>
      </div>

      {importStatus === "ok" && (
        <div className="mb-4 rounded border border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950/40 p-3 text-sm text-green-900 dark:text-green-200">
          Import complete: {importMsg}.
        </div>
      )}
      {importStatus === "missing" && (
        <div className="mb-4 rounded border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 p-3 text-sm text-amber-900 dark:text-amber-200">
          Choose a CSV file to import.
        </div>
      )}
      {importStatus === "err" && (
        <div className="mb-4 rounded border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-900 dark:text-red-200">
          Import failed: {importMsg ?? "unknown error"}
        </div>
      )}

      <section className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
        <h3 className="text-sm font-medium text-gray-900 dark:text-white">
          Import from CSV
        </h3>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Columns: <code>Name</code>, <code>Company</code>, and optionally{" "}
          <code>Headline</code>. Missing companies are created. Re-importing
          merges by name and never deletes; a company you assigned by hand is
          kept when the CSV row has none.
        </p>
        <Form
          method="post"
          encType="multipart/form-data"
          className="mt-3 flex flex-wrap items-center gap-3"
        >
          <input type="hidden" name="_action" value="import_csv" />
          <input
            type="file"
            name="file"
            accept="text/csv,.csv"
            required
            className="text-sm text-gray-700 dark:text-gray-300 file:mr-3 file:rounded file:border-0 file:bg-gray-100 dark:file:bg-gray-800 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-gray-900 dark:file:text-gray-100 hover:file:bg-gray-200 dark:hover:file:bg-gray-700"
          />
          <button
            type="submit"
            className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Import
          </button>
        </Form>
      </section>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={q}
          onChange={(e) => setParam("q", e.target.value || null)}
          placeholder="Search name, company, headline…"
          className="w-64 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-xs text-gray-900 dark:text-white"
        />
        <select
          value={companyFilter}
          onChange={(e) => setParam("company", e.target.value || null)}
          className="rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-xs text-gray-900 dark:text-white"
        >
          <option value="">All companies</option>
          <option value={UNAFFILIATED}>Unaffiliated</option>
          {companiesWithContacts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {(q || companyFilter) && (
          <button
            onClick={() => setParams(new URLSearchParams(), { replace: true })}
            className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            Clear
          </button>
        )}
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {filtered.length} shown
        </span>
      </div>

      <div className="mt-4">
        {filtered.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-12">
            {contacts.length === 0
              ? "No contacts yet. Import a CSV to get started."
              : "No contacts match."}
          </p>
        ) : (
          <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/50 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                <tr>
                  <th className="text-left px-3 py-2">Name</th>
                  <th className="text-left px-3 py-2">Company</th>
                  <th className="text-left px-3 py-2">Headline</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filtered.map((c) => (
                  <ContactRow key={c.id} contact={c} companies={companies} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const inputClasses =
  "w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-xs text-gray-900 dark:text-white";

function ContactRow({
  contact: c,
  companies,
}: {
  contact: Contact;
  companies: CompanyOption[];
}) {
  const fetcher = useFetcher();
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) setEditing(false);
  }, [fetcher.state, fetcher.data]);

  if (editing) {
    return (
      <tr className="bg-gray-50 dark:bg-gray-800/50">
        <td colSpan={4} className="px-3 py-2">
          <fetcher.Form method="post" className="grid gap-2 sm:grid-cols-4">
            <input type="hidden" name="_action" value="update_contact" />
            <input type="hidden" name="id" value={c.id} />
            <span className="self-center font-medium text-gray-900 dark:text-white">
              {c.name}
            </span>
            <select
              name="companyId"
              defaultValue={c.companyId ?? ""}
              className={inputClasses}
            >
              <option value="">— No company —</option>
              {companies.map((co) => (
                <option key={co.id} value={co.id}>
                  {co.name}
                </option>
              ))}
            </select>
            <input
              name="headline"
              defaultValue={c.headline ?? ""}
              placeholder="Headline"
              className={inputClasses}
            />
            <input
              name="notes"
              defaultValue={c.notes ?? ""}
              placeholder="Notes"
              className={inputClasses}
            />
            <div className="sm:col-span-4 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700"
              >
                Save
              </button>
            </div>
          </fetcher.Form>
        </td>
      </tr>
    );
  }

  const deleting = fetcher.formData?.get("_action") === "delete_contact";
  if (deleting) return null;

  return (
    <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
      <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">
        {c.name}
        {c.notes && (
          <p className="text-xs font-normal text-gray-500 dark:text-gray-400">
            {c.notes}
          </p>
        )}
      </td>
      <td className="px-3 py-2 text-gray-700 dark:text-gray-300">
        {c.companyId != null ? (
          <Link to={`/companies/${c.companyId}`} className="hover:underline">
            {c.companyName}
          </Link>
        ) : (
          "—"
        )}
      </td>
      <td className="px-3 py-2 text-gray-700 dark:text-gray-300">
        {c.headline ?? "—"}
      </td>
      <td className="px-3 py-2 text-right whitespace-nowrap">
        <button
          onClick={() => setEditing(true)}
          className="text-xs text-blue-600 hover:underline dark:text-blue-400"
        >
          Edit
        </button>
        <fetcher.Form
          method="post"
          className="inline"
          onSubmit={(e) => {
            if (!window.confirm(`Remove ${c.name} from your network?`))
              e.preventDefault();
          }}
        >
          <input type="hidden" name="_action" value="delete_contact" />
          <input type="hidden" name="id" value={c.id} />
          <button
            type="submit"
            className="ml-3 text-xs text-red-600 hover:underline dark:text-red-400"
          >
            Delete
          </button>
        </fetcher.Form>
      </td>
    </tr>
  );
}
