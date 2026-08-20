import { useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";
import { BulletEditor } from "./BulletEditor";
import { ConfirmButton } from "../ConfirmButton";
import type { InferSelectModel } from "drizzle-orm";
import type { projects, bullets } from "~/db/schema";

type Project = InferSelectModel<typeof projects>;
type Bullet = InferSelectModel<typeof bullets>;

export function ProjectCard({
  project,
  bullets: projectBullets,
}: {
  project: Project;
  bullets: Bullet[];
}) {
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
            {project.name}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {project.dates} | {project.tech}
          </p>
        </div>
        <div className="flex items-center gap-2 ml-4 shrink-0">
          <span className="text-xs text-gray-400">
            {projectBullets.length} bullets
          </span>
          <span className="text-gray-400">{expanded ? "−" : "+"}</span>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 dark:border-gray-800 px-4 py-3">
          {editing ? (
            <fetcher.Form
              method="post"
              action="/api/projects"
              className="space-y-2 mb-4"
            >
              <input type="hidden" name="_action" value="update" />
              <input type="hidden" name="id" value={project.id} />
              <input
                name="name"
                defaultValue={project.name}
                placeholder="Project name"
                className="w-full rounded border px-2 py-1 text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-white"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  name="dates"
                  defaultValue={project.dates}
                  placeholder="Dates"
                  className="rounded border px-2 py-1 text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                />
                <input
                  name="tech"
                  defaultValue={project.tech}
                  placeholder="Tech stack"
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
                Edit Project
              </button>
              <fetcher.Form id={`project-delete-${project.id}`} method="post" action="/api/projects">
                <input type="hidden" name="_action" value="delete" />
                <input type="hidden" name="id" value={project.id} />
              </fetcher.Form>
              <ConfirmButton
                formId={`project-delete-${project.id}`}
                title="Delete this project?"
                message="This will also delete all bullets on this project."
                className="text-xs text-red-600 hover:underline dark:text-red-400"
              >
                Delete Project
              </ConfirmButton>
            </div>
          )}

          <div className="space-y-2">
            {projectBullets.map((bullet) => (
              <BulletEditor key={bullet.id} bullet={bullet} />
            ))}
          </div>

          <fetcher.Form method="post" action="/api/bullets" className="mt-3">
            <input type="hidden" name="_action" value="create" />
            <input type="hidden" name="parentType" value="project" />
            <input type="hidden" name="parentId" value={project.id} />
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
