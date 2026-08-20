import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "~/db";
import {
  applications,
  bullets,
  companies,
  contact,
  education,
  jobs,
  projects,
  resumeBullets,
  resumeJobs,
  resumeProjects,
  resumeSkills,
  resumes,
  skills,
  summaries,
  users,
} from "~/db/schema";
import { buildTechStackGraph } from "~/lib/techstack.server";

function toJsonContent(data: unknown) {
  return {
    content: [
      { type: "text" as const, text: JSON.stringify(data) },
    ],
  };
}

function notFound(message: string) {
  return {
    isError: true,
    content: [{ type: "text" as const, text: message }],
  };
}

function selectUserContacts(userId: number) {
  return db.select().from(contact).where(eq(contact.userId, userId)).all();
}

function selectUserEducation(userId: number) {
  return db.select().from(education).where(eq(education.userId, userId)).all();
}

function selectUserSummaries(userId: number) {
  return db.select().from(summaries).where(eq(summaries.userId, userId)).all();
}

function selectUserJobs(userId: number) {
  return db
    .select()
    .from(jobs)
    .where(eq(jobs.userId, userId))
    .orderBy(asc(jobs.sortOrder))
    .all();
}

function selectUserProjects(userId: number) {
  return db
    .select()
    .from(projects)
    .where(eq(projects.userId, userId))
    .orderBy(asc(projects.sortOrder))
    .all();
}

function selectUserBullets(userId: number) {
  return db
    .select()
    .from(bullets)
    .where(eq(bullets.userId, userId))
    .orderBy(asc(bullets.sortOrder))
    .all();
}

function selectUserSkills(userId: number) {
  return db
    .select()
    .from(skills)
    .where(eq(skills.userId, userId))
    .orderBy(asc(skills.sortOrder))
    .all();
}

function selectUserCompanies(userId: number) {
  return db
    .select()
    .from(companies)
    .where(eq(companies.userId, userId))
    .all();
}

function selectUserResumes(userId: number) {
  return db
    .select()
    .from(resumes)
    .where(eq(resumes.userId, userId))
    .orderBy(desc(resumes.updatedAt))
    .all();
}

function selectUserApplications(userId: number) {
  return db
    .select()
    .from(applications)
    .where(eq(applications.userId, userId))
    .orderBy(desc(applications.updatedAt))
    .all();
}

function composeResume(userId: number, resumeId: number) {
  const resume = db
    .select()
    .from(resumes)
    .where(and(eq(resumes.id, resumeId), eq(resumes.userId, userId)))
    .get();
  if (!resume) return null;

  const summary = resume.summaryId
    ? db
        .select()
        .from(summaries)
        .where(
          and(eq(summaries.id, resume.summaryId), eq(summaries.userId, userId)),
        )
        .get()
    : null;

  const company = resume.companyId
    ? db
        .select()
        .from(companies)
        .where(
          and(eq(companies.id, resume.companyId), eq(companies.userId, userId)),
        )
        .get()
    : null;

  const jobLinks = db
    .select()
    .from(resumeJobs)
    .where(eq(resumeJobs.resumeId, resumeId))
    .orderBy(asc(resumeJobs.sortOrder))
    .all();
  const projectLinks = db
    .select()
    .from(resumeProjects)
    .where(eq(resumeProjects.resumeId, resumeId))
    .orderBy(asc(resumeProjects.sortOrder))
    .all();
  const bulletLinks = db
    .select()
    .from(resumeBullets)
    .where(eq(resumeBullets.resumeId, resumeId))
    .orderBy(asc(resumeBullets.sortOrder))
    .all();
  const skillLinks = db
    .select()
    .from(resumeSkills)
    .where(eq(resumeSkills.resumeId, resumeId))
    .orderBy(asc(resumeSkills.sortOrder))
    .all();

  const jobIds = jobLinks.map((l) => l.jobId);
  const projectIds = projectLinks.map((l) => l.projectId);
  const bulletIds = bulletLinks.map((l) => l.bulletId);
  const skillIds = skillLinks.map((l) => l.skillId);

  const jobRows = jobIds.length
    ? db
        .select()
        .from(jobs)
        .where(and(eq(jobs.userId, userId), inArray(jobs.id, jobIds)))
        .all()
    : [];
  const projectRows = projectIds.length
    ? db
        .select()
        .from(projects)
        .where(
          and(eq(projects.userId, userId), inArray(projects.id, projectIds)),
        )
        .all()
    : [];
  const bulletRows = bulletIds.length
    ? db
        .select()
        .from(bullets)
        .where(and(eq(bullets.userId, userId), inArray(bullets.id, bulletIds)))
        .all()
    : [];
  const skillRows = skillIds.length
    ? db
        .select()
        .from(skills)
        .where(and(eq(skills.userId, userId), inArray(skills.id, skillIds)))
        .all()
    : [];

  return {
    resume,
    summary: summary ?? null,
    company: company ?? null,
    jobs: jobRows,
    projects: projectRows,
    bullets: bulletRows,
    skills: skillRows,
    selections: {
      jobIds,
      projectIds,
      bulletIds,
      skillIds,
    },
  };
}

