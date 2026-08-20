import { db } from "~/db";
import { skills } from "~/db/schema";
import { and, eq } from "drizzle-orm";
import { requireUserId } from "~/lib/auth.server";
import type { Route } from "./+types/api.skills";

export async function action({ request }: Route.ActionArgs) {
  const userId = await requireUserId(request);
  const form = await request.formData();
  const _action = form.get("_action") as string;

  if (_action === "create") {
    const count = db
      .select()
      .from(skills)
      .where(eq(skills.userId, userId))
      .all().length;
    db.insert(skills)
      .values({
        userId,
        category: "new_category",
        name: "default",
        items: ["Item 1"],
        sortOrder: count,
      })
      .run();
  }

  if (_action === "update") {
    const id = Number(form.get("id"));
    const itemsRaw = (form.get("items") as string) || "";
    const items = itemsRaw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    db.update(skills)
      .set({
        category: form.get("category") as string,
        name: form.get("name") as string,
        items,
      })
      .where(and(eq(skills.id, id), eq(skills.userId, userId)))
      .run();
  }

  if (_action === "delete") {
    const id = Number(form.get("id"));
    db.delete(skills)
      .where(and(eq(skills.id, id), eq(skills.userId, userId)))
      .run();
  }

  return null;
}
