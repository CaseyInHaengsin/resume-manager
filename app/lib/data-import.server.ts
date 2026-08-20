import Database from "better-sqlite3";
import path from "node:path";
import { EXPORT_VERSION, type ExportPayload } from "./data-export.server";

export class ImportError extends Error {}

export function parseImportPayload(json: unknown): ExportPayload {
  if (!json || typeof json !== "object")
    throw new ImportError("File is not a valid JSON object");
  const obj = json as Record<string, unknown>;
  if (obj.version !== EXPORT_VERSION)
    throw new ImportError(
      `Unsupported export version ${String(obj.version)} (expected ${EXPORT_VERSION})`,
    );
  if (!obj.data || typeof obj.data !== "object")
    throw new ImportError("Missing 'data' object");
  return obj as ExportPayload;
}

/**
 * Wipe-and-replace import. Runs as a single SQLite transaction at the raw
 * better-sqlite3 level (drizzle's better-sqlite3 dialect is sync, so we can
 * safely re-open the underlying handle and use db.transaction()).
 */
export function importUserData(userId: number, payload: ExportPayload) {
  // Re-open the same DB file to get a sync transaction handle. Drizzle's
  // better-sqlite3 driver doesn't expose its inner Database, so we open a
  // second handle on the same file. SQLite handles concurrent same-process
  // handles fine; the transaction will lock the DB while it runs.
  const dbPath = path.resolve("data/resume.db");
  const sqlite = new Database(dbPath);
  sqlite.pragma("foreign_keys = ON");

  try {
    const tx = sqlite.transaction(() => {
      // Wipe (FK cascades take care of resume_*, bullets parents, applications, etc.)
      // Order: delete leaf-most first to be explicit.
      sqlite.prepare("DELETE FROM applications WHERE user_id = ?").run(userId);
      sqlite.prepare("DELETE FROM resumes WHERE user_id = ?").run(userId);
      sqlite.prepare("DELETE FROM bullets WHERE user_id = ?").run(userId);
      sqlite.prepare("DELETE FROM jobs WHERE user_id = ?").run(userId);
      sqlite.prepare("DELETE FROM projects WHERE user_id = ?").run(userId);
      sqlite.prepare("DELETE FROM skills WHERE user_id = ?").run(userId);
      sqlite.prepare("DELETE FROM summaries WHERE user_id = ?").run(userId);
      sqlite.prepare("DELETE FROM education WHERE user_id = ?").run(userId);
      sqlite.prepare("DELETE FROM contact WHERE user_id = ?").run(userId);
      sqlite.prepare("DELETE FROM companies WHERE user_id = ?").run(userId);

      const d = payload.data;
      const idMap: Record<string, Map<number, number>> = {
        contact: new Map(),
        education: new Map(),
        summaries: new Map(),
        skills: new Map(),
        jobs: new Map(),
        projects: new Map(),
        bullets: new Map(),
        companies: new Map(),
        resumes: new Map(),
      };

      const insert = (
        table: string,
        cols: string[],
        values: unknown[],
      ): number => {
        const placeholders = cols.map(() => "?").join(", ");
        const stmt = sqlite.prepare(
          `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${placeholders})`,
        );
        const info = stmt.run(...(values as never[]));
        return Number(info.lastInsertRowid);
      };

      // 1. Library tables (no inter-table FKs)
      for (const r of d.contact ?? []) {
        const newId = insert(
          "contact",
          ["user_id", "name", "phone", "email", "linkedin", "github"],
          [userId, r.name, r.phone ?? null, r.email, r.linkedin ?? null, r.github ?? null],
        );
        if (r.id != null) idMap.contact.set(r.id, newId);
      }

      for (const r of d.education ?? []) {
        const newId = insert(
          "education",
          ["user_id", "school", "degrees"],
          [userId, r.school, JSON.stringify(r.degrees ?? [])],
        );
        if (r.id != null) idMap.education.set(r.id, newId);
      }

      for (const r of d.summaries ?? []) {
        const newId = insert(
          "summaries",
          ["user_id", "name", "text"],
          [userId, r.name, r.text],
        );
        if (r.id != null) idMap.summaries.set(r.id, newId);
      }

      for (const r of d.skills ?? []) {
        const newId = insert(
          "skills",
          ["user_id", "category", "name", "items", "sort_order"],
          [
            userId,
            r.category,
            r.name,
            JSON.stringify(r.items ?? []),
            r.sortOrder ?? 0,
          ],
        );
        if (r.id != null) idMap.skills.set(r.id, newId);
      }

      for (const r of d.jobs ?? []) {
        const newId = insert(
          "jobs",
          ["user_id", "title", "company", "dates", "location", "sort_order"],
          [userId, r.title, r.company, r.dates, r.location, r.sortOrder ?? 0],
        );
        if (r.id != null) idMap.jobs.set(r.id, newId);
      }

      for (const r of d.projects ?? []) {
        const newId = insert(
          "projects",
          ["user_id", "name", "dates", "tech", "sort_order"],
          [userId, r.name, r.dates, r.tech, r.sortOrder ?? 0],
        );
        if (r.id != null) idMap.projects.set(r.id, newId);
      }

      for (const r of d.companies ?? []) {
        const newId = insert(
          "companies",
          [
            "user_id",
            "name",
            "tagline",
            "logo_url",
            "tech_stack",
            "values",
            "culture",
            "industry",
            "location",
            "size",
            "recent_news",
            "notable_projects",
            "notes",
            "created_at",
            "updated_at",
          ],
          [
            userId,
            r.name,
            r.tagline ?? null,
            r.logoUrl ?? null,
            r.techStack ? JSON.stringify(r.techStack) : null,
            r.values ?? null,
            r.culture ?? null,
            r.industry ?? null,
            r.location ?? null,
            r.size ?? null,
            r.recentNews ? JSON.stringify(r.recentNews) : null,
            r.notableProjects ?? null,
            r.notes ?? null,
            r.createdAt,
            r.updatedAt,
          ],
        );
        if (r.id != null) idMap.companies.set(r.id, newId);
      }

      // 2. bullets — polymorphic FK on (parent_type, parent_id) → jobs|projects
      for (const r of d.bullets ?? []) {
        const parentMap =
          r.parentType === "job" ? idMap.jobs : idMap.projects;
        const newParentId = parentMap.get(r.parentId);
        if (newParentId == null) {
          // orphan bullet: parent didn't make it into the import. Skip.
          continue;
        }
        const newId = insert(
          "bullets",
          [
            "user_id",
            "parent_type",
            "parent_id",
            "text",
            "tags",
            "priority",
            "sort_order",
          ],
          [
            userId,
            r.parentType,
            newParentId,
            r.text,
            JSON.stringify(r.tags ?? []),
            r.priority ?? 2,
            r.sortOrder ?? 0,
          ],
        );
        if (r.id != null) idMap.bullets.set(r.id, newId);
      }

      // 3. resumes — references summaries, companies
      for (const r of d.resumes ?? []) {
        const newId = insert(
          "resumes",
          [
            "user_id",
            "name",
            "summary_id",
            "company_id",
            "template",
            "use_custom_contact",
            "contact_name",
            "contact_phone",
            "contact_email",
            "contact_linkedin",
            "contact_github",
            "created_at",
            "updated_at",
          ],
          [
            userId,
            r.name,
            r.summaryId != null ? idMap.summaries.get(r.summaryId) ?? null : null,
            r.companyId != null ? idMap.companies.get(r.companyId) ?? null : null,
            r.template ?? "modern",
            r.useCustomContact ? 1 : 0,
            r.contactName ?? null,
            r.contactPhone ?? null,
            r.contactEmail ?? null,
            r.contactLinkedin ?? null,
            r.contactGithub ?? null,
            r.createdAt,
            r.updatedAt,
          ],
        );
        if (r.id != null) idMap.resumes.set(r.id, newId);
      }

      // 4. resume_* join tables
      for (const r of d.resumeJobs ?? []) {
        const rid = idMap.resumes.get(r.resumeId);
        const jid = idMap.jobs.get(r.jobId);
        if (rid == null || jid == null) continue;
        insert(
          "resume_jobs",
          ["resume_id", "job_id", "sort_order"],
          [rid, jid, r.sortOrder ?? 0],
        );
      }
      for (const r of d.resumeProjects ?? []) {
        const rid = idMap.resumes.get(r.resumeId);
        const pid = idMap.projects.get(r.projectId);
        if (rid == null || pid == null) continue;
        insert(
          "resume_projects",
          ["resume_id", "project_id", "sort_order"],
          [rid, pid, r.sortOrder ?? 0],
        );
      }
      for (const r of d.resumeSkills ?? []) {
        const rid = idMap.resumes.get(r.resumeId);
        const sid = idMap.skills.get(r.skillId);
        if (rid == null || sid == null) continue;
        insert(
          "resume_skills",
          ["resume_id", "skill_id", "sort_order"],
          [rid, sid, r.sortOrder ?? 0],
        );
      }
      for (const r of d.resumeBullets ?? []) {
        const rid = idMap.resumes.get(r.resumeId);
        const bid = idMap.bullets.get(r.bulletId);
        if (rid == null || bid == null) continue;
        insert(
          "resume_bullets",
          ["resume_id", "bullet_id", "sort_order"],
          [rid, bid, r.sortOrder ?? 0],
        );
      }

      // 5. applications
      for (const r of d.applications ?? []) {
        insert(
          "applications",
          [
            "user_id",
            "company_id",
            "resume_id",
            "job_title",
            "job_url",
            "source",
            "location",
            "remote",
            "salary_range",
            "status",
            "applied_at",
            "next_step_at",
            "last_contact_at",
            "notes",
            "created_at",
            "updated_at",
          ],
          [
            userId,
            r.companyId != null ? idMap.companies.get(r.companyId) ?? null : null,
            r.resumeId != null ? idMap.resumes.get(r.resumeId) ?? null : null,
            r.jobTitle,
            r.jobUrl ?? null,
            r.source ?? null,
            r.location ?? null,
            r.remote ? 1 : 0,
            r.salaryRange ?? null,
            r.status ?? "applied",
            r.appliedAt ?? null,
            r.nextStepAt ?? null,
            r.lastContactAt ?? null,
            r.notes ?? null,
            r.createdAt,
            r.updatedAt,
          ],
        );
      }
    });

    tx();
  } finally {
    sqlite.close();
  }
}
