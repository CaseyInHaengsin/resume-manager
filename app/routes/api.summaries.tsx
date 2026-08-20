import { db } from "~/db";
import { summaries } from "~/db/schema";
import { and, eq } from "drizzle-orm";
import { requireUserId } from "~/lib/auth.server";
import type { Route } from "./+types/api.summaries";

export async function action({ request }: Route.ActionArgs) {
  const userId = await requireUserId(request);
  const form = await request.formData();
  const _action = form.get("_action") as string;

  if (_action === "create") {
    db.insert(summaries)
      .values({ userId, name: "New Summary", text: "Edit this summary..." })
      .run();
  }

  if (_action === "update") {
    const id = Number(form.get("id"));
    db.update(summaries)
      .set({
        name: form.get("name") as string,
        text: form.get("text") as string,
      })
      .where(and(eq(summaries.id, id), eq(summaries.userId, userId)))
      .run();
  }

  if (_action === "delete") {
    const id = Number(form.get("id"));
    db.delete(summaries)
      .where(and(eq(summaries.id, id), eq(summaries.userId, userId)))
      .run();
  }

  return null;
}
