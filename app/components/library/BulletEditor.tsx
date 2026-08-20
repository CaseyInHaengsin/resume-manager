import { useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";
import type { InferSelectModel } from "drizzle-orm";
import type { bullets } from "~/db/schema";
import { ConfirmButton } from "../ConfirmButton";

type Bullet = InferSelectModel<typeof bullets>;

const priorityColors: Record<number, string> = {
  0: "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400",
  1: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  2: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  3: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
};

export function BulletEditor({ bullet }: { bullet: Bullet }) {
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
    const deleteFormId = `bullet-delete-${bullet.id}`;
    return (
      <div className="rounded border border-blue-200 bg-blue-50 p-3 space-y-2 dark:bg-blue-950 dark:border-blue-800">
        <fetcher.Form method="post" action="/api/bullets" className="space-y-2">
          <input type="hidden" name="_action" value="update" />
          <input type="hidden" name="id" value={bullet.id} />
          <textarea
            name="text"
            defaultValue={bullet.text}
            rows={2}
            className="w-full rounded border px-2 py-1 text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-white"
          />
          <div className="flex gap-2">
            <input
              name="tags"
              defaultValue={(bullet.tags as string[]).join(", ")}
              placeholder="Tags (comma-separated)"
              className="flex-1 rounded border px-2 py-1 text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-white"
            />
            <select
              name="priority"
              defaultValue={bullet.priority}
              className="rounded border px-2 py-1 text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-white"
            >
              <option value="0">P0 (filler)</option>
              <option value="1">P1 (secondary)</option>
              <option value="2">P2 (strong)</option>
              <option value="3">P3 (flagship)</option>
            </select>
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
            <ConfirmButton
              formId={deleteFormId}
              title="Delete this bullet?"
              className="ml-auto text-xs text-red-600 hover:underline dark:text-red-400"
            >
              Delete
            </ConfirmButton>
          </div>
        </fetcher.Form>
        <fetcher.Form id={deleteFormId} method="post" action="/api/bullets">
          <input type="hidden" name="_action" value="delete" />
          <input type="hidden" name="id" value={bullet.id} />
        </fetcher.Form>
      </div>
    );
  }

  return (
    <div
      className="group flex items-start gap-2 rounded px-2 py-1.5 hover:bg-gray-50 cursor-pointer dark:hover:bg-gray-800"
      onClick={() => setEditing(true)}
    >
      <span
        className={`shrink-0 mt-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium ${priorityColors[bullet.priority] || priorityColors[0]}`}
      >
        P{bullet.priority}
      </span>
      <span className="text-sm text-gray-800 dark:text-gray-200">
        {bullet.text}
      </span>
    </div>
  );
}