function composeApplication(userId: number, applicationId: number) {
  const app = db
    .select()
    .from(applications)
    .where(
      and(
        eq(applications.id, applicationId),
        eq(applications.userId, userId),
      ),
    )
    .get();
  if (!app) return null;
  const company = app.companyId
    ? db
        .select()
        .from(companies)
        .where(
          and(eq(companies.id, app.companyId), eq(companies.userId, userId)),
        )
        .get()
    : null;
  return { application: app, company: company ?? null };
}

function composeJob(userId: number, jobId: number) {
  const job = db
    .select()
    .from(jobs)
    .where(and(eq(jobs.id, jobId), eq(jobs.userId, userId)))
    .get();
  if (!job) return null;
  const jobBullets = db
    .select()
    .from(bullets)
    .where(
      and(
        eq(bullets.userId, userId),
        eq(bullets.parentType, "job"),
        eq(bullets.parentId, jobId),
      ),
    )
    .orderBy(asc(bullets.sortOrder))
    .all();
  return { job, bullets: jobBullets };
}

function composeProject(userId: number, projectId: number) {
  const project = db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .get();
  if (!project) return null;
  const projectBullets = db
    .select()
    .from(bullets)
    .where(
      and(
        eq(bullets.userId, userId),
        eq(bullets.parentType, "project"),
        eq(bullets.parentId, projectId),
      ),
    )
    .orderBy(asc(bullets.sortOrder))
    .all();
  return { project, bullets: projectBullets };
}

function parentBelongsToUser(
  userId: number,
  parentType: "job" | "project",
  parentId: number,
): boolean {
  if (parentType === "job") {
    const row = db
      .select({ id: jobs.id })
      .from(jobs)
      .where(and(eq(jobs.id, parentId), eq(jobs.userId, userId)))
      .get();
    return !!row;
  }
  const row = db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, parentId), eq(projects.userId, userId)))
    .get();
  return !!row;
}

