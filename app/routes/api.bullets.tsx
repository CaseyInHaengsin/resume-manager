import { db } from "~/db";
import { bullets } from "~/db/schema";
import { and, eq } from "drizzle-orm";
import { requireUserId } from "~/lib/auth.server";
import type { Route } from "./+types/api.bullets";

export async function action({ request }: Route.ActionArgs) {
  const userId = await requireUserId(request);
  const form = await request.formData();
  const _action = form.get("_action") as string;

  if (_action === "create") {
    const parentType = form.get("parentType") as string;
    const parentId = Number(form.get("parentId"));
    const existing = db
      .select()
      .from(bullets)
      .where(
        and(
          eq(bullets.userId, userId),
          eq(bullets.parentType, parentType),
          eq(bullets.parentId, parentId),
        ),
      )
      .all();
    db.insert(bullets)
      .values({
        userId,
        parentType,
        parentId,
        text: "New bullet — click to edit",
        tags: [],
        priority: 2,
        sortOrder: existing.length,
      })
      .run();
  }

  if (_action === "update") {
    const id = Number(form.get("id"));
    const tagsRaw = (form.get("tags") as string) || "";
    const tags = tagsRaw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    db.update(bullets)
      .set({
        text: form.get("text") as string,
        tags,
        priority: Number(form.get("priority")),
      })
      .where(and(eq(bullets.id, id), eq(bullets.userId, userId)))
      .run();
  }

  if (_action === "delete") {
    const id = Number(form.get("id"));
    db.delete(bullets)
      .where(and(eq(bullets.id, id), eq(bullets.userId, userId)))
      .run();
  }

  return null;
}
