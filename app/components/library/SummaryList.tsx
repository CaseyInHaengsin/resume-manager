import { useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";
import type { InferSelectModel } from "drizzle-orm";
import type { summaries } from "~/db/schema";
import { ConfirmButton } from "../ConfirmButton";

type Summary = InferSelectModel<typeof summaries>;

function SummaryItem({ summary }: { summary: Summary }) {
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

  if (editing) {
    const deleteFormId = `summary-delete-${summary.id}`;
    return (
      <div className="rounded border border-blue-200 bg-blue-50 p-3 space-y-2 dark:bg-blue-950 dark:border-blue-800">
        <fetcher.Form method="post" action="/api/summaries" className="space-y-2">
          <input type="hidden" name="_action" value="update" />
          <input type="hidden" name="id" value={summary.id} />
          <input
            name="name"
            defaultValue={summary.name}
            placeholder="Summary name (e.g. API focus)"
            className="w-full rounded border px-2 py-1 text-sm font-medium dark:bg-gray-800 dark:border-gray-600 dark:text-white"
          />
          <textarea
            name="text"
            defaultValue={summary.text}
            rows={3}
            className="w-full rounded border px-2 py-1 text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-white"
          />
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
            <ConfirmButton
              formId={deleteFormId}
              title="Delete this summary?"
              className="ml-auto text-xs text-red-600 hover:underline dark:text-red-400"
            >
              Delete
            </ConfirmButton>
          </div>
        </fetcher.Form>
        <fetcher.Form id={deleteFormId} method="post" action="/api/summaries">
          <input type="hidden" name="_action" value="delete" />
          <input type="hidden" name="id" value={summary.id} />
        </fetcher.Form>
      </div>
    );
  }

  return (
    <div
      className="rounded border border-gray-200 bg-white px-4 py-3 cursor-pointer hover:bg-gray-50 dark:bg-gray-900 dark:border-gray-700 dark:hover:bg-gray-800"
      onClick={() => setEditing(true)}
    >
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {summary.name}
      </p>
      <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
        {summary.text}
      </p>
    </div>
  );
}

export function SummaryList({ summaries }: { summaries: Summary[] }) {
  return (
    <div className="space-y-2">
      {summaries.map((s) => (
        <SummaryItem key={s.id} summary={s} />
      ))}
      {summaries.length === 0 && (
        <p className="text-sm text-gray-500">No summaries yet.</p>
      )}
    </div>
  );
}