export function registerReadTools(server: McpServer, userId: number): void {
  server.registerTool(
    "get_profile",
    {
      description:
        "Returns the authenticated user's full data: contact, education, resumes, jobs, projects, bullets, skills, companies, applications, summaries, tech stack. Use this for a full dump / export.",
      inputSchema: {},
    },
    async () => {
      const user = db
        .select({ id: users.id, username: users.username })
        .from(users)
        .where(eq(users.id, userId))
        .get();
      const data = {
        user,
        contact: selectUserContacts(userId),
        education: selectUserEducation(userId),
        summaries: selectUserSummaries(userId),
        resumes: selectUserResumes(userId),
        jobs: selectUserJobs(userId),
        projects: selectUserProjects(userId),
        bullets: selectUserBullets(userId),
        skills: selectUserSkills(userId),
        companies: selectUserCompanies(userId),
        applications: selectUserApplications(userId),
        techStack: buildTechStackGraph(userId),
      };
      return toJsonContent(data);
    },
  );

  server.registerTool(
    "get_contact",
    {
      description:
        "Returns the user's contact info (name, email, phone, linkedin, github). Latest row if multiple exist.",
      inputSchema: {},
    },
    async () => {
      const rows = selectUserContacts(userId);
      return toJsonContent(rows[rows.length - 1] ?? null);
    },
  );

  server.registerTool(
    "get_education",
    {
      description: "Returns the user's education rows (school + degrees).",
      inputSchema: {},
    },
    async () => toJsonContent(selectUserEducation(userId)),
  );

  server.registerTool(
    "list_summaries",
    {
      description: "Returns the user's saved resume summaries (named paragraphs).",
      inputSchema: {},
    },
    async () => toJsonContent(selectUserSummaries(userId)),
  );

  server.registerTool(
    "list_resumes",
    {
      description:
        "Returns all resumes for the user, ordered by most-recently-updated.",
      inputSchema: {},
    },
    async () => toJsonContent(selectUserResumes(userId)),
  );

  server.registerTool(
    "get_resume",
    {
      description:
        "Returns a full resume composed with its summary, target company, selected jobs/projects/bullets/skills.",
      inputSchema: { id: z.number().int().positive() },
    },
    async ({ id }) => {
      const data = composeResume(userId, id);
      if (!data) return notFound(`Resume ${id} not found`);
      return toJsonContent(data);
    },
  );

  server.registerTool(
    "list_applications",
    {
      description:
        "Returns all job applications. Optionally filter by status (wishlist | applied | interviewing | offer | accepted | rejected).",
      inputSchema: {
        status: z
          .enum([
            "wishlist",
            "applied",
            "interviewing",
            "offer",
            "accepted",
            "rejected",
          ])
          .optional(),
      },
    },
    async ({ status }) => {
      const rows = selectUserApplications(userId);
      const filtered = status ? rows.filter((r) => r.status === status) : rows;
      return toJsonContent(filtered);
    },
  );

  server.registerTool(
    "get_application",
    {
      description:
        "Returns a single application with its resolved company (if any).",
      inputSchema: { id: z.number().int().positive() },
    },
    async ({ id }) => {
      const data = composeApplication(userId, id);
      if (!data) return notFound(`Application ${id} not found`);
      return toJsonContent(data);
    },
  );

  server.registerTool(
    "list_jobs",
    {
      description: "Returns the user's work-history jobs.",
      inputSchema: {},
    },
    async () => toJsonContent(selectUserJobs(userId)),
  );

  server.registerTool(
    "get_job",
    {
      description: "Returns a single job with its bullets.",
      inputSchema: { id: z.number().int().positive() },
    },
    async ({ id }) => {
      const data = composeJob(userId, id);
      if (!data) return notFound(`Job ${id} not found`);
      return toJsonContent(data);
    },
  );

  server.registerTool(
    "list_projects",
    {
      description: "Returns the user's projects.",
      inputSchema: {},
    },
    async () => toJsonContent(selectUserProjects(userId)),
  );

  server.registerTool(
    "get_project",
    {
      description: "Returns a single project with its bullets.",
      inputSchema: { id: z.number().int().positive() },
    },
    async ({ id }) => {
      const data = composeProject(userId, id);
      if (!data) return notFound(`Project ${id} not found`);
      return toJsonContent(data);
    },
  );

  server.registerTool(
    "list_companies",
    {
      description:
        "Returns all research-target companies (tagline, tech stack, culture, notes, recent news).",
      inputSchema: {},
    },
    async () => toJsonContent(selectUserCompanies(userId)),
  );

  server.registerTool(
    "get_company",
    {
      description: "Returns a single company.",
      inputSchema: { id: z.number().int().positive() },
    },
    async ({ id }) => {
      const row = db
        .select()
        .from(companies)
        .where(and(eq(companies.id, id), eq(companies.userId, userId)))
        .get();
      if (!row) return notFound(`Company ${id} not found`);
      return toJsonContent(row);
    },
  );

  server.registerTool(
    "get_skills",
    {
      description: "Returns all skill groups for the user (category + name + items list).",
      inputSchema: {},
    },
    async () => toJsonContent(selectUserSkills(userId)),
  );

  server.registerTool(
    "get_tech_stack",
    {
      description:
        "Returns the user's unified tech-stack graph: nodes (unique tech keywords with their source companies and skill groups) and links (co-occurrence edges).",
      inputSchema: {},
    },
    async () => toJsonContent(buildTechStackGraph(userId)),
  );

  server.registerTool(
    "list_bullets_for",
    {
      description:
        "Returns all bullets for a given parent (job or project). Validates parent ownership.",
      inputSchema: {
        parentType: z.enum(["job", "project"]),
        parentId: z.number().int().positive(),
      },
    },
    async ({ parentType, parentId }) => {
      if (!parentBelongsToUser(userId, parentType, parentId)) {
        return notFound(`${parentType} ${parentId} not found`);
      }
      const rows = db
        .select()
        .from(bullets)
        .where(
          and(
            eq(bullets.userId, userId),
            eq(bullets.parentType, parentType),
            eq(bullets.parentId, parentId),
          ),
        )
        .orderBy(asc(bullets.sortOrder))
        .all();
      return toJsonContent(rows);
    },
  );
}
