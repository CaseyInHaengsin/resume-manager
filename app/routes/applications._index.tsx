import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  Form,
  Link,
  useFetcher,
  useLoaderData,
  useSearchParams,
} from "react-router";
import { db } from "~/db";
import {
  applications,
  companies,
  resumes,
  APPLICATION_STATUSES,
  type ApplicationStatus,
} from "~/db/schema";
import { and, asc, desc, eq } from "drizzle-orm";
import { requireUserId } from "~/lib/auth.server";
import type { Route } from "./+types/applications._index";

type Row = {
  id: number;
  jobTitle: string;
  status: ApplicationStatus;
  companyId: number | null;
  companyName: string | null;
  resumeId: number | null;
  resumeName: string | null;
  jobUrl: string | null;
  source: string | null;
  location: string | null;
  remote: boolean;
  appliedAt: string | null;
  nextStepAt: string | null;
  lastContactAt: string | null;
  updatedAt: string;
};

function isStatus(s: unknown): s is ApplicationStatus {
  return (
    typeof s === "string" &&
    (APPLICATION_STATUSES as readonly string[]).includes(s)
  );
}

export async function loader({ request }: Route.LoaderArgs) {
  const userId = await requireUserId(request);
  const rows = db
    .select({
      id: applications.id,
      jobTitle: applications.jobTitle,
      status: applications.status,
      companyId: applications.companyId,
      companyName: companies.name,
      resumeId: applications.resumeId,
      resumeName: resumes.name,
      jobUrl: applications.jobUrl,
      source: applications.source,
      location: applications.location,
      remote: applications.remote,
      appliedAt: applications.appliedAt,
      nextStepAt: applications.nextStepAt,
      lastContactAt: applications.lastContactAt,
      updatedAt: applications.updatedAt,
    })
    .from(applications)
    .leftJoin(companies, eq(applications.companyId, companies.id))
    .leftJoin(resumes, eq(applications.resumeId, resumes.id))
    .where(eq(applications.userId, userId))
    .orderBy(desc(applications.updatedAt))
    .all() as Row[];

  const allCompanies = db
    .select({ id: companies.id, name: companies.name })
    .from(companies)
    .where(eq(companies.userId, userId))
    .orderBy(asc(companies.name))
    .all();

  const allResumes = db
    .select({ id: resumes.id, name: resumes.name })
    .from(resumes)
    .where(eq(resumes.userId, userId))
    .orderBy(asc(resumes.name))
    .all();

  return { rows, companies: allCompanies, resumes: allResumes };
}

// ── Follow-up heuristic ──
const DAYS_STALE = 14;

function daysSince(isoDate: string | null): number | null {
  if (!isoDate) return null;
  const then = Date.parse(isoDate);
  if (!Number.isFinite(then)) return null;
  return Math.floor((Date.now() - then) / (1000 * 60 * 60 * 24));
}

type Flag = { kind: "overdue" | "stale"; days: number } | null;
function followUpFlag(row: Row): Flag {
  // overdue: nextStepAt is in the past
  if (row.nextStepAt) {
    const d = daysSince(row.nextStepAt);
    if (d !== null && d > 0) return { kind: "overdue", days: d };
  }
  // stale: applied but no contact in N days
  if (row.status === "applied" && row.appliedAt && !row.lastContactAt) {
    const d = daysSince(row.appliedAt);
    if (d !== null && d >= DAYS_STALE) return { kind: "stale", days: d };
  }
  return null;
}

const STATUS_META: Record<
  ApplicationStatus,
  { label: string; tint: string; badge: string }
