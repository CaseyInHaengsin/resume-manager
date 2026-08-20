import { useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";
import { BulletEditor } from "./BulletEditor";
import { ConfirmButton } from "../ConfirmButton";
import type { InferSelectModel } from "drizzle-orm";
import type { jobs, bullets } from "~/db/schema";

type Job = InferSelectModel<typeof jobs>;
type Bullet = InferSelectModel<typeof bullets>;

export function JobCard({ job, bullets: jobBullets }: { job: Job; bullets: Bullet[] }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const fetcher = useFetcher();
  const wasSubmitting = useRef(false);

  useEffect(() => {
    if (fetcher.state === "submitting") wasSubmitting.current = true;
    if (fetcher.state === "idle" && wasSubmitting.current) {
      wasSubmitting.current = false;
      setEditing(false);
    }
  }, [fetcher.state]);

  return (
    <div className="rounded-lg border border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-700">
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="min-w-0">
          <h3 className="font-medium text-gray-900 dark:text-white truncate">
            {job.title}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {job.company} | {job.dates} | {job.location}
          </p>
        </div>
        <div className="flex items-center gap-2 ml-4 shrink-0">
          <span className="text-xs text-gray-400">
            {jobBullets.length} bullets
          </span>
          <span className="text-gray-400">{expanded ? "−" : "+"}</span>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 dark:border-gray-800 px-4 py-3">
          {/* Inline job editing */}
          {editing ? (
            <fetcher.Form method="post" action="/api/jobs" className="space-y-2 mb-4">
              <input type="hidden" name="_action" value="update" />
              <input type="hidden" name="id" value={job.id} />
              <div className="grid grid-cols-2 gap-2">
                <input
                  name="title"
                  defaultValue={job.title}
                  placeholder="Title"
                  className="rounded border px-2 py-1 text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                />
                <input
                  name="company"
                  defaultValue={job.company}
                  placeholder="Company"
                  className="rounded border px-2 py-1 text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                />
                <input
                  name="dates"
                  defaultValue={job.dates}
                  placeholder="Dates"
                  className="rounded border px-2 py-1 text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                />
                <input
                  name="location"
                  defaultValue={job.location}
                  placeholder="Location"
                  className="rounded border px-2 py-1 text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="rounded border px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:border-gray-600 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
              </div>
            </fetcher.Form>
          ) : (
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setEditing(true)}
                className="text-xs text-blue-600 hover:underline dark:text-blue-400"
              >
                Edit Job
              </button>
              <fetcher.Form id={`job-delete-${job.id}`} method="post" action="/api/jobs">
                <input type="hidden" name="_action" value="delete" />
                <input type="hidden" name="id" value={job.id} />
              </fetcher.Form>
              <ConfirmButton
                formId={`job-delete-${job.id}`}
                title="Delete this job?"
                message="This will also delete all bullets on this job."
                className="text-xs text-red-600 hover:underline dark:text-red-400"
              >
                Delete Job
              </ConfirmButton>
            </div>
          )}

          {/* Bullets */}
          <div className="space-y-2">
            {jobBullets.map((bullet) => (
              <BulletEditor key={bullet.id} bullet={bullet} />
            ))}
          </div>

          {/* Add bullet */}
          <fetcher.Form method="post" action="/api/bullets" className="mt-3">
            <input type="hidden" name="_action" value="create" />
            <input type="hidden" name="parentType" value="job" />
            <input type="hidden" name="parentId" value={job.id} />
            <button
              type="submit"
              className="text-xs text-blue-600 hover:underline dark:text-blue-400"
            >
              + Add Bullet
            </button>
          </fetcher.Form>
        </div>
      )}
    </div>
  );
}
