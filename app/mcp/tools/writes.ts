import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { and, eq, max } from "drizzle-orm";
import { db } from "~/db";
import {
  APPLICATION_STATUSES,
  applications,
  bullets,
  jobs,
  projects,
  skills,
} from "~/db/schema";

function jsonResult(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data) }],
  };
}

function errorResult(message: string) {
  return {
    isError: true,
    content: [{ type: "text" as const, text: message }],
  };
}

export function registerWriteTools(server: McpServer, userId: number): void {
  server.registerTool(
    "update_application_status",
    {
      description:
        "Updates the status of an application. Valid statuses: wishlist, applied, interviewing, offer, accepted, rejected. If the status moves out of 'wishlist' and appliedAt is unset, appliedAt is backfilled with today's date.",
      inputSchema: {
        id: z.number().int().positive(),
        status: z.enum(APPLICATION_STATUSES),
      },
    },
    async ({ id, status }) => {
      const existing = db
        .select()
        .from(applications)
        .where(and(eq(applications.id, id), eq(applications.userId, userId)))
        .get();
      if (!existing) return errorResult(`Application ${id} not found`);

      const patch: Record<string, unknown> = {
        status,
        updatedAt: new Date().toISOString(),
      };
      if (status !== "wishlist" && !existing.appliedAt) {
        patch.appliedAt = new Date().toISOString().slice(0, 10);
      }
      db.update(applications)
        .set(patch)
        .where(and(eq(applications.id, id), eq(applications.userId, userId)))
        .run();
      const updated = db
        .select()
        .from(applications)
        .where(and(eq(applications.id, id), eq(applications.userId, userId)))
        .get();
      return jsonResult(updated);
    },
  );

  server.registerTool(
    "append_application_note",
    {
      description:
        "Appends a note to an application's notes field, with an ISO timestamp header. Never overwrites prior content.",
      inputSchema: {
        id: z.number().int().positive(),
        note: z.string().trim().min(1),
      },
    },
    async ({ id, note }) => {
      const existing = db
        .select()
        .from(applications)
        .where(and(eq(applications.id, id), eq(applications.userId, userId)))
        .get();
      if (!existing) return errorResult(`Application ${id} not found`);

      const entry = `[${new Date().toISOString()}]\n${note}`;
      const nextNotes = existing.notes
        ? `${existing.notes}\n\n${entry}`
        : entry;
      db.update(applications)
        .set({ notes: nextNotes, updatedAt: new Date().toISOString() })
        .where(and(eq(applications.id, id), eq(applications.userId, userId)))
        .run();
      const updated = db
        .select()
        .from(applications)
        .where(and(eq(applications.id, id), eq(applications.userId, userId)))
        .get();
      return jsonResult(updated);
    },
  );

  server.registerTool(
    "add_skill",
    {
      description:
        "Creates a new skill group. 'category' is the broad bucket (e.g. 'Languages', 'Frameworks'); 'name' is the variant label (e.g. 'JS-first'); 'items' is the list of tech keywords. Rejects if a (category, name) pair already exists for this user — update that row from the app instead.",
      inputSchema: {
        category: z.string().min(1),
        name: z.string().min(1),
        items: z.array(z.string().min(1)).min(1),
      },
    },
    async ({ category, name, items }) => {
      const existing = db
        .select({ id: skills.id })
        .from(skills)
        .where(
          and(
            eq(skills.userId, userId),
            eq(skills.category, category),
            eq(skills.name, name),
          ),
        )
        .get();
      if (existing) {
        return errorResult(
          `Skill group (category=${category}, name=${name}) already exists as id=${existing.id}. Update that row instead.`,
        );
      }
      const nextSortOrderRow = db
        .select({ m: max(skills.sortOrder) })
        .from(skills)
        .where(eq(skills.userId, userId))
        .get();
      const sortOrder = (nextSortOrderRow?.m ?? -1) + 1;
      const inserted = db
        .insert(skills)
        .values({ userId, category, name, items, sortOrder })
        .returning()
        .get();
      return jsonResult(inserted);
    },
  );

  server.registerTool(
    "add_bullet",
    {
      description:
        "Adds a resume bullet to a job or project. Validates that the parent belongs to the authenticated user. 'tags' default to []; 'priority' defaults to 2 (1=high, 2=mid, 3=low).",
      inputSchema: {
        parentType: z.enum(["job", "project"]),
        parentId: z.number().int().positive(),
        text: z.string().min(1),
        tags: z.array(z.string()).optional(),
        priority: z.number().int().min(1).max(3).optional(),
      },
    },
    async ({ parentType, parentId, text, tags, priority }) => {
      const ownsParent =
        parentType === "job"
          ? !!db
              .select({ id: jobs.id })
              .from(jobs)
              .where(and(eq(jobs.id, parentId), eq(jobs.userId, userId)))
              .get()
          : !!db
              .select({ id: projects.id })
              .from(projects)
              .where(
                and(eq(projects.id, parentId), eq(projects.userId, userId)),
              )
              .get();
      if (!ownsParent) {
        return errorResult(`${parentType} ${parentId} not found`);
      }
      const nextSortOrderRow = db
        .select({ m: max(bullets.sortOrder) })
        .from(bullets)
        .where(
          and(
            eq(bullets.userId, userId),
            eq(bullets.parentType, parentType),
            eq(bullets.parentId, parentId),
          ),
        )
        .get();
      const sortOrder = (nextSortOrderRow?.m ?? -1) + 1;
      const inserted = db
        .insert(bullets)
        .values({
          userId,
          parentType,
          parentId,
          text,
          tags: tags ?? [],
          priority: priority ?? 2,
          sortOrder,
        })
        .returning()
        .get();
      return jsonResult(inserted);
    },
  );
}