> = {
  wishlist: {
    label: "Wishlist",
    tint: "bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700",
    badge: "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300",
  },
  applied: {
    label: "Applied",
    tint: "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900",
    badge: "bg-blue-200 dark:bg-blue-900 text-blue-800 dark:text-blue-200",
  },
  interviewing: {
    label: "Interviewing",
    tint:
      "bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-900",
    badge:
      "bg-purple-200 dark:bg-purple-900 text-purple-800 dark:text-purple-200",
  },
  offer: {
    label: "Offer",
    tint:
      "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900",
    badge: "bg-amber-200 dark:bg-amber-900 text-amber-800 dark:text-amber-200",
  },
  accepted: {
    label: "Accepted",
    tint:
      "bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-900",
    badge: "bg-green-200 dark:bg-green-900 text-green-800 dark:text-green-200",
  },
  rejected: {
    label: "Rejected",
    tint: "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900",
    badge: "bg-rose-200 dark:bg-rose-900 text-rose-800 dark:text-rose-200",
  },
};

export default function ApplicationsIndex() {
  const { rows, companies, resumes } = useLoaderData<typeof loader>();
  const [params, setParams] = useSearchParams();
  const view = (params.get("view") as "kanban" | "list") ?? "kanban";
  const companyFilter = params.get("company") ?? "";
  const followUpOnly = params.get("followup") === "1";

  const filtered = useMemo(() => {
    let list = rows;
    if (companyFilter)
      list = list.filter(
        (r) => String(r.companyId ?? "") === companyFilter,
      );
    if (followUpOnly) list = list.filter((r) => followUpFlag(r) !== null);
    return list;
  }, [rows, companyFilter, followUpOnly]);

  const followUpCount = rows.reduce(
    (n, r) => (followUpFlag(r) ? n + 1 : n),
    0,
  );

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (!value) next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Applications
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {rows.length} total
            {followUpCount > 0 && (
              <>
                {" · "}
                <button
                  onClick={() =>
                    setParam("followup", followUpOnly ? null : "1")
                  }
                  className="text-amber-700 dark:text-amber-300 hover:underline"
                >
                  {followUpCount} need follow-up
                </button>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded border border-gray-300 dark:border-gray-700 overflow-hidden">
            <button
              onClick={() => setParam("view", null)}
              className={`px-3 py-1 text-xs ${
                view === "kanban"
                  ? "bg-blue-600 text-white"
                  : "bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300"
              }`}
            >
              Board
            </button>
            <button
              onClick={() => setParam("view", "list")}
              className={`px-3 py-1 text-xs ${
                view === "list"
                  ? "bg-blue-600 text-white"
                  : "bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300"
              }`}
            >
              List
            </button>
          </div>
        </div>
      </div>

      <QuickAdd companies={companies} resumes={resumes} />

      <div className="mt-4 flex items-center gap-3">
        <label className="text-xs text-gray-600 dark:text-gray-400">
          Filter:
        </label>
        <select
          value={companyFilter}
          onChange={(e) => setParam("company", e.target.value || null)}
          className="rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-xs text-gray-900 dark:text-white"
        >
          <option value="">All companies</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {(companyFilter || followUpOnly) && (
          <button
            onClick={() => {
              setParams(new URLSearchParams(), { replace: true });
            }}
            className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            Clear
          </button>
        )}
      </div>

      <div className="mt-4">
        {view === "kanban" ? (
          <KanbanView rows={filtered} />
        ) : (
          <ListView rows={filtered} />
        )}
      </div>
    </div>
  );
}

function QuickAdd({
  companies,
  resumes,
}: {
  companies: { id: number; name: string }[];
  resumes: { id: number; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const fetcher = useFetcher();
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="w-full text-left text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
        >
          + Quick-add application (job title, company, URL)
        </button>
      ) : (
        <fetcher.Form
          method="post"
          action="/api/applications"
          className="space-y-2"
          onSubmit={() => setOpen(false)}
        >
          <input type="hidden" name="_action" value="create" />
          <input
            type="hidden"
            name="redirectTo"
            value="/applications"
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <input
              name="jobTitle"
              required
              placeholder="Job title *"
              className="rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm text-gray-900 dark:text-white"
              autoFocus
            />
            <select
              name="companyId"
              defaultValue=""
              className="rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm text-gray-900 dark:text-white"
            >
              <option value="">— Company —</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              name="resumeId"
              defaultValue=""
              className="rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm text-gray-900 dark:text-white"
            >
              <option value="">— Resume —</option>
              {resumes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <input
              name="jobUrl"
              placeholder="https://..."
              className="rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm text-gray-900 dark:text-white md:col-span-2"
            />
            <input
              name="source"
              placeholder="Source (LinkedIn, referral, ...)"
              className="rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm text-gray-900 dark:text-white"
            />
          </div>
          <div className="flex items-center justify-between">
            <select
              name="status"
              defaultValue="applied"
              className="rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-xs text-gray-900 dark:text-white"
            >
              {APPLICATION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
              >
                Add application
              </button>
            </div>
          </div>
        </fetcher.Form>
      )}
    </div>
  );
}

function KanbanView({ rows }: { rows: Row[] }) {
  const fetcher = useFetcher();
  const [boardRows, setBoardRows] = useState(rows);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor),
  );

  useEffect(() => {
    setBoardRows(rows);
  }, [rows]);

  const columns = APPLICATION_STATUSES.map((status) => ({
    status,
    rows: boardRows.filter((r) => r.status === status),
  }));

  function handleDragEnd(event: DragEndEvent) {
    const activeId = Number(event.active.id);
    const nextStatus = event.over?.id;

    if (!Number.isFinite(activeId) || !isStatus(nextStatus)) return;

    const row = boardRows.find((r) => r.id === activeId);
    if (!row || row.status === nextStatus) return;

    setBoardRows((current) =>
      current.map((r) =>
        r.id === activeId ? { ...r, status: nextStatus } : r,
      ),
    );

    const formData = new FormData();
    formData.set("_action", "set_status");
    formData.set("id", String(activeId));
    formData.set("status", nextStatus);
    fetcher.submit(formData, { method: "post", action: "/api/applications" });
  }

  return (
    <DndContext
      id="applications-board"
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {columns.map(({ status, rows }) => (
          <KanbanColumn key={status} status={status} rows={rows} />
        ))}
      </div>
    </DndContext>
  );
}

