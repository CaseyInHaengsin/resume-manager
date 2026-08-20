import { db } from "~/db";
import { projects, bullets } from "~/db/schema";
import { and, eq } from "drizzle-orm";
import { requireUserId } from "~/lib/auth.server";
import type { Route } from "./+types/api.projects";

export async function action({ request }: Route.ActionArgs) {
  const userId = await requireUserId(request);
  const form = await request.formData();
  const _action = form.get("_action") as string;

  if (_action === "create") {
    const count = db
      .select()
      .from(projects)
      .where(eq(projects.userId, userId))
      .all().length;
    db.insert(projects)
      .values({
        userId,
        name: "New Project",
        dates: "2025",
        tech: "Tech Stack",
        sortOrder: count,
      })
      .run();
  }

  if (_action === "update") {
    const id = Number(form.get("id"));
    db.update(projects)
      .set({
        name: form.get("name") as string,
        dates: form.get("dates") as string,
        tech: form.get("tech") as string,
      })
      .where(and(eq(projects.id, id), eq(projects.userId, userId)))
      .run();
  }

  if (_action === "delete") {
    const id = Number(form.get("id"));
    db.delete(bullets)
      .where(
        and(
          eq(bullets.parentType, "project"),
          eq(bullets.parentId, id),
          eq(bullets.userId, userId),
        ),
      )
      .run();
    db.delete(projects)
      .where(and(eq(projects.id, id), eq(projects.userId, userId)))
      .run();
  }

  return null;
}
