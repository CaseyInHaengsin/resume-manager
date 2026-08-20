import { eq } from "drizzle-orm";
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
} from "~/db/schema";

export const EXPORT_VERSION = 1;

export type ExportPayload = Awaited<ReturnType<typeof buildExportPayload>>;

const EMPTY_IMPORT_TEMPLATE = {
  note:
    "Use the data object below for import. Leave omitted sections as empty arrays. IDs only need to be unique within this file so related records can refer to each other.",
  requiredFields: {
    contact: ["id", "name", "email"],
    education: ["id", "school", "degrees"],
    summaries: ["id", "name", "text"],
    skills: ["id", "category", "name", "items"],
    jobs: ["id", "title", "company", "dates", "location"],
    projects: ["id", "name", "dates", "tech"],
    bullets: ["id", "parentType", "parentId", "text", "tags"],
    companies: ["id", "name", "createdAt", "updatedAt"],
    resumes: ["id", "name", "createdAt", "updatedAt"],
    resumeJobs: ["resumeId", "jobId"],
    resumeProjects: ["resumeId", "projectId"],
    resumeSkills: ["resumeId", "skillId"],
    resumeBullets: ["resumeId", "bulletId"],
    applications: ["id", "jobTitle", "createdAt", "updatedAt"],
  },
  allowedValues: {
    bullets: { parentType: ["job", "project"], priority: [1, 2, 3] },
    resumes: { template: ["modern", "classic", "minimal"] },
    applications: {
      status: [
        "wishlist",
        "applied",
        "interviewing",
        "offer",
        "accepted",
        "rejected",
      ],
    },
  },
  exampleData: {
    contact: [
      {
        id: 1,
        name: "Your Name",
        phone: "555-555-5555",
        email: "you@example.com",
        linkedin: "https://www.linkedin.com/in/your-name",
        github: "https://github.com/your-name",
      },
    ],
    education: [{ id: 1, school: "School Name", degrees: ["Degree or certification"] }],
    summaries: [{ id: 1, name: "Default", text: "Professional summary text." }],
    skills: [
      {
        id: 1,
        category: "Languages",
        name: "Core",
        items: ["TypeScript", "SQL"],
        sortOrder: 0,
      },
    ],
    jobs: [
      {
        id: 1,
        title: "Job Title",
        company: "Company Name",
        dates: "2022 - Present",
        location: "City, ST",
        sortOrder: 0,
      },
    ],
    projects: [
      {
        id: 1,
        name: "Project Name",
        dates: "2024",
        tech: "TypeScript, React",
        sortOrder: 0,
      },
    ],
    bullets: [
      {
        id: 1,
        parentType: "job",
        parentId: 1,
        text: "Impact-focused accomplishment.",
        tags: ["backend"],
        priority: 2,
        sortOrder: 0,
      },
    ],
    companies: [
      {
        id: 1,
        name: "Target Company",
        tagline: null,
        logoUrl: null,
        techStack: ["React", "PostgreSQL"],
        values: null,
        culture: null,
        industry: null,
        location: null,
        size: null,
        recentNews: [],
        notableProjects: null,
        notes: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    resumes: [
      {
        id: 1,
        name: "Resume Name",
        summaryId: 1,
        companyId: 1,
        template: "modern",
        useCustomContact: false,
        contactName: null,
        contactPhone: null,
        contactEmail: null,
        contactLinkedin: null,
        contactGithub: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    resumeJobs: [{ resumeId: 1, jobId: 1, sortOrder: 0 }],
    resumeProjects: [{ resumeId: 1, projectId: 1, sortOrder: 0 }],
    resumeSkills: [{ resumeId: 1, skillId: 1, sortOrder: 0 }],
    resumeBullets: [{ resumeId: 1, bulletId: 1, sortOrder: 0 }],
    applications: [
      {
        id: 1,
        companyId: 1,
        resumeId: 1,
        jobTitle: "Role Title",
        jobUrl: null,
        source: null,
        location: null,
        remote: false,
        salaryRange: null,
        status: "wishlist",
        appliedAt: null,
        nextStepAt: null,
        lastContactAt: null,
        notes: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
  },
} as const;

// Drops `userId` (current session supplies it on import). Keeps `id` so the
// importer can remap cross-references (e.g. bullets.parentId → jobs.id).
function stripUser<T extends { userId?: number }>(rows: T[]): Omit<T, "userId">[] {
  return rows.map(({ userId: _u, ...rest }) => rest as Omit<T, "userId">);
}

function hasExportData(data: Record<string, unknown[]>) {
  return Object.values(data).some((rows) => rows.length > 0);
}

function buildEmptyExportData() {
  return {
    contact: [],
    education: [],
    summaries: [],
    skills: [],
    jobs: [],
    projects: [],
    bullets: [],
    companies: [],
    resumes: [],
    resumeJobs: [],
    resumeProjects: [],
    resumeSkills: [],
    resumeBullets: [],
    applications: [],
  };
}

export async function buildExportPayload(
  userId: number,
  username: string,
  options: { blankTemplate?: boolean } = {},
) {
  if (options.blankTemplate) {
    return {
      version: EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      username,
      data: buildEmptyExportData(),
      _template: EMPTY_IMPORT_TEMPLATE,
    };
  }

  const [
    contactRows,
    educationRows,
    summariesRows,
    skillsRows,
    jobsRows,
    projectsRows,
    bulletsRows,
    companiesRows,
    resumesRows,
    resumeJobsRows,
    resumeProjectsRows,
    resumeSkillsRows,
    resumeBulletsRows,
    applicationsRows,
  ] = await Promise.all([
    db.select().from(contact).where(eq(contact.userId, userId)),
    db.select().from(education).where(eq(education.userId, userId)),
    db.select().from(summaries).where(eq(summaries.userId, userId)),
    db.select().from(skills).where(eq(skills.userId, userId)),
    db.select().from(jobs).where(eq(jobs.userId, userId)),
    db.select().from(projects).where(eq(projects.userId, userId)),
    db.select().from(bullets).where(eq(bullets.userId, userId)),
    db.select().from(companies).where(eq(companies.userId, userId)),
    db.select().from(resumes).where(eq(resumes.userId, userId)),
    // Join tables aren't user-scoped directly; filter via the resumes the user owns.
    db
      .select({
        id: resumeJobs.id,
        resumeId: resumeJobs.resumeId,
        jobId: resumeJobs.jobId,
        sortOrder: resumeJobs.sortOrder,
      })
      .from(resumeJobs)
      .innerJoin(resumes, eq(resumes.id, resumeJobs.resumeId))
      .where(eq(resumes.userId, userId)),
    db
      .select({
        id: resumeProjects.id,
        resumeId: resumeProjects.resumeId,
        projectId: resumeProjects.projectId,
        sortOrder: resumeProjects.sortOrder,
      })
      .from(resumeProjects)
      .innerJoin(resumes, eq(resumes.id, resumeProjects.resumeId))
      .where(eq(resumes.userId, userId)),
    db
      .select({
        id: resumeSkills.id,
        resumeId: resumeSkills.resumeId,
        skillId: resumeSkills.skillId,
        sortOrder: resumeSkills.sortOrder,
      })
      .from(resumeSkills)
      .innerJoin(resumes, eq(resumes.id, resumeSkills.resumeId))
      .where(eq(resumes.userId, userId)),
    db
      .select({
        id: resumeBullets.id,
        resumeId: resumeBullets.resumeId,
        bulletId: resumeBullets.bulletId,
        sortOrder: resumeBullets.sortOrder,
      })
      .from(resumeBullets)
      .innerJoin(resumes, eq(resumes.id, resumeBullets.resumeId))
      .where(eq(resumes.userId, userId)),
    db.select().from(applications).where(eq(applications.userId, userId)),
  ]);

  const data = {
    contact: stripUser(contactRows),
    education: stripUser(educationRows),
    summaries: stripUser(summariesRows),
    skills: stripUser(skillsRows),
    jobs: stripUser(jobsRows),
    projects: stripUser(projectsRows),
    bullets: stripUser(bulletsRows),
    companies: stripUser(companiesRows),
    resumes: stripUser(resumesRows),
    resumeJobs: resumeJobsRows,
    resumeProjects: resumeProjectsRows,
    resumeSkills: resumeSkillsRows,
    resumeBullets: resumeBulletsRows,
    applications: stripUser(applicationsRows),
  };

  return {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    username,
    data,
    _template: hasExportData(data) ? undefined : EMPTY_IMPORT_TEMPLATE,
  };
}