function KanbanColumn({
  status,
  rows,
}: {
  status: ApplicationStatus;
  rows: Row[];
}) {
  const meta = STATUS_META[status];
  const { isOver, setNodeRef } = useDroppable({ id: status });
  return (
    <div
      ref={setNodeRef}
      data-status={status}
      className={`rounded-lg border ${meta.tint} p-2 min-h-[200px] flex flex-col transition ${
        isOver ? "ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-gray-950" : ""
      }`}
    >
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-300">
          {meta.label}
        </span>
        <span
          className={`text-xs font-medium rounded-full px-2 ${meta.badge}`}
        >
          {rows.length}
        </span>
      </div>
      <div className="space-y-2 flex-1">
        {rows.map((r) => (
          <Card key={r.id} row={r} />
        ))}
        {rows.length === 0 && (
          <p className="text-xs text-gray-400 dark:text-gray-600 px-1 italic">
            empty
          </p>
        )}
      </div>
    </div>
  );
}

function Card({ row }: { row: Row }) {
  const flag = followUpFlag(row);
  const fetcher = useFetcher();
  const optimisticStatus =
    (fetcher.formData?.get("status") as ApplicationStatus | null) ??
    row.status;
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: row.id,
      data: { status: row.status },
    });
  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.72 : 1,
    zIndex: isDragging ? 20 : undefined,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      data-application-id={row.id}
      {...attributes}
      {...listeners}
      className={`cursor-grab active:cursor-grabbing rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-2 hover:shadow-sm transition ${
        isDragging ? "shadow-lg ring-2 ring-blue-500" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-1">
        <Link to={`/applications/${row.id}`} className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-900 dark:text-white leading-tight truncate">
            {row.jobTitle}
          </p>
          {row.companyName && (
            <p className="text-xs text-gray-600 dark:text-gray-400 truncate mt-0.5">
              {row.companyName}
            </p>
          )}
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            {row.appliedAt && (
              <span className="text-[10px] text-gray-500 dark:text-gray-400">
                {row.appliedAt.slice(0, 10)}
              </span>
            )}
            {row.resumeName && (
              <span className="text-[10px] rounded bg-gray-100 dark:bg-gray-800 px-1 py-0.5 text-gray-600 dark:text-gray-400 truncate max-w-[100px]">
                {row.resumeName}
              </span>
            )}
            {row.source && (
              <span className="text-[10px] text-gray-500 dark:text-gray-400">
                via {row.source}
              </span>
            )}
          </div>
        </Link>
        <div className="flex shrink-0 items-center gap-1">
          {flag && (
            <span
              className={`text-[9px] font-medium rounded-full px-1.5 py-0.5 ${
                flag.kind === "overdue"
                  ? "bg-red-200 dark:bg-red-900 text-red-800 dark:text-red-200"
                  : "bg-amber-200 dark:bg-amber-900 text-amber-800 dark:text-amber-200"
              }`}
              title={
                flag.kind === "overdue"
                  ? `Next step was ${flag.days}d ago`
                  : `Applied ${flag.days}d ago, no contact`
              }
            >
              {flag.kind === "overdue" ? `!${flag.days}d` : `${flag.days}d`}
            </span>
          )}
          <span
            aria-hidden="true"
            title="Drag to change status"
            className="rounded border border-gray-200 dark:border-gray-700 px-1.5 py-0.5 text-[10px] leading-none text-gray-400 dark:text-gray-500"
          >
            ::
          </span>
        </div>
      </div>
      <fetcher.Form
        method="post"
        action="/api/applications"
        className="mt-1.5"
      >
        <input type="hidden" name="_action" value="set_status" />
        <input type="hidden" name="id" value={row.id} />
        <select
          name="status"
          value={optimisticStatus}
          onPointerDown={(e) => e.stopPropagation()}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
          className="w-full text-[10px] rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-1 py-0.5 text-gray-700 dark:text-gray-300"
        >
          {APPLICATION_STATUSES.map((s) => (
            <option key={s} value={s}>
              → {s}
            </option>
          ))}
        </select>
      </fetcher.Form>
    </div>
  );
}

function ListView({ rows }: { rows: Row[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-12">
        No applications yet.
      </p>
    );
  }
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 dark:bg-gray-800/50 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
          <tr>
            <th className="text-left px-3 py-2">Title</th>
            <th className="text-left px-3 py-2">Company</th>
            <th className="text-left px-3 py-2">Status</th>
            <th className="text-left px-3 py-2">Applied</th>
            <th className="text-left px-3 py-2">Source</th>
            <th className="text-left px-3 py-2">Resume</th>
            <th className="text-left px-3 py-2">Next</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {rows.map((r) => {
            const flag = followUpFlag(r);
            const meta = STATUS_META[r.status];
            return (
              <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-3 py-2">
                  <Link
                    to={`/applications/${r.id}`}
                    className="font-medium text-gray-900 dark:text-white hover:underline"
                  >
                    {r.jobTitle}
                  </Link>
                  {flag && (
                    <span
                      className={`ml-2 text-[9px] rounded-full px-1.5 py-0.5 ${
                        flag.kind === "overdue"
                          ? "bg-red-200 dark:bg-red-900 text-red-800 dark:text-red-200"
                          : "bg-amber-200 dark:bg-amber-900 text-amber-800 dark:text-amber-200"
                      }`}
                    >
                      {flag.kind === "overdue" ? "overdue" : "follow-up"}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-gray-700 dark:text-gray-300">
                  {r.companyName ?? "—"}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`text-[10px] rounded-full px-2 py-0.5 ${meta.badge}`}
                  >
                    {meta.label}
                  </span>
                </td>
                <td className="px-3 py-2 text-gray-700 dark:text-gray-300">
                  {r.appliedAt?.slice(0, 10) ?? "—"}
                </td>
                <td className="px-3 py-2 text-gray-700 dark:text-gray-300">
                  {r.source ?? "—"}
                </td>
                <td className="px-3 py-2 text-gray-700 dark:text-gray-300">
                  {r.resumeName ?? "—"}
                </td>
                <td className="px-3 py-2 text-gray-700 dark:text-gray-300">
                  {r.nextStepAt?.slice(0, 10) ?? "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
