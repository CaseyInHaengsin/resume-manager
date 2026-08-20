import { db } from "~/db";
import { jobs, bullets } from "~/db/schema";
import { and, eq } from "drizzle-orm";
import { requireUserId } from "~/lib/auth.server";
import type { Route } from "./+types/api.jobs";

export async function action({ request }: Route.ActionArgs) {
  const userId = await requireUserId(request);
  const form = await request.formData();
  const _action = form.get("_action") as string;

  if (_action === "create") {
    const count = db
      .select()
      .from(jobs)
      .where(eq(jobs.userId, userId))
      .all().length;
    db.insert(jobs)
      .values({
        userId,
        title: "New Position",
        company: "Company",
        dates: "Start – End",
        location: "Location",
        sortOrder: count,
      })
      .run();
  }

  if (_action === "update") {
    const id = Number(form.get("id"));
    db.update(jobs)
      .set({
        title: form.get("title") as string,
        company: form.get("company") as string,
        dates: form.get("dates") as string,
        location: form.get("location") as string,
      })
      .where(and(eq(jobs.id, id), eq(jobs.userId, userId)))
      .run();
  }

  if (_action === "delete") {
    const id = Number(form.get("id"));
    // Only delete if this job belongs to the user; bullets scoped too.
    db.delete(bullets)
      .where(
        and(
          eq(bullets.parentType, "job"),
          eq(bullets.parentId, id),
          eq(bullets.userId, userId),
        ),
      )
      .run();
    db.delete(jobs)
      .where(and(eq(jobs.id, id), eq(jobs.userId, userId)))
      .run();
  }

  return null;
}
