import { useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";
import type { InferSelectModel } from "drizzle-orm";
import type { skills } from "~/db/schema";
import { ConfirmButton } from "../ConfirmButton";

type Skill = InferSelectModel<typeof skills>;

function SkillItem({ skill }: { skill: Skill }) {
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
    const deleteFormId = `skill-delete-${skill.id}`;
    return (
      <div className="rounded border border-blue-200 bg-blue-50 p-3 space-y-2 dark:bg-blue-950 dark:border-blue-800">
        <fetcher.Form method="post" action="/api/skills" className="space-y-2">
          <input type="hidden" name="_action" value="update" />
          <input type="hidden" name="id" value={skill.id} />
          <div className="grid grid-cols-2 gap-2">
            <input
              name="category"
              defaultValue={skill.category}
              placeholder="Category (e.g. languages)"
              className="rounded border px-2 py-1 text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-white"
            />
            <input
              name="name"
              defaultValue={skill.name}
              placeholder="Variant name (e.g. elixir_first)"
              className="rounded border px-2 py-1 text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-white"
            />
          </div>
          <input
            name="items"
            defaultValue={(skill.items as string[]).join(", ")}
            placeholder="Items (comma-separated)"
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
              title="Delete this skill row?"
              className="ml-auto text-xs text-red-600 hover:underline dark:text-red-400"
            >
              Delete
            </ConfirmButton>
          </div>
        </fetcher.Form>
        <fetcher.Form id={deleteFormId} method="post" action="/api/skills">
          <input type="hidden" name="_action" value="delete" />
          <input type="hidden" name="id" value={skill.id} />
        </fetcher.Form>
      </div>
    );
  }

  return (
    <div
      className="rounded border border-gray-200 bg-white px-4 py-3 cursor-pointer hover:bg-gray-50 dark:bg-gray-900 dark:border-gray-700 dark:hover:bg-gray-800"
      onClick={() => setEditing(true)}
    >
      <p className="text-sm text-gray-500 dark:text-gray-400">
        <span className="font-medium text-gray-700 dark:text-gray-300">
          {skill.category}
        </span>
        {skill.name !== "default" && (
          <span className="ml-1 text-xs">({skill.name})</span>
        )}
      </p>
      <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
        {(skill.items as string[]).join(", ")}
      </p>
    </div>
  );
}

export function SkillList({ skills }: { skills: Skill[] }) {
  return (
    <div className="space-y-2">
      {skills.map((s) => (
        <SkillItem key={s.id} skill={s} />
      ))}
      {skills.length === 0 && (
        <p className="text-sm text-gray-500">No skills yet.</p>
      )}
    </div>
  );
}
