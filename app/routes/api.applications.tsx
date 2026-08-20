import { redirect } from "react-router";
import { db } from "~/db";
import {
  applications,
  APPLICATION_STATUSES,
  type ApplicationStatus,
} from "~/db/schema";
import { and, eq } from "drizzle-orm";
import { requireUserId } from "~/lib/auth.server";
import type { Route } from "./+types/api.applications";

function isStatus(s: unknown): s is ApplicationStatus {
  return (
    typeof s === "string" &&
    (APPLICATION_STATUSES as readonly string[]).includes(s)
  );
}

function strOrNull(form: FormData, key: string): string | null {
  const v = form.get(key);
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}

function numOrNull(form: FormData, key: string): number | null {
  const v = form.get(key);
  if (typeof v !== "string" || v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function action({ request }: Route.ActionArgs) {
  const userId = await requireUserId(request);
  const form = await request.formData();
  const _action = form.get("_action") as string;

  if (_action === "create") {
    const jobTitle = strOrNull(form, "jobTitle") ?? "Untitled Role";
    const statusRaw = form.get("status");
    const status = isStatus(statusRaw) ? statusRaw : "applied";
    const appliedAt =
      strOrNull(form, "appliedAt") ??
      (status === "wishlist" ? null : new Date().toISOString().slice(0, 10));
    const now = new Date().toISOString();
    const inserted = db
      .insert(applications)
      .values({
        userId,
        companyId: numOrNull(form, "companyId"),
        resumeId: numOrNull(form, "resumeId"),
        jobTitle,
        jobUrl: strOrNull(form, "jobUrl"),
        source: strOrNull(form, "source"),
        location: strOrNull(form, "location"),
        remote: form.get("remote") === "1",
        salaryRange: strOrNull(form, "salaryRange"),
        status,
        appliedAt,
        nextStepAt: strOrNull(form, "nextStepAt"),
        lastContactAt: strOrNull(form, "lastContactAt"),
        notes: strOrNull(form, "notes"),
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: applications.id })
      .get();
    const redirectTo = strOrNull(form, "redirectTo");
    return redirect(redirectTo ?? `/applications/${inserted.id}`);
  }

  if (_action === "update") {
    const id = Number(form.get("id"));
    const statusRaw = form.get("status");
    const status = isStatus(statusRaw) ? statusRaw : undefined;
    const next: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
      jobTitle: strOrNull(form, "jobTitle") ?? "Untitled Role",
      companyId: numOrNull(form, "companyId"),
      resumeId: numOrNull(form, "resumeId"),
      jobUrl: strOrNull(form, "jobUrl"),
      source: strOrNull(form, "source"),
      location: strOrNull(form, "location"),
      remote: form.get("remote") === "1",
      salaryRange: strOrNull(form, "salaryRange"),
      appliedAt: strOrNull(form, "appliedAt"),
      nextStepAt: strOrNull(form, "nextStepAt"),
      lastContactAt: strOrNull(form, "lastContactAt"),
      notes: strOrNull(form, "notes"),
    };
    if (status) next.status = status;
    db.update(applications)
      .set(next)
      .where(
        and(eq(applications.id, id), eq(applications.userId, userId)),
      )
      .run();
    return redirect(`/applications/${id}`);
  }

  if (_action === "set_status") {
    const id = Number(form.get("id"));
    const statusRaw = form.get("status");
    if (!isStatus(statusRaw))
      return new Response("Bad status", { status: 400 });
    const patch: Record<string, unknown> = {
      status: statusRaw,
      updatedAt: new Date().toISOString(),
    };
    // Convenience: if moving out of wishlist, set applied_at to today when unset.
    if (statusRaw !== "wishlist") {
      const row = db
        .select({ appliedAt: applications.appliedAt })
        .from(applications)
        .where(
          and(eq(applications.id, id), eq(applications.userId, userId)),
        )
        .get();
      if (row && !row.appliedAt) {
        patch.appliedAt = new Date().toISOString().slice(0, 10);
      }
    }
    db.update(applications)
      .set(patch)
      .where(
        and(eq(applications.id, id), eq(applications.userId, userId)),
      )
      .run();
    return new Response("ok");
  }

  if (_action === "delete") {
    const id = Number(form.get("id"));
    db.delete(applications)
      .where(
        and(eq(applications.id, id), eq(applications.userId, userId)),
      )
      .run();
    return redirect("/applications");
  }

  return new Response("Unknown action", { status: 400 });
}
