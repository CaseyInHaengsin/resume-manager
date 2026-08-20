import { redirect } from "react-router";
import { db } from "~/db";
import {
  resumes,
  resumeJobs,
  resumeProjects,
  resumeBullets,
  resumeSkills,
  contact,
} from "~/db/schema";
import { and, eq } from "drizzle-orm";
import { requireUserId } from "~/lib/auth.server";
import type { Route } from "./+types/api.resumes";

/** Returns the resume row iff it belongs to userId. */
function ownedResume(id: number, userId: number) {
  return db
    .select()
    .from(resumes)
    .where(and(eq(resumes.id, id), eq(resumes.userId, userId)))
    .get();
}

export async function action({ request }: Route.ActionArgs) {
  const userId = await requireUserId(request);
  const form = await request.formData();
  const _action = form.get("_action") as string;

  if (_action === "create") {
    const name = (form.get("name") as string) || "Untitled Resume";
    const now = new Date().toISOString();
    const inserted = db
      .insert(resumes)
      .values({ userId, name, createdAt: now, updatedAt: now })
      .returning()
      .get();
    return redirect(`/builder/${inserted.id}`);
  }

  if (_action === "duplicate") {
    const sourceId = Number(form.get("id"));
    const source = ownedResume(sourceId, userId);
    if (!source) return new Response("Not found", { status: 404 });

    const now = new Date().toISOString();
    const copy = db
      .insert(resumes)
      .values({
        userId,
        name: `${source.name} (copy)`,
        summaryId: source.summaryId,
        companyId: source.companyId,
        template: source.template,
        useCustomContact: source.useCustomContact,
        contactName: source.contactName,
        contactPhone: source.contactPhone,
        contactEmail: source.contactEmail,
        contactLinkedin: source.contactLinkedin,
        contactGithub: source.contactGithub,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .get();

    const srcJobs = db
      .select()
      .from(resumeJobs)
      .where(eq(resumeJobs.resumeId, sourceId))
      .all();
    for (const r of srcJobs) {
      db.insert(resumeJobs)
        .values({ resumeId: copy.id, jobId: r.jobId, sortOrder: r.sortOrder })
        .run();
    }
    const srcProjects = db
      .select()
      .from(resumeProjects)
      .where(eq(resumeProjects.resumeId, sourceId))
      .all();
    for (const r of srcProjects) {
      db.insert(resumeProjects)
        .values({
          resumeId: copy.id,
          projectId: r.projectId,
          sortOrder: r.sortOrder,
        })
        .run();
    }
    const srcBullets = db
      .select()
      .from(resumeBullets)
      .where(eq(resumeBullets.resumeId, sourceId))
      .all();
    for (const r of srcBullets) {
      db.insert(resumeBullets)
        .values({
          resumeId: copy.id,
          bulletId: r.bulletId,
          sortOrder: r.sortOrder,
        })
        .run();
    }
    const srcSkills = db
      .select()
      .from(resumeSkills)
      .where(eq(resumeSkills.resumeId, sourceId))
      .all();
    for (const r of srcSkills) {
      db.insert(resumeSkills)
        .values({
          resumeId: copy.id,
          skillId: r.skillId,
          sortOrder: r.sortOrder,
        })
        .run();
    }

    return redirect(`/builder/${copy.id}`);
  }

  if (_action === "update") {
    const id = Number(form.get("id"));
    if (!ownedResume(id, userId))
      return new Response("Not found", { status: 404 });
    const name = form.get("name") as string;
    const summaryId = form.get("summaryId")
      ? Number(form.get("summaryId"))
      : null;
    db.update(resumes)
      .set({ name, summaryId, updatedAt: new Date().toISOString() })
      .where(and(eq(resumes.id, id), eq(resumes.userId, userId)))
      .run();
  }

  if (_action === "delete") {
    const id = Number(form.get("id"));
    db.delete(resumes)
      .where(and(eq(resumes.id, id), eq(resumes.userId, userId)))
      .run();
    return redirect("/builder");
  }

  if (_action === "toggle_job") {
    const resumeId = Number(form.get("resumeId"));
    if (!ownedResume(resumeId, userId))
      return new Response("Not found", { status: 404 });
    const jobId = Number(form.get("jobId"));
    const existing = db
      .select()
      .from(resumeJobs)
      .where(eq(resumeJobs.resumeId, resumeId))
      .all()
      .find((r) => r.jobId === jobId);
    if (existing) {
      db.delete(resumeJobs).where(eq(resumeJobs.id, existing.id)).run();
    } else {
      const count = db
        .select()
        .from(resumeJobs)
        .where(eq(resumeJobs.resumeId, resumeId))
        .all().length;
      db.insert(resumeJobs)
        .values({ resumeId, jobId, sortOrder: count })
        .run();
    }
    db.update(resumes)
      .set({ updatedAt: new Date().toISOString() })
      .where(and(eq(resumes.id, resumeId), eq(resumes.userId, userId)))
      .run();
  }

  if (_action === "toggle_project") {
    const resumeId = Number(form.get("resumeId"));
    if (!ownedResume(resumeId, userId))
      return new Response("Not found", { status: 404 });
    const projectId = Number(form.get("projectId"));
    const existing = db
      .select()
      .from(resumeProjects)
      .where(eq(resumeProjects.resumeId, resumeId))
      .all()
      .find((r) => r.projectId === projectId);
    if (existing) {
      db.delete(resumeProjects)
        .where(eq(resumeProjects.id, existing.id))
        .run();
    } else {
      const count = db
        .select()
        .from(resumeProjects)
        .where(eq(resumeProjects.resumeId, resumeId))
        .all().length;
      db.insert(resumeProjects)
        .values({ resumeId, projectId, sortOrder: count })
        .run();
    }
    db.update(resumes)
      .set({ updatedAt: new Date().toISOString() })
      .where(and(eq(resumes.id, resumeId), eq(resumes.userId, userId)))
      .run();
  }

  if (_action === "toggle_bullet") {
    const resumeId = Number(form.get("resumeId"));
    if (!ownedResume(resumeId, userId))
      return new Response("Not found", { status: 404 });
    const bulletId = Number(form.get("bulletId"));
    const existing = db
      .select()
      .from(resumeBullets)
      .where(eq(resumeBullets.resumeId, resumeId))
      .all()
      .find((r) => r.bulletId === bulletId);
    if (existing) {
      db.delete(resumeBullets)
        .where(eq(resumeBullets.id, existing.id))
        .run();
    } else {
      const count = db
        .select()
        .from(resumeBullets)
        .where(eq(resumeBullets.resumeId, resumeId))
        .all().length;
      db.insert(resumeBullets)
        .values({ resumeId, bulletId, sortOrder: count })
        .run();
    }
    db.update(resumes)
      .set({ updatedAt: new Date().toISOString() })
      .where(and(eq(resumes.id, resumeId), eq(resumes.userId, userId)))
      .run();
  }

  if (_action === "toggle_skill") {
    const resumeId = Number(form.get("resumeId"));
    if (!ownedResume(resumeId, userId))
      return new Response("Not found", { status: 404 });
    const skillId = Number(form.get("skillId"));
    const existing = db
      .select()
      .from(resumeSkills)
      .where(eq(resumeSkills.resumeId, resumeId))
      .all()
      .find((r) => r.skillId === skillId);
    if (existing) {
      db.delete(resumeSkills).where(eq(resumeSkills.id, existing.id)).run();
    } else {
      const count = db
        .select()
        .from(resumeSkills)
        .where(eq(resumeSkills.resumeId, resumeId))
        .all().length;
      db.insert(resumeSkills)
        .values({ resumeId, skillId, sortOrder: count })
        .run();
    }
    db.update(resumes)
      .set({ updatedAt: new Date().toISOString() })
      .where(and(eq(resumes.id, resumeId), eq(resumes.userId, userId)))
      .run();
  }

  if (_action === "set_template") {
    const resumeId = Number(form.get("resumeId"));
    const template = form.get("template") as string;
    db.update(resumes)
      .set({ template, updatedAt: new Date().toISOString() })
      .where(and(eq(resumes.id, resumeId), eq(resumes.userId, userId)))
      .run();
  }

  if (_action === "set_summary") {
    const resumeId = Number(form.get("resumeId"));
    const summaryId = form.get("summaryId")
      ? Number(form.get("summaryId"))
      : null;
    db.update(resumes)
      .set({ summaryId, updatedAt: new Date().toISOString() })
      .where(and(eq(resumes.id, resumeId), eq(resumes.userId, userId)))
      .run();
  }

  if (_action === "set_company") {
    const resumeId = Number(form.get("resumeId"));
    const raw = form.get("companyId");
    const companyId = raw ? Number(raw) : null;
    db.update(resumes)
      .set({ companyId, updatedAt: new Date().toISOString() })
      .where(and(eq(resumes.id, resumeId), eq(resumes.userId, userId)))
      .run();
  }

  if (_action === "toggle_custom_contact") {
    const resumeId = Number(form.get("resumeId"));
    const useCustomContact = form.get("useCustomContact") === "1";
    // On first enable, seed the override fields from the global contact row so
    // the user has sensible starting values to selectively redact.
    const resume = ownedResume(resumeId, userId);
    if (!resume) return new Response("Not found", { status: 404 });
    const set: Record<string, unknown> = {
      useCustomContact,
      updatedAt: new Date().toISOString(),
    };
    if (
      useCustomContact &&
      !resume.useCustomContact &&
      resume.contactName === null
    ) {
      const contactRow = db
        .select()
        .from(contact)
        .where(eq(contact.userId, userId))
        .get();
      if (contactRow) {
        set.contactName = contactRow.name;
        set.contactPhone = contactRow.phone;
        set.contactEmail = contactRow.email;
        set.contactLinkedin = contactRow.linkedin;
        set.contactGithub = contactRow.github;
      }
    }
    db.update(resumes)
      .set(set)
      .where(and(eq(resumes.id, resumeId), eq(resumes.userId, userId)))
      .run();
  }

  if (_action === "set_contact_field") {
    const resumeId = Number(form.get("resumeId"));
    const field = form.get("field") as string;
    const raw = form.get("value");
    const value = typeof raw === "string" ? raw : "";
    const allowed = new Set([
      "contactName",
      "contactPhone",
      "contactEmail",
      "contactLinkedin",
      "contactGithub",
    ]);
    if (!allowed.has(field))
      return new Response("Bad field", { status: 400 });
    db.update(resumes)
      .set({ [field]: value, updatedAt: new Date().toISOString() })
      .where(and(eq(resumes.id, resumeId), eq(resumes.userId, userId)))
      .run();
  }

  return new Response("ok", { status: 200 });
}
